export default defineEventHandler(async (event) => {
  const userId = requireAuth(event)
  const products = await UserProductModel.getUserProducts(userId)
  return { success: true, data: products }
})
