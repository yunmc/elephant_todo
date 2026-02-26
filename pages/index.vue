<template>
  <div class="page-container">
    <h1 class="page-title">待办事项</h1>

    <!-- Status Tabs -->
    <n-tabs v-model:value="currentTab" type="segment" @update:value="handleTabChange" style="margin-bottom: 12px;">
      <n-tab name="pending">进行中</n-tab>
      <n-tab name="completed">已完成</n-tab>
      <n-tab name="all">全部</n-tab>
    </n-tabs>

    <!-- Search + Filter -->
    <div style="display: flex; gap: 8px; margin-bottom: 12px;">
      <n-input
        v-model:value="searchText"
        placeholder="搜索待办..."
        clearable
        style="flex: 1;"
        @update:value="debouncedSearch"
      >
        <template #prefix>🔍</template>
      </n-input>
      <n-button @click="showFilters = !showFilters" :type="activeFilterCount ? 'primary' : 'default'" :ghost="!!activeFilterCount" style="flex-shrink: 0;">
        筛选{{ activeFilterCount ? ` (${activeFilterCount})` : '' }}
      </n-button>
    </div>

    <!-- Filters Panel -->
    <div v-show="showFilters" style="margin-bottom: 12px;">
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px;">
        <n-select v-model:value="filterPriority" placeholder="优先级" :options="priorityOptions" clearable @update:value="handleFilterChange" />
        <n-select v-model:value="filterDue" placeholder="日期" :options="dueOptions" clearable @update:value="handleFilterChange" />
        <n-select v-model:value="filterCategory" placeholder="分类" :options="categoryOptions" clearable @update:value="handleFilterChange" />
        <n-select v-model:value="filterTag" placeholder="标签" :options="tagOptions" clearable @update:value="handleFilterChange" />
      </div>
      <n-button v-if="activeFilterCount" text size="small" type="primary" style="margin-top: 6px;" @click="resetFilters">
        重置全部筛选
      </n-button>
    </div>

    <!-- Loading -->
    <n-spin v-if="todosStore.loading" style="display: flex; justify-content: center; padding: 48px 0;" />

    <!-- Empty -->
    <n-empty v-else-if="todosStore.todos.length === 0" description="暂无待办事项" style="padding: 48px 0;">
      <template #extra>
        <n-text depth="3">点击底部 ＋ 添加</n-text>
      </template>
    </n-empty>

    <!-- Todo List -->
    <div v-else class="todo-list">
      <div v-for="todo in todosStore.todos" :key="todo.id" class="todo-item" @click="navigateTo(`/todo/${todo.id}`)">
        <div class="todo-check" @click.stop="todosStore.toggleTodo(todo.id)">
          <div class="check-circle" :class="{ checked: todo.status === 'completed' }">
            <span v-if="todo.status === 'completed'">✓</span>
          </div>
        </div>
        <div class="todo-content">
          <div class="todo-title" :class="{ 'status-completed': todo.status === 'completed' }">{{ todo.title }}</div>
          <div class="todo-meta" v-if="currentTab === 'all' || todo.priority || todo.due_date || todo.category_name">
            <span v-if="currentTab === 'all'" class="status-tag" :class="todo.status === 'completed' ? 'status-done' : 'status-pending'">
              {{ todo.status === 'completed' ? '已完成' : '进行中' }}
            </span>
            <span v-if="todo.priority" class="meta-tag" :class="`priority-${todo.priority}`">
              {{ priorityLabel(todo.priority) }}
            </span>
            <span v-if="todo.due_date" class="meta-tag" :class="{ overdue: isOverdue(todo.due_date) }">
              {{ formatDate(todo.due_date) }}
            </span>
            <span v-if="todo.category_name" class="meta-tag category" :style="{ color: todo.category_color }">
              {{ todo.category_name }}
            </span>
          </div>
          <div class="todo-tags" v-if="todo.tags && todo.tags.length">
            <span v-for="tag in todo.tags" :key="tag.id" class="tag-chip">{{ tag.name }}</span>
          </div>
        </div>
        <div class="todo-actions">
          <n-popconfirm
            positive-text="删除"
            negative-text="取消"
            @positive-click="deleteTodo(todo.id)"
          >
            <template #trigger>
              <n-button size="tiny" quaternary type="error" @click.stop>删除</n-button>
            </template>
            确认删除该待办？
          </n-popconfirm>
        </div>
        <div v-if="todo.ideas_count" class="todo-badge">{{ todo.ideas_count }}</div>
      </div>
    </div>

    <!-- Pagination -->
    <n-space v-if="todosStore.pagination.totalPages > 1" justify="center" style="padding: 16px 0;">
      <n-pagination
        :page="todosStore.pagination.page"
        :page-count="todosStore.pagination.totalPages"
        @update:page="changePage"
      />
    </n-space>
  </div>
</template>

<script setup lang="ts">
const todosStore = useTodosStore()
const categoriesStore = useCategoriesStore()
const tagsStore = useTagsStore()

const searchText = ref('')
const currentTab = ref('pending')
const showFilters = ref(false)
const filterPriority = ref<string | null>(null)
const filterDue = ref<string | null>(null)
const filterCategory = ref<number | null>(null)
const filterTag = ref<number | null>(null)

const activeFilterCount = computed(() =>
  [filterPriority.value, filterDue.value, filterCategory.value, filterTag.value].filter(Boolean).length
)

const priorityOptions = [
  { label: '高', value: 'high' },
  { label: '中', value: 'medium' },
  { label: '低', value: 'low' },
]

const dueOptions = [
  { label: '今天', value: 'today' },
  { label: '本周', value: 'week' },
  { label: '已过期', value: 'overdue' },
]

const categoryOptions = computed(() =>
  categoriesStore.categories.map(c => ({ label: c.name, value: c.id }))
)

const tagOptions = computed(() =>
  tagsStore.tags.map(t => ({ label: t.name, value: t.id }))
)

// SSR data fetch
await useAsyncData('todos-init', async () => {
  await Promise.all([
    todosStore.fetchTodos(),
    categoriesStore.fetchCategories(),
    tagsStore.fetchTags(),
  ])
  return true
})

// Search debounce
let searchTimer: ReturnType<typeof setTimeout> | null = null
function debouncedSearch() {
  if (searchTimer) clearTimeout(searchTimer)
  searchTimer = setTimeout(() => {
    todosStore.setFilters({ search: searchText.value || undefined })
    todosStore.fetchTodos()
  }, 400)
}

function handleTabChange(tab: string) {
  todosStore.setFilters({ status: tab === 'all' ? undefined : tab as any })
  todosStore.fetchTodos()
}

function handleFilterChange() {
  todosStore.setFilters({
    priority: filterPriority.value || undefined,
    due_filter: filterDue.value as any || undefined,
    category_id: filterCategory.value || undefined,
    tag_id: filterTag.value || undefined,
  })
  todosStore.fetchTodos()
}

function resetFilters() {
  filterPriority.value = null
  filterDue.value = null
  filterCategory.value = null
  filterTag.value = null
  handleFilterChange()
}

function changePage(page: number) {
  todosStore.setPage(page)
  todosStore.fetchTodos()
}

function priorityLabel(p: string) {
  return { high: '高', medium: '中', low: '低' }[p] || p
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr)
  return `${d.getMonth() + 1}月${d.getDate()}日`
}

function isOverdue(dateStr: string): boolean {
  return new Date(dateStr) < new Date(new Date().toDateString())
}

async function deleteTodo(todoId: number) {
  await todosStore.deleteTodo(todoId)
}
</script>

<style lang="scss" scoped>
.todo-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.todo-item {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 14px;
  background: var(--color-bg-card);
  border-radius: var(--radius-md);
  cursor: pointer;
  transition: background var(--transition-fast);
  -webkit-tap-highlight-color: transparent;

  &:active {
    background: var(--color-bg-elevated);
  }
}

.todo-check {
  flex-shrink: 0;
  padding-top: 2px;
}

.check-circle {
  width: 22px;
  height: 22px;
  border-radius: 50%;
  border: 2px solid var(--color-border);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  color: #fff;
  transition: all var(--transition-fast);

  &.checked {
    background: var(--color-success);
    border-color: var(--color-success);
  }
}

.todo-content {
  flex: 1;
  min-width: 0;
}

.todo-actions {
  flex-shrink: 0;
  display: flex;
  align-items: flex-start;
  padding-top: 2px;
}

.todo-title {
  font-size: 15px;
  font-weight: 500;
  line-height: 1.4;
  word-break: break-word;
}

.todo-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 6px;
}

.meta-tag {
  font-size: 11px;
  padding: 2px 8px;
  border-radius: 4px;
  background: var(--color-bg-elevated);
  color: var(--color-text-secondary);

  &.priority-high { color: var(--color-danger); background: rgba(239, 68, 68, 0.1); }
  &.priority-medium { color: var(--color-warning); background: rgba(245, 158, 11, 0.1); }
  &.priority-low { color: var(--color-text-muted); }
  &.overdue { color: var(--color-danger); background: rgba(239, 68, 68, 0.1); }
  &.category { background: rgba(99, 102, 241, 0.1); }
}

.todo-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  margin-top: 4px;
}

.tag-chip {
  font-size: 10px;
  padding: 1px 6px;
  border-radius: 4px;
  background: rgba(99, 102, 241, 0.12);
  color: var(--color-primary);
}

.todo-badge {
  flex-shrink: 0;
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background: var(--color-primary);
  color: #fff;
  font-size: 11px;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-top: 2px;
}
</style>
