<template>
  <div class="page-container">


    <n-spin v-if="loading" style="display: flex; justify-content: center; padding: 48px 0;" />

    <template v-else-if="product">
      <!-- Preview -->
      <div class="product-preview-large" :data-skin-preview="product.asset_key">
        <span class="preview-emoji-large">{{ skinEmoji(product.asset_key) }}</span>
      </div>

      <!-- Info -->
      <div class="product-detail-info">
        <h2 class="product-title">{{ product.name }}</h2>
        <p class="product-desc">{{ product.description }}</p>

        <div class="product-price-row">
          <span v-if="product.owned" class="owned-badge-lg">✓ 已拥有</span>
          <span v-else-if="product.is_free" class="free-badge-lg">免费</span>
          <span v-else class="price-text-lg">{{ product.price }} 象币</span>
        </div>

        <!-- Purchase / Equip Button -->
        <div class="action-row">
          <n-button
            v-if="!product.owned && !product.is_free"
            type="primary"
            block
            size="large"
            :loading="purchasing"
            @click="handlePurchase"
          >
            立即购买
          </n-button>
          <n-button
            v-else
            type="primary"
            block
            size="large"
            :disabled="isEquipped"
            @click="handleEquip"
          >
            {{ isEquipped ? '使用中' : '立即使用' }}
          </n-button>
        </div>

        <!-- Bundle Items -->
        <div v-if="product.bundle_items && product.bundle_items.length > 0" class="bundle-section">
          <h3 class="bundle-title">套装包含</h3>
          <div class="bundle-items">
            <div v-for="item in product.bundle_items" :key="item.id" class="bundle-item">
              <span class="bundle-item-icon">{{ skinEmoji(item.asset_key) }}</span>
              <span class="bundle-item-name">{{ item.name }}</span>
              <span v-if="item.owned" class="bundle-item-owned">已拥有</span>
            </div>
          </div>
        </div>
      </div>
    </template>

    <n-empty v-else description="商品不存在" style="padding: 48px 0;" />
  </div>
</template>

<script setup lang="ts">
import type { ShopProduct } from '~/types'

const route = useRoute()
const router = useRouter()
const shopStore = useShopStore()
const { updateAppearance } = useAppearance()
const message = useMessage()

const product = ref<ShopProduct | null>(null)
const loading = ref(true)
const purchasing = ref(false)

const isEquipped = computed(() => {
  const { appearance } = useAppearance()
  if (!product.value) return false
  return appearance.value?.skin_id === product.value.id
})

function skinEmoji(key: string): string {
  const map: Record<string, string> = {
    default: '📓', kraft: '📜', grid: '📐', starry: '🌌',
    sakura: '🌸', forest: '🌿', ocean: '🌊',
  }
  return map[key] || '🎨'
}

async function loadProduct() {
  loading.value = true
  try {
    const id = Number(route.params.id)
    product.value = await shopStore.fetchProductDetail(id)
  } catch {
    product.value = null
  } finally {
    loading.value = false
  }
}

async function handlePurchase() {
  if (!product.value) return
  purchasing.value = true
  try {
    await shopStore.purchase(product.value.id)
    message.success('购买成功！')
    // Reload product detail to update owned status
    await loadProduct()
  } catch (err: any) {
    const msg = err?.response?._data?.message || err?.message || '购买失败'
    message.error(msg)
  } finally {
    purchasing.value = false
  }
}

async function handleEquip() {
  if (!product.value) return
  try {
    await updateAppearance({ skin_id: product.value.id })
    message.success('装扮已更换')
  } catch (err: any) {
    const msg = err?.response?._data?.message || err?.message || '装扮失败'
    message.error(msg)
  }
}

onMounted(loadProduct)
</script>

<style scoped>
.product-preview-large {
  height: 200px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--color-bg-card);
  border-radius: var(--radius-lg, 16px);
  margin-bottom: 20px;
}
.preview-emoji-large {
  font-size: 80px;
}

.product-detail-info {
  padding: 0 4px;
}

.product-title {
  font-size: 22px;
  font-weight: 700;
  color: var(--color-text);
  margin-bottom: 8px;
}

.product-desc {
  font-size: 14px;
  color: var(--color-text-secondary);
  margin-bottom: 16px;
  line-height: 1.6;
}

.product-price-row {
  margin-bottom: 20px;
}

.price-text-lg {
  font-size: 20px;
  font-weight: 700;
  color: var(--color-primary);
}

.owned-badge-lg {
  font-size: 16px;
  font-weight: 600;
  color: var(--color-success);
}

.free-badge-lg {
  font-size: 16px;
  color: var(--color-text-muted);
}

.action-row {
  margin-bottom: 24px;
}

.bundle-section {
  margin-top: 16px;
}

.bundle-title {
  font-size: 16px;
  font-weight: 600;
  color: var(--color-text);
  margin-bottom: 12px;
}

.bundle-items {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.bundle-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  background: var(--color-bg-card);
  border-radius: var(--radius-sm, 8px);
}

.bundle-item-icon {
  font-size: 24px;
}

.bundle-item-name {
  flex: 1;
  font-size: 14px;
  color: var(--color-text);
}

.bundle-item-owned {
  font-size: 12px;
  color: var(--color-success);
}
</style>
