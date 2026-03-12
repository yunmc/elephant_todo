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

    <div
      style="margin-bottom: 12px; padding: 14px 16px; background: var(--color-bg-card); border-radius: var(--radius-md, 12px); display: flex; align-items: center; gap: 10px; cursor: pointer;"
      @click="navigateTo('/finance/charts')"
    >
      <span style="font-size: 20px;">📊</span>
      <div>
        <div style="font-size: 14px; font-weight: 500;">图表分析</div>
        <div style="font-size: 12px; color: var(--color-text-tertiary, #999); margin-top: 2px;">查看收支趋势与分类占比</div>
      </div>
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
          <n-button size="tiny" quaternary type="info" @click.stop="handleOpenEdit(record)">编辑</n-button>
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

    <!-- Add/Edit Record Modal -->
    <ClientOnly>
      <n-modal v-model:show="showAddModal" preset="card" :title="editingRecordId ? '编辑记录' : '记一笔'" :style="{ maxWidth: '500px', width: '100%' }">
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
              filterable
            >
              <template #action>
                <JpSelectCreate v-model="quickCategoryName" placeholder="输入新分类名" @submit="handleQuickAddCategory" />
              </template>
            </n-select>
          </n-form-item>
          <n-form-item label="日期">
            <n-date-picker v-model:value="form.record_date_ts" type="date" style="width: 100%;" />
          </n-form-item>
          <n-form-item label="备注">
            <n-input v-model:value="form.note" placeholder="可选备注" />
          </n-form-item>
        </n-form>
        <!-- Attachments (only when editing existing record) -->
        <AttachmentSection v-if="editingRecordId" target-type="finance_record" :target-id="editingRecordId" />
        <!-- AI voice status -->
        <div v-if="aiParsing" class="ai-voice-status">
          <n-spin size="small" /> <span style="margin-left: 6px;">AI 识别中...</span>
        </div>
        <template #action>
          <div style="display: flex; align-items: center; gap: 8px; width: 100%;">
            <n-button type="primary" :disabled="!form.amount || form.amount <= 0" @click="editingRecordId ? handleUpdate() : handleAdd()">保存</n-button>
            <n-tooltip v-if="!editingRecordId" trigger="hover">
              <template #trigger>
                <button
                  class="voice-btn" 
                  :class="{ 'voice-active': voiceInput.isListening.value }"
                  :disabled="aiParsing"
                  @click="toggleVoice"
                >
                  {{ voiceInput.isListening.value ? '⏹' : '🎤' }}
                </button>
              </template>
              {{ voiceInput.isListening.value ? '停止录音' : '语音记账（说完自动识别）' }}
            </n-tooltip>
            <span v-if="voiceInput.isListening.value" class="voice-hint">正在听...</span>
          </div>
        </template>
      </n-modal>
    </ClientOnly>


  </div>
</template>

<script setup lang="ts">
const financeStore = useFinanceStore()

// Register page-specific "+" action
useGlobalAdd(() => {
  editingRecordId.value = null
  showAddModal.value = true
})
const message = useMessage()

const { isPremium } = usePremium()
const showBudgetModal = ref(false)

// AI voice input
const aiParsing = ref(false)
const aiError = ref('')
const api = useApi()
const voiceInput = useVoiceInput()

function toggleVoice() {
  if (!isPremium.value) {
    message.info('语音记账为会员功能，敬请期待')
    return
  }
  if (voiceInput.isListening.value) {
    voiceInput.stop()
  } else {
    voiceInput.start()
  }
}

// Watch voice transcript → auto AI parse
watch(() => voiceInput.transcript.value, (val) => {
  if (val && !voiceInput.isListening.value) {
    handleAiParse(val)
  }
})
watch(() => voiceInput.isListening.value, (listening) => {
  if (!listening && voiceInput.transcript.value) {
    handleAiParse(voiceInput.transcript.value)
  }
})

async function handleAiParse(text: string) {
  if (!text.trim() || aiParsing.value) return

  aiParsing.value = true
  aiError.value = ''
  try {
    const res = await api.post<import('~/types').AiQuickEntryResult>('/ai/quick-entry', { text: text.trim() })
    const parsed = (res as any).amount !== undefined ? res as any : res.data
    if (parsed) {
      form.type = parsed.type || 'expense'
      form.amount = parsed.amount
      form.note = parsed.note || ''
      if (parsed.date) {
        const parts = parsed.date.split('-')
        form.record_date_ts = new Date(+parts[0], +parts[1] - 1, +parts[2]).getTime()
      }
      const matchCat = financeStore.categories.find(
        (c) => c.name === parsed.category_name && c.type === parsed.type,
      )
      form.category_id = matchCat?.id ?? null
      message.success('AI 识别成功，请确认后保存')
    }
  } catch (err: any) {
    message.error(err?.response?._data?.message || err?.data?.message || 'AI 解析失败')
  } finally {
    aiParsing.value = false
  }
}

function handleOpenBudgetModal() {
  message.info('该功能正在开发中，敬请期待 🐘')
}

const showAddModal = ref(false)
const filterType = ref<'income' | 'expense' | undefined>(undefined)
const editingRecordId = ref<number | null>(null)

// Month control
const currentDate = ref(new Date())
const currentYear = computed(() => currentDate.value.getFullYear())
const currentMonth = computed(() => currentDate.value.getMonth() + 1)

const startDate = computed(() => `${currentYear.value}-${String(currentMonth.value).padStart(2, '0')}-01`)
const endDate = computed(() => {
  const lastDay = new Date(currentYear.value, currentMonth.value, 0).getDate()
  return `${currentYear.value}-${String(currentMonth.value).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`
})
const yearMonth = computed(() => `${currentYear.value}-${String(currentMonth.value).padStart(2, '0')}`)

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
  if (show && !editingRecordId.value) {
    const now = new Date()
    const isCurrentMonth = currentYear.value === now.getFullYear() && currentMonth.value === now.getMonth() + 1
    if (isCurrentMonth) {
      form.record_date_ts = Date.now()
    } else {
      form.record_date_ts = new Date(currentYear.value, currentMonth.value - 1, 1).getTime()
    }
  }
  if (!show) {
    editingRecordId.value = null
    aiError.value = ''
  }
})

const categoryOptions = computed(() =>
  financeStore.categories
    .filter((c) => c.type === form.type)
    .map((c) => ({ label: `${c.icon} ${c.name}`, value: c.id })),
)

const quickCategoryName = ref('')

// 预设分类图标映射，根据关键词自动匹配
const CATEGORY_ICON_MAP: Record<string, string> = {
  // 餐饮食品
  '吃饭': '🍚', '餐饮': '🍴', '外卖': '🍱', '快餐': '🍔', '火锅': '🍲',
  '零食': '🍬', '水果': '🍎', '饮料': '🧃', '咖啡': '☕', '茶': '🍵',
  '奶茶': '🧁', '早餐': '🥐', '午餐': '🍜', '晚餐': '🍝', '孵酒': '🍺',
  '酒': '🍷', '甜品': '🍰', '烘焙': '🥐', '食材': '🥦', '下午茶': '🧁',
  // 出行交通
  '打车': '🚕', '公交': '🚌', '地铁': '🚇', '加油': '⛽', '停车': '🅿️',
  '高铁': '🚄', '飞机': '✈️', '出行': '🚶', '交通': '🚗', '共享单车': '🚲',
  '共享': '🚲',
  // 购物消费
  '购物': '🛒', '超市': '🏪', '网购': '📦', '衣服': '👗', '鞋子': '👟',
  '化妆品': '💄', '护肤': '🧴', '日用品': '🧹', '家居': '🛋️', '电子产品': '📱',
  '数码': '📱', '电器': '📺',
  // 居住生活
  '房租': '🏠', '水电': '💡', '物业': '🏢', '缴费': '💳', '维修': '🔧',
  '家政': '🧹', '电话费': '📞', '网费': '🌐', '燃气': '🔥',
  // 娱乐休闲
  '游戏': '🎮', '电影': '🎬', '音乐': '🎵', '旅行': '✈️', '旅游': '🏖️',
  '运动': '🏋️', '健身': '💪', '书籍': '📚', '学习': '📖', '培训': '🎓',
  '教育': '🎓', '课程': '📝',
  // 社交人情
  '红包': '🧧', '礼物': '🎁', '人情': '🎁', '请客': '🍽️', '约会': '💑',
  '聚会': '🎉', '社交': '🤝',
  // 医疗健康
  '医疗': '🏥', '买药': '💊', '健康': '❤️', '保险': '🛡️', '体检': '🩺',
  '看病': '🏥',
  // 嬌物
  '嬌物': '🐾', '猫': '🐱', '狗': '🐶',
  // 其他支出
  '投资': '📈', '理财': '💰', '股票': '📈', '基金': '📊',
  '还款': '💳', '还贷': '🏦', '借贷': '🏦', '信用卡': '💳',
  '工具': '🔧', '维护': '⚙️', '捐款': '❤️', '慈善': '❤️',
  '罚款': '🚨', '税': '🏦', '税费': '🏦',
  '按摩': '💆', '美容': '💇', '美发': '✂️', '理发': '✂️',
  '充值': '🔋', '会员': '🌟',
  // 收入类
  '工资': '💵', '薪资': '💵', '奖金': '🏆', '兑换': '💱', '转账': '💱',
  '抵扣': '🏷️', '退款': '💱', '副业': '💼', '兼职': '💼', '租金': '🏠',
  '利息': '🏦', '分红': '💰', '抽奖': '🎰', '中奖': '🎉',
}

const DEFAULT_EXPENSE_ICON = '💸'
const DEFAULT_INCOME_ICON = '💰'

function matchCategoryIcon(name: string, type: 'income' | 'expense'): string {
  // 精确匹配
  if (CATEGORY_ICON_MAP[name]) return CATEGORY_ICON_MAP[name]
  // 包含匹配
  for (const [keyword, icon] of Object.entries(CATEGORY_ICON_MAP)) {
    if (name.includes(keyword) || keyword.includes(name)) return icon
  }
  return type === 'income' ? DEFAULT_INCOME_ICON : DEFAULT_EXPENSE_ICON
}

async function handleQuickAddCategory() {
  const name = quickCategoryName.value.trim()
  if (!name) return
  try {
    const icon = matchCategoryIcon(name, form.type)
    const cat = await financeStore.createCategory({ name, icon, type: form.type })
    quickCategoryName.value = ''
    if (cat) form.category_id = cat.id
    message.success('分类已添加')
  } catch (e: any) {
    message.error(e?.data?.message || '添加分类失败')
  }
}

// Data loading
await useAsyncData('finance-init', async () => {
  await Promise.all([
    financeStore.fetchCategories(),
    loadData(),
  ])
  return true
})

// 自动修正旧分类的默认图标
onMounted(async () => {
  for (const cat of financeStore.categories) {
    if (cat.icon === '💰') {
      const betterIcon = matchCategoryIcon(cat.name, cat.type as 'income' | 'expense')
      if (betterIcon !== '💰') {
        await financeStore.updateCategory(cat.id, { icon: betterIcon })
      }
    }
  }
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
    loadBudget(),
  ])
}

async function loadBudget() {
  // 预算管理功能暂未开放
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

function handleOpenEdit(record: any) {
  editingRecordId.value = record.id
  form.type = record.type
  form.amount = Number(record.amount)
  form.category_id = record.category_id || null
  form.note = record.note || ''
  // Parse date string to timestamp, avoid timezone offset
  const parts = record.record_date.split('T')[0].split('-')
  form.record_date_ts = new Date(+parts[0], +parts[1] - 1, +parts[2]).getTime()
  showAddModal.value = true
}

async function handleUpdate() {
  if (!editingRecordId.value || !form.amount || form.amount <= 0) return
  try {
    const dateStr = new Date(form.record_date_ts).toISOString().split('T')[0]
    await financeStore.updateRecord(editingRecordId.value, {
      type: form.type,
      amount: form.amount,
      category_id: form.category_id || undefined,
      note: form.note || undefined,
      record_date: dateStr,
    })
    message.success('修改成功')
    showAddModal.value = false
    form.amount = null
    form.note = ''
    form.category_id = null
    editingRecordId.value = null
    await loadData()
  } catch {
    message.error('修改失败')
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

.voice-btn {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  border: 1px solid var(--color-border, #e0e0e0);
  background: var(--color-bg-card, #fff);
  font-size: 18px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
  flex-shrink: 0;
}
.voice-btn:hover {
  background: var(--color-bg-hover, #f5f5f5);
}
.voice-btn.voice-active {
  background: #ff4d4f;
  border-color: #ff4d4f;
  animation: voice-pulse 1s ease-in-out infinite;
}
.voice-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
.voice-hint {
  font-size: 12px;
  color: #ff4d4f;
  animation: voice-pulse 1s ease-in-out infinite;
}
.ai-voice-status {
  display: flex;
  align-items: center;
  font-size: 13px;
  color: var(--color-text-secondary, #666);
  margin-top: 8px;
}
@keyframes voice-pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}
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
.stat-card.income .stat-value { color: var(--color-success); }
.stat-card.expense .stat-value { color: var(--color-danger); }
.stat-card.balance .stat-value { color: var(--color-primary); }

.filter-tabs {
  display: flex;
  gap: 8px;
  margin-bottom: 12px;
}
.tab {
  flex: 1;
  padding: 8px;
  border: 1px solid var(--color-text-muted);
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
  color: var(--color-text-inverse);
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
.record-amount.income { color: var(--color-success); }
.record-amount.expense { color: var(--color-danger); }
</style>
