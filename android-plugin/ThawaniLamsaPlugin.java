/**
 * Thawani Lamsa Capacitor Plugin - Real SDK Implementation
 * 
 * This plugin bridges the Capacitor web layer with the native Android Thawani Lamsa SDK.
 * It uses reflection to avoid compile-time dependency on the SDK, so the APK builds
 * successfully even without Lamsa Maven credentials. When the SDK is present at runtime,
 * it launches the LamsaSDK Activity for NFC tap-to-pay.
 * 
 * SDK Reference: https://thawani.gitbook.io/lamsa
 * Maven: om.thawani:lamsa.sdk:0.0.31
 */

package app.lovable.awkafpaymentkiosk;

import android.app.Activity;
import android.content.Context;
import android.content.Intent;
import android.nfc.NfcAdapter;
import android.nfc.NfcManager;
import android.util.Log;

import androidx.activity.result.ActivityResult;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.Serializable;
import java.lang.reflect.Constructor;

@CapacitorPlugin(name = "ThawaniLamsa")
public class ThawaniLamsaPlugin extends Plugin {

    private static final String TAG = "ThawaniLamsaPlugin";
    private static final String SDK_CLASS = "om.thawani.lamsa.sdk.LamsaSDK";
    private static final String OPTIONS_CLASS = "om.thawani.lamsa.sdk.models.InitOptionsModel";
    private static final String RESULT_CLASS = "om.thawani.lamsa.sdk.models.PaymentResultModel";
    private static final String PAYMENT_OPTIONS_CLASS = "om.thawani.lamsa.sdk.enums.PaymentOptions";
    private static final String PAYMENT_SERVICE_CLASS = "om.thawani.lamsa.sdk.enums.PaymentService";

    private String authKey = null;
    private boolean isProduction = false;
    private boolean sdkAvailable = false;
    private Class<?> lamsaSdkClass = null;
    private Class<?> optionsClass = null;
    private Class<?> paymentOptionsClass = null;
    private Class<?> paymentServiceClass = null;

    private void detectSdk() {
        try {
            lamsaSdkClass = Class.forName(SDK_CLASS);
            optionsClass = Class.forName(OPTIONS_CLASS);
            paymentOptionsClass = Class.forName(PAYMENT_OPTIONS_CLASS);
            paymentServiceClass = Class.forName(PAYMENT_SERVICE_CLASS);
            sdkAvailable = true;
        } catch (ClassNotFoundException e) {
            lamsaSdkClass = null;
            optionsClass = null;
            paymentOptionsClass = null;
            paymentServiceClass = null;
            sdkAvailable = false;
        }
    }

    @PluginMethod
    public void isAvailable(PluginCall call) {
        Log.d(TAG, "isAvailable called");
        detectSdk();
        JSObject result = new JSObject();
        result.put("available", sdkAvailable);
        call.resolve(result);
    }

    @PluginMethod
    public void initialize(PluginCall call) {
        authKey = call.getString("tajerToken", "");
        isProduction = call.getBoolean("isProduction", false);
        Log.d(TAG, "initialize: authKey length=" + authKey.length() + ", isProduction=" + isProduction);

        detectSdk();

        JSObject result = new JSObject();
        // success is TRUE only when the Lamsa SDK class is actually present in the APK.
        // This lets the JS layer fail loudly if the SDK didn't get bundled.
        result.put("success", sdkAvailable);
        result.put("sdkAvailable", sdkAvailable);
        result.put("message", sdkAvailable ? "Lamsa SDK initialized" : "SDK not in classpath - bundling failed");
        call.resolve(result);
    }

    @PluginMethod
    public void checkNFCStatus(PluginCall call) {
        Context context = getContext();
        NfcManager nfcManager = (NfcManager) context.getSystemService(Context.NFC_SERVICE);
        NfcAdapter nfcAdapter = nfcManager != null ? nfcManager.getDefaultAdapter() : null;

        JSObject result = new JSObject();
        if (nfcAdapter == null) {
            result.put("isAvailable", false);
            result.put("isEnabled", false);
            result.put("errorMessage", "NFC hardware is not available on this device");
        } else if (!nfcAdapter.isEnabled()) {
            result.put("isAvailable", true);
            result.put("isEnabled", false);
            result.put("errorMessage", "NFC is disabled. Please enable NFC in device settings.");
        } else {
            result.put("isAvailable", true);
            result.put("isEnabled", true);
        }
        call.resolve(result);
    }

    @PluginMethod
    public void startPayment(PluginCall call) {
        double amount = call.getDouble("amount", 0.0);
        String transactionId = call.getString("transactionId", "");
        String remarks = call.getString("remarks", "Donation " + transactionId);

        Log.d(TAG, "startPayment: amount=" + amount + ", txId=" + transactionId);

        detectSdk();

        if (!sdkAvailable || lamsaSdkClass == null || optionsClass == null || paymentOptionsClass == null || paymentServiceClass == null) {
            Log.w(TAG, "SDK not available - returning error");
            JSObject result = new JSObject();
            result.put("success", false);
            result.put("errorCode", "SDK_NOT_AVAILABLE");
            result.put("errorMessage", "Thawani Lamsa SDK not linked. Use test mode.");
            result.put("transactionId", transactionId);
            result.put("timestamp", String.valueOf(System.currentTimeMillis()));
            call.resolve(result);
            return;
        }

        if (authKey == null || authKey.isEmpty()) {
            JSObject result = new JSObject();
            result.put("success", false);
            result.put("errorCode", "NOT_INITIALIZED");
            result.put("errorMessage", "SDK not initialized. Call initialize() first.");
            result.put("transactionId", transactionId);
            result.put("timestamp", String.valueOf(System.currentTimeMillis()));
            call.resolve(result);
            return;
        }

        bridge.saveCall(call);

        try {
            // Create InitOptionsModel via reflection using the official 0.0.31 constructor:
            // (double amount, String authKey, boolean isProduction, String remarks,
            //  PaymentOptions paymentOption, Integer paymentRequestId,
            //  LocalDateTime expiryDate, Integer autoCloseInMillis, PaymentService paymentService)
            Object paymentOption = Enum.valueOf((Class<Enum>) paymentOptionsClass.asSubclass(Enum.class), "CARD_ACCEPT");
            Object paymentService = Enum.valueOf((Class<Enum>) paymentServiceClass.asSubclass(Enum.class), "LAMSA");
            Constructor<?> ctor = optionsClass.getConstructor(
                double.class, String.class, boolean.class, String.class,
                paymentOptionsClass, Integer.class, java.time.LocalDateTime.class, Integer.class, paymentServiceClass
            );
            Object options = ctor.newInstance(amount, authKey, isProduction, remarks, paymentOption, null, null, Integer.valueOf(3000), paymentService);

            Intent intent = new Intent(getContext(), lamsaSdkClass);
            intent.putExtra("SDKInitOptions", (Serializable) options);

            startActivityForResult(call, intent, "handlePaymentResult");
            Log.d(TAG, "LamsaSDK Activity launched");

        } catch (Exception e) {
            Log.e(TAG, "Failed to launch LamsaSDK", e);
            PluginCall savedCall = bridge.getSavedCall(call.getCallbackId());
            if (savedCall != null) {
                JSObject result = new JSObject();
                result.put("success", false);
                result.put("errorCode", "LAUNCH_FAILED");
                result.put("errorMessage", "Failed to launch payment: " + e.getMessage());
                result.put("transactionId", transactionId);
                result.put("timestamp", String.valueOf(System.currentTimeMillis()));
                savedCall.resolve(result);
                bridge.releaseCall(savedCall);
            }
        }
    }

    @ActivityCallback
    private void handlePaymentResult(PluginCall call, ActivityResult activityResult) {
        if (call == null) {
            Log.e(TAG, "handlePaymentResult: call is null");
            return;
        }

        JSObject result = new JSObject();
        String transactionId = call.getString("transactionId", "");

        if (activityResult.getResultCode() == Activity.RESULT_OK && activityResult.getData() != null) {
            Intent data = activityResult.getData();

            try {
                Serializable paymentResult = data.getSerializableExtra("result");
                if (paymentResult == null) {
                    paymentResult = data.getSerializableExtra("paymentResult");
                }

                if (paymentResult != null) {
                    // Use reflection to read PaymentResultModel fields
                    Class<?> cls = paymentResult.getClass();

                    Object statusObject = cls.getMethod("getPaymentStatus").invoke(paymentResult);
                    int paymentStatus = statusObject instanceof Integer ? (Integer) statusObject : 0;
                    Object successObject = cls.getMethod("getSuccess").invoke(paymentResult);
                    boolean success = successObject instanceof Boolean ? (Boolean) successObject : paymentStatus == 2;

                    result.put("success", success);
                    result.put("transactionId", transactionId);

                    Object paymentId = cls.getMethod("getPaymentId").invoke(paymentResult);
                    result.put("thawaniReference", paymentId != null ? paymentId.toString() : "");

                    Object invoice = cls.getMethod("getInvoice").invoke(paymentResult);
                    result.put("approvalCode", invoice != null ? invoice.toString() : "");

                    Object desc = cls.getMethod("getDescription").invoke(paymentResult);
                    result.put("responseMessage", desc != null ? desc.toString() : "");

                    result.put("responseCode", String.valueOf(paymentStatus));

                    Object amt = cls.getMethod("getAmount").invoke(paymentResult);
                    result.put("amount", amt != null ? amt : 0);

                    Object date = cls.getMethod("getDate").invoke(paymentResult);
                    result.put("timestamp", date != null ? date.toString() : String.valueOf(System.currentTimeMillis()));

                    if (!success) {
                        result.put("errorCode", String.valueOf(paymentStatus));
                        result.put("errorMessage", desc != null ? desc.toString() : "Payment declined");
                    }

                    Log.d(TAG, "Payment result: success=" + success + ", ref=" + paymentId);
                } else {
                    result.put("success", false);
                    result.put("transactionId", transactionId);
                    result.put("errorCode", "NO_RESULT");
                    result.put("errorMessage", "SDK returned no payment result");
                    result.put("timestamp", String.valueOf(System.currentTimeMillis()));
                }
            } catch (Exception e) {
                Log.e(TAG, "Error parsing payment result", e);
                result.put("success", false);
                result.put("transactionId", transactionId);
                result.put("errorCode", "PARSE_ERROR");
                result.put("errorMessage", "Failed to parse payment result: " + e.getMessage());
                result.put("timestamp", String.valueOf(System.currentTimeMillis()));
            }
        } else if (activityResult.getResultCode() == Activity.RESULT_CANCELED) {
            result.put("success", false);
            result.put("transactionId", transactionId);
            result.put("errorCode", "CANCELLED");
            result.put("errorMessage", "Payment was cancelled by user");
            result.put("timestamp", String.valueOf(System.currentTimeMillis()));
        } else {
            result.put("success", false);
            result.put("transactionId", transactionId);
            result.put("errorCode", "UNKNOWN");
            result.put("errorMessage", "Unexpected result code: " + activityResult.getResultCode());
            result.put("timestamp", String.valueOf(System.currentTimeMillis()));
        }

        call.resolve(result);
    }

    @PluginMethod
    public void cancelPayment(PluginCall call) {
        Log.d(TAG, "cancelPayment called");
        JSObject result = new JSObject();
        result.put("success", true);
        call.resolve(result);
    }

    @PluginMethod
    public void getStatus(PluginCall call) {
        JSObject result = new JSObject();
        result.put("isInitialized", authKey != null && !authKey.isEmpty());
        result.put("isReady", sdkAvailable);
        result.put("mode", sdkAvailable ? "sdk" : "stub");
        call.resolve(result);
    }
}
