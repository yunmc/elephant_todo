<template>
  <div class="chart-card">
    <div class="chart-header">
      <h3 class="chart-title">收支趋势</h3>
      <div class="range-toggle">
        <button :class="['range-btn', { active: months === 6 }]" @click="$emit('update:months', 6)">6个月</button>
        <button :class="['range-btn', { active: months === 12 }]" @click="$emit('update:months', 12)">12个月</button>
      </div>
    </div>
    <ClientOnly>
      <ChartsBaseChart v-if="data.length" :option="chartOption" :height="260" />
      <div v-else class="chart-empty">暂无趋势数据</div>
    </ClientOnly>
  </div>
</template>

<script setup lang="ts">
import type { EChartsOption } from 'echarts'
import type { FinanceTrendItem } from '~/types'

const props = defineProps<{
  data: FinanceTrendItem[]
  months: number
}>()

defineEmits<{
  'update:months': [value: number]
}>()

const chartOption = computed<EChartsOption>(() => {
  const months = props.data.map(d => {
    const parts = d.month.split('-')
    return `${+parts[1]}月`
  })
  const incomeData = props.data.map(d => d.income)
  const expenseData = props.data.map(d => d.expense)

  return {
    tooltip: {
      trigger: 'axis',
      formatter: (params: any) => {
        const lines = params.map((p: any) => `${p.marker} ${p.seriesName}: ¥${Number(p.value).toFixed(2)}`)
        return `${params[0].name}<br/>${lines.join('<br/>')}`
      },
    },
    legend: {
      data: ['收入', '支出'],
      bottom: 0,
      itemWidth: 16,
      itemHeight: 3,
      textStyle: { fontSize: 12 },
    },
    grid: {
      left: 12,
      right: 12,
      top: 16,
      bottom: 36,
      containLabel: true,
    },
    xAxis: {
      type: 'category',
      data: months,
      axisLabel: { fontSize: 11 },
      axisTick: { show: false },
      axisLine: { lineStyle: { color: '#ddd' } },
    },
    yAxis: {
      type: 'value',
      axisLabel: {
        fontSize: 10,
        formatter: (val: number) => val >= 10000 ? `${(val / 10000).toFixed(0)}万` : `${val}`,
      },
      splitLine: { lineStyle: { color: '#f0f0f0', type: 'dashed' } },
    },
    series: [
      {
        name: '收入',
        type: 'line',
        data: incomeData,
        smooth: true,
        symbol: 'circle',
        symbolSize: 6,
        lineStyle: { width: 2.5, color: '#5AD8A6' },
        itemStyle: { color: '#5AD8A6' },
        areaStyle: { color: 'rgba(90, 216, 166, 0.08)' },
      },
      {
        name: '支出',
        type: 'line',
        data: expenseData,
        smooth: true,
        symbol: 'circle',
        symbolSize: 6,
        lineStyle: { width: 2.5, color: '#E86452' },
        itemStyle: { color: '#E86452' },
        areaStyle: { color: 'rgba(232, 100, 82, 0.08)' },
      },
    ],
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
.chart-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
}
.chart-title {
  font-size: 15px;
  font-weight: 600;
  margin: 0;
  color: var(--color-text);
}
.range-toggle {
  display: flex;
  gap: 4px;
}
.range-btn {
  padding: 3px 10px;
  font-size: 12px;
  border: 1px solid var(--color-border, #e0e0e0);
  border-radius: var(--radius-sm, 6px);
  background: transparent;
  color: var(--color-text-secondary);
  cursor: pointer;
}
.range-btn.active {
  background: var(--color-primary);
  color: var(--color-text-inverse, #fff);
  border-color: var(--color-primary);
}
.chart-empty {
  text-align: center;
  padding: 40px 0;
  color: var(--color-text-muted);
  font-size: 14px;
}
</style>
