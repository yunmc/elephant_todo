<template>
  <div class="page-container">
    <h1 class="page-title">经期追踪</h1>

    <!-- Person Switcher -->
    <div class="person-switcher">
      <button
        v-for="name in periodStore.personNames"
        :key="name"
        :class="['person-btn', { active: periodStore.selectedPerson === name }]"
        @click="periodStore.switchPerson(name)"
        @dblclick.prevent="startRenamePerson(name)"
        @touchstart="onPersonTouchStart(name)"
        @touchend="onPersonTouchEnd"
        @touchcancel="onPersonTouchEnd"
      >{{ name }}</button>
      <button class="person-btn add-btn" @click="showAddPerson = true">+</button>
    </div>

    <!-- Rename Person Mini-Row -->
    <div v-if="renamingPerson" class="add-person-row">
      <input v-model="renamePersonValue" class="person-input" placeholder="输入新名称" maxlength="50" @keyup.enter="confirmRenamePerson" />
      <button class="person-action-btn primary" :disabled="!renamePersonValue.trim()" @click="confirmRenamePerson">确认</button>
      <button class="person-action-btn" @click="cancelRenamePerson">取消</button>
    </div>

    <!-- Add Person Mini-Modal -->
    <div v-if="showAddPerson" class="add-person-row">
      <input v-model="newPersonName" class="person-input" placeholder="输入名称" maxlength="50" @keyup.enter="confirmAddPerson" />
      <button class="person-action-btn primary" :disabled="!newPersonName.trim()" @click="confirmAddPerson">确认</button>
      <button class="person-action-btn" @click="showAddPerson = false; newPersonName = ''">取消</button>
    </div>

    <!-- Prediction Card -->
    <div v-if="periodStore.prediction" class="prediction-card">
      <div class="prediction-header">📊 周期预测</div>
      <div class="prediction-grid">
        <div class="pred-item">
          <div class="pred-label">下次经期</div>
          <div class="pred-value highlight">{{ formatDateShort(periodStore.prediction.next_period_start) }}</div>
        </div>
        <div class="pred-item">
          <div class="pred-label">持续至</div>
          <div class="pred-value">{{ formatDateShort(periodStore.prediction.next_period_end) }}</div>
        </div>
        <div class="pred-item">
          <div class="pred-label">平均周期</div>
          <div class="pred-value">{{ periodStore.prediction.average_cycle_length }} 天</div>
        </div>
        <div class="pred-item">
          <div class="pred-label">平均经期</div>
          <div class="pred-value">{{ periodStore.prediction.average_period_length }} 天</div>
        </div>
      </div>
      <div class="fertile-window">
        <span class="fertile-label">🌱 易孕窗口期</span>
        <span class="fertile-dates">
          {{ formatDateShort(periodStore.prediction.fertile_window_start) }} ~ {{ formatDateShort(periodStore.prediction.fertile_window_end) }}
        </span>
      </div>
    </div>

    <div v-else class="prediction-empty">
      <n-text depth="3">记录经期数据后将自动预测下次周期</n-text>
    </div>

    <!-- Add Record Button -->
    <div style="margin-bottom: 16px;">
      <n-button type="primary" block @click="openAddModal">+ 记录经期</n-button>
    </div>

    <n-spin v-if="periodStore.loading" style="display: flex; justify-content: center; padding: 48px 0;" />

    <n-empty v-else-if="periodStore.records.length === 0" description="暂无经期记录" style="padding: 48px 0;" />

    <!-- Records List -->
    <div v-else class="records-list">
      <div v-for="record in periodStore.records" :key="record.id" class="period-card" @click="openEditModal(record)">
        <div class="period-header">
          <div class="period-dates">
            <span class="period-start">{{ formatDateShort(record.start_date) }}</span>
            <span v-if="record.end_date" class="period-sep">~</span>
            <span v-if="record.end_date" class="period-end">{{ formatDateShort(record.end_date) }}</span>
            <span v-else class="period-ongoing">进行中</span>
          </div>
          <div class="period-stats">
            <span v-if="record.period_length" class="stat-badge">{{ record.period_length }}天</span>
            <span v-if="record.cycle_length" class="stat-badge cycle">周期{{ record.cycle_length }}天</span>
          </div>
        </div>
        <div class="period-details">
          <span class="flow-badge" :class="record.flow_level">
            {{ flowLabels[record.flow_level] }}
          </span>
          <span v-for="s in (record.symptoms || [])" :key="s" class="symptom-badge">{{ symptomLabels[s] || s }}</span>
        </div>
        <div v-if="record.note" class="period-note">{{ record.note }}</div>
      </div>
    </div>

    <!-- Add/Edit Modal -->
    <ClientOnly>
      <n-modal v-model:show="showModal" preset="card" :title="editingId ? '编辑经期记录' : '记录经期'" :style="{ maxWidth: '500px', width: '100%' }">
        <n-form :model="form" label-placement="left" label-width="80">
          <n-form-item label="开始日期">
            <n-date-picker v-model:value="form.start_date_ts" type="date" style="width: 100%;" />
          </n-form-item>
          <n-form-item label="结束日期">
            <n-date-picker v-model:value="form.end_date_ts" type="date" clearable style="width: 100%;" />
          </n-form-item>
          <n-form-item label="流量">
            <n-radio-group v-model:value="form.flow_level">
              <n-radio-button value="light">少量</n-radio-button>
              <n-radio-button value="moderate">适中</n-radio-button>
              <n-radio-button value="heavy">大量</n-radio-button>
            </n-radio-group>
          </n-form-item>
          <n-form-item label="症状">
            <div class="symptom-picker">
              <button
                v-for="(label, key) in symptomLabels"
                :key="key"
                :class="['symptom-btn', { active: form.symptoms.includes(key) }]"
                @click="toggleSymptom(key)"
              >{{ label }}</button>
            </div>
          </n-form-item>
          <n-form-item label="备注">
            <n-input v-model:value="form.note" type="textarea" placeholder="可选备注" :rows="2" :maxlength="500" show-count />
          </n-form-item>
        </n-form>
        <template #action>
          <n-space>
            <n-button v-if="editingId" type="error" ghost @click="handleDelete">删除</n-button>
            <n-button type="primary" :disabled="!form.start_date_ts" @click="handleSave">
              {{ editingId ? '保存' : '记录' }}
            </n-button>
          </n-space>
        </template>
      </n-modal>
    </ClientOnly>
  </div>
</template>

<script setup lang="ts">
import type { PeriodRecord } from '~/types'

const periodStore = usePeriodStore()
const message = useMessage()

const showModal = ref(false)
const editingId = ref<number | null>(null)

// Register page-specific "+" action
useGlobalAdd(() => {
  editingId.value = null
  showModal.value = true
})
const showAddPerson = ref(false)
const newPersonName = ref('')
const renamingPerson = ref<string | null>(null)
const renamePersonValue = ref('')
let longPressTimer: ReturnType<typeof setTimeout> | null = null

const flowLabels: Record<string, string> = {
  light: '少量',
  moderate: '适中',
  heavy: '大量',
}

const symptomLabels: Record<string, string> = {
  cramps: '痛经',
  headache: '头痛',
  bloating: '腹胀',
  fatigue: '疲劳',
  backache: '腰痛',
  nausea: '恶心',
  insomnia: '失眠',
  acne: '痘痘',
}

const form = reactive({
  start_date_ts: Date.now(),
  end_date_ts: null as number | null,
  flow_level: 'moderate' as 'light' | 'moderate' | 'heavy',
  symptoms: [] as string[],
  note: '',
})

await useAsyncData('period-init', async () => {
  await periodStore.fetchPersonNames()
  await Promise.all([
    periodStore.fetchRecords(),
    periodStore.fetchPrediction(),
  ])
  return true
})

function confirmAddPerson() {
  const name = newPersonName.value.trim()
  if (!name) return
  if (!periodStore.personNames.includes(name)) {
    periodStore.personNames.push(name)
  }
  periodStore.switchPerson(name)
  showAddPerson.value = false
  newPersonName.value = ''
}

function startRenamePerson(name: string) {
  renamingPerson.value = name
  renamePersonValue.value = name
  showAddPerson.value = false
}

function cancelRenamePerson() {
  renamingPerson.value = null
  renamePersonValue.value = ''
}

async function confirmRenamePerson() {
  const oldName = renamingPerson.value
  const newName = renamePersonValue.value.trim()
  if (!oldName || !newName) return
  if (oldName === newName) { cancelRenamePerson(); return }
  try {
    await periodStore.renamePerson(oldName, newName)
    message.success('已重命名')
  } catch (e: any) {
    message.error(e?.data?.statusMessage || '重命名失败')
  }
  cancelRenamePerson()
}

function onPersonTouchStart(name: string) {
  longPressTimer = setTimeout(() => {
    startRenamePerson(name)
  }, 600)
}

function onPersonTouchEnd() {
  if (longPressTimer) {
    clearTimeout(longPressTimer)
    longPressTimer = null
  }
}

function openAddModal() {
  editingId.value = null
  form.start_date_ts = Date.now()
  form.end_date_ts = null
  form.flow_level = 'moderate'
  form.symptoms = []
  form.note = ''
  showModal.value = true
}

function openEditModal(record: PeriodRecord) {
  editingId.value = record.id
  form.start_date_ts = new Date(record.start_date).getTime()
  form.end_date_ts = record.end_date ? new Date(record.end_date).getTime() : null
  form.flow_level = record.flow_level
  form.symptoms = record.symptoms ? [...record.symptoms] : []
  form.note = record.note || ''
  showModal.value = true
}

function toggleSymptom(key: string) {
  const idx = form.symptoms.indexOf(key)
  if (idx >= 0) {
    form.symptoms.splice(idx, 1)
  } else {
    form.symptoms.push(key)
  }
}

function formatLocalDate(ts: number | null): string | undefined {
  if (!ts) return undefined
  const d = new Date(ts)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

async function handleSave() {
  if (!form.start_date_ts) return
  try {
    const data = {
      person_name: periodStore.selectedPerson,
      start_date: formatLocalDate(form.start_date_ts)!,
      end_date: formatLocalDate(form.end_date_ts),
      flow_level: form.flow_level,
      symptoms: form.symptoms.length > 0 ? form.symptoms : undefined,
      note: form.note || undefined,
    }

    if (editingId.value) {
      await periodStore.updateRecord(editingId.value, data)
      message.success('已更新')
    } else {
      await periodStore.createRecord(data)
      message.success('已记录')
    }
    showModal.value = false
  } catch (e: any) {
    message.error(e?.message || '操作失败')
  }
}

async function handleDelete() {
  if (!editingId.value) return
  try {
    await periodStore.deleteRecord(editingId.value)
    showModal.value = false
    message.success('已删除')
  } catch (e: any) {
    message.error(e?.message || '删除失败')
  }
}

function formatDateShort(dateStr: string) {
  // Parse YYYY-MM-DD without timezone shift
  const parts = dateStr.split('-')
  if (parts.length === 3) {
    const m = parseInt(parts[1], 10)
    const d = parseInt(parts[2], 10)
    return `${m}月${d}日`
  }
  const dt = new Date(dateStr)
  return `${dt.getMonth() + 1}月${dt.getDate()}日`
}
</script>

<style scoped>
.person-switcher {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 16px;
}
.person-btn {
  padding: 6px 16px;
  border: 1px solid var(--color-border);
  border-radius: 20px;
  background: transparent;
  font-size: 13px;
  color: var(--color-text-secondary);
  cursor: pointer;
  transition: all 0.15s;
}
.person-btn.active {
  border-color: #ec4899;
  background: rgba(236, 72, 153, 0.1);
  color: #ec4899;
  font-weight: 600;
}
.person-btn.add-btn {
  border-style: dashed;
  color: var(--color-text-muted);
}
.add-person-row {
  display: flex;
  gap: 8px;
  margin-bottom: 16px;
  align-items: center;
}
.person-input {
  flex: 1;
  height: 40px;
  padding: 0 12px;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  background: var(--color-bg-input);
  color: var(--color-text);
  font-size: 14px;
  outline: none;
  box-sizing: border-box;
}
.person-input:focus {
  border-color: var(--color-primary);
}
.person-input::placeholder {
  color: var(--color-text-muted);
}
.person-action-btn {
  height: 40px;
  min-height: 40px;
  padding: 0 18px;
  border: none;
  border-radius: 8px;
  background: var(--color-bg-input);
  color: var(--color-text);
  font-size: 15px;
  cursor: pointer;
  box-sizing: border-box;
  white-space: nowrap;
}
.person-action-btn.primary {
  background: var(--color-primary);
  border-color: var(--color-primary);
  color: var(--color-text-inverse);
}
.person-action-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.prediction-card {
  background: linear-gradient(135deg, rgba(236, 72, 153, 0.08), rgba(168, 85, 247, 0.08));
  border: 1px solid rgba(236, 72, 153, 0.15);
  border-radius: var(--radius-md, 12px);
  padding: 16px;
  margin-bottom: 16px;
}
.prediction-header {
  font-size: 15px;
  font-weight: 600;
  color: var(--color-text);
  margin-bottom: 12px;
}
.prediction-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 10px;
  margin-bottom: 12px;
}
.pred-item {
  text-align: center;
}
.pred-label {
  font-size: 11px;
  color: var(--color-text-muted);
  margin-bottom: 2px;
}
.pred-value {
  font-size: 14px;
  font-weight: 600;
  color: var(--color-text);
}
.pred-value.highlight {
  color: #ec4899;
  font-size: 16px;
}

.fertile-window {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 12px;
  background: rgba(34, 197, 94, 0.08);
  border-radius: 8px;
  font-size: 12px;
}
.fertile-label { color: #16a34a; font-weight: 500; }
.fertile-dates { color: var(--color-text-secondary); }

.prediction-empty {
  text-align: center;
  padding: 16px;
  margin-bottom: 16px;
}

.records-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.period-card {
  background: var(--color-bg-card);
  border-radius: var(--radius-md, 12px);
  padding: 14px;
  cursor: pointer;
  transition: background var(--transition-fast);
  -webkit-tap-highlight-color: transparent;
}
.period-card:active {
  background: var(--color-bg-elevated);
}

.period-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}
.period-dates {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 15px;
  font-weight: 600;
  color: var(--color-text);
}
.period-sep { color: var(--color-text-muted); }
.period-ongoing {
  font-size: 12px;
  color: #ec4899;
  background: rgba(236, 72, 153, 0.1);
  padding: 2px 8px;
  border-radius: 4px;
  margin-left: 4px;
}

.period-stats {
  display: flex;
  gap: 6px;
}
.stat-badge {
  font-size: 11px;
  padding: 2px 8px;
  border-radius: 4px;
  background: rgba(99, 102, 241, 0.1);
  color: var(--color-primary);
}
.stat-badge.cycle {
  background: rgba(245, 158, 11, 0.1);
  color: #d97706;
}

.period-details {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-bottom: 4px;
}
.flow-badge {
  font-size: 11px;
  padding: 2px 8px;
  border-radius: 4px;
}
.flow-badge.light { background: rgba(34, 197, 94, 0.1); color: #16a34a; }
.flow-badge.moderate { background: rgba(245, 158, 11, 0.1); color: #d97706; }
.flow-badge.heavy { background: rgba(239, 68, 68, 0.1); color: #ef4444; }

.symptom-badge {
  font-size: 11px;
  padding: 2px 8px;
  border-radius: 4px;
  background: var(--color-bg-elevated);
  color: var(--color-text-secondary);
}

.period-note {
  font-size: 12px;
  color: var(--color-text-secondary);
  margin-top: 4px;
}

.symptom-picker {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
.symptom-btn {
  padding: 6px 12px;
  border: 1px solid var(--color-border);
  border-radius: 16px;
  background: transparent;
  font-size: 13px;
  color: var(--color-text-secondary);
  cursor: pointer;
  transition: all 0.15s;
  min-height: auto;
  min-width: auto;
}
.symptom-btn.active {
  border-color: #ec4899;
  background: rgba(236, 72, 153, 0.1);
  color: #ec4899;
}
</style>
