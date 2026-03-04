-- =====================================================
-- Migration 005: 活动配置表
-- =====================================================

CREATE TABLE IF NOT EXISTS admin_activities (
  id             INT AUTO_INCREMENT PRIMARY KEY,
  title          VARCHAR(100) NOT NULL COMMENT '活动标题',
  type           ENUM('sign_in_bonus', 'holiday_event', 'flash_sale', 'custom') NOT NULL DEFAULT 'custom' COMMENT '活动类型',
  description    TEXT COMMENT '活动描述',
  config         JSON COMMENT '活动配置参数（奖励数量、折扣比例等）',
  starts_at      DATETIME NOT NULL COMMENT '开始时间',
  ends_at        DATETIME NOT NULL COMMENT '结束时间',
  status         ENUM('draft', 'active', 'ended', 'cancelled') NOT NULL DEFAULT 'draft',
  created_by     INT DEFAULT NULL COMMENT '创建者 admin_users.id',
  created_at     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_activity_status (status),
  INDEX idx_activity_dates (starts_at, ends_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
