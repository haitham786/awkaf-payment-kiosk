/**
 * Thawani Lamsa Capacitor Plugin - Stub Implementation
 * 
 * This stub bridges the Capacitor web layer with the native Android NFC hardware.
 * It does NOT depend on the Thawani Lamsa SDK (om.thawani:lamsa.sdk).
 * 
 * When in TEST mode, the web layer handles payment simulation.
 * When the real SDK is available, replace this with the full implementation.
 */

package app.lovable.awkafpaymentkiosk;

import android.content.Context;
import android.nfc.NfcAdapter;
import android.nfc.NfcManager;
import android.util.Log;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "ThawaniLamsa")
public class ThawaniLamsaPlugin extends Plugin {

    private static final String TAG = "ThawaniLamsaPlugin";

    private String authKey = null;
    private boolean isProduction = false;

    @PluginMethod
    public void isAvailable(PluginCall call) {
        Log.d(TAG, "isAvailable called - stub mode (SDK not linked)");
        JSObject result = new JSObject();
        result.put("available", false);
        call.resolve(result);
    }

    @PluginMethod
    public void initialize(PluginCall call) {
        authKey = call.getString("tajerToken", "");
        isProduction = call.getBoolean("isProduction", false);
        Log.d(TAG, "initialize (stub): authKey length=" + authKey.length() + ", isProduction=" + isProduction);

        JSObject result = new JSObject();
        result.put("success", true);
        result.put("message", "Stub plugin initialized - payments handled by web layer in test mode");
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
        Log.d(TAG, "startPayment called - stub mode, payment handled by web layer");
        JSObject result = new JSObject();
        result.put("success", false);
        result.put("errorCode", "SDK_NOT_AVAILABLE");
        result.put("errorMessage", "Thawani SDK not linked. Use test mode (web simulation).");
        result.put("transactionId", call.getString("transactionId", ""));
        result.put("timestamp", String.valueOf(System.currentTimeMillis()));
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
        result.put("isReady", false);
        result.put("mode", "stub");
        call.resolve(result);
    }
}
