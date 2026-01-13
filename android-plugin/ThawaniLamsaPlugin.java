/**
 * Thawani Lamsa Capacitor Plugin - Stub Implementation for Trial Phase
 * 
 * This file is a PLACEHOLDER that will be replaced with the real implementation
 * when the Thawani Lamsa SDK is approved for production use.
 * 
 * During the trial phase:
 * - The app uses mock SoftPOS implementation in JavaScript
 * - This plugin is NOT included in the build
 * - No SDK dependencies are required
 * 
 * For production:
 * 1. Update this file with the real SDK implementation
 * 2. Enable SDK dependency in build.gradle
 * 3. Re-enable GitHub Packages authentication in workflow
 */

package app.lovable.awkafpaymentkiosk;

import android.app.Activity;
import android.content.Context;
import android.nfc.NfcAdapter;
import android.nfc.NfcManager;
import android.util.Log;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * STUB PLUGIN - Trial Phase Only
 * 
 * This plugin provides a stub implementation that always returns mock mode.
 * The actual Thawani SDK integration is handled by JavaScript mock service.
 */
@CapacitorPlugin(name = "ThawaniLamsa")
public class ThawaniLamsaPlugin extends Plugin {
    
    private static final String TAG = "ThawaniLamsaPlugin";
    
    @PluginMethod
    public void isAvailable(PluginCall call) {
        Log.d(TAG, "isAvailable called - returning false (trial mode, SDK not available)");
        JSObject result = new JSObject();
        // Return false to indicate native SDK is not available
        // This will trigger the JavaScript mock implementation
        result.put("available", false);
        call.resolve(result);
    }
    
    @PluginMethod
    public void initialize(PluginCall call) {
        Log.d(TAG, "initialize called - stub implementation (trial mode)");
        
        JSObject result = new JSObject();
        result.put("success", true);
        result.put("message", "Trial mode - using JavaScript mock implementation");
        call.resolve(result);
    }
    
    @PluginMethod
    public void checkNFCStatus(PluginCall call) {
        Log.d(TAG, "checkNFCStatus called");
        
        // Check real NFC status for device capability detection
        Context context = getContext();
        NfcManager nfcManager = (NfcManager) context.getSystemService(Context.NFC_SERVICE);
        NfcAdapter nfcAdapter = nfcManager != null ? nfcManager.getDefaultAdapter() : null;
        
        JSObject result = new JSObject();
        
        if (nfcAdapter == null) {
            Log.w(TAG, "NFC hardware not available");
            result.put("isAvailable", false);
            result.put("isEnabled", false);
            result.put("errorMessage", "NFC hardware is not available on this device");
        } else if (!nfcAdapter.isEnabled()) {
            Log.w(TAG, "NFC is disabled");
            result.put("isAvailable", true);
            result.put("isEnabled", false);
            result.put("errorMessage", "NFC is disabled. Please enable NFC in device settings.");
        } else {
            Log.i(TAG, "NFC is available and enabled");
            result.put("isAvailable", true);
            result.put("isEnabled", true);
        }
        
        call.resolve(result);
    }
    
    @PluginMethod
    public void startPayment(PluginCall call) {
        Log.d(TAG, "startPayment called - stub implementation (trial mode)");
        
        // In trial mode, we don't actually process payments
        // The JavaScript mock service handles simulated payments
        String transactionId = call.getString("transactionId", "");
        
        JSObject result = new JSObject();
        result.put("success", false);
        result.put("transactionId", transactionId);
        result.put("errorCode", "SDK_NOT_AVAILABLE");
        result.put("errorMessage", "Thawani SDK not available in trial mode. Using mock payments.");
        result.put("timestamp", System.currentTimeMillis());
        
        call.resolve(result);
    }
    
    @PluginMethod
    public void cancelPayment(PluginCall call) {
        Log.d(TAG, "cancelPayment called - stub implementation");
        
        JSObject result = new JSObject();
        result.put("success", true);
        call.resolve(result);
    }
    
    @PluginMethod
    public void getStatus(PluginCall call) {
        Log.d(TAG, "getStatus called - stub implementation");
        
        JSObject result = new JSObject();
        result.put("isInitialized", false);
        result.put("isReady", false);
        result.put("mode", "mock");
        result.put("message", "Trial mode - SDK not available");
        call.resolve(result);
    }
}
