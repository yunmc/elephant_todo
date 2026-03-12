<template>
  <div class="page-container">
    <h1 class="page-title">打卡统计</h1>

    <!-- Time Range Tabs -->
    <div class="range-tabs">
      <button
        v-for="opt in rangeOptions"
        :key="opt.value"
        :class="['range-tab', { active: selectedDays === opt.value }]"
        @click="switchRange(opt.value)"
      >{{ opt.label }}</button>
    </div>

    <n-spin v-if="loading" style="display: flex; justify-content: center; padding: 48px 0;" />

    <template v-else-if="stats">
      <!-- Overall Stats -->
      <div class="overall-cards">
        <div class="stat-card primary">
          <div class="stat-num">{{ stats.overall.current_streak }}</div>
          <div class="stat-label">当前连续</div>
        </div>
        <div class="stat-card">
          <div class="stat-num">{{ stats.overall.longest_streak }}</div>
          <div class="stat-label">最长连续</div>
        </div>
        <div class="stat-card">
          <div class="stat-num">{{ stats.overall.perfect_days }}</div>
          <div class="stat-label">完美天数</div>
        </div>
        <div class="stat-card">
          <div class="stat-num">{{ stats.overall.overall_rate }}%</div>
          <div class="stat-label">总完成率</div>
        </div>
      </div>

      <!-- Heatmap -->
      <div v-if="stats.heatmap.length > 0" class="section">
        <h2 class="section-title">日历热力图</h2>
        <div class="heatmap-grid">
          <div
            v-for="day in stats.heatmap"
            :key="day.date"
            class="heatmap-cell"
            :class="heatmapClass(day.rate)"
            :title="`${day.date}: ${day.checked}/${day.total} (${day.rate}%)`"
          >
            <span class="heatmap-day">{{ dayOfMonth(day.date) }}</span>
          </div>
        </div>
        <div class="heatmap-legend">
          <span class="legend-label">少</span>
          <span class="legend-cell level-0"></span>
          <span class="legend-cell level-1"></span>
          <span class="legend-cell level-2"></span>
          <span class="legend-cell level-3"></span>
          <span class="legend-cell level-4"></span>
          <span class="legend-label">多</span>
        </div>
      </div>

      <!-- Per-Item Stats -->
      <div v-if="stats.items.length > 0" class="section">
        <h2 class="section-title">各项统计</h2>
        <div class="item-stats-list">
          <div v-for="item in stats.items" :key="item.item_id" class="item-stat-card">
            <div class="item-stat-header">
              <span class="item-stat-icon">{{ item.icon }}</span>
              <span class="item-stat-name">{{ item.title }}</span>
              <span class="item-stat-rate">{{ item.completion_rate }}%</span>
            </div>
            <div class="item-stat-bar">
              <div class="item-stat-fill" :style="{ width: item.completion_rate + '%' }"></div>
            </div>
            <div class="item-stat-detail">
              <span>打卡 {{ item.checked_days }}/{{ item.total_days }} 天</span>
              <span>连续 {{ item.current_streak }} 天</span>
              <span>最长 {{ item.longest_streak }} 天</span>
            </div>
          </div>
        </div>
      </div>

      <n-empty v-if="stats.items.length === 0" description="暂无统计数据" style="padding: 48px 0;">
        <template #extra>
          <n-text depth="3">开始打卡后即可查看统计</n-text>
        </template>
      </n-empty>
    </template>
  </div>
</template>

<script setup lang="ts">
import type { ChecklistStats } from '~/types'

const store = useChecklistStore()

const rangeOptions = [
  { label: '7 天', value: 7 },
  { label: '30 天', value: 30 },
  { label: '90 天', value: 90 },
]

const selectedDays = ref(30)
const stats = ref<ChecklistStats | null>(null)
const loading = ref(false)

async function loadStats() {
  loading.value = true
  try {
    stats.value = await store.fetchStats(selectedDays.value)
  } finally {
    loading.value = false
  }
}

function switchRange(days: number) {
  selectedDays.value = days
  loadStats()
}

function heatmapClass(rate: number) {
  if (rate === 0) return 'level-0'
  if (rate <= 25) return 'level-1'
  if (rate <= 50) return 'level-2'
  if (rate <= 75) return 'level-3'
  return 'level-4'
}

function dayOfMonth(dateStr: string) {
  return +dateStr.split('-')[2]
}

await useAsyncData('checklist-stats', async () => {
  await loadStats()
  return true
})
</script>

<style scoped>


.range-tabs {
  display: flex;
  gap: 8px;
  margin-bottom: 20px;
}
.range-tab {
  flex: 1;
  padding: 8px;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  background: transparent;
  font-size: 14px;
  color: var(--color-text);
  cursor: pointer;
  text-align: center;
  transition: all 0.15s;
  -webkit-tap-highlight-color: transparent;
}
.range-tab.active {
  background: var(--color-primary);
  color: var(--color-text-inverse);
  border-color: var(--color-primary);
}

.overall-cards {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 10px;
  margin-bottom: 24px;
}
.stat-card {
  background: var(--color-bg-card);
  border-radius: var(--radius-md, 12px);
  padding: 16px;
  text-align: center;
}
.stat-card.primary {
  background: var(--color-primary);
  color: var(--color-text-inverse);
}
.stat-card.primary .stat-label {
  color: var(--color-text-inverse);
  opacity: 0.8;
}
.stat-num {
  font-size: 28px;
  font-weight: 800;
  line-height: 1.2;
}
.stat-label {
  font-size: 12px;
  color: var(--color-text-muted);
  margin-top: 4px;
}

.section {
  margin-bottom: 24px;
}
.section-title {
  font-size: 15px;
  font-weight: 600;
  color: var(--color-text);
  margin-bottom: 12px;
}

/* Heatmap */
.heatmap-grid {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 3px;
}
.heatmap-cell {
  aspect-ratio: 1;
  border-radius: 3px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 10px;
  color: var(--color-text-muted);
}
.heatmap-cell.level-0 { background: var(--color-bg-elevated); }
.heatmap-cell.level-1 { background: rgba(var(--color-primary-rgb), 0.15); }
.heatmap-cell.level-2 { background: rgba(var(--color-primary-rgb), 0.35); }
.heatmap-cell.level-3 { background: rgba(var(--color-primary-rgb), 0.55); color: var(--color-text-inverse); }
.heatmap-cell.level-4 { background: rgba(var(--color-primary-rgb), 0.80); color: var(--color-text-inverse); }
.heatmap-day {
  font-weight: 500;
}

.heatmap-legend {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  margin-top: 8px;
}
.legend-label {
  font-size: 10px;
  color: var(--color-text-muted);
}
.legend-cell {
  width: 14px;
  height: 14px;
  border-radius: 2px;
}
.legend-cell.level-0 { background: var(--color-bg-elevated); }
.legend-cell.level-1 { background: rgba(var(--color-primary-rgb), 0.15); }
.legend-cell.level-2 { background: rgba(var(--color-primary-rgb), 0.35); }
.legend-cell.level-3 { background: rgba(var(--color-primary-rgb), 0.55); }
.legend-cell.level-4 { background: rgba(var(--color-primary-rgb), 0.80); }

/* Item Stats */
.item-stats-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.item-stat-card {
  background: var(--color-bg-card);
  border-radius: var(--radius-md, 12px);
  padding: 14px;
}
.item-stat-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
}
.item-stat-icon {
  font-size: 20px;
}
.item-stat-name {
  font-size: 14px;
  font-weight: 600;
  color: var(--color-text);
  flex: 1;
}
.item-stat-rate {
  font-size: 16px;
  font-weight: 700;
  color: var(--color-primary);
}
.item-stat-bar {
  height: 5px;
  background: var(--color-bg-elevated);
  border-radius: 2.5px;
  overflow: hidden;
  margin-bottom: 6px;
}
.item-stat-fill {
  height: 100%;
  background: var(--color-primary);
  border-radius: 2.5px;
  transition: width 0.3s ease;
}
.item-stat-detail {
  display: flex;
  gap: 12px;
  font-size: 11px;
  color: var(--color-text-muted);
}
</style>
