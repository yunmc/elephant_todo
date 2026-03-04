export default defineEventHandler(async (event) => {
  const userId = requireAuth(event)
  const body = await readBody(event)

  // 校验：只能装扮已拥有的商品或免费商品
  const ownedIds = await UserProductModel.getOwnedIds(userId)

  // merge 策略：未传的字段保留原值
  const current = await UserAppearanceModel.get(userId)
  const finalSkinId = 'skin_id' in body ? body.skin_id : current.skin_id
  const finalStickerPackId = 'sticker_pack_id' in body ? body.sticker_pack_id : current.sticker_pack_id
  const finalFontId = 'font_id' in body ? body.font_id : current.font_id

  for (const [field, id] of Object.entries({ skin_id: finalSkinId, sticker_pack_id: finalStickerPackId, font_id: finalFontId })) {
    if (id === null || id === undefined) continue
    const product = await ShopProductModel.findById(Number(id))
    if (!product) throw createError({ statusCode: 400, message: `${field} 对应的商品不存在` })
    if (!product.is_free && !ownedIds.has(product.id)) {
      throw createError({ statusCode: 400, message: `未拥有该商品: ${product.name}` })
    }
  }

  await UserAppearanceModel.update(
    userId,
    finalSkinId ?? null,
    finalStickerPackId ?? null,
    finalFontId ?? null,
  )
  const appearance = await UserAppearanceModel.get(userId)
  return { success: true, data: appearance }
})
