export default defineEventHandler(async (event) => {
  const userId = requireAuth(event)
  const id = Number(getRouterParam(event, 'id'))
  const { name, color } = await readBody(event)

  const existing = await CategoryModel.findById(id, userId)
  if (!existing) {
    throw createError({ statusCode: 404, message: '分类不存在' })
  }

  try {
    await CategoryModel.update(id, userId, { name, color })
    const updated = await CategoryModel.findById(id, userId)
    return { success: true, data: updated, message: '分类更新成功' }
  } catch (error: any) {
    if (error.code === 'ER_DUP_ENTRY') {
      throw createError({ statusCode: 409, message: '该分类名已存在' })
    }
    throw error
  }
})
