/**
 * Thawani Lamsa Capacitor Plugin - Real SDK Implementation
 * 
 * This plugin bridges the Capacitor web layer with the native Android Thawani Lamsa SDK.
 * It launches the LamsaSDK Activity for NFC tap-to-pay and returns payment results
 * back to the TypeScript layer via Capacitor's bridge.
 * 
 * SDK Reference: https://thawani.gitbook.io/lamsa
 * Maven: om.thawani:lamsa.sdk:0.0.22
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

import om.thawani.lamsa.sdk.LamsaSDK;
import om.thawani.lamsa.sdk.model.InitOptionsModel;
import om.thawani.lamsa.sdk.model.PaymentResultModel;

@CapacitorPlugin(name = "ThawaniLamsa")
public class ThawaniLamsaPlugin extends Plugin {

    private static final String TAG = "ThawaniLamsaPlugin";

    private String authKey = null;
    private boolean isProduction = false;
    private boolean sdkAvailable = false;

    @PluginMethod
    public void isAvailable(PluginCall call) {
        Log.d(TAG, "isAvailable called");
        JSObject result = new JSObject();
        // Check if SDK classes are loadable
        try {
            Class.forName("om.thawani.lamsa.sdk.LamsaSDK");
            sdkAvailable = true;
        } catch (ClassNotFoundException e) {
            sdkAvailable = false;
        }
        result.put("available", sdkAvailable);
        call.resolve(result);
    }

    @PluginMethod
    public void initialize(PluginCall call) {
        authKey = call.getString("tajerToken", "");
        isProduction = call.getBoolean("isProduction", false);
        Log.d(TAG, "initialize: authKey length=" + authKey.length() + ", isProduction=" + isProduction);

        // Verify SDK is available
        try {
            Class.forName("om.thawani.lamsa.sdk.LamsaSDK");
            sdkAvailable = true;
        } catch (ClassNotFoundException e) {
            sdkAvailable = false;
            Log.w(TAG, "Lamsa SDK not found in classpath");
        }

        JSObject result = new JSObject();
        result.put("success", true);
        result.put("sdkAvailable", sdkAvailable);
        result.put("message", sdkAvailable ? "Lamsa SDK initialized" : "SDK not in classpath - stub mode");
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

        if (!sdkAvailable) {
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

        // Save the call so we can resolve it after the Activity returns
        bridge.saveCall(call);

        try {
            // Create InitOptionsModel for Lamsa SDK
            InitOptionsModel options = new InitOptionsModel(
                amount,           // amount in OMR
                authKey,          // Tajer authentication key
                remarks,          // transaction description
                isProduction,     // false = staging, true = production
                1,                // paymentOption: 1 = NFC tap
                3000              // autoCloseInMillis
            );

            // Launch LamsaSDK Activity
            Intent intent = new Intent(getContext(), LamsaSDK.class);
            intent.putExtra("initOptions", options);

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
                // Extract PaymentResultModel from intent
                PaymentResultModel paymentResult = (PaymentResultModel) data.getSerializableExtra("paymentResult");

                if (paymentResult != null) {
                    boolean success = paymentResult.getPaymentStatus() == 2; // 2 = Success

                    result.put("success", success);
                    result.put("transactionId", transactionId);
                    result.put("thawaniReference", paymentResult.getPaymentId() != null ? paymentResult.getPaymentId() : "");
                    result.put("approvalCode", paymentResult.getInvoice() != null ? paymentResult.getInvoice() : "");
                    result.put("responseMessage", paymentResult.getDescription() != null ? paymentResult.getDescription() : "");
                    result.put("responseCode", String.valueOf(paymentResult.getPaymentStatus()));
                    result.put("amount", paymentResult.getAmount());
                    result.put("timestamp", paymentResult.getDate() != null ? paymentResult.getDate() : String.valueOf(System.currentTimeMillis()));

                    if (!success) {
                        result.put("errorCode", String.valueOf(paymentResult.getPaymentStatus()));
                        result.put("errorMessage", paymentResult.getDescription() != null ? paymentResult.getDescription() : "Payment declined");
                    }

                    Log.d(TAG, "Payment result: success=" + success + ", ref=" + paymentResult.getPaymentId());
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
