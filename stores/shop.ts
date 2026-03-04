import type { ShopProduct, UserWallet, UserProduct } from '~/types'

export const useShopStore = defineStore('shop', () => {
  const api = useApi()

  const products = ref<ShopProduct[]>([])
  const wallet = ref<UserWallet | null>(null)
  const myProducts = ref<UserProduct[]>([])
  const loading = ref(false)

  async function fetchProducts(type?: string) {
    loading.value = true
    try {
      const res = await api.get<ShopProduct[]>('/shop/products', type ? { type } : undefined)
      products.value = res.data
    } finally {
      loading.value = false
    }
  }

  async function fetchProductDetail(id: number) {
    const res = await api.get<ShopProduct>(`/shop/products/${id}`)
    return res.data
  }

  async function purchase(productId: number) {
    const res = await api.post<{ balance: number }>('/shop/purchase', { product_id: productId })
    // 更新钱包余额
    if (wallet.value) wallet.value.balance = res.data.balance
    // 刷新商品列表和仓库（标记 owned）
    await Promise.all([fetchProducts(), fetchMyProducts()])
    return res
  }

  async function fetchWallet() {
    const res = await api.get<UserWallet>('/wallet')
    wallet.value = res.data
  }

  async function fetchMyProducts() {
    const res = await api.get<UserProduct[]>('/user/products')
    myProducts.value = res.data
  }

  return {
    products,
    wallet,
    myProducts,
    loading,
    fetchProducts,
    fetchProductDetail,
    purchase,
    fetchWallet,
    fetchMyProducts,
  }
})
