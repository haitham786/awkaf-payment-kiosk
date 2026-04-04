package app.lovable.awkafpaymentkiosk;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;
import app.lovable.awkafpaymentkiosk.ThawaniLamsaPlugin;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(ThawaniLamsaPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
