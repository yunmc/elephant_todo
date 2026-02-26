import type { CreateTagDTO } from '~~/server/types'

export default defineEventHandler(async (event) => {
  const userId = requireAuth(event)
  const body = await readBody<CreateTagDTO>(event)

  if (!body.name?.trim()) {
    throw createError({ statusCode: 400, message: '标签名称不能为空' })
  }

  try {
    const id = await TagModel.create(userId, body)
    const tag = await TagModel.findById(id, userId)
    setResponseStatus(event, 201)
    return { success: true, data: tag }
  } catch (err: any) {
    if (err.code === 'ER_DUP_ENTRY') {
      throw createError({ statusCode: 409, message: '标签名称已存在' })
    }
    throw err
  }
})
