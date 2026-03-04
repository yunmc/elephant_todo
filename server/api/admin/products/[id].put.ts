
export default defineEventHandler(async (event) => {
  requireAdminAuth(event)

  const id = Number(getRouterParam(event, 'id'))
  if (!id) throw createError({ statusCode: 400, message: '无效商品 ID' })

  const body = await readBody(event)

  await AdminProductModel.update(id, {
    name: body.name,
    price: body.price !== undefined ? Number(body.price) : undefined,
    status: body.status,
    sort_order: body.sort_order !== undefined ? Number(body.sort_order) : undefined,
    description: body.description,
  })

  return { success: true, message: '商品已更新' }
})
