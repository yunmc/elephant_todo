import type { RowDataPacket } from 'mysql2'

// ==================== User ====================
export interface UserRow extends RowDataPacket {
  id: number
  username: string
  email: string
  password: string
  vault_salt: string | null
  created_at: Date
  updated_at: Date
}

export interface CreateUserDTO {
  username: string
  email: string
  password: string
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
  repeat_yearly: boolean
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
  repeat_yearly?: boolean
  remind_days_before?: number
  icon?: string
  note?: string
}

export interface UpdateImportantDateDTO {
  title?: string
  date?: string
  is_lunar?: boolean
  repeat_yearly?: boolean
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
