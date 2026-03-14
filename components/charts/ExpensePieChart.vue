<template>
  <div class="chart-card">
    <h3 class="chart-title">支出分类</h3>
    <ClientOnly>
      <ChartsBaseChart v-if="hasData" :option="chartOption" :height="280" />
      <div v-else class="chart-empty">本月暂无支出记录</div>
    </ClientOnly>
  </div>
</template>

<script setup lang="ts">
import type { EChartsOption } from 'echarts'

const COLORS = ['#5B8FF9', '#5AD8A6', '#F6BD16', '#E86452', '#6DC8EC', '#945FB9', '#FF9845', '#1E9493']

const props = defineProps<{
  byCategory: { category_id: number | null; category_name: string; category_icon: string; type: string; total: number }[]
  totalExpense: number
}>()

const expenseCategories = computed(() =>
  props.byCategory
    .filter(c => c.type === 'expense' && Number(c.total) > 0)
    .sort((a, b) => Number(b.total) - Number(a.total)),
)

const hasData = computed(() => expenseCategories.value.length > 0)

const chartOption = computed<EChartsOption>(() => {
  let data = expenseCategories.value.map((c, i) => ({
    name: `${c.category_icon} ${c.category_name}`,
    value: Number(c.total),
    itemStyle: { color: COLORS[i % COLORS.length] },
  }))

  // Merge items beyond 8 into "其他"
  if (data.length > 8) {
    const top7 = data.slice(0, 7)
    const otherTotal = data.slice(7).reduce((sum, d) => sum + d.value, 0)
    top7.push({ name: '其他', value: otherTotal, itemStyle: { color: '#ccc' } })
    data = top7
  }

  return {
    tooltip: {
      trigger: 'item',
      formatter: (params: any) => {
        return `${params.name}<br/>¥${Number(params.value).toFixed(2)} (${params.percent}%)`
      },
    },
    legend: {
      orient: 'horizontal',
      bottom: 0,
      itemWidth: 10,
      itemHeight: 10,
      textStyle: { fontSize: 12 },
    },
    series: [{
      type: 'pie',
      radius: ['40%', '65%'],
      center: ['50%', '42%'],
      avoidLabelOverlap: true,
      itemStyle: { borderRadius: 4, borderColor: 'transparent', borderWidth: 2 },
      label: { show: false },
      emphasis: {
        label: { show: true, fontSize: 14, fontWeight: 'bold' },
      },
      data,
    }],
    graphic: [{
      type: 'text',
      left: 'center',
      top: '36%',
      style: {
        text: `¥${Number(props.totalExpense).toFixed(0)}`,
        textAlign: 'center',
        fontSize: 18,
        fontWeight: 'bold',
        fill: getComputedStyle(document.documentElement).getPropertyValue('--color-text-primary').trim() || '#333',
      },
    }],
  }
})
</script>

<style scoped>
.chart-card {
  background: var(--color-bg-card);
  border-radius: var(--radius-md, 12px);
  padding: 16px;
  margin-bottom: 12px;
}
.chart-title {
  font-size: 15px;
  font-weight: 600;
  margin: 0 0 8px 0;
  color: var(--color-text);
}
.chart-empty {
  text-align: center;
  padding: 40px 0;
  color: var(--color-text-muted);
  font-size: 14px;
}
</style>
