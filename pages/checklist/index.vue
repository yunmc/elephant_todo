<template>
  <div class="page-container">
    <h1 class="page-title">每日打卡</h1>

    <!-- Date Navigator -->
    <div class="date-nav">
      <button class="date-arrow" @click="prevDay">‹</button>
      <div class="date-display" @click="goToday">
        {{ isToday ? '今天' : displayDate }}
      </div>
      <button class="date-arrow" :disabled="isToday" @click="nextDay">›</button>
    </div>

    <!-- Progress -->
    <div v-if="todayItems.length > 0" class="progress-section">
      <div class="progress-text">
        <span>{{ checkedCount }} / {{ todayItems.length }}</span>
        <span class="progress-label">{{ checkedCount === todayItems.length ? '全部完成 🎉' : '已完成' }}</span>
      </div>
      <div class="progress-bar">
        <div class="progress-fill" :style="{ width: progressPercent + '%' }"></div>
      </div>
    </div>

    <n-spin v-if="store.loading" style="display: flex; justify-content: center; padding: 48px 0;" />

    <n-empty v-else-if="todayItems.length === 0" description="暂无习惯项" style="padding: 48px 0;">
      <template #extra>
        <n-button type="primary" size="small" @click="navigateTo('/checklist/manage')">去添加习惯</n-button>
      </template>
    </n-empty>

    <!-- Checklist -->
    <div v-else class="checklist">
      <div
        v-for="item in todayItems"
        :key="item.id"
        :class="['check-item', { checked: item.checked }]"
        @click="store.toggleCheck(item.id, store.currentDate)"
      >
        <div class="check-box" :class="{ checked: item.checked }">
          <span v-if="item.checked" class="check-icon">✓</span>
        </div>
        <span class="check-emoji">{{ item.icon || '✅' }}</span>
        <span class="check-title">{{ item.title }}</span>
        <span v-if="item.checked && item.checked_at" class="check-time">
          {{ formatTime(item.checked_at) }}
        </span>
      </div>
    </div>

    <!-- Bottom Actions -->
    <div class="bottom-actions">
      <NuxtLink to="/checklist/manage" class="action-btn">
        <span>⚙️</span>
        <span>管理习惯</span>
      </NuxtLink>
      <NuxtLink to="/checklist/stats" class="action-btn">
        <span>📊</span>
        <span>查看统计</span>
      </NuxtLink>
    </div>
  </div>
</template>

<script setup lang="ts">
const store = useChecklistStore()
const todayItems = computed(() => store.todayItems)

// Register page-specific "+" action
useGlobalAdd(() => navigateTo('/checklist/manage'))

const checkedCount = computed(() => todayItems.value.filter(i => i.checked).length)
const progressPercent = computed(() => {
  if (todayItems.value.length === 0) return 0
  return Math.round(checkedCount.value / todayItems.value.length * 100)
})

const isToday = computed(() => store.currentDate === formatDate(new Date()))

const displayDate = computed(() => {
  const parts = store.currentDate.split('-')
  return `${+parts[1]}月${+parts[2]}日`
})

function prevDay() {
  const d = new Date(store.currentDate)
  d.setDate(d.getDate() - 1)
  store.setDate(formatDate(d))
  store.fetchToday(store.currentDate)
}

function nextDay() {
  if (isToday.value) return
  const d = new Date(store.currentDate)
  d.setDate(d.getDate() + 1)
  const newDate = formatDate(d)
  const todayStr = formatDate(new Date())
  if (newDate > todayStr) return
  store.setDate(newDate)
  store.fetchToday(store.currentDate)
}

function goToday() {
  const todayStr = formatDate(new Date())
  if (store.currentDate !== todayStr) {
    store.setDate(todayStr)
    store.fetchToday(todayStr)
  }
}

function formatTime(dateStr: string) {
  const d = new Date(dateStr)
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

function formatDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

await useAsyncData('checklist-today', async () => {
  await store.fetchToday(store.currentDate)
  return true
})
</script>

<style scoped>
.date-nav {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 16px;
  margin-bottom: 16px;
}
.date-arrow {
  width: 36px;
  height: 36px;
  border: none;
  background: var(--color-bg-card);
  border-radius: 50%;
  font-size: 20px;
  color: var(--color-text);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  -webkit-tap-highlight-color: transparent;
}
.date-arrow:disabled {
  opacity: 0.3;
  cursor: default;
}
.date-display {
  font-size: 16px;
  font-weight: 600;
  color: var(--color-text);
  cursor: pointer;
  padding: 4px 12px;
  border-radius: 8px;
  -webkit-tap-highlight-color: transparent;
}
.date-display:active {
  background: var(--color-bg-card);
}

.progress-section {
  margin-bottom: 16px;
}
.progress-text {
  display: flex;
  align-items: baseline;
  gap: 8px;
  margin-bottom: 6px;
  font-size: 14px;
  color: var(--color-text);
  font-weight: 600;
}
.progress-label {
  font-size: 12px;
  font-weight: 400;
  color: var(--color-text-muted);
}
.progress-bar {
  height: 6px;
  background: var(--color-bg-elevated);
  border-radius: 3px;
  overflow: hidden;
}
.progress-fill {
  height: 100%;
  background: var(--color-primary);
  border-radius: 3px;
  transition: width 0.3s ease;
}

.checklist {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.check-item {
  display: flex;
  align-items: center;
  gap: 12px;
  background: var(--color-bg-card);
  border-radius: var(--radius-md, 12px);
  padding: 14px;
  cursor: pointer;
  transition: background var(--transition-fast), transform var(--transition-fast);
  -webkit-tap-highlight-color: transparent;
}
.check-item:active {
  transform: scale(0.98);
}
.check-item.checked {
  opacity: 0.7;
}

.check-box {
  width: 24px;
  height: 24px;
  border: 2px solid var(--color-text-muted);
  border-radius: 6px;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
}
.check-box.checked {
  background: var(--color-primary);
  border-color: var(--color-primary);
}
.check-icon {
  color: var(--color-text-inverse);
  font-size: 14px;
  font-weight: 700;
}

.check-emoji {
  font-size: 22px;
  flex-shrink: 0;
}
.check-title {
  font-size: 15px;
  font-weight: 500;
  color: var(--color-text);
  flex: 1;
}
.check-time {
  font-size: 12px;
  color: var(--color-text-muted);
  flex-shrink: 0;
}

.bottom-actions {
  display: flex;
  gap: 12px;
  margin-top: 24px;
}
.action-btn {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 12px;
  background: var(--color-bg-card);
  border-radius: var(--radius-md, 12px);
  text-decoration: none;
  font-size: 14px;
  color: var(--color-text);
  transition: background var(--transition-fast);
  -webkit-tap-highlight-color: transparent;
}
.action-btn:active {
  background: var(--color-bg-elevated);
}
</style>
