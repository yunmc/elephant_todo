
export default defineEventHandler(async (event) => {
  requireAdminAuth(event)

  const query = getQuery(event)
  const page = Number(query.page) || 1
  const pageSize = Math.min(Number(query.pageSize) || 20, 100)
  const tab = (query.tab as string) || 'premium'
  const status = (query.status as string) || undefined

  if (tab === 'purchases') {
    const { purchases, total } = await AdminOrderModel.productPurchases({ page, pageSize })
    return {
      success: true,
      data: { items: purchases, total, page, pageSize, totalPages: Math.ceil(total / pageSize) },
    }
  }

  // Default: premium orders
  const { orders, total } = await AdminOrderModel.premiumOrders({ page, pageSize, status })
  return {
    success: true,
    data: { items: orders, total, page, pageSize, totalPages: Math.ceil(total / pageSize) },
  }
})
