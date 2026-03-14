<template>
  <div class="attachment-section">
    <div class="section-title">
      附件
      <span v-if="attachments.length" class="att-count">{{ attachments.length }}/3</span>
    </div>

    <!-- Attachment Grid -->
    <div v-if="attachments.length || uploading" class="att-grid">
      <div v-for="att in attachments" :key="att.id" class="att-item" @click="handlePreview(att)">
        <!-- Image preview -->
        <img v-if="isImage(att.mime_type)" :src="att.url" :alt="att.filename" class="att-thumb" loading="lazy" />
        <!-- File icon -->
        <div v-else class="att-file">
          <span class="att-file-icon">{{ fileIcon(att.mime_type) }}</span>
          <span class="att-file-name">{{ att.filename }}</span>
        </div>
        <!-- Delete button -->
        <button class="att-del" @click.stop="handleDelete(att)" title="删除">✕</button>
      </div>

      <!-- Uploading indicator -->
      <div v-if="uploading" class="att-item uploading">
        <n-spin size="small" />
        <span class="uploading-text">上传中...</span>
      </div>
    </div>

    <!-- Empty + Add -->
    <div v-if="!attachments.length && !uploading" class="att-empty">
      暂无附件
    </div>

    <!-- Upload Button -->
    <button
      v-if="attachments.length < 3 && !uploading"
      class="att-add-btn"
      @click="triggerUpload"
    >
      📎 添加附件
    </button>

    <!-- Hidden file input -->
    <input
      ref="fileInputRef"
      type="file"
      accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt,.csv"
      style="display: none;"
      @change="handleFileChange"
    />

    <!-- Image Preview Modal -->
    <ClientOnly>
      <n-modal v-model:show="showPreview" preset="card" title="预览" :style="{ maxWidth: '90vw', width: 'auto' }">
        <img v-if="previewUrl" :src="previewUrl" :alt="previewName" style="max-width: 100%; max-height: 70vh; border-radius: 8px;" />
      </n-modal>
    </ClientOnly>
  </div>
</template>

<script setup lang="ts">
import type { Attachment } from '~/types'

const props = defineProps<{
  targetType: 'finance_record' | 'idea' | 'todo'
  targetId: number
}>()

const { upload, list, remove } = useAttachment()
const message = useMessage()

const attachments = ref<Attachment[]>([])
const uploading = ref(false)
const fileInputRef = ref<HTMLInputElement | null>(null)
const showPreview = ref(false)
const previewUrl = ref('')
const previewName = ref('')

// Load attachments
async function loadAttachments() {
  if (!props.targetId) return
  try {
    attachments.value = await list(props.targetType, props.targetId)
  } catch {
    attachments.value = []
  }
}

watch(() => props.targetId, (id) => {
  if (id) loadAttachments()
}, { immediate: true })

function triggerUpload() {
  fileInputRef.value?.click()
}

async function handleFileChange(e: Event) {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return
  input.value = '' // reset

  if (attachments.value.length >= 3) {
    message.warning('每条记录最多 3 个附件')
    return
  }

  uploading.value = true
  try {
    const att = await upload(file, props.targetType, props.targetId)
    attachments.value.push(att)
    message.success('上传成功')
  } catch (err: any) {
    const msg = err?.data?.message || err?.message || '上传失败'
    if (msg.includes('PREMIUM_REQUIRED') || msg.includes('会员')) {
      // useApi already shows PremiumModal for 403
    } else {
      message.error(msg)
    }
  } finally {
    uploading.value = false
  }
}

async function handleDelete(att: Attachment) {
  try {
    await remove(att.id)
    attachments.value = attachments.value.filter(a => a.id !== att.id)
    message.success('已删除')
  } catch (err: any) {
    const msg = err?.data?.message || '删除失败'
    if (!msg.includes('PREMIUM_REQUIRED')) {
      message.error(msg)
    }
  }
}

function handlePreview(att: Attachment) {
  if (isImage(att.mime_type)) {
    previewUrl.value = att.url
    previewName.value = att.filename
    showPreview.value = true
  } else {
    // Open file in new tab
    window.open(att.url, '_blank')
  }
}

function isImage(mimeType: string) {
  return mimeType.startsWith('image/')
}

function fileIcon(mimeType: string) {
  if (mimeType.includes('pdf')) return '📄'
  if (mimeType.includes('word') || mimeType.includes('document')) return '📝'
  if (mimeType.includes('sheet') || mimeType.includes('excel')) return '📊'
  if (mimeType.includes('text')) return '📃'
  return '📎'
}
</script>

<style scoped>
.attachment-section {
  background: var(--color-bg-card);
  border-radius: var(--radius-md, 12px);
  padding: 16px;
  margin-bottom: 16px;
}

.section-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--color-text-secondary);
  margin-bottom: 12px;
  display: flex;
  align-items: center;
  gap: 6px;
}

.att-count {
  font-size: 12px;
  font-weight: 400;
  color: var(--color-text-muted);
}

.att-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px;
  margin-bottom: 12px;
}

.att-item {
  position: relative;
  aspect-ratio: 1;
  border-radius: var(--radius-sm, 8px);
  overflow: hidden;
  cursor: pointer;
  background: var(--color-bg);
  border: 1px solid var(--color-border, rgba(0, 0, 0, 0.06));
  transition: transform 0.15s;
}

.att-item:active {
  transform: scale(0.96);
}

.att-thumb {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.att-file {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  padding: 8px;
  text-align: center;
  gap: 4px;
}

.att-file-icon {
  font-size: 28px;
}

.att-file-name {
  font-size: 10px;
  color: var(--color-text-secondary);
  word-break: break-all;
  overflow: hidden;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
}

.att-del {
  position: absolute;
  top: 4px;
  right: 4px;
  width: 22px;
  height: 22px;
  border-radius: 50%;
  border: none;
  background: rgba(0, 0, 0, 0.55);
  color: #fff;
  font-size: 11px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: 0;
  transition: opacity 0.2s;
}

.att-item:hover .att-del {
  opacity: 1;
}

/* On touch devices, always show delete button */
@media (hover: none) {
  .att-del {
    opacity: 1;
  }
}

.att-item.uploading {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 6px;
}

.uploading-text {
  font-size: 11px;
  color: var(--color-text-muted);
}

.att-empty {
  font-size: 13px;
  color: var(--color-text-muted);
  text-align: center;
  padding: 12px 0;
}

.att-add-btn {
  display: block;
  width: 100%;
  padding: 10px;
  border: 1px dashed var(--color-text-muted);
  border-radius: var(--radius-sm, 8px);
  background: transparent;
  color: var(--color-text-secondary);
  font-size: 13px;
  cursor: pointer;
  transition: all 0.2s;
  min-height: 44px;
}

.att-add-btn:active {
  transform: scale(0.97);
  background: var(--color-bg);
}
</style>
