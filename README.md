# 🐘 Elephant Todo

移动优先的全栈 SSR Todo 应用，基于 Nuxt 3 构建。

## 功能特性

- ✅ **待办管理** — 创建、编辑、分类、标签、优先级、截止日期、子任务
- 📝 **随手记** — 快速记录灵感，支持语音输入，可关联/转化为待办
- 🔒 **密码本** — 客户端 AES-256-GCM 端到端加密，安全存储账户密码
- 💰 **记账** — 收支记录、分类管理、月度统计汇总
- 📅 **重要日期** — 纪念日/生日记录，倒计时显示，支持农历和每年重复
- 🌸 **经期追踪** — 经期记录、周期预测、易孕期计算、症状/心情记录
- 🎤 **语音输入** — 基于 Web Speech API 快速录入
- 🔍 **智能建议** — 基于 LLM（DeepSeek / Gemini）的相似 Todo 匹配与分类建议
- 📱 **PWA** — 可安装到主屏幕，离线可用
- 🌗 **深色模式** — 跟随系统或手动切换，PWA 冷启动无闪烁

## 技术栈

| 层级 | 技术 |
|------|------|
| 框架 | Nuxt 3 (Vue 3 + Nitro SSR) |
| UI | Naive UI (via @bg-dev/nuxt-naiveui) |
| 状态 | Pinia |
| 数据库 | MySQL 8 (mysql2/promise) |
| 认证 | JWT (access + refresh token, cookie 存储) |
| 加密 | Web Crypto API (AES-256-GCM + PBKDF2) |
| 邮件 | Nodemailer |
| PWA | @vite-pwa/nuxt |
| 样式 | SCSS (mobile-first, CSS 变量主题) |
| 测试 | Vitest (单元) + Playwright (E2E) |

## 快速开始

### 前提条件

- Node.js >= 18
- MySQL >= 8.0

### 1. 安装依赖

```bash
npm install
```

### 2. 配置环境变量

```bash
cp .env.example .env
# 编辑 .env 填入你的配置
```

### 3. 初始化数据库

在 MySQL 中执行 `docs/数据库设计.md` 中的建表 SQL。

### 4. 启动开发服务器

```bash
npm run dev
```

访问 http://localhost:3000

### 5. 构建生产版本

```bash
npm run build
npm run preview
```

## 项目结构

```
elephant_app/
├── assets/css/          # 全局样式 (SCSS + CSS 变量主题)
├── composables/         # Vue composables (useApi, useThemePreference, useVaultCrypto, useVoiceInput)
├── docs/                # 需求文档、数据库设计
├── layouts/             # 页面布局 (default, auth)
├── middleware/           # 路由守卫 (auth.global.ts)
├── pages/               # 页面路由
│   ├── index.vue        # 待办列表 (搜索/筛选/分页)
│   ├── todo/[id].vue    # 待办详情 (编辑/子任务)
│   ├── ideas/           # 随手记
│   ├── vault/           # 密码本
│   ├── finance/         # 记账
│   ├── important-dates/ # 重要日期
│   ├── period/          # 经期追踪
│   ├── more/            # 更多功能 Hub
│   ├── settings.vue     # 设置 (主题/分类/标签/改密)
│   ├── login.vue        # 登录
│   ├── register.vue     # 注册
│   ├── forgot-password.vue
│   └── reset-password.vue
├── plugins/             # Nuxt 客户端插件 (主题持久化等)
├── prompts/             # LLM 提示词模板
├── public/              # 静态资源 (PWA 图标等)
├── server/
│   ├── api/             # API 路由 (60+ endpoints)
│   │   ├── auth/        # 认证 (登录/注册/刷新/改密/重置)
│   │   ├── todos/       # 待办 CRUD + 子任务 + 标签关联
│   │   ├── ideas/       # 随手记 CRUD + 关联/转化
│   │   ├── vault/       # 密码本 (分组 + 条目 + 批量重加密)
│   │   ├── finance/     # 记账 (分类 + 记录 + 统计)
│   │   ├── important-dates/ # 重要日期 CRUD
│   │   ├── period/      # 经期追踪 (CRUD + 预测)
│   │   ├── categories/  # 分类 CRUD
│   │   ├── tags/        # 标签 CRUD
│   │   └── match/       # LLM 智能建议
│   ├── types/           # 服务端类型定义
│   └── utils/           # 工具 (db, auth, mailer, models)
├── stores/              # Pinia stores (auth, todos, ideas, vault, categories, tags, finance, important-dates, period)
├── tests/
│   ├── e2e/             # Playwright E2E 测试
│   └── unit/            # Vitest 单元测试
├── types/               # 客户端类型定义
├── nuxt.config.ts
└── package.json
```

## 环境变量

| 变量 | 说明 | 默认值 |
|------|------|--------|
| `DB_HOST` | MySQL 主机 | localhost |
| `DB_PORT` | MySQL 端口 | 3306 |
| `DB_USER` | MySQL 用户 | root |
| `DB_PASSWORD` | MySQL 密码 | - |
| `DB_NAME` | 数据库名 | elephant_todo |
| `JWT_SECRET` | JWT 签名密钥 | - |
| `JWT_REFRESH_SECRET` | Refresh Token 密钥 | - |
| `SMTP_HOST` | SMTP 服务器 | - |
| `SMTP_PORT` | SMTP 端口 | 465 |
| `SMTP_USER` | SMTP 用户 | - |
| `SMTP_PASS` | SMTP 密码 | - |
| `SMTP_FROM` | 发件人地址 | - |
| `GEMINI_API_KEY` | Gemini LLM API Key | - |
| `DEEPSEEK_API_KEY` | DeepSeek LLM API Key (备用) | - |
| `RESET_PASSWORD_URL` | 重置密码页面 URL | http://localhost:3000/reset-password |

## License

MIT
