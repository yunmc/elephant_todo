export default defineEventHandler(async (event) => {
  const userId = requireAuth(event)
  const status = await getPremiumStatus(userId)

  return {
    success: true,
    data: status,
  }
})
