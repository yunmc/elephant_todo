<template>
  <div class="page-container">
    <div class="shop-header">
      <h1 class="page-title">🏪 手帐商店</h1>
      <div v-if="shopStore.wallet" class="wallet-badge" @click="showTransactions = true">
        💰 {{ shopStore.wallet.balance }} 象币
      </div>
    </div>

    <!-- Type Filter Tabs -->
    <div class="filter-tabs">
      <button :class="['tab', { active: activeType === undefined }]" @click="setType(undefined)">全部</button>
      <button :class="['tab', { active: activeType === 'skin' }]" @click="setType('skin')">皮肤</button>
      <button :class="['tab', { active: activeType === 'sticker_pack' }]" @click="setType('sticker_pack')">贴纸</button>
      <button :class="['tab', { active: activeType === 'font' }]" @click="setType('font')">字体</button>
      <button :class="['tab', { active: activeType === 'bundle' }]" @click="setType('bundle')">套装</button>
    </div>

    <n-spin v-if="shopStore.loading" style="display: flex; justify-content: center; padding: 48px 0;" />

    <!-- Coming Soon for non-skin types in phase 1 -->
    <n-empty
      v-else-if="activeType && activeType !== 'skin' && activeType !== 'bundle'"
      description="敬请期待"
      style="padding: 48px 0;"
    >
      <template #extra>
        <n-text depth="3">该类商品将在后续版本上线</n-text>
      </template>
    </n-empty>

    <n-empty
      v-else-if="shopStore.products.length === 0"
      description="暂无商品"
      style="padding: 48px 0;"
    />

    <!-- Products Grid -->
    <div v-else class="products-grid">
      <div
        v-for="product in shopStore.products"
        :key="product.id"
        class="product-card"
        @click="goToDetail(product.id)"
      >
        <div class="product-preview" :data-skin-preview="product.asset_key">
          <span class="preview-emoji">{{ skinEmoji(product.asset_key) }}</span>
        </div>
        <div class="product-info">
          <div class="product-name">{{ product.name }}</div>
          <div class="product-price">
            <span v-if="product.owned" class="owned-badge">已拥有</span>
            <span v-else-if="product.is_free" class="free-badge">免费</span>
            <span v-else class="price-text">{{ product.price }} 象币</span>
          </div>
        </div>
      </div>
    </div>

    <!-- Transactions Modal -->
    <n-modal v-model:show="showTransactions" preset="card" title="象币流水" style="max-width: 480px;">
      <WalletTransactions />
    </n-modal>
  </div>
</template>

<script setup lang="ts">
const shopStore = useShopStore()
const router = useRouter()

const activeType = ref<string | undefined>(undefined)
const showTransactions = ref(false)

function setType(type: string | undefined) {
  activeType.value = type
  if (type && type !== 'skin' && type !== 'bundle') return // "敬请期待" tabs
  shopStore.fetchProducts(type)
}

function goToDetail(id: number) {
  router.push(`/shop/product/${id}`)
}

function skinEmoji(key: string): string {
  const map: Record<string, string> = {
    default: '📓', kraft: '📜', grid: '📐', starry: '🌌',
    sakura: '🌸', forest: '🌿', ocean: '🌊',
  }
  return map[key] || '🎨'
}

onMounted(async () => {
  await Promise.all([shopStore.fetchProducts(), shopStore.fetchWallet()])
})
</script>

<style scoped>
.shop-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}

.shop-header .page-title {
  margin: 0;
}

.wallet-badge {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 6px 14px;
  background: var(--color-bg-card);
  border-radius: 20px;
  font-size: 14px;
  font-weight: 600;
  color: var(--color-text);
  cursor: pointer;
  transition: background var(--transition-fast);
}
.wallet-badge:active {
  background: var(--color-bg-elevated);
}

.filter-tabs {
  display: flex;
  gap: 8px;
  margin-bottom: 16px;
  overflow-x: auto;
  -webkit-overflow-scrolling: touch;
}
.tab {
  flex-shrink: 0;
  padding: 6px 16px;
  border: none;
  border-radius: 20px;
  background: var(--color-bg-card);
  color: var(--color-text-secondary);
  font-size: 13px;
  cursor: pointer;
  transition: all var(--transition-fast);
}
.tab.active {
  background: var(--color-primary);
  color: #fff;
}

.products-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 12px;
}

.product-card {
  background: var(--color-bg-card);
  border-radius: var(--radius-md, 12px);
  overflow: hidden;
  cursor: pointer;
  transition: transform var(--transition-fast);
  -webkit-tap-highlight-color: transparent;
}
.product-card:active {
  transform: scale(0.97);
}

.product-preview {
  height: 120px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--color-bg-elevated);
}
.preview-emoji {
  font-size: 48px;
}

.product-info {
  padding: 10px 12px;
}

.product-name {
  font-size: 14px;
  font-weight: 600;
  color: var(--color-text);
  margin-bottom: 4px;
}

.product-price {
  font-size: 13px;
}

.price-text {
  color: var(--color-primary);
  font-weight: 500;
}

.owned-badge {
  color: var(--color-success);
  font-size: 12px;
  font-weight: 500;
}

.free-badge {
  color: var(--color-text-muted);
  font-size: 12px;
}
</style>
