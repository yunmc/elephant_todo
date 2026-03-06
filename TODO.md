# TODO

---

## 功能模块进度总览

### 免费功能

| 模块 | 状态 | 设计文档 | 说明 |
|------|------|----------|------|
| 用户与认证 | ✅ 已完成 | `docs/modules/用户与认证.md` | 注册、登录、JWT 认证、忘记密码、修改密码 |
| Todo 管理 | ✅ 已完成 | `docs/modules/Todo管理.md` | CRUD、子任务、搜索筛选、优先级、分类关联 |
| 随手记 | ✅ 已完成 | `docs/modules/随手记.md` | CRUD、关联 Todo、转化为 Todo、语音/文字来源标记 |
| 记账 | ✅ 已完成 | `docs/modules/记账.md` | 收支记录 CRUD、分类管理、月度统计、预算管理 |
| 重要日期 | ✅ 已完成 | `docs/modules/重要日期.md` | CRUD、倒计时、农历、年度重复、提醒配置 |
| 密码本 | ✅ 已完成 | `docs/modules/密码本.md` | E2E 加密（AES-256-GCM）、分组管理、密码生成器 |
| 经期追踪 | ✅ 已完成 | `docs/modules/经期追踪.md` | 多人追踪、流量/症状记录、周期预测、易孕期计算 |
| 分类与标签 | ✅ 已完成 | `docs/modules/分类与标签.md` | 分类/标签 CRUD，集成于 Todo 管理 |
| 智能匹配 | ✅ 已完成 | `docs/modules/智能匹配.md` | LLM 语义匹配、语音输入、多模型降级（目前免费开放，后续转 Premium） |

### 付费功能

| 模块 | 状态 | 设计文档 | 说明 |
|------|------|----------|------|
| 会员体系 | ⚠️ 部分完成 | `docs/modules/会员体系.md` | DB/API 基础设施已建好，缺少：订阅 UI、Apple IAP 对接、付费门控完善 |
| 手帐商店一期 | ✅ 已完成 | `docs/modules/手帐商店一期.md` | 象币钱包、商品浏览/购买、仓库、皮肤装扮、CSS 皮肤系统（贴纸/字体/充值为二期） |
| AI 功能 | ✅ 已完成 | `docs/modules/AI功能.md` | AI 快速记账、月度/年度报告、共享 LLM 工具、报告缓存（均需 Premium） |
| AI 宠物 | ❌ 未开发 | `docs/modules/AI宠物.md` | AI 小象宠物、体力系统（象币喂食）、AI 聊天/智能提醒/每日一言、情绪互动、宠物皮肤（设计文档已完成） |

### AI 宠物 — 未来迭代灵感（旅行青蛙风格）

> 以下为远期想法，不在当前开发范围内，仅做记录。

- [ ] **放置感**：小象会"自己出门逛"，回来后带回发现（"主人，我偷看了你的待办，有3个快过期了哦～"）
- [ ] **随机惊喜**：小象旅行归来寄"明信片"（基于用户数据生成的趣味卡片/总结）
- [ ] **低交互高情感**：减少主动操作，增加被动惊喜和牵挂感
- [ ] **零压力设计**：不惩罚不登录的用户，只奖励回来的用户

---

## 部署优化

- [ ] HTTPS：域名备案通过后，用 certbot 配置 Let's Encrypt SSL 证书（iOS 上架前置条件）
- [ ] CI/CD：GitHub Actions 自动 build + push 镜像 + SSH 部署
- [ ] ECS 上 `scripts/init-db.sql` 使用项目原始文件（而非手动 cat 写入），确保 MySQL 首次初始化正确

---

## 前端优化

- [ ] Chrome autofill 输入框文字不可见问题（已加 CSS 修复，待重新部署验证）

---

## iOS 上架

> 方案文档：`docs/Capacitor-iOS上架方案.md`

### 前置条件

- [x] **Apple Developer 账号** — Personal Team 已登录 Xcode
- [x] **Mac 电脑** + Xcode 26.3 + CocoaPods 1.16.2 已安装
- [ ] **域名备案通过** + HTTPS 配置（certbot + Let's Encrypt）— iOS WebView 强制 HTTPS
- [ ] **Apple Developer Program**（$99/年）— 上架 App Store 需付费账号

### Nuxt 项目适配

- [x] 安装 Capacitor 前端依赖（`@capacitor/core`, `@capacitor/status-bar` 等）
- [x] 创建 `plugins/capacitor.client.ts`（StatusBar / Keyboard / SplashScreen 集成）
- [x] 创建 `composables/useHaptics.ts`（触觉反馈）
- [x] CSS 适配：键盘高度变量、安全区域布局（`contentInset: 'never'` + CSS `env(safe-area-inset-*)` 统筹管理）
- [x] 登录页 logo 替换为 App 图标（圆角）
- [x] Naive UI 消息组件适配刘海/灵动岛安全区域

### Capacitor 子项目

- [x] 创建 `capacitor-app/` 目录，初始化 Capacitor 项目
- [x] 配置 `capacitor.config.ts`（开发阶段指向本地，上线改回 HTTPS 域名）
- [x] `npx cap add ios` 添加 iOS 平台
- [x] iOS 部署目标设为 15.0
- [x] App 图标 1024×1024 已导入 Xcode 项目
- [x] 模拟器测试通过（iPhone 16 - iOS 18.0）

### Xcode 配置

- [x] Bundle ID：`com.sigmalove.elephant`
- [x] Display Name：`Elephant Todo`
- [x] Deployment Target：iOS 15.0
- [ ] Device Orientation：仅 Portrait（当前允许横屏，上架前改为仅竖屏）
- [x] Signing：Personal Team 自动签名已配置（上架需升级付费账号）

### 资源准备

- [x] App 图标：1024×1024 已导入（无圆角无透明）
- [x] 隐私政策页面（`/privacy`）、服务条款页面（`/terms`）已创建
- [ ] 启动屏（LaunchScreen.storyboard）：品牌色 `#4f46e5` + Logo
- [ ] App Store 截图（5 组设备尺寸：6.9" / 6.3" / 6.7" / 6.5" / 5.5"）
- [ ] 截图页面建议：待办列表、随手记、密码本、记账、经期追踪/更多功能

### App Store Connect

- [ ] 创建 App 记录（名称 / Bundle ID / SKU）
- [ ] 填写 App 描述、关键词、类别（效率）、内容分级（4+）
- [ ] 上传截图
- [ ] 隐私政策 URL：`https://elephantodo.com/privacy`
- [ ] Archive + 上传构建版本
- [ ] 提交审核

### 备案后待办

- [ ] `capacitor.config.ts` 的 `server.url` 改回 `https://elephantodo.com`
- [ ] 服务器配置 HTTPS（certbot + Let's Encrypt）
- [ ] `Info.plist` 移除 `NSAllowsArbitraryLoads`（关闭 ATS 例外）
- [ ] 注册 Apple Developer Program（$99/年）
