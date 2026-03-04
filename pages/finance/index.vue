<template>
  <div class="page-container">
    <h1 class="page-title">记账</h1>

    <!-- Month Selector -->
    <div class="month-selector">
      <button class="month-btn" @click="prevMonth">←</button>
      <span class="month-label">{{ currentYear }}年{{ currentMonth }}月</span>
      <button class="month-btn" @click="nextMonth">→</button>
    </div>

    <!-- Statistics Summary -->
    <div class="stats-cards">
      <div class="stat-card income">
        <div class="stat-label">收入</div>
        <div class="stat-value">{{ formatMoney(financeStore.statistics?.total_income || 0) }}</div>
      </div>
      <div class="stat-card expense">
        <div class="stat-label">支出</div>
        <div class="stat-value">{{ formatMoney(financeStore.statistics?.total_expense || 0) }}</div>
      </div>
      <div class="stat-card balance">
        <div class="stat-label">结余</div>
        <div class="stat-value">{{ formatMoney(financeStore.statistics?.balance || 0) }}</div>
      </div>
    </div>

    <!-- Add Record Button -->
    <div style="margin-bottom: 12px; display: flex; gap: 8px;">
      <n-button type="primary" block @click="showAddModal = true">+ 记一笔</n-button>
      <n-button block @click="handleAiQuickEntry">💡 AI 记账</n-button>
    </div>

    <!-- Filter Tabs -->
    <div class="filter-tabs">
      <button :class="['tab', { active: filterType === undefined }]" @click="setType(undefined)">全部</button>
      <button :class="['tab', { active: filterType === 'expense' }]" @click="setType('expense')">支出</button>
      <button :class="['tab', { active: filterType === 'income' }]" @click="setType('income')">收入</button>
    </div>

    <n-spin v-if="financeStore.loading" style="display: flex; justify-content: center; padding: 48px 0;" />

    <n-empty v-else-if="financeStore.records.length === 0" description="暂无记账记录" style="padding: 48px 0;">
      <template #extra>
        <n-text depth="3">点击"记一笔"开始记录</n-text>
      </template>
    </n-empty>

    <!-- Records List -->
    <div v-else class="records-list">
      <div v-for="record in financeStore.records" :key="record.id" class="record-card">
        <div class="record-left">
          <span class="record-icon">{{ record.category_icon || (record.type === 'income' ? '💰' : '💸') }}</span>
          <div class="record-info">
            <div class="record-category">{{ record.category_name || '未分类' }}</div>
            <div class="record-note" v-if="record.note">{{ record.note }}</div>
            <div class="record-date">{{ formatDate(record.record_date) }}</div>
          </div>
        </div>
        <div class="record-right">
          <span :class="['record-amount', record.type]">
            {{ record.type === 'income' ? '+' : '-' }}{{ formatMoney(record.amount) }}
          </span>
          <n-popconfirm positive-text="删除" negative-text="取消" @positive-click="handleDelete(record.id)">
            <template #trigger>
              <n-button size="tiny" quaternary type="error" @click.stop>删除</n-button>
            </template>
            确认删除该记录？
          </n-popconfirm>
        </div>
      </div>
    </div>

    <!-- Pagination -->
    <n-space v-if="financeStore.pagination.totalPages > 1" justify="center" style="padding: 16px 0;">
      <n-pagination
        :page="financeStore.pagination.page"
        :page-count="financeStore.pagination.totalPages"
        @update:page="changePage"
      />
    </n-space>

    <!-- Add Record Modal -->
    <ClientOnly>
      <n-modal v-model:show="showAddModal" preset="card" title="记一笔" :style="{ maxWidth: '500px', width: '100%' }">
        <n-form :model="form" label-placement="left" label-width="70">
          <n-form-item label="类型">
            <n-radio-group v-model:value="form.type">
              <n-radio-button value="expense">支出</n-radio-button>
              <n-radio-button value="income">收入</n-radio-button>
            </n-radio-group>
          </n-form-item>
          <n-form-item label="金额">
            <n-input-number v-model:value="form.amount" :min="0.01" :precision="2" placeholder="0.00" style="width: 100%;" />
          </n-form-item>
          <n-form-item label="分类">
            <n-select
              v-model:value="form.category_id"
              :options="categoryOptions"
              placeholder="选择分类"
              clearable
            />
          </n-form-item>
          <n-form-item label="日期">
            <n-date-picker v-model:value="form.record_date_ts" type="date" style="width: 100%;" />
          </n-form-item>
          <n-form-item label="备注">
            <n-input v-model:value="form.note" placeholder="可选备注" />
          </n-form-item>
        </n-form>
        <template #action>
          <n-button type="primary" :disabled="!form.amount || form.amount <= 0" @click="handleAdd">保存</n-button>
        </template>
      </n-modal>
    </ClientOnly>

    <!-- Category Management -->
    <div class="section-divider">
      <button class="manage-categories-btn" @click="showCategoryModal = true">管理分类</button>
    </div>

    <ClientOnly>
      <n-modal v-model:show="showCategoryModal" preset="card" title="管理记账分类" :style="{ maxWidth: '500px', width: '100%' }">
        <div class="category-form" style="margin-bottom: 16px;">
          <n-input v-model:value="newCategoryName" placeholder="新分类名称" style="flex: 1;" />
          <n-select v-model:value="newCategoryType" :options="[{ label: '支出', value: 'expense' }, { label: '收入', value: 'income' }]" style="width: 100px;" />
          <n-button type="primary" :disabled="!newCategoryName.trim()" @click="handleAddCategory">添加</n-button>
        </div>
        <div class="categories-list">
          <div v-for="cat in financeStore.categories" :key="cat.id" class="category-item">
            <span>{{ cat.icon }} {{ cat.name }}</span>
            <span class="cat-type">{{ cat.type === 'income' ? '收入' : '支出' }}</span>
            <n-button size="tiny" quaternary type="error" @click="handleDeleteCategory(cat.id)">删除</n-button>
          </div>
          <n-empty v-if="financeStore.categories.length === 0" description="暂无分类" />
        </div>
      </n-modal>
    </ClientOnly>

    <!-- AI Quick Entry -->
    <ClientOnly>
      <AiQuickEntry v-model:show="showAiEntry" @saved="loadData" />
    </ClientOnly>
  </div>
</template>

<script setup lang="ts">
const financeStore = useFinanceStore()
const message = useMessage()
const { guardPremium } = usePremium()

const showAiEntry = ref(false)

function handleAiQuickEntry() {
  if (!guardPremium()) return
  showAiEntry.value = true
}

const showAddModal = ref(false)
const showCategoryModal = ref(false)
const filterType = ref<'income' | 'expense' | undefined>(undefined)

// Month control
const currentDate = ref(new Date())
const currentYear = computed(() => currentDate.value.getFullYear())
const currentMonth = computed(() => currentDate.value.getMonth() + 1)

const startDate = computed(() => `${currentYear.value}-${String(currentMonth.value).padStart(2, '0')}-01`)
const endDate = computed(() => {
  const lastDay = new Date(currentYear.value, currentMonth.value, 0).getDate()
  return `${currentYear.value}-${String(currentMonth.value).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`
})

// Form
const form = reactive({
  type: 'expense' as 'income' | 'expense',
  amount: null as number | null,
  category_id: null as number | null,
  record_date_ts: Date.now(),
  note: '',
})

// When opening add modal, default date to selected month if not current month
watch(showAddModal, (show) => {
  if (show) {
    const now = new Date()
    const isCurrentMonth = currentYear.value === now.getFullYear() && currentMonth.value === now.getMonth() + 1
    if (isCurrentMonth) {
      form.record_date_ts = Date.now()
    } else {
      form.record_date_ts = new Date(currentYear.value, currentMonth.value - 1, 1).getTime()
    }
  }
})

const categoryOptions = computed(() =>
  financeStore.categories
    .filter((c) => c.type === form.type)
    .map((c) => ({ label: `${c.icon} ${c.name}`, value: c.id })),
)

const newCategoryName = ref('')
const newCategoryType = ref<'income' | 'expense'>('expense')

// Data loading
await useAsyncData('finance-init', async () => {
  await Promise.all([
    financeStore.fetchCategories(),
    loadData(),
  ])
  return true
})

async function loadData() {
  financeStore.setFilters({
    type: filterType.value,
    start_date: startDate.value,
    end_date: endDate.value,
  })
  await Promise.all([
    financeStore.fetchRecords(),
    financeStore.fetchStatistics(startDate.value, endDate.value),
  ])
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

function setType(type: 'income' | 'expense' | undefined) {
  filterType.value = type
  loadData()
}

function changePage(page: number) {
  financeStore.setPage(page)
  financeStore.fetchRecords()
}

async function handleAdd() {
  if (!form.amount || form.amount <= 0) return
  try {
    const dateStr = new Date(form.record_date_ts).toISOString().split('T')[0]
    await financeStore.createRecord({
      type: form.type,
      amount: form.amount,
      category_id: form.category_id || undefined,
      note: form.note || undefined,
      record_date: dateStr,
    })
    message.success('记录成功')
    showAddModal.value = false
    form.amount = null
    form.note = ''
    form.category_id = null
    await loadData()
  } catch {
    message.error('操作失败')
  }
}

async function handleDelete(id: number) {
  try {
    await financeStore.deleteRecord(id)
    await loadData()
  } catch {
    message.error('删除失败')
  }
}

async function handleAddCategory() {
  if (!newCategoryName.value.trim()) return
  try {
    await financeStore.createCategory({
      name: newCategoryName.value.trim(),
      type: newCategoryType.value,
    })
    newCategoryName.value = ''
    message.success('分类已添加')
  } catch (e: any) {
    message.error(e?.data?.message || '添加分类失败')
  }
}

async function handleDeleteCategory(id: number) {
  try {
    await financeStore.deleteCategory(id)
    await loadData()
    message.success('分类已删除')
  } catch {
    message.error('删除分类失败')
  }
}

function formatMoney(val: number) {
  return Number(val).toFixed(2)
}

function formatDate(dateStr: string) {
  // Parse YYYY-MM-DD directly to avoid timezone issues
  const parts = dateStr.split('T')[0].split('-')
  return `${+parts[1]}月${+parts[2]}日`
}
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

.stats-cards {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px;
  margin-bottom: 16px;
}
.stat-card {
  background: var(--color-bg-card);
  border-radius: var(--radius-md, 12px);
  padding: 12px;
  text-align: center;
}
.stat-label {
  font-size: 12px;
  color: var(--color-text-muted);
  margin-bottom: 4px;
}
.stat-value {
  font-size: 16px;
  font-weight: 700;
}
.stat-card.income .stat-value { color: #10b981; }
.stat-card.expense .stat-value { color: #ef4444; }
.stat-card.balance .stat-value { color: var(--color-primary); }

.filter-tabs {
  display: flex;
  gap: 8px;
  margin-bottom: 12px;
}
.tab {
  flex: 1;
  padding: 8px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm, 8px);
  background: transparent;
  color: var(--color-text-secondary);
  font-size: 13px;
  cursor: pointer;
  transition: all 0.2s;
  min-height: auto;
}
.tab.active {
  background: var(--color-primary);
  color: #fff;
  border-color: var(--color-primary);
}

.records-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.record-card {
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: var(--color-bg-card);
  border-radius: var(--radius-md, 12px);
  padding: 12px 14px;
}
.record-left {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
  flex: 1;
}
.record-icon { font-size: 20px; flex-shrink: 0; }
.record-info { min-width: 0; }
.record-category {
  font-size: 14px;
  font-weight: 500;
  color: var(--color-text);
}
.record-note {
  font-size: 12px;
  color: var(--color-text-secondary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.record-date {
  font-size: 11px;
  color: var(--color-text-muted);
}
.record-right {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}
.record-amount {
  font-size: 16px;
  font-weight: 700;
}
.record-amount.income { color: #10b981; }
.record-amount.expense { color: #ef4444; }

.section-divider {
  margin-top: 16px;
  padding-top: 16px;
  border-top: 1px solid var(--color-border);
  text-align: center;
}
.manage-categories-btn {
  background: none;
  border: none;
  color: var(--color-text-secondary);
  font-size: 13px;
  cursor: pointer;
  text-decoration: underline;
  min-height: auto;
  min-width: auto;
}

.category-form {
  display: flex;
  gap: 8px;
  align-items: center;
}
.categories-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.category-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  background: var(--color-bg-elevated);
  border-radius: var(--radius-sm, 8px);
  font-size: 14px;
  color: var(--color-text);
}
.cat-type {
  font-size: 12px;
  color: var(--color-text-muted);
  margin-left: auto;
}
</style>
