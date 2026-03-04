<template>
  <div class="page-container">
    <h1 class="page-title">🎒 我的仓库</h1>

    <!-- Current Appearance -->
    <div class="section-card current-appearance">
      <h3 class="section-title">当前装扮</h3>
      <div class="appearance-row">
        <span class="appearance-label">皮肤</span>
        <div class="appearance-value">
          <span>{{ appearance?.skin?.name || '简约默认' }}</span>
          <n-button text size="small" @click="showSkinPicker = true">更换</n-button>
        </div>
      </div>
    </div>

    <n-spin v-if="loading" style="display: flex; justify-content: center; padding: 48px 0;" />

    <template v-else>
      <h3 class="section-subtitle">已拥有商品 ({{ ownedProducts.length }}件)</h3>

      <n-empty v-if="ownedProducts.length === 0" description="还没有商品" style="padding: 24px 0;">
        <template #extra>
          <n-button type="primary" size="small" @click="router.push('/shop')">去逛逛商店</n-button>
        </template>
      </n-empty>

      <div v-else class="products-grid">
        <div
          v-for="item in ownedProducts"
          :key="item.id"
          class="product-card"
          :class="{ equipped: isCurrentSkin(item) }"
          @click="equipSkin(item)"
        >
          <div class="product-preview">
            <span class="preview-emoji">{{ skinEmoji(item.asset_key) }}</span>
          </div>
          <div class="product-info">
            <div class="product-name">{{ item.name }}</div>
            <div v-if="isCurrentSkin(item)" class="equipped-tag">使用中</div>
          </div>
        </div>
      </div>
    </template>

    <!-- Skin Picker Modal -->
    <n-modal v-model:show="showSkinPicker" preset="card" title="选择皮肤" style="max-width: 480px;">
      <div class="skin-picker-grid">
        <div
          v-for="item in skinProducts"
          :key="item.product_id || item.id"
          class="skin-pick-item"
          :class="{ active: isCurrentSkin(item) }"
          @click="selectSkin(item)"
        >
          <span class="skin-pick-emoji">{{ skinEmoji(item.asset_key) }}</span>
          <span class="skin-pick-name">{{ item.name }}</span>
        </div>
        <!-- Default skin always available -->
        <div
          class="skin-pick-item"
          :class="{ active: !appearance?.skin_id }"
          @click="selectSkin(null)"
        >
          <span class="skin-pick-emoji">📓</span>
          <span class="skin-pick-name">简约默认</span>
        </div>
      </div>
    </n-modal>
  </div>
</template>

<script setup lang="ts">
const router = useRouter()
const shopStore = useShopStore()
const { appearance, updateAppearance } = useAppearance()
const message = useMessage()

const loading = ref(true)
const showSkinPicker = ref(false)

// All owned products (from inventory API)
const ownedProducts = computed(() => shopStore.myProducts as any[])

// Skin-type products only (for skin picker)
const skinProducts = computed(() =>
  ownedProducts.value.filter((p: any) => p.type === 'skin')
)

function skinEmoji(key: string): string {
  const map: Record<string, string> = {
    default: '📓', kraft: '📜', grid: '📐', starry: '🌌',
    sakura: '🌸', forest: '🌿', ocean: '🌊',
  }
  return map[key] || '🎨'
}

function isCurrentSkin(item: any): boolean {
  return appearance.value?.skin_id === (item.product_id || item.id)
}

async function equipSkin(item: any) {
  const id = item.product_id || item.id
  if (appearance.value?.skin_id === id) return
  try {
    await updateAppearance({ skin_id: id })
    message.success('装扮已更换')
  } catch (err: any) {
    message.error(err?.response?._data?.message || '装扮失败')
  }
}

async function selectSkin(item: any) {
  const skinId = item ? (item.product_id || item.id) : null
  try {
    await updateAppearance({ skin_id: skinId })
    message.success(skinId ? '装扮已更换' : '已恢复默认皮肤')
    showSkinPicker.value = false
  } catch (err: any) {
    message.error(err?.response?._data?.message || '装扮失败')
  }
}

onMounted(async () => {
  try {
    await shopStore.fetchMyProducts()
  } finally {
    loading.value = false
  }
})
</script>

<style scoped>
.current-appearance {
  background: var(--color-bg-card);
  border-radius: var(--radius-md, 12px);
  padding: 16px;
  margin-bottom: 20px;
}

.section-title {
  font-size: 15px;
  font-weight: 600;
  color: var(--color-text);
  margin-bottom: 12px;
}

.section-subtitle {
  font-size: 15px;
  font-weight: 600;
  color: var(--color-text);
  margin-bottom: 12px;
}

.appearance-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.appearance-label {
  font-size: 14px;
  color: var(--color-text-secondary);
}

.appearance-value {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
  color: var(--color-text);
}

.products-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 10px;
}

.product-card {
  background: var(--color-bg-card);
  border-radius: var(--radius-md, 12px);
  overflow: hidden;
  cursor: pointer;
  transition: transform var(--transition-fast);
  -webkit-tap-highlight-color: transparent;
  border: 2px solid transparent;
}
.product-card.equipped {
  border-color: var(--color-primary);
}
.product-card:active {
  transform: scale(0.97);
}

.product-preview {
  height: 80px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--color-bg-elevated);
}
.preview-emoji {
  font-size: 36px;
}

.product-info {
  padding: 8px 10px;
  text-align: center;
}

.product-name {
  font-size: 12px;
  font-weight: 600;
  color: var(--color-text);
}

.equipped-tag {
  font-size: 10px;
  color: var(--color-primary);
  font-weight: 500;
  margin-top: 2px;
}

/* Skin Picker */
.skin-picker-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 10px;
}

.skin-pick-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  padding: 16px 8px;
  border-radius: var(--radius-md, 12px);
  background: var(--color-bg-elevated);
  cursor: pointer;
  border: 2px solid transparent;
  transition: all var(--transition-fast);
}
.skin-pick-item.active {
  border-color: var(--color-primary);
  background: var(--color-primary-light);
}
.skin-pick-item:active {
  transform: scale(0.97);
}

.skin-pick-emoji {
  font-size: 32px;
}

.skin-pick-name {
  font-size: 12px;
  color: var(--color-text);
  font-weight: 500;
}
</style>
