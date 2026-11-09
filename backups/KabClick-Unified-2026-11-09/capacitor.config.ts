import type { CapacitorConfig } from '@capacitor/cli';

const platform = process.env.KABCLICK_PLATFORM;
if (platform !== 'android' && platform !== 'ios') {
  throw new Error('Use npm run sync:android, sync:ios, open:android or open:ios so the correct app ID is selected.');
}

const config: CapacitorConfig = {
  appId: platform === 'ios' ? 'app.kabclick.iospreview' : 'app.kabclick.twa',
  appName: platform === 'ios' ? 'קבקליק בדיקה' : 'קבקליק',
  webDir: 'www',
  loggingBehavior: 'none',
  ...(platform === 'android' ? {server: {androidScheme: 'https'}} : {}),
  android: {
    allowMixedContent: false,
    backgroundColor: '#FFFFFF',
    webContentsDebuggingEnabled: false
  },
  ios: {
    contentInset: 'never',
    backgroundColor: '#FFFFFF',
    preferredContentMode: 'mobile'
  }
};

export default config;
