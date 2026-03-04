<template>
  <div class="budget-section">
    <!-- Budget Progress Card -->
    <div v-if="budgetProgress" class="budget-card">
      <div class="budget-header">
        <span class="budget-title">{{ monthLabel }}月预算</span>
        <n-button size="tiny" quaternary @click="emit('edit')">设置预算</n-button>
      </div>

      <!-- Total Budget -->
      <div class="budget-total">
        <div class="budget-total-label">
          总预算 ¥{{ formatBudget(budgetProgress.total_budget) }}
        </div>
        <n-progress
          type="line"
          :percentage="Math.min(budgetProgress.percentage, 100)"
          :color="progressColor(budgetProgress.percentage)"
          :rail-color="'var(--color-bg-elevated)'"
          :height="10"
          :border-radius="5"
          :show-indicator="false"
        />
        <div class="budget-meta">
          <span :style="{ color: progressColor(budgetProgress.percentage) }">
            已用 {{ budgetProgress.percentage }}%
          </span>
          <span>剩余 ¥{{ formatBudget(budgetProgress.remaining) }}</span>
        </div>
        <div v-if="budgetProgress.days_left > 0" class="budget-daily">
          日均可花 ¥{{ formatBudget(budgetProgress.daily_remaining) }}（剩 {{ budgetProgress.days_left }} 天）
        </div>
      </div>

      <!-- Category Budgets -->
      <div v-if="budgetProgress.categories.length > 0" class="budget-categories">
        <div v-for="cat in budgetProgress.categories" :key="cat.category_id" class="budget-cat-item">
          <div class="budget-cat-header">
            <span>{{ cat.category_icon }} {{ cat.category_name }}</span>
            <span class="budget-cat-amount">
              ¥{{ formatBudget(cat.spent) }} / ¥{{ formatBudget(cat.budget) }}
            </span>
          </div>
          <n-progress
            type="line"
            :percentage="Math.min(cat.percentage, 100)"
            :color="progressColor(cat.percentage)"
            :rail-color="'var(--color-bg-elevated)'"
            :height="6"
            :border-radius="3"
            :show-indicator="false"
          />
          <div class="budget-cat-pct">
            <span :style="{ color: progressColor(cat.percentage) }">
              {{ cat.percentage }}%
            </span>
            <span v-if="cat.status === 'warning'" class="budget-status-badge warning">⚠️</span>
            <span v-if="cat.status === 'over'" class="budget-status-badge over">超支</span>
          </div>
        </div>
      </div>
    </div>

    <!-- No Budget Set -->
    <div v-else-if="!isPremium" class="budget-locked">
      <div class="lock-icon">🔒</div>
      <div class="lock-text">升级 Premium 使用预算管理</div>
      <n-button size="small" type="primary" @click="guardPremium()">了解详情</n-button>
    </div>
    <div v-else class="budget-empty">
      <n-button size="small" dashed block @click="emit('edit')">📊 设置月度预算</n-button>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { BudgetProgress } from '~/types'

const props = defineProps<{
  budgetProgress: BudgetProgress | null
  monthLabel: number
  isPremium: boolean
}>()

const emit = defineEmits<{
  edit: []
}>()

const { guardPremium } = usePremium()

function formatBudget(val: number) {
  return val < 0 ? `-${Math.abs(val).toFixed(2)}` : val.toFixed(2)
}

function progressColor(percentage: number): string {
  if (percentage >= 100) return '#ef4444'
  if (percentage >= 80) return '#f59e0b'
  return '#10b981'
}
</script>

<style scoped>
.budget-card {
  background: var(--color-bg-card);
  border-radius: var(--radius-md, 12px);
  padding: 14px;
  margin-bottom: 16px;
}
.budget-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 10px;
}
.budget-title {
  font-size: 15px;
  font-weight: 600;
  color: var(--color-text);
}
.budget-total {
  margin-bottom: 12px;
}
.budget-total-label {
  font-size: 14px;
  color: var(--color-text);
  margin-bottom: 6px;
  font-weight: 500;
}
.budget-meta {
  display: flex;
  justify-content: space-between;
  font-size: 12px;
  color: var(--color-text-secondary);
  margin-top: 4px;
}
.budget-daily {
  font-size: 12px;
  color: var(--color-text-muted);
  margin-top: 2px;
}
.budget-categories {
  border-top: 1px solid var(--color-border);
  padding-top: 10px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.budget-cat-item {
  display: flex;
  flex-direction: column;
  gap: 3px;
}
.budget-cat-header {
  display: flex;
  justify-content: space-between;
  font-size: 13px;
  color: var(--color-text);
}
.budget-cat-amount {
  font-size: 12px;
  color: var(--color-text-secondary);
}
.budget-cat-pct {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 11px;
  color: var(--color-text-muted);
}
.budget-status-badge {
  font-size: 11px;
  padding: 0 4px;
  border-radius: 4px;
}
.budget-status-badge.warning { color: #f59e0b; }
.budget-status-badge.over { color: #ef4444; font-weight: 600; }

.budget-locked {
  background: var(--color-bg-card);
  border-radius: var(--radius-md, 12px);
  padding: 20px;
  margin-bottom: 16px;
  text-align: center;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
}
.lock-icon { font-size: 24px; }
.lock-text { font-size: 13px; color: var(--color-text-secondary); }

.budget-empty {
  margin-bottom: 16px;
}
</style>
