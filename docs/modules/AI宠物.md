# P2.5 AI 宠物：小象 — 设计文档

> 所属项目：Elephant Todo App  
> 优先级：P2.5  
> 前置依赖：P1 手帐商店一期（象币钱包 + 商店 + 皮肤）、P2 AI 功能（共享 LLM 工具）  
> 预估时间：26-34 小时（约 4.5 天）  
> 日期：2026-03-05  
> 原始设计：`docs/付费功能方案.md` 第九章

---

## 一、功能概述

用户拥有一只 AI 小象宠物，通过**象币喂食获得体力**，**消耗体力使用各种 AI 能力**。宠物皮肤可在商店购买。

| 项目 | 说明 |
|------|------|
| 目标 | AI 宠物陪伴 + 象币消耗闭环 + 提升用户留存 |
| 包含 | 宠物状态管理、体力系统、AI 聊天、智能提醒、每日一言、情绪互动、宠物皮肤 |
| 不包含 | 宠物进化/升级、配饰系统、多宠物（均为未来迭代） |
| 与 Premium 关系 | **不依赖 Premium 订阅**。所有用户均可养宠物，AI 能力由象币喂食（体力）驱动 |
| 与手帐商店关系 | 复用象币钱包扣费 + 商品体系（`type = 'pet_skin'`） + 仓库切换皮肤 |
| 与 AI 功能关系 | 复用 `callLLM()` 双供应商策略（优先 DeepSeek 降低成本） |

### 功能清单

| 功能 | 说明 | 体力消耗 |
|------|------|----------|
| **AI 聊天陪伴** | 跟小象自由对话，有独特性格（可设：软萌/毒舌/鼓励型） | -5/轮 |
| **智能提醒** | "今天还有 3 个待办没完～" "这个月花得有点多了呢" | -3/次 |
| **每日一言** | 每天一句不同的话（鸡汤/冷知识/小建议） | **免费** |
| **情绪互动** | 根据用户行为变化表情（完成待办→开心、超支→心疼、签到→撒欢） | **免费** |
| **宠物皮肤** | 商店购买不同外观，仓库自由切换 | — |

---

## 二、核心机制设计

### 2.1 体力值系统

体力是 AI 能力的唯一消耗资源，通过象币喂食获取。

| 项目 | 说明 |
|------|------|
| 体力上限 | 100 点 |
| 每日自然恢复 | 0（不自动恢复，必须喂食） |
| 喂食恢复 | 每次喂食 +20 体力 |
| 喂食价格 | 5 象币/次 |
| AI 聊天消耗 | 每轮对话 -5 体力 |
| 智能提醒消耗 | 每次 -3 体力 |
| 每日一言 | 免费，不消耗体力 |
| 情绪互动 | 免费，不消耗体力 |
| 体力为 0 时 | 小象显示"饿了"状态，AI 聊天/提醒不可用，只有表情互动和每日一言 |

> **商业闭环**：象币由用户充值获取 → 喂食消耗象币 → 获得体力 → 使用 AI 能力。AI 调用成本被象币消费自然覆盖。

### 2.2 情绪系统

心情根据用户行为**事件触发**自动变化：

| 触发事件 | 心情 | 说明 |
|----------|------|------|
| 完成待办 | `happy` | 开心蹦跳 |
| 记账超支 / 超预算 | `sad` | 心疼表情 |
| 签到（每日登录） | `excited` | 撒欢动画 |
| 体力为 0 | `hungry` | 饿了状态，耷拉脑袋 |
| 连续 3 天没打开 | `sad` | 想念主人 |
| 默认 | `normal` | 正常摇尾巴 |

心情枚举：`happy` / `normal` / `hungry` / `excited` / `sad`

### 2.3 小象性格

用户可在设置中选择小象性格，影响 AI 回复风格：

| 性格 | 枚举值 | Prompt 风格 | 示例 |
|------|--------|------------|------|
| 🥰 软萌 | `cute` | 温柔可爱，爱用颜文字 | "主人今天辛苦啦～(◕ᴗ◕✿) 还有 2 个待办要做哦" |
| 😈 毒舌 | `sarcastic` | 吐槽但关心，傲娇 | "哼，又超支了？你的钱包在哭泣你知道吗" |
| 💪 鼓励 | `encouraging` | 积极正能量，教练型 | "今天完成了 5 个待办！你简直是效率之王！" |

### 2.4 宠物皮肤（商店商品）

复用商店体系，`type = 'pet_skin'`。

| 名称 | 风格 | 参考价格 |
|------|------|----------|
| 默认小象 | 灰色经典小象 | 免费自带 |
| 粉色甜心象 | 粉色系、蝴蝶结 | 30 象币 |
| 太空象 | 宇航服、星空背景 | 35 象币 |
| 武士象 | 盔甲、小剑 | 35 象币 |
| 圣诞象 | 圣诞帽、围巾 | 25 象币（限定） |
| 花园象 | 头顶花环、花丛 | 30 象币 |
| 海盗象 | 眼罩、海盗帽 | 35 象币 |

皮肤购买/切换流程复用商店 + 仓库体系，仅通过 `skin_id` 关联已拥有的 `shop_products`。

---

## 三、数据库变更

### 3.1 新建表

#### `user_pets` — 用户宠物（一人一宠）

```sql
CREATE TABLE user_pets (
  user_id       INT PRIMARY KEY,
  name          VARCHAR(20) NOT NULL DEFAULT '小象' COMMENT '宠物昵称',
  personality   ENUM('cute', 'sarcastic', 'encouraging') NOT NULL DEFAULT 'cute',
  skin_id       INT DEFAULT NULL COMMENT '当前皮肤（商品 ID）',
  stamina       INT NOT NULL DEFAULT 20 COMMENT '当前体力值',
  max_stamina   INT NOT NULL DEFAULT 100,
  mood          ENUM('happy', 'normal', 'hungry', 'excited', 'sad') NOT NULL DEFAULT 'normal',
  total_chats   INT NOT NULL DEFAULT 0 COMMENT '累计聊天数',
  created_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_pet_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_pet_skin FOREIGN KEY (skin_id) REFERENCES shop_products(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

> **设计决策**：`user_id` 做 PRIMARY KEY 而非单独 `id`，因为一人一宠，不需要额外主键。

#### `pet_chat_history` — 宠物聊天记录

```sql
CREATE TABLE pet_chat_history (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  user_id     INT NOT NULL,
  role        ENUM('user', 'pet') NOT NULL,
  content     TEXT NOT NULL,
  stamina_cost INT NOT NULL DEFAULT 0,
  created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_pet_chat_user (user_id, created_at),
  CONSTRAINT fk_pet_chat_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

> 保留最近 50 条作为 LLM 上下文窗口。超出部分可定期清理或归档。

#### `pet_feed_log` — 喂食记录

```sql
CREATE TABLE pet_feed_log (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  user_id     INT NOT NULL,
  cost        INT NOT NULL COMMENT '消耗象币',
  stamina_gained INT NOT NULL COMMENT '恢复体力',
  created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_feed_user (user_id, created_at),
  CONSTRAINT fk_feed_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

### 3.2 迁移脚本

文件：`scripts/migrate-006-ai-pet.sql`

```sql
-- P2.5 AI 宠物：小象
-- 前置：users 表、shop_products 表已存在

-- 用户宠物
CREATE TABLE IF NOT EXISTS user_pets (
  user_id       INT PRIMARY KEY,
  name          VARCHAR(20) NOT NULL DEFAULT '小象' COMMENT '宠物昵称',
  personality   ENUM('cute', 'sarcastic', 'encouraging') NOT NULL DEFAULT 'cute',
  skin_id       INT DEFAULT NULL COMMENT '当前皮肤（商品 ID）',
  stamina       INT NOT NULL DEFAULT 20 COMMENT '当前体力值',
  max_stamina   INT NOT NULL DEFAULT 100,
  mood          ENUM('happy', 'normal', 'hungry', 'excited', 'sad') NOT NULL DEFAULT 'normal',
  total_chats   INT NOT NULL DEFAULT 0 COMMENT '累计聊天数',
  created_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_pet_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_pet_skin FOREIGN KEY (skin_id) REFERENCES shop_products(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 宠物聊天记录
CREATE TABLE IF NOT EXISTS pet_chat_history (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  user_id     INT NOT NULL,
  role        ENUM('user', 'pet') NOT NULL,
  content     TEXT NOT NULL,
  stamina_cost INT NOT NULL DEFAULT 0,
  created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_pet_chat_user (user_id, created_at),
  CONSTRAINT fk_pet_chat_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 喂食记录
CREATE TABLE IF NOT EXISTS pet_feed_log (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  user_id     INT NOT NULL,
  cost        INT NOT NULL COMMENT '消耗象币',
  stamina_gained INT NOT NULL COMMENT '恢复体力',
  created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_feed_user (user_id, created_at),
  CONSTRAINT fk_feed_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

---

## 四、类型定义

### 4.1 前端类型 (`types/index.ts`)

```typescript
// ==================== AI 宠物 ====================

export type PetPersonality = 'cute' | 'sarcastic' | 'encouraging'
export type PetMood = 'happy' | 'normal' | 'hungry' | 'excited' | 'sad'

export interface Pet {
  user_id: number
  name: string
  personality: PetPersonality
  skin_id: number | null
  stamina: number
  max_stamina: number
  mood: PetMood
  total_chats: number
  created_at: string
  updated_at: string
}

export interface PetChatMessage {
  id: number
  role: 'user' | 'pet'
  content: string
  stamina_cost: number
  created_at: string
}

export interface PetFeedResult {
  stamina: number
  max_stamina: number
  mood: PetMood
  cost: number
  wallet_balance: number
}

export interface PetChatResult {
  reply: string
  stamina: number
}

export interface PetReminderResult {
  content: string
  stamina: number
}

export interface PetDailyQuote {
  quote: string
  date: string
}
```

### 4.2 后端类型 (`server/types/index.ts`)

```typescript
export interface PetRow extends RowDataPacket {
  user_id: number
  name: string
  personality: 'cute' | 'sarcastic' | 'encouraging'
  skin_id: number | null
  stamina: number
  max_stamina: number
  mood: 'happy' | 'normal' | 'hungry' | 'excited' | 'sad'
  total_chats: number
  created_at: Date
  updated_at: Date
}

export interface PetChatRow extends RowDataPacket {
  id: number
  user_id: number
  role: 'user' | 'pet'
  content: string
  stamina_cost: number
  created_at: Date
}

export interface PetFeedLogRow extends RowDataPacket {
  id: number
  user_id: number
  cost: number
  stamina_gained: number
  created_at: Date
}
```

---

## 五、后端实现

### 5.1 API 接口表

| 方法 | 路径 | 说明 | 认证 |
|------|------|------|------|
| **宠物** | | | |
| GET | `/api/pet` | 获取宠物状态（体力/心情/皮肤/性格） | 是 |
| PUT | `/api/pet/settings` | 修改昵称/性格 | 是 |
| PUT | `/api/pet/skin` | 切换皮肤（需已拥有） | 是 |
| POST | `/api/pet/feed` | 喂食（扣象币 + 恢复体力） | 是 |
| **AI 聊天** | | | |
| POST | `/api/pet/chat` | 发送消息（扣体力，返回 AI 回复） | 是 |
| GET | `/api/pet/chat/history` | 聊天记录（分页） | 是 |
| **智能提醒** | | | |
| GET | `/api/pet/reminder` | 获取智能提醒内容（扣体力） | 是 |
| **每日一言** | | | |
| GET | `/api/pet/daily-quote` | 今日一言（免费，每日缓存） | 是 |

### 5.2 Model：`server/utils/models/pet.model.ts`

```typescript
import { db } from '~/server/utils/db'
import type { PetRow, PetChatRow, PetFeedLogRow } from '~/server/types'

export const PetModel = {
  // 获取宠物（每个用户只有一只）
  async findByUser(userId: number): Promise<PetRow | null> {
    const [rows] = await db.execute<PetRow[]>(
      'SELECT * FROM user_pets WHERE user_id = ?', [userId]
    )
    return rows[0] || null
  },

  // 初始化宠物（注册时或首次访问宠物页时）
  async create(userId: number, name = '小象'): Promise<void> {
    await db.execute(
      'INSERT IGNORE INTO user_pets (user_id, name) VALUES (?, ?)',
      [userId, name]
    )
  },

  // 更新昵称/性格
  async updateSettings(userId: number, name: string, personality: string): Promise<void> {
    await db.execute(
      'UPDATE user_pets SET name = ?, personality = ? WHERE user_id = ?',
      [name, personality, userId]
    )
  },

  // 切换皮肤
  async updateSkin(userId: number, skinId: number | null): Promise<void> {
    await db.execute(
      'UPDATE user_pets SET skin_id = ? WHERE user_id = ?',
      [skinId, userId]
    )
  },

  // 扣体力
  async consumeStamina(userId: number, cost: number): Promise<number> {
    const [result] = await db.execute<any>(
      'UPDATE user_pets SET stamina = stamina - ?, updated_at = NOW() WHERE user_id = ? AND stamina >= ?',
      [cost, userId, cost]
    )
    if (result.affectedRows === 0) {
      throw createError({ statusCode: 400, message: '小象饿了，先喂食吧～🍎' })
    }
    const pet = await this.findByUser(userId)
    return pet!.stamina
  },

  // 更新心情
  async updateMood(userId: number, mood: string): Promise<void> {
    await db.execute(
      'UPDATE user_pets SET mood = ? WHERE user_id = ?',
      [mood, userId]
    )
    // 如果体力为 0，强制 hungry
    await db.execute(
      'UPDATE user_pets SET mood = "hungry" WHERE user_id = ? AND stamina <= 0',
      [userId]
    )
  },

  // 累加聊天计数
  async incrementChats(userId: number): Promise<void> {
    await db.execute(
      'UPDATE user_pets SET total_chats = total_chats + 1, updated_at = NOW() WHERE user_id = ?',
      [userId]
    )
  },
}

export const PetChatModel = {
  // 获取最近 N 条聊天记录
  async getRecent(userId: number, limit = 20): Promise<PetChatRow[]> {
    const [rows] = await db.execute<PetChatRow[]>(
      'SELECT * FROM pet_chat_history WHERE user_id = ? ORDER BY created_at DESC LIMIT ?',
      [userId, limit]
    )
    return rows.reverse() // 按时间正序返回
  },

  // 保存聊天记录
  async save(userId: number, role: 'user' | 'pet', content: string, staminaCost = 0): Promise<void> {
    await db.execute(
      'INSERT INTO pet_chat_history (user_id, role, content, stamina_cost) VALUES (?, ?, ?, ?)',
      [userId, role, content, staminaCost]
    )
  },

  // 分页查询历史
  async getHistory(userId: number, page: number, limit = 20): Promise<PetChatRow[]> {
    const offset = (page - 1) * limit
    const [rows] = await db.execute<PetChatRow[]>(
      'SELECT * FROM pet_chat_history WHERE user_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?',
      [userId, limit, offset]
    )
    return rows.reverse()
  },

  // 清理超出 50 条的旧记录
  async cleanup(userId: number): Promise<void> {
    await db.execute(
      `DELETE FROM pet_chat_history WHERE user_id = ? AND id NOT IN (
        SELECT id FROM (SELECT id FROM pet_chat_history WHERE user_id = ? ORDER BY created_at DESC LIMIT 50) t
      )`,
      [userId, userId]
    )
  },
}

export const PetFeedModel = {
  async log(userId: number, cost: number, staminaGained: number): Promise<void> {
    await db.execute(
      'INSERT INTO pet_feed_log (user_id, cost, stamina_gained) VALUES (?, ?, ?)',
      [userId, cost, staminaGained]
    )
  },
}
```

### 5.3 喂食：`server/api/pet/feed.post.ts`

```typescript
export default defineEventHandler(async (event) => {
  const userId = requireAuth(event)

  const FEED_COST = 5          // 象币/次
  const STAMINA_GAIN = 20      // 恢复体力

  const pet = await PetModel.findByUser(userId)
  if (!pet) throw createError({ statusCode: 404, message: '请先领养你的小象' })

  if (pet.stamina >= pet.max_stamina) {
    throw createError({ statusCode: 400, message: '小象已经吃饱啦～' })
  }

  // 事务：扣象币 + 恢复体力 + 记录
  const connection = await db.getConnection()
  try {
    await connection.beginTransaction()

    // 1. 扣象币
    const [walletResult] = await connection.execute<any>(
      'UPDATE user_wallets SET balance = balance - ?, total_spent = total_spent + ? WHERE user_id = ? AND balance >= ?',
      [FEED_COST, FEED_COST, userId, FEED_COST]
    )
    if (walletResult.affectedRows === 0) {
      throw createError({ statusCode: 400, message: '象币不足，快去充值吧～' })
    }

    // 2. 恢复体力（不超上限）
    await connection.execute(
      'UPDATE user_pets SET stamina = LEAST(stamina + ?, max_stamina), mood = "happy", updated_at = NOW() WHERE user_id = ?',
      [STAMINA_GAIN, userId]
    )

    // 3. 象币流水
    const [walletRows] = await connection.execute<any[]>(
      'SELECT balance FROM user_wallets WHERE user_id = ?', [userId]
    )
    await connection.execute(
      'INSERT INTO wallet_transactions (user_id, type, amount, balance_after, reference_type, description) VALUES (?, "purchase", ?, ?, "pet_feed", "喂食小象")',
      [userId, -FEED_COST, walletRows[0].balance]
    )

    // 4. 喂食日志
    await connection.execute(
      'INSERT INTO pet_feed_log (user_id, cost, stamina_gained) VALUES (?, ?, ?)',
      [userId, FEED_COST, STAMINA_GAIN]
    )

    await connection.commit()
  } catch (err) {
    await connection.rollback()
    throw err
  } finally {
    connection.release()
  }

  // 返回最新状态
  const updatedPet = await PetModel.findByUser(userId)
  const [walletRows] = await db.execute<any[]>(
    'SELECT balance FROM user_wallets WHERE user_id = ?', [userId]
  )

  return {
    stamina: updatedPet!.stamina,
    max_stamina: updatedPet!.max_stamina,
    mood: updatedPet!.mood,
    cost: FEED_COST,
    wallet_balance: walletRows[0].balance,
  }
})
```

### 5.4 AI 聊天：`server/api/pet/chat.post.ts`

```typescript
export default defineEventHandler(async (event) => {
  const userId = requireAuth(event)
  rateLimitByUser(userId, 'pet-chat', 50, 24 * 60 * 60 * 1000) // 每日 50 次上限

  const STAMINA_COST = 5

  const { message } = await readBody(event)
  if (!message || typeof message !== 'string' || message.length > 500) {
    throw createError({ statusCode: 400, message: '消息不能为空且不超过500字' })
  }

  // 1. 检查体力
  const pet = await PetModel.findByUser(userId)
  if (!pet) throw createError({ statusCode: 404, message: '请先领养你的小象' })
  if (pet.stamina < STAMINA_COST) {
    throw createError({ statusCode: 400, message: '小象饿了，先喂食吧～🍎' })
  }

  // 2. 扣体力 + 累加聊天数
  const remainingStamina = await PetModel.consumeStamina(userId, STAMINA_COST)
  await PetModel.incrementChats(userId)

  // 3. 获取最近聊天记录作为上下文
  const history = await PetChatModel.getRecent(userId, 20)

  // 4. 构建 Prompt
  const personalityPrompts: Record<string, string> = {
    cute: '你是一只名叫{name}的可爱小象，性格软萌温柔，说话喜欢用颜文字和语气词。',
    sarcastic: '你是一只名叫{name}的傲娇小象，说话喜欢吐槽但内心关心主人，偶尔傲娇。',
    encouraging: '你是一只名叫{name}的元气小象，性格阳光积极，总是鼓励和夸奖主人。',
  }

  const systemPrompt = personalityPrompts[pet.personality].replace('{name}', pet.name)
    + '\n你是 Elephant App 的 AI 宠物助手。回复简短亲切（50字以内），可以适当使用 emoji。'

  // 5. 调用 DeepSeek（成本更低）
  const result = await callLLM({
    systemPrompt,
    userMessage: message,
    maxTokens: 150,
    preferModel: 'deepseek',
  })

  // 6. 保存聊天记录（用户消息 + 宠物回复）
  await PetChatModel.save(userId, 'user', message, 0)
  await PetChatModel.save(userId, 'pet', result.content, STAMINA_COST)

  // 7. 更新心情
  await PetModel.updateMood(userId, 'happy')

  return {
    reply: result.content,
    stamina: remainingStamina,
  }
})
```

> **注意**：`callLLM` 的 `systemPrompt` / `userMessage` 参数签名与现有 `server/utils/llm.ts` 的 `LLMOptions` 接口一致。历史记录暂不传入 `callLLM`（DeepSeek 短对话模式），后续可通过拼接 `userMessage` 携带上下文。

### 5.5 智能提醒：`server/api/pet/reminder.get.ts`

```typescript
export default defineEventHandler(async (event) => {
  const userId = requireAuth(event)

  const STAMINA_COST = 3

  const pet = await PetModel.findByUser(userId)
  if (!pet) throw createError({ statusCode: 404, message: '请先领养你的小象' })
  if (pet.stamina < STAMINA_COST) {
    throw createError({ statusCode: 400, message: '小象饿了，先喂食吧～🍎' })
  }

  // 扣体力
  const remainingStamina = await PetModel.consumeStamina(userId, STAMINA_COST)

  // 聚合用户数据
  const { todos, finance, dates } = await aggregateUserData(userId)

  const personalityHints: Record<string, string> = {
    cute: '用软萌可爱的语气',
    sarcastic: '用傲娇吐槽的语气',
    encouraging: '用积极鼓励的语气',
  }

  const systemPrompt = `你是一只叫"${pet.name}"的小象宠物，${personalityHints[pet.personality]}，根据以下数据给主人一条简短提醒（50字以内），可以用 emoji。`

  const userMessage = [
    todos.pending > 0 ? `待办：${todos.pending}个未完成，${todos.overdue}个已过期` : '待办都完成了',
    `本月支出 ¥${finance.monthlySpent}`,
    finance.budgetExceeded ? '已超预算！' : '',
    dates.upcoming.length > 0 ? `近期重要日期：${dates.upcoming.join('、')}` : '',
  ].filter(Boolean).join('；')

  const result = await callLLM({
    systemPrompt,
    userMessage,
    maxTokens: 100,
    preferModel: 'deepseek',
  })

  return {
    content: result.content,
    stamina: remainingStamina,
  }
})
```

### 5.6 每日一言：`server/api/pet/daily-quote.get.ts`

```typescript
// 每日缓存，同一天同一用户返回相同内容
const quoteCache = new Map<string, { quote: string; date: string }>()

export default defineEventHandler(async (event) => {
  const userId = requireAuth(event)

  const today = new Date().toISOString().slice(0, 10) // YYYY-MM-DD
  const cacheKey = `${userId}:${today}`

  // 命中缓存直接返回
  if (quoteCache.has(cacheKey)) {
    return quoteCache.get(cacheKey)!
  }

  const pet = await PetModel.findByUser(userId)
  if (!pet) throw createError({ statusCode: 404, message: '请先领养你的小象' })

  const personalityHints: Record<string, string> = {
    cute: '用软萌可爱的语气',
    sarcastic: '用傲娇毒舌的语气',
    encouraging: '用积极鼓励的语气',
  }

  const result = await callLLM({
    systemPrompt: `你是小象"${pet.name}"，${personalityHints[pet.personality]}给主人说一句今日寄语（20-30字），可以是鸡汤/冷知识/小建议，用 emoji 点缀。`,
    userMessage: `今天是 ${today}`,
    maxTokens: 80,
    preferModel: 'deepseek',
  })

  const response = { quote: result.content, date: today }
  quoteCache.set(cacheKey, response)

  return response
})
```

### 5.7 数据聚合工具：`server/utils/pet-data.ts`

```typescript
/**
 * 聚合用户数据供智能提醒使用
 */
export async function aggregateUserData(userId: number) {
  const today = new Date().toISOString().slice(0, 10)
  const monthStart = today.slice(0, 7) + '-01'

  // 待办统计
  const [todoRows] = await db.execute<any[]>(
    `SELECT
      SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending,
      SUM(CASE WHEN status = 'pending' AND due_date < ? THEN 1 ELSE 0 END) as overdue
    FROM todos WHERE user_id = ?`,
    [today, userId]
  )

  // 本月支出
  const [financeRows] = await db.execute<any[]>(
    `SELECT COALESCE(SUM(amount), 0) as monthly_spent
    FROM finance_records
    WHERE user_id = ? AND type = 'expense' AND date >= ?`,
    [userId, monthStart]
  )

  // 近期重要日期（7天内）
  const [dateRows] = await db.execute<any[]>(
    `SELECT title FROM important_dates
    WHERE user_id = ? AND date BETWEEN ? AND DATE_ADD(?, INTERVAL 7 DAY)`,
    [userId, today, today]
  )

  return {
    todos: {
      pending: todoRows[0]?.pending || 0,
      overdue: todoRows[0]?.overdue || 0,
    },
    finance: {
      monthlySpent: financeRows[0]?.monthly_spent || 0,
      budgetExceeded: false, // TODO: 接入预算模块判定
    },
    dates: {
      upcoming: dateRows.map((r: any) => r.title),
    },
  }
}
```

### 5.8 情绪触发：`server/utils/pet-mood.ts`

```typescript
import { PetModel } from '~/server/utils/models/pet.model'

// 心情触发映射
const MOOD_TRIGGERS: Record<string, 'happy' | 'normal' | 'hungry' | 'excited' | 'sad'> = {
  todo_completed: 'happy',
  budget_exceeded: 'sad',
  sign_in: 'excited',
  stamina_zero: 'hungry',
  inactive_3days: 'sad',
}

/**
 * 根据事件更新宠物心情（fire-and-forget，不影响主业务）
 */
export async function triggerPetMood(userId: number, eventName: string): Promise<void> {
  try {
    const mood = MOOD_TRIGGERS[eventName]
    if (!mood) return

    const pet = await PetModel.findByUser(userId)
    if (!pet) return

    await PetModel.updateMood(userId, mood)
  } catch {
    // 静默失败，不影响主业务
  }
}
```

---

## 六、状态管理

### 6.1 Pinia Store：`stores/pet.ts`

```typescript
import { defineStore } from 'pinia'
import type { Pet, PetMood, PetPersonality, PetChatMessage, PetChatResult, PetFeedResult, PetDailyQuote } from '~/types'

export const usePetStore = defineStore('pet', () => {
  const api = useApi()

  // State
  const pet = ref<Pet | null>(null)
  const chatHistory = ref<PetChatMessage[]>([])
  const dailyQuote = ref<PetDailyQuote | null>(null)
  const reminder = ref<string>('')
  const loading = ref(false)
  const chatLoading = ref(false)

  // Getters
  const hasPet = computed(() => !!pet.value)
  const isHungry = computed(() => (pet.value?.stamina ?? 0) <= 0)
  const canChat = computed(() => (pet.value?.stamina ?? 0) >= 5)
  const canRemind = computed(() => (pet.value?.stamina ?? 0) >= 3)

  // Actions
  async function fetchPet() {
    loading.value = true
    try {
      pet.value = await api.get<Pet>('/api/pet')
    } finally {
      loading.value = false
    }
  }

  async function updateSettings(name: string, personality: PetPersonality) {
    await api.put('/api/pet/settings', { name, personality })
    if (pet.value) {
      pet.value.name = name
      pet.value.personality = personality
    }
  }

  async function updateSkin(skinId: number | null) {
    await api.put('/api/pet/skin', { skin_id: skinId })
    if (pet.value) {
      pet.value.skin_id = skinId
    }
  }

  async function feed(): Promise<PetFeedResult> {
    const result = await api.post<PetFeedResult>('/api/pet/feed')
    if (pet.value) {
      pet.value.stamina = result.stamina
      pet.value.mood = result.mood
    }
    return result
  }

  async function chat(message: string): Promise<PetChatResult> {
    chatLoading.value = true
    try {
      const result = await api.post<PetChatResult>('/api/pet/chat', { message })

      // 乐观追加到聊天记录
      chatHistory.value.push(
        { id: Date.now(), role: 'user', content: message, stamina_cost: 0, created_at: new Date().toISOString() },
        { id: Date.now() + 1, role: 'pet', content: result.reply, stamina_cost: 5, created_at: new Date().toISOString() },
      )

      if (pet.value) {
        pet.value.stamina = result.stamina
        pet.value.total_chats++
        pet.value.mood = 'happy'
      }

      return result
    } finally {
      chatLoading.value = false
    }
  }

  async function fetchChatHistory(page = 1) {
    const data = await api.get<PetChatMessage[]>(`/api/pet/chat/history?page=${page}`)
    if (page === 1) {
      chatHistory.value = data
    } else {
      chatHistory.value = [...data, ...chatHistory.value]
    }
  }

  async function fetchReminder(): Promise<string> {
    const data = await api.get<{ content: string; stamina: number }>('/api/pet/reminder')
    reminder.value = data.content
    if (pet.value) pet.value.stamina = data.stamina
    return data.content
  }

  async function fetchDailyQuote() {
    dailyQuote.value = await api.get<PetDailyQuote>('/api/pet/daily-quote')
  }

  return {
    pet, chatHistory, dailyQuote, reminder, loading, chatLoading,
    hasPet, isHungry, canChat, canRemind,
    fetchPet, updateSettings, updateSkin, feed, chat,
    fetchChatHistory, fetchReminder, fetchDailyQuote,
  }
})
```

---

## 七、前端 UI / 交互

### 7.1 页面结构

```
pages/
  pet/
    index.vue        -- 宠物主页
    chat.vue         -- 聊天界面
components/
  PetAvatar.vue      -- 宠物形象 + 皮肤 + 表情渲染
```

### 7.2 宠物主页（可嵌入首页或独立 Tab）

```
┌──────────────────────────────────┐
│              🐘                   │
│          ╭──────╮                │
│         │  ^  ^  │  ← 当前皮肤   │
│         │  (◕ᴗ◕) │  ← 当前心情   │
│         │  /||\  │               │
│          ╰──────╯                │
│         「小象」                   │
│                                  │
│  ⚡ 体力 ████████░░ 80/100      │
│                                  │
│  💬 "主人早上好～今天也要加油哦！" │
│                                  │
│  ┌──────┐ ┌──────┐ ┌──────┐     │
│  │ 🍎   │ │ 💬   │ │ 👔   │     │
│  │喂食  │ │聊天  │ │换装  │     │
│  │5象币 │ │-5体力│ │      │     │
│  └──────┘ └──────┘ └──────┘     │
│                                  │
│  📋 今日提醒            -3体力   │
│  ┌──────────────────────────────┐│
│  │ 还有 3 个待办没完成哦～      ││
│  │ 这个月已花 ¥2,340，注意预算  ││
│  └──────────────────────────────┘│
└──────────────────────────────────┘
```

### 7.3 聊天界面

```
┌──────────────────────────────────┐
│ 💬 和小象聊天      ⚡ 65/100     │
├──────────────────────────────────┤
│                                  │
│              🐘 主人早上好！      │
│              今天想聊什么呀～     │
│                                  │
│  最近工作好累 😮‍💨               │
│                                  │
│              🐘 辛苦啦～(◕ᴗ◕✿)  │
│              累了就休息一下嘛     │
│              明天又是新的一天！   │
│                                  │
│  ┌─────────────────────┐ [发送]  │
│  │ 输入消息...          │        │
│  └─────────────────────┘        │
│  每次对话消耗 5 体力              │
└──────────────────────────────────┘
```

### 7.4 宠物形象方案：手绘逐帧精灵图（旅行青蛙风格）

参考旅行青蛙的做法：**手绘风格立绘 + 少量帧循环动画（Sprite Sheet）**。不使用骨骼动画或 Lottie，追求温暖手绘质感和极简帧数。

#### 设计原则

- **少帧循环**：每个动作 2-4 帧即可，不追求丝滑，追求"手绘翻书感"
- **温暖插画风**：水彩/蜡笔质感，和 App 的"手帐"调性一致
- **一套皮肤 = 一组 sprite sheet**：换皮肤换整张图，实现简单
- **心情通过动作区分**，不只是换表情

#### Sprite Sheet 规格

每张 sprite sheet 为横排帧序列（CSS `steps()` 播放）：

| 动作 | 帧数 | 单帧尺寸 | 循环 | 触发条件 |
|------|------|----------|------|----------|
| idle（待机） | 2 帧 | 200×200px | 无限循环，慢速 | 默认 / mood=normal |
| happy（开心） | 3 帧 | 200×200px | 循环 2 次后回 idle | mood=happy |
| eating（吃东西） | 4 帧 | 200×200px | 播放 1 次 | 喂食时 |
| hungry（饿了） | 2 帧 | 200×200px | 无限循环 | mood=hungry / stamina=0 |
| excited（兴奋） | 3 帧 | 200×200px | 循环 3 次后回 idle | mood=excited |
| sad（难过） | 2 帧 | 200×200px | 无限循环，慢速 | mood=sad |
| reading（看书） | 2 帧 | 200×200px | 无限循环 | 聊天界面待机 |
| waving（招手） | 3 帧 | 200×200px | 播放 1 次 | 用户打开宠物页 |

> 旅行青蛙也只有 2-3 帧/动作，足以传递"活"的感觉。

#### 资源目录结构

```
assets/pet/
  sprites/
    default/                     -- 默认灰色小象
      idle.png                   -- 400×200 (2帧 × 200px)
      happy.png                  -- 600×200 (3帧)
      eating.png                 -- 800×200 (4帧)
      hungry.png                 -- 400×200
      excited.png                -- 600×200
      sad.png                    -- 400×200
      reading.png                -- 400×200
      waving.png                 -- 600×200
    pink/                        -- 粉色甜心象（同结构）
      idle.png
      happy.png
      ...
    space/                       -- 太空象
      ...
  previews/                      -- 商店展示用静态预览图
    default.png
    pink.png
    space.png
    ...
```

每套皮肤需要画 **8 个动作 × 2-4 帧 ≈ 约 21 张手绘帧**。默认皮肤优先完成，其他皮肤后续逐步补充。

#### CSS Sprite 动画实现

```css
/* PetAvatar.vue <style> */
.pet-sprite {
  width: 200px;
  height: 200px;
  background-repeat: no-repeat;
  background-size: cover;
  image-rendering: auto; /* 保留手绘柔和感，不锐化 */
}

/* idle: 2帧, 慢速呼吸循环 */
.pet-sprite.idle {
  background-image: url('~/assets/pet/sprites/default/idle.png');
  background-size: 400px 200px;
  animation: sprite-2 1.6s steps(2) infinite;
}

/* happy: 3帧, 蹦跳 */
.pet-sprite.happy {
  background-image: url('~/assets/pet/sprites/default/happy.png');
  background-size: 600px 200px;
  animation: sprite-3 0.6s steps(3) 2; /* 循环2次 */
}

/* eating: 4帧, 吃东西 */
.pet-sprite.eating {
  background-image: url('~/assets/pet/sprites/default/eating.png');
  background-size: 800px 200px;
  animation: sprite-4 1.2s steps(4) 1; /* 播放1次 */
}

/* hungry: 2帧, 慢速耷拉 */
.pet-sprite.hungry {
  background-image: url('~/assets/pet/sprites/default/hungry.png');
  background-size: 400px 200px;
  animation: sprite-2 2s steps(2) infinite;
}

@keyframes sprite-2 { from { background-position: 0 0; } to { background-position: -400px 0; } }
@keyframes sprite-3 { from { background-position: 0 0; } to { background-position: -600px 0; } }
@keyframes sprite-4 { from { background-position: 0 0; } to { background-position: -800px 0; } }
```

#### PetAvatar 组件逻辑

```vue
<!-- components/PetAvatar.vue -->
<template>
  <div
    class="pet-sprite"
    :class="currentAnimation"
    :style="spriteStyle"
    @animationend="onAnimationEnd"
  />
</template>

<script setup lang="ts">
import type { PetMood } from '~/types'

const props = defineProps<{
  mood: PetMood
  skinKey: string  // 'default' | 'pink' | 'space' | ...
  action?: 'eating' | 'waving' | null  // 一次性动作
}>()

const currentAnimation = ref(props.mood)

// 一次性动作播完回归 mood 对应动画
function onAnimationEnd() {
  if (props.action) {
    currentAnimation.value = props.mood
  }
}

// action 变化时播放一次性动作
watch(() => props.action, (action) => {
  if (action) currentAnimation.value = action
})

// mood 变化时切换循环动画
watch(() => props.mood, (mood) => {
  if (!props.action) currentAnimation.value = mood
})

// 动态 sprite 路径（换皮肤）
const spriteStyle = computed(() => {
  const skin = props.skinKey || 'default'
  const anim = currentAnimation.value
  return {
    backgroundImage: `url(/assets/pet/sprites/${skin}/${anim}.png)`,
  }
})
</script>
```

#### 皮肤与 asset_key 对照

商品表 `shop_products` 中 `asset_key` 对应 sprite 目录名：

| 商店名称 | asset_key | sprite 目录 |
|----------|-----------|------------|
| 默认小象 | `pet-default` | `sprites/default/` |
| 粉色甜心象 | `pet-pink` | `sprites/pink/` |
| 太空象 | `pet-space` | `sprites/space/` |
| 武士象 | `pet-warrior` | `sprites/warrior/` |
| 圣诞象 | `pet-christmas` | `sprites/christmas/` |
| 花园象 | `pet-garden` | `sprites/garden/` |
| 海盗象 | `pet-pirate` | `sprites/pirate/` |

#### 美术资产排期

| 阶段 | 内容 | 说明 |
|------|------|------|
| **一期** | 默认小象 8 个动作（~21帧） | 可自己画或找约稿 |
| **二期** | 2-3 套付费皮肤 + 3-5 件静态装饰品 | 上架商店售卖 |
| **三期** | 2-3 件衣服套装 | 每件 21 帧穿衣 sprite |
| **后续** | 限定皮肤/装饰/衣服（节日/活动） | 按运营节奏出 |

### 7.5 装饰品与服装系统

#### 设计理念

装饰品按复杂度分两类，用不同的渲染方式：

| 类型 | 渲染方式 | 资源量 | 示例 |
|------|----------|--------|------|
| **静态装饰** | 1 张 PNG，CSS absolute 叠加在小象上 | 每件 1 张图 | 帽子、围巾、铃铛、翅膀、气球 |
| **衣服套装** | 21 帧穿衣版 sprite sheet，整套替换小象层 | 每件 21 帧 | 水手服、雨衣、圣诞装、侦探斗篷 |

#### 渲染层级

```
┌─────────────────────────────────┐
│  头饰层 (crown.png)              │ ← 静态 PNG，z-index: 2
│                                  │
│  ┌─小象/穿衣 sprite 层─────────┐│ ← z-index: 1
│  │  🐘 / 👔🐘                   ││   有衣服 → 穿衣版 sprite
│  │                              ││   没衣服 → 裸象 sprite
│  └──────────────────────────────┘│
│                                  │
│  背饰层 (wings.png)              │ ← 静态 PNG，z-index: 0
└─────────────────────────────────┘
```

#### 佩戴规则

- 同时只能穿 **1 件衣服**（整套替换，不能叠穿）
- 静态装饰最多同时佩戴 **3 件**（头饰/脖饰/背饰或手持各一）
- 衣服可以和静态装饰品叠加（穿水手服 + 戴皇冠 ✅）
- 穿衣服时 **锁定默认皮肤配色**，避免组合爆炸（旅行青蛙同理）

#### 静态装饰品

##### 分类与锚点

| 类型 | 锚点 | 示例 | z-index |
|------|------|------|---------|
| 头饰 | head（头顶） | 小皇冠、蝴蝶结、圣诞帽、花环 | 前层 |
| 脖饰 | neck（脖子） | 围巾、铃铛、领结 | 前层 |
| 背饰 | back（背后） | 小翅膀、小书包、披风 | 后层 |
| 手持 | trunk（鼻子前方） | 气球、小旗子、棒棒糖 | 前层 |

##### 锚点偏移表

每个动作的每一帧，定义装饰品的偏移坐标（相对于 200×200 sprite 左上角）：

```typescript
/** 装饰品锚点类型 */
type AnchorType = 'head' | 'neck' | 'back' | 'trunk'

/** 单帧的锚点坐标 */
interface AnchorPoint {
  x: number   // 像素偏移
  y: number
  rotate?: number  // 可选旋转角度
}

/** 一个动作所有帧的锚点 */
type ActionAnchors = Record<AnchorType, AnchorPoint[]>

/** 完整锚点配置（每套皮肤各一份） */
type SpriteAnchors = Record<string, ActionAnchors>
```

锚点数据示例：

```typescript
// composables/usePetAnchors.ts

export const defaultSpriteAnchors: SpriteAnchors = {
  idle: {
    head:  [{ x: 90, y: 15 }, { x: 90, y: 12 }],           // 2帧，呼吸微动
    neck:  [{ x: 95, y: 55 }, { x: 95, y: 52 }],
    back:  [{ x: 45, y: 40 }, { x: 45, y: 37 }],
    trunk: [{ x: 135, y: 70 }, { x: 135, y: 67 }],
  },
  happy: {
    head:  [{ x: 90, y: 20 }, { x: 88, y: 5 }, { x: 90, y: 18 }],  // 3帧，跳起时y变小
    neck:  [{ x: 95, y: 60 }, { x: 93, y: 45 }, { x: 95, y: 58 }],
    back:  [{ x: 45, y: 45 }, { x: 43, y: 30 }, { x: 45, y: 43 }],
    trunk: [{ x: 135, y: 75 }, { x: 133, y: 60 }, { x: 135, y: 73 }],
  },
  // ... 其他动作同理
}
```

> 坐标确定方法：出完 sprite 图后用画图工具看像素位置，或做调试模式在页面上拖拽定位。

##### 静态装饰资源

```
public/assets/pet/accessories/
  crown.png            -- 小皇冠 ~60×40px
  bow.png              -- 蝴蝶结 ~50×35px
  santa-hat.png        -- 圣诞帽 ~70×50px
  scarf-red.png        -- 红围巾 ~80×30px
  bell.png             -- 铃铛 ~25×30px
  wings.png            -- 小翅膀 ~90×60px
  backpack.png         -- 小书包 ~45×50px
  balloon.png          -- 气球 ~30×80px
  lollipop.png         -- 棒棒糖 ~25×60px
  flower-crown.png     -- 花环 ~80×30px
```

#### 衣服套装

##### 核心做法

每件衣服 = **一套完整的"穿着衣服的小象" sprite sheet**，帧数、动作与裸象严格一致。渲染时有衣服就整套替换小象 sprite，没衣服就显示裸象。

##### 衣服资源结构

```
public/assets/pet/clothing/
  sailor-uniform/        -- 水手服
    idle.png             -- 400×200（2帧）
    happy.png            -- 600×200（3帧）
    eating.png           -- 800×200（4帧）
    hungry.png           -- 400×200
    excited.png          -- 600×200
    sad.png              -- 400×200
    reading.png          -- 400×200
    waving.png           -- 600×200
  raincoat/              -- 小雨衣（同结构）
  santa-suit/            -- 圣诞装
  detective/             -- 侦探斗篷
```

每件衣服 8 个动作 × 2-4 帧 ≈ **约 21 帧**，与裸象工作量相同。

##### 即梦生成穿衣 sprite 的方法

1. 以裸象基准图为参考，让 AI 画出"穿衣服的小象"定义风格
2. 逐帧参考裸象对应帧（参考强度 0.75），提示词加衣服描述
3. 去背景 → 统一尺寸 → 拼成 sprite sheet（流程和裸象一样）

提示词示例：

```
一只可爱的Q版小灰象，穿着蓝白条纹水手服，水彩手绘插画风格，
白色纯色背景，全身像，居中构图，
开心地跳到空中，四脚离地
```

#### 组件实现

```vue
<!-- components/PetAvatar.vue -->
<template>
  <div class="pet-container" :style="{ width: `${size}px`, height: `${size}px` }">
    <!-- 背饰层（在小象后面） -->
    <img
      v-for="acc in backAccessories"
      :key="acc.key"
      :src="`/assets/pet/accessories/${acc.asset}`"
      class="pet-accessory back"
      :style="accessoryStyle(acc)"
    />

    <!-- 小象 sprite 层（有衣服时整套替换） -->
    <div
      class="pet-sprite"
      :class="currentAnimation"
      :style="spriteStyle"
      @animationend="onAnimationEnd"
    />

    <!-- 前饰层（头饰、脖饰、手持） -->
    <img
      v-for="acc in frontAccessories"
      :key="acc.key"
      :src="`/assets/pet/accessories/${acc.asset}`"
      class="pet-accessory front"
      :style="accessoryStyle(acc)"
    />
  </div>
</template>

<script setup lang="ts">
const props = defineProps<{
  mood: PetMood
  skinKey: string
  accessories: PetAccessory[]  // 当前佩戴的所有装饰品
  action?: 'eating' | 'waving' | null
  size?: number
}>()

const size = props.size ?? 200

// 区分层级
const clothing = computed(() => props.accessories.find(a => a.type === 'clothing'))
const backAccessories = computed(() =>
  props.accessories.filter(a => a.type === 'static' && a.anchor === 'back')
)
const frontAccessories = computed(() =>
  props.accessories.filter(a => a.type === 'static' && a.anchor !== 'back')
)

// sprite 路径：有衣服 → 穿衣版；没衣服 → 裸象版
const spriteStyle = computed(() => {
  const anim = currentAnimation.value
  const basePath = clothing.value
    ? `/assets/pet/clothing/${clothing.value.asset}`
    : `/assets/pet/sprites/${props.skinKey || 'default'}`
  return { backgroundImage: `url(${basePath}/${anim}.png)` }
})

// 当前帧索引（同步 CSS 动画，用于装饰品锚点）
const currentFrame = ref(0)
const frameCount = computed(() => {
  const counts: Record<string, number> = {
    idle: 2, happy: 3, eating: 4, hungry: 2,
    excited: 3, sad: 2, reading: 2, waving: 3,
  }
  return counts[currentAnimation.value] ?? 2
})

// 装饰品坐标
function accessoryStyle(acc: PetAccessory) {
  const anchors = defaultSpriteAnchors[currentAnimation.value]
  if (!anchors || !acc.anchor) return {}
  const points = anchors[acc.anchor]
  if (!points) return {}
  const point = points[currentFrame.value % points.length]
  return {
    left: `${point.x - (acc.width ?? 40) / 2}px`,
    top: `${point.y - (acc.height ?? 40) / 2}px`,
    width: `${acc.width ?? 40}px`,
    transform: point.rotate ? `rotate(${point.rotate}deg)` : undefined,
  }
}
</script>

<style scoped>
.pet-container { position: relative; overflow: hidden; }
.pet-accessory {
  position: absolute;
  pointer-events: none;
  transition: left 0.1s, top 0.1s; /* 平滑跟随 */
}
.pet-accessory.back { z-index: 0; }
.pet-sprite { position: relative; z-index: 1; width: 100%; height: 100%; }
.pet-accessory.front { z-index: 2; }
</style>
```

#### 类型定义

```typescript
// types/index.ts

/** 宠物装饰品 */
interface PetAccessory {
  key: string
  type: 'static' | 'clothing'      // static=静态叠加, clothing=整套替换sprite
  anchor?: AnchorType               // static 类型需要：head/neck/back/trunk
  asset: string                     // static: 文件名(crown.png), clothing: 目录名(sailor-uniform)
  width?: number                    // static 类型的渲染宽度
  height?: number
}
```

#### 数据库

商品表扩展 `pet_accessory` 类型，通过 `asset_key` 前缀区分静态/衣服：

```sql
-- shop_products.type 扩展
ALTER TABLE shop_products
  MODIFY COLUMN type ENUM('skin', 'sticker_pack', 'font', 'pet_skin', 'pet_accessory', 'bundle');

-- 静态装饰品
INSERT INTO shop_products (type, name, description, price, asset_key, sort_order) VALUES
  ('pet_accessory', '小皇冠',     '头顶闪闪发光的小皇冠',     15, 'acc:crown',       1),
  ('pet_accessory', '蝴蝶结',     '粉色可爱蝴蝶结',          10, 'acc:bow',         2),
  ('pet_accessory', '圣诞帽',     '节日限定圣诞帽',          20, 'acc:santa-hat',   3),
  ('pet_accessory', '红色围巾',   '温暖的红围巾',            15, 'acc:scarf-red',   4),
  ('pet_accessory', '小铃铛',     '叮叮当当的小铃铛',         10, 'acc:bell',        5),
  ('pet_accessory', '天使翅膀',   '背后的小翅膀',            25, 'acc:wings',       6),
  ('pet_accessory', '小书包',     '装满知识的小书包',         20, 'acc:backpack',    7),
  ('pet_accessory', '气球',       '鼻子卷着的彩色气球',       10, 'acc:balloon',     8);

-- 衣服套装（asset_key 前缀 clothing:）
INSERT INTO shop_products (type, name, description, price, asset_key, sort_order) VALUES
  ('pet_accessory', '水手服',     '蓝白条纹小水手',          30, 'clothing:sailor-uniform', 10),
  ('pet_accessory', '小雨衣',     '黄色可爱小雨衣',          25, 'clothing:raincoat',       11),
  ('pet_accessory', '圣诞套装',   '节日限定圣诞装',          35, 'clothing:santa-suit',     12),
  ('pet_accessory', '侦探斗篷',   '戴着放大镜的小侦探',      30, 'clothing:detective',      13);
```

`asset_key` 格式约定：
- `acc:xxx` → 静态装饰品，对应 `accessories/xxx.png`
- `clothing:xxx` → 衣服套装，对应 `clothing/xxx/` 目录

用户佩戴表：

```sql
CREATE TABLE user_pet_accessories (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  user_id     INT NOT NULL,
  product_id  INT NOT NULL,
  equipped    BOOLEAN DEFAULT FALSE,
  equipped_at DATETIME,
  UNIQUE KEY uk_user_product (user_id, product_id),
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (product_id) REFERENCES shop_products(id)
);
```

#### 即梦生成装饰品提示词参考

静态装饰品只需要 1 张图：

```
一个小巧精致的金色皇冠，水彩手绘插画风格，白色纯色背景，
适合戴在Q版小象头上的尺寸，俯视角度，简洁可爱
```

```
一条红色针织围巾，水彩手绘插画风格，白色纯色背景，
适合Q版小象佩戴的尺寸，展开状态，柔软质感
```

```
一对白色小天使翅膀，水彩手绘插画风格，白色纯色背景，
Q版可爱风格，适合贴在小象背后
```

#### 装饰品工作量总结

| 类型 | 每件资源量 | 单价建议 | 说明 |
|------|-----------|----------|------|
| 静态装饰品 | 1 张 PNG | 10-25 象币 | 即梦秒出，去背景即可 |
| 衣服套装 | 21 帧 sprite sheet | 25-35 象币 | 和画一套皮肤工作量相当 |

---

## 八、AI 调用成本分析

| 功能 | 模型 | 单次 Token | 单次成本 | 说明 |
|------|------|-----------|----------|------|
| AI 聊天 | DeepSeek | ~200 | ~¥0.001 | 短对话，input/output 都短 |
| 智能提醒 | DeepSeek | ~300 | ~¥0.001 | 聚合数据 + 短回复 |
| 每日一言 | DeepSeek | ~100 | ~¥0.0005 | 极短，按天缓存 |

用户每天聊 10 轮 + 1 次提醒 + 1 次每日一言 ≈ **¥0.012/天 ≈ ¥0.36/月**。

但用户需要花 **5 象币/次喂食** 才能聊天（10 轮 = 50 体力 = 2.5 次喂食 = 12.5 象币），象币是真钱买的 → **AI 成本被象币消费自然覆盖**。

---

## 九、开发量估算

| 任务 | 时间 |
|------|------|
| 数据库（3 张表 + 迁移） | 1 小时 |
| Model 层（pet.model.ts） | 2 小时 |
| 宠物状态 API（CRUD + 喂食 + 体力） | 3-4 小时 |
| AI 聊天（Prompt + 上下文 + API） | 4-5 小时 |
| 智能提醒（数据聚合 + Prompt + API） | 3-4 小时 |
| 每日一言（Prompt + 缓存） | 1 小时 |
| 情绪系统（触发 + 状态机） | 2-3 小时 |
| Pinia Store | 2 小时 |
| 宠物主页前端 | 4-5 小时 |
| 聊天界面前端 | 3-4 小时 |
| 宠物皮肤切换（复用商店体系） | 1-2 小时 |
| 小象动画/表情素材（SVG） | 4-6 小时 |
| **合计** | **约 26-34 小时（4-5 天）** |

---

## 十、文件清单

```
新增文件：
  scripts/migrate-006-ai-pet.sql        -- 数据库迁移
  server/utils/models/pet.model.ts      -- 宠物 + 聊天记录 + 喂食日志 Model
  server/utils/pet-data.ts              -- 用户数据聚合（供提醒用）
  server/utils/pet-mood.ts              -- 情绪触发工具
  server/api/pet/index.get.ts           -- 获取宠物状态
  server/api/pet/settings.put.ts        -- 修改昵称/性格
  server/api/pet/skin.put.ts            -- 切换皮肤
  server/api/pet/feed.post.ts           -- 喂食
  server/api/pet/chat.post.ts           -- AI 聊天
  server/api/pet/chat/history.get.ts    -- 聊天记录
  server/api/pet/reminder.get.ts        -- 智能提醒
  server/api/pet/daily-quote.get.ts     -- 每日一言
  stores/pet.ts                         -- Pinia Store
  pages/pet/index.vue                   -- 宠物主页
  pages/pet/chat.vue                    -- 聊天界面
  components/PetAvatar.vue              -- 宠物形象组件
  assets/pet/                           -- SVG 形象资源

修改文件：
  types/index.ts                        -- 新增宠物相关类型
  server/types/index.ts                 -- 新增后端宠物类型
  pages/index.vue                       -- 首页嵌入宠物迷你卡片（可选）
  layouts/default.vue                   -- 底部导航添加宠物入口
  server/api/todos/[id]/toggle.patch.ts -- 触发 triggerPetMood('todo_completed')
  server/api/finance/index.post.ts      -- 触发 triggerPetMood（超支时 'budget_exceeded'）
```
