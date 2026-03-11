<template>
  <n-modal
    v-model:show="showUpgradeModal"
    preset="card"
    :title="upgradeModalExpired ? '🐘 会员已过期' : '🐘 升级 Premium'"
    :style="{ maxWidth: '400px', width: '100%' }"
    :segmented="{ content: true }"
    @after-leave="onClose"
  >
    <div class="premium-modal-body">
      <p class="premium-desc">
        {{ upgradeModalExpired ? '续费后可继续使用全部高级功能' : '解锁全部高级功能：' }}
      </p>

      <div class="premium-features">
        <div class="feature-item">📒 多账本管理</div>
        <div class="feature-item">💰 预算管理 + 多币种</div>
        <div class="feature-item">📸 记录附带图片</div>
        <div class="feature-item">🤖 AI 智能助手</div>
      </div>

      <div class="plan-options">
        <div
          class="plan-card"
          :class="{ active: selectedPlan === 'monthly' }"
          @click="selectedPlan = 'monthly'"
        >
          <div class="plan-price">¥3/月</div>
        </div>
        <div
          class="plan-card"
          :class="{ active: selectedPlan === 'yearly' }"
          @click="selectedPlan = 'yearly'"
        >
          <div class="plan-price">¥28/年</div>
          <div class="plan-badge">省 ¥8 🔥</div>
        </div>
      </div>
    </div>

    <template #action>
      <n-space vertical :size="8" style="width: 100%;">
        <n-button type="primary" block @click="handleUpgrade">
          立即升级
        </n-button>
        <n-button text block style="color: var(--n-text-color-3);" @click="showUpgradeModal = false">
          以后再说
        </n-button>
      </n-space>
    </template>
  </n-modal>
</template>

<script setup lang="ts">
const message = useMessage()
const { showUpgradeModal, upgradeModalExpired } = usePremium()

const selectedPlan = ref<'monthly' | 'yearly'>('yearly')

function handleUpgrade() {
  // 当前阶段：支付功能未对接，弹提示
  message.info('支付功能开发中，敬请期待 🐘')
}

function onClose() {
  upgradeModalExpired.value = false
}
</script>

<style lang="scss" scoped>
.premium-modal-body {
  padding: 4px 0;
}

.premium-desc {
  font-size: 14px;
  color: var(--color-text-secondary);
  margin-bottom: 16px;
}

.premium-features {
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin-bottom: 20px;
}

.feature-item {
  font-size: 14px;
  padding: 8px 12px;
  background: var(--color-bg-elevated);
  border-radius: 8px;
}

.plan-options {
  display: flex;
  gap: 12px;
}

.plan-card {
  flex: 1;
  padding: 16px;
  border: 2px solid var(--color-text-muted);
  border-radius: 12px;
  text-align: center;
  cursor: pointer;
  transition: border-color 0.2s, background 0.2s;

  &.active {
    border-color: var(--color-primary);
    background: var(--color-primary-light);
  }
}

.plan-price {
  font-size: 18px;
  font-weight: 600;
}

.plan-badge {
  font-size: 12px;
  color: var(--color-accent);
  margin-top: 4px;
}
</style>
