# TODO

## ~~数据库重构：引入 ORM + 迁移工具~~ ✅ 已完成

已选择 **Drizzle ORM**，完成全部重构：

- [x] 安装 drizzle-orm + drizzle-kit
- [x] 编写 `server/database/schema.ts`（25 张表，snake_case 保持 API 兼容）
- [x] 创建 `drizzle.config.ts` 配置文件
- [x] 重构 `server/utils/db.ts`：`getDb()` 返回 Drizzle 实例，`getPool()` 返回原始连接池
- [x] 重写全部 15 个 model 文件（简单 CRUD 用 Drizzle，复杂查询保留 raw SQL）
- [x] 更新 3 个工具文件（premium / shop-purchase / ai-data-aggregator）
- [x] 重写 8 个测试文件适配 Drizzle mock
- [x] 全部 741 单元测试通过

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
