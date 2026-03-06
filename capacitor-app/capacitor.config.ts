import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.sigmalove.elephant',
  appName: 'Elephant Todo',
  webDir: 'www',

  // 开发阶段：指向本地Nuxt开发服务器（上线前改回 https://elephantodo.com）
  server: {
    url: 'http://192.168.0.125:3001',
    cleartext: true,
    allowNavigation: ['elephantodo.com', 'localhost', '192.168.0.125'],
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
