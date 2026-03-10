<template>
  <div class="page-container">
    <!-- Top Bar -->
    <div class="top-bar">
      <button class="back-btn" @click="navigateTo('/ideas')">←</button>
      <button v-show="hasChanges" class="action-btn save" @click="handleSave">保存</button>
    </div>

    <n-spin v-if="ideasStore.loading" style="display: flex; justify-content: center; padding: 48px 0;" />

    <template v-else-if="idea">
      <!-- Source + Time -->
      <div class="idea-header">
        <span class="idea-source">{{ idea.source === 'voice' ? '🎤 语音' : '📝 文字' }}</span>
        <span class="idea-time">{{ formatDate(idea.created_at) }}</span>
      </div>

      <!-- Content (inline edit) -->
      <textarea
        v-model="editContent"
        class="inline-content"
        placeholder="记录你的想法..."
        rows="5"
      ></textarea>

      <!-- Link Section -->
      <div class="link-section">
        <div class="section-title">关联待办</div>
        <div v-if="idea.todo_id" class="linked-todo" @click="navigateTo(`/todo/${idea.todo_id}`)">
          <span class="linked-icon">🔗</span>
          <span class="linked-title">{{ idea.todo_title || `Todo #${idea.todo_id}` }}</span>
          <button class="unlink-btn" @click.stop="handleUnlink">取消</button>
        </div>
        <div v-else class="link-actions">
          <button class="link-action-btn" @click="handleConvert">转为待办</button>
          <button class="link-action-btn" @click="showLinkModal = true">关联已有待办</button>
        </div>
      </div>

      <!-- Delete -->
      <button class="delete-btn" @click="confirmDelete = true">删除这条随手记</button>
    </template>

    <!-- Delete Confirm -->
    <ClientOnly>
      <n-modal v-model:show="confirmDelete" preset="dialog" title="确认删除" positive-text="删除" negative-text="取消" type="error" @positive-click="handleDelete">
        确定删除这条随手记吗？
      </n-modal>
    </ClientOnly>

    <!-- Link Modal -->
    <ClientOnly>
      <n-modal v-model:show="showLinkModal" preset="card" title="关联到待办" :style="{ maxWidth: '500px', width: '100%' }">
        <n-input v-model:value="todoSearch" placeholder="搜索待办..." @update:value="searchTodos" />
        <div v-if="searchTodoResults.length" class="search-results">
          <div v-for="t in searchTodoResults" :key="t.id" class="search-result-item" @click="handleLink(t.id)">
            {{ t.title }}
          </div>
        </div>
        <div v-else-if="todoSearch" class="empty-hint">未找到匹配的待办</div>
      </n-modal>
    </ClientOnly>
  </div>
</template>

<script setup lang="ts">
import type { Todo } from '~/types'

const route = useRoute()
const ideasStore = useIdeasStore()
const api = useApi()
const message = useMessage()

const ideaId = Number(route.params.id)
if (isNaN(ideaId)) navigateTo('/ideas')
const idea = computed(() => ideasStore.currentIdea)

const editContent = ref('')
const confirmDelete = ref(false)
const showLinkModal = ref(false)
const todoSearch = ref('')
const searchTodoResults = ref<Todo[]>([])

const hasChanges = computed(() => {
  if (!idea.value) return false
  return editContent.value !== idea.value.content
})

await useAsyncData(`idea-${ideaId}`, () => ideasStore.fetchIdea(ideaId))

watch(idea, (i) => {
  if (i) editContent.value = i.content
}, { immediate: true })

async function handleSave() {
  if (!editContent.value.trim()) return
  try {
    await ideasStore.updateIdea(ideaId, { content: editContent.value.trim() })
    message.success('已保存')
  } catch {
    message.error('保存失败')
  }
}

async function handleDelete() {
  try {
    await ideasStore.deleteIdea(ideaId)
    navigateTo('/ideas')
  } catch {
    message.error('删除失败')
  }
}

async function handleConvert() {
  try {
    await ideasStore.convertToTodo(ideaId)
    await ideasStore.fetchIdea(ideaId)
    message.success('已转为待办')
  } catch {
    message.error('转化失败')
  }
}

async function handleUnlink() {
  try {
    await ideasStore.unlinkFromTodo(ideaId)
    message.success('已取消关联')
  } catch {
    message.error('取消关联失败')
  }
}

let todoSearchTimer: ReturnType<typeof setTimeout> | null = null
function searchTodos() {
  if (todoSearchTimer) clearTimeout(todoSearchTimer)
  if (!todoSearch.value.trim()) { searchTodoResults.value = []; return }
  todoSearchTimer = setTimeout(async () => {
    try {
      const res = await api.get<Todo[]>('/todos', { search: todoSearch.value, status: 'pending', limit: 10 })
      searchTodoResults.value = res.data || []
    } catch {
      searchTodoResults.value = []
    }
  }, 300)
}

onUnmounted(() => {
  if (todoSearchTimer) clearTimeout(todoSearchTimer)
})

async function handleLink(todoId: number) {
  try {
    await ideasStore.linkToTodo(ideaId, todoId)
    showLinkModal.value = false
    message.success('已关联')
  } catch {
    message.error('关联失败')
  }
}

function formatDate(dateStr: string) {
  const d = new Date(dateStr)
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日 ${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`
}
</script>

<style scoped>
.top-bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}
.back-btn {
  background: none;
  border: none;
  color: var(--color-primary);
  font-size: 18px;
  cursor: pointer;
  padding: 4px 8px 4px 0;
  min-height: 36px;
  min-width: 36px;
}
.action-btn {
  background: var(--color-bg-card);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm, 8px);
  padding: 6px 14px;
  font-size: 13px;
  color: var(--color-text);
  cursor: pointer;
  transition: all 0.2s;
  min-height: 36px;
}
.action-btn:active {
  transform: scale(0.96);
}
.action-btn.save {
  color: var(--color-text-inverse);
  background: var(--color-primary);
  border-color: var(--color-primary);
  font-weight: 600;
}

/* Header */
.idea-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}
.idea-source {
  font-size: 14px;
  color: var(--color-text-secondary);
}
.idea-time {
  font-size: 12px;
  color: var(--color-text-muted);
}

/* Content */
.inline-content {
  display: block;
  width: 100%;
  font-size: 16px;
  line-height: 1.6;
  color: var(--color-text);
  background: var(--color-bg-card);
  border: none;
  border-radius: var(--radius-md, 12px);
  padding: 14px 16px;
  outline: none;
  resize: vertical;
  font-family: inherit;
  caret-color: var(--color-primary);
  margin-bottom: 16px;
  min-height: 120px;
}
.inline-content:focus {
  box-shadow: 0 0 0 2px var(--color-primary-light);
}
.inline-content::placeholder {
  color: var(--color-text-muted);
}

/* Link Section */
.link-section {
  background: var(--color-bg-card);
  border-radius: var(--radius-md, 12px);
  padding: 16px;
  margin-bottom: 16px;
}
.section-title {
  font-size: 15px;
  font-weight: 600;
  color: var(--color-text);
  margin-bottom: 10px;
}
.linked-todo {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 12px;
  background: var(--color-bg-elevated, var(--color-bg));
  border-radius: var(--radius-sm, 8px);
  cursor: pointer;
}
.linked-icon {
  font-size: 14px;
  flex-shrink: 0;
}
.linked-title {
  flex: 1;
  font-size: 14px;
  color: var(--color-primary);
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.unlink-btn {
  background: none;
  border: 1px solid var(--color-border);
  border-radius: 6px;
  padding: 2px 8px;
  font-size: 12px;
  color: var(--color-text-secondary);
  cursor: pointer;
  flex-shrink: 0;
  min-height: auto;
  min-width: auto;
}
.unlink-btn:active {
  background: var(--color-bg-elevated);
}
.link-actions {
  display: flex;
  gap: 8px;
}
.link-action-btn {
  flex: 1;
  padding: 10px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm, 8px);
  background: transparent;
  color: var(--color-text-secondary);
  font-size: 13px;
  cursor: pointer;
  transition: all 0.2s;
  min-height: auto;
  min-width: auto;
}
.link-action-btn:active {
  background: var(--color-bg-elevated);
  transform: scale(0.98);
}

/* Delete */
.delete-btn {
  display: block;
  width: 100%;
  padding: 12px;
  margin-top: 8px;
  margin-bottom: 16px;
  background: var(--color-danger-bg);
  border: none;
  border-radius: var(--radius-md, 12px);
  color: var(--color-danger);
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}
.delete-btn:active {
  background: var(--color-danger-bg);
  transform: scale(0.98);
}

/* Search results in link modal */
.search-results {
  margin-top: 12px;
  max-height: 300px;
  overflow-y: auto;
}
.search-result-item {
  padding: 10px 12px;
  border-radius: var(--radius-sm, 8px);
  cursor: pointer;
  font-size: 14px;
  color: var(--color-text);
  transition: background 0.15s;
}
.search-result-item:hover,
.search-result-item:active {
  background: var(--color-bg-elevated);
}
.search-result-item + .search-result-item {
  border-top: 1px solid var(--color-border);
}
.empty-hint {
  font-size: 13px;
  color: var(--color-text-secondary);
  opacity: 0.6;
  text-align: center;
  padding: 24px 0;
}
</style>
