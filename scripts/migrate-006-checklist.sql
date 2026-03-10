-- ============================================================
-- migrate-006-checklist.sql — 每日打卡模块
-- ============================================================

-- 26. 习惯项表
CREATE TABLE IF NOT EXISTS checklist_items (
  id         INT          AUTO_INCREMENT PRIMARY KEY,
  user_id    INT          NOT NULL,
  title      VARCHAR(100) NOT NULL,
  icon       VARCHAR(20)  DEFAULT '✅',
  sort_order INT          NOT NULL DEFAULT 0,
  is_active  TINYINT(1)   NOT NULL DEFAULT 1 COMMENT '1=启用 0=暂停',
  created_at DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_checklist_items_user (user_id, is_active, sort_order),
  CONSTRAINT fk_checklist_items_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 27. 打卡记录表
CREATE TABLE IF NOT EXISTS checklist_records (
  id         INT      AUTO_INCREMENT PRIMARY KEY,
  item_id    INT      NOT NULL,
  user_id    INT      NOT NULL,
  check_date DATE     NOT NULL,
  checked_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_checklist_records_item_date (item_id, check_date),
  KEY idx_checklist_records_user_date (user_id, check_date),
  KEY idx_checklist_records_item_date (item_id, check_date),
  CONSTRAINT fk_checklist_records_item FOREIGN KEY (item_id) REFERENCES checklist_items(id) ON DELETE CASCADE,
  CONSTRAINT fk_checklist_records_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
