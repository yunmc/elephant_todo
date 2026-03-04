export default defineEventHandler(async (event) => {
  const userId = requireAuth(event)
  const isDev = process.env.NODE_ENV !== 'production'
  if (!isDev) throw createError({ statusCode: 403, message: '此接口仅限开发环境使用' })

  const { amount } = await readBody(event)
  if (!amount || amount <= 0 || amount > 10000) {
    throw createError({ statusCode: 400, message: 'amount 必须为 1-10000 之间的正整数' })
  }

  await WalletModel.getOrCreate(userId)
  const balance = await WalletModel.addCoins(userId, amount, 'reward', '开发测试加币', 'dev_test')
  return { success: true, data: { balance } }
})
