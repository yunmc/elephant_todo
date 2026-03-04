// ==================== User ====================
export interface User {
  id: number
  username: string
  email: string
  plan: 'free' | 'premium'
  plan_expires_at: string | null
  auto_renew: boolean
  created_at: string
  updated_at: string
}

// ==================== Admin User ====================
export interface AdminUser {
  id: number
  username: string
  email: string
  role: 'operator' | 'super_admin'
  last_login_at: string | null
  created_at: string
  updated_at: string
}

export interface AuthTokens {
  accessToken: string
  refreshToken: string
}

// ==================== Category ====================
export interface Category {
  id: number
  name: string
  color: string
  created_at: string
}

// ==================== Tag ====================
export interface Tag {
  id: number
  name: string
  created_at: string
}

// ==================== Todo ====================
export interface Todo {
  id: number
  user_id: number
  category_id: number | null
  title: string
  description: string | null
  priority: 'high' | 'medium' | 'low'
  status: 'pending' | 'completed'
  due_date: string | null
  completed_at: string | null
  created_at: string
  updated_at: string
  tags?: Tag[]
  ideas_count?: number
  category_name?: string
  category_color?: string
}

export interface TodoFilters {
  status?: 'pending' | 'completed'
  priority?: 'high' | 'medium' | 'low'
  category_id?: number
  tag_id?: number
  search?: string
  due_filter?: 'today' | 'week' | 'overdue'
  due_date_start?: string
  due_date_end?: string
  sort_by?: 'created_at' | 'due_date' | 'priority'
  sort_order?: 'asc' | 'desc'
  page?: number
  limit?: number
}

// ==================== Idea ====================
export interface Idea {
  id: number
  user_id: number
  todo_id: number | null
  content: string
  source: 'text' | 'voice'
  created_at: string
  updated_at: string
  todo_title?: string
}

export interface IdeaFilters {
  linked?: 'true' | 'false'
  source?: 'text' | 'voice'
  search?: string
  page?: number
  limit?: number
}

// ==================== Subtask ====================
export interface Subtask {
  id: number
  todo_id: number
  title: string
  status: 'pending' | 'completed'
  sort_order: number
  created_at: string
  updated_at: string
}

// ==================== Vault ====================
export interface VaultGroup {
  id: number
  name: string
  icon: string | null
  sort_order: number
  created_at: string
}

export interface VaultEntry {
  id: number
  group_id: number | null
  name: string
  url: string | null
  encrypted_data: string
  created_at: string
  updated_at: string
}

/** Decrypted vault entry data (client-side only) */
export interface VaultDecryptedData {
  username: string
  password: string
  notes: string
}

// ==================== Match ====================
export interface SimilarTodo {
  id: number
  title: string
  similarity: number
  reason: string
}

export interface SmartSuggestResult {
  similar_todos: SimilarTodo[]
}

// ==================== Finance ====================
export interface FinanceCategory {
  id: number
  name: string
  icon: string
  type: 'income' | 'expense'
  sort_order: number
  created_at: string
}

export interface FinanceRecord {
  id: number
  category_id: number | null
  type: 'income' | 'expense'
  amount: number
  note: string | null
  record_date: string
  created_at: string
  updated_at: string
  category_name?: string
  category_icon?: string
}

export interface FinanceFilters {
  type?: 'income' | 'expense'
  category_id?: number
  start_date?: string
  end_date?: string
  page?: number
  limit?: number
}

export interface FinanceStatistics {
  total_income: number
  total_expense: number
  balance: number
  by_category: { category_id: number | null; category_name: string; category_icon: string; type: string; total: number }[]
}

// ==================== Important Date ====================
export interface ImportantDate {
  id: number
  title: string
  date: string
  is_lunar: boolean
  repeat_type: 'none' | 'monthly' | 'yearly'
  remind_days_before: number
  icon: string
  note: string | null
  created_at: string
  updated_at: string
  days_until?: number
}

// ==================== Period ====================
export interface PeriodRecord {
  id: number
  person_name: string
  start_date: string
  end_date: string | null
  cycle_length: number | null
  period_length: number | null
  flow_level: 'light' | 'moderate' | 'heavy'
  symptoms: string[] | null
  note: string | null
  created_at: string
  updated_at: string
}

export interface PeriodPrediction {
  next_period_start: string
  next_period_end: string
  average_cycle_length: number
  average_period_length: number
  fertile_window_start: string
  fertile_window_end: string
}

// ==================== Shop ====================
export interface ShopProduct {
  id: number
  type: 'skin' | 'sticker_pack' | 'font' | 'pet_skin' | 'bundle'
  name: string
  description: string | null
  price: number
  preview_url: string | null
  asset_key: string
  is_free: boolean
  is_limited: boolean
  limited_start: string | null
  limited_end: string | null
  sort_order: number
  status: 'active' | 'hidden'
  // 前端附加字段（API 返回时拼装）
  owned?: boolean
  bundle_items?: ShopProduct[]
}

export interface UserWallet {
  balance: number
  total_earned: number
  total_spent: number
}

export interface WalletTransaction {
  id: number
  type: 'recharge' | 'purchase' | 'reward' | 'refund'
  amount: number
  balance_after: number
  reference_type: string | null
  reference_id: number | null
  description: string | null
  created_at: string
}

export interface UserProduct {
  id: number
  product_id: number
  product: ShopProduct
  purchased_at: string
  source: 'purchase' | 'bundle' | 'gift' | 'reward'
}

export interface UserAppearance {
  skin_id: number | null
  sticker_pack_id: number | null
  font_id: number | null
  // 前端附加：关联的商品信息
  skin: ShopProduct | null
  sticker_pack: ShopProduct | null
  font: ShopProduct | null
}

// ==================== AI ====================
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

// ==================== Finance Budget ====================
export interface FinanceBudget {
  id: number
  category_id: number | null
  year_month: string
  amount: number
  created_at: string
  updated_at: string
  category_name?: string
  category_icon?: string
}

export interface BudgetProgress {
  total_budget: number
  total_spent: number
  percentage: number
  remaining: number
  days_left: number
  daily_remaining: number
  categories: BudgetCategoryProgress[]
}

export interface BudgetCategoryProgress {
  category_id: number | null
  category_name: string
  category_icon: string
  budget: number
  spent: number
  percentage: number
  status: 'normal' | 'warning' | 'over'
}

// ==================== API Response ====================
export interface ApiResponse<T = any> {
  success: boolean
  data?: T
  message?: string
  pagination?: Pagination
}

export interface Pagination {
  page: number
  limit: number
  total: number
  totalPages: number
}
