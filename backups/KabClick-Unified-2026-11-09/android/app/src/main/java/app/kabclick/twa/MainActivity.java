package app.kabclick.twa;

import android.os.Bundle;
import androidx.activity.result.ActivityResultLauncher;
import androidx.activity.result.IntentSenderRequest;
import androidx.activity.result.contract.ActivityResultContracts;
import com.getcapacitor.BridgeActivity;
import com.getcapacitor.PluginCall;
import com.getcapacitor.JSObject;
import com.google.android.gms.auth.api.identity.*;
import com.google.android.gms.common.api.Scope;
import java.util.*;

public class MainActivity extends BridgeActivity {
  private PluginCall pendingAuth;
  private ActivityResultLauncher<IntentSenderRequest> authLauncher;
  private ActivityResultLauncher<android.content.Intent> accountLauncher;
  @Override public void onCreate(Bundle state) {
    registerPlugin(KabclickNativePlugin.class);
    super.onCreate(state);
    android.view.View content = findViewById(android.R.id.content);
    androidx.core.view.ViewCompat.setOnApplyWindowInsetsListener(content, (view, insets) -> {
      androidx.core.graphics.Insets bars = insets.getInsets(androidx.core.view.WindowInsetsCompat.Type.systemBars() | androidx.core.view.WindowInsetsCompat.Type.displayCutout() | androidx.core.view.WindowInsetsCompat.Type.ime());
      view.setPadding(bars.left, bars.top, bars.right, bars.bottom);
      return androidx.core.view.WindowInsetsCompat.CONSUMED;
    });
    androidx.core.view.ViewCompat.requestApplyInsets(content);
    accountLauncher = registerForActivityResult(new ActivityResultContracts.StartActivityForResult(), result -> {
      PluginCall call = pendingAuth;
      if (call == null) return;
      String email = result.getData() == null ? null : result.getData().getStringExtra(android.accounts.AccountManager.KEY_ACCOUNT_NAME);
      if (result.getResultCode() != RESULT_OK || email == null) {
        pendingAuth = null; call.reject("בחירת החשבון בוטלה"); return;
      }
      call.getData().put("accountEmail", email);
      requestAuthorization(call);
    });
    authLauncher = registerForActivityResult(new ActivityResultContracts.StartIntentSenderForResult(), result -> {
      PluginCall call = pendingAuth; pendingAuth = null;
      if (call == null) return;
      try { complete(call, Identity.getAuthorizationClient(this).getAuthorizationResultFromIntent(result.getData())); }
      catch (Exception e) { call.reject("Google authorization cancelled or failed: " + e.getMessage()); }
    });
  }
  public void authorize(PluginCall call) {
    runOnUiThread(() -> {
      if (pendingAuth != null) { call.reject("Authorization already in progress"); return; }
      pendingAuth = call;
      if (Boolean.TRUE.equals(call.getBoolean("forceSelection", false))) {
        accountLauncher.launch(com.google.android.gms.common.AccountPicker.newChooseAccountIntent(
          new com.google.android.gms.common.AccountPicker.AccountChooserOptions.Builder()
            .setAllowableAccountsTypes(Arrays.asList("com.google"))
            .setAlwaysShowAccountPicker(true).build()));
      } else { requestAuthorization(call); }
    });
  }
  private void requestAuthorization(PluginCall call) {
      String scope = call.getString("scope", "");
      List<Scope> scopes = new ArrayList<>();
      for (String item : scope.trim().split("\\s+")) if (!item.isEmpty()) scopes.add(new Scope(item));
      if (scopes.isEmpty()) { pendingAuth = null; call.reject("Missing scopes"); return; }
      AuthorizationRequest.Builder request = AuthorizationRequest.builder().setRequestedScopes(scopes);
      String email = call.getString("accountEmail");
      if (email != null && !email.trim().isEmpty()) request.setAccount(new android.accounts.Account(email, "com.google"));
      Identity.getAuthorizationClient(this).authorize(request.build())
        .addOnSuccessListener(result -> {
          if (result.hasResolution()) {
            authLauncher.launch(new IntentSenderRequest.Builder(result.getPendingIntent().getIntentSender()).build());
          } else { pendingAuth = null; complete(call, result); }
        }).addOnFailureListener(e -> { pendingAuth = null; call.reject("Google authorization failed: " + e.getMessage()); });
  }
  private void complete(PluginCall call, AuthorizationResult result) {
    if (result.getAccessToken() == null) { call.reject("Google returned no access token"); return; }
    JSObject response = new JSObject();
    response.put("access_token", result.getAccessToken());
    response.put("expires_in", 3500);
    response.put("scope", String.join(" ", result.getGrantedScopes()));
    call.resolve(response);
  }
}
