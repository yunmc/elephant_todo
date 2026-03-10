/**
 * Drizzle ORM Schema — Elephant Todo
 *
 * Defines all 25 tables across init-db + 5 migrations.
 * Property names use snake_case to match existing DB column names & API types.
 */
import {
  mysqlTable, int, varchar, text, datetime, date, boolean, json,
  mysqlEnum, decimal, tinyint, timestamp, uniqueIndex, index, primaryKey,
} from 'drizzle-orm/mysql-core'
import { sql } from 'drizzle-orm'

// ══════════════════════════════════════════════════════════════
// 1. users
// ══════════════════════════════════════════════════════════════

export const users = mysqlTable('users', {
  id: int('id').autoincrement().primaryKey(),
  username: varchar('username', { length: 50 }).notNull(),
  email: varchar('email', { length: 100 }).notNull(),
  password: varchar('password', { length: 255 }).notNull(),
  plan: mysqlEnum('plan', ['free', 'premium']).notNull().default('free'),
  plan_expires_at: datetime('plan_expires_at'),
  auto_renew: tinyint('auto_renew').notNull().default(0),
  vault_salt: varchar('vault_salt', { length: 50 }),
  created_at: datetime('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
  updated_at: datetime('updated_at').notNull().default(sql`CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP`),
}, (t) => [
  uniqueIndex('uk_users_username').on(t.username),
  uniqueIndex('uk_users_email').on(t.email),
])

// ══════════════════════════════════════════════════════════════
// 2. categories
// ══════════════════════════════════════════════════════════════

export const categories = mysqlTable('categories', {
  id: int('id').autoincrement().primaryKey(),
  user_id: int('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 50 }).notNull(),
  color: varchar('color', { length: 20 }).default('#999999'),
  created_at: datetime('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
}, (t) => [
  uniqueIndex('uk_categories_user_name').on(t.user_id, t.name),
  index('idx_categories_user_id').on(t.user_id),
])

// ══════════════════════════════════════════════════════════════
// 3. todos
// ══════════════════════════════════════════════════════════════

export const todos = mysqlTable('todos', {
  id: int('id').autoincrement().primaryKey(),
  user_id: int('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  category_id: int('category_id').references(() => categories.id, { onDelete: 'set null' }),
  title: varchar('title', { length: 200 }).notNull(),
  description: text('description'),
  priority: mysqlEnum('priority', ['high', 'medium', 'low']).notNull().default('medium'),
  status: mysqlEnum('status', ['pending', 'completed']).notNull().default('pending'),
  due_date: datetime('due_date'),
  completed_at: datetime('completed_at'),
  created_at: datetime('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
  updated_at: datetime('updated_at').notNull().default(sql`CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP`),
  embedding: json('embedding'),
}, (t) => [
  index('idx_todos_user_id').on(t.user_id),
  index('idx_todos_category_id').on(t.category_id),
  index('idx_todos_user_status').on(t.user_id, t.status),
  index('idx_todos_user_priority').on(t.user_id, t.priority),
  index('idx_todos_user_due_date').on(t.user_id, t.due_date),
])

// ══════════════════════════════════════════════════════════════
// 4. tags
// ══════════════════════════════════════════════════════════════

export const tags = mysqlTable('tags', {
  id: int('id').autoincrement().primaryKey(),
  user_id: int('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 50 }).notNull(),
  color: varchar('color', { length: 20 }).default('#999999'),
  created_at: datetime('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
}, (t) => [
  uniqueIndex('uk_tags_user_name').on(t.user_id, t.name),
  index('idx_tags_user_id').on(t.user_id),
])

// ══════════════════════════════════════════════════════════════
// 5. ideas
// ══════════════════════════════════════════════════════════════

export const ideas = mysqlTable('ideas', {
  id: int('id').autoincrement().primaryKey(),
  user_id: int('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  todo_id: int('todo_id').references(() => todos.id, { onDelete: 'set null' }),
  content: text('content').notNull(),
  source: mysqlEnum('source', ['text', 'voice']).notNull().default('text'),
  embedding: json('embedding'),
  created_at: datetime('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
  updated_at: datetime('updated_at').notNull().default(sql`CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP`),
}, (t) => [
  index('idx_ideas_user_id').on(t.user_id),
  index('idx_ideas_todo_id').on(t.todo_id),
  index('idx_ideas_user_created').on(t.user_id, t.created_at),
])

// ══════════════════════════════════════════════════════════════
// 6. todo_tags (junction)
// ══════════════════════════════════════════════════════════════

export const todoTags = mysqlTable('todo_tags', {
  todo_id: int('todo_id').notNull().references(() => todos.id, { onDelete: 'cascade' }),
  tag_id: int('tag_id').notNull().references(() => tags.id, { onDelete: 'cascade' }),
}, (t) => [
  primaryKey({ columns: [t.todo_id, t.tag_id] }),
  index('idx_todo_tags_tag_id').on(t.tag_id),
])

// ══════════════════════════════════════════════════════════════
// 7. subtasks
// ══════════════════════════════════════════════════════════════

export const subtasks = mysqlTable('subtasks', {
  id: int('id').autoincrement().primaryKey(),
  todo_id: int('todo_id').notNull().references(() => todos.id, { onDelete: 'cascade' }),
  title: varchar('title', { length: 200 }).notNull(),
  status: mysqlEnum('status', ['pending', 'completed']).notNull().default('pending'),
  sort_order: int('sort_order').notNull().default(0),
  created_at: datetime('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
  updated_at: datetime('updated_at').notNull().default(sql`CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP`),
}, (t) => [
  index('idx_subtasks_todo_id').on(t.todo_id),
])

// ══════════════════════════════════════════════════════════════
// 8. vault_groups
// ══════════════════════════════════════════════════════════════

export const vaultGroups = mysqlTable('vault_groups', {
  id: int('id').autoincrement().primaryKey(),
  user_id: int('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 50 }).notNull(),
  icon: varchar('icon', { length: 50 }),
  sort_order: int('sort_order').notNull().default(0),
  created_at: datetime('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
}, (t) => [
  uniqueIndex('uk_vault_groups_user_name').on(t.user_id, t.name),
  index('idx_vault_groups_user_id').on(t.user_id),
])

// ══════════════════════════════════════════════════════════════
// 9. vault_entries
// ══════════════════════════════════════════════════════════════

export const vaultEntries = mysqlTable('vault_entries', {
  id: int('id').autoincrement().primaryKey(),
  user_id: int('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  group_id: int('group_id').references(() => vaultGroups.id, { onDelete: 'set null' }),
  name: varchar('name', { length: 200 }).notNull(),
  url: varchar('url', { length: 500 }),
  encrypted_data: text('encrypted_data').notNull(),
  created_at: datetime('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
  updated_at: datetime('updated_at').notNull().default(sql`CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP`),
}, (t) => [
  index('idx_vault_entries_user_id').on(t.user_id),
  index('idx_vault_entries_group_id').on(t.group_id),
  index('idx_vault_entries_user_name').on(t.user_id, t.name),
])

// ══════════════════════════════════════════════════════════════
// 10. password_reset_tokens
// ══════════════════════════════════════════════════════════════

export const passwordResetTokens = mysqlTable('password_reset_tokens', {
  id: int('id').autoincrement().primaryKey(),
  user_id: int('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  token: varchar('token', { length: 255 }).notNull(),
  expires_at: datetime('expires_at').notNull(),
  used: boolean('used').notNull().default(false),
  created_at: datetime('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
}, (t) => [
  uniqueIndex('uk_reset_tokens_token').on(t.token),
  index('idx_reset_tokens_user_id').on(t.user_id),
])

// ══════════════════════════════════════════════════════════════
// 11. finance_categories
// ══════════════════════════════════════════════════════════════

export const financeCategories = mysqlTable('finance_categories', {
  id: int('id').autoincrement().primaryKey(),
  user_id: int('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 50 }).notNull(),
  icon: varchar('icon', { length: 50 }).default('💰'),
  type: mysqlEnum('type', ['income', 'expense']).notNull().default('expense'),
  sort_order: int('sort_order').notNull().default(0),
  created_at: datetime('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
}, (t) => [
  uniqueIndex('uk_finance_categories_user_name_type').on(t.user_id, t.name, t.type),
  index('idx_finance_categories_user_id').on(t.user_id),
])

// ══════════════════════════════════════════════════════════════
// 12. finance_records
// ══════════════════════════════════════════════════════════════

export const financeRecords = mysqlTable('finance_records', {
  id: int('id').autoincrement().primaryKey(),
  user_id: int('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  category_id: int('category_id').references(() => financeCategories.id, { onDelete: 'set null' }),
  type: mysqlEnum('type', ['income', 'expense']).notNull().default('expense'),
  amount: decimal('amount', { precision: 12, scale: 2 }).notNull(),
  note: varchar('note', { length: 500 }),
  record_date: date('record_date').notNull(),
  created_at: datetime('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
  updated_at: datetime('updated_at').notNull().default(sql`CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP`),
}, (t) => [
  index('idx_finance_records_user_id').on(t.user_id),
  index('idx_finance_records_category_id').on(t.category_id),
  index('idx_finance_records_user_date').on(t.user_id, t.record_date),
  index('idx_finance_records_user_type').on(t.user_id, t.type),
])

// ══════════════════════════════════════════════════════════════
// 13. finance_budgets (migrate-004)
// ══════════════════════════════════════════════════════════════

export const financeBudgets = mysqlTable('finance_budgets', {
  id: int('id').autoincrement().primaryKey(),
  user_id: int('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  category_id: int('category_id').references(() => financeCategories.id, { onDelete: 'cascade' }),
  year_month: varchar('year_month', { length: 7 }).notNull(),
  amount: decimal('amount', { precision: 12, scale: 2 }).notNull(),
  created_at: datetime('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
  updated_at: datetime('updated_at').notNull().default(sql`CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP`),
}, (t) => [
  index('idx_budgets_user').on(t.user_id),
  uniqueIndex('uk_budgets_user_month_cat').on(t.user_id, t.category_id, t.year_month),
])

// ══════════════════════════════════════════════════════════════
// 14. important_dates
// ══════════════════════════════════════════════════════════════

export const importantDates = mysqlTable('important_dates', {
  id: int('id').autoincrement().primaryKey(),
  user_id: int('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  title: varchar('title', { length: 200 }).notNull(),
  date: date('date').notNull(),
  is_lunar: boolean('is_lunar').notNull().default(false),
  repeat_type: varchar('repeat_type', { length: 20 }).notNull().default('none'),
  remind_days_before: int('remind_days_before').notNull().default(0),
  icon: varchar('icon', { length: 50 }).default('📅'),
  note: text('note'),
  created_at: datetime('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
  updated_at: datetime('updated_at').notNull().default(sql`CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP`),
}, (t) => [
  index('idx_important_dates_user_id').on(t.user_id),
  index('idx_important_dates_user_date').on(t.user_id, t.date),
])

// ══════════════════════════════════════════════════════════════
// 15. period_records
// ══════════════════════════════════════════════════════════════

export const periodRecords = mysqlTable('period_records', {
  id: int('id').autoincrement().primaryKey(),
  user_id: int('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  person_name: varchar('person_name', { length: 50 }).notNull().default('我'),
  start_date: date('start_date').notNull(),
  end_date: date('end_date'),
  cycle_length: int('cycle_length'),
  period_length: int('period_length'),
  flow_level: mysqlEnum('flow_level', ['light', 'moderate', 'heavy']).default('moderate'),
  symptoms: json('symptoms'),
  note: text('note'),
  created_at: datetime('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
  updated_at: datetime('updated_at').notNull().default(sql`CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP`),
}, (t) => [
  index('idx_period_records_user_id').on(t.user_id),
  index('idx_period_records_user_date').on(t.user_id, t.start_date),
  index('idx_period_records_user_person').on(t.user_id, t.person_name),
])

// ══════════════════════════════════════════════════════════════
// 16. admin_users (migrate-001)
// ══════════════════════════════════════════════════════════════

export const adminUsers = mysqlTable('admin_users', {
  id: int('id').autoincrement().primaryKey(),
  username: varchar('username', { length: 50 }).notNull(),
  email: varchar('email', { length: 100 }).notNull(),
  password: varchar('password', { length: 255 }).notNull(),
  role: mysqlEnum('role', ['operator', 'super_admin']).notNull().default('operator'),
  last_login_at: datetime('last_login_at'),
  created_at: datetime('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
  updated_at: datetime('updated_at').notNull().default(sql`CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP`),
}, (t) => [
  uniqueIndex('uk_admin_username').on(t.username),
  uniqueIndex('uk_admin_email').on(t.email),
])

// ══════════════════════════════════════════════════════════════
// 17. premium_orders (migrate-001)
// ══════════════════════════════════════════════════════════════

export const premiumOrders = mysqlTable('premium_orders', {
  id: int('id').autoincrement().primaryKey(),
  user_id: int('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  order_no: varchar('order_no', { length: 64 }).notNull(),
  plan_type: mysqlEnum('plan_type', ['monthly', 'yearly']).notNull(),
  amount: decimal('amount', { precision: 10, scale: 2 }).notNull(),
  status: mysqlEnum('status', ['pending', 'paid', 'expired', 'refunded']).notNull().default('pending'),
  payment_method: varchar('payment_method', { length: 20 }),
  apple_transaction_id: varchar('apple_transaction_id', { length: 128 }),
  apple_original_transaction_id: varchar('apple_original_transaction_id', { length: 128 }),
  apple_product_id: varchar('apple_product_id', { length: 64 }),
  is_auto_renew: tinyint('is_auto_renew').notNull().default(0),
  paid_at: datetime('paid_at'),
  starts_at: datetime('starts_at'),
  expires_at: datetime('expires_at').notNull(),
  created_at: datetime('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
  updated_at: datetime('updated_at').notNull().default(sql`CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP`),
}, (t) => [
  uniqueIndex('uk_order_no').on(t.order_no),
  index('idx_orders_user').on(t.user_id),
  index('idx_orders_status').on(t.status),
  index('idx_apple_original_txn').on(t.apple_original_transaction_id),
])

// ══════════════════════════════════════════════════════════════
// 18. shop_products (migrate-002)
// ══════════════════════════════════════════════════════════════

export const shopProducts = mysqlTable('shop_products', {
  id: int('id').autoincrement().primaryKey(),
  type: mysqlEnum('type', ['skin', 'sticker_pack', 'font', 'pet_skin', 'bundle']).notNull(),
  name: varchar('name', { length: 50 }).notNull(),
  description: varchar('description', { length: 200 }),
  price: int('price').notNull(),
  preview_url: varchar('preview_url', { length: 500 }),
  asset_key: varchar('asset_key', { length: 100 }).notNull(),
  is_free: tinyint('is_free').notNull().default(0),
  is_limited: tinyint('is_limited').notNull().default(0),
  limited_start: datetime('limited_start'),
  limited_end: datetime('limited_end'),
  sort_order: int('sort_order').notNull().default(0),
  status: mysqlEnum('status', ['active', 'hidden']).notNull().default('active'),
  created_at: datetime('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
  updated_at: datetime('updated_at').notNull().default(sql`CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP`),
}, (t) => [
  uniqueIndex('uk_asset_key').on(t.asset_key),
  index('idx_products_type').on(t.type),
  index('idx_products_status').on(t.status),
])

// ══════════════════════════════════════════════════════════════
// 19. shop_bundle_items (migrate-002)
// ══════════════════════════════════════════════════════════════

export const shopBundleItems = mysqlTable('shop_bundle_items', {
  id: int('id').autoincrement().primaryKey(),
  bundle_id: int('bundle_id').notNull().references(() => shopProducts.id, { onDelete: 'cascade' }),
  product_id: int('product_id').notNull().references(() => shopProducts.id, { onDelete: 'cascade' }),
}, (t) => [
  uniqueIndex('uk_bundle_product').on(t.bundle_id, t.product_id),
])

// ══════════════════════════════════════════════════════════════
// 20. user_wallets (migrate-002)
// ══════════════════════════════════════════════════════════════

export const userWallets = mysqlTable('user_wallets', {
  user_id: int('user_id').primaryKey().references(() => users.id, { onDelete: 'cascade' }),
  balance: int('balance').notNull().default(0),
  total_earned: int('total_earned').notNull().default(0),
  total_spent: int('total_spent').notNull().default(0),
  updated_at: datetime('updated_at').notNull().default(sql`CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP`),
})

// ══════════════════════════════════════════════════════════════
// 21. wallet_transactions (migrate-002)
// ══════════════════════════════════════════════════════════════

export const walletTransactions = mysqlTable('wallet_transactions', {
  id: int('id').autoincrement().primaryKey(),
  user_id: int('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  type: mysqlEnum('type', ['recharge', 'purchase', 'reward', 'refund']).notNull(),
  amount: int('amount').notNull(),
  balance_after: int('balance_after').notNull(),
  reference_type: varchar('reference_type', { length: 20 }),
  reference_id: int('reference_id'),
  description: varchar('description', { length: 100 }),
  created_at: datetime('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
}, (t) => [
  index('idx_wallet_tx_user').on(t.user_id, t.created_at),
])

// ══════════════════════════════════════════════════════════════
// 22. user_products (migrate-002)
// ══════════════════════════════════════════════════════════════

export const userProducts = mysqlTable('user_products', {
  id: int('id').autoincrement().primaryKey(),
  user_id: int('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  product_id: int('product_id').notNull().references(() => shopProducts.id, { onDelete: 'cascade' }),
  purchased_at: datetime('purchased_at').notNull().default(sql`CURRENT_TIMESTAMP`),
  source: mysqlEnum('source', ['purchase', 'bundle', 'gift', 'reward']).notNull().default('purchase'),
}, (t) => [
  uniqueIndex('uk_user_product').on(t.user_id, t.product_id),
])

// ══════════════════════════════════════════════════════════════
// 23. user_appearance (migrate-002)
// ══════════════════════════════════════════════════════════════

export const userAppearance = mysqlTable('user_appearance', {
  user_id: int('user_id').primaryKey().references(() => users.id, { onDelete: 'cascade' }),
  skin_id: int('skin_id').references(() => shopProducts.id, { onDelete: 'set null' }),
  sticker_pack_id: int('sticker_pack_id').references(() => shopProducts.id, { onDelete: 'set null' }),
  font_id: int('font_id').references(() => shopProducts.id, { onDelete: 'set null' }),
  updated_at: datetime('updated_at').notNull().default(sql`CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP`),
})

// ══════════════════════════════════════════════════════════════
// 24. ai_reports (migrate-003)
// ══════════════════════════════════════════════════════════════

export const aiReports = mysqlTable('ai_reports', {
  id: int('id').autoincrement().primaryKey(),
  user_id: int('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  report_type: mysqlEnum('report_type', ['monthly', 'yearly']).notNull(),
  year: int('year').notNull(),
  month: int('month').notNull().default(0),
  content: json('content').notNull(),
  created_at: timestamp('created_at').default(sql`CURRENT_TIMESTAMP`),
}, (t) => [
  uniqueIndex('uk_user_report').on(t.user_id, t.report_type, t.year, t.month),
  index('idx_user_type').on(t.user_id, t.report_type),
])

// ══════════════════════════════════════════════════════════════
// 25. admin_activities (migrate-005)
// ══════════════════════════════════════════════════════════════

export const adminActivities = mysqlTable('admin_activities', {
  id: int('id').autoincrement().primaryKey(),
  title: varchar('title', { length: 100 }).notNull(),
  type: mysqlEnum('type', ['sign_in_bonus', 'holiday_event', 'flash_sale', 'custom']).notNull().default('custom'),
  description: text('description'),
  config: json('config'),
  starts_at: datetime('starts_at').notNull(),
  ends_at: datetime('ends_at').notNull(),
  status: mysqlEnum('status', ['draft', 'active', 'ended', 'cancelled']).notNull().default('draft'),
  created_by: int('created_by'),
  created_at: datetime('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
  updated_at: datetime('updated_at').notNull().default(sql`CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP`),
}, (t) => [
  index('idx_activity_status').on(t.status),
  index('idx_activity_dates').on(t.starts_at, t.ends_at),
])

// ══════════════════════════════════════════════════════════════
// 26. checklist_items (migrate-006)
// ══════════════════════════════════════════════════════════════

export const checklistItems = mysqlTable('checklist_items', {
  id: int('id').autoincrement().primaryKey(),
  user_id: int('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  title: varchar('title', { length: 100 }).notNull(),
  icon: varchar('icon', { length: 20 }).default('✅'),
  sort_order: int('sort_order').notNull().default(0),
  is_active: tinyint('is_active').notNull().default(1),
  created_at: datetime('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
  updated_at: datetime('updated_at').notNull().default(sql`CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP`),
}, (t) => [
  index('idx_checklist_items_user').on(t.user_id, t.is_active, t.sort_order),
])

// ══════════════════════════════════════════════════════════════
// 27. checklist_records (migrate-006)
// ══════════════════════════════════════════════════════════════

export const checklistRecords = mysqlTable('checklist_records', {
  id: int('id').autoincrement().primaryKey(),
  item_id: int('item_id').notNull().references(() => checklistItems.id, { onDelete: 'cascade' }),
  user_id: int('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  check_date: date('check_date').notNull(),
  checked_at: datetime('checked_at').notNull().default(sql`CURRENT_TIMESTAMP`),
}, (t) => [
  uniqueIndex('uq_checklist_records_item_date').on(t.item_id, t.check_date),
  index('idx_checklist_records_user_date').on(t.user_id, t.check_date),
  index('idx_checklist_records_item_date').on(t.item_id, t.check_date),
])
