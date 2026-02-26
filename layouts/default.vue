<template>
  <div class="app-layout">
    <main class="app-main">
      <slot />
    </main>

    <!-- Bottom Tab Navigation -->
    <nav class="bottom-nav">
      <NuxtLink to="/" class="nav-item" :class="{ active: route.path === '/' }">
        <span class="nav-icon">✅</span>
        <span class="nav-label">待办</span>
      </NuxtLink>

      <NuxtLink to="/ideas" class="nav-item" :class="{ active: route.path.startsWith('/ideas') }">
        <span class="nav-icon">💡</span>
        <span class="nav-label">随手记</span>
      </NuxtLink>

      <button class="nav-item nav-add" @click="openAddModal">
        <span class="nav-add-icon">＋</span>
      </button>

      <NuxtLink to="/vault" class="nav-item" :class="{ active: route.path.startsWith('/vault') }">
        <span class="nav-icon">🔐</span>
        <span class="nav-label">密码本</span>
      </NuxtLink>

      <NuxtLink to="/settings" class="nav-item" :class="{ active: route.path === '/settings' }">
        <span class="nav-icon">⚙️</span>
        <span class="nav-label">设置</span>
      </NuxtLink>
    </nav>

    <!-- Quick Add Modal -->
    <n-modal v-model:show="showAddModal" preset="card" title="快速添加" :style="{ maxWidth: '500px', width: '100%' }" :segmented="{ content: true }">
      <n-input
        v-model:value="inputText"
        type="textarea"
        placeholder="输入内容..."
        :rows="3"
        autofocus
      />

      <div v-if="voiceInput.isSupported.value" style="margin-top: 12px; text-align: center;">
        <n-button
          :type="voiceInput.isListening.value ? 'error' : 'default'"
          round
          @mousedown="voiceInput.start()"
          @mouseup="voiceInput.stop()"
          @touchstart.prevent="voiceInput.start()"
          @touchend.prevent="voiceInput.stop()"
        >
          🎤 {{ voiceInput.isListening.value ? '松开结束' : '按住说话' }}
        </n-button>
      </div>

      <!-- Similar todos (LLM suggested) -->
      <div v-if="suggestLoading" style="margin-top: 16px; text-align: center;">
        <n-spin size="small" />
        <n-text depth="3" style="font-size: 12px; margin-left: 8px;">AI 分析中...</n-text>
      </div>
      <div v-if="similarTodos.length > 0 && !suggestLoading" style="margin-top: 12px;">
        <n-text depth="3" style="font-size: 13px;">可能相似的待办：</n-text>
        <div style="margin-top: 8px; display: flex; flex-direction: column; gap: 6px;">
          <div
            v-for="todo in similarTodos"
            :key="todo.id"
            style="padding: 10px 12px; background: var(--color-bg-elevated); border-radius: 8px; cursor: pointer; transition: background 0.15s;"
            @click="linkToExisting(todo.id)"
          >
            <div style="font-size: 14px; font-weight: 500; color: var(--color-text);">{{ todo.title }}</div>
            <div style="font-size: 12px; color: var(--color-text-secondary); margin-top: 2px;">{{ todo.reason }}</div>
          </div>
        </div>
      </div>

      <template #action>
        <n-space>
          <n-button type="primary" @click="saveAsTodo" :disabled="!inputText.trim()">新建待办</n-button>
          <n-button @click="saveAsIdea" :disabled="!inputText.trim()">保存为随手记</n-button>
        </n-space>
      </template>
    </n-modal>
  </div>
</template>

<script setup lang="ts">
import type { SimilarTodo } from '~/types'

const route = useRoute()
const todosStore = useTodosStore()
const ideasStore = useIdeasStore()

const showAddModal = ref(false)
const inputText = ref('')
const similarTodos = ref<SimilarTodo[]>([])
const suggestLoading = ref(false)
const voiceInput = useVoiceInput()

// Watch voice transcript to fill input
watch(() => voiceInput.transcript.value, (val) => {
  if (val) inputText.value = val
})

function openAddModal() {
  showAddModal.value = true
}

// Watch input for LLM smart suggest (debounce 1200ms)
let matchTimer: ReturnType<typeof setTimeout> | null = null
watch(inputText, (val) => {
  if (matchTimer) clearTimeout(matchTimer)
  if (!val.trim() || val.trim().length < 2) {
    similarTodos.value = []
    suggestLoading.value = false
    return
  }
  suggestLoading.value = true
  matchTimer = setTimeout(async () => {
    try {
      const result = await ideasStore.smartSuggest(val.trim())
      similarTodos.value = result.similar_todos || []
    } catch {
      similarTodos.value = []
    } finally {
      suggestLoading.value = false
    }
  }, 1200)
})

async function saveAsTodo() {
  if (!inputText.value.trim()) return
  await todosStore.createTodo({
    title: inputText.value.trim(),
  })
  resetAndClose()
}

async function saveAsIdea() {
  if (!inputText.value.trim()) return
  const source = voiceInput.transcript.value ? 'voice' : 'text'
  await ideasStore.createIdea({ content: inputText.value.trim(), source })
  resetAndClose()
}

async function linkToExisting(todoId: number) {
  if (!inputText.value.trim()) return
  const source = voiceInput.transcript.value ? 'voice' : 'text'
  await ideasStore.createIdea({
    content: inputText.value.trim(),
    source,
    todo_id: todoId,
  })
  resetAndClose()
}

function resetAndClose() {
  inputText.value = ''
  similarTodos.value = []
  suggestLoading.value = false
  showAddModal.value = false
}
</script>

<style lang="scss" scoped>
.app-layout {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
}

.app-main {
  flex: 1;
  padding-bottom: calc(var(--bottom-tab-height) + var(--safe-area-bottom));
}

// ---------- Bottom Nav ----------
.bottom-nav {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  height: calc(var(--bottom-tab-height) + var(--safe-area-bottom));
  padding-bottom: var(--safe-area-bottom);
  background: var(--color-bg-nav);
  backdrop-filter: saturate(180%) blur(20px);
  -webkit-backdrop-filter: saturate(180%) blur(20px);
  border-top: 0.5px solid var(--color-border);
  display: flex;
  align-items: center;
  justify-content: space-around;
  z-index: 100;
}

.nav-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  flex: 1;
  min-height: 48px;
  color: var(--color-text-muted);
  text-decoration: none;
  gap: 2px;
  background: none;
  border: none;
  cursor: pointer;
  transition: color var(--transition-fast);
  -webkit-tap-highlight-color: transparent;

  &.active {
    color: var(--color-primary);
  }
}

.nav-icon {
  font-size: 20px;
  line-height: 1;
}

.nav-label {
  font-size: 10px;
  font-weight: 500;
}

.nav-add {
  position: relative;
}

.nav-add-icon {
  width: 46px;
  height: 46px;
  border-radius: 50%;
  background: linear-gradient(135deg, var(--color-primary), #818cf8);
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 24px;
  line-height: 1;
  box-shadow: 0 4px 12px rgba(99, 102, 241, 0.35);
  transition: transform var(--transition-fast), box-shadow var(--transition-fast);

  &:active {
    transform: scale(0.92);
  }
}
</style>
