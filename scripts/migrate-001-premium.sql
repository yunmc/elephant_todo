-- ============================================================
-- P0 会员体系 — 数据库迁移脚本
-- 执行方式: mysql -u root -p elephant_db < scripts/migrate-001-premium.sql
-- ============================================================

-- 1. users 表扩展：增加会员字段
ALTER TABLE users
  ADD COLUMN plan ENUM('free', 'premium') NOT NULL DEFAULT 'free' AFTER email,
  ADD COLUMN plan_expires_at DATETIME DEFAULT NULL AFTER plan,
  ADD COLUMN auto_renew TINYINT(1) NOT NULL DEFAULT 0 AFTER plan_expires_at;

-- 2. admin_users 表（运营后台独立用户表，与 App 用户解耦）
CREATE TABLE admin_users (
  id             INT AUTO_INCREMENT PRIMARY KEY,
  username       VARCHAR(50) NOT NULL,
  email          VARCHAR(100) NOT NULL,
  password       VARCHAR(255) NOT NULL,
  role           ENUM('operator', 'super_admin') NOT NULL DEFAULT 'operator' COMMENT '运营员 / 超级管理员',
  last_login_at  DATETIME DEFAULT NULL,
  created_at     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_admin_username (username),
  UNIQUE KEY uk_admin_email (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 种子数据：超级管理员（密码 123456 的 bcrypt 哈希）
INSERT INTO admin_users (username, email, password, role)
VALUES ('admin', 'admin@elephant.app', '$2a$10$Gr5Br3o1cbF4WDr1B5AEIeRFomdVnAyY3kEnu0OEqlp2ezo5IgjwS', 'super_admin');

-- 3. premium_orders 表（订单表）
CREATE TABLE premium_orders (
  id             INT AUTO_INCREMENT PRIMARY KEY,
  user_id        INT NOT NULL,
  order_no       VARCHAR(64) NOT NULL COMMENT '业务订单号',
  plan_type      ENUM('monthly', 'yearly') NOT NULL,
  amount         DECIMAL(10,2) NOT NULL COMMENT '实付金额（元）',
  status         ENUM('pending', 'paid', 'expired', 'refunded') NOT NULL DEFAULT 'pending',
  payment_method VARCHAR(20) DEFAULT NULL COMMENT 'wechat / alipay / apple_iap',
  -- Apple IAP 自动续费相关字段
  apple_transaction_id          VARCHAR(128) DEFAULT NULL COMMENT 'Apple transactionId',
  apple_original_transaction_id VARCHAR(128) DEFAULT NULL COMMENT 'Apple originalTransactionId（同一订阅链共享）',
  apple_product_id              VARCHAR(64)  DEFAULT NULL COMMENT 'Apple productId, 如 com.elephant.premium.monthly',
  is_auto_renew  TINYINT(1) NOT NULL DEFAULT 0 COMMENT '本次订单是否为自动续费产生',
  --
  paid_at        DATETIME DEFAULT NULL,
  starts_at      DATETIME DEFAULT NULL COMMENT '会员生效时间',
  expires_at     DATETIME NOT NULL COMMENT '会员到期时间',
  created_at     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_order_no (order_no),
  INDEX idx_orders_user (user_id),
  INDEX idx_orders_status (status),
  INDEX idx_apple_original_txn (apple_original_transaction_id),
  CONSTRAINT fk_orders_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
