<template>
  <n-modal v-model:show="visible" preset="card" title="💡 AI 快速记账" :style="{ maxWidth: '500px', width: '100%' }">
    <template #header-extra>
      <n-tag type="warning" size="small">Premium</n-tag>
    </template>

    <!-- Input -->
    <div class="ai-input-row">
      <n-input
        v-model:value="inputText"
        placeholder="说一句话，比如：昨天星巴克拿铁38"
        :disabled="parsing"
        clearable
        @keyup.enter="handleParse"
      />
      <n-button
        v-if="voiceInput.isSupported.value"
        :type="voiceInput.isListening.value ? 'error' : 'default'"
        :loading="voiceInput.isListening.value"
        style="margin-left: 8px;"
        @click="toggleVoice"
      >
        {{ voiceInput.isListening.value ? '⏹' : '🎤' }}
      </n-button>
    </div>

    <n-button
      type="primary"
      block
      :loading="parsing"
      :disabled="!inputText?.trim()"
      style="margin-top: 12px;"
      @click="handleParse"
    >
      解析
    </n-button>

    <!-- Parse Result -->
    <div v-if="result" class="ai-result">
      <n-divider>AI 解析结果</n-divider>

      <n-form :model="result" label-placement="left" label-width="70">
        <n-form-item label="金额">
          <n-input-number v-model:value="result.amount" :min="0.01" :precision="2" style="width: 100%;" />
        </n-form-item>
        <n-form-item label="类型">
          <n-radio-group v-model:value="result.type">
            <n-radio-button value="expense">支出</n-radio-button>
            <n-radio-button value="income">收入</n-radio-button>
          </n-radio-group>
        </n-form-item>
        <n-form-item label="分类">
          <n-select
            v-model:value="selectedCategoryId"
            :options="categoryOptions"
            placeholder="选择分类"
            clearable
          />
        </n-form-item>
        <n-form-item label="日期">
          <n-date-picker v-model:value="resultDateTs" type="date" style="width: 100%;" />
        </n-form-item>
        <n-form-item label="备注">
          <n-input v-model:value="result.note" placeholder="备注" />
        </n-form-item>
      </n-form>

      <div v-if="result.confidence" class="confidence">
        置信度：{{ Math.round(result.confidence * 100) }}%
      </div>

      <n-button type="primary" block :loading="saving" @click="handleConfirm">
        ✅ 确认入账
      </n-button>
    </div>

    <!-- Error -->
    <n-alert v-if="errorMsg" type="error" style="margin-top: 12px;" closable @close="errorMsg = ''">
      {{ errorMsg }}
    </n-alert>
  </n-modal>
</template>

<script setup lang="ts">
import type { AiQuickEntryResult } from '~/types'

const props = defineProps<{
  show: boolean
}>()

const emit = defineEmits<{
  'update:show': [val: boolean]
  'saved': []
}>()

const visible = computed({
  get: () => props.show,
  set: (val) => emit('update:show', val),
})

const api = useApi()
const message = useMessage()
const financeStore = useFinanceStore()
const voiceInput = useVoiceInput()

const inputText = ref('')
const parsing = ref(false)
const saving = ref(false)
const errorMsg = ref('')
const result = ref<AiQuickEntryResult | null>(null)
const selectedCategoryId = ref<number | null>(null)

// Date as timestamp for n-date-picker
const resultDateTs = computed({
  get: () => result.value ? new Date(result.value.date).getTime() : Date.now(),
  set: (ts) => {
    if (result.value) {
      const d = new Date(ts)
      result.value.date = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    }
  },
})

// Category options based on parsed type
const categoryOptions = computed(() =>
  financeStore.categories
    .filter((c) => c.type === (result.value?.type || 'expense'))
    .map((c) => ({ label: `${c.icon} ${c.name}`, value: c.id })),
)

// Auto-match category by name after parse
function matchCategory() {
  if (!result.value?.category_name) return
  const match = financeStore.categories.find(
    (c) => c.name === result.value!.category_name && c.type === result.value!.type,
  )
  selectedCategoryId.value = match?.id ?? null
}

// Voice input
function toggleVoice() {
  if (voiceInput.isListening.value) {
    voiceInput.stop()
  } else {
    voiceInput.start()
  }
}

// Watch voice transcript → auto fill input and parse
watch(() => voiceInput.transcript.value, (val) => {
  if (val) {
    inputText.value = val
    // Auto-parse after voice input
    handleParse()
  }
})

async function handleParse() {
  if (!inputText.value?.trim() || parsing.value) return

  parsing.value = true
  errorMsg.value = ''
  result.value = null

  try {
    const res = await api.post<AiQuickEntryResult>('/ai/quick-entry', { text: inputText.value.trim() })
    if (res.data) {
      // Post-parse: api returns data directly (not wrapped in data.data)
      result.value = res as any
      // Check if response is wrapped in data
      if ((res as any).amount !== undefined) {
        result.value = res as any
      } else if (res.data) {
        result.value = res.data
      }
      matchCategory()
    }
  } catch (err: any) {
    const msg = err?.response?._data?.message || err?.data?.message || 'AI 解析失败'
    errorMsg.value = msg
  } finally {
    parsing.value = false
  }
}

async function handleConfirm() {
  if (!result.value || saving.value) return

  saving.value = true
  try {
    await financeStore.createRecord({
      type: result.value.type,
      amount: result.value.amount,
      category_id: selectedCategoryId.value ?? undefined,
      record_date: result.value.date,
      note: result.value.note || undefined,
    })
    message.success('记账成功！')
    // Reset
    result.value = null
    inputText.value = ''
    visible.value = false
    emit('saved')
  } catch (err: any) {
    message.error(err?.response?._data?.message || '保存失败')
  } finally {
    saving.value = false
  }
}

// Reset when closed
watch(visible, (v) => {
  if (!v) {
    result.value = null
    inputText.value = ''
    errorMsg.value = ''
    selectedCategoryId.value = null
  }
})
</script>

<style scoped>
.ai-input-row {
  display: flex;
  align-items: center;
}

.ai-result {
  margin-top: 8px;
}

.confidence {
  text-align: right;
  font-size: 12px;
  color: var(--color-text-muted);
  margin-bottom: 12px;
}
</style>
