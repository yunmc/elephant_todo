<template>
  <div class="page-container">
    <h1 class="page-title">重要日期</h1>

    <!-- Add Button -->
    <div style="margin-bottom: 16px;">
      <n-button type="primary" block @click="openAddModal">+ 添加重要日期</n-button>
    </div>

    <n-spin v-if="datesStore.loading" style="display: flex; justify-content: center; padding: 48px 0;" />

    <n-empty v-else-if="datesStore.dates.length === 0" description="暂无重要日期" style="padding: 48px 0;">
      <template #extra>
        <n-text depth="3">记录生日、纪念日等重要日期</n-text>
      </template>
    </n-empty>

    <!-- Dates List -->
    <div v-else class="dates-list">
      <div v-for="item in datesStore.dates" :key="item.id" class="date-card" @click="openEditModal(item)">
        <div class="date-left">
          <div class="date-icon">{{ item.icon || '📅' }}</div>
          <div class="date-info">
            <div class="date-title">{{ item.title }}</div>
            <div class="date-detail">
              {{ formatDateDisplay(item.date) }}
              <span v-if="item.repeat_type === 'yearly'" class="date-tag">每年</span>
              <span v-if="item.repeat_type === 'monthly'" class="date-tag monthly">每月</span>
              <span v-if="item.is_lunar" class="date-tag lunar">农历</span>
            </div>
            <div v-if="item.note" class="date-note">{{ item.note }}</div>
          </div>
        </div>
        <div class="date-right">
          <div class="countdown" :class="countdownClass(item.days_until)">
            <template v-if="item.days_until === 0">
              <div class="countdown-num">🎉</div>
              <div class="countdown-label">就是今天</div>
            </template>
            <template v-else-if="item.days_until !== undefined && item.days_until > 0">
              <div class="countdown-num">{{ item.days_until }}</div>
              <div class="countdown-label">天后</div>
            </template>
            <template v-else>
              <div class="countdown-num">{{ Math.abs(item.days_until || 0) }}</div>
              <div class="countdown-label">天前</div>
            </template>
          </div>
        </div>
      </div>
    </div>

    <!-- Add/Edit Modal -->
    <ClientOnly>
      <n-modal v-model:show="showModal" preset="card" :title="editingId ? '编辑重要日期' : '添加重要日期'" :style="{ maxWidth: '500px', width: '100%' }">
        <n-form :model="form" label-placement="left" label-width="80">
          <n-form-item label="标题">
            <n-input v-model:value="form.title" placeholder="如：妈妈的生日" />
          </n-form-item>
          <n-form-item label="图标">
            <div class="icon-picker">
              <button
                v-for="emoji in iconOptions"
                :key="emoji"
                :class="['icon-btn', { active: form.icon === emoji }]"
                @click="form.icon = emoji"
              >{{ emoji }}</button>
            </div>
          </n-form-item>
          <n-form-item label="日期">
            <n-date-picker v-model:value="form.date_ts" type="date" style="width: 100%;" />
          </n-form-item>
          <n-form-item label="重复">
            <n-select
              v-model:value="form.repeat_type"
              :options="repeatOptions"
              style="width: 100%;"
            />
          </n-form-item>
          <n-form-item label="提前提醒">
            <n-select
              v-model:value="form.remind_days_before"
              :options="remindOptions"
              style="width: 100%;"
            />
          </n-form-item>
          <n-form-item label="备注">
            <n-input v-model:value="form.note" type="textarea" placeholder="可选备注" :rows="2" />
          </n-form-item>
        </n-form>
        <template #action>
          <n-space>
            <n-button v-if="editingId" type="error" ghost @click="handleDelete">删除</n-button>
            <n-button type="primary" :disabled="!form.title.trim() || !form.date_ts" @click="handleSave">
              {{ editingId ? '保存' : '添加' }}
            </n-button>
          </n-space>
        </template>
      </n-modal>
    </ClientOnly>
  </div>
</template>

<script setup lang="ts">
import type { ImportantDate } from '~/types'

const datesStore = useImportantDatesStore()
const message = useMessage()

const showModal = ref(false)
const editingId = ref<number | null>(null)

const iconOptions = ['📅', '🎂', '💍', '🎓', '🏠', '✈️', '❤️', '⭐', '🎄', '🌸', '👶', '🎁']

const remindOptions = [
  { label: '不提醒', value: 0 },
  { label: '提前 1 天', value: 1 },
  { label: '提前 3 天', value: 3 },
  { label: '提前 7 天', value: 7 },
  { label: '提前 14 天', value: 14 },
  { label: '提前 30 天', value: 30 },
]

const repeatOptions = [
  { label: '不重复', value: 'none' },
  { label: '每月重复', value: 'monthly' },
  { label: '每年重复', value: 'yearly' },
]

const form = reactive({
  title: '',
  icon: '📅',
  date_ts: Date.now(),
  repeat_type: 'yearly' as 'none' | 'monthly' | 'yearly',
  is_lunar: false,
  remind_days_before: 0,
  note: '',
})

await useAsyncData('important-dates-init', async () => {
  await datesStore.fetchDates()
  return true
})

function openAddModal() {
  editingId.value = null
  form.title = ''
  form.icon = '📅'
  form.date_ts = Date.now()
  form.repeat_type = 'yearly'
  form.is_lunar = false
  form.remind_days_before = 0
  form.note = ''
  showModal.value = true
}

function openEditModal(item: ImportantDate) {
  editingId.value = item.id
  form.title = item.title
  form.icon = item.icon || '📅'
  form.date_ts = new Date(item.date).getTime()
  form.repeat_type = item.repeat_type || 'none'
  form.is_lunar = item.is_lunar
  form.remind_days_before = item.remind_days_before
  form.note = item.note || ''
  showModal.value = true
}

async function handleSave() {
  if (!form.title.trim() || !form.date_ts) return
  // Use local time formatting to avoid UTC date shift
  const d = new Date(form.date_ts)
  const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  const data = {
    title: form.title.trim(),
    icon: form.icon,
    date: dateStr,
    repeat_type: form.repeat_type,
    is_lunar: form.is_lunar,
    remind_days_before: form.remind_days_before,
    note: form.note || undefined,
  }

  try {
    if (editingId.value) {
      await datesStore.updateDate(editingId.value, data)
      message.success('已更新')
    } else {
      await datesStore.createDate(data)
      message.success('已添加')
    }
    showModal.value = false
  } catch {
    message.error('操作失败')
  }
}

async function handleDelete() {
  if (!editingId.value) return
  try {
    await datesStore.deleteDate(editingId.value)
    showModal.value = false
    message.success('已删除')
  } catch {
    message.error('删除失败')
  }
}

function formatDateDisplay(dateStr: string) {
  // Parse YYYY-MM-DD directly to avoid timezone issues
  const parts = dateStr.split('T')[0].split('-')
  return `${+parts[0]}年${+parts[1]}月${+parts[2]}日`
}

function countdownClass(daysUntil?: number) {
  if (daysUntil === undefined) return ''
  if (daysUntil === 0) return 'today'
  if (daysUntil <= 7) return 'soon'
  return ''
}
</script>

<style scoped>
.dates-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.date-card {
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: var(--color-bg-card);
  border-radius: var(--radius-md, 12px);
  padding: 14px;
  cursor: pointer;
  transition: background var(--transition-fast);
  -webkit-tap-highlight-color: transparent;
}
.date-card:active {
  background: var(--color-bg-elevated);
}

.date-left {
  display: flex;
  align-items: center;
  gap: 12px;
  min-width: 0;
  flex: 1;
}

.date-icon {
  font-size: 28px;
  flex-shrink: 0;
}

.date-info {
  min-width: 0;
}
.date-title {
  font-size: 15px;
  font-weight: 600;
  color: var(--color-text);
}
.date-detail {
  font-size: 12px;
  color: var(--color-text-muted);
  margin-top: 2px;
  display: flex;
  align-items: center;
  gap: 6px;
}
.date-tag {
  display: inline-block;
  padding: 1px 6px;
  border-radius: 4px;
  font-size: 10px;
  background: var(--color-primary-light);
  color: var(--color-primary);
}
.date-tag.lunar {
  background: var(--color-warning-bg);
  color: var(--color-warning);
}
.date-tag.monthly {
  background: var(--color-success-bg);
  color: var(--color-success);
}
.date-note {
  font-size: 12px;
  color: var(--color-text-secondary);
  margin-top: 2px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.date-right {
  flex-shrink: 0;
  margin-left: 12px;
}

.countdown {
  text-align: center;
  min-width: 52px;
}
.countdown-num {
  font-size: 22px;
  font-weight: 800;
  color: var(--color-text);
  line-height: 1.2;
}
.countdown-label {
  font-size: 11px;
  color: var(--color-text-muted);
}
.countdown.today .countdown-num {
  color: var(--color-danger);
}
.countdown.soon .countdown-num {
  color: var(--color-warning);
}

.icon-picker {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
.icon-btn {
  width: 38px;
  height: 38px;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  background: transparent;
  font-size: 20px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.15s;
  min-height: auto;
  min-width: auto;
}
.icon-btn.active {
  border-color: var(--color-primary);
  background: var(--color-primary-light);
}
</style>
