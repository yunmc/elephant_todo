<template>
  <div ref="chartRef" :style="{ width: '100%', height: height + 'px' }" />
</template>

<script setup lang="ts">
import { init as echartsInit } from 'echarts/core'
import { PieChart, LineChart, BarChart } from 'echarts/charts'
import {
  TitleComponent,
  TooltipComponent,
  LegendComponent,
  GridComponent,
} from 'echarts/components'
import { CanvasRenderer } from 'echarts/renderers'
import type { EChartsOption } from 'echarts'
import { use } from 'echarts/core'

use([
  CanvasRenderer,
  PieChart,
  LineChart,
  BarChart,
  TitleComponent,
  TooltipComponent,
  LegendComponent,
  GridComponent,
])

const props = withDefaults(defineProps<{
  option: EChartsOption
  height?: number
}>(), {
  height: 300,
})

const chartRef = ref<HTMLDivElement>()
let chart: ReturnType<typeof echartsInit> | null = null

function getThemeColors() {
  const el = document.documentElement
  const style = getComputedStyle(el)
  return {
    textColor: style.getPropertyValue('--color-text-primary').trim() || '#333',
    textColorSecondary: style.getPropertyValue('--color-text-secondary').trim() || '#999',
    borderColor: style.getPropertyValue('--color-border').trim() || '#eee',
  }
}

function mergeTheme(option: EChartsOption): EChartsOption {
  const { textColor, textColorSecondary, borderColor } = getThemeColors()
  return {
    backgroundColor: 'transparent',
    textStyle: { color: textColor },
    title: { textStyle: { color: textColor } },
    legend: { textStyle: { color: textColorSecondary } },
    grid: { borderColor },
    ...option,
  }
}

function initChart() {
  if (!chartRef.value) return
  chart = echartsInit(chartRef.value)
  chart!.setOption(mergeTheme(props.option))
}

watch(() => props.option, (newOption) => {
  if (chart) {
    chart.setOption(mergeTheme(newOption), true)
  }
}, { deep: true })

let resizeObserver: ResizeObserver | null = null

onMounted(() => {
  initChart()
  resizeObserver = new ResizeObserver(() => {
    chart?.resize()
  })
  if (chartRef.value) {
    resizeObserver.observe(chartRef.value)
  }
})

onBeforeUnmount(() => {
  resizeObserver?.disconnect()
  chart?.dispose()
  chart = null
})

defineExpose({ chartInstance: () => chart })
</script>
