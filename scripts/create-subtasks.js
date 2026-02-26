const mysql = require('mysql2/promise');

(async () => {
  const conn = await mysql.createConnection({
    host: 'localhost',
    port: 3306,
    user: 'root',
    password: 'root123',
    database: 'elephant_todo',
  });

  await conn.execute(`
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
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  console.log('subtasks table created');
  await conn.end();
})();
