import type { UpdateTagDTO } from '~~/server/types'

export default defineEventHandler(async (event) => {
  const userId = requireAuth(event)
  const id = Number(getRouterParam(event, 'id'))

  if (!id || isNaN(id)) {
    throw createError({ statusCode: 400, message: '无效的标签ID' })
  }

  const existing = await TagModel.findById(id, userId)
  if (!existing) {
    throw createError({ statusCode: 404, message: '标签不存在' })
  }

  const body = await readBody<UpdateTagDTO>(event)
  const name = typeof body.name === 'string' ? body.name.trim() : ''
  if (!name) {
    throw createError({ statusCode: 400, message: '标签名称不能为空' })
  }
  if (name.length > 50) {
    throw createError({ statusCode: 400, message: '标签名称不能超过50个字符' })
  }

  try {
    await TagModel.update(id, userId, { name, color: body.color })
    const tag = await TagModel.findById(id, userId)
    return { success: true, data: tag }
  } catch (err: any) {
    if (err.code === 'ER_DUP_ENTRY') {
      throw createError({ statusCode: 409, message: '标签名称已存在' })
    }
    throw err
  }
})
