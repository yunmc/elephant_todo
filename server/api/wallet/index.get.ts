export default defineEventHandler(async (event) => {
  const userId = requireAuth(event)
  const wallet = await WalletModel.getOrCreate(userId)
  return {
    success: true,
    data: {
      balance: wallet.balance,
      total_earned: wallet.total_earned,
      total_spent: wallet.total_spent,
    },
  }
})
