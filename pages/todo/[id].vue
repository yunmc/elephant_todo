<template>
  <div class="page-container">
    <!-- Top Bar -->
    <div class="top-bar">
      <button class="back-btn" @click="navigateTo('/')">←</button>
      <button v-show="hasChanges" class="action-btn save" @click="handleSave">保存</button>
    </div>

    <n-spin v-if="todosStore.loading" style="display: flex; justify-content: center; padding: 48px 0;" />

    <template v-else-if="todo">
      <!-- Title + Status -->
      <div class="title-row">
        <input
          v-model="editForm.title"
          class="inline-title"
          :class="{ 'status-completed': todo.status === 'completed' }"
          placeholder="待办标题"
        />
        <button class="status-pill" :class="todo.status === 'completed' ? 'completed' : 'pending'" @click="todosStore.toggleTodo(todo.id)">
          {{ todo.status === 'completed' ? '已完成' : '进行中' }}
        </button>
      </div>

      <!-- Info Rows -->
      <div class="info-section">
        <div class="info-row">
          <span class="info-label">优先级</span>
          <n-select
            v-model:value="editForm.priority"
            :options="priorityOptions"
            size="small"
            class="info-control"
          />
        </div>
        <div class="info-row">
          <span class="info-label">截止日期</span>
          <n-date-picker
            v-model:formatted-value="editForm.due_date"
            type="date"
            clearable
            value-format="yyyy-MM-dd"
            size="small"
            placeholder="无"
            class="info-control"
          />
        </div>
        <div class="info-row">
          <span class="info-label">分类</span>
          <n-select
            v-model:value="editForm.category_id"
            :options="categoryOptions"
            clearable
            filterable
            placeholder="无"
            size="small"
            class="info-control"
          >
            <template #action>
              <div class="select-create">
                <n-input v-model:value="newCategoryName" size="tiny" placeholder="新分类名称" @keyup.enter="handleCreateCategory" />
                <n-button size="tiny" type="primary" :disabled="!newCategoryName.trim()" @click="handleCreateCategory">添加</n-button>
              </div>
            </template>
          </n-select>
        </div>
        <div class="info-row">
          <span class="info-label">标签</span>
          <n-select
            v-model:value="editForm.tag_ids"
            :options="tagOptions"
            multiple
            clearable
            filterable
            placeholder="无"
            size="small"
            class="info-control"
          >
            <template #action>
              <div class="select-create">
                <n-input v-model:value="newTagName" size="tiny" placeholder="新标签名称" @keyup.enter="handleCreateTag" />
                <n-button size="tiny" type="primary" :disabled="!newTagName.trim()" @click="handleCreateTag">添加</n-button>
              </div>
            </template>
          </n-select>
        </div>
      </div>

      <!-- Description (inline edit) -->
      <div class="desc-section">
        <div class="section-title">描述</div>
        <textarea
          v-model="editForm.description"
          class="inline-textarea"
          placeholder="添加描述..."
          rows="3"
        ></textarea>
      </div>

      <!-- Subtasks -->
      <div class="subtasks-section">
        <div class="section-title">
          子任务
          <span v-if="subtasks.length" class="subtask-progress">{{ completedSubtasks }}/{{ subtasks.length }}</span>
        </div>
        <!-- Progress Bar -->
        <div v-if="subtasks.length" class="subtask-progress-bar">
          <div class="subtask-progress-fill" :style="{ width: subtaskProgressPercent + '%' }"></div>
        </div>
        <div class="subtask-list">
          <div v-for="st in subtasks" :key="st.id" class="subtask-item">
            <div class="subtask-check" @click="toggleSubtask(st.id)">
              <div class="check-circle" :class="{ checked: st.status === 'completed' }">
                <span v-if="st.status === 'completed'">✓</span>
              </div>
            </div>
            <div class="subtask-content">
              <input
                v-if="editingSubtaskId === st.id"
                v-model="editingSubtaskTitle"
                class="subtask-edit-input"
                @keyup.enter="saveSubtaskEdit"
                @keyup.esc="cancelSubtaskEdit"
                @blur="saveSubtaskEdit"
              />
              <span
                v-else
                class="subtask-title"
                :class="{ done: st.status === 'completed' }"
                @click.stop="startEditSubtask(st)"
              >{{ st.title }}</span>
            </div>
            <button class="subtask-del" @click="deleteSubtask(st.id)">✕</button>
          </div>
        </div>
        <!-- Add subtask -->
        <div class="add-subtask">
          <input
            v-model="newSubtaskTitle"
            class="add-subtask-input"
            placeholder="添加子任务..."
            @keyup.enter="addSubtask"
          />
          <button v-show="newSubtaskTitle.trim()" class="add-subtask-btn" @click="addSubtask">添加</button>
        </div>
      </div>

      <!-- Related Ideas -->
      <div class="ideas-section">
        <div class="section-title">
          关联随手记
          <span v-if="ideas.length" class="ideas-count">{{ ideas.length }}</span>
        </div>
        <div v-if="ideas.length === 0" class="empty-hint">暂无关联的随手记</div>
        <div v-else class="ideas-list">
          <div v-for="idea in ideas" :key="idea.id" class="idea-item clickable" @click="navigateTo(`/ideas/${idea.id}`)">
            <span class="idea-icon">{{ idea.source === 'voice' ? '🎤' : '📝' }}</span>
            <div class="idea-content">
              <div class="idea-text">{{ idea.content }}</div>
              <div class="idea-time">{{ formatFullDate(idea.created_at) }}</div>
            </div>
          </div>
        </div>
      </div>

      <!-- Delete -->
      <button class="delete-btn" @click="confirmDelete = true">删除这个待办</button>
    </template>

    <!-- Delete Confirm -->
    <ClientOnly>
      <n-modal v-model:show="confirmDelete" preset="dialog" title="确认删除" positive-text="删除" negative-text="取消" type="error" @positive-click="handleDelete">
        确定要删除这个待办吗？
      </n-modal>
    </ClientOnly>
  </div>
</template>

<script setup lang="ts">
import type { Idea, Subtask } from '~/types'

const route = useRoute()
const todosStore = useTodosStore()
const categoriesStore = useCategoriesStore()
const tagsStore = useTagsStore()
const message = useMessage()
const api = useApi()

const todoId = Number(route.params.id)
const todo = computed(() => todosStore.currentTodo)
const ideas = ref<Idea[]>([])
const subtasks = ref<Subtask[]>([])
const newSubtaskTitle = ref('')
const editingSubtaskId = ref<number | null>(null)
const editingSubtaskTitle = ref('')
const confirmDelete = ref(false)
const newCategoryName = ref('')
const newTagName = ref('')

const completedSubtasks = computed(() => subtasks.value.filter(s => s.status === 'completed').length)
const subtaskProgressPercent = computed(() =>
  subtasks.value.length ? Math.round((completedSubtasks.value / subtasks.value.length) * 100) : 0
)

const editForm = reactive({
  title: '',
  description: '',
  priority: 'medium' as string,
  due_date: '' as string | null,
  category_id: null as number | null,
  tag_ids: [] as number[],
})

const categoryOptions = computed(() =>
  categoriesStore.categories.map(c => ({ label: c.name, value: c.id }))
)
const tagOptions = computed(() =>
  tagsStore.tags.map(t => ({ label: t.name, value: t.id }))
)
const priorityOptions = [
  { label: '高', value: 'high' },
  { label: '中', value: 'medium' },
  { label: '低', value: 'low' },
]

const hasChanges = computed(() => {
  if (!todo.value) return false
  const t = todo.value
  return (
    editForm.title !== t.title ||
    editForm.description !== (t.description || '') ||
    editForm.priority !== t.priority ||
    editForm.due_date !== (t.due_date?.split('T')[0] || null) ||
    editForm.category_id !== t.category_id ||
    JSON.stringify(editForm.tag_ids.slice().sort()) !== JSON.stringify((t.tags || []).map((tag: any) => tag.id).sort())
  )
})

await useAsyncData(`todo-${todoId}`, async () => {
  await Promise.all([
    todosStore.fetchTodo(todoId),
    categoriesStore.fetchCategories(),
    tagsStore.fetchTags(),
  ])
  return true
})

watch(todo, (t) => {
  if (t) {
    editForm.title = t.title
    editForm.description = t.description || ''
    editForm.priority = t.priority
    editForm.due_date = t.due_date?.split('T')[0] || null
    editForm.category_id = t.category_id
    editForm.tag_ids = (t.tags || []).map((tag: any) => tag.id)
  }
}, { immediate: true })

onMounted(async () => {
  try { ideas.value = await todosStore.fetchTodoIdeas(todoId) } catch { ideas.value = [] }
  try {
    const res = await api.get<Subtask[]>(`/todos/${todoId}/subtasks`)
    subtasks.value = res.data || []
  } catch { subtasks.value = [] }
})

async function addSubtask() {
  const title = newSubtaskTitle.value.trim()
  if (!title) return
  try {
    const res = await api.post<Subtask>(`/todos/${todoId}/subtasks`, { title })
    if (res.data) subtasks.value.push(res.data)
    newSubtaskTitle.value = ''
  } catch { message.error('添加失败') }
}

async function toggleSubtask(subtaskId: number) {
  try {
    const res = await api.patch<Subtask>(`/todos/${todoId}/subtasks/${subtaskId}/toggle`)
    if (res.data) {
      const idx = subtasks.value.findIndex(s => s.id === subtaskId)
      if (idx !== -1) subtasks.value[idx] = res.data
    }
  } catch { message.error('操作失败') }
}

async function deleteSubtask(subtaskId: number) {
  try {
    await api.delete(`/todos/${todoId}/subtasks/${subtaskId}`)
    subtasks.value = subtasks.value.filter(s => s.id !== subtaskId)
    if (editingSubtaskId.value === subtaskId) {
      editingSubtaskId.value = null
      editingSubtaskTitle.value = ''
    }
  } catch { message.error('删除失败') }
}

function startEditSubtask(st: Subtask) {
  editingSubtaskId.value = st.id
  editingSubtaskTitle.value = st.title
}

function cancelSubtaskEdit() {
  editingSubtaskId.value = null
  editingSubtaskTitle.value = ''
}

async function saveSubtaskEdit() {
  if (!editingSubtaskId.value) return
  const title = editingSubtaskTitle.value.trim()
  if (!title) {
    message.error('子任务标题不能为空')
    return
  }
  try {
    const res = await api.put<Subtask>(`/todos/${todoId}/subtasks/${editingSubtaskId.value}`, { title })
    if (res.data) {
      const idx = subtasks.value.findIndex(s => s.id === res.data?.id)
      if (idx !== -1) subtasks.value[idx] = res.data
    }
    editingSubtaskId.value = null
    editingSubtaskTitle.value = ''
  } catch {
    message.error('更新失败')
  }
}

async function handleSave() {
  try {
    await todosStore.updateTodo(todoId, {
      title: editForm.title,
      description: editForm.description || null,
      priority: editForm.priority,
      due_date: editForm.due_date || null,
      category_id: editForm.category_id,
      tag_ids: editForm.tag_ids,
    })
    message.success('已保存')
  } catch {
    message.error('保存失败')
  }
}

async function handleDelete() {
  try {
    await todosStore.deleteTodo(todoId)
    navigateTo('/')
  } catch {
    message.error('删除失败')
  }
}

async function handleCreateCategory() {
  const name = newCategoryName.value.trim()
  if (!name) return
  try {
    await categoriesStore.createCategory({ name })
    newCategoryName.value = ''
    const created = categoriesStore.categories.find(c => c.name === name)
    if (created) editForm.category_id = created.id
  } catch {
    message.error('创建分类失败')
  }
}

async function handleCreateTag() {
  const name = newTagName.value.trim()
  if (!name) return
  try {
    await tagsStore.createTag({ name })
    newTagName.value = ''
    const created = tagsStore.tags.find(t => t.name === name)
    if (created) editForm.tag_ids = [...editForm.tag_ids, created.id]
  } catch {
    message.error('创建标签失败')
  }
}

function formatFullDate(dateStr: string) {
  const d = new Date(dateStr)
  return `${d.getMonth() + 1}月${d.getDate()}日 ${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`
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
.top-actions {
  display: flex;
  gap: 8px;
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

/* Title + Status Row */
.title-row {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  margin-bottom: 16px;
}
.inline-title {
  flex: 1;
  min-width: 0;
  font-size: 22px;
  font-weight: 700;
  color: var(--color-text);
  line-height: 1.3;
  padding: 2px 0;
  border: none;
  outline: none;
  background: transparent;
  caret-color: var(--color-primary);
}
.inline-title::placeholder {
  color: var(--color-text-muted);
}
.inline-title.status-completed {
  text-decoration: line-through;
  opacity: 0.5;
}
.status-pill {
  flex-shrink: 0;
  border: none;
  border-radius: 14px;
  padding: 4px 12px;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
  margin-top: 4px;
  min-height: auto;
  min-width: auto;
}
.status-pill:active {
  transform: scale(0.95);
}
.status-pill.pending {
  background: var(--color-status-pending-bg);
  color: var(--color-status-pending);
}
.status-pill.completed {
  background: var(--color-status-completed-bg);
  color: var(--color-status-completed);
}

/* Info Section */
.info-section {
  background: var(--color-bg-card);
  border-radius: var(--radius-md, 12px);
  padding: 4px 0;
  margin-bottom: 16px;
}
.info-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 16px;
}
.info-row + .info-row {
  border-top: 1px solid var(--color-border);
}
.info-label {
  font-size: 14px;
  color: var(--color-text-secondary);
  flex-shrink: 0;
  width: 70px;
}
:deep(.info-control) {
  flex: 1;
  max-width: 200px;
}
.select-create {
  display: flex;
  gap: 6px;
  padding: 4px 8px 6px;
}

/* Description */
.desc-section {
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
  display: flex;
  align-items: center;
  gap: 8px;
}
.inline-textarea {
  display: block;
  width: 100%;
  font-size: 14px;
  line-height: 1.6;
  color: var(--color-text);
  background: var(--color-bg-elevated);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm, 8px);
  padding: 10px 12px;
  outline: none;
  resize: vertical;
  font-family: inherit;
  caret-color: var(--color-primary);
  transition: border-color 0.2s;
}
.inline-textarea:focus {
  border-color: var(--color-primary);
}
.inline-textarea::placeholder {
  color: var(--color-text-muted);
}

/* Ideas Section */
.ideas-section {
  background: var(--color-bg-card);
  border-radius: var(--radius-md, 12px);
  padding: 16px;
  margin-bottom: 16px;
}

/* Subtasks Section */
.subtasks-section {
  background: var(--color-bg-card);
  border-radius: var(--radius-md, 12px);
  padding: 16px;
  margin-bottom: 16px;
}
.subtask-progress {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 20px;
  height: 20px;
  border-radius: 10px;
  background: var(--color-primary-light);
  color: var(--color-primary);
  font-size: 12px;
  font-weight: 600;
  padding: 0 8px;
}
.subtask-progress-bar {
  height: 4px;
  background: var(--color-bg-elevated);
  border-radius: 2px;
  margin-bottom: 12px;
  overflow: hidden;
}
.subtask-progress-fill {
  height: 100%;
  background: var(--color-status-completed);
  border-radius: 2px;
  transition: width 0.3s ease;
}
.subtask-list {
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.subtask-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 4px;
  border-radius: var(--radius-sm, 8px);
  transition: background 0.15s;
}
.subtask-item:active {
  background: var(--color-bg-elevated);
}
.subtask-check {
  flex-shrink: 0;
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
}
.subtask-check .check-circle {
  width: 20px;
  height: 20px;
  border-radius: 50%;
  border: 2px solid var(--color-border);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 11px;
  color: transparent;
  transition: all 0.2s;
}
.subtask-check .check-circle.checked {
  background: var(--color-status-completed);
  border-color: var(--color-status-completed);
  color: var(--color-text-inverse);
}
.subtask-title {
  font-size: 14px;
  color: var(--color-text);
  line-height: 1.4;
  word-break: break-word;
}
.subtask-title.done {
  text-decoration: line-through;
  opacity: 0.5;
}
.subtask-content {
  flex: 1;
  min-width: 0;
}
.subtask-edit-input {
  width: 100%;
  font-size: 14px;
  color: var(--color-text);
  background: var(--color-bg-elevated);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm, 8px);
  padding: 6px 8px;
  outline: none;
  font-family: inherit;
  caret-color: var(--color-primary);
}
.subtask-del {
  flex-shrink: 0;
  background: none;
  border: none;
  color: var(--color-text-secondary);
  font-size: 12px;
  cursor: pointer;
  padding: 4px;
  opacity: 0.4;
  transition: opacity 0.2s;
}
.subtask-del:active {
  opacity: 1;
  color: var(--color-danger);
}
.add-subtask {
  display: flex;
  gap: 8px;
  margin-top: 8px;
}
.add-subtask-input {
  flex: 1;
  font-size: 14px;
  color: var(--color-text);
  background: var(--color-bg-elevated);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm, 8px);
  padding: 8px 12px;
  outline: none;
  font-family: inherit;
  caret-color: var(--color-primary);
  transition: border-color 0.2s;
}
.add-subtask-input:focus {
  border-color: var(--color-primary);
}
.add-subtask-input::placeholder {
  color: var(--color-text-muted);
}
.add-subtask-btn {
  flex-shrink: 0;
  background: var(--color-primary);
  color: var(--color-text-inverse);
  border: none;
  border-radius: var(--radius-sm, 8px);
  padding: 8px 16px;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
}
.add-subtask-btn:active {
  transform: scale(0.96);
}
.ideas-count {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 20px;
  height: 20px;
  border-radius: 10px;
  background: var(--color-primary-light);
  color: var(--color-primary);
  font-size: 12px;
  font-weight: 600;
  padding: 0 6px;
}
.empty-hint {
  font-size: 13px;
  color: var(--color-text-secondary);
  opacity: 0.6;
  text-align: center;
  padding: 12px 0;
}
.ideas-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.idea-item {
  display: flex;
  gap: 10px;
  padding: 10px 12px;
  background: var(--color-bg-elevated, var(--color-bg));
  border-radius: var(--radius-sm, 8px);
  cursor: pointer;
  transition: background 0.15s;
}
.idea-item:active {
  background: var(--color-bg-card);
}
.idea-icon {
  font-size: 16px;
  flex-shrink: 0;
  margin-top: 2px;
}
.idea-content {
  flex: 1;
  min-width: 0;
}
.idea-text {
  font-size: 14px;
  color: var(--color-text);
  line-height: 1.4;
  word-break: break-word;
}
.idea-time {
  font-size: 12px;
  color: var(--color-text-secondary);
  opacity: 0.6;
  margin-top: 4px;
}

/* Delete Button */
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
</style>
