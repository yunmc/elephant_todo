export default defineEventHandler(async (event) => {
  const userId = requireAuth(event)
  const prediction = await PeriodModel.predict(userId)

  if (!prediction) {
    return { success: true, data: null, message: '暂无足够数据进行预测，请先记录经期数据' }
  }

  return { success: true, data: prediction }
})
