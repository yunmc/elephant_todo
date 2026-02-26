export default defineEventHandler(async (event) => {
  const userId = requireAuth(event)
  const categories = await FinanceCategoryModel.findByUser(userId)
  return { success: true, data: categories }
})
