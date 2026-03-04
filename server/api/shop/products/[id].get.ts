export default defineEventHandler(async (event) => {
  const userId = requireAuth(event)
  const id = Number(getRouterParam(event, 'id'))
  if (!id || isNaN(id)) throw createError({ statusCode: 400, message: '无效的商品 ID' })

  const product = await ShopProductModel.findById(id)
  if (!product || product.status !== 'active') {
    throw createError({ statusCode: 404, message: '商品不存在' })
  }

  const owned = await UserProductModel.isOwned(userId, id)
  let bundle_items: any[] | undefined

  if (product.type === 'bundle') {
    const items = await ShopProductModel.getBundleProducts(id)
    const ownedIds = await UserProductModel.getOwnedIds(userId)
    bundle_items = items.map(i => ({ ...i, owned: ownedIds.has(i.id) || !!i.is_free }))
  }

  return {
    success: true,
    data: { ...product, owned: owned || !!product.is_free, bundle_items },
  }
})
