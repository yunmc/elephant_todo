import type { RowDataPacket } from 'mysql2'

// ==================== User ====================
export interface UserRow extends RowDataPacket {
  id: number
  username: string
  email: string
  password: string
  plan: 'free' | 'premium'
  plan_expires_at: Date | null
  auto_renew: boolean
  vault_salt: string | null
  created_at: Date
  updated_at: Date
}

export interface CreateUserDTO {
  username: string
  email: string
  password: string
}

// ==================== Admin User ====================
export interface AdminUserRow extends RowDataPacket {
  id: number
  username: string
  email: string
  password: string
  role: 'operator' | 'super_admin'
  last_login_at: Date | null
  created_at: Date
  updated_at: Date
}

// ==================== Premium Order ====================
export interface PremiumOrderRow extends RowDataPacket {
  id: number
  user_id: number
  order_no: string
  plan_type: 'monthly' | 'yearly'
  amount: number
  status: 'pending' | 'paid' | 'expired' | 'refunded'
  payment_method: string | null
  apple_transaction_id: string | null
  apple_original_transaction_id: string | null
  apple_product_id: string | null
  is_auto_renew: boolean
  paid_at: Date | null
  starts_at: Date | null
  expires_at: Date
  created_at: Date
  updated_at: Date
}

// ==================== Category ====================
export interface CategoryRow extends RowDataPacket {
  id: number
  user_id: number
  name: string
  color: string
  created_at: Date
}

export interface CreateCategoryDTO {
  name: string
  color?: string
}

export interface UpdateCategoryDTO {
  name?: string
  color?: string
}

// ==================== Todo ====================
export interface TodoRow extends RowDataPacket {
  id: number
  user_id: number
  category_id: number | null
  title: string
  description: string | null
  priority: 'high' | 'medium' | 'low'
  status: 'pending' | 'completed'
  due_date: Date | null
  completed_at: Date | null
  created_at: Date
  updated_at: Date
}

export interface CreateTodoDTO {
  title: string
  description?: string
  priority?: 'high' | 'medium' | 'low'
  category_id?: number
  due_date?: string
  tag_ids?: number[]
}

export interface UpdateTodoDTO {
  title?: string
  description?: string
  priority?: 'high' | 'medium' | 'low'
  category_id?: number | null
  due_date?: string | null
  tag_ids?: number[]
}

export interface TodoQueryParams {
  status?: 'pending' | 'completed'
  priority?: 'high' | 'medium' | 'low'
  category_id?: number
  tag_id?: number
  search?: string
  due_date_start?: string
  due_date_end?: string
  due_filter?: 'today' | 'week' | 'overdue'
  page?: number
  limit?: number
  sort_by?: 'created_at' | 'due_date' | 'priority'
  sort_order?: 'asc' | 'desc'
}

// ==================== Tag ====================
export interface TagRow extends RowDataPacket {
  id: number
  user_id: number
  name: string
  created_at: Date
}

export interface CreateTagDTO {
  name: string
}

export interface UpdateTagDTO {
  name: string
}

// ==================== Idea ====================
export interface IdeaRow extends RowDataPacket {
  id: number
  user_id: number
  todo_id: number | null
  content: string
  source: 'text' | 'voice'
  todo_title?: string
  created_at: Date
  updated_at: Date
}

export interface CreateIdeaDTO {
  content: string
  source?: 'text' | 'voice'
  todo_id?: number
}

export interface UpdateIdeaDTO {
  content?: string
}

export interface IdeaQueryParams {
  linked?: 'true' | 'false'
  source?: 'text' | 'voice'
  search?: string
  page?: number
  limit?: number
}

// ==================== Vault ====================
export interface VaultGroupRow extends RowDataPacket {
  id: number
  user_id: number
  name: string
  icon: string | null
  sort_order: number
  created_at: Date
}

export interface CreateVaultGroupDTO {
  name: string
  icon?: string
  sort_order?: number
}

export interface UpdateVaultGroupDTO {
  name?: string
  icon?: string
  sort_order?: number
}

export interface VaultEntryRow extends RowDataPacket {
  id: number
  user_id: number
  group_id: number | null
  name: string
  url: string | null
  encrypted_data: string
  created_at: Date
  updated_at: Date
}

export interface CreateVaultEntryDTO {
  name: string
  url?: string
  group_id?: number
  encrypted_data: string
}

export interface UpdateVaultEntryDTO {
  name?: string
  url?: string
  group_id?: number | null
  encrypted_data?: string
}

export interface VaultEntryBatchUpdateItem {
  id: number
  encrypted_data: string
}

export interface VaultQueryParams {
  group_id?: number
  search?: string
  page?: number
  limit?: number
}

// ==================== Subtask ====================
export interface SubtaskRow extends RowDataPacket {
  id: number
  todo_id: number
  title: string
  status: 'pending' | 'completed'
  sort_order: number
  created_at: Date
  updated_at: Date
}

export interface CreateSubtaskDTO {
  title: string
  sort_order?: number
}

export interface UpdateSubtaskDTO {
  title?: string
  status?: 'pending' | 'completed'
  sort_order?: number
}

// ==================== Password Reset ====================
export interface PasswordResetTokenRow extends RowDataPacket {
  id: number
  user_id: number
  token: string
  expires_at: Date
  used: boolean
  created_at: Date
}

// ==================== Finance ====================
export interface FinanceCategoryRow extends RowDataPacket {
  id: number
  user_id: number
  name: string
  icon: string
  type: 'income' | 'expense'
  sort_order: number
  created_at: Date
}

export interface CreateFinanceCategoryDTO {
  name: string
  icon?: string
  type: 'income' | 'expense'
  sort_order?: number
}

export interface UpdateFinanceCategoryDTO {
  name?: string
  icon?: string
  type?: 'income' | 'expense'
  sort_order?: number
}

export interface FinanceRecordRow extends RowDataPacket {
  id: number
  user_id: number
  category_id: number | null
  type: 'income' | 'expense'
  amount: number
  note: string | null
  record_date: Date
  created_at: Date
  updated_at: Date
}

export interface CreateFinanceRecordDTO {
  category_id?: number
  type: 'income' | 'expense'
  amount: number
  note?: string
  record_date: string
}

export interface UpdateFinanceRecordDTO {
  category_id?: number | null
  type?: 'income' | 'expense'
  amount?: number
  note?: string
  record_date?: string
}

export interface FinanceQueryParams {
  type?: 'income' | 'expense'
  category_id?: number
  start_date?: string
  end_date?: string
  page?: number
  limit?: number
}

// ==================== Important Date ====================
export interface ImportantDateRow extends RowDataPacket {
  id: number
  user_id: number
  title: string
  date: Date
  is_lunar: boolean
  repeat_type: 'none' | 'monthly' | 'yearly'
  remind_days_before: number
  icon: string
  note: string | null
  created_at: Date
  updated_at: Date
}

export interface CreateImportantDateDTO {
  title: string
  date: string
  is_lunar?: boolean
  repeat_type?: 'none' | 'monthly' | 'yearly'
  remind_days_before?: number
  icon?: string
  note?: string
}

export interface UpdateImportantDateDTO {
  title?: string
  date?: string
  is_lunar?: boolean
  repeat_type?: 'none' | 'monthly' | 'yearly'
  remind_days_before?: number
  icon?: string
  note?: string
}

// ==================== Period ====================
export interface PeriodRecordRow extends RowDataPacket {
  id: number
  user_id: number
  person_name: string
  start_date: Date
  end_date: Date | null
  cycle_length: number | null
  period_length: number | null
  flow_level: 'light' | 'moderate' | 'heavy'
  symptoms: string[] | null
  note: string | null
  created_at: Date
  updated_at: Date
}

export interface CreatePeriodRecordDTO {
  person_name?: string
  start_date: string
  end_date?: string
  flow_level?: 'light' | 'moderate' | 'heavy'
  symptoms?: string[]
  note?: string
}

export interface UpdatePeriodRecordDTO {
  person_name?: string
  start_date?: string
  end_date?: string | null
  flow_level?: 'light' | 'moderate' | 'heavy'
  symptoms?: string[]
  note?: string
}

// ==================== Shop ====================
export interface ShopProductRow extends RowDataPacket {
  id: number
  type: 'skin' | 'sticker_pack' | 'font' | 'pet_skin' | 'bundle'
  name: string
  description: string | null
  price: number
  preview_url: string | null
  asset_key: string
  is_free: boolean
  is_limited: boolean
  limited_start: Date | null
  limited_end: Date | null
  sort_order: number
  status: 'active' | 'hidden'
  created_at: Date
  updated_at: Date
}

export interface ShopBundleItemRow extends RowDataPacket {
  id: number
  bundle_id: number
  product_id: number
}

export interface UserWalletRow extends RowDataPacket {
  user_id: number
  balance: number
  total_earned: number
  total_spent: number
  updated_at: Date
}

export interface WalletTransactionRow extends RowDataPacket {
  id: number
  user_id: number
  type: 'recharge' | 'purchase' | 'reward' | 'refund'
  amount: number
  balance_after: number
  reference_type: string | null
  reference_id: number | null
  description: string | null
  created_at: Date
}

export interface UserProductRow extends RowDataPacket {
  id: number
  user_id: number
  product_id: number
  purchased_at: Date
  source: 'purchase' | 'bundle' | 'gift' | 'reward'
}

export interface UserAppearanceRow extends RowDataPacket {
  user_id: number
  skin_id: number | null
  sticker_pack_id: number | null
  font_id: number | null
  updated_at: Date
}
