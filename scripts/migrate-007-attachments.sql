-- migrate-007-attachments.sql
-- 附件表（OSS 存储）

CREATE TABLE IF NOT EXISTS attachments (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  user_id     INT NOT NULL,
  target_type ENUM('finance_record', 'idea', 'todo') NOT NULL,
  target_id   INT NOT NULL,
  filename    VARCHAR(255) NOT NULL,
  oss_key     VARCHAR(500) NOT NULL COMMENT 'OSS 对象 key',
  url         VARCHAR(500) NOT NULL COMMENT '公网访问 URL',
  file_size   INT NOT NULL COMMENT '文件大小（字节）',
  mime_type   VARCHAR(50) NOT NULL,
  sort_order  INT NOT NULL DEFAULT 0,
  created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_attachments_user (user_id),
  KEY idx_attachments_target (target_type, target_id),
  CONSTRAINT fk_attachments_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

SELECT 'migrate-007-attachments.sql executed successfully' AS result;
