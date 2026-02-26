export default defineEventHandler(async (event) => {
  const userId = requireAuth(event)
  const query = getQuery(event)
  const personName = query.person_name ? String(query.person_name) : undefined
  const prediction = await PeriodModel.predict(userId, personName)

  if (!prediction) {
    return { success: true, data: null, message: '暂无足够数据进行预测，请先记录经期数据' }
  }

  return { success: true, data: prediction }
})
