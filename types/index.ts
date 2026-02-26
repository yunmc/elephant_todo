// ==================== User ====================
export interface User {
  id: number
  username: string
  email: string
  created_at: string
  updated_at: string
}

export interface AuthTokens {
  accessToken: string
  refreshToken: string
}

export interface LoginForm {
  email: string
  password: string
}

export interface RegisterForm {
  username: string
  email: string
  password: string
  confirmPassword: string
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
