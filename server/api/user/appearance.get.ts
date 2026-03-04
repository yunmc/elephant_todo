export default defineEventHandler(async (event) => {
  const userId = requireAuth(event)
  const appearance = await UserAppearanceModel.get(userId)
  return { success: true, data: appearance }
})
