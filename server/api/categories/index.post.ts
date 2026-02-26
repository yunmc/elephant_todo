export default defineEventHandler(async (event) => {
  const userId = requireAuth(event)
  const { name, color } = await readBody(event)

  if (!name) {
    throw createError({ statusCode: 400, message: '分类名称为必填项' })
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
