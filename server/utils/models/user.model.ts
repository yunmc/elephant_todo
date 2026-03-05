import { eq, and, or, lt, sql } from 'drizzle-orm'
import type { UserRow, CreateUserDTO, PasswordResetTokenRow } from '~~/server/types'
import { users, passwordResetTokens } from '../../database/schema'

export const UserModel = {
  async findByEmail(email: string): Promise<UserRow | null> {
    const rows = await getDb().select().from(users).where(eq(users.email, email))
    return (rows[0] as unknown as UserRow) || null
  },

  async findById(id: number): Promise<UserRow | null> {
    const rows = await getDb().select().from(users).where(eq(users.id, id))
    return (rows[0] as unknown as UserRow) || null
  },

  async findByUsername(username: string): Promise<UserRow | null> {
    const rows = await getDb().select().from(users).where(eq(users.username, username))
    return (rows[0] as unknown as UserRow) || null
  },

  async create(data: CreateUserDTO): Promise<number> {
    const result = await getDb().insert(users).values({
      username: data.username,
      email: data.email,
      password: data.password,
    })
    return result[0].insertId
  },

  async updatePassword(id: number, hashedPassword: string): Promise<void> {
    await getDb().update(users).set({ password: hashedPassword }).where(eq(users.id, id))
  },

  async getVaultSalt(id: number): Promise<string | null> {
    const rows = await getDb().select({ vault_salt: users.vault_salt }).from(users)
      .where(eq(users.id, id))
    return rows[0]?.vault_salt || null
  },

  async setVaultSalt(id: number, salt: string): Promise<void> {
    await getDb().update(users).set({ vault_salt: salt }).where(eq(users.id, id))
  },

  // ---- Password Reset Tokens ----

  async createResetToken(userId: number, token: string, expiresAt: Date): Promise<void> {
    await getDb().insert(passwordResetTokens).values({
      user_id: userId,
      token,
      expires_at: expiresAt,
    })
  },

  async findResetToken(token: string): Promise<PasswordResetTokenRow | null> {
    const rows = await getDb().select().from(passwordResetTokens)
      .where(eq(passwordResetTokens.token, token))
    return (rows[0] as unknown as PasswordResetTokenRow) || null
  },

  async markResetTokenUsed(id: number): Promise<void> {
    await getDb().update(passwordResetTokens).set({ used: true })
      .where(eq(passwordResetTokens.id, id))
  },

  async invalidateResetTokens(userId: number): Promise<void> {
    await getDb().update(passwordResetTokens).set({ used: true })
      .where(and(eq(passwordResetTokens.user_id, userId), eq(passwordResetTokens.used, false)))
  },

  async cleanupExpiredResetTokens(): Promise<void> {
    await getDb().delete(passwordResetTokens)
      .where(or(lt(passwordResetTokens.expires_at, sql`NOW()`), eq(passwordResetTokens.used, true)))
  },

  // ---- Premium ----

  async getSafeUser(id: number): Promise<Omit<UserRow, 'password' | 'vault_salt'> | null> {
    const rows = await getDb().select({
      id: users.id,
      username: users.username,
      email: users.email,
      plan: users.plan,
      plan_expires_at: users.plan_expires_at,
      auto_renew: users.auto_renew,
      created_at: users.created_at,
      updated_at: users.updated_at,
    }).from(users).where(eq(users.id, id))
    return (rows[0] as any) || null
  },

  async updatePlan(id: number, plan: 'free' | 'premium', expiresAt: Date | null, autoRenew?: boolean): Promise<void> {
    if (autoRenew !== undefined) {
      await getDb().update(users).set({
        plan,
        plan_expires_at: expiresAt,
        auto_renew: autoRenew ? 1 : 0,
      }).where(eq(users.id, id))
    } else if (plan === 'free') {
      await getDb().update(users).set({
        plan,
        plan_expires_at: expiresAt,
        auto_renew: 0,
      }).where(eq(users.id, id))
    } else {
      await getDb().update(users).set({
        plan,
        plan_expires_at: expiresAt,
      }).where(eq(users.id, id))
    }
  },
}
