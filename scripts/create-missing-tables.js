const mysql = require('mysql2/promise')

async function main() {
  const c = await mysql.createConnection({
    host: 'localhost', port: 3306,
    user: 'root', password: 'root123',
    database: 'elephant_todo'
  })

  await c.query(`CREATE TABLE IF NOT EXISTS finance_categories (
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
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`)
  console.log('✅ finance_categories')

  await c.query(`CREATE TABLE IF NOT EXISTS finance_records (
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
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`)
  console.log('✅ finance_records')

  await c.query(`CREATE TABLE IF NOT EXISTS important_dates (
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
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`)
  console.log('✅ important_dates')

  await c.query(`CREATE TABLE IF NOT EXISTS period_records (
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
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`)
  console.log('✅ period_records')

  const [r] = await c.query('SHOW TABLES')
  console.log('\nAll tables:', r.map(x => Object.values(x)[0]).join(', '))
  await c.end()
}

main().catch(e => { console.error(e); process.exit(1) })
