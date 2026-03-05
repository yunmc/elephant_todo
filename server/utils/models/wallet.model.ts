import type { RowDataPacket } from 'mysql2'
import type { UserWalletRow, WalletTransactionRow } from '~/server/types'

export const WalletModel = {
  /** 获取或创建钱包（首次自动创建） */
  async getOrCreate(userId: number): Promise<UserWalletRow> {
    const pool = getPool()
    const [rows] = await pool.query<UserWalletRow[]>(
      'SELECT * FROM user_wallets WHERE user_id = ?', [userId]
    )
    if (rows[0]) return rows[0]
    // 首次：INSERT IGNORE 防并发 duplicate entry
    await pool.query(
      'INSERT IGNORE INTO user_wallets (user_id, balance, total_earned, total_spent) VALUES (?, 0, 0, 0)',
      [userId]
    )
    const [newRows] = await pool.query<UserWalletRow[]>(
      'SELECT * FROM user_wallets WHERE user_id = ?', [userId]
    )
    return newRows[0]
  },

  /** 获取流水记录（分页） */
  async getTransactions(userId: number, page: number, limit: number): Promise<{ items: WalletTransactionRow[]; total: number }> {
    const pool = getPool()
    const offset = (page - 1) * limit
    const [countRows] = await pool.query<RowDataPacket[]>(
      'SELECT COUNT(*) as total FROM wallet_transactions WHERE user_id = ?', [userId]
    )
    const total = countRows[0].total as number
    const [rows] = await pool.query<WalletTransactionRow[]>(
      'SELECT * FROM wallet_transactions WHERE user_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?',
      [userId, limit, offset]
    )
    return { items: rows, total }
  },

  /**
   * 增加象币（充值、奖励等）
   * 内部自开事务 + SELECT FOR UPDATE 保证 balance_after 一致
   */
  async addCoins(
    userId: number,
    amount: number,
    type: 'recharge' | 'reward' | 'refund',
    description: string,
    referenceType?: string,
    referenceId?: number,
  ): Promise<number> {
    const conn = await getPool().getConnection()
    try {
      await conn.beginTransaction()

      // 1. 锁行 + 更新余额
      await conn.query(
        'SELECT balance FROM user_wallets WHERE user_id = ? FOR UPDATE', [userId]
      )
      await conn.query(
        'UPDATE user_wallets SET balance = balance + ?, total_earned = total_earned + ? WHERE user_id = ?',
        [amount, amount, userId]
      )

      // 2. 读变动后余额
      const [rows] = await conn.query<UserWalletRow[]>(
        'SELECT balance FROM user_wallets WHERE user_id = ?', [userId]
      )
      const balanceAfter = rows[0].balance

      // 3. 记录流水
      await conn.query(
        `INSERT INTO wallet_transactions (user_id, type, amount, balance_after, reference_type, reference_id, description)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [userId, type, amount, balanceAfter, referenceType || null, referenceId || null, description]
      )

      await conn.commit()
      return balanceAfter
    } catch (err) {
      await conn.rollback()
      throw err
    } finally {
      conn.release()
    }
  },
}
