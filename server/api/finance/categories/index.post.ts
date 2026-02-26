export default defineEventHandler(async (event) => {
  const userId = requireAuth(event)
  const { name, icon, type, sort_order } = await readBody(event)

  if (!name || !type) {
    throw createError({ statusCode: 400, message: '分类名称和类型为必填项' })
  }
  if (!['income', 'expense'].includes(type)) {
    throw createError({ statusCode: 400, message: '类型必须为 income 或 expense' })
  }

  const id = await FinanceCategoryModel.create(userId, { name, icon, type, sort_order })
  const category = await FinanceCategoryModel.findById(id, userId)

  setResponseStatus(event, 201)
  return { success: true, data: category, message: '分类创建成功' }
})
