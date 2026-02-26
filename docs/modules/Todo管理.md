# Todo 管理模块

> 所属项目：Elephant Todo App  
> 最后更新：2026-02-26

---

## 一、功能说明

### 1.1 Todo 管理

| 功能         | 说明                                       |
| ------------ | ------------------------------------------ |
| 创建 Todo    | 标题（必填）、描述（可选）、截止日期、优先级、分类标签 |
| 编辑 Todo    | 修改 Todo 的所有字段                       |
| 删除 Todo    | 支持单条删除                               |
| 完成/恢复    | 切换 Todo 的完成状态                       |
| 优先级       | 高 / 中 / 低 三个等级                      |
| 截止日期     | 可设置截止日期，过期自动标记               |
| 关联随手记   | Todo 列表中显示关联随手记数量角标；Todo 详情页展示所有关联的随手记列表，点击可跳转到随手记详情 |
| 子任务       | Todo 详情页支持添加/编辑/删除/勾选子任务，可排序 |

### 1.2 搜索与筛选

| 功能         | 说明                                       |
| ------------ | ------------------------------------------ |
| 关键词搜索   | 按 Todo 标题/描述模糊搜索                   |
| 按分类筛选   | 查看某一分类下的所有 Todo                  |
| 按标签筛选   | 查看包含某标签的 Todo                      |
| 按优先级筛选 | 筛选指定优先级的 Todo                      |
| 按状态筛选   | 已完成 / 未完成                            |
| 按日期筛选   | 今天、本周、已过期、自定义日期范围         |

---

## 二、API 接口

| 方法   | 路径                    | 说明               | 认证 |
| ------ | ----------------------- | ------------------ | ---- |
| GET    | /api/todos              | 获取 Todo 列表（支持筛选/搜索/分页） | 是 |
| POST   | /api/todos              | 创建 Todo          | 是   |
| GET    | /api/todos/:id          | 获取单个 Todo 详情 | 是   |
| PUT    | /api/todos/:id          | 更新 Todo          | 是   |
| DELETE | /api/todos/:id          | 删除 Todo          | 是   |
| PATCH  | /api/todos/:id/toggle   | 切换完成状态       | 是   |
| GET    | /api/todos/:id/ideas    | 获取 Todo 关联的 Idea 列表 | 是 |
| GET    | /api/todos/:id/subtasks | 获取 Todo 的子任务列表 | 是 |
| POST   | /api/todos/:id/subtasks | 创建子任务         | 是   |
| PUT    | /api/todos/:id/subtasks/:subtaskId | 更新子任务   | 是   |
| PATCH  | /api/todos/:id/subtasks/:subtaskId/toggle | 切换子任务完成状态 | 是 |
| DELETE | /api/todos/:id/subtasks/:subtaskId | 删除子任务   | 是   |

---

## 三、数据库表

### 3.1 待办事项表（todos）

| 字段         | 类型                              | 约束                    | 说明               |
| ------------ | --------------------------------- | ----------------------- | ------------------ |
| id           | INT                               | PRIMARY KEY, AUTO_INCREMENT | 主键，自增     |
| user_id      | INT                               | NOT NULL, FOREIGN KEY   | 外键 → users.id    |
| category_id  | INT                               | FOREIGN KEY, NULL       | 外键 → categories.id（可为空）|
| title        | VARCHAR(200)                      | NOT NULL                | 标题               |
| description  | TEXT                              | NULL                    | 描述（可为空）     |
| priority     | ENUM('high','medium','low')       | NOT NULL, DEFAULT 'medium' | 优先级          |
| status       | ENUM('pending','completed')       | NOT NULL, DEFAULT 'pending' | 状态           |
| due_date     | DATETIME                          | NULL                    | 截止日期（可为空） |
| completed_at | DATETIME                          | NULL                    | 完成时间（可为空） |
| created_at   | DATETIME                          | NOT NULL, DEFAULT NOW() | 创建时间           |
| updated_at   | DATETIME                          | NOT NULL, DEFAULT NOW() ON UPDATE NOW() | 更新时间 |
| embedding    | JSON                              | NULL                    | 语义向量（预留字段） |

**索引**：
- `idx_todos_user_status` — INDEX(user_id, status)
- `idx_todos_user_priority` — INDEX(user_id, priority)
- `idx_todos_user_due_date` — INDEX(user_id, due_date)
- `idx_todos_title` — FULLTEXT(title, description)

**外键**：
- `fk_todos_user` — user_id → users(id) ON DELETE CASCADE
- `fk_todos_category` — category_id → categories(id) ON DELETE SET NULL

### 3.2 子任务表（subtasks）

| 字段       | 类型                          | 约束                    | 说明               |
| ---------- | ----------------------------- | ----------------------- | ------------------ |
| id         | INT                           | PRIMARY KEY, AUTO_INCREMENT | 主键，自增     |
| todo_id    | INT                           | NOT NULL, FOREIGN KEY   | 外键 → todos.id    |
| title      | VARCHAR(200)                  | NOT NULL                | 子任务标题           |
| status     | ENUM('pending','completed')   | NOT NULL, DEFAULT 'pending' | 状态           |
| sort_order | INT                           | NOT NULL, DEFAULT 0     | 排序序号           |
| created_at | DATETIME                      | NOT NULL, DEFAULT NOW() | 创建时间           |
| updated_at | DATETIME                      | NOT NULL, DEFAULT NOW() ON UPDATE NOW() | 更新时间 |

**索引**：
- `idx_subtasks_todo_id` — INDEX(todo_id)

**外键**：
- `fk_subtasks_todo` — todo_id → todos(id) ON DELETE CASCADE

---

## 四、建表 SQL

```sql
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

CREATE TABLE subtasks (
  id         INT                           AUTO_INCREMENT PRIMARY KEY,
  todo_id    INT                           NOT NULL,
  title      VARCHAR(200)                  NOT NULL,
  status     ENUM('pending','completed')   NOT NULL DEFAULT 'pending',
  sort_order INT                           NOT NULL DEFAULT 0,
  created_at DATETIME                      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME                      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_subtasks_todo_id (todo_id),
  CONSTRAINT fk_subtasks_todo FOREIGN KEY (todo_id) REFERENCES todos(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

---

## 五、相关文件

| 类型 | 路径 |
| ---- | ---- |
| API 路由 | `server/api/todos/` |
| Model | `server/utils/models/todo.model.ts` |
| Pinia Store | `stores/todos.ts` |
| 页面 | `pages/index.vue`（Todo 列表）、`pages/todo/[id].vue`（详情） |
