import type { CapacitorConfig } from '@capacitor/cli';

const devServerUrl = process.env.CAP_SERVER_URL || 'http://localhost:3000';
const devServerHost = (() => {
  try {
    return new URL(devServerUrl).hostname;
  } catch {
    return 'localhost';
  }
})();

const config: CapacitorConfig = {
  appId: 'com.sigmalove.elephant',
  appName: 'Elephant Todo',
  webDir: 'www',

  // 开发阶段：默认连本机 Nuxt 开发服务；真机调试可通过 CAP_SERVER_URL 覆盖。
  server: {
    url: devServerUrl,
    cleartext: true,
    allowNavigation: ['elephantodo.com', 'localhost', '127.0.0.1', devServerHost],
  },

  ios: {
    contentInset: 'never',
    allowsLinkPreview: false,
    scrollEnabled: true,
    preferredContentMode: 'mobile',
  },

  plugins: {
    SplashScreen: {
      launchShowDuration: 2000,
      launchAutoHide: true,
      backgroundColor: '#4f46e5',
      showSpinner: false,
    },
    StatusBar: {
      style: 'DARK',
      backgroundColor: '#4f46e5',
    },
    Keyboard: {
      resize: 'body',
      resizeOnFullScreen: true,
    },
  },
};

export default config;
