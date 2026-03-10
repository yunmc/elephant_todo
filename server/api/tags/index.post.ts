import type { CreateTagDTO } from '~~/server/types'

export default defineEventHandler(async (event) => {
  const userId = requireAuth(event)
  const body = await readBody<CreateTagDTO>(event)

  const name = typeof body.name === 'string' ? body.name.trim() : ''
  if (!name) {
    throw createError({ statusCode: 400, message: '标签名称不能为空' })
  }
  if (name.length > 50) {
    throw createError({ statusCode: 400, message: '标签名称不能超过50个字符' })
  }

  try {
    const id = await TagModel.create(userId, { name, color: body.color })
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
