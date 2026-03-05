import { eq, and } from 'drizzle-orm'
import type { UserAppearanceRow } from '~~/server/types'
import { userProducts, shopProducts, userAppearance } from '../../database/schema'

export const UserProductModel = {
  async isOwned(userId: number, productId: number): Promise<boolean> {
    const rows = await getDb().select({ id: userProducts.id }).from(userProducts)
      .where(and(eq(userProducts.user_id, userId), eq(userProducts.product_id, productId)))
      .limit(1)
    return rows.length > 0
  },

  async getOwnedIds(userId: number): Promise<Set<number>> {
    const rows = await getDb().select({ product_id: userProducts.product_id }).from(userProducts)
      .where(eq(userProducts.user_id, userId))
    return new Set(rows.map(r => r.product_id))
  },

  async getUserProducts(userId: number): Promise<any[]> {
    const rows = await getDb().select({
      id: userProducts.id,
      user_id: userProducts.user_id,
      product_id: userProducts.product_id,
      purchased_at: userProducts.purchased_at,
      source: userProducts.source,
      type: shopProducts.type,
      name: shopProducts.name,
      description: shopProducts.description,
      price: shopProducts.price,
      preview_url: shopProducts.preview_url,
      asset_key: shopProducts.asset_key,
      is_free: shopProducts.is_free,
    }).from(userProducts)
      .innerJoin(shopProducts, eq(shopProducts.id, userProducts.product_id))
      .where(eq(userProducts.user_id, userId))
      .orderBy(userProducts.purchased_at)
    return rows
  },
}

export const UserAppearanceModel = {
  async get(userId: number): Promise<any> {
    // Complex multi-join query, use raw pool
    const [rows] = await getPool().query<any[]>(
      `SELECT ua.skin_id, ua.sticker_pack_id, ua.font_id,
              s.name as skin_name, s.asset_key as skin_asset_key, s.preview_url as skin_preview_url,
              st.name as sticker_name, st.asset_key as sticker_asset_key,
              f.name as font_name, f.asset_key as font_asset_key
       FROM user_appearance ua
       LEFT JOIN shop_products s ON s.id = ua.skin_id
       LEFT JOIN shop_products st ON st.id = ua.sticker_pack_id
       LEFT JOIN shop_products f ON f.id = ua.font_id
       WHERE ua.user_id = ?`,
      [userId]
    )
    if (!rows[0]) {
      return { skin_id: null, sticker_pack_id: null, font_id: null, skin: null, sticker_pack: null, font: null }
    }
    const r = rows[0]
    return {
      skin_id: r.skin_id,
      sticker_pack_id: r.sticker_pack_id,
      font_id: r.font_id,
      skin: r.skin_id ? { id: r.skin_id, name: r.skin_name, asset_key: r.skin_asset_key, preview_url: r.skin_preview_url } : null,
      sticker_pack: r.sticker_pack_id ? { id: r.sticker_pack_id, name: r.sticker_name, asset_key: r.sticker_asset_key } : null,
      font: r.font_id ? { id: r.font_id, name: r.font_name, asset_key: r.font_asset_key } : null,
    }
  },

  async update(userId: number, skinId: number | null, stickerPackId: number | null, fontId: number | null): Promise<void> {
    // UPSERT with ON DUPLICATE KEY UPDATE — use raw pool
    await getPool().query(
      `INSERT INTO user_appearance (user_id, skin_id, sticker_pack_id, font_id)
       VALUES (?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE skin_id = VALUES(skin_id), sticker_pack_id = VALUES(sticker_pack_id), font_id = VALUES(font_id)`,
      [userId, skinId, stickerPackId, fontId]
    )
  },
}
