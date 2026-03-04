<template>
  <div class="transactions">
    <n-spin v-if="loading" style="display: flex; justify-content: center; padding: 24px 0;" />
    <n-empty v-else-if="transactions.length === 0" description="暂无流水记录" style="padding: 24px 0;" />
    <div v-else>
      <div v-for="tx in transactions" :key="tx.id" class="tx-item">
        <div class="tx-left">
          <span class="tx-icon">{{ tx.amount > 0 ? '📥' : '📤' }}</span>
          <div>
            <div class="tx-desc">{{ tx.description || typeLabel(tx.type) }}</div>
            <div class="tx-time">{{ formatTime(tx.created_at) }}</div>
          </div>
        </div>
        <div :class="['tx-amount', tx.amount > 0 ? 'positive' : 'negative']">
          {{ tx.amount > 0 ? '+' : '' }}{{ tx.amount }}
        </div>
      </div>
      <div v-if="hasMore" class="load-more" @click="loadMore">加载更多</div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { WalletTransaction } from '~/types'

const api = useApi()
const transactions = ref<WalletTransaction[]>([])
const loading = ref(false)
const page = ref(1)
const hasMore = ref(false)

function typeLabel(type: string) {
  const map: Record<string, string> = { recharge: '充值', purchase: '购买', reward: '奖励', refund: '退款' }
  return map[type] || type
}

function formatTime(dateStr: string) {
  const d = new Date(dateStr)
  return `${d.getMonth() + 1}/${d.getDate()} ${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`
}

async function load() {
  loading.value = true
  try {
    const res = await api.get<WalletTransaction[]>('/wallet/transactions', { page: page.value, limit: 20 })
    if (page.value === 1) {
      transactions.value = res.data || []
    } else {
      transactions.value.push(...(res.data || []))
    }
    hasMore.value = (res.pagination?.page || 1) < (res.pagination?.totalPages || 1)
  } finally {
    loading.value = false
  }
}

async function loadMore() {
  page.value++
  await load()
}

onMounted(load)
</script>

<style scoped>
.tx-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 0;
  border-bottom: 1px solid var(--color-border-light);
}
.tx-item:last-child {
  border-bottom: none;
}

.tx-left {
  display: flex;
  align-items: center;
  gap: 10px;
}

.tx-icon {
  font-size: 20px;
}

.tx-desc {
  font-size: 14px;
  color: var(--color-text);
}

.tx-time {
  font-size: 12px;
  color: var(--color-text-muted);
  margin-top: 2px;
}

.tx-amount {
  font-size: 15px;
  font-weight: 600;
}
.tx-amount.positive {
  color: var(--color-success);
}
.tx-amount.negative {
  color: var(--color-danger);
}

.load-more {
  text-align: center;
  padding: 12px;
  color: var(--color-primary);
  font-size: 14px;
  cursor: pointer;
}
</style>
