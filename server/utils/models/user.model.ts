import type { ResultSetHeader } from 'mysql2'
import type { UserRow, CreateUserDTO, PasswordResetTokenRow } from '~~/server/types'

export const UserModel = {
  async findByEmail(email: string): Promise<UserRow | null> {
    const [rows] = await getDb().query<UserRow[]>(
      'SELECT * FROM users WHERE email = ?',
      [email]
    )
    return rows[0] || null
  },

  async findById(id: number): Promise<UserRow | null> {
    const [rows] = await getDb().query<UserRow[]>(
      'SELECT * FROM users WHERE id = ?',
      [id]
    )
    return rows[0] || null
  },

  async findByUsername(username: string): Promise<UserRow | null> {
    const [rows] = await getDb().query<UserRow[]>(
      'SELECT * FROM users WHERE username = ?',
      [username]
    )
    return rows[0] || null
  },

  async create(data: CreateUserDTO): Promise<number> {
    const [result] = await getDb().query<ResultSetHeader>(
      'INSERT INTO users (username, email, password) VALUES (?, ?, ?)',
      [data.username, data.email, data.password]
    )
    return result.insertId
  },

  async updatePassword(id: number, hashedPassword: string): Promise<void> {
    await getDb().query(
      'UPDATE users SET password = ? WHERE id = ?',
      [hashedPassword, id]
    )
  },

  // ---- Password Reset Tokens ----

  async createResetToken(userId: number, token: string, expiresAt: Date): Promise<void> {
    await getDb().query(
      'INSERT INTO password_reset_tokens (user_id, token, expires_at) VALUES (?, ?, ?)',
      [userId, token, expiresAt]
    )
  },

  async findResetToken(token: string): Promise<PasswordResetTokenRow | null> {
    const [rows] = await getDb().query<PasswordResetTokenRow[]>(
      'SELECT * FROM password_reset_tokens WHERE token = ?',
      [token]
    )
    return rows[0] || null
  },

  async markResetTokenUsed(id: number): Promise<void> {
    await getDb().query(
      'UPDATE password_reset_tokens SET used = TRUE WHERE id = ?',
      [id]
    )
  },
}
