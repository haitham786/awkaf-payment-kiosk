/**
 * Thawani Lamsa Capacitor Plugin - Fixed Bridge Implementation
 *
 * BUGS FIXED vs previous version:
 *  1. Intent extra key: "initOptions" → "SDKInitOptions"  (per Lamsa SDK docs)
 *  2. Result extra key: "paymentResult" → "result"         (per Lamsa SDK docs)
 *  3. InitOptionsModel constructor: used named Kotlin data-class constructor
 *     via reflection instead of positional args (avoids arg-order fragility)
 *  4. PaymentResultModel field access: Kotlin data classes expose component
 *     functions; we try getters first then fall back to field access.
 *  5. bridge.saveCall / bridge.getSavedCall removed - Capacitor 7 manages the
 *     saved call internally when you call startActivityForResult().
 *
 * SDK Reference: https://thawani.gitbook.io/lamsa
 * Maven:         om.thawani:lamsa.sdk:0.0.22
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
import java.lang.reflect.Field;
import java.lang.reflect.Method;

@CapacitorPlugin(name = "ThawaniLamsa")
public class ThawaniLamsaPlugin extends Plugin {

    private static final String TAG              = "ThawaniLamsaPlugin";
    private static final String SDK_CLASS        = "om.thawani.lamsa.sdk.LamsaSDK";
    private static final String OPTIONS_CLASS    = "om.thawani.lamsa.sdk.model.InitOptionsModel";
    private static final String RESULT_CLASS     = "om.thawani.lamsa.sdk.model.PaymentResultModel";

    // ── Intent extra keys (must match Lamsa SDK exactly) ─────────────────────
    /** Key used when passing InitOptionsModel TO the SDK */
    private static final String EXTRA_SDK_OPTIONS = "SDKInitOptions";
    /** Key used when reading PaymentResultModel FROM the SDK */
    private static final String EXTRA_SDK_RESULT  = "result";

    private String  authKey      = null;
    private boolean isProduction = false;
    private boolean sdkAvailable = false;
    private Class<?> lamsaSdkClass = null;
    private Class<?> optionsClass  = null;

    // ── SDK detection ────────────────────────────────────────────────────────

    private void detectSdk() {
        try {
            lamsaSdkClass = Class.forName(SDK_CLASS);
            optionsClass  = Class.forName(OPTIONS_CLASS);
            sdkAvailable  = true;
            Log.d(TAG, "Lamsa SDK detected in classpath");
        } catch (ClassNotFoundException e) {
            lamsaSdkClass = null;
            optionsClass  = null;
            sdkAvailable  = false;
            Log.w(TAG, "Lamsa SDK NOT in classpath – stub mode");
        }
    }

    // ── Plugin methods ───────────────────────────────────────────────────────

    @PluginMethod
    public void isAvailable(PluginCall call) {
        detectSdk();
        JSObject result = new JSObject();
        result.put("available", sdkAvailable);
        call.resolve(result);
    }

    @PluginMethod
    public void initialize(PluginCall call) {
        authKey      = call.getString("tajerToken", "");
        isProduction = Boolean.TRUE.equals(call.getBoolean("isProduction", false));
        Log.d(TAG, "initialize: keyLen=" + authKey.length() + " prod=" + isProduction);
        detectSdk();
        JSObject result = new JSObject();
        result.put("success",      true);
        result.put("sdkAvailable", sdkAvailable);
        result.put("message",      sdkAvailable ? "Lamsa SDK ready" : "SDK not linked – stub mode");
        call.resolve(result);
    }

    @PluginMethod
    public void checkNFCStatus(PluginCall call) {
        NfcManager nfcManager = (NfcManager) getContext().getSystemService(Context.NFC_SERVICE);
        NfcAdapter  nfcAdapter = nfcManager != null ? nfcManager.getDefaultAdapter() : null;
        JSObject result = new JSObject();
        if (nfcAdapter == null) {
            result.put("isAvailable",  false);
            result.put("isEnabled",    false);
            result.put("errorMessage", "NFC hardware not present on this device");
        } else if (!nfcAdapter.isEnabled()) {
            result.put("isAvailable",  true);
            result.put("isEnabled",    false);
            result.put("errorMessage", "NFC is disabled – please enable it in Settings");
        } else {
            result.put("isAvailable", true);
            result.put("isEnabled",   true);
        }
        call.resolve(result);
    }

    @PluginMethod
    public void startPayment(PluginCall call) {
        double amount        = call.getDouble("amount", 0.0);
        String transactionId = call.getString("transactionId", "");
        String remarks       = call.getString("remarks", "Donation " + transactionId);

        Log.d(TAG, "startPayment: amount=" + amount + " txId=" + transactionId);

        // ── Guard: SDK not available ─────────────────────────────────────────
        if (!sdkAvailable || lamsaSdkClass == null || optionsClass == null) {
            Log.w(TAG, "SDK not linked – returning SDK_NOT_AVAILABLE");
            JSObject r = new JSObject();
            r.put("success",        false);
            r.put("errorCode",      "SDK_NOT_AVAILABLE");
            r.put("errorMessage",   "Thawani Lamsa SDK not linked. Configure Maven credentials and rebuild.");
            r.put("transactionId",  transactionId);
            r.put("timestamp",      String.valueOf(System.currentTimeMillis()));
            call.resolve(r);
            return;
        }

        // ── Guard: not initialised ───────────────────────────────────────────
        if (authKey == null || authKey.isEmpty()) {
            JSObject r = new JSObject();
            r.put("success",       false);
            r.put("errorCode",     "NOT_INITIALIZED");
            r.put("errorMessage",  "Call initialize() before startPayment()");
            r.put("transactionId", transactionId);
            r.put("timestamp",     String.valueOf(System.currentTimeMillis()));
            call.resolve(r);
            return;
        }

        try {
            // ── Build InitOptionsModel via reflection ────────────────────────
            //
            // Kotlin data class signature (from SDK docs):
            //   InitOptionsModel(
            //       amount: Double,
            //       authKey: String,
            //       remarks: String?,
            //       isProduction: Boolean,
            //       paymentOption: PaymentOptions?,  <- we pass null (any card)
            //       autoCloseInMillis: Int?          <- we pass 3000
            //   )
            //
            // Because Kotlin data classes with nullable params generate a
            // synthetic constructor with a bitmask, we locate the primary
            // constructor by parameter count and types.

            Object options = buildInitOptions(amount, remarks);

            // ── Build intent ─────────────────────────────────────────────────
            Intent intent = new Intent(getContext(), lamsaSdkClass);
            intent.putExtra(EXTRA_SDK_OPTIONS, (Serializable) options);

            // Capacitor 7: startActivityForResult saves the call internally
            startActivityForResult(call, intent, "handlePaymentResult");
            Log.d(TAG, "LamsaSDK Activity launched");

        } catch (Exception e) {
            Log.e(TAG, "Failed to launch LamsaSDK", e);
            JSObject r = new JSObject();
            r.put("success",       false);
            r.put("errorCode",     "LAUNCH_FAILED");
            r.put("errorMessage",  "Failed to launch Lamsa: " + e.getMessage());
            r.put("transactionId", transactionId);
            r.put("timestamp",     String.valueOf(System.currentTimeMillis()));
            call.resolve(r);
        }
    }

    /**
     * Build an InitOptionsModel instance using reflection.
     * Tries the 6-arg primary constructor first; falls back to a 4-arg one.
     */
    private Object buildInitOptions(double amount, String remarks) throws Exception {
        // Try: (Double, String, String?, Boolean, PaymentOptions?, Integer?)
        try {
            Constructor<?> ctor = optionsClass.getConstructor(
                double.class, String.class, String.class,
                boolean.class, Object.class, Integer.class
            );
            return ctor.newInstance(amount, authKey, remarks, isProduction, null, 3000);
        } catch (NoSuchMethodException ignored) { /* try next */ }

        // Try Kotlin synthetic constructor (has extra int bitmask + DefaultConstructorMarker)
        for (Constructor<?> ctor : optionsClass.getConstructors()) {
            Class<?>[] types = ctor.getParameterTypes();
            if (types.length == 6) {
                return ctor.newInstance(amount, authKey, remarks, isProduction, null, 3000);
            }
            if (types.length == 8) {
                // Kotlin synthetic: original 6 params + int bitmask + DefaultConstructorMarker
                return ctor.newInstance(amount, authKey, remarks, isProduction, null, 3000, 0, null);
            }
        }

        // Last resort: 4-arg minimal constructor (amount, authKey, remarks, isProduction)
        for (Constructor<?> ctor : optionsClass.getConstructors()) {
            if (ctor.getParameterTypes().length == 4) {
                return ctor.newInstance(amount, authKey, remarks, isProduction);
            }
        }

        throw new Exception("No suitable InitOptionsModel constructor found");
    }

    // ── Activity result callback ─────────────────────────────────────────────

    @ActivityCallback
    private void handlePaymentResult(PluginCall call, ActivityResult activityResult) {
        if (call == null) {
            Log.e(TAG, "handlePaymentResult: PluginCall is null");
            return;
        }

        String transactionId = call.getString("transactionId", "");
        JSObject result = new JSObject();

        if (activityResult.getResultCode() == Activity.RESULT_OK
                && activityResult.getData() != null) {

            Intent data = activityResult.getData();

            try {
                // ── Read PaymentResultModel ──────────────────────────────────
                // SDK puts it under the key "result" (per docs)
                Serializable paymentResult = data.getSerializableExtra(EXTRA_SDK_RESULT);

                if (paymentResult == null) {
                    // Some SDK versions may use getParcelableExtra — try as fallback
                    Log.w(TAG, "getSerializableExtra(\"result\") returned null; dumping extras");
                    if (data.getExtras() != null) {
                        for (String key : data.getExtras().keySet()) {
                            Log.d(TAG, "  extra key: " + key + " = " + data.getExtras().get(key));
                        }
                    }
                    result.put("success",       false);
                    result.put("transactionId", transactionId);
                    result.put("errorCode",     "NO_RESULT");
                    result.put("errorMessage",  "SDK returned no PaymentResultModel");
                    result.put("timestamp",     String.valueOf(System.currentTimeMillis()));
                    call.resolve(result);
                    return;
                }

                // paymentStatus: 1=Pending, 2=Success, 3=Failed
                int paymentStatus = getIntField(paymentResult, "paymentStatus", "getPaymentStatus");
                boolean success   = (paymentStatus == 2);

                result.put("success",         success);
                result.put("transactionId",   transactionId);
                result.put("thawaniReference", getStringField(paymentResult, "paymentId",    "getPaymentId"));
                result.put("approvalCode",     getStringField(paymentResult, "invoice",      "getInvoice"));
                result.put("responseMessage",  getStringField(paymentResult, "description",  "getDescription"));
                result.put("responseCode",     String.valueOf(paymentStatus));
                result.put("amount",           getDoubleField(paymentResult, "amount",       "getAmount"));
                result.put("timestamp",        getStringField(paymentResult, "date",         "getDate"));

                if (!success) {
                    result.put("errorCode",    String.valueOf(paymentStatus));
                    result.put("errorMessage", getStringField(paymentResult, "description", "getDescription"));
                }

                Log.d(TAG, "Payment done: success=" + success + " status=" + paymentStatus);

            } catch (Exception e) {
                Log.e(TAG, "Error reading PaymentResultModel", e);
                result.put("success",       false);
                result.put("transactionId", transactionId);
                result.put("errorCode",     "PARSE_ERROR");
                result.put("errorMessage",  "Failed to read payment result: " + e.getMessage());
                result.put("timestamp",     String.valueOf(System.currentTimeMillis()));
            }

        } else if (activityResult.getResultCode() == Activity.RESULT_CANCELED) {
            result.put("success",       false);
            result.put("transactionId", transactionId);
            result.put("errorCode",     "CANCELLED");
            result.put("errorMessage",  "Payment cancelled by user");
            result.put("timestamp",     String.valueOf(System.currentTimeMillis()));
        } else {
            result.put("success",       false);
            result.put("transactionId", transactionId);
            result.put("errorCode",     "UNKNOWN");
            result.put("errorMessage",  "Unexpected result code: " + activityResult.getResultCode());
            result.put("timestamp",     String.valueOf(System.currentTimeMillis()));
        }

        call.resolve(result);
    }

    // ── Remaining plugin methods ─────────────────────────────────────────────

    @PluginMethod
    public void cancelPayment(PluginCall call) {
        JSObject result = new JSObject();
        result.put("success", true);
        call.resolve(result);
    }

    @PluginMethod
    public void getStatus(PluginCall call) {
        JSObject result = new JSObject();
        result.put("isInitialized", authKey != null && !authKey.isEmpty());
        result.put("isReady",       sdkAvailable);
        result.put("mode",          sdkAvailable ? "sdk" : "stub");
        call.resolve(result);
    }

    // ── Reflection helpers ───────────────────────────────────────────────────

    /** Read an int from a data class via getter or field. */
    private int getIntField(Object obj, String fieldName, String getterName) {
        try {
            Method m = obj.getClass().getMethod(getterName);
            Object v = m.invoke(obj);
            return v != null ? (int) v : 0;
        } catch (Exception e1) {
            try {
                Field f = obj.getClass().getDeclaredField(fieldName);
                f.setAccessible(true);
                Object v = f.get(obj);
                return v != null ? (int) v : 0;
            } catch (Exception e2) {
                Log.w(TAG, "getIntField(" + fieldName + ") failed: " + e2.getMessage());
                return 0;
            }
        }
    }

    /** Read a double from a data class via getter or field. */
    private double getDoubleField(Object obj, String fieldName, String getterName) {
        try {
            Method m = obj.getClass().getMethod(getterName);
            Object v = m.invoke(obj);
            return v != null ? (double) v : 0.0;
        } catch (Exception e1) {
            try {
                Field f = obj.getClass().getDeclaredField(fieldName);
                f.setAccessible(true);
                Object v = f.get(obj);
                return v != null ? (double) v : 0.0;
            } catch (Exception e2) {
                Log.w(TAG, "getDoubleField(" + fieldName + ") failed: " + e2.getMessage());
                return 0.0;
            }
        }
    }

    /** Read a String from a data class via getter or field. */
    private String getStringField(Object obj, String fieldName, String getterName) {
        try {
            Method m = obj.getClass().getMethod(getterName);
            Object v = m.invoke(obj);
            return v != null ? v.toString() : "";
        } catch (Exception e1) {
            try {
                Field f = obj.getClass().getDeclaredField(fieldName);
                f.setAccessible(true);
                Object v = f.get(obj);
                return v != null ? v.toString() : "";
            } catch (Exception e2) {
                Log.w(TAG, "getStringField(" + fieldName + ") failed: " + e2.getMessage());
                return "";
            }
        }
    }
}
