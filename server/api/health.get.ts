import { sql } from 'drizzle-orm'

export default defineEventHandler(async () => {
  try {
    const db = getDb()
    await db.execute(sql`SELECT 1`)
    return {
      success: true,
      status: 'healthy',
      timestamp: new Date().toISOString(),
    }
  } catch {
    throw createError({
      statusCode: 503,
      message: 'Database connection failed',
    })
  }
})
