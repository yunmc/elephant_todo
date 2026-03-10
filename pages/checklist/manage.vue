<template>
  <div class="page-container">
    <div class="page-header">
      <NuxtLink to="/checklist" class="back-btn">‹ 返回</NuxtLink>
      <h1 class="page-title-inline">管理习惯</h1>
    </div>

    <!-- Add New -->
    <div class="add-section">
      <div class="add-row">
        <button class="emoji-btn" @click="showIconPicker = !showIconPicker">{{ newIcon }}</button>
        <input
          v-model="newTitle"
          class="add-input"
          placeholder="添加新习惯"
          maxlength="100"
          @keyup.enter="handleAdd"
        />
        <n-button type="primary" :disabled="!newTitle.trim()" size="small" @click="handleAdd">添加</n-button>
      </div>
      <div v-if="showIconPicker" class="icon-picker">
        <button
          v-for="emoji in iconOptions"
          :key="emoji"
          :class="['icon-btn', { active: newIcon === emoji }]"
          @click="newIcon = emoji; showIconPicker = false"
        >{{ emoji }}</button>
      </div>
    </div>

    <n-spin v-if="store.loading" style="display: flex; justify-content: center; padding: 48px 0;" />

    <n-empty v-else-if="store.items.length === 0" description="暂无习惯项" style="padding: 48px 0;">
      <template #extra>
        <n-text depth="3">在上方添加你的第一个每日习惯</n-text>
      </template>
    </n-empty>

    <!-- Items List -->
    <div v-else class="items-list">
      <div
        v-for="(item, idx) in store.items"
        :key="item.id"
        :class="['item-card', { paused: !item.is_active }]"
      >
        <div class="item-left">
          <span class="item-emoji">{{ item.icon || '✅' }}</span>
          <div class="item-info">
            <div v-if="editingId !== item.id" class="item-title" @click="startEdit(item)">
              {{ item.title }}
            </div>
            <div v-else class="edit-row">
              <input
                v-model="editTitle"
                class="edit-input"
                maxlength="100"
                @keyup.enter="saveEdit(item.id)"
                @keyup.escape="cancelEdit"
              />
              <button class="mini-btn save" @click="saveEdit(item.id)">✓</button>
              <button class="mini-btn" @click="cancelEdit">✕</button>
            </div>
            <div v-if="!item.is_active" class="item-badge paused">已暂停</div>
          </div>
        </div>
        <div class="item-actions">
          <!-- Reorder -->
          <button v-if="idx > 0" class="action-icon" @click="moveUp(idx)">↑</button>
          <button v-if="idx < store.items.length - 1" class="action-icon" @click="moveDown(idx)">↓</button>
          <!-- Pause / Resume -->
          <button class="action-icon" :title="item.is_active ? '暂停' : '启用'" @click="toggleActive(item)">
            {{ item.is_active ? '⏸' : '▶️' }}
          </button>
          <!-- Delete -->
          <n-popconfirm @positive-click="handleDelete(item.id)">
            <template #trigger>
              <button class="action-icon danger">🗑</button>
            </template>
            确定删除「{{ item.title }}」？相关打卡记录也会被删除。
          </n-popconfirm>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { ChecklistItem } from '~/types'

const store = useChecklistStore()
const message = useMessage()

const iconOptions = ['✅', '💧', '🏃', '📖', '🧘', '💊', '🍎', '😴', '✏️', '🎵', '🧹', '🌿', '🐘', '💪', '🧠', '☀️']

const newTitle = ref('')
const newIcon = ref('✅')
const showIconPicker = ref(false)

const editingId = ref<number | null>(null)
const editTitle = ref('')

await useAsyncData('checklist-items', async () => {
  await store.fetchItems()
  return true
})

async function handleAdd() {
  const title = newTitle.value.trim()
  if (!title) return
  try {
    await store.createItem({ title, icon: newIcon.value })
    newTitle.value = ''
    newIcon.value = '✅'
    message.success('习惯已添加')
  } catch {
    message.error('添加失败')
  }
}

function startEdit(item: ChecklistItem) {
  editingId.value = item.id
  editTitle.value = item.title
}

function cancelEdit() {
  editingId.value = null
  editTitle.value = ''
}

async function saveEdit(id: number) {
  const title = editTitle.value.trim()
  if (!title) return
  try {
    await store.updateItem(id, { title })
    editingId.value = null
    message.success('已更新')
  } catch {
    message.error('更新失败')
  }
}

async function toggleActive(item: ChecklistItem) {
  try {
    await store.updateItem(item.id, { is_active: !item.is_active })
    message.success(item.is_active ? '已暂停' : '已启用')
  } catch {
    message.error('操作失败')
  }
}

async function handleDelete(id: number) {
  try {
    await store.deleteItem(id)
    message.success('已删除')
  } catch {
    message.error('删除失败')
  }
}

async function moveUp(idx: number) {
  const arr = [...store.items]
  ;[arr[idx - 1], arr[idx]] = [arr[idx], arr[idx - 1]]
  store.items = arr
  await store.reorderItems(arr.map(i => i.id))
}

async function moveDown(idx: number) {
  const arr = [...store.items]
  ;[arr[idx], arr[idx + 1]] = [arr[idx + 1], arr[idx]]
  store.items = arr
  await store.reorderItems(arr.map(i => i.id))
}
</script>

<style scoped>
.page-header {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 16px;
}
.back-btn {
  font-size: 18px;
  color: var(--color-primary);
  text-decoration: none;
  padding: 4px 8px;
  -webkit-tap-highlight-color: transparent;
}
.page-title-inline {
  font-size: 20px;
  font-weight: 700;
  color: var(--color-text);
  margin: 0;
}

.add-section {
  margin-bottom: 20px;
}
.add-row {
  display: flex;
  align-items: center;
  gap: 8px;
}
.emoji-btn {
  width: 40px;
  height: 40px;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  background: var(--color-bg-card);
  font-size: 20px;
  cursor: pointer;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
}
.add-input {
  flex: 1;
  height: 40px;
  padding: 0 12px;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  background: var(--color-bg-card);
  color: var(--color-text);
  font-size: 14px;
  outline: none;
}
.add-input:focus {
  border-color: var(--color-primary);
}

.icon-picker {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 8px;
  padding: 8px;
  background: var(--color-bg-card);
  border-radius: 8px;
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
}
.icon-btn.active {
  border-color: var(--color-primary);
  background: var(--color-primary-light);
}

.items-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.item-card {
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: var(--color-bg-card);
  border-radius: var(--radius-md, 12px);
  padding: 12px 14px;
}
.item-card.paused {
  opacity: 0.55;
}

.item-left {
  display: flex;
  align-items: center;
  gap: 10px;
  flex: 1;
  min-width: 0;
}
.item-emoji {
  font-size: 24px;
  flex-shrink: 0;
}
.item-info {
  min-width: 0;
  flex: 1;
}
.item-title {
  font-size: 15px;
  font-weight: 500;
  color: var(--color-text);
  cursor: pointer;
}
.item-badge.paused {
  display: inline-block;
  font-size: 10px;
  padding: 1px 6px;
  border-radius: 4px;
  background: var(--color-warning-bg);
  color: var(--color-warning);
  margin-top: 2px;
}

.edit-row {
  display: flex;
  align-items: center;
  gap: 4px;
}
.edit-input {
  flex: 1;
  height: 32px;
  padding: 0 8px;
  border: 1px solid var(--color-primary);
  border-radius: 6px;
  background: transparent;
  color: var(--color-text);
  font-size: 14px;
  outline: none;
}
.mini-btn {
  width: 28px;
  height: 28px;
  border: none;
  border-radius: 6px;
  background: var(--color-bg-elevated);
  font-size: 14px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--color-text);
}
.mini-btn.save {
  background: var(--color-primary);
  color: var(--color-text-inverse);
}

.item-actions {
  display: flex;
  align-items: center;
  gap: 4px;
  flex-shrink: 0;
}
.action-icon {
  width: 32px;
  height: 32px;
  border: none;
  background: transparent;
  font-size: 16px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 6px;
  -webkit-tap-highlight-color: transparent;
}
.action-icon:active {
  background: var(--color-bg-elevated);
}
.action-icon.danger:active {
  background: var(--color-danger-bg);
}
</style>
