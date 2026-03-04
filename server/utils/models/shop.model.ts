import type { ShopProductRow, ShopBundleItemRow } from '~/server/types'

export const ShopProductModel = {
  /** 商品列表（支持 type 筛选），返回 active 商品 */
  async findAll(type?: string): Promise<ShopProductRow[]> {
    let sql = 'SELECT * FROM shop_products WHERE status = ?'
    const params: any[] = ['active']
    if (type) {
      sql += ' AND type = ?'
      params.push(type)
    }
    sql += ' ORDER BY sort_order ASC, id ASC'
    const [rows] = await getDb().query<ShopProductRow[]>(sql, params)
    return rows
  },

  /** 单个商品详情 */
  async findById(id: number): Promise<ShopProductRow | null> {
    const [rows] = await getDb().query<ShopProductRow[]>(
      'SELECT * FROM shop_products WHERE id = ?', [id]
    )
    return rows[0] || null
  },

  /** 获取套装包含的单品 ID 列表 */
  async getBundleItems(bundleId: number): Promise<ShopBundleItemRow[]> {
    const [rows] = await getDb().query<ShopBundleItemRow[]>(
      'SELECT * FROM shop_bundle_items WHERE bundle_id = ?', [bundleId]
    )
    return rows
  },

  /** 获取套装包含的单品详情 */
  async getBundleProducts(bundleId: number): Promise<ShopProductRow[]> {
    const [rows] = await getDb().query<ShopProductRow[]>(
      `SELECT p.* FROM shop_products p
       JOIN shop_bundle_items bi ON bi.product_id = p.id
       WHERE bi.bundle_id = ?
       ORDER BY p.sort_order ASC`,
      [bundleId]
    )
    return rows
  },
}
