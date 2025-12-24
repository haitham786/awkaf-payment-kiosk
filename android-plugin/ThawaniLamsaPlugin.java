/**
 * Thawani Lamsa Capacitor Plugin - Native Android Implementation
 * 
 * This file should be placed in the Android project at:
 * android/app/src/main/java/app/lovable/awkafpaymentkiosk/ThawaniLamsaPlugin.java
 * 
 * IMPORTANT: This file is a reference implementation.
 * It will be automatically injected into the Android project during the build process.
 */

package app.lovable.awkafpaymentkiosk;

import android.app.Activity;
import android.content.Intent;
import android.nfc.NfcAdapter;
import android.nfc.NfcManager;
import android.content.Context;
import android.util.Log;

import androidx.activity.result.ActivityResult;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;

import om.thawani.lamsa.sdk.LamsaSDK;
import om.thawani.lamsa.sdk.models.InitOptionsModel;
import om.thawani.lamsa.sdk.models.PaymentOptions;
import om.thawani.lamsa.sdk.models.PaymentResultModel;

@CapacitorPlugin(name = "ThawaniLamsa")
public class ThawaniLamsaPlugin extends Plugin {
    
    private static final String TAG = "ThawaniLamsaPlugin";
    private static final int LAMSA_REQUEST_CODE = 9001;
    
    private boolean isInitialized = false;
    private String tajerToken = null;
    private boolean isProduction = false;
    
    @PluginMethod
    public void isAvailable(PluginCall call) {
        Log.d(TAG, "isAvailable called");
        JSObject result = new JSObject();
        result.put("available", true);
        call.resolve(result);
    }
    
    @PluginMethod
    public void initialize(PluginCall call) {
        Log.d(TAG, "initialize called");
        
        String token = call.getString("tajerToken");
        Boolean production = call.getBoolean("isProduction", false);
        
        if (token == null || token.isEmpty()) {
            Log.e(TAG, "Tajer Token is required");
            JSObject result = new JSObject();
            result.put("success", false);
            result.put("message", "Tajer Token is required");
            call.resolve(result);
            return;
        }
        
        this.tajerToken = token;
        this.isProduction = production;
        this.isInitialized = true;
        
        Log.i(TAG, "Thawani Lamsa SDK initialized successfully");
        Log.i(TAG, "Environment: " + (production ? "PRODUCTION" : "TRIAL/SANDBOX"));
        
        JSObject result = new JSObject();
        result.put("success", true);
        result.put("message", "Thawani Lamsa SDK initialized successfully");
        call.resolve(result);
    }
    
    @PluginMethod
    public void checkNFCStatus(PluginCall call) {
        Log.d(TAG, "checkNFCStatus called");
        
        Context context = getContext();
        NfcManager nfcManager = (NfcManager) context.getSystemService(Context.NFC_SERVICE);
        NfcAdapter nfcAdapter = nfcManager != null ? nfcManager.getDefaultAdapter() : null;
        
        JSObject result = new JSObject();
        
        if (nfcAdapter == null) {
            Log.w(TAG, "NFC is not available on this device");
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
        Log.d(TAG, "startPayment called");
        
        if (!isInitialized || tajerToken == null) {
            Log.e(TAG, "SDK not initialized");
            JSObject result = new JSObject();
            result.put("success", false);
            result.put("transactionId", call.getString("transactionId", ""));
            result.put("errorCode", "NOT_INITIALIZED");
            result.put("errorMessage", "Thawani SDK is not initialized. Please initialize first.");
            result.put("timestamp", System.currentTimeMillis());
            call.resolve(result);
            return;
        }
        
        Double amount = call.getDouble("amount");
        String transactionId = call.getString("transactionId");
        String remarks = call.getString("remarks", "Payment via Awkaf Kiosk");
        
        if (amount == null || amount <= 0) {
            Log.e(TAG, "Invalid amount");
            JSObject result = new JSObject();
            result.put("success", false);
            result.put("transactionId", transactionId);
            result.put("errorCode", "INVALID_AMOUNT");
            result.put("errorMessage", "Invalid payment amount");
            result.put("timestamp", System.currentTimeMillis());
            call.resolve(result);
            return;
        }
        
        Log.i(TAG, "Starting Thawani payment: amount=" + amount + ", transactionId=" + transactionId);
        
        // Save the call for later resolution
        bridge.saveCall(call);
        
        try {
            // Build Lamsa SDK initialization options (per official docs)
            // NOTE: autoCloseInMillis is set to 0 to effectively disable auto-close during testing.
            InitOptionsModel options = new InitOptionsModel(
                amount,
                tajerToken,
                remarks + " | Ref: " + transactionId,
                isProduction,
                PaymentOptions.CARD_ACCEPT,
                0
            );

            // Create intent to launch Lamsa SDK
            Intent intent = new Intent(getActivity(), LamsaSDK.class);
            intent.putExtra("SDKInitOptions", options);

            // Start activity for result
            startActivityForResult(call, intent, "handlePaymentResult");

            Log.i(TAG, "Lamsa SDK activity launched successfully");

        } catch (Exception e) {
            Log.e(TAG, "Failed to start Lamsa SDK: " + e.getMessage(), e);
            
            JSObject result = new JSObject();
            result.put("success", false);
            result.put("transactionId", transactionId);
            result.put("errorCode", "SDK_LAUNCH_FAILED");
            result.put("errorMessage", "Failed to launch payment terminal: " + e.getMessage());
            result.put("timestamp", System.currentTimeMillis());
            call.resolve(result);
        }
    }
    
    @ActivityCallback
    private void handlePaymentResult(PluginCall call, ActivityResult activityResult) {
        Log.d(TAG, "handlePaymentResult called with resultCode: " + activityResult.getResultCode());
        
        if (call == null) {
            Log.e(TAG, "PluginCall is null in handlePaymentResult");
            return;
        }
        
        String transactionId = call.getString("transactionId", "");
        Intent data = activityResult.getData();
        int resultCode = activityResult.getResultCode();
        
        JSObject result = new JSObject();
        result.put("transactionId", transactionId);
        result.put("timestamp", System.currentTimeMillis());
        
        if (resultCode == Activity.RESULT_OK && data != null) {
            // Payment successful
            Log.i(TAG, "Payment successful");
            
            String thawaniRef = data.getStringExtra("transaction_reference");
            String approvalCode = data.getStringExtra("approval_code");
            String cardType = data.getStringExtra("card_type");
            String cardLastFour = data.getStringExtra("card_last_four");
            String responseCode = data.getStringExtra("response_code");
            String responseMessage = data.getStringExtra("response_message");
            
            result.put("success", true);
            result.put("thawaniReference", thawaniRef != null ? thawaniRef : "");
            result.put("approvalCode", approvalCode != null ? approvalCode : "");
            result.put("cardType", cardType != null ? cardType : "");
            result.put("cardLastFour", cardLastFour != null ? cardLastFour : "");
            result.put("responseCode", responseCode != null ? responseCode : "00");
            result.put("responseMessage", responseMessage != null ? responseMessage : "Approved");
            
            Log.i(TAG, "Payment result: thawaniRef=" + thawaniRef + ", approvalCode=" + approvalCode);
            
        } else if (resultCode == Activity.RESULT_CANCELED) {
            // User cancelled
            Log.w(TAG, "Payment cancelled by user");
            
            result.put("success", false);
            result.put("errorCode", "USER_CANCELLED");
            result.put("errorMessage", "Payment was cancelled by the user");
            
        } else {
            // Payment failed
            Log.e(TAG, "Payment failed with resultCode: " + resultCode);
            
            String errorCode = data != null ? data.getStringExtra("error_code") : null;
            String errorMessage = data != null ? data.getStringExtra("error_message") : null;
            
            result.put("success", false);
            result.put("errorCode", errorCode != null ? errorCode : "PAYMENT_FAILED");
            result.put("errorMessage", errorMessage != null ? errorMessage : "Payment was declined");
            
            if (data != null) {
                String responseCode = data.getStringExtra("response_code");
                String responseMessage = data.getStringExtra("response_message");
                result.put("responseCode", responseCode);
                result.put("responseMessage", responseMessage);
            }
        }
        
        call.resolve(result);
    }
    
    @PluginMethod
    public void cancelPayment(PluginCall call) {
        Log.d(TAG, "cancelPayment called");
        
        // Note: Cancellation is typically handled by the user pressing back
        // in the Lamsa SDK activity. This method is for cleanup.
        
        JSObject result = new JSObject();
        result.put("success", true);
        call.resolve(result);
    }
    
    @PluginMethod
    public void getStatus(PluginCall call) {
        Log.d(TAG, "getStatus called");
        
        JSObject result = new JSObject();
        result.put("isInitialized", isInitialized);
        result.put("isReady", isInitialized && tajerToken != null && !tajerToken.isEmpty());
        call.resolve(result);
    }
}
