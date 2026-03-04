-- ============================================================
-- P1 手帐商店一期 — 迁移脚本
-- 创建 6 张表 + 种子商品数据
-- ============================================================

-- 1. 商品表
CREATE TABLE IF NOT EXISTS shop_products (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  type          ENUM('skin', 'sticker_pack', 'font', 'pet_skin', 'bundle') NOT NULL,
  name          VARCHAR(50) NOT NULL,
  description   VARCHAR(200) DEFAULT NULL,
  price         INT NOT NULL COMMENT '象币价格，0=免费',
  preview_url   VARCHAR(500) DEFAULT NULL COMMENT '预览图 URL',
  asset_key     VARCHAR(100) NOT NULL COMMENT '资源标识符，前端据此加载对应皮肤/贴纸/字体',
  is_free       TINYINT(1) NOT NULL DEFAULT 0 COMMENT '是否免费自带',
  is_limited    TINYINT(1) NOT NULL DEFAULT 0 COMMENT '是否限时商品',
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

-- 2. 套装包含的单品
CREATE TABLE IF NOT EXISTS shop_bundle_items (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  bundle_id   INT NOT NULL COMMENT '套装商品 ID',
  product_id  INT NOT NULL COMMENT '单品商品 ID',
  UNIQUE KEY uk_bundle_product (bundle_id, product_id),
  CONSTRAINT fk_bundle FOREIGN KEY (bundle_id) REFERENCES shop_products(id) ON DELETE CASCADE,
  CONSTRAINT fk_bundle_product FOREIGN KEY (product_id) REFERENCES shop_products(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 3. 用户象币钱包
CREATE TABLE IF NOT EXISTS user_wallets (
  user_id      INT PRIMARY KEY,
  balance      INT NOT NULL DEFAULT 0 COMMENT '当前象币余额',
  total_earned INT NOT NULL DEFAULT 0 COMMENT '累计获得象币',
  total_spent  INT NOT NULL DEFAULT 0 COMMENT '累计消费象币',
  updated_at   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_wallet_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 4. 象币流水记录
CREATE TABLE IF NOT EXISTS wallet_transactions (
  id             INT AUTO_INCREMENT PRIMARY KEY,
  user_id        INT NOT NULL,
  type           ENUM('recharge', 'purchase', 'reward', 'refund') NOT NULL,
  amount         INT NOT NULL COMMENT '正数增加，负数扣减',
  balance_after  INT NOT NULL COMMENT '变动后余额',
  reference_type VARCHAR(20) DEFAULT NULL COMMENT '关联类型：product / sign_in / invite / event / register',
  reference_id   INT DEFAULT NULL COMMENT '关联 ID（如商品 ID）',
  description    VARCHAR(100) DEFAULT NULL,
  created_at     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_wallet_tx_user (user_id, created_at),
  CONSTRAINT fk_wallet_tx_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 5. 用户已购商品（仓库）
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

-- 6. 用户当前装扮配置
CREATE TABLE IF NOT EXISTS user_appearance (
  user_id         INT PRIMARY KEY,
  skin_id         INT DEFAULT NULL COMMENT '当前使用的皮肤',
  sticker_pack_id INT DEFAULT NULL COMMENT '当前使用的贴纸包',
  font_id         INT DEFAULT NULL COMMENT '当前使用的字体',
  updated_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_appear_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_appear_skin FOREIGN KEY (skin_id) REFERENCES shop_products(id) ON DELETE SET NULL,
  CONSTRAINT fk_appear_sticker FOREIGN KEY (sticker_pack_id) REFERENCES shop_products(id) ON DELETE SET NULL,
  CONSTRAINT fk_appear_font FOREIGN KEY (font_id) REFERENCES shop_products(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- 种子商品数据（7 套皮肤：1 免费 + 6 付费）
-- ============================================================

-- 免费默认皮肤
INSERT INTO shop_products (type, name, description, price, asset_key, is_free, sort_order)
VALUES ('skin', '简约默认', '经典简约风格', 0, 'default', 1, 0);

-- 付费皮肤
INSERT INTO shop_products (type, name, description, price, asset_key, sort_order) VALUES
('skin', '牛皮纸', '复古牛皮纸纹理 + 暖色调', 20, 'kraft', 1),
('skin', '方格本', '淡蓝方格背景', 15, 'grid', 2),
('skin', '星空', '深蓝渐变 + 星点装饰', 25, 'starry', 3),
('skin', '樱花', '粉色系 + 落樱背景', 25, 'sakura', 4),
('skin', '森林', '莫兰迪绿 + 叶片纹理', 20, 'forest', 5),
('skin', '海洋', '浅蓝渐变 + 波纹', 20, 'ocean', 6);
