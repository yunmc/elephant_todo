# P2 AI 功能 — 设计文档

> 所属项目：Elephant Todo App  
> 优先级：P2  
> 前置依赖：P0 会员体系基础（已完成）  
> 预估时间：14-18 小时  
> 日期：2026-03-05

---

## 一、功能概述

AI 功能模块利用 LLM（Gemini / DeepSeek）为 Premium 用户提供智能化体验。

| 项目 | 说明 |
|------|------|
| 目标 | 智能匹配 Premium 限制 + AI 快速记账 + 月度/年度报告 + 独立 LLM 工具 |
| 包含 | 共享 LLM 调用工具、AI 快速记账解析、月度报告、年度报告、报告缓存、频率限制 |
| 与 Premium 关系 | 所有 AI 功能仅限 Premium 用户，免费用户展示升级引导 |

### 子功能清单

| 子功能 | 状态 | 说明 |
|--------|------|------|
| 智能匹配 → Premium 限制 | ✅ 已有接口，需加 `requirePremium` | 改造 0.5h |
| 共享 LLM 工具函数 | 🆕 从智能匹配抽取 | 提取 `callLLM()` 供复用 |
| AI 快速记账 | 🆕 新开发 | 自然语言 → 结构化记账 |
| AI 月度报告 | 🆕 新开发 | 跨模块数据聚合 + AI 分析 |
| AI 年度报告 | 🆕 新开发 | 全年数据 + AI 总结 |

---

## 二、数据库变更

### 2.1 AI 报告缓存表（新建）

```sql
CREATE TABLE ai_reports (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  user_id     INT NOT NULL,
  report_type ENUM('monthly', 'yearly') NOT NULL,
  year        INT NOT NULL,
  month       INT NOT NULL DEFAULT 0 COMMENT '月度报告 1-12，年度报告固定为 0',
  content     JSON NOT NULL COMMENT 'AI 生成的结构化报告内容',
  created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uk_report (user_id, report_type, year, month),
  CONSTRAINT fk_report_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

> **设计决策**：`month` 使用 `NOT NULL DEFAULT 0` 而非 `NULL`。MySQL 的 UNIQUE KEY 对 NULL 不做唯一性判断（NULL ≠ NULL），如果年度报告用 NULL 会导致同一用户同年可插入多条年度报告。用 `0` 表示年度报告，`1-12` 表示月度报告。

### 2.2 迁移脚本

文件：`scripts/migrate-003-ai.sql`

```sql
-- P2 AI 功能迁移
CREATE TABLE IF NOT EXISTS ai_reports (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  user_id     INT NOT NULL,
  report_type ENUM('monthly', 'yearly') NOT NULL,
  year        INT NOT NULL,
  month       INT NOT NULL DEFAULT 0 COMMENT '月度 1-12，年度 0',
  content     JSON NOT NULL,
  created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uk_report (user_id, report_type, year, month),
  CONSTRAINT fk_report_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

---

## 三、共享 LLM 工具函数

### 3.1 设计目标

从现有 `smart-suggest.post.ts` 中的内联 LLM 调用逻辑抽取为独立工具，供所有 AI 功能复用。

### 3.2 文件：`server/utils/llm.ts`

```typescript
interface LLMOptions {
  systemPrompt: string
  userMessage: string
  temperature?: number    // 默认 0.1
  maxTokens?: number      // 默认 512
  timeoutMs?: number      // 默认 30000
  preferModel?: 'gemini' | 'deepseek'  // 指定优先模型
}

interface LLMResult {
  content: string         // 清洗后的文本
  model: string           // 实际使用的模型名
  provider: 'gemini' | 'deepseek'
}

/**
 * 调用 LLM（Gemini 优先，DeepSeek 备选）
 * 自动处理：超时、fallback、<think> 标签清理、R1 reasoning_content
 */
export async function callLLM(options: LLMOptions): Promise<LLMResult>

/**
 * 从 LLM 返回文本中提取 JSON
 * 处理 markdown 代码块、前后杂文等
 */
export function extractJSON<T = any>(text: string): T
```

### 3.3 双供应商 fallback 策略

```
1. 根据 preferModel 决定优先供应商（默认 gemini）
2. 调用主供应商，30s 超时
3. 成功 → 返回结果
4. 失败（网络错误 / 非 200） → 自动切换备用供应商重试
5. 备用也失败 → 抛出错误
```

### 3.4 重构现有智能匹配

重构 `smart-suggest.post.ts`：
- 移除内联 LLM 调用代码
- 改为调用 `callLLM()` + `extractJSON()`
- 添加 `requirePremium(userId)` 校验

---

## 四、智能匹配加 Premium 限制

### 4.1 变更

**文件**：`server/api/match/smart-suggest.post.ts`

```typescript
// 新增：
import { requirePremium } from '~/server/utils/premium'

export default defineEventHandler(async (event) => {
  const userId = requireAuth(event)
  await requirePremium(userId)  // ← 新增这一行
  // ... 原有逻辑
})
```

### 4.2 前端处理

当免费用户调用智能匹配时，后端返回 `403 PREMIUM_REQUIRED`，前端捕获后显示 `PremiumModal` 升级引导。

---

## 五、AI 快速记账

### 5.1 功能描述

用户输入一句自然语言（文字或语音），AI 解析为结构化记账数据，一键确认入账。

**示例**：
- 「昨天星巴克拿铁38」→ 支出 ¥38，分类：饮品，日期：昨天
- 「发工资8000」→ 收入 ¥8000，分类：工资
- 「中午外卖26.5」→ 支出 ¥26.5，分类：餐饮

### 5.2 API 接口

| 方法 | 路径 | 说明 | 权限 |
|------|------|------|------|
| POST | /api/ai/quick-entry | 解析自然语言为记账数据 | Premium |

**请求**:
```json
{ "text": "昨天星巴克拿铁38" }
```

**响应**:
```json
{
  "amount": 38,
  "type": "expense",
  "category_name": "饮品",
  "date": "2026-03-04",
  "note": "星巴克拿铁",
  "confidence": 0.95
}
```

### 5.3 实现：`server/api/ai/quick-entry.post.ts`

```typescript
export default defineEventHandler(async (event) => {
  const userId = requireAuth(event)
  await requirePremium(userId)
  await rateLimitByUser(userId, 'ai', 20, 24 * 60 * 60 * 1000)  // 每日 20 次/用户

  const { text } = await readBody(event)
  if (!text || text.length > 500) throw createError({ statusCode: 400, message: '输入内容不能为空且不超过500字' })

  // 获取用户分类列表用于引导 AI
  const categories = await FinanceCategoryModel.findByUser(userId)
  const categoryNames = categories.map(c => `${c.name}(${c.type})`).join('、')

  const today = new Date().toISOString().split('T')[0]

  const result = await callLLM({
    systemPrompt: `你是一个记账助手。请从用户输入中提取以下信息，返回 JSON：
- amount: 金额（数字）
- type: "expense" 或 "income"
- category_name: 消费分类（从以下分类中选择最匹配的：${categoryNames}）
- date: 日期（ISO 格式，"昨天""前天"等请转换为具体日期，今天是 ${today}）
- note: 简短备注
- confidence: 你对解析结果的置信度（0-1）

只返回 JSON，不要解释。如果信息不完整，用合理默认值填充（日期默认今天，类型默认支出）。`,
    userMessage: text,
    temperature: 0.1,
    maxTokens: 256,
    preferModel: 'deepseek'  // 短文本用 DeepSeek，成本低
  })

  const parsed = extractJSON<AiQuickEntryResult>(result.content)

  // 校验必要字段 + 兜底默认值
  if (typeof parsed.amount !== 'number' || parsed.amount <= 0) {
    throw createError({ statusCode: 422, message: 'AI 解析失败：无法识别金额' })
  }
  return {
    amount: parsed.amount,
    type: ['income', 'expense'].includes(parsed.type) ? parsed.type : 'expense',
    category_name: parsed.category_name || '',
    date: /^\d{4}-\d{2}-\d{2}$/.test(parsed.date) ? parsed.date : today,
    note: parsed.note || '',
    confidence: typeof parsed.confidence === 'number' ? parsed.confidence : 0,
  }
})
```

### 5.4 前端 UI

**入口**：在记账页面添加「AI 快速记账」按钮。

**组件**：`components/AiQuickEntry.vue`

```
┌──────────────────────────────────┐
│ 💡 AI 快速记账            Premium │
├──────────────────────────────────┤
│                                  │
│  请输入或说一句话：               │
│  ┌──────────────────────┐        │
│  │ 昨天星巴克拿铁38      │ [🎤]  │
│  └──────────────────────┘        │
│           [ 解析 ]                │
│                                  │
│  ── AI 解析结果 ──               │
│  金额：¥38.00                    │
│  类型：支出                       │
│  分类：☕ 饮品                     │
│  日期：2026-03-04                │
│  备注：星巴克拿铁                 │
│  置信度：95%                      │
│                                  │
│  [ 修改 ]          [ ✅ 确认入账 ] │
└──────────────────────────────────┘
```

**交互流程**：
1. 用户输入文字 or 点击🎤语音输入（使用 `useVoiceInput`）
2. 点击「解析」→ 调用 `POST /api/ai/quick-entry`
3. 展示解析结果，用户可修改任意字段
4. 点击「确认入账」→ 调用现有 `POST /api/finance/records` 保存

### 5.5 与语音输入联动

已有 `useVoiceInput` composable，流程：
1. 点击🎤，`start()` 开始监听
2. 语音识别完成，`transcript` 填入输入框
3. 自动触发 AI 解析

---

## 六、AI 月度报告

### 6.1 功能描述

综合当月消费、待办、随手记、重要日期等全模块数据，AI 生成个性化月度报告。

### 6.2 API 接口

| 方法 | 路径 | 说明 | 权限 |
|------|------|------|------|
| POST | /api/ai/report/monthly | 生成/获取月度报告 | Premium |

**请求**:
```json
{ "year": 2026, "month": 3 }
```

**响应**:
```json
{
  "cached": true,
  "report": {
    "finance_insight": "总支出 ¥3,280，比上月减少12%...",
    "finance_suggestion": "建议下月预算 ¥3,000",
    "todo_insight": "完成 32 个待办，完成率 78%...",
    "idea_insight": "记录 18 条，其中 12 条已关联到待办",
    "date_reminder": "下月提醒：妈妈生日（4/7）",
    "summary": "财务管理有进步，做事效率在提升，继续保持！",
    "keywords": ["项目汇报", "健身", "读书笔记"]
  },
  "generated_at": "2026-03-05T10:00:00Z"
}
```

### 6.3 数据聚合逻辑

**Model**：`server/utils/models/ai-report.model.ts`

```typescript
export class AiReportModel {
  /** 获取缓存的报告 */
  static async getCached(userId: number, type: 'monthly' | 'yearly', year: number, month?: number)

  /** 保存报告缓存 */
  static async saveReport(userId: number, type: 'monthly' | 'yearly', year: number, month: number, content: object)

  /** 删除缓存（重新生成时） */
  static async deleteCache(userId: number, type: 'monthly' | 'yearly', year: number, month?: number)
}
```

**数据聚合**：`server/utils/ai-data-aggregator.ts`

从各表聚合当月数据：

```typescript
interface MonthlyData {
  finance: {
    totalIncome: number
    totalExpense: number
    prevMonthExpense: number  // 上月对比
    categoryBreakdown: Array<{ name: string, amount: number, count: number }>
  }
  todos: {
    created: number
    completed: number
    overdue: number
    prevMonthCompletionRate: number
  }
  ideas: {
    total: number
    linkedCount: number
  }
  importantDates: {
    thisMonth: string[]
    nextMonth: string[]
  }
  period?: {
    count: number
    avgCycle: number
  }
}

export async function aggregateMonthlyData(userId: number, year: number, month: number): Promise<MonthlyData>
```

**SQL 查询（聚合统计）**：

> **注意**：所有日期比较使用报告月份的起止日期，而非 `NOW()`。例如查 2026-02 的报告，`monthStart = '2026-02-01'`，`monthEnd = '2026-02-28'`，`prevStart = '2026-01-01'`，`prevEnd = '2026-01-31'`。这样即使在 4 月查看 2 月报告，数据也不会被当前时间影响。
>
> **年跨界处理**：查"下月"重要日期时，当 month=12，下月为次年 1 月（nextMonth=1, nextYear=year+1）。

```sql
-- 当月消费统计
SELECT type, SUM(amount) as total FROM finance_records
WHERE user_id = ? AND record_date BETWEEN ? AND ?
GROUP BY type;

-- 上月消费（环比对比）
SELECT SUM(amount) as total FROM finance_records
WHERE user_id = ? AND record_date BETWEEN ? AND ? AND type = 'expense';

-- 分类明细
SELECT fc.name, fc.icon, COUNT(*) as count, SUM(fr.amount) as amount
FROM finance_records fr JOIN finance_categories fc ON fr.category_id = fc.id
WHERE fr.user_id = ? AND fr.record_date BETWEEN ? AND ? AND fr.type = 'expense'
GROUP BY fr.category_id ORDER BY amount DESC;

-- 当月待办统计
-- 「完成数」= 本月完成的（按 completed_at），不限创建时间
-- 「逾期数」= 截至月末仍 pending 且 due_date 已过，不限创建时间
SELECT
  (SELECT COUNT(*) FROM todos WHERE user_id = ? AND created_at BETWEEN ? AND ?) as created,
  (SELECT COUNT(*) FROM todos WHERE user_id = ? AND completed_at BETWEEN ? AND ?) as completed,
  (SELECT COUNT(*) FROM todos WHERE user_id = ? AND status = 'pending' AND due_date IS NOT NULL AND due_date < ?) as overdue;
-- ↑ overdue: due_date < monthEnd，不限 created_at，涵盖历史遗留逾期

-- 上月待办完成率（环比对比，同样按 completed_at 口径）
SELECT
  (SELECT COUNT(*) FROM todos WHERE user_id = ? AND created_at BETWEEN ? AND ?) as created,
  (SELECT COUNT(*) FROM todos WHERE user_id = ? AND completed_at BETWEEN ? AND ?) as completed;

-- 随手记统计
SELECT
  COUNT(*) as total,
  SUM(CASE WHEN todo_id IS NOT NULL THEN 1 ELSE 0 END) as linked
FROM ideas WHERE user_id = ? AND created_at BETWEEN ? AND ?;

-- 重要日期（本月+下月，处理年跨界：12月→次年1月）
SELECT title, event_date FROM important_dates
WHERE user_id = ? AND (
  (MONTH(event_date) = ? AND YEAR(event_date) = ?) OR
  (MONTH(event_date) = ? AND YEAR(event_date) = ?)
);
-- ↑ nextMonth/nextYear 由代码计算：month=12 时 nextMonth=1, nextYear=year+1
```

### 6.4 Prompt 模板

文件：`prompts/月度报告提示词.md`

```
你是 Elephant App 的智能助手。请根据以下用户月度数据，生成一份简洁温暖的月度报告。

## {year} 年 {month} 月数据

### 消费
- 总收入：¥{totalIncome}
- 总支出：¥{totalExpense}（上月 ¥{prevMonthExpense}）
- 分类明细：{categoryBreakdown}

### 待办
- 创建 {todosCreated} 个，完成 {todosCompleted} 个，逾期 {todosOverdue} 个
- 上月完成率 {prevCompletionRate}%

### 随手记
- 新增 {ideasTotal} 条，已关联待办 {ideasLinked} 条

### 重要日期
- 本月：{thisMonthDates}
- 下月即将到来：{nextMonthDates}

请输出以下 JSON 格式：
{
  "finance_insight": "消费分析（2-3句）",
  "finance_suggestion": "建议（1句）",
  "todo_insight": "待办回顾（2-3句）",
  "idea_insight": "随手记总结（1-2句）",
  "date_reminder": "日期提醒（1句）",
  "summary": "一句话总结（温暖鼓励的语气）",
  "keywords": ["关键词1", "关键词2", "关键词3"]
}

风格：亲切、简洁、鼓励为主。用中文。只返回 JSON。
```

### 6.5 缓存策略

- 首次调用：生成报告并缓存到 `ai_reports` 表
- 再次调用：直接返回缓存，`cached: true`
- 用户可点「重新生成」，传 `regenerate: true` 参数删除缓存后重新生成

### 6.6 前端页面

**入口**：记账页面 → 「月度报告」按钮 / 更多页面 → AI 报告入口

**页面**：`pages/ai/report.vue`

```
┌──────────────────────────────────┐
│ ← 🐘 月度报告    2026年3月        │
├──────────────────────────────────┤
│                                  │
│ 💰 消费洞察                       │
│ ┌──────────────────────────────┐ │
│ │ 总支出 ¥3,280，比上月减少    │ │
│ │ 12%，节省了 ¥448 👏          │ │
│ │ 餐饮占比最高（38%），外卖消费│ │
│ │ ¥860，占餐饮的 69%           │ │
│ │ 建议 4 月预算：¥3,000        │ │
│ └──────────────────────────────┘ │
│                                  │
│ ✅ 待办回顾                       │
│ ┌──────────────────────────────┐ │
│ │ 完成 32 个待办，完成率 78%   │ │
│ │ 效率最高：第 2 周（完成 12）  │ │
│ │ 有 5 个待办逾期未完成        │ │
│ └──────────────────────────────┘ │
│                                  │
│ 💡 随手记                        │
│ ┌──────────────────────────────┐ │
│ │ 记录 18 条，12 条已关联待办  │ │
│ └──────────────────────────────┘ │
│                                  │
│ 📅 重要日期                      │
│ ┌──────────────────────────────┐ │
│ │ 下月提醒：妈妈生日（4/7）    │ │
│ └──────────────────────────────┘ │
│                                  │
│ 🌟 一句话总结                    │
│ ┌──────────────────────────────┐ │
│ │ "财务管理有进步，做事效率在  │ │
│ │  提升，继续保持！"            │ │
│ └──────────────────────────────┘ │
│                                  │
│ #项目汇报 #健身 #读书笔记        │
│                                  │
│     [重新生成]                    │
└──────────────────────────────────┘
```

---

## 七、AI 年度报告

### 7.1 API 接口

| 方法 | 路径 | 说明 | 权限 |
|------|------|------|------|
| POST | /api/ai/report/yearly | 生成/获取年度报告 | Premium |

**请求**:
```json
{ "year": 2025 }
```

**响应**:
```json
{
  "cached": true,
  "report": {
    "finance_summary": "年度消费总结...",
    "finance_monthly_trend": "月度趋势分析...",
    "todo_summary": "年度效率总结...",
    "idea_summary": "年度随手记...",
    "highlights": "年度亮点...",
    "summary": "2025年总结...",
    "keywords": ["工作", "旅行", "健身"]
  },
  "generated_at": "2026-01-01T10:00:00Z"
}
```

### 7.2 数据聚合

```typescript
interface YearlyData {
  finance: {
    totalIncome: number
    totalExpense: number
    monthlyExpenses: Array<{ month: number, amount: number }>
    topCategories: Array<{ name: string, amount: number, percentage: number }>
  }
  todos: {
    totalCreated: number
    totalCompleted: number
    completionRate: number
    busiestMonth: number
    mostEfficientMonth: { month: number, rate: number }
  }
  ideas: {
    total: number
    busiestMonth: { month: number, count: number }
  }
}

export async function aggregateYearlyData(userId: number, year: number): Promise<YearlyData>
```

### 7.3 Prompt 模板

文件：`prompts/年度报告提示词.md`

```
你是 Elephant App 的智能助手。请根据以下用户年度数据，生成一份温暖有洞察的年度报告。

## {year} 年度数据

### 消费
- 总收入：¥{totalIncome}
- 总支出：¥{totalExpense}
- 月均支出：¥{avgMonthlyExpense}
- 最节省月份：{minMonth}月 ¥{minAmount}
- 最大支出月份：{maxMonth}月 ¥{maxAmount}
- TOP3 分类：{topCategories}

### 待办
- 创建 {todosCreated} 个，完成 {todosCompleted} 个
- 年完成率 {completionRate}%
- 最忙碌月份：{busiestMonth}月
- 最高效月份：{mostEfficientMonth}月（{mostEfficientRate}%）

### 随手记
- 共记录 {ideasTotal} 条
- 最活跃月份：{ideasBusiestMonth}月（{ideasBusiestCount}条）

请输出以下 JSON 格式：
{
  "finance_summary": "年度消费总结（3-4句）",
  "finance_monthly_trend": "月度消费趋势分析（2-3句）",
  "todo_summary": "年度效率总结（2-3句）",
  "idea_summary": "年度随手记总结（1-2句）",
  "highlights": "年度亮点（2-3句，找出值得自豪的点）",
  "summary": "一句话年度总结（温暖鼓励）",
  "keywords": ["关键词1", "关键词2", "关键词3", "关键词4"]
}

风格：亲切、有温度、鼓励为主。用中文。只返回 JSON。
```

### 7.4 缓存策略

年度报告同年内永久缓存（同年数据不会变），支持「重新生成」。

### 7.5 前端

与月度报告共用同一页面 `pages/ai/report.vue`，通过 tab 切换月度/年度。

---

## 八、频率限制 & 成本控制

### 8.1 AI 日调用限制

| 规则 | 说明 |
|------|------|
| 限制维度 | **用户维度**（非 IP 维度） |
| 限制键 | `ai:${userId}` |
| 日上限 | 20 次/用户/天 |
| 适用范围 | quick-entry、monthly report（缓存未命中时）、yearly report（缓存未命中时） |
| 缓存命中不计数 | 命中报告缓存时不消耗次数 |
| smart-suggest | 保留现有独立限制：`smart-suggest` 键，20次/5分钟/IP |

> **设计决策**：AI 功能改为用户维度限制，避免同 IP 多用户共享额度或同用户换 IP 绕过限制。需新增 `rateLimitByUser(userId, key, max, windowMs)` 工具函数。smart-suggest 已有独立限制，不纳入 `ai` 键，避免从 5分钟20次 骤变为 1天20次。

### 8.1.1 报告 API 限频时机

```
POST /api/ai/report/monthly  { year, month, regenerate? }
  ↓
1. requireAuth + requirePremium
2. if regenerate → 删除缓存（DELETE FROM ai_reports WHERE ...）
3. 查 ai_reports 缓存 → 命中 → 直接返回（不计数、不限频）
4. 未命中 → rateLimitByUser(userId, 'ai', 20, 24h)  ← 此处计数
5. aggregateData → callLLM → 存缓存 → 返回
```

> 限频放在缓存未命中之后，确保缓存命中时不浪费配额。
> regenerate 先删缓存再走正常流程，这样 step 3 必然 miss，step 4 正常限频，不会绕过配额。

### 8.2 模型选择策略

| 功能 | 推荐模型 | 原因 |
|------|----------|------|
| 智能匹配 | DeepSeek | 输入短，判断简单 |
| AI 快速记账 | DeepSeek | 输入短、输出短，成本极低 |
| 月度报告 | Gemini | 数据量大，需要高质量分析 |
| 年度报告 | Gemini | 数据量最大，需最好质量 |

### 8.3 Token 控制

- 快速记账：maxTokens = 256
- 月度报告：maxTokens = 1024
- 年度报告：maxTokens = 1024
- 只发送聚合数据，不发送原始记录

---

## 九、类型定义

### 9.1 服务端类型 — `server/types/index.ts`

```typescript
// AI 报告行
export interface AiReportRow {
  id: number
  user_id: number
  report_type: 'monthly' | 'yearly'
  year: number
  month: number  // 月度 1-12，年度 0
  content: Record<string, any>  // mysql2 对 JSON 列自动解析为对象
  created_at: string
}
```

### 9.2 客户端类型 — `types/index.ts`

```typescript
// AI 快速记账解析结果
export interface AiQuickEntryResult {
  amount: number
  type: 'income' | 'expense'
  category_name: string
  date: string
  note: string
  confidence: number
}

// AI 月度报告
export interface AiMonthlyReport {
  finance_insight: string
  finance_suggestion: string
  todo_insight: string
  idea_insight: string
  date_reminder: string
  summary: string
  keywords: string[]
}

// AI 年度报告
export interface AiYearlyReport {
  finance_summary: string
  finance_monthly_trend: string
  todo_summary: string
  idea_summary: string
  highlights: string
  summary: string
  keywords: string[]
}

// AI 报告响应
export interface AiReportResponse {
  cached: boolean
  report_type: 'monthly' | 'yearly'
  report: AiMonthlyReport | AiYearlyReport
  generated_at: string
}
```

---

## 十、文件清单

### 新建文件

| 文件 | 说明 |
|------|------|
| `server/utils/llm.ts` | 共享 LLM 调用工具（callLLM + extractJSON） |
| `server/utils/ai-data-aggregator.ts` | 数据聚合（月度 + 年度） |
| `server/utils/models/ai-report.model.ts` | AI 报告缓存 Model |
| `server/api/ai/quick-entry.post.ts` | AI 快速记账 API |
| `server/api/ai/report/monthly.post.ts` | 月度报告 API |
| `server/api/ai/report/yearly.post.ts` | 年度报告 API |
| `components/AiQuickEntry.vue` | AI 快速记账组件 |
| `pages/ai/report.vue` | AI 报告页面（月度+年度） |
| `prompts/月度报告提示词.md` | 月度报告 prompt |
| `prompts/年度报告提示词.md` | 年度报告 prompt |
| `scripts/migrate-003-ai.sql` | 数据库迁移脚本 |

### 修改文件

| 文件 | 变更 |
|------|------|
| `server/api/match/smart-suggest.post.ts` | 添加 `requirePremium` + 重构使用 `callLLM`（保留现有 IP 维度限频不变） |
| `server/utils/rate-limiter.ts` | 新增 `rateLimitByUser()` 用户维度限频函数 |
| `server/types/index.ts` | 添加 `AiReportRow` 类型 |
| `types/index.ts` | 添加 `AiQuickEntryResult`、`AiMonthlyReport`、`AiYearlyReport`、`AiReportResponse` |
| `pages/finance/index.vue` | 添加 AI 快速记账入口按钮 |
| `pages/more/index.vue` | 添加 AI 报告入口 |

### 测试文件

| 文件 | 说明 |
|------|------|
| `tests/unit/llm-utils.test.ts` | LLM 工具函数测试 |
| `tests/unit/ai-quick-entry.test.ts` | AI 快速记账 API 测试 |
| `tests/unit/ai-report.test.ts` | AI 报告 API + 缓存测试 |
| `tests/e2e/ai.spec.ts` | AI 功能 E2E 测试 |

---

## 十一、开发量估算

| 任务 | 时间 |
|------|------|
| 共享 LLM 工具函数 (`llm.ts`) | 1-2h |
| 智能匹配加 Premium 校验 + 重构 | 0.5h |
| AI 快速记账（API + Prompt + 前端组件） | 3-4h |
| AI 月度报告（聚合 + Prompt + API + 页面） | 4-5h |
| AI 年度报告（聚合 + Prompt + API + 页面） | 2-3h |
| 报告缓存 Model + 迁移脚本 | 1h |
| 频率限制整合 | 0.5h |
| 单元测试 | 2-3h |
| E2E 测试 | 1h |
| **合计** | **约 15-20h** |
