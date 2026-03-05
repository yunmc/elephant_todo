import type { ShopBundleItemRow } from '~/server/types'

/**
 * 购买商品
 * 使用事务保证一致性：扣象币 + 记录流水 + 解锁商品
 */
export async function purchaseProduct(userId: number, productId: number): Promise<void> {
  const product = await ShopProductModel.findById(productId)
  if (!product || product.status !== 'active') {
    throw createError({ statusCode: 404, message: '商品不存在或已下架' })
  }
  if (product.is_free) {
    throw createError({ statusCode: 400, message: '免费商品无需购买' })
  }
  if (product.is_limited) {
    const now = new Date()
    if (product.limited_start && now < product.limited_start) {
      throw createError({ statusCode: 400, message: '该商品尚未上架' })
    }
    if (product.limited_end && now > product.limited_end) {
      throw createError({ statusCode: 400, message: '该商品已下架' })
    }
  }

  // 事务前预查 bundleItems（只读，不需要在事务内）
  let bundleItems: ShopBundleItemRow[] = []
  if (product.type === 'bundle') {
    bundleItems = await ShopProductModel.getBundleItems(productId)
  }

  // 事务：检查拥有 + 扣币 + 流水 + 解锁
  const conn = await getPool().getConnection()
  try {
    await conn.beginTransaction()

    // 0. 锁钱包行，序列化同一用户的所有购买（防 gap lock 并发问题）
    await conn.query(
      'SELECT balance FROM user_wallets WHERE user_id = ? FOR UPDATE', [userId]
    )

    // 1. 检查是否已拥有（已序列化，普通 SELECT 即可）
    const [ownedRows] = await conn.query<any[]>(
      'SELECT 1 FROM user_products WHERE user_id = ? AND product_id = ?',
      [userId, productId]
    )
    if (ownedRows.length > 0) {
      throw createError({ statusCode: 400, message: '已拥有该商品' })
    }

    // 2. 扣减余额（保留 WHERE balance >= ? 做 defense-in-depth）
    const [result] = await conn.query<any>(
      'UPDATE user_wallets SET balance = balance - ?, total_spent = total_spent + ? WHERE user_id = ? AND balance >= ?',
      [product.price, product.price, userId, product.price]
    )
    if (result.affectedRows === 0) {
      throw createError({ statusCode: 400, message: '象币余额不足' })
    }

    // 3. 查变动后余额
    const [walletRows] = await conn.query<any[]>(
      'SELECT balance FROM user_wallets WHERE user_id = ?', [userId]
    )
    const balanceAfter = walletRows[0].balance

    // 4. 记录流水
    await conn.query(
      `INSERT INTO wallet_transactions (user_id, type, amount, balance_after, reference_type, reference_id, description)
       VALUES (?, 'purchase', ?, ?, 'product', ?, ?)`,
      [userId, -product.price, balanceAfter, productId, `购买${product.name}`]
    )

    // 5. 解锁商品
    await conn.query(
      'INSERT IGNORE INTO user_products (user_id, product_id, source) VALUES (?, ?, "purchase")',
      [userId, productId]
    )

    // 6. 如果是套装，还要解锁包含的所有单品（bundleItems 已在事务前预查）
    if (product.type === 'bundle') {
      for (const item of bundleItems) {
        await conn.query(
          'INSERT IGNORE INTO user_products (user_id, product_id, source) VALUES (?, ?, "bundle")',
          [userId, item.product_id]
        )
      }
    }

    await conn.commit()
  } catch (err) {
    await conn.rollback()
    throw err
  } finally {
    conn.release()
  }
}
