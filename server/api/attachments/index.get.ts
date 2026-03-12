import type { AttachmentTargetType } from '~~/server/types'

const VALID_TARGET_TYPES: AttachmentTargetType[] = ['finance_record', 'idea', 'todo']

export default defineEventHandler(async (event) => {
  const userId = requireAuth(event)

  const query = getQuery(event)
  const targetType = query.target_type as string
  const targetId = Number(query.target_id)

  if (!targetType || !VALID_TARGET_TYPES.includes(targetType as AttachmentTargetType)) {
    throw createError({ statusCode: 400, message: 'target_type 无效' })
  }
  if (!targetId || !Number.isInteger(targetId) || targetId <= 0) {
    throw createError({ statusCode: 400, message: 'target_id 无效' })
  }

  const list = await AttachmentModel.findByTarget(userId, targetType as AttachmentTargetType, targetId)
  return { success: true, data: list }
})
