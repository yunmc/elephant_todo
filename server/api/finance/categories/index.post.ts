export default defineEventHandler(async (event) => {
  const userId = requireAuth(event)
  const { name, icon, type, sort_order } = await readBody(event)

  const trimmedName = typeof name === 'string' ? name.trim() : ''
  if (!trimmedName || !type) {
    throw createError({ statusCode: 400, message: '分类名称和类型为必填项' })
  }
  if (trimmedName.length > 50) {
    throw createError({ statusCode: 400, message: '分类名称不能超过50个字符' })
  }
  if (!['income', 'expense'].includes(type)) {
    throw createError({ statusCode: 400, message: '类型必须为 income 或 expense' })
  }

  try {
    const id = await FinanceCategoryModel.create(userId, {
      name: trimmedName,
      icon,
      type,
      sort_order: typeof sort_order === 'number' && Number.isInteger(sort_order) && sort_order >= 0 ? sort_order : 0,
    })
    const category = await FinanceCategoryModel.findById(id, userId)
    setResponseStatus(event, 201)
    return { success: true, data: category, message: '分类创建成功' }
  } catch (err: any) {
    if (err.code === 'ER_DUP_ENTRY') {
      throw createError({ statusCode: 409, message: '同类型下该分类名已存在' })
    }
    throw err
  }
})
