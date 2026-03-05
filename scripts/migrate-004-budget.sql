-- P3 预算管理迁移
CREATE TABLE IF NOT EXISTS finance_budgets (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  user_id     INT NOT NULL,
  category_id INT DEFAULT NULL COMMENT 'NULL 表示总预算',
  `year_month` VARCHAR(7) NOT NULL COMMENT '格式: 2026-03',
  amount      DECIMAL(12,2) NOT NULL,
  created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_budgets_user (user_id),
  UNIQUE KEY uk_budgets_user_month_cat (user_id, category_id, `year_month`),
  CONSTRAINT fk_budgets_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_budgets_category FOREIGN KEY (category_id) REFERENCES finance_categories(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
