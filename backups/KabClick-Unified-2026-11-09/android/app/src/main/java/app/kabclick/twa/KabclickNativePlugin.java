package app.kabclick.twa;

import android.content.Intent;
import android.net.Uri;
import android.util.Base64;
import androidx.core.content.FileProvider;
import com.getcapacitor.*;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.*;

@CapacitorPlugin(name="KabclickNative")
public class KabclickNativePlugin extends Plugin {
  @PluginMethod public void authorize(PluginCall call) { ((MainActivity)getActivity()).authorize(call); }
  @PluginMethod public void openExternal(PluginCall call) {
    try {
      Uri uri = Uri.parse(call.getString("url", ""));
      if (!"https".equals(uri.getScheme()) && !"http".equals(uri.getScheme()) && !"mailto".equals(uri.getScheme())) { call.reject("Unsupported URL"); return; }
      getActivity().startActivity(new Intent(Intent.ACTION_VIEW, uri)); call.resolve();
    } catch (Exception e) { call.reject("Cannot open link: " + e.getMessage()); }
  }
  @PluginMethod public void shareFile(PluginCall call) {
    try {
      String name = new File(call.getString("name", "receipt.pdf")).getName();
      File dir = new File(getContext().getCacheDir(), "shared"); dir.mkdirs();
      File file = new File(dir, name);
      byte[] data = Base64.decode(call.getString("data", ""), Base64.DEFAULT);
      try (FileOutputStream out = new FileOutputStream(file)) { out.write(data); }
      Uri uri = FileProvider.getUriForFile(getContext(), getContext().getPackageName()+".fileprovider", file);
      Intent intent = new Intent(Intent.ACTION_SEND).setType(call.getString("mime", "application/pdf"));
      intent.putExtra(Intent.EXTRA_STREAM, uri); intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
      getActivity().startActivity(Intent.createChooser(intent, "שמירה או שיתוף")); call.resolve();
    } catch (Exception e) { call.reject("Cannot share file: " + e.getMessage()); }
  }
}
