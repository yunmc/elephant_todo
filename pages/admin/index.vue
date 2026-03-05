<template>
  <div>
    <div v-if="loading" style="text-align: center; padding: 60px 0;">
      <n-spin size="large" />
    </div>

    <template v-else>
      <!-- Stats Cards -->
      <div class="stats-grid">
        <div class="stat-card">
          <div class="stat-value">{{ stats.totalUsers }}</div>
          <div class="stat-label">总用户数</div>
        </div>
        <div class="stat-card accent">
          <div class="stat-value">{{ stats.premiumUsers }}</div>
          <div class="stat-label">Premium 用户</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">{{ stats.todayNew }}</div>
          <div class="stat-label">今日注册</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">{{ stats.todayActive }}</div>
          <div class="stat-label">今日活跃</div>
        </div>
        <div class="stat-card accent">
          <div class="stat-value">{{ stats.conversionRate }}%</div>
          <div class="stat-label">付费转化率</div>
        </div>
      </div>

      <!-- Revenue & Module Usage -->
      <div class="section-grid">
        <div class="section-card">
          <h3>收入概览</h3>
          <div class="revenue-list">
            <div class="revenue-item">
              <span class="revenue-label">Premium 订阅收入</span>
              <span class="revenue-value">¥{{ Number(stats.revenue?.premiumRevenue || 0).toFixed(2) }}</span>
            </div>
            <div class="revenue-item">
              <span class="revenue-label">象币消费总额</span>
              <span class="revenue-value">{{ stats.revenue?.shopRevenue || 0 }} 🪙</span>
            </div>
          </div>
        </div>

        <div class="section-card">
          <h3>模块使用量</h3>
          <div class="module-list">
            <div v-for="(count, key) in stats.moduleUsage" :key="key" class="module-item">
              <span class="module-label">{{ moduleNames[key as string] || key }}</span>
              <n-progress type="line" :percentage="getModulePercent(count as number)" :show-indicator="false" style="flex: 1;" />
              <span class="module-count">{{ count }}</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Registration Trend -->
      <div class="section-card" style="margin-top: 20px;">
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <h3>注册趋势（近 {{ trendDays }} 天）</h3>
          <n-select v-model:value="trendDays" :options="trendOptions" size="small" style="width: 120px;" @update:value="loadTrend" />
        </div>
        <div class="trend-chart" v-if="trend.length">
          <div class="trend-bar-group" v-for="item in trend" :key="item.date">
            <div class="trend-bar" :style="{ height: getTrendHeight(item.count) + 'px' }" :title="`${item.date}: ${item.count} 人`"></div>
            <div class="trend-date">{{ formatTrendDate(item.date) }}</div>
          </div>
        </div>
        <n-empty v-else description="暂无数据" />
      </div>

      <!-- Top Products -->
      <div class="section-card" style="margin-top: 20px;">
        <h3>热门商品 Top 10</h3>
        <n-data-table :columns="productColumns" :data="topProducts" :bordered="false" size="small" />
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import type { DataTableColumns } from 'naive-ui'

definePageMeta({
  layout: 'admin',
  middleware: 'admin',
})

const api = useAdminApi()

const loading = ref(true)
const stats = ref<any>({})
const trend = ref<any[]>([])
const topProducts = ref<any[]>([])
const trendDays = ref(30)

const moduleNames: Record<string, string> = {
  todos: '待办事项',
  ideas: '随手记',
  finance: '记账',
  vault: '密码本',
  important_dates: '重要日期',
  period: '经期追踪',
}

const trendOptions = [
  { label: '近 7 天', value: 7 },
  { label: '近 30 天', value: 30 },
  { label: '近 90 天', value: 90 },
]

const productColumns: DataTableColumns = [
  { title: '排名', key: 'rank', width: 60, render: (_: any, index: number) => h('span', `#${index + 1}`) },
  { title: '商品名', key: 'name' },
  { title: '类型', key: 'type' },
  { title: '销量', key: 'sold', sorter: 'default' },
  { title: '收入', key: 'revenue', render: (row: any) => h('span', `${row.revenue} 🪙`) },
]

function getModulePercent(count: number): number {
  const max = Math.max(...Object.values(stats.value.moduleUsage || {}).map(Number), 1)
  return Math.round((count / max) * 100)
}

function getTrendHeight(count: number): number {
  const max = Math.max(...trend.value.map((t: any) => t.count), 1)
  return Math.max(4, Math.round((count / max) * 120))
}

function formatTrendDate(date: string): string {
  return date.slice(5) // MM-DD
}

async function loadTrend() {
  try {
    trend.value = await api.get('/stats/trend', { days: trendDays.value })
  } catch { /* ignore */ }
}

onMounted(async () => {
  try {
    const [overviewData, trendData, productsData] = await Promise.all([
      api.get('/stats/overview'),
      api.get('/stats/trend', { days: trendDays.value }),
      api.get('/stats/products', { limit: 10 }),
    ])
    stats.value = overviewData
    trend.value = trendData
    topProducts.value = productsData
  } catch (err: any) {
    console.error('Failed to load dashboard:', err)
  } finally {
    loading.value = false
  }
})
</script>

<style lang="scss" scoped>
.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
  gap: 16px;
  margin-bottom: 24px;
}

.stat-card {
  background: #fff;
  border-radius: 12px;
  padding: 20px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.06);

  &.accent {
    background: linear-gradient(135deg, #6366f1, #818cf8);
    color: #fff;

    .stat-label { color: rgba(255, 255, 255, 0.8); }
  }

  .stat-value {
    font-size: 28px;
    font-weight: 700;
    line-height: 1.2;
  }

  .stat-label {
    font-size: 13px;
    color: #6b7280;
    margin-top: 4px;
  }
}

.section-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 20px;
}

.section-card {
  background: #fff;
  border-radius: 12px;
  padding: 20px 24px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.06);

  h3 {
    margin: 0 0 16px;
    font-size: 16px;
    font-weight: 600;
    color: #1f2937;
  }
}

.revenue-list { display: flex; flex-direction: column; gap: 12px; }

.revenue-item {
  display: flex;
  justify-content: space-between;
  align-items: center;

  .revenue-label { font-size: 14px; color: #6b7280; }
  .revenue-value { font-size: 16px; font-weight: 600; color: #1f2937; }
}

.module-list { display: flex; flex-direction: column; gap: 10px; }

.module-item {
  display: flex;
  align-items: center;
  gap: 12px;

  .module-label { width: 70px; font-size: 13px; color: #6b7280; flex-shrink: 0; }
  .module-count { font-size: 13px; font-weight: 600; color: #1f2937; width: 50px; text-align: right; }
}

.trend-chart {
  display: flex;
  align-items: flex-end;
  gap: 3px;
  height: 160px;
  padding-top: 20px;
  overflow-x: auto;
}

.trend-bar-group {
  display: flex;
  flex-direction: column;
  align-items: center;
  flex: 1;
  min-width: 16px;
}

.trend-bar {
  width: 100%;
  max-width: 24px;
  background: linear-gradient(180deg, #6366f1, #a5b4fc);
  border-radius: 4px 4px 0 0;
  transition: height 0.3s;
  cursor: pointer;

  &:hover { background: #4f46e5; }
}

.trend-date {
  font-size: 10px;
  color: #9ca3af;
  margin-top: 4px;
  white-space: nowrap;
}
</style>
