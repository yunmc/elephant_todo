# TODO

## 数据库重构：引入 ORM + 迁移工具

**优先级**：中  
**目标**：告别手动管理 SQL，实现 schema 声明式管理 + 一键迁移同步

### 候选方案

| 工具 | 特点 | 迁移命令 |
|------|------|---------|
| **Prisma** | 最流行，schema 文件声明式，自动生成类型安全的 client | `prisma migrate deploy` |
| **Drizzle ORM** | 轻量，贴近 SQL，Nuxt/TypeScript 生态热门 | `drizzle-kit push` |
| **Knex.js** | 仅迁移层，不改现有 raw SQL 查询代码 | `knex migrate:latest` |

### 重构步骤

1. [ ] 选定 ORM 工具（建议 Drizzle，与现有 raw SQL 风格最接近）
2. [ ] 根据 `scripts/init-db.sql` 编写 schema 定义文件
3. [ ] 生成初始迁移文件，验证与现有数据库一致
4. [ ] 逐步替换 `server/utils/models/` 中的 raw SQL 为 ORM 查询
5. [ ] 在 Docker 启动流程中集成 `migrate deploy`，实现自动同步
6. [ ] 移除 `scripts/init-db.sql`，由迁移文件管理 schema

### 收益

- 数据库 schema 变更有版本记录，可追溯
- 部署时 `migrate deploy` 自动同步，无需手动执行 SQL
- 类型安全的查询，减少运行时错误

---

## 部署优化

- [ ] HTTPS：域名备案通过后，用 certbot 配置 Let's Encrypt SSL 证书
- [ ] CI/CD：GitHub Actions 自动 build + push 镜像 + SSH 部署
- [ ] ECS 上 `scripts/init-db.sql` 使用项目原始文件（而非手动 cat 写入），确保 MySQL 首次初始化正确

---

## 前端优化

- [ ] Chrome autofill 输入框文字不可见问题（已加 CSS 修复，待重新部署验证）

---

## ~~密码本：密码生成器（免费功能）~~ ✅ 已完成

- [x] 在密码本新增/编辑页面增加「生成密码」按钮
- [x] 纯前端本地随机生成，不走 AI
- [x] 可配置：密码长度（8-64）、大写字母、小写字母、数字、特殊字符
- [x] 生成后自动填入密码输入框，支持点击重新生成
