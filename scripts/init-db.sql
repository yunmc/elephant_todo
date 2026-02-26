-- 创建数据库
CREATE DATABASE IF NOT EXISTS elephant_todo
  DEFAULT CHARACTER SET utf8mb4
  DEFAULT COLLATE utf8mb4_unicode_ci;

USE elephant_todo;

-- 用户表
CREATE TABLE users (
  id         INT          AUTO_INCREMENT PRIMARY KEY,
  username   VARCHAR(50)  NOT NULL,
  email      VARCHAR(100) NOT NULL,
  password   VARCHAR(255) NOT NULL,
  vault_salt VARCHAR(50)  DEFAULT NULL,
  created_at DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_users_username (username),
  UNIQUE KEY uk_users_email (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 分类表
CREATE TABLE categories (
  id         INT          AUTO_INCREMENT PRIMARY KEY,
  user_id    INT          NOT NULL,
  name       VARCHAR(50)  NOT NULL,
  color      VARCHAR(20)  DEFAULT '#999999',
  created_at DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uk_categories_user_name (user_id, name),
  KEY idx_categories_user_id (user_id),
  CONSTRAINT fk_categories_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 待办事项表
CREATE TABLE todos (
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

-- 标签表
CREATE TABLE tags (
  id         INT          AUTO_INCREMENT PRIMARY KEY,
  user_id    INT          NOT NULL,
  name       VARCHAR(50)  NOT NULL,
  created_at DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uk_tags_user_name (user_id, name),
  KEY idx_tags_user_id (user_id),
  CONSTRAINT fk_tags_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 随手记表
CREATE TABLE ideas (
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

-- Todo-标签关联表
CREATE TABLE todo_tags (
  todo_id INT NOT NULL,
  tag_id  INT NOT NULL,
  PRIMARY KEY (todo_id, tag_id),
  KEY idx_todo_tags_tag_id (tag_id),
  CONSTRAINT fk_todo_tags_todo FOREIGN KEY (todo_id) REFERENCES todos(id) ON DELETE CASCADE,
  CONSTRAINT fk_todo_tags_tag FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 子任务表
CREATE TABLE subtasks (
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

-- 密码分组表
CREATE TABLE vault_groups (

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

-- 密码记录表
CREATE TABLE vault_entries (
  id                 INT           AUTO_INCREMENT PRIMARY KEY,
  user_id            INT           NOT NULL,
  group_id           INT           DEFAULT NULL,
  name               VARCHAR(200)  NOT NULL,
  url                VARCHAR(500)  DEFAULT NULL,
  encrypted_data     TEXT          NOT NULL COMMENT 'IV嵌入在加密数据中(前12字节)',
  created_at         DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at         DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_vault_entries_user_id (user_id),
  KEY idx_vault_entries_group_id (group_id),
  KEY idx_vault_entries_user_name (user_id, name),
  CONSTRAINT fk_vault_entries_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_vault_entries_group FOREIGN KEY (group_id) REFERENCES vault_groups(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 密码重置令牌表
CREATE TABLE password_reset_tokens (
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

-- 记账分类表
CREATE TABLE finance_categories (
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

-- 记账记录表
CREATE TABLE finance_records (
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

-- ==================== 重要日期模块 ====================

-- 重要日期表
CREATE TABLE important_dates (
  id                 INT          AUTO_INCREMENT PRIMARY KEY,
  user_id            INT          NOT NULL,
  title              VARCHAR(200) NOT NULL,
  date               DATE         NOT NULL,
  is_lunar           BOOLEAN      NOT NULL DEFAULT FALSE,
  repeat_yearly      BOOLEAN      NOT NULL DEFAULT TRUE,
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

-- 经期记录表
CREATE TABLE period_records (
  id            INT          AUTO_INCREMENT PRIMARY KEY,
  user_id       INT          NOT NULL,
  start_date    DATE         NOT NULL,
  end_date      DATE         DEFAULT NULL,
  cycle_length  INT          DEFAULT NULL COMMENT '本次周期长度（天）',
  period_length INT          DEFAULT NULL COMMENT '经期持续天数',
  flow_level    ENUM('light','moderate','heavy') DEFAULT 'moderate',
  symptoms      JSON         DEFAULT NULL COMMENT '症状记录',
  mood          VARCHAR(50)  DEFAULT NULL,
  note          TEXT         DEFAULT NULL,
  created_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_period_records_user_id (user_id),
  KEY idx_period_records_user_date (user_id, start_date),
  CONSTRAINT fk_period_records_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
