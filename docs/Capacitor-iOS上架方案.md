# Elephant App — Capacitor iOS 上架方案

> 将现有 Nuxt 全栈 H5 应用通过 Capacitor 封装，发布到 iOS App Store。

---

## 一、架构方案

### 当前架构

```
浏览器 ──→ Nginx ──→ Nuxt SSR Server (API + 页面渲染)
                          │
                        MySQL
```

### 目标架构

```
┌─ iOS App (Capacitor) ─────────────────┐
│                                        │
│  WebView 加载远程服务器                  │
│  https://your-domain.com               │
│       │                                │
│  原生插件层 (StatusBar / Haptics /     │
│  SplashScreen / PushNotifications)     │
│                                        │
└────────────────────────────────────────┘
          │ HTTPS
          ▼
  阿里云 ECS (Nuxt SSR + MySQL)
```

### 为什么选择"远程加载"而非"本地 SPA"

| 考量 | 说明 |
|------|------|
| **全栈 SSR 架构** | 本项目是 Nuxt 全栈应用，API 路由 (`/api/...`) 与页面在同一进程，使用相对路径请求。如果改成本地 SPA，需要把所有 API 调用改为绝对 URL，改动面较大 |
| **Cookie/Token 机制** | 当前使用 `useCookie()` 做 SSR 兼容的 token 存储，本地 SPA 模式下需要重构为 localStorage |
| **PWA 已有基础** | 项目已配置 PWA (Workbox)，远程加载时可利用 Service Worker 做离线缓存 |
| **更新无需发版** | 服务端更新后，App 自动拿到最新页面，无需重新提交 App Store 审核 |
| **降低审核风险** | 配合原生插件 (StatusBar、Haptics、SplashScreen、推送) 的集成，App 功能足够丰富，不会被判为"纯壳子" |

---

## 二、前置准备

### 2.1 环境要求

- [ ] **Mac 电脑**（macOS 13+）— Xcode 只能在 macOS 上运行
- [ ] **Xcode 15+**（从 Mac App Store 安装）
- [ ] **Apple Developer Program**（$99/年）— [developer.apple.com](https://developer.apple.com/programs/)
- [ ] **Node.js 18+**
- [ ] **CocoaPods**：`sudo gem install cocoapods`
- [ ] **域名 + HTTPS**：iOS App 内 WebView 要求 HTTPS（你的阿里云 ECS 需要配置 SSL 证书）

### 2.2 HTTPS 配置（如果还没有）

在阿里云 ECS 的 Nginx 上启用 SSL：

```bash
# 取消 nginx.conf 中 HTTPS server block 的注释
# 配置 SSL 证书（可使用免费的 Let's Encrypt）
sudo certbot --nginx -d your-domain.com
```

---

## 三、实施步骤

### 3.1 创建 Capacitor 子项目

在项目根目录下创建一个独立的 Capacitor 目录，与现有 Nuxt 代码解耦：

```bash
# 在 elephant_app 根目录
mkdir capacitor-app
cd capacitor-app

npm init -y
npm install @capacitor/core @capacitor/cli @capacitor/ios
npm install @capacitor/status-bar @capacitor/splash-screen @capacitor/keyboard @capacitor/haptics
```

### 3.2 初始化 Capacitor

```bash
npx cap init "Elephant Todo" "com.sigmalove.elephant" --web-dir=www
```

### 3.3 配置 capacitor.config.ts

```typescript
// capacitor-app/capacitor.config.ts
import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.sigmalove.elephant',
  appName: 'Elephant Todo',
  webDir: 'www',

  // 关键：加载远程服务器而非本地文件
  server: {
    url: 'https://your-domain.com',
    cleartext: false, // 强制 HTTPS
    // 允许 WebView 导航到的外部 URL
    allowNavigation: ['your-domain.com'],
  },

  ios: {
    // 内容模式：适配 iPhone 全面屏
    contentInset: 'automatic',
    // 允许混合内容（如果有 HTTP 资源）
    allowsLinkPreview: false,
    // 滚动设置
    scrollEnabled: true,
    // 使用 WKWebView
    preferredContentMode: 'mobile',
  },

  plugins: {
    SplashScreen: {
      // 启动屏配置
      launchShowDuration: 2000,
      launchAutoHide: true,
      backgroundColor: '#4f46e5',
      androidSplashResourceName: 'splash',
      showSpinner: false,
    },
    StatusBar: {
      // iOS 状态栏样式
      style: 'DARK',       // DARK = 白色文字，LIGHT = 黑色文字
      backgroundColor: '#4f46e5',
    },
    Keyboard: {
      // 键盘弹出时调整 WebView 大小
      resize: 'body',
      resizeOnFullScreen: true,
    },
  },
};

export default config;
```

### 3.4 创建占位 www 目录

由于我们使用远程 URL 模式，`www` 目录只需一个占位文件：

```bash
mkdir www
echo "<html><body>Loading...</body></html>" > www/index.html
```

### 3.5 添加 iOS 平台

```bash
npx cap add ios
```

这会在 `capacitor-app/ios/` 下生成完整的 Xcode 项目。

### 3.6 同步配置到 iOS 项目

```bash
npx cap sync ios
```

---

## 四、原生能力集成

### 4.1 在 Nuxt 项目中添加 Capacitor 运行时检测

在 Nuxt 项目中安装 Capacitor Core（仅前端依赖）：

```bash
# 回到 elephant_app 根目录
npm install @capacitor/core @capacitor/status-bar @capacitor/haptics @capacitor/keyboard @capacitor/splash-screen
```

### 4.2 创建 Capacitor 插件文件

```typescript
// plugins/capacitor.client.ts
import { Capacitor } from '@capacitor/core'

export default defineNuxtPlugin(async () => {
  // 只在原生环境中执行
  if (!Capacitor.isNativePlatform()) return

  // --- 状态栏 ---
  const { StatusBar, Style } = await import('@capacitor/status-bar')
  
  // 监听主题变化，动态调整状态栏
  const isDark = document.documentElement.classList.contains('dark')
  await StatusBar.setStyle({ style: isDark ? Style.Dark : Style.Light })
  
  // 监听主题切换
  const observer = new MutationObserver(() => {
    const dark = document.documentElement.classList.contains('dark')
    StatusBar.setStyle({ style: dark ? Style.Dark : Style.Light })
  })
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['class'],
  })

  // --- 键盘 ---
  const { Keyboard } = await import('@capacitor/keyboard')
  Keyboard.addListener('keyboardWillShow', (info) => {
    document.documentElement.style.setProperty('--keyboard-height', `${info.keyboardHeight}px`)
  })
  Keyboard.addListener('keyboardWillHide', () => {
    document.documentElement.style.setProperty('--keyboard-height', '0px')
  })

  // --- 启动屏 ---
  const { SplashScreen } = await import('@capacitor/splash-screen')
  // 页面加载完毕后隐藏启动屏
  await SplashScreen.hide()
})
```

### 4.3 添加触觉反馈 Composable

```typescript
// composables/useHaptics.ts
import { Capacitor } from '@capacitor/core'

export function useHaptics() {
  const isNative = Capacitor.isNativePlatform()

  async function impact(style: 'light' | 'medium' | 'heavy' = 'medium') {
    if (!isNative) return
    const { Haptics, ImpactStyle } = await import('@capacitor/haptics')
    const styleMap = {
      light: ImpactStyle.Light,
      medium: ImpactStyle.Medium,
      heavy: ImpactStyle.Heavy,
    }
    await Haptics.impact({ style: styleMap[style] })
  }

  async function notification(type: 'success' | 'warning' | 'error' = 'success') {
    if (!isNative) return
    const { Haptics, NotificationType } = await import('@capacitor/haptics')
    const typeMap = {
      success: NotificationType.Success,
      warning: NotificationType.Warning,
      error: NotificationType.Error,
    }
    await Haptics.notification({ type: typeMap[type] })
  }

  return { impact, notification, isNative }
}
```

### 4.4 使用触觉反馈示例

在关键交互处添加触觉反馈，提升原生感：

```vue
<!-- 在 Todo 完成切换、快速添加按钮等处 -->
<script setup>
const { impact, notification } = useHaptics()

async function toggleTodo(todo) {
  await impact('light')       // 轻触反馈
  await todoStore.toggle(todo)
  await notification('success') // 完成反馈
}
</script>
```

---

## 五、Xcode 配置

### 5.1 打开 Xcode 项目

```bash
cd capacitor-app
npx cap open ios
```

### 5.2 基础配置

在 Xcode 中需要配置：

| 配置项 | 位置 | 值 |
|--------|------|-----|
| **Bundle Identifier** | Signing & Capabilities | `com.sigmalove.elephant` |
| **Display Name** | General → Identity | `Elephant Todo` |
| **Deployment Target** | General → Minimum Deployments | iOS 15.0 |
| **Device Orientation** | General → Deployment Info | Portrait only（推荐） |
| **Team** | Signing & Capabilities | 你的 Apple Developer 账号 |
| **Signing** | Signing & Capabilities | Automatically manage signing ✅ |

### 5.3 App Icons

准备以下尺寸的图标（1024×1024 源图即可，Xcode 15+ 支持单尺寸自动生成）：

```
ios/App/App/Assets.xcassets/AppIcon.appiconset/
├── AppIcon-1024.png    (1024×1024，必须，无圆角无透明)
```

推荐使用 [App Icon Generator](https://www.appicon.co/) 网站批量生成。

### 5.4 启动屏 (Launch Screen)

编辑 `ios/App/App/Base.lproj/LaunchScreen.storyboard`：
- 设置背景色为品牌色 `#4f46e5`
- 居中放置 App Logo
- 或使用纯色 + 文字的简洁设计

### 5.5 Info.plist 配置

在 `ios/App/App/Info.plist` 中添加/确认以下配置：

```xml
<!-- 允许访问远程服务器（App Transport Security） -->
<key>NSAppTransportSecurity</key>
<dict>
    <key>NSAllowsArbitraryLoads</key>
    <false/>
    <key>NSExceptionDomains</key>
    <dict>
        <key>your-domain.com</key>
        <dict>
            <key>NSExceptionAllowsInsecureHTTPLoads</key>
            <false/>
            <key>NSIncludesSubdomains</key>
            <true/>
        </dict>
    </dict>
</dict>

<!-- 隐私权限声明（如果未来需要） -->
<!-- <key>NSCameraUsageDescription</key>
<string>需要相机来拍照上传</string> -->
```

---

## 六、Nuxt 项目适配改动

### 6.1 viewport 适配

当前 `nuxt.config.ts` 已有 `viewport-fit=cover`，已经正确适配安全区域。✅

### 6.2 安全区域 CSS

当前 `main.scss` 已有 `env(safe-area-inset-top/bottom)` 的处理。✅

### 6.3 添加 CSS 变量支持键盘高度

```scss
// assets/css/main.scss — 添加
:root {
  --keyboard-height: 0px;
}
```

### 6.4 平台检测 CSS

```scss
// assets/css/main.scss — 添加
// 在 Capacitor 原生环境中进一步微调
.capacitor-ios {
  // iOS 原生下禁用 touch callout 和文字选择（提升原生感）
  -webkit-touch-callout: none;
  user-select: none;

  // 输入框恢复可选择
  input, textarea, [contenteditable] {
    user-select: text;
    -webkit-touch-callout: default;
  }
}
```

### 6.5 添加平台 class 到 HTML

在 `plugins/capacitor.client.ts` 中添加（已包含在 4.2 的代码中）：

```typescript
// 在 plugin 开始时添加
if (Capacitor.isNativePlatform()) {
  document.documentElement.classList.add('capacitor-native')
  if (Capacitor.getPlatform() === 'ios') {
    document.documentElement.classList.add('capacitor-ios')
  }
}
```

---

## 七、开发调试

### 7.1 本地开发流程

```bash
# 终端 1：启动 Nuxt dev server（在 Mac 上）
cd elephant_app
npm run dev

# 修改 capacitor.config.ts 中的 URL 指向本地
# server.url: 'http://192.168.x.x:3001'（你的 Mac 局域网 IP）

# 终端 2：同步并运行
cd capacitor-app
npx cap sync ios
npx cap run ios          # 在模拟器上运行
npx cap run ios --target=YourDeviceID  # 在真机上运行
```

### 7.2 Safari 调试 WebView

1. iPhone/模拟器上打开 App
2. Mac 上打开 Safari → 开发 → 你的设备 → Elephant Todo
3. 可以使用 Safari Web Inspector 调试页面

### 7.3 生产 vs 开发配置切换

```typescript
// capacitor.config.ts
const isDev = process.env.NODE_ENV === 'development'

const config: CapacitorConfig = {
  // ...
  server: isDev
    ? { url: 'http://192.168.1.100:3001', cleartext: true }
    : { url: 'https://your-domain.com', cleartext: false },
}
```

---

## 八、App Store 上架

### 8.1 创建 App Store Connect 记录

1. 登录 [App Store Connect](https://appstoreconnect.apple.com)
2. 我的 App → 新建 App
3. 填写信息：
   - **名称**：Elephant Todo（或其他未被占用的名称）
   - **主要语言**：简体中文
   - **Bundle ID**：com.sigmalove.elephant
   - **SKU**：elephant-todo

### 8.2 准备截图

需要以下设备截图（可用模拟器截取）：

| 设备 | 尺寸 | 必需 |
|------|------|------|
| iPhone 6.9" | 1320 × 2868 | ✅ (iPhone 16 Pro Max) |
| iPhone 6.3" | 1206 × 2622 | ✅ (iPhone 16 Pro) |
| iPhone 6.7" | 1290 × 2796 | ✅ (iPhone 15 Plus) |
| iPhone 6.5" | 1284 × 2778 | ✅ (iPhone 14 Pro Max) |
| iPhone 5.5" | 1242 × 2208 | ✅ (iPhone 8 Plus) |

建议截取的页面：
1. 待办列表页（主界面）
2. 随手记页面
3. 密码本页面
4. 记账页面
5. 经期追踪 / 更多功能

### 8.3 App 审核信息

```
App 描述：
Elephant Todo 是一款集待办管理、随手记、密码本、记账、
重要日期提醒、经期追踪于一体的个人效率工具。
简洁的界面设计，支持深色模式，让生活管理更轻松。

关键词：
待办,todo,记账,密码本,随手记,经期追踪,日期提醒,效率

类别：效率 (Productivity)
内容分级：4+
```

### 8.4 构建并上传

```bash
# 在 Xcode 中
Product → Archive → Distribute App → App Store Connect
```

或使用命令行：

```bash
# 使用 xcodebuild
cd capacitor-app/ios/App
xcodebuild -workspace App.xcworkspace -scheme App -configuration Release archive -archivePath build/App.xcarchive
xcodebuild -exportArchive -archivePath build/App.xcarchive -exportPath build/output -exportOptionsPlist ExportOptions.plist
```

### 8.5 审核注意事项

| 风险点 | 应对措施 |
|--------|----------|
| **Guideline 4.2 (最小功能)** | 应用有 6+ 个功能模块，不是简单的网站壳子 |
| **Guideline 4.7 (HTML5 游戏/App)** | 通过集成原生插件 (StatusBar/Haptics/SplashScreen) 证明不是纯 WebView |
| **登录审核** | 提供测试账号密码给审核人员 |
| **隐私政策** | 需要提供隐私政策 URL（可在服务器上放一个页面） |
| **数据收集声明** | 如实填写收集的数据类型（邮箱、密码等） |

---

## 九、后续优化（可选）

### 9.1 推送通知

```bash
npm install @capacitor/push-notifications
```

用于 Todo 到期提醒、重要日期提醒等。

### 9.2 生物识别（密码本解锁）

```bash
npm install @capacitor-community/biometric-auth
```

用 Face ID / Touch ID 替代密码本的主密码输入。

### 9.3 App 内更新检测

```bash
npm install @capgo/capacitor-updater
```

如果未来改为本地 SPA 模式，可用此插件实现 OTA 热更新。

### 9.4 本地通知

```bash
npm install @capacitor/local-notifications
```

用于本地定时提醒（不依赖服务器）。

---

## 十、目录结构（最终）

```
elephant_app/
├── capacitor-app/            ← 新增：Capacitor iOS 壳子
│   ├── capacitor.config.ts
│   ├── package.json
│   ├── www/                  ← 占位 (远程模式不真正使用)
│   │   └── index.html
│   └── ios/                  ← Xcode 项目 (npx cap add ios 后生成)
│       └── App/
│           ├── App/
│           │   ├── Assets.xcassets/  ← App 图标
│           │   ├── Info.plist
│           │   └── LaunchScreen.storyboard
│           ├── App.xcworkspace
│           └── Podfile
│
├── plugins/
│   ├── capacitor.client.ts   ← 新增：Capacitor 原生能力初始化
│   └── ...
├── composables/
│   ├── useHaptics.ts         ← 新增：触觉反馈
│   └── ...
├── nuxt.config.ts            ← 基本不改
├── ...（现有代码不变）
```

---

## 十一、非编码准备工作

### 11.1 账号与环境

| 事项 | 说明 | 费用/时间 |
|------|------|-----------|
| **Apple Developer 账号** | 用个人身份注册即可（公司身份需要邓白氏编码，流程复杂） | $99/年 |
| **Mac 电脑** | Xcode 只能在 macOS 上运行。如果没有 Mac，最低方案是 Mac Mini 或租用云 Mac（如 MacStadium） | — |
| **Xcode 安装** | Mac App Store 免费下载，体积约 12GB | 下载时间 |
| **CocoaPods** | `sudo gem install cocoapods` | — |
| **HTTPS 域名** | iOS WebView 要求 HTTPS，阿里云 ECS 上配置 SSL 证书 | — |

### 11.2 设计素材

| 素材 | 规格 | 说明 |
|------|------|------|
| **App 图标** | 1024×1024 PNG，无圆角、无透明 | Apple 会自动加圆角。建议找设计师做，或用 AI 生成 |
| **启动屏** | LaunchScreen.storyboard | 简洁的品牌色 + Logo 即可 |
| **App Store 截图** | 至少 3 张，需覆盖 5 种尺寸（见下表） | 可用模拟器截图，推荐加上文字说明做成营销图 |
| **App 预览视频** | 可选，15-30 秒 | 不是必须，但有助于提升下载量 |

截图尺寸要求：

| 设备 | 尺寸 | 必需 |
|------|------|------|
| iPhone 6.9" | 1320 × 2868 | ✅ (iPhone 16 Pro Max) |
| iPhone 6.3" | 1206 × 2622 | ✅ (iPhone 16 Pro) |
| iPhone 6.7" | 1290 × 2796 | ✅ (iPhone 15 Plus) |
| iPhone 6.5" | 1284 × 2778 | ✅ (iPhone 14 Pro Max) |
| iPhone 5.5" | 1242 × 2208 | ✅ (iPhone 8 Plus) |

建议截取的页面：
1. 待办列表页（主界面）
2. 随手记页面
3. 密码本页面
4. 记账页面
5. 经期追踪 / 更多功能

### 11.3 法律与合规文档

| 文档 | 必需？ | 说明 |
|------|--------|------|
| **隐私政策** | ✅ 必须 | Apple 强制要求。需要一个可访问的 URL，说明收集哪些数据、如何使用 |
| **用户协议 (EULA)** | 推荐 | 可以使用 Apple 默认的标准 EULA |
| **App 隐私数据声明** | ✅ 必须 | 在 App Store Connect 中填写，说明收集的数据类型 |

本应用收集的数据至少包括：
- **邮箱地址**（注册登录）
- **用户生成内容**（待办、随手记、密码本等）
- **健康数据**（经期追踪——Apple 审核会重点关注）

> ⚠️ **重要**：经期追踪涉及**健康数据**，Apple 会要求说明这些数据的存储和保护方式。务必在隐私政策中明确提到加密存储、不共享给第三方等内容。

### 11.4 App Store Connect 信息填写

| 信息 | 说明 |
|------|------|
| **App 名称** | 需要在 App Store 中唯一，提前查一下有没有被占用 |
| **副标题** | 30 字符以内，如"待办 · 记账 · 密码本 · 生活管理" |
| **关键词** | 100 字符以内，逗号分隔 |
| **App 描述** | 详细功能介绍（见下方参考） |
| **分类** | 主分类建议选"效率"(Productivity) |
| **内容分级** | 填写问卷后自动生成，本应用应该是 4+ |
| **审核测试账号** | 提供一个可用的测试邮箱 + 密码给审核人员登录 |
| **联系信息** | 电话、邮箱（审核有问题时联系你） |
| **价格** | 免费 or 付费 |
| **隐私政策 URL** | 指向你部署的隐私政策页面 |

App 描述参考：

```
Elephant Todo 是一款集待办管理、随手记、密码本、记账、
重要日期提醒、经期追踪于一体的个人效率工具。
简洁的界面设计，支持深色模式，让生活管理更轻松。
```

### 11.5 审核特别注意事项

| 风险点 | 应对措施 |
|--------|----------|
| **Guideline 4.2 (最小功能)** | 应用有 6+ 个功能模块，不是简单的网站壳子 |
| **Guideline 4.7 (HTML5 App)** | 通过集成原生插件 (StatusBar/Haptics/SplashScreen) 证明不是纯 WebView |
| **登录审核** | 创建一个测试账号并预填示例数据，让审核人员体验完整功能 |
| **密码本功能** | 审核人员可能会问数据加密方式，确保隐私政策有说明 |
| **经期追踪** | 涉及健康数据，建议在隐私政策中单独说明。Apple 可能要求使用 HealthKit 或明确声明不使用 |
| **网络依赖** | 远程加载模式下断网无法使用，建议做一个友好的离线提示页面 |

### 11.6 上线后持续维护

| 事项 | 周期 | 说明 |
|------|------|------|
| **Apple Developer 续费** | 每年 | $99/年，过期后 App 会下架 |
| **iOS 大版本兼容测试** | 每年 9 月 | iOS 新版本发布后测试 App 兼容性 |
| **SSL 证书续期** | 90 天（Let's Encrypt） | 建议配置 certbot 自动续期 |
| **审核政策跟踪** | 持续 | Apple 偶尔会收紧 WebView 应用的审核标准 |
| **用户反馈处理** | 持续 | App Store Connect 中查看用户评论 |

---

## 十二、实施 Checklist

### 阶段一：准备工作
- [ ] 注册 Apple Developer 账号 ($99/年)
- [ ] 准备 Mac 电脑 + 安装 Xcode
- [ ] 配置 HTTPS（SSL 证书）
- [ ] 设计 App 图标 (1024×1024)
- [ ] 编写隐私政策页面并部署到服务器

### 阶段二：编码开发
- [ ] 创建 `capacitor-app/` 子项目并初始化
- [ ] 配置 `capacitor.config.ts`
- [ ] 添加 iOS 平台 (`npx cap add ios`)
- [ ] 在 Nuxt 中创建 `plugins/capacitor.client.ts`
- [ ] 在 Nuxt 中创建 `composables/useHaptics.ts`
- [ ] 添加平台适配 CSS
- [ ] 设计启动屏 (LaunchScreen.storyboard)

### 阶段三：测试
- [ ] Xcode 签名配置
- [ ] 模拟器测试
- [ ] 真机测试
- [ ] 离线状态测试（确保有友好提示）

### 阶段四：上架
- [ ] 准备 App Store 截图（5 种尺寸 × 3-5 张）
- [ ] App Store Connect 创建 App 并填写信息
- [ ] 创建审核用测试账号（预填示例数据）
- [ ] Archive & 上传
- [ ] 提交审核
- [ ] 处理可能的审核驳回反馈

---

## 预估工时

| 阶段 | 时间 |
|------|------|
| 账号注册 + 环境搭建 | 1-2 小时 |
| Capacitor 初始化 + 原生插件集成 | 2-3 小时 |
| CSS 适配 + 离线提示页 | 1-2 小时 |
| App 图标 + 启动屏设计 | 1-2 小时 |
| Xcode 配置 + 测试 | 1-2 小时 |
| 隐私政策编写 + 部署 | 1-2 小时 |
| App Store 截图 + 信息填写 | 2-3 小时 |
| 提交审核 + 处理反馈 | 1-7 天 |
| **合计** | **约 2 天开发 + 审核等待** |
