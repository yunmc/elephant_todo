import type { UserAppearanceRow } from '~/server/types'

export const UserProductModel = {
  /** 查询用户是否拥有某商品 */
  async isOwned(userId: number, productId: number): Promise<boolean> {
    const [rows] = await getDb().query<any[]>(
      'SELECT 1 FROM user_products WHERE user_id = ? AND product_id = ?',
      [userId, productId]
    )
    return rows.length > 0
  },

  /** 获取用户拥有的所有商品 ID 集合 */
  async getOwnedIds(userId: number): Promise<Set<number>> {
    const [rows] = await getDb().query<any[]>(
      'SELECT product_id FROM user_products WHERE user_id = ?', [userId]
    )
    return new Set(rows.map(r => r.product_id))
  },

  /** 获取用户仓库（带商品详情） */
  async getUserProducts(userId: number): Promise<any[]> {
    const [rows] = await getDb().query<any[]>(
      `SELECT up.*, p.type, p.name, p.description, p.price, p.preview_url, p.asset_key, p.is_free
       FROM user_products up
       JOIN shop_products p ON p.id = up.product_id
       WHERE up.user_id = ?
       ORDER BY up.purchased_at DESC`,
      [userId]
    )
    return rows
  },
}

export const UserAppearanceModel = {
  /** 获取用户当前装扮配置（含商品详情） */
  async get(userId: number): Promise<any> {
    const [rows] = await getDb().query<any[]>(
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

  /** 更新装扮（只能装扮已拥有的或免费的商品） */
  async update(userId: number, skinId: number | null, stickerPackId: number | null, fontId: number | null): Promise<void> {
    await getDb().query(
      `INSERT INTO user_appearance (user_id, skin_id, sticker_pack_id, font_id)
       VALUES (?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE skin_id = VALUES(skin_id), sticker_pack_id = VALUES(sticker_pack_id), font_id = VALUES(font_id)`,
      [userId, skinId, stickerPackId, fontId]
    )
  },
}
