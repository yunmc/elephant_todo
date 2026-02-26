export default defineEventHandler(async (event) => {
  const userId = requireAuth(event)
  const body = await readBody(event)

  const name = typeof body.name === 'string' ? body.name.trim() : ''
  if (!name) {
    throw createError({ statusCode: 400, message: '分类名称为必填项' })
  }
  if (name.length > 50) {
    throw createError({ statusCode: 400, message: '分类名称不能超过50个字符' })
  }
  const color = body.color || undefined
  if (color && !/^#[0-9A-Fa-f]{6}$/.test(color)) {
    throw createError({ statusCode: 400, message: '颜色格式无效，请使用 #RRGGBB 格式' })
  }

  try {
    const id = await CategoryModel.create(userId, { name, color })
    const category = await CategoryModel.findById(id, userId)
    setResponseStatus(event, 201)
    return { success: true, data: category, message: '分类创建成功' }
  } catch (error: any) {
    if (error.code === 'ER_DUP_ENTRY') {
      throw createError({ statusCode: 409, message: '该分类名已存在' })
    }
    throw error
  }
})
