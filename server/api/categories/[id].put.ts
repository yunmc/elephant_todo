export default defineEventHandler(async (event) => {
  const userId = requireAuth(event)
  const id = Number(getRouterParam(event, 'id'))
  if (!id || !Number.isInteger(id)) {
    throw createError({ statusCode: 400, message: '无效的分类ID' })
  }

  const body = await readBody(event)
  const name = body.name !== undefined ? (typeof body.name === 'string' ? body.name.trim() : '') : undefined
  if (name !== undefined && !name) {
    throw createError({ statusCode: 400, message: '分类名称不能为空' })
  }
  if (name && name.length > 50) {
    throw createError({ statusCode: 400, message: '分类名称不能超过50个字符' })
  }
  const color = body.color || undefined
  if (color && !/^#[0-9A-Fa-f]{6}$/.test(color)) {
    throw createError({ statusCode: 400, message: '颜色格式无效，请使用 #RRGGBB 格式' })
  }

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
