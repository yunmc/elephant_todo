export default defineEventHandler(async (event) => {
  const userId = requireAuth(event)
  const items = await ChecklistModel.getItems(userId)
  return { success: true, data: items }
})
