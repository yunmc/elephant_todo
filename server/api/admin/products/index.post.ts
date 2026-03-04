
export default defineEventHandler(async (event) => {
  requireAdminAuth(event)

  const body = await readBody(event)
  const { name, type, price } = body || {}

  if (!name || !type || price === undefined) {
    throw createError({ statusCode: 400, message: '请填写商品名称、类型和价格' })
  }

  if (!['skin', 'font', 'sticker', 'bundle'].includes(type)) {
    throw createError({ statusCode: 400, message: '无效的商品类型' })
  }

  const id = await AdminProductModel.create({
    name,
    type,
    price: Number(price),
    description: body.description,
    preview_url: body.preview_url,
    css_class: body.css_class,
    is_free: body.is_free || false,
    sort_order: body.sort_order || 0,
  })

  return { success: true, data: { id }, message: '商品创建成功' }
})
