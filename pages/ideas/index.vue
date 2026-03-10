<template>
  <div class="page-container">
    <h1 class="page-title">随手记</h1>

    <!-- Search -->
    <div style="display: flex; gap: 8px; margin-bottom: 12px;">
      <n-input
        v-model:value="searchText"
        placeholder="搜索随手记..."
        clearable
        style="flex: 1;"
        @update:value="debouncedSearch"
      >
        <template #prefix>🔍</template>
      </n-input>
    </div>

    <n-spin v-if="ideasStore.loading" style="display: flex; justify-content: center; padding: 48px 0;" />

    <n-empty v-else-if="ideasStore.ideas.length === 0" description="暂无随手记" style="padding: 48px 0;">
      <template #extra>
        <n-text depth="3">点击底部 ＋ 随时记录灵感</n-text>
      </template>
    </n-empty>

    <!-- Ideas List -->
    <div v-else class="ideas-list">
      <div v-for="idea in ideasStore.ideas" :key="idea.id" class="idea-card" @click="navigateTo(`/ideas/${idea.id}`)">
        <div class="idea-header">
          <span class="idea-source">{{ idea.source === 'voice' ? '🎤' : '📝' }}</span>
          <div class="idea-header-right">
            <span class="idea-time">{{ formatDate(idea.created_at) }}</span>
            <n-popconfirm
              positive-text="删除"
              negative-text="取消"
              @positive-click="deleteIdea(idea.id)"
            >
              <template #trigger>
                <n-button size="tiny" quaternary type="error" @click.stop>删除</n-button>
              </template>
              确认删除该随手记？
            </n-popconfirm>
          </div>
        </div>
        <div class="idea-body">{{ idea.content }}</div>
        <div v-if="idea.todo_id" class="idea-link" @click.stop="navigateTo(`/todo/${idea.todo_id}`)">
          🔗 {{ idea.todo_title || `Todo #${idea.todo_id}` }}
        </div>
      </div>
    </div>

    <!-- Pagination -->
    <n-space v-if="ideasStore.pagination.totalPages > 1" justify="center" style="padding: 16px 0;">
      <n-pagination
        :page="ideasStore.pagination.page"
        :page-count="ideasStore.pagination.totalPages"
        @update:page="changePage"
      />
    </n-space>
  </div>
</template>

<script setup lang="ts">
const ideasStore = useIdeasStore()
const message = useMessage()

const searchText = ref('')

// SSR data fetch
await useAsyncData('ideas-init', async () => {
  await ideasStore.fetchIdeas()
  return true
})

let searchTimer: ReturnType<typeof setTimeout> | null = null
function debouncedSearch() {
  if (searchTimer) clearTimeout(searchTimer)
  searchTimer = setTimeout(() => {
    ideasStore.setFilters({ search: searchText.value || undefined })
    ideasStore.fetchIdeas()
  }, 400)
}

onUnmounted(() => {
  if (searchTimer) clearTimeout(searchTimer)
})

function changePage(page: number) {
  ideasStore.setPage(page)
  ideasStore.fetchIdeas()
}

function formatDate(dateStr: string) {
  const d = new Date(dateStr)
  return `${d.getMonth() + 1}月${d.getDate()}日 ${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`
}

async function deleteIdea(ideaId: number) {
  try {
    await ideasStore.deleteIdea(ideaId)
    message.success('已删除')
  } catch {
    message.error('删除失败')
  }
}
</script>

<style scoped>
.ideas-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.idea-card {
  background: var(--color-bg-card);
  border-radius: var(--radius-md);
  padding: 14px;
  cursor: pointer;
  transition: background var(--transition-fast);
  -webkit-tap-highlight-color: transparent;
}
.idea-card:active {
  background: var(--color-bg-elevated);
}

.idea-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 6px;
}

.idea-header-right {
  display: flex;
  align-items: center;
  gap: 8px;
}

.idea-source {
  font-size: 14px;
}

.idea-time {
  font-size: 12px;
  color: var(--color-text-muted);
}

.idea-body {
  font-size: 15px;
  font-weight: 500;
  line-height: 1.5;
  white-space: pre-wrap;
  word-break: break-word;
  color: var(--color-text);
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.idea-link {
  margin-top: 8px;
  display: inline-block;
  font-size: 12px;
  padding: 3px 10px;
  border-radius: 12px;
  background: var(--color-primary-light);
  color: var(--color-primary);
}

.idea-meta {
  margin-top: 8px;
}
</style>
