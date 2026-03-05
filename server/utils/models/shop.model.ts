import { eq, and, asc } from 'drizzle-orm'
import type { ShopProductRow, ShopBundleItemRow } from '~~/server/types'
import { shopProducts, shopBundleItems } from '../../database/schema'

export const ShopProductModel = {
  async findAll(type?: string): Promise<ShopProductRow[]> {
    const conditions = [eq(shopProducts.status, 'active')]
    if (type) conditions.push(eq(shopProducts.type, type as any))

    const rows = await getDb().select().from(shopProducts)
      .where(and(...conditions))
      .orderBy(asc(shopProducts.sort_order), asc(shopProducts.id))
    return rows as unknown as ShopProductRow[]
  },

  async findById(id: number): Promise<ShopProductRow | null> {
    const rows = await getDb().select().from(shopProducts)
      .where(eq(shopProducts.id, id))
    return (rows[0] as unknown as ShopProductRow) || null
  },

  async getBundleItems(bundleId: number): Promise<ShopBundleItemRow[]> {
    const rows = await getDb().select().from(shopBundleItems)
      .where(eq(shopBundleItems.bundle_id, bundleId))
    return rows as unknown as ShopBundleItemRow[]
  },

  async getBundleProducts(bundleId: number): Promise<ShopProductRow[]> {
    const rows = await getDb().select({
      id: shopProducts.id,
      type: shopProducts.type,
      name: shopProducts.name,
      description: shopProducts.description,
      price: shopProducts.price,
      preview_url: shopProducts.preview_url,
      asset_key: shopProducts.asset_key,
      is_free: shopProducts.is_free,
      is_limited: shopProducts.is_limited,
      limited_start: shopProducts.limited_start,
      limited_end: shopProducts.limited_end,
      sort_order: shopProducts.sort_order,
      status: shopProducts.status,
      created_at: shopProducts.created_at,
      updated_at: shopProducts.updated_at,
    }).from(shopProducts)
      .innerJoin(shopBundleItems, eq(shopBundleItems.product_id, shopProducts.id))
      .where(eq(shopBundleItems.bundle_id, bundleId))
      .orderBy(asc(shopProducts.sort_order))
    return rows as unknown as ShopProductRow[]
  },
}
