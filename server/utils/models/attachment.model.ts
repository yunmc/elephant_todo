import { eq, and, asc, count } from 'drizzle-orm'
import type { AttachmentRow, AttachmentTargetType } from '~~/server/types'
import { attachments } from '../../database/schema'

const MAX_ATTACHMENTS_PER_TARGET = 3

export const AttachmentModel = {
  async findByTarget(userId: number, targetType: AttachmentTargetType, targetId: number): Promise<AttachmentRow[]> {
    const rows = await getDb().select().from(attachments)
      .where(and(
        eq(attachments.user_id, userId),
        eq(attachments.target_type, targetType),
        eq(attachments.target_id, targetId),
      ))
      .orderBy(asc(attachments.sort_order), asc(attachments.created_at))
    return rows as unknown as AttachmentRow[]
  },

  async findById(id: number, userId: number): Promise<AttachmentRow | null> {
    const rows = await getDb().select().from(attachments)
      .where(and(eq(attachments.id, id), eq(attachments.user_id, userId)))
    return (rows[0] as unknown as AttachmentRow) || null
  },

  async countByTarget(userId: number, targetType: AttachmentTargetType, targetId: number): Promise<number> {
    const [row] = await getDb().select({ total: count() }).from(attachments)
      .where(and(
        eq(attachments.user_id, userId),
        eq(attachments.target_type, targetType),
        eq(attachments.target_id, targetId),
      ))
    return row.total
  },

  async create(data: {
    user_id: number
    target_type: AttachmentTargetType
    target_id: number
    filename: string
    oss_key: string
    url: string
    file_size: number
    mime_type: string
    sort_order: number
  }): Promise<number> {
    // 检查数量限制
    const existing = await this.countByTarget(data.user_id, data.target_type, data.target_id)
    if (existing >= MAX_ATTACHMENTS_PER_TARGET) {
      throw createError({ statusCode: 400, message: `每条记录最多 ${MAX_ATTACHMENTS_PER_TARGET} 张图片` })
    }

    const result = await getDb().insert(attachments).values(data)
    return result[0].insertId
  },

  async delete(id: number, userId: number): Promise<boolean> {
    const result = await getDb().delete(attachments)
      .where(and(eq(attachments.id, id), eq(attachments.user_id, userId)))
    return (result[0] as any).affectedRows > 0
  },

  async deleteByTarget(userId: number, targetType: AttachmentTargetType, targetId: number): Promise<AttachmentRow[]> {
    // 先查出要删的记录（需要 oss_key 去 OSS 删文件）
    const rows = await this.findByTarget(userId, targetType, targetId)
    if (rows.length > 0) {
      await getDb().delete(attachments)
        .where(and(
          eq(attachments.user_id, userId),
          eq(attachments.target_type, targetType),
          eq(attachments.target_id, targetId),
        ))
    }
    return rows
  },
}
