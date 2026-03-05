import { eq, and, sql } from 'drizzle-orm'
import type { ResultSetHeader, RowDataPacket } from 'mysql2'
import type { AdminUserRow } from '~~/server/types'
import { adminUsers, adminActivities } from '../../database/schema'

// ── Admin User Queries ──

export const AdminUserModel = {
  async findByUsername(username: string): Promise<AdminUserRow | null> {
    const rows = await getDb().select().from(adminUsers)
      .where(eq(adminUsers.username, username))
    return (rows[0] as unknown as AdminUserRow) || null
  },

  async findById(id: number): Promise<AdminUserRow | null> {
    const rows = await getDb().select().from(adminUsers)
      .where(eq(adminUsers.id, id))
    return (rows[0] as unknown as AdminUserRow) || null
  },

  async updateLastLogin(id: number): Promise<void> {
    await getDb().update(adminUsers)
      .set({ last_login_at: sql`NOW()` })
      .where(eq(adminUsers.id, id))
  },
}

// ── Admin Dashboard Stats ──

interface StatsRow extends RowDataPacket { count: number }
interface DailyCountRow extends RowDataPacket { date: string; count: number }
interface TopProductRow extends RowDataPacket { id: number; name: string; type: string; sold: number; revenue: number }

export const AdminStatsModel = {
  async totalUsers(): Promise<number> {
    const pool = getPool()
    const [rows] = await pool.query<StatsRow[]>('SELECT COUNT(*) AS count FROM users')
    return rows[0].count
  },

  async premiumUsers(): Promise<number> {
    const pool = getPool()
    const [rows] = await pool.query<StatsRow[]>(
      "SELECT COUNT(*) AS count FROM users WHERE plan = 'premium' AND (plan_expires_at IS NULL OR plan_expires_at > NOW())"
    )
    return rows[0].count
  },

  async todayRegistrations(): Promise<number> {
    const pool = getPool()
    const [rows] = await pool.query<StatsRow[]>(
      'SELECT COUNT(*) AS count FROM users WHERE DATE(created_at) = CURDATE()'
    )
    return rows[0].count
  },

  async todayActiveUsers(): Promise<number> {
    const pool = getPool()
    const [rows] = await pool.query<StatsRow[]>(`
      SELECT COUNT(DISTINCT user_id) AS count FROM (
        SELECT user_id FROM todos WHERE DATE(created_at) = CURDATE()
        UNION SELECT user_id FROM ideas WHERE DATE(created_at) = CURDATE()
        UNION SELECT user_id FROM finance_records WHERE DATE(created_at) = CURDATE()
      ) AS active
    `)
    return rows[0].count
  },

  async registrationTrend(days: number = 30): Promise<DailyCountRow[]> {
    const pool = getPool()
    const [rows] = await pool.query<DailyCountRow[]>(`
      SELECT DATE(created_at) AS date, COUNT(*) AS count
      FROM users
      WHERE created_at >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
      GROUP BY DATE(created_at)
      ORDER BY date ASC
    `, [days])
    return rows
  },

  async totalRevenue(): Promise<{ premiumRevenue: number; shopRevenue: number }> {
    const pool = getPool()
    const [premiumRows] = await pool.query<(RowDataPacket & { total: number })[]>(
      "SELECT COALESCE(SUM(amount), 0) AS total FROM premium_orders WHERE status = 'paid'"
    )
    const premiumRevenue = premiumRows[0].total

    let shopRevenue = 0
    try {
      const [shopRows] = await pool.query<(RowDataPacket & { total: number })[]>(
        "SELECT COALESCE(SUM(ABS(amount)), 0) AS total FROM wallet_transactions WHERE type = 'spend'"
      )
      shopRevenue = shopRows[0].total
    } catch { /* wallet_transactions may not exist */ }

    return { premiumRevenue, shopRevenue }
  },

  async topProducts(limit: number = 10): Promise<TopProductRow[]> {
    const pool = getPool()
    try {
      const [rows] = await pool.query<TopProductRow[]>(`
        SELECT p.id, p.name, p.type,
          COUNT(up.id) AS sold,
          COALESCE(SUM(p.price), 0) AS revenue
        FROM shop_products p
        LEFT JOIN user_products up ON up.product_id = p.id
        GROUP BY p.id
        ORDER BY sold DESC
        LIMIT ?
      `, [limit])
      return rows
    } catch { return [] }
  },

  async moduleUsage(): Promise<Record<string, number>> {
    const pool = getPool()
    const modules: Record<string, string> = {
      todos: 'SELECT COUNT(*) AS count FROM todos',
      ideas: 'SELECT COUNT(*) AS count FROM ideas',
      finance: 'SELECT COUNT(*) AS count FROM finance_records',
      vault: 'SELECT COUNT(*) AS count FROM vault_entries',
      important_dates: 'SELECT COUNT(*) AS count FROM important_dates',
      period: 'SELECT COUNT(*) AS count FROM period_records',
    }
    const result: Record<string, number> = {}
    for (const [key, sqlStr] of Object.entries(modules)) {
      try {
        const [rows] = await pool.query<StatsRow[]>(sqlStr)
        result[key] = rows[0].count
      } catch { result[key] = 0 }
    }
    return result
  },
}

// ── Admin User Management ──

interface UserListRow extends RowDataPacket {
  id: number; username: string; email: string; plan: string
  plan_expires_at: Date | null; created_at: Date; updated_at: Date
  coin_balance: number
  todo_count: number; idea_count: number; finance_count: number
}

export const AdminUserMgmtModel = {
  async list(opts: { page: number; pageSize: number; search?: string; plan?: string }): Promise<{ users: UserListRow[]; total: number }> {
    const pool = getPool()
    let where = 'WHERE 1=1'
    const params: any[] = []

    if (opts.search) {
      where += ' AND (u.username LIKE ? OR u.email LIKE ?)'
      params.push(`%${opts.search}%`, `%${opts.search}%`)
    }
    if (opts.plan) {
      where += ' AND u.plan = ?'
      params.push(opts.plan)
    }

    const [countRows] = await pool.query<StatsRow[]>(
      `SELECT COUNT(*) AS count FROM users u ${where}`, params
    )
    const total = countRows[0].count

    const offset = (opts.page - 1) * opts.pageSize
    const [users] = await pool.query<UserListRow[]>(`
      SELECT u.id, u.username, u.email, u.plan, u.plan_expires_at, u.created_at, u.updated_at,
        COALESCE(w.balance, 0) AS coin_balance,
        (SELECT COUNT(*) FROM todos WHERE user_id = u.id) AS todo_count,
        (SELECT COUNT(*) FROM ideas WHERE user_id = u.id) AS idea_count,
        (SELECT COUNT(*) FROM finance_records WHERE user_id = u.id) AS finance_count
      FROM users u
      LEFT JOIN wallets w ON w.user_id = u.id
      ${where}
      ORDER BY u.created_at DESC
      LIMIT ? OFFSET ?
    `, [...params, opts.pageSize, offset])

    return { users, total }
  },

  async detail(userId: number): Promise<UserListRow | null> {
    const pool = getPool()
    const [rows] = await pool.query<UserListRow[]>(`
      SELECT u.id, u.username, u.email, u.plan, u.plan_expires_at, u.created_at, u.updated_at,
        COALESCE(w.balance, 0) AS coin_balance,
        (SELECT COUNT(*) FROM todos WHERE user_id = u.id) AS todo_count,
        (SELECT COUNT(*) FROM ideas WHERE user_id = u.id) AS idea_count,
        (SELECT COUNT(*) FROM finance_records WHERE user_id = u.id) AS finance_count
      FROM users u
      LEFT JOIN wallets w ON w.user_id = u.id
      WHERE u.id = ?
    `, [userId])
    return rows[0] || null
  },

  async updatePlan(userId: number, plan: 'free' | 'premium', expiresAt: string | null): Promise<void> {
    const pool = getPool()
    await pool.query(
      'UPDATE users SET plan = ?, plan_expires_at = ? WHERE id = ?',
      [plan, expiresAt, userId]
    )
  },

  async grantCoins(userId: number, amount: number, adminId: number): Promise<void> {
    const pool = getPool()

    // Ensure wallet exists
    await pool.query(
      'INSERT INTO wallets (user_id, balance) VALUES (?, 0) ON DUPLICATE KEY UPDATE user_id = user_id',
      [userId]
    )

    // Add balance
    await pool.query(
      'UPDATE wallets SET balance = balance + ? WHERE user_id = ?',
      [amount, userId]
    )

    // Record transaction
    await pool.query(
      "INSERT INTO wallet_transactions (user_id, type, amount, description) VALUES (?, 'admin_grant', ?, ?)",
      [userId, amount, `管理员(ID:${adminId})手动发放`]
    )
  },
}

// ── Admin Product Management ──

export const AdminProductModel = {
  async listAll(opts: { page: number; pageSize: number; type?: string; status?: string }): Promise<{ products: any[]; total: number }> {
    const pool = getPool()
    let where = 'WHERE 1=1'
    const params: any[] = []

    if (opts.type) { where += ' AND type = ?'; params.push(opts.type) }
    if (opts.status) { where += ' AND status = ?'; params.push(opts.status) }

    const [countRows] = await pool.query<StatsRow[]>(
      `SELECT COUNT(*) AS count FROM shop_products ${where}`, params
    )
    const total = countRows[0].count

    const offset = (opts.page - 1) * opts.pageSize
    const [products] = await pool.query<RowDataPacket[]>(`
      SELECT p.*,
        (SELECT COUNT(*) FROM user_products up WHERE up.product_id = p.id) AS sold_count
      FROM shop_products p
      ${where}
      ORDER BY p.sort_order ASC, p.id ASC
      LIMIT ? OFFSET ?
    `, [...params, opts.pageSize, offset])

    return { products, total }
  },

  async update(id: number, data: { name?: string; price?: number; status?: string; sort_order?: number; description?: string }): Promise<void> {
    const fields: string[] = []
    const params: any[] = []

    if (data.name !== undefined) { fields.push('name = ?'); params.push(data.name) }
    if (data.price !== undefined) { fields.push('price = ?'); params.push(data.price) }
    if (data.status !== undefined) { fields.push('status = ?'); params.push(data.status) }
    if (data.sort_order !== undefined) { fields.push('sort_order = ?'); params.push(data.sort_order) }
    if (data.description !== undefined) { fields.push('description = ?'); params.push(data.description) }

    if (fields.length === 0) return

    params.push(id)
    await getPool().query(`UPDATE shop_products SET ${fields.join(', ')} WHERE id = ?`, params)
  },

  async create(data: {
    name: string; type: string; price: number; description?: string
    preview_url?: string; css_class?: string; is_free?: boolean; sort_order?: number
  }): Promise<number> {
    const [result] = await getPool().query<ResultSetHeader>(
      `INSERT INTO shop_products (name, type, price, description, preview_url, css_class, is_free, sort_order, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'active')`,
      [data.name, data.type, data.price, data.description || '', data.preview_url || '', data.css_class || '', data.is_free ? 1 : 0, data.sort_order || 0]
    )
    return result.insertId
  },

  async deactivate(id: number): Promise<void> {
    await getPool().query("UPDATE shop_products SET status = 'inactive' WHERE id = ?", [id])
  },
}

// ── Admin Orders ──

interface OrderRow extends RowDataPacket {
  id: number; user_id: number; username: string; email: string
  order_no: string; plan_type: string; amount: number; status: string
  payment_method: string; paid_at: Date; created_at: Date
}

interface PurchaseRow extends RowDataPacket {
  id: number; user_id: number; username: string; product_name: string
  product_type: string; purchased_at: Date
}

export const AdminOrderModel = {
  async premiumOrders(opts: { page: number; pageSize: number; status?: string }): Promise<{ orders: OrderRow[]; total: number }> {
    const pool = getPool()
    let where = 'WHERE 1=1'
    const params: any[] = []

    if (opts.status) { where += ' AND o.status = ?'; params.push(opts.status) }

    const [countRows] = await pool.query<StatsRow[]>(
      `SELECT COUNT(*) AS count FROM premium_orders o ${where}`, params
    )
    const total = countRows[0].count

    const offset = (opts.page - 1) * opts.pageSize
    const [orders] = await pool.query<OrderRow[]>(`
      SELECT o.*, u.username, u.email
      FROM premium_orders o
      LEFT JOIN users u ON u.id = o.user_id
      ${where}
      ORDER BY o.created_at DESC
      LIMIT ? OFFSET ?
    `, [...params, opts.pageSize, offset])

    return { orders, total }
  },

  async productPurchases(opts: { page: number; pageSize: number }): Promise<{ purchases: PurchaseRow[]; total: number }> {
    const pool = getPool()
    const [countRows] = await pool.query<StatsRow[]>(
      'SELECT COUNT(*) AS count FROM user_products'
    )
    const total = countRows[0].count

    const offset = (opts.page - 1) * opts.pageSize
    const [purchases] = await pool.query<PurchaseRow[]>(`
      SELECT up.id, up.user_id, u.username, p.name AS product_name, p.type AS product_type, up.purchased_at
      FROM user_products up
      LEFT JOIN users u ON u.id = up.user_id
      LEFT JOIN shop_products p ON p.id = up.product_id
      ORDER BY up.purchased_at DESC
      LIMIT ? OFFSET ?
    `, [opts.pageSize, offset])

    return { purchases, total }
  },
}

// ── Admin Activities ──

interface ActivityRow extends RowDataPacket {
  id: number; title: string; type: string; description: string
  config: any; starts_at: Date; ends_at: Date; status: string
  created_by: number; created_at: Date; updated_at: Date
  admin_username?: string
}

export const AdminActivityModel = {
  async list(opts: { page: number; pageSize: number; status?: string }): Promise<{ activities: ActivityRow[]; total: number }> {
    const pool = getPool()
    let where = 'WHERE 1=1'
    const params: any[] = []
    if (opts.status) { where += ' AND a.status = ?'; params.push(opts.status) }

    const [countRows] = await pool.query<StatsRow[]>(
      `SELECT COUNT(*) AS count FROM admin_activities a ${where}`, params
    )
    const total = countRows[0].count

    const offset = (opts.page - 1) * opts.pageSize
    const [activities] = await pool.query<ActivityRow[]>(`
      SELECT a.*, adm.username AS admin_username
      FROM admin_activities a
      LEFT JOIN admin_users adm ON adm.id = a.created_by
      ${where}
      ORDER BY a.created_at DESC
      LIMIT ? OFFSET ?
    `, [...params, opts.pageSize, offset])

    return { activities, total }
  },

  async create(data: {
    title: string; type: string; description?: string; config?: any
    starts_at: string; ends_at: string; created_by: number
  }): Promise<number> {
    const result = await getDb().insert(adminActivities).values({
      title: data.title,
      type: data.type,
      description: data.description || '',
      config: JSON.stringify(data.config || {}),
      starts_at: data.starts_at,
      ends_at: data.ends_at,
      status: 'draft',
      created_by: data.created_by,
    })
    return result[0].insertId
  },

  async update(id: number, data: { title?: string; type?: string; description?: string; config?: any; starts_at?: string; ends_at?: string; status?: string }): Promise<void> {
    const setObj: Record<string, any> = {}

    if (data.title !== undefined) setObj.title = data.title
    if (data.type !== undefined) setObj.type = data.type
    if (data.description !== undefined) setObj.description = data.description
    if (data.config !== undefined) setObj.config = JSON.stringify(data.config)
    if (data.starts_at !== undefined) setObj.starts_at = data.starts_at
    if (data.ends_at !== undefined) setObj.ends_at = data.ends_at
    if (data.status !== undefined) setObj.status = data.status

    if (Object.keys(setObj).length === 0) return

    await getDb().update(adminActivities).set(setObj)
      .where(eq(adminActivities.id, id))
  },

  async delete(id: number): Promise<void> {
    await getDb().delete(adminActivities)
      .where(eq(adminActivities.id, id))
  },
}
