-- AI 功能数据库迁移
-- 创建 ai_reports 表存储缓存的 AI 报告

CREATE TABLE IF NOT EXISTS ai_reports (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  report_type ENUM('monthly', 'yearly') NOT NULL,
  year INT NOT NULL,
  month INT NOT NULL DEFAULT 0,  -- 月度 1-12，年度 0
  content JSON NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uk_user_report (user_id, report_type, year, month),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_user_type (user_id, report_type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
