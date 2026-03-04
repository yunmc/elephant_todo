export default defineEventHandler(async (event) => {
  const userId = requireAuth(event)
  const query = getQuery(event)
  const type = query.type as string | undefined

  const products = await ShopProductModel.findAll(type)
  const ownedIds = await UserProductModel.getOwnedIds(userId)

  const data = products.map(p => ({
    ...p,
    owned: ownedIds.has(p.id) || !!p.is_free,
  }))

  return { success: true, data }
})
