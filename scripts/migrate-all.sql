-- ============================================================
-- 小象手帐 — 全量幂等迁移脚本
-- 可在任何状态的数据库上安全重复执行
-- 用法: mysql -u root -proot123 < scripts/migrate-all.sql
-- ============================================================

CREATE DATABASE IF NOT EXISTS elephant_todo
  DEFAULT CHARACTER SET utf8mb4
  DEFAULT COLLATE utf8mb4_unicode_ci;

USE elephant_todo;

-- ==================== 基础表 ====================

-- 1. 用户表
CREATE TABLE IF NOT EXISTS users (
  id         INT          AUTO_INCREMENT PRIMARY KEY,
  username   VARCHAR(50)  NOT NULL,
  email      VARCHAR(100) NOT NULL,
  plan       ENUM('free','premium') NOT NULL DEFAULT 'free',
  plan_expires_at DATETIME DEFAULT NULL,
  auto_renew TINYINT(1)   NOT NULL DEFAULT 0,
  password   VARCHAR(255) NOT NULL,
  vault_salt VARCHAR(50)  DEFAULT NULL,
  created_at DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_users_username (username),
  UNIQUE KEY uk_users_email (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 给已有 users 表补 plan 字段（幂等）
DELIMITER //
CREATE PROCEDURE _migrate_users_plan()
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = DATABASE() AND table_name = 'users' AND column_name = 'plan'
  ) THEN
    ALTER TABLE users
      ADD COLUMN plan ENUM('free','premium') NOT NULL DEFAULT 'free' AFTER email,
      ADD COLUMN plan_expires_at DATETIME DEFAULT NULL AFTER plan,
      ADD COLUMN auto_renew TINYINT(1) NOT NULL DEFAULT 0 AFTER plan_expires_at;
  END IF;
END //
DELIMITER ;
CALL _migrate_users_plan();
DROP PROCEDURE IF EXISTS _migrate_users_plan;

-- 2. 分类表
CREATE TABLE IF NOT EXISTS categories (
  id         INT          AUTO_INCREMENT PRIMARY KEY,
  user_id    INT          NOT NULL,
  name       VARCHAR(50)  NOT NULL,
  color      VARCHAR(20)  DEFAULT '#999999',
  created_at DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uk_categories_user_name (user_id, name),
  KEY idx_categories_user_id (user_id),
  CONSTRAINT fk_categories_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 3. 待办事项表
CREATE TABLE IF NOT EXISTS todos (
  id           INT                               AUTO_INCREMENT PRIMARY KEY,
  user_id      INT                               NOT NULL,
  category_id  INT                               DEFAULT NULL,
  title        VARCHAR(200)                      NOT NULL,
  description  TEXT                              DEFAULT NULL,
  priority     ENUM('high','medium','low')       NOT NULL DEFAULT 'medium',
  status       ENUM('pending','completed')       NOT NULL DEFAULT 'pending',
  due_date     DATETIME                          DEFAULT NULL,
  completed_at DATETIME                          DEFAULT NULL,
  created_at   DATETIME                          NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at   DATETIME                          NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  embedding    JSON                              DEFAULT NULL,
  KEY idx_todos_user_id (user_id),
  KEY idx_todos_category_id (category_id),
  KEY idx_todos_user_status (user_id, status),
  KEY idx_todos_user_priority (user_id, priority),
  KEY idx_todos_user_due_date (user_id, due_date),
  FULLTEXT KEY idx_todos_title (title, description),
  CONSTRAINT fk_todos_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_todos_category FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 4. 标签表
CREATE TABLE IF NOT EXISTS tags (
  id         INT          AUTO_INCREMENT PRIMARY KEY,
  user_id    INT          NOT NULL,
  name       VARCHAR(50)  NOT NULL,
  created_at DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uk_tags_user_name (user_id, name),
  KEY idx_tags_user_id (user_id),
  CONSTRAINT fk_tags_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 5. 随手记表
CREATE TABLE IF NOT EXISTS ideas (
  id         INT                        AUTO_INCREMENT PRIMARY KEY,
  user_id    INT                        NOT NULL,
  todo_id    INT                        DEFAULT NULL,
  content    TEXT                       NOT NULL,
  source     ENUM('text','voice')       NOT NULL DEFAULT 'text',
  embedding  JSON                       DEFAULT NULL,
  created_at DATETIME                   NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME                   NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_ideas_user_id (user_id),
  KEY idx_ideas_todo_id (todo_id),
  KEY idx_ideas_user_created (user_id, created_at),
  FULLTEXT KEY idx_ideas_content (content),
  CONSTRAINT fk_ideas_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_ideas_todo FOREIGN KEY (todo_id) REFERENCES todos(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 6. Todo-标签关联表
CREATE TABLE IF NOT EXISTS todo_tags (
  todo_id INT NOT NULL,
  tag_id  INT NOT NULL,
  PRIMARY KEY (todo_id, tag_id),
  KEY idx_todo_tags_tag_id (tag_id),
  CONSTRAINT fk_todo_tags_todo FOREIGN KEY (todo_id) REFERENCES todos(id) ON DELETE CASCADE,
  CONSTRAINT fk_todo_tags_tag FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 7. 子任务表
CREATE TABLE IF NOT EXISTS subtasks (
  id         INT                          AUTO_INCREMENT PRIMARY KEY,
  todo_id    INT                          NOT NULL,
  title      VARCHAR(200)                 NOT NULL,
  status     ENUM('pending','completed')  NOT NULL DEFAULT 'pending',
  sort_order INT                          NOT NULL DEFAULT 0,
  created_at DATETIME                     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME                     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_subtasks_todo_id (todo_id),
  CONSTRAINT fk_subtasks_todo FOREIGN KEY (todo_id) REFERENCES todos(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 8. 密码分组表
CREATE TABLE IF NOT EXISTS vault_groups (
  id         INT          AUTO_INCREMENT PRIMARY KEY,
  user_id    INT          NOT NULL,
  name       VARCHAR(50)  NOT NULL,
  icon       VARCHAR(50)  DEFAULT NULL,
  sort_order INT          NOT NULL DEFAULT 0,
  created_at DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uk_vault_groups_user_name (user_id, name),
  KEY idx_vault_groups_user_id (user_id),
  CONSTRAINT fk_vault_groups_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 9. 密码记录表
CREATE TABLE IF NOT EXISTS vault_entries (
  id                 INT           AUTO_INCREMENT PRIMARY KEY,
  user_id            INT           NOT NULL,
  group_id           INT           DEFAULT NULL,
  name               VARCHAR(200)  NOT NULL,
  url                VARCHAR(500)  DEFAULT NULL,
  encrypted_data     TEXT          NOT NULL,
  created_at         DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at         DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_vault_entries_user_id (user_id),
  KEY idx_vault_entries_group_id (group_id),
  KEY idx_vault_entries_user_name (user_id, name),
  CONSTRAINT fk_vault_entries_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_vault_entries_group FOREIGN KEY (group_id) REFERENCES vault_groups(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 10. 密码重置令牌表
CREATE TABLE IF NOT EXISTS password_reset_tokens (
  id         INT          AUTO_INCREMENT PRIMARY KEY,
  user_id    INT          NOT NULL,
  token      VARCHAR(255) NOT NULL,
  expires_at DATETIME     NOT NULL,
  used       BOOLEAN      NOT NULL DEFAULT FALSE,
  created_at DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uk_reset_tokens_token (token),
  KEY idx_reset_tokens_user_id (user_id),
  CONSTRAINT fk_reset_tokens_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ==================== 记账模块 ====================

-- 11. 记账分类表
CREATE TABLE IF NOT EXISTS finance_categories (
  id         INT          AUTO_INCREMENT PRIMARY KEY,
  user_id    INT          NOT NULL,
  name       VARCHAR(50)  NOT NULL,
  icon       VARCHAR(50)  DEFAULT '💰',
  type       ENUM('income','expense') NOT NULL DEFAULT 'expense',
  sort_order INT          NOT NULL DEFAULT 0,
  created_at DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uk_finance_categories_user_name_type (user_id, name, type),
  KEY idx_finance_categories_user_id (user_id),
  CONSTRAINT fk_finance_categories_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 12. 记账记录表
CREATE TABLE IF NOT EXISTS finance_records (
  id          INT            AUTO_INCREMENT PRIMARY KEY,
  user_id     INT            NOT NULL,
  category_id INT            DEFAULT NULL,
  type        ENUM('income','expense') NOT NULL DEFAULT 'expense',
  amount      DECIMAL(12,2)  NOT NULL,
  note        VARCHAR(500)   DEFAULT NULL,
  record_date DATE           NOT NULL,
  created_at  DATETIME       NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  DATETIME       NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_finance_records_user_id (user_id),
  KEY idx_finance_records_category_id (category_id),
  KEY idx_finance_records_user_date (user_id, record_date),
  KEY idx_finance_records_user_type (user_id, type),
  CONSTRAINT fk_finance_records_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_finance_records_category FOREIGN KEY (category_id) REFERENCES finance_categories(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 13. 预算表
CREATE TABLE IF NOT EXISTS finance_budgets (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  user_id     INT NOT NULL,
  category_id INT DEFAULT NULL,
  `year_month` VARCHAR(7) NOT NULL,
  amount      DECIMAL(12,2) NOT NULL,
  created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_budgets_user (user_id),
  UNIQUE KEY uk_budgets_user_month_cat (user_id, category_id, `year_month`),
  CONSTRAINT fk_budgets_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_budgets_category FOREIGN KEY (category_id) REFERENCES finance_categories(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ==================== 重要日期模块 ====================

-- 14. 重要日期表
CREATE TABLE IF NOT EXISTS important_dates (
  id                 INT          AUTO_INCREMENT PRIMARY KEY,
  user_id            INT          NOT NULL,
  title              VARCHAR(200) NOT NULL,
  date               DATE         NOT NULL,
  is_lunar           BOOLEAN      NOT NULL DEFAULT FALSE,
  repeat_type        VARCHAR(20)  NOT NULL DEFAULT 'none',
  remind_days_before INT          NOT NULL DEFAULT 0,
  icon               VARCHAR(50)  DEFAULT '📅',
  note               TEXT         DEFAULT NULL,
  created_at         DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at         DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_important_dates_user_id (user_id),
  KEY idx_important_dates_user_date (user_id, date),
  CONSTRAINT fk_important_dates_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ==================== 经期追踪模块 ====================

-- 15. 经期记录表
CREATE TABLE IF NOT EXISTS period_records (
  id            INT          AUTO_INCREMENT PRIMARY KEY,
  user_id       INT          NOT NULL,
  person_name   VARCHAR(50)  NOT NULL DEFAULT '我',
  start_date    DATE         NOT NULL,
  end_date      DATE         DEFAULT NULL,
  cycle_length  INT          DEFAULT NULL,
  period_length INT          DEFAULT NULL,
  flow_level    ENUM('light','moderate','heavy') DEFAULT 'moderate',
  symptoms      JSON         DEFAULT NULL,
  note          TEXT         DEFAULT NULL,
  created_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_period_records_user_id (user_id),
  KEY idx_period_records_user_date (user_id, start_date),
  KEY idx_period_records_user_person (user_id, person_name),
  CONSTRAINT fk_period_records_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ==================== 会员体系 (migrate-001) ====================

-- 16. 管理员用户表
CREATE TABLE IF NOT EXISTS admin_users (
  id             INT AUTO_INCREMENT PRIMARY KEY,
  username       VARCHAR(50) NOT NULL,
  email          VARCHAR(100) NOT NULL,
  password       VARCHAR(255) NOT NULL,
  role           ENUM('operator', 'super_admin') NOT NULL DEFAULT 'operator',
  last_login_at  DATETIME DEFAULT NULL,
  created_at     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_admin_username (username),
  UNIQUE KEY uk_admin_email (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 管理员种子数据 (密码 123456)
INSERT IGNORE INTO admin_users (username, email, password, role)
VALUES ('admin', 'admin@elephant.app', '$2a$10$Gr5Br3o1cbF4WDr1B5AEIeRFomdVnAyY3kEnu0OEqlp2ezo5IgjwS', 'super_admin');

-- 17. 会员订单表
CREATE TABLE IF NOT EXISTS premium_orders (
  id             INT AUTO_INCREMENT PRIMARY KEY,
  user_id        INT NOT NULL,
  order_no       VARCHAR(64) NOT NULL,
  plan_type      ENUM('monthly', 'yearly') NOT NULL,
  amount         DECIMAL(10,2) NOT NULL,
  status         ENUM('pending', 'paid', 'expired', 'refunded') NOT NULL DEFAULT 'pending',
  payment_method VARCHAR(20) DEFAULT NULL,
  apple_transaction_id          VARCHAR(128) DEFAULT NULL,
  apple_original_transaction_id VARCHAR(128) DEFAULT NULL,
  apple_product_id              VARCHAR(64)  DEFAULT NULL,
  is_auto_renew  TINYINT(1) NOT NULL DEFAULT 0,
  paid_at        DATETIME DEFAULT NULL,
  starts_at      DATETIME DEFAULT NULL,
  expires_at     DATETIME NOT NULL,
  created_at     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_order_no (order_no),
  INDEX idx_orders_user (user_id),
  INDEX idx_orders_status (status),
  INDEX idx_apple_original_txn (apple_original_transaction_id),
  CONSTRAINT fk_orders_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ==================== 手帐商店 (migrate-002) ====================

-- 18. 商品表
CREATE TABLE IF NOT EXISTS shop_products (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  type          ENUM('skin', 'sticker_pack', 'font', 'pet_skin', 'bundle') NOT NULL,
  name          VARCHAR(50) NOT NULL,
  description   VARCHAR(200) DEFAULT NULL,
  price         INT NOT NULL DEFAULT 0,
  preview_url   VARCHAR(500) DEFAULT NULL,
  asset_key     VARCHAR(100) NOT NULL,
  is_free       TINYINT(1) NOT NULL DEFAULT 0,
  is_limited    TINYINT(1) NOT NULL DEFAULT 0,
  limited_start DATETIME DEFAULT NULL,
  limited_end   DATETIME DEFAULT NULL,
  sort_order    INT NOT NULL DEFAULT 0,
  status        ENUM('active', 'hidden') NOT NULL DEFAULT 'active',
  created_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_asset_key (asset_key),
  INDEX idx_products_type (type),
  INDEX idx_products_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 19. 套装包含的单品
CREATE TABLE IF NOT EXISTS shop_bundle_items (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  bundle_id   INT NOT NULL,
  product_id  INT NOT NULL,
  UNIQUE KEY uk_bundle_product (bundle_id, product_id),
  CONSTRAINT fk_bundle FOREIGN KEY (bundle_id) REFERENCES shop_products(id) ON DELETE CASCADE,
  CONSTRAINT fk_bundle_product FOREIGN KEY (product_id) REFERENCES shop_products(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 20. 用户象币钱包
CREATE TABLE IF NOT EXISTS user_wallets (
  user_id      INT PRIMARY KEY,
  balance      INT NOT NULL DEFAULT 0,
  total_earned INT NOT NULL DEFAULT 0,
  total_spent  INT NOT NULL DEFAULT 0,
  updated_at   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_wallet_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 21. 象币流水记录
CREATE TABLE IF NOT EXISTS wallet_transactions (
  id             INT AUTO_INCREMENT PRIMARY KEY,
  user_id        INT NOT NULL,
  type           ENUM('recharge', 'purchase', 'reward', 'refund') NOT NULL,
  amount         INT NOT NULL,
  balance_after  INT NOT NULL,
  reference_type VARCHAR(20) DEFAULT NULL,
  reference_id   INT DEFAULT NULL,
  description    VARCHAR(100) DEFAULT NULL,
  created_at     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_wallet_tx_user (user_id, created_at),
  CONSTRAINT fk_wallet_tx_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 22. 用户已购商品
CREATE TABLE IF NOT EXISTS user_products (
  id           INT AUTO_INCREMENT PRIMARY KEY,
  user_id      INT NOT NULL,
  product_id   INT NOT NULL,
  purchased_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  source       ENUM('purchase', 'bundle', 'gift', 'reward') NOT NULL DEFAULT 'purchase',
  UNIQUE KEY uk_user_product (user_id, product_id),
  CONSTRAINT fk_up_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_up_product FOREIGN KEY (product_id) REFERENCES shop_products(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 23. 用户装扮配置
CREATE TABLE IF NOT EXISTS user_appearance (
  user_id         INT PRIMARY KEY,
  skin_id         INT DEFAULT NULL,
  sticker_pack_id INT DEFAULT NULL,
  font_id         INT DEFAULT NULL,
  updated_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_appear_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_appear_skin FOREIGN KEY (skin_id) REFERENCES shop_products(id) ON DELETE SET NULL,
  CONSTRAINT fk_appear_sticker FOREIGN KEY (sticker_pack_id) REFERENCES shop_products(id) ON DELETE SET NULL,
  CONSTRAINT fk_appear_font FOREIGN KEY (font_id) REFERENCES shop_products(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 商店种子数据
INSERT IGNORE INTO shop_products (type, name, description, price, asset_key, is_free, sort_order)
VALUES ('skin', '简约默认', '经典简约风格', 0, 'default', 1, 0);

INSERT IGNORE INTO shop_products (type, name, description, price, asset_key, sort_order) VALUES
('skin', '牛皮纸', '复古牛皮纸纹理 + 暖色调', 20, 'kraft', 1),
('skin', '方格本', '淡蓝方格背景', 15, 'grid', 2),
('skin', '星空', '深蓝渐变 + 星点装饰', 25, 'starry', 3),
('skin', '樱花', '粉色系 + 落樱背景', 25, 'sakura', 4),
('skin', '森林', '莫兰迪绿 + 叶片纹理', 20, 'forest', 5),
('skin', '海洋', '浅蓝渐变 + 波纹', 20, 'ocean', 6);

-- ==================== AI 功能 (migrate-003) ====================

-- 24. AI 报告缓存表
CREATE TABLE IF NOT EXISTS ai_reports (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  report_type ENUM('monthly', 'yearly') NOT NULL,
  year INT NOT NULL,
  month INT NOT NULL DEFAULT 0,
  content JSON NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uk_user_report (user_id, report_type, year, month),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_user_type (user_id, report_type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ==================== 活动配置 (migrate-005) ====================

-- 25. 活动配置表
CREATE TABLE IF NOT EXISTS admin_activities (
  id             INT AUTO_INCREMENT PRIMARY KEY,
  title          VARCHAR(100) NOT NULL,
  type           ENUM('sign_in_bonus', 'holiday_event', 'flash_sale', 'custom') NOT NULL DEFAULT 'custom',
  description    TEXT,
  config         JSON,
  starts_at      DATETIME NOT NULL,
  ends_at        DATETIME NOT NULL,
  status         ENUM('draft', 'active', 'ended', 'cancelled') NOT NULL DEFAULT 'draft',
  created_by     INT DEFAULT NULL,
  created_at     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_activity_status (status),
  INDEX idx_activity_dates (starts_at, ends_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- 完成
-- ============================================================
SELECT 'migrate-all.sql executed successfully' AS result;
