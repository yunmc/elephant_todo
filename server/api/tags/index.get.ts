export default defineEventHandler(async (event) => {
  const userId = requireAuth(event)
  const tags = await TagModel.findByUser(userId)
  return { success: true, data: tags }
})
