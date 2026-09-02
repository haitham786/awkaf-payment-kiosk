package app.lovable.awkafpaymentkiosk;

import android.app.PendingIntent;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.hardware.usb.UsbConstants;
import android.hardware.usb.UsbDevice;
import android.hardware.usb.UsbDeviceConnection;
import android.hardware.usb.UsbEndpoint;
import android.hardware.usb.UsbInterface;
import android.hardware.usb.UsbManager;
import android.os.Build;
import android.util.Log;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.ByteArrayOutputStream;
import java.nio.charset.StandardCharsets;
import java.util.HashMap;
import java.util.Map;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * USB-serial ECR driver for the National Bank of Oman OM-A880 EFT-POS terminal.
 *
 * Implements the framing described in the "ECR / EFT POS Direct Integration
 * Specification v1.22":
 *
 *   ECR -> POS : STX  <xml payload>  ETX  LRC
 *   POS -> ECR : ACK (0x06)
 *   POS -> ECR : intermediate messages (ACKed by the ECR)
 *   POS -> ECR : final response frame (ACKed by the ECR)
 *
 * The terminal must be in Interface (ECR) mode and connected over USB-OTG.
 */
@CapacitorPlugin(name = "NboEcr")
public class NboEcrPlugin extends Plugin {

    private static final String TAG = "NboEcr";
    private static final String ACTION_USB_PERMISSION = "app.lovable.awkafpaymentkiosk.USB_PERMISSION";

    private static final byte STX = 0x02;
    private static final byte ETX = 0x03;
    private static final byte ACK = 0x06;
    private static final byte NAK = 0x15;

    /** Command identifiers from the specification. */
    private static final String CMD_PURCHASE = "100";
    private static final String CMD_VOID_PURCHASE = "102";

    private final AtomicBoolean cancelRequested = new AtomicBoolean(false);
    private volatile boolean busy = false;

    // ---------------------------------------------------------------- API

    @PluginMethod
    public void isAvailable(PluginCall call) {
        UsbManager manager = (UsbManager) getContext().getSystemService(Context.USB_SERVICE);
        JSObject ret = new JSObject();
        if (manager == null) {
            ret.put("available", false);
            ret.put("deviceAttached", false);
            ret.put("error", "USB service unavailable on this device");
            call.resolve(ret);
            return;
        }
        boolean attached = !manager.getDeviceList().isEmpty();
        ret.put("available", true);
        ret.put("deviceAttached", attached);
        call.resolve(ret);
    }

    @PluginMethod
    public void listDevices(PluginCall call) {
        UsbManager manager = (UsbManager) getContext().getSystemService(Context.USB_SERVICE);
        JSArray devices = new JSArray();
        if (manager != null) {
            for (UsbDevice device : manager.getDeviceList().values()) {
                JSObject item = new JSObject();
                item.put("vendorId", device.getVendorId());
                item.put("productId", device.getProductId());
                item.put("name", device.getDeviceName());
                devices.put(item);
            }
        }
        JSObject ret = new JSObject();
        ret.put("devices", devices);
        call.resolve(ret);
    }

    @PluginMethod
    public void cancel(PluginCall call) {
        cancelRequested.set(true);
        JSObject ret = new JSObject();
        try {
            if (!busy) {
                // Nothing in flight: push a standalone cancel so the terminal
                // clears the amount currently shown on its screen.
                sendCancelFrame(call.getInt("vendorId", 0), call.getInt("productId", 0),
                        call.getInt("baudRate", 115200));
            }
            ret.put("cancelled", true);
        } catch (Exception e) {
            Log.w(TAG, "cancel failed", e);
            ret.put("cancelled", false);
            ret.put("error", e.getMessage());
        }
        call.resolve(ret);
    }

    @PluginMethod
    public void purchase(final PluginCall call) {
        final int amountBaisas = call.getInt("amountBaisas", 0);
        final String transactionId = call.getString("transactionId", "");
        final int baudRate = call.getInt("baudRate", 115200);
        final int vendorId = call.getInt("vendorId", 0);
        final int productId = call.getInt("productId", 0);
        final int timeoutSeconds = call.getInt("timeoutSeconds", 90);

        if (amountBaisas <= 0) {
            call.resolve(errorResult("INVALID_AMOUNT", "Invalid amount"));
            return;
        }

        cancelRequested.set(false);
        busy = true;

        new Thread(() -> {
            try {
                JSObject result = runPurchase(amountBaisas, transactionId, baudRate, vendorId, productId, timeoutSeconds);
                call.resolve(result);
            } catch (Exception e) {
                Log.e(TAG, "purchase failed", e);
                call.resolve(errorResult("TRANSPORT_ERROR", e.getMessage()));
            } finally {
                busy = false;
            }
        }).start();
    }

    // ------------------------------------------------------------ internals

    private JSObject runPurchase(int amountBaisas, String transactionId, int baudRate,
                                 int vendorId, int productId, int timeoutSeconds) throws Exception {
        Session session = openSession(vendorId, productId, baudRate);
        if (session == null) {
            return errorResult("NO_DEVICE", "OM-A880 terminal not detected on USB");
        }

        try {
            String ecrRef = shortRef(transactionId);
            String xml = buildPurchaseXml(amountBaisas, ecrRef);
            session.writeFrame(xml);

            long deadline = System.currentTimeMillis() + (long) timeoutSeconds * 1000L;
            while (System.currentTimeMillis() < deadline) {
                if (cancelRequested.get()) {
                    try {
                        session.writeFrame(buildCancelXml(ecrRef));
                    } catch (Exception ignored) {
                        // best effort — the donor already left the screen
                    }
                    JSObject cancelled = new JSObject();
                    cancelled.put("approved", false);
                    cancelled.put("completed", false);
                    cancelled.put("cancelled", true);
                    cancelled.put("responseText", "Cancelled by kiosk");
                    return cancelled;
                }

                String frame = session.readFrame(1000);
                if (frame == null) continue;

                session.writeByte(ACK);

                // Intermediate messages carry a progress code only; keep waiting
                // for the final response that contains the transaction outcome.
                if (isIntermediate(frame)) {
                    Log.d(TAG, "intermediate: " + tag(frame, "CommandType"));
                    continue;
                }

                // Some OM-A880 firmware echoes the purchase request (CommandType
                // 100 + Amount/MREFValue) as soon as it accepts the amount. That
                // frame means the terminal is waiting for the card; it is NOT a
                // declined transaction. Only finish once the response contains
                // an actual bank/terminal outcome.
                if (!isFinalPurchaseResponse(frame)) {
                    Log.d(TAG, "Ignoring purchase acknowledgement without a final outcome");
                    continue;
                }

                return parseFinalResponse(frame);
            }

            return errorResult("TIMEOUT", "The payment terminal did not respond in time");
        } finally {
            session.close();
        }
    }

    private boolean isIntermediate(String xml) {
        String commandType = tag(xml, "CommandType");
        if (commandType == null || !commandType.matches("\\d{3}")) return false;
        int code = Integer.parseInt(commandType);
        return code >= 1 && code <= 30;
    }

    private boolean isFinalPurchaseResponse(String xml) {
        String responseCode = firstNonEmpty(tag(xml, "ResponseCode"), tag(xml, "RespCode"), tag(xml, "HostRspCode"));
        String txnStatus = tag(xml, "TxnStatus");
        String errorCode = tag(xml, "ErrorCode");

        // A host response or transaction status is conclusive. E000 means only
        // "No Error" and may accompany an early acknowledgement, so it cannot
        // complete the purchase by itself. Any other terminal error is final.
        if (responseCode != null || firstNonEmpty(txnStatus) != null) return true;
        return errorCode != null
                && errorCode.trim().length() > 0
                && !"E000".equalsIgnoreCase(errorCode.trim());
    }

    private JSObject parseFinalResponse(String xml) {
        String responseCode = firstNonEmpty(tag(xml, "ResponseCode"), tag(xml, "RespCode"), tag(xml, "HostRspCode"));
        String txnStatus = tag(xml, "TxnStatus");
        String responseText = firstNonEmpty(tag(xml, "ResponseDesc"), tag(xml, "HostDesc"), tag(xml, "ErrorMessage"));
        String errorCode = tag(xml, "ErrorCode");

        boolean approved = "00".equalsIgnoreCase(responseCode)
                || "000".equals(responseCode)
                || "APPROVED".equalsIgnoreCase(responseCode)
                || (responseText != null && responseText.toUpperCase().contains("APPROVED"))
                || "1".equals(txnStatus)
                || "OK".equalsIgnoreCase(txnStatus)
                || "APPROVED".equalsIgnoreCase(txnStatus);

        // E000 explicitly means "No Error" in the NBO specification.
        if (errorCode != null && errorCode.length() > 0 && !"E000".equalsIgnoreCase(errorCode)) {
            approved = false;
        }

        JSObject ret = new JSObject();
        ret.put("approved", approved);
        ret.put("completed", true);
        ret.put("responseCode", responseCode);
        ret.put("responseText", responseText);
        ret.put("rrn", tag(xml, "RRN"));
        ret.put("authCode", tag(xml, "AuthCode"));
        ret.put("invoiceNumber", firstNonEmpty(tag(xml, "InvoiceNo"), tag(xml, "InvoiceNumber")));
        ret.put("cardType", firstNonEmpty(tag(xml, "CardSchemeName"), tag(xml, "ApplicationLabel")));
        ret.put("cardLastFour", lastFour(firstNonEmpty(tag(xml, "MaskCardNumber"), tag(xml, "CardNo"))));
        ret.put("tid", tag(xml, "TID"));
        ret.put("mid", tag(xml, "MID"));
        ret.put("errorCode", errorCode);
        ret.put("raw", xml);
        return ret;
    }

    private void sendCancelFrame(int vendorId, int productId, int baudRate) throws Exception {
        Session session = openSession(vendorId, productId, baudRate);
        if (session == null) return;
        try {
            session.writeFrame(buildCancelXml(""));
        } finally {
            session.close();
        }
    }

    private String buildPurchaseXml(int amountBaisas, String ecrRef) {
        // Amount is a variable-length integer in minor units, up to 12 digits.
        String amount = Integer.toString(amountBaisas);
        return "<EFTData>"
                + "<CommandType>" + CMD_PURCHASE + "</CommandType>"
                + "<Amount>" + amount + "</Amount>"
                + "<MREFValue>" + ecrRef + "</MREFValue>"
                + "</EFTData>";
    }

    private String buildCancelXml(String ecrRef) {
        return "<EFTData>"
                + "<CommandType>" + CMD_VOID_PURCHASE + "</CommandType>"
                + "<Amount>0</Amount>"
                + "<InvoiceNo>" + ecrRef + "</InvoiceNo>"
                + "</EFTData>";
    }

    private static String shortRef(String transactionId) {
        String digits = transactionId == null ? "" : transactionId.replaceAll("[^0-9]", "");
        if (digits.length() >= 6) return digits.substring(digits.length() - 6);
        return String.format("%06d", (int) (System.currentTimeMillis() % 1000000L));
    }

    private static String tag(String xml, String name) {
        Matcher m = Pattern.compile("<" + name + ">\\s*(.*?)\\s*</\\s*" + name + ">",
                Pattern.CASE_INSENSITIVE | Pattern.DOTALL).matcher(xml);
        return m.find() ? m.group(1) : null;
    }

    private static String firstNonEmpty(String... values) {
        for (String v : values) {
            if (v != null && v.trim().length() > 0) return v.trim();
        }
        return null;
    }

    private static String lastFour(String pan) {
        if (pan == null) return null;
        String digits = pan.replaceAll("[^0-9]", "");
        return digits.length() >= 4 ? digits.substring(digits.length() - 4) : null;
    }

    private JSObject errorResult(String code, String message) {
        JSObject ret = new JSObject();
        ret.put("approved", false);
        ret.put("completed", false);
        ret.put("errorCode", code);
        ret.put("error", message);
        return ret;
    }

    // ------------------------------------------------------------ USB layer

    private Session openSession(int vendorId, int productId, int baudRate) throws Exception {
        UsbManager manager = (UsbManager) getContext().getSystemService(Context.USB_SERVICE);
        if (manager == null) return null;

        UsbDevice device = null;
        for (UsbDevice candidate : manager.getDeviceList().values()) {
            if (vendorId > 0 && candidate.getVendorId() != vendorId) continue;
            if (productId > 0 && candidate.getProductId() != productId) continue;
            device = candidate;
            break;
        }
        if (device == null) return null;

        if (!manager.hasPermission(device)) {
            requestPermission(manager, device);
            if (!manager.hasPermission(device)) {
                throw new IllegalStateException("USB permission denied for the payment terminal");
            }
        }

        UsbDeviceConnection connection = manager.openDevice(device);
        if (connection == null) throw new IllegalStateException("Unable to open the USB terminal");

        UsbInterface dataInterface = null;
        UsbEndpoint in = null;
        UsbEndpoint out = null;

        for (int i = 0; i < device.getInterfaceCount(); i++) {
            UsbInterface candidate = device.getInterface(i);
            UsbEndpoint candidateIn = null;
            UsbEndpoint candidateOut = null;
            for (int e = 0; e < candidate.getEndpointCount(); e++) {
                UsbEndpoint endpoint = candidate.getEndpoint(e);
                if (endpoint.getType() != UsbConstants.USB_ENDPOINT_XFER_BULK) continue;
                if (endpoint.getDirection() == UsbConstants.USB_DIR_IN) candidateIn = endpoint;
                else candidateOut = endpoint;
            }
            if (candidateIn != null && candidateOut != null) {
                dataInterface = candidate;
                in = candidateIn;
                out = candidateOut;
                break;
            }
        }

        if (dataInterface == null) {
            connection.close();
            throw new IllegalStateException("No serial data interface found on the terminal");
        }

        connection.claimInterface(dataInterface, true);
        setLineCoding(connection, baudRate);
        return new Session(connection, dataInterface, in, out);
    }

    private void requestPermission(UsbManager manager, UsbDevice device) throws InterruptedException {
        final Object lock = new Object();
        BroadcastReceiver receiver = new BroadcastReceiver() {
            @Override
            public void onReceive(Context context, Intent intent) {
                synchronized (lock) {
                    lock.notifyAll();
                }
            }
        };
        IntentFilter filter = new IntentFilter(ACTION_USB_PERMISSION);
        int flags = Build.VERSION.SDK_INT >= Build.VERSION_CODES.S ? PendingIntent.FLAG_MUTABLE : 0;
        PendingIntent intent = PendingIntent.getBroadcast(getContext(), 0, new Intent(ACTION_USB_PERMISSION), flags);

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            getContext().registerReceiver(receiver, filter, Context.RECEIVER_NOT_EXPORTED);
        } else {
            getContext().registerReceiver(receiver, filter);
        }

        try {
            manager.requestPermission(device, intent);
            synchronized (lock) {
                lock.wait(15000);
            }
        } finally {
            try {
                getContext().unregisterReceiver(receiver);
            } catch (Exception ignored) {
            }
        }
    }

    /** CDC SET_LINE_CODING: baud, 1 stop bit, no parity, 8 data bits. */
    private void setLineCoding(UsbDeviceConnection connection, int baudRate) {
        byte[] lineCoding = new byte[]{
                (byte) (baudRate & 0xFF),
                (byte) ((baudRate >> 8) & 0xFF),
                (byte) ((baudRate >> 16) & 0xFF),
                (byte) ((baudRate >> 24) & 0xFF),
                0, 0, 8
        };
        connection.controlTransfer(0x21, 0x20, 0, 0, lineCoding, lineCoding.length, 2000);
        connection.controlTransfer(0x21, 0x22, 0x03, 0, null, 0, 2000);
    }

    private static class Session {
        private static final int FRAME_SEND_ATTEMPTS = 3;
        private static final int HANDSHAKE_TIMEOUT_MS = 2500;
        private final UsbDeviceConnection connection;
        private final UsbInterface iface;
        private final UsbEndpoint in;
        private final UsbEndpoint out;
        private final ByteArrayOutputStream buffer = new ByteArrayOutputStream();

        Session(UsbDeviceConnection connection, UsbInterface iface, UsbEndpoint in, UsbEndpoint out) {
            this.connection = connection;
            this.iface = iface;
            this.in = in;
            this.out = out;
        }

        void writeByte(byte value) {
            connection.bulkTransfer(out, new byte[]{value}, 1, 2000);
        }

        /** STX + payload + ETX + LRC, followed by the mandatory POS ACK. */
        void writeFrame(String payload) throws Exception {
            byte[] body = payload.getBytes(StandardCharsets.US_ASCII);
            byte lrc = 0;
            for (byte b : body) lrc ^= b;
            lrc ^= ETX;

            byte[] frame = new byte[body.length + 3];
            frame[0] = STX;
            System.arraycopy(body, 0, frame, 1, body.length);
            frame[body.length + 1] = ETX;
            frame[body.length + 2] = lrc;

            for (int attempt = 1; attempt <= FRAME_SEND_ATTEMPTS; attempt++) {
                int written = connection.bulkTransfer(out, frame, frame.length, 5000);
                if (written != frame.length) {
                    if (attempt == FRAME_SEND_ATTEMPTS) {
                        throw new IllegalStateException("Incomplete write to the payment terminal");
                    }
                    continue;
                }

                byte handshake = readHandshake(HANDSHAKE_TIMEOUT_MS);
                if (handshake == ACK) return;

                if (handshake == NAK) {
                    // The terminal explicitly rejected the frame — resend it.
                    Log.w(TAG, "POS returned NAK; send attempt " + attempt + " of " + FRAME_SEND_ATTEMPTS);
                    if (attempt == FRAME_SEND_ATTEMPTS) {
                        throw new IllegalStateException("Payment terminal rejected the command (NAK)");
                    }
                    continue;
                }

                // No handshake byte arrived. Several OM-A880 firmware builds
                // answer with the transaction frame directly instead of an ACK,
                // so a missing ACK must NOT abort the sale — the amount is
                // already on the terminal. Continue and wait for the response.
                Log.w(TAG, "POS did not send an ACK; continuing to wait for the transaction response");
                return;
            }

        }

        /**
         * Waits for the ACK/NAK that belongs to the frame just written. Any
         * response-frame bytes arriving in the same USB packet are preserved.
         */
        private byte readHandshake(int timeoutMs) {
            byte[] chunk = new byte[1024];
            long deadline = System.currentTimeMillis() + timeoutMs;
            while (System.currentTimeMillis() < deadline) {
                int remaining = (int) Math.max(1L, deadline - System.currentTimeMillis());
                int read = connection.bulkTransfer(in, chunk, chunk.length, Math.min(200, remaining));
                if (read <= 0) continue;

                byte handshake = 0;
                for (int i = 0; i < read; i++) {
                    byte value = chunk[i];
                    if (handshake == 0 && (value == ACK || value == NAK)) {
                        handshake = value;
                    } else {
                        buffer.write(value);
                    }
                }
                if (handshake != 0) return handshake;
            }
            return 0;
        }

        /** Reads one complete STX..ETX frame, or null if none arrived in time. */
        String readFrame(int timeoutMs) throws Exception {
            byte[] chunk = new byte[1024];
            long deadline = System.currentTimeMillis() + timeoutMs;

            while (System.currentTimeMillis() < deadline) {
                String framed = extractFrame();
                if (framed != null) return framed;

                int read = connection.bulkTransfer(in, chunk, chunk.length, 200);
                if (read > 0) {
                    for (int i = 0; i < read; i++) {
                        byte b = chunk[i];
                        if (b == ACK || b == NAK) continue; // handshake bytes
                        buffer.write(b);
                    }
                }
            }
            return extractFrame();
        }

        private String extractFrame() throws Exception {
            byte[] data = buffer.toByteArray();
            int start = -1;
            for (int i = 0; i < data.length; i++) {
                if (data[i] == STX) { start = i; break; }
            }
            if (start < 0) return null;
            int end = -1;
            for (int i = start + 1; i < data.length; i++) {
                if (data[i] == ETX) { end = i; break; }
            }
            if (end < 0) return null;

            if (data.length <= end + 1) return null;

            byte expectedLrc = 0;
            for (int i = start + 1; i <= end; i++) expectedLrc ^= data[i];
            byte receivedLrc = data[end + 1];
            if (expectedLrc != receivedLrc) {
                writeByte(NAK);
                discardThrough(data, end + 2);
                Log.w(TAG, "Discarded response frame with invalid LRC");
                return null;
            }

            String payload = new String(data, start + 1, end - start - 1, StandardCharsets.US_ASCII);

            // Drop the consumed bytes (frame + LRC) from the buffer.
            discardThrough(data, end + 2);
            return payload;
        }

        private void discardThrough(byte[] data, int consumedCount) throws Exception {
            int consumed = Math.min(data.length, consumedCount);
            byte[] rest = new byte[data.length - consumed];
            System.arraycopy(data, consumed, rest, 0, rest.length);
            buffer.reset();
            buffer.write(rest);
        }

        void close() {
            try {
                connection.releaseInterface(iface);
            } catch (Exception ignored) {
            }
            try {
                connection.close();
            } catch (Exception ignored) {
            }
        }
    }

    private static Map<String, UsbDevice> emptyMap() {
        return new HashMap<>();
    }
}
