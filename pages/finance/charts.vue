<template>
  <div class="page-container">
    <h1 class="page-title">记账图表</h1>

    <!-- Month Selector -->
    <div class="month-selector">
      <button class="month-btn" @click="prevMonth">←</button>
      <span class="month-label">{{ currentYear }}年{{ currentMonth }}月</span>
      <button class="month-btn" @click="nextMonth">→</button>
    </div>

    <n-spin v-if="loading" style="display: flex; justify-content: center; padding: 48px 0;" />

    <template v-else>
      <!-- Expense Pie Chart -->
      <ChartsExpensePieChart
        :by-category="financeStore.statistics?.by_category || []"
        :total-expense="financeStore.statistics?.total_expense || 0"
      />

      <!-- Monthly Trend Chart -->
      <ChartsMonthlyTrendChart
        :data="financeStore.trend"
        :months="trendMonths"
        @update:months="changeTrendRange"
      />

      <!-- Income Pie Chart -->
      <ChartsIncomePieChart
        :by-category="financeStore.statistics?.by_category || []"
        :total-income="financeStore.statistics?.total_income || 0"
      />
    </template>

  </div>
</template>

<script setup lang="ts">
const financeStore = useFinanceStore()
const loading = ref(false)
const trendMonths = ref(6)

// Month control
const currentDate = ref(new Date())
const currentYear = computed(() => currentDate.value.getFullYear())
const currentMonth = computed(() => currentDate.value.getMonth() + 1)

const startDate = computed(() => `${currentYear.value}-${String(currentMonth.value).padStart(2, '0')}-01`)
const endDate = computed(() => {
  const lastDay = new Date(currentYear.value, currentMonth.value, 0).getDate()
  return `${currentYear.value}-${String(currentMonth.value).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`
})

async function loadData() {
  loading.value = true
  try {
    await Promise.all([
      financeStore.fetchStatistics(startDate.value, endDate.value),
      financeStore.fetchTrend(trendMonths.value),
    ])
  } finally {
    loading.value = false
  }
}

function prevMonth() {
  const d = new Date(currentDate.value)
  d.setMonth(d.getMonth() - 1)
  currentDate.value = d
  loadData()
}

function nextMonth() {
  const d = new Date(currentDate.value)
  d.setMonth(d.getMonth() + 1)
  currentDate.value = d
  loadData()
}

function changeTrendRange(months: number) {
  trendMonths.value = months
  financeStore.fetchTrend(months)
}

await useAsyncData('finance-charts', () => loadData())
</script>

<style scoped>
.month-selector {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 16px;
  margin-bottom: 16px;
}
.month-btn {
  background: var(--color-bg-card);
  border: none;
  border-radius: var(--radius-sm, 8px);
  padding: 6px 12px;
  font-size: 16px;
  cursor: pointer;
  color: var(--color-text);
  min-height: 36px;
  min-width: 36px;
}
.month-btn:active { transform: scale(0.95); }
.month-label {
  font-size: 16px;
  font-weight: 600;
  color: var(--color-text);
}
</style>
