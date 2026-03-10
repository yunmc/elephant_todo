<template>
  <div class="page-container">
    <h1 class="page-title">🤖 AI 报告</h1>

    <!-- Tab Switch: Monthly / Yearly -->
    <div class="report-tabs">
      <button :class="['tab', { active: tab === 'monthly' }]" @click="tab = 'monthly'">月度报告</button>
      <button :class="['tab', { active: tab === 'yearly' }]" @click="tab = 'yearly'">年度报告</button>
    </div>

    <!-- Date Selector -->
    <div class="date-selector">
      <template v-if="tab === 'monthly'">
        <button class="month-btn" @click="prevPeriod">←</button>
        <span class="date-label">{{ selectedYear }}年{{ selectedMonth }}月</span>
        <button class="month-btn" @click="nextPeriod">→</button>
      </template>
      <template v-else>
        <button class="month-btn" @click="prevPeriod">←</button>
        <span class="date-label">{{ selectedYear }}年</span>
        <button class="month-btn" @click="nextPeriod">→</button>
      </template>
    </div>

    <!-- Generate Button -->
    <n-button
      type="primary"
      block
      :loading="loading"
      style="margin-bottom: 16px;"
      @click="generateReport(false)"
    >
      {{ report ? '查看报告' : '生成报告' }}
    </n-button>

    <n-spin v-if="loading" style="display: flex; justify-content: center; padding: 48px 0;" />

    <!-- Report Content -->
    <div v-else-if="report" class="report-content">
      <div v-if="cached" class="cached-badge">
        <n-tag size="small" type="info">缓存结果</n-tag>
        <span class="generated-at">{{ formatGeneratedAt(generatedAt) }}</span>
      </div>

      <template v-if="tab === 'monthly' && monthlyReport">
        <!-- Finance Insight -->
        <div class="report-section">
          <h3>💰 消费洞察</h3>
          <div class="report-card">
            <p>{{ monthlyReport.finance_insight }}</p>
            <p class="suggestion">{{ monthlyReport.finance_suggestion }}</p>
          </div>
        </div>

        <!-- Todo Insight -->
        <div class="report-section">
          <h3>✅ 待办回顾</h3>
          <div class="report-card">
            <p>{{ monthlyReport.todo_insight }}</p>
          </div>
        </div>

        <!-- Idea Insight -->
        <div class="report-section">
          <h3>💡 随手记</h3>
          <div class="report-card">
            <p>{{ monthlyReport.idea_insight }}</p>
          </div>
        </div>

        <!-- Date Reminder -->
        <div class="report-section">
          <h3>📅 重要日期</h3>
          <div class="report-card">
            <p>{{ monthlyReport.date_reminder }}</p>
          </div>
        </div>

        <!-- Summary -->
        <div class="report-section">
          <h3>🌟 一句话总结</h3>
          <div class="report-card summary-card">
            <p>"{{ monthlyReport.summary }}"</p>
          </div>
        </div>

        <!-- Keywords -->
        <div v-if="monthlyReport.keywords?.length" class="keywords">
          <n-tag v-for="kw in monthlyReport.keywords" :key="kw" size="small" style="margin: 2px;">
            #{{ kw }}
          </n-tag>
        </div>
      </template>

      <template v-else-if="tab === 'yearly' && yearlyReport">
        <!-- Finance Summary -->
        <div class="report-section">
          <h3>💰 年度消费</h3>
          <div class="report-card">
            <p>{{ yearlyReport.finance_summary }}</p>
          </div>
        </div>

        <!-- Monthly Trend -->
        <div class="report-section">
          <h3>📊 月度趋势</h3>
          <div class="report-card">
            <p>{{ yearlyReport.finance_monthly_trend }}</p>
          </div>
        </div>

        <!-- Todo Summary -->
        <div class="report-section">
          <h3>✅ 效率总结</h3>
          <div class="report-card">
            <p>{{ yearlyReport.todo_summary }}</p>
          </div>
        </div>

        <!-- Idea Summary -->
        <div class="report-section">
          <h3>💡 随手记</h3>
          <div class="report-card">
            <p>{{ yearlyReport.idea_summary }}</p>
          </div>
        </div>

        <!-- Highlights -->
        <div class="report-section">
          <h3>🏆 年度亮点</h3>
          <div class="report-card">
            <p>{{ yearlyReport.highlights }}</p>
          </div>
        </div>

        <!-- Summary -->
        <div class="report-section">
          <h3>🌟 年度总结</h3>
          <div class="report-card summary-card">
            <p>"{{ yearlyReport.summary }}"</p>
          </div>
        </div>

        <!-- Keywords -->
        <div v-if="yearlyReport.keywords?.length" class="keywords">
          <n-tag v-for="kw in yearlyReport.keywords" :key="kw" size="small" style="margin: 2px;">
            #{{ kw }}
          </n-tag>
        </div>
      </template>

      <!-- Regenerate -->
      <n-button
        block
        quaternary
        style="margin-top: 16px;"
        :loading="loading"
        @click="generateReport(true)"
      >
        重新生成
      </n-button>
    </div>

    <!-- No report yet -->
    <n-empty v-else-if="!loading" description="点击上方按钮生成 AI 报告" style="padding: 48px 0;" />

    <!-- Error -->
    <n-alert v-if="errorMsg" type="error" style="margin-top: 12px;" closable @close="errorMsg = ''">
      {{ errorMsg }}
    </n-alert>
  </div>
</template>

<script setup lang="ts">
import type { AiMonthlyReport, AiYearlyReport, AiReportResponse } from '~/types'

const api = useApi()
const message = useMessage()
const { guardPremium } = usePremium()

const tab = ref<'monthly' | 'yearly'>('monthly')
const loading = ref(false)
const errorMsg = ref('')

// Date selection
const now = new Date()
const selectedYear = ref(now.getFullYear())
const selectedMonth = ref(now.getMonth() + 1)

// Report data
const report = ref<AiMonthlyReport | AiYearlyReport | null>(null)
const cached = ref(false)
const generatedAt = ref('')

const monthlyReport = computed(() => tab.value === 'monthly' ? report.value as AiMonthlyReport : null)
const yearlyReport = computed(() => tab.value === 'yearly' ? report.value as AiYearlyReport : null)

// Reset report when switching tabs or date
watch([tab, selectedYear, selectedMonth], () => {
  report.value = null
  cached.value = false
  generatedAt.value = ''
  errorMsg.value = ''
})

function prevPeriod() {
  if (tab.value === 'monthly') {
    if (selectedMonth.value === 1) {
      selectedMonth.value = 12
      selectedYear.value--
    } else {
      selectedMonth.value--
    }
  } else {
    selectedYear.value--
  }
}

function nextPeriod() {
  if (tab.value === 'monthly') {
    // Don't allow future months
    const maxYear = now.getFullYear()
    const maxMonth = now.getMonth() + 1
    if (selectedYear.value > maxYear || (selectedYear.value === maxYear && selectedMonth.value >= maxMonth)) return

    if (selectedMonth.value === 12) {
      selectedMonth.value = 1
      selectedYear.value++
    } else {
      selectedMonth.value++
    }
  } else {
    if (selectedYear.value >= now.getFullYear()) return
    selectedYear.value++
  }
}

async function generateReport(regenerate: boolean) {
  if (!guardPremium()) return

  loading.value = true
  errorMsg.value = ''

  try {
    const url = tab.value === 'monthly' ? '/ai/report/monthly' : '/ai/report/yearly'
    const body = tab.value === 'monthly'
      ? { year: selectedYear.value, month: selectedMonth.value, regenerate }
      : { year: selectedYear.value, regenerate }

    const res = await api.post<AiReportResponse>(url, body)
    // Response could be directly on res or on res.data
    const data = (res as any).report ? res as any : res.data
    if (data) {
      report.value = data.report
      cached.value = data.cached
      generatedAt.value = data.generated_at

      if (regenerate) {
        message.success('报告已重新生成')
      }
    }
  } catch (err: any) {
    const msg = err?.response?._data?.message || err?.data?.message || 'AI 报告生成失败'
    errorMsg.value = msg
  } finally {
    loading.value = false
  }
}

function formatGeneratedAt(dateStr: string) {
  if (!dateStr) return ''
  const d = new Date(dateStr)
  return `生成于 ${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}
</script>

<style scoped>
.report-tabs {
  display: flex;
  gap: 8px;
  margin-bottom: 12px;
}

.report-tabs .tab {
  flex: 1;
  padding: 10px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm, 8px);
  background: var(--color-bg-card);
  color: var(--color-text);
  font-size: 14px;
  cursor: pointer;
  transition: all var(--transition-fast);
}

.report-tabs .tab.active {
  background: var(--color-primary);
  color: var(--color-text-inverse);
  border-color: var(--color-primary);
}

.date-selector {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 16px;
  margin-bottom: 16px;
}

.month-btn {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  border: 1px solid var(--color-border);
  background: var(--color-bg-card);
  color: var(--color-text);
  font-size: 16px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
}

.date-label {
  font-size: 16px;
  font-weight: 600;
  color: var(--color-text);
  min-width: 120px;
  text-align: center;
}

.cached-badge {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 12px;
}

.generated-at {
  font-size: 12px;
  color: var(--color-text-muted);
}

.report-section {
  margin-bottom: 16px;
}

.report-section h3 {
  font-size: 15px;
  font-weight: 600;
  margin-bottom: 8px;
  color: var(--color-text);
}

.report-card {
  background: var(--color-bg-card);
  border-radius: var(--radius-md, 12px);
  padding: 14px 16px;
}

.report-card p {
  margin: 0;
  font-size: 14px;
  line-height: 1.6;
  color: var(--color-text);
}

.report-card .suggestion {
  margin-top: 8px;
  font-size: 13px;
  color: var(--color-primary);
}

.summary-card {
  background: linear-gradient(135deg, var(--color-bg-elevated), var(--color-bg-card));
  border: 1px solid var(--color-border);
}

.summary-card p {
  font-size: 15px;
  font-style: italic;
  text-align: center;
}

.keywords {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 4px;
  margin-top: 12px;
}
</style>
