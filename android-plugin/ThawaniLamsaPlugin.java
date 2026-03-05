/**
 * Thawani Lamsa Capacitor Plugin - Real SDK Implementation
 * 
 * Bridges the Capacitor web layer with the native Thawani Lamsa SDK.
 * Uses startActivityForResult to launch LamsaSDK and return PaymentResultModel.
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

    @PluginMethod
    public void isAvailable(PluginCall call) {
        Log.d(TAG, "isAvailable called - SDK is present");
        JSObject result = new JSObject();
        result.put("available", true);
        call.resolve(result);
    }

    @PluginMethod
    public void initialize(PluginCall call) {
        authKey = call.getString("tajerToken", "");
        isProduction = call.getBoolean("isProduction", false);
        Log.d(TAG, "initialize: authKey length=" + authKey.length() + ", isProduction=" + isProduction);

        JSObject result = new JSObject();
        result.put("success", true);
        result.put("message", "SDK initialized");
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
        if (authKey == null || authKey.isEmpty()) {
            JSObject err = new JSObject();
            err.put("success", false);
            err.put("errorCode", "NOT_INITIALIZED");
            err.put("errorMessage", "SDK not initialized. Call initialize() first.");
            err.put("timestamp", System.currentTimeMillis());
            call.resolve(err);
            return;
        }

        double amount = call.getDouble("amount", 0.0);
        String transactionId = call.getString("transactionId", "");
        String remarks = call.getString("remarks", "Donation " + transactionId);

        Log.d(TAG, "startPayment: amount=" + amount + " txnId=" + transactionId);

        InitOptionsModel options = new InitOptionsModel(
            amount,
            authKey,
            remarks,
            isProduction,
            1,    // paymentOption: 1 = NFC tap
            3000  // autoCloseInMillis
        );

        Intent intent = new Intent(getContext(), LamsaSDK.class);
        intent.putExtra("INIT_OPTIONS", options);

        startActivityForResult(call, intent, "handlePaymentResult");
    }

    @ActivityCallback
    private void handlePaymentResult(PluginCall call, ActivityResult activityResult) {
        if (call == null) {
            Log.e(TAG, "handlePaymentResult: call is null");
            return;
        }

        JSObject result = new JSObject();
        String transactionId = call.getString("transactionId", "");
        result.put("transactionId", transactionId);

        if (activityResult.getResultCode() == Activity.RESULT_OK && activityResult.getData() != null) {
            Intent data = activityResult.getData();
            PaymentResultModel paymentResult = (PaymentResultModel) data.getSerializableExtra("PAYMENT_RESULT");

            if (paymentResult != null) {
                boolean success = paymentResult.getSuccess();
                result.put("success", success);
                result.put("thawaniReference", paymentResult.getPaymentId());
                result.put("approvalCode", paymentResult.getInvoice());
                result.put("responseMessage", paymentResult.getDescription());
                result.put("amount", paymentResult.getAmount());
                result.put("timestamp", paymentResult.getDate());

                int status = paymentResult.getPaymentStatus();
                if (status == 2) {
                    result.put("responseCode", "00");
                } else if (status == 1) {
                    result.put("responseCode", "PENDING");
                } else {
                    result.put("responseCode", "FAILED");
                    if (!success) {
                        result.put("errorCode", "PAYMENT_DECLINED");
                        result.put("errorMessage", paymentResult.getDescription());
                    }
                }

                Log.d(TAG, "Payment result: success=" + success + " ref=" + paymentResult.getPaymentId());
            } else {
                result.put("success", false);
                result.put("errorCode", "NO_RESULT");
                result.put("errorMessage", "No payment result returned from SDK");
                result.put("timestamp", System.currentTimeMillis());
            }
        } else {
            result.put("success", false);
            result.put("errorCode", "CANCELLED");
            result.put("errorMessage", "Payment was cancelled or no result returned");
            result.put("timestamp", System.currentTimeMillis());
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
        result.put("isReady", authKey != null && !authKey.isEmpty());
        result.put("mode", isProduction ? "production" : "staging");
        call.resolve(result);
    }
}
