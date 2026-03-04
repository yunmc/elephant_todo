export default defineEventHandler(async (event) => {
  const userId = requireAuth(event)
  const { product_id } = await readBody(event)
  if (!product_id) throw createError({ statusCode: 400, message: 'product_id 必填' })

  await purchaseProduct(userId, Number(product_id))

  // 返回更新后的钱包余额
  const wallet = await WalletModel.getOrCreate(userId)
  return {
    success: true,
    data: { balance: wallet.balance },
    message: '购买成功',
  }
})
