// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  devtools: { enabled: true },
  ssr: true,

  modules: [
    '@pinia/nuxt',
    '@vite-pwa/nuxt',
    '@bg-dev/nuxt-naiveui',
  ],

  css: ['~/assets/css/main.scss'],

  // ===== Naive UI =====
  naiveui: {
    colorModePreference: 'system', // 初始默认跟随系统，用户选择后会保存到cookie
    iconSize: 20,
    themeConfig: {
      shared: {
        common: {
          primaryColor: '#6366f1',
          primaryColorHover: '#818cf8',
          primaryColorPressed: '#4f46e5',
          primaryColorSuppl: '#818cf8',
          borderRadius: '10px',
          borderRadiusSmall: '8px',
          fontSize: '14px',
        },
      },
    },
  },

  // ===== 运行时配置 =====
  runtimeConfig: {
    // ---- 服务端私有（仅 server/ 可用）----
    jwtSecret: process.env.JWT_SECRET || 'dev-jwt-secret',
    jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
    jwtRefreshSecret: process.env.JWT_REFRESH_SECRET || 'dev-refresh-secret',
    jwtRefreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '30d',

    dbHost: process.env.DB_HOST || 'localhost',
    dbPort: process.env.DB_PORT || '3306',
    dbUser: process.env.DB_USER || 'root',
    dbPassword: process.env.DB_PASSWORD || '',
    dbName: process.env.DB_NAME || 'elephant_todo',

    smtpHost: process.env.SMTP_HOST || '',
    smtpPort: process.env.SMTP_PORT || '465',
    smtpSecure: process.env.SMTP_SECURE || 'true',
    smtpUser: process.env.SMTP_USER || '',
    smtpPass: process.env.SMTP_PASS || '',
    smtpFrom: process.env.SMTP_FROM || '',

    geminiApiKey: process.env.GEMINI_API_KEY || '',
    geminiBaseUrl: process.env.GEMINI_BASE_URL || 'https://go.sbgpt.site/v1',
    geminiModel: process.env.GEMINI_MODEL || 'gemini-2.5-pro',

    deepseekApiKey: process.env.DEEPSEEK_API_KEY || '',
    deepseekBaseUrl: process.env.DEEPSEEK_BASE_URL || 'https://llmapi.blsc.cn/v1',
    deepseekModel: process.env.DEEPSEEK_MODEL || 'DeepSeek-V3.2',

    resetPasswordUrl: process.env.RESET_PASSWORD_URL || 'http://localhost:3001/reset-password',
    resetTokenExpiresIn: process.env.RESET_TOKEN_EXPIRES_IN || '3600000',

    // ---- 客户端公开 ----
    public: {},
  },

  app: {
    head: {
      title: 'Elephant Todo',
      charset: 'utf-8',
      viewport: 'width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover',
      meta: [
        { name: 'theme-color', content: '#4f46e5' },
        { name: 'mobile-web-app-capable', content: 'yes' },
        { name: 'apple-mobile-web-app-status-bar-style', content: 'black-translucent' },
      ],
      script: [
        {
          // Inline blocking script to apply saved theme BEFORE first paint.
          // Prevents flash of light theme on PWA cold start (iOS home screen).
          innerHTML: `(function(){try{var t=localStorage.getItem('elephant-theme');if(!t)return;var d=t==='dark'||(t==='system'&&window.matchMedia('(prefers-color-scheme:dark)').matches);if(d){document.documentElement.classList.add('dark');document.documentElement.setAttribute('data-theme','dark');document.documentElement.setAttribute('data-app-theme','dark')}else{document.documentElement.classList.remove('dark');document.documentElement.setAttribute('data-theme','light');document.documentElement.setAttribute('data-app-theme','light')}}catch(e){}})()`,
          tagPosition: 'head',
        },
        {
          // Apply saved skin BEFORE first paint to prevent FOUC.
          innerHTML: `(function(){try{var s=localStorage.getItem('elephant-skin');if(s&&s!=='default')document.documentElement.setAttribute('data-skin',s)}catch(e){}})()`,
          tagPosition: 'head',
        },
      ],
    },
  },

  routeRules: {
    '/settings': { ssr: false },
    '/settings/**': { ssr: false },
    '/admin': { ssr: false },
    '/admin/**': { ssr: false },
  },

  pwa: {
    registerType: 'autoUpdate',
    manifest: {
      name: 'Elephant Todo',
      short_name: 'Elephant',
      theme_color: '#4f46e5',
      background_color: '#ffffff',
      display: 'standalone',
      start_url: '/',
      icons: [
        { src: '/icon-192.svg', sizes: '192x192', type: 'image/svg+xml' },
        { src: '/icon-512.svg', sizes: '512x512', type: 'image/svg+xml' },
      ],
    },
    workbox: {
      navigateFallback: '/',
      runtimeCaching: [
        {
          urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
          handler: 'CacheFirst',
          options: { cacheName: 'google-fonts-cache', expiration: { maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 365 } },
        },
      ],
    },
  },

  build: {
    transpile: ['naive-ui', 'vueuc', '@juggle/resize-observer', '@css-render/vue3-ssr'],
  },

  vite: {
    define: {
      __VUE_PROD_HYDRATION_MISMATCH_DETAILS__: false,
    },
    optimizeDeps: {
      include: ['naive-ui', 'vueuc', 'date-fns-tz/formatInTimeZone'],
    },
  },

  compatibilityDate: '2025-01-01',
})
