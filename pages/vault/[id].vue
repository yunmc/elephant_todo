<template>
  <div class="page-container">
    <div class="detail-header">
      <n-button text @click="navigateTo('/vault')">← 返回</n-button>
      <n-space :size="8">
        <n-button size="small" @click="openEdit">编辑</n-button>
        <n-popconfirm @positive-click="handleDelete">
          <template #trigger>
            <n-button size="small" type="error" ghost>删除</n-button>
          </template>
          确定删除此条目吗？
        </n-popconfirm>
      </n-space>
    </div>

    <!-- Need master password -->
    <div v-if="!masterPassword" style="display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 40vh; gap: 16px; padding: 0 24px;">
      <div style="width: 64px; height: 64px; border-radius: 16px; background: linear-gradient(135deg, #eef2ff, #e0e7ff); display: flex; align-items: center; justify-content: center;">
        <span style="font-size: 28px;">🔒</span>
      </div>
      <div style="text-align: center;">
        <n-text strong style="font-size: 18px; display: block; margin-bottom: 4px;">需要验证</n-text>
        <n-text depth="3" style="font-size: 13px;">输入主密码查看详情</n-text>
      </div>
      <n-input
        v-model:value="inputPassword"
        type="password"
        show-password-on="click"
        placeholder="主密码"
        style="max-width: 300px; width: 100%;"
        @keyup.enter="handleUnlock"
      />
      <n-button type="primary" style="max-width: 300px; width: 100%;" @click="handleUnlock">解锁</n-button>
    </div>

    <template v-else>
      <n-spin v-if="loading" style="display: flex; justify-content: center; padding: 48px 0;" />

      <template v-else-if="entry">
        <div class="section-card">
        <n-card>
          <template #header>
            <n-space align="center">
              <n-text strong style="font-size: 18px;">{{ entry.name }}</n-text>
              <n-tag v-if="groupName" size="small" round>{{ groupName }}</n-tag>
            </n-space>
          </template>

          <n-descriptions bordered :column="1" label-placement="left">
            <n-descriptions-item label="网址">
              <a v-if="entry.url" :href="entry.url" target="_blank" rel="noopener" style="color: var(--n-text-color);">{{ entry.url }}</a>
              <n-text v-else depth="3">未设置</n-text>
            </n-descriptions-item>
          </n-descriptions>
        </n-card>
        </div>

        <!-- Decrypted Data -->
        <div class="section-card" v-if="decryptedData">
        <n-card title="账户信息">
          <n-descriptions bordered :column="1" label-placement="left">
            <n-descriptions-item label="用户名">
              <n-space align="center">
                <n-text>{{ decryptedData.username || '未设置' }}</n-text>
                <n-button text size="tiny" @click="copyToClipboard(decryptedData.username)">📋</n-button>
              </n-space>
            </n-descriptions-item>
            <n-descriptions-item label="密码">
              <n-space align="center">
                <n-text>{{ showPwd ? decryptedData.password : '••••••••' }}</n-text>
                <n-button text size="tiny" @click="showPwd = !showPwd">{{ showPwd ? '🙈' : '👁️' }}</n-button>
                <n-button text size="tiny" @click="copyToClipboard(decryptedData.password)">📋</n-button>
              </n-space>
            </n-descriptions-item>
            <n-descriptions-item label="备注">
              <n-text style="white-space: pre-wrap;">{{ decryptedData.notes || '无' }}</n-text>
            </n-descriptions-item>
          </n-descriptions>
        </n-card>
        </div>

        <n-card v-else style="margin-top: 16px;">
          <n-spin style="display: flex; justify-content: center; padding: 24px 0;" />
        </n-card>

        <n-text depth="3" style="display: block; text-align: center; margin-top: 16px; font-size: 12px;">
          创建于 {{ formatDate(entry.created_at) }} · 更新于 {{ formatDate(entry.updated_at) }}
        </n-text>
      </template>
    </template>

    <!-- Edit Modal -->
    <n-modal v-model:show="showEdit" preset="card" title="编辑条目" :style="{ maxWidth: '500px', width: '100%' }">
      <n-space vertical :size="12">
        <n-input v-model:value="editForm.name" placeholder="名称" />
        <n-input v-model:value="editForm.url" placeholder="网址 (可选)" />
        <n-select v-model:value="editForm.group_id" :options="groupOptions" placeholder="分组" clearable />
        <n-divider style="margin: 4px 0;">加密内容</n-divider>
        <n-input v-model:value="editForm.username" placeholder="用户名" />
        <n-input v-model:value="editForm.password" type="password" show-password-on="click" placeholder="密码" />
        <n-input v-model:value="editForm.notes" type="textarea" placeholder="备注" :rows="3" />
      </n-space>
      <template #action>
        <n-button type="primary" block :loading="saving" @click="handleSave">保存</n-button>
      </template>
    </n-modal>
  </div>
</template>

<script setup lang="ts">
import type { VaultEntry, VaultDecryptedData } from '~/types'

const route = useRoute()
const vaultStore = useVaultStore()
const message = useMessage()

const entryId = Number(route.params.id)
const entry = ref<VaultEntry | null>(null)
const decryptedData = ref<VaultDecryptedData | null>(null)
const loading = ref(false)
const showPwd = ref(false)

// Master password (passed via query or needs re-entry)
const masterPassword = ref('')
const inputPassword = ref('')

async function handleUnlock() {
  if (!inputPassword.value) return
  masterPassword.value = inputPassword.value
  await loadEntry()
}

async function loadEntry() {
  loading.value = true
  try {
    await vaultStore.fetchGroups()
    await vaultStore.fetchEntries()
    entry.value = vaultStore.entries.find(e => e.id === entryId) || null
    if (entry.value && masterPassword.value) {
      decryptedData.value = await vaultStore.decryptEntry(entry.value, masterPassword.value)
    }
  } catch {
    message.error('加载失败，请检查主密码')
    masterPassword.value = ''
  } finally {
    loading.value = false
  }
}

const groupName = computed(() => {
  if (!entry.value?.group_id) return ''
  return vaultStore.groups.find(g => g.id === entry.value!.group_id)?.name || ''
})

const groupOptions = computed(() =>
  vaultStore.groups.map(g => ({ label: `${g.icon || '📁'} ${g.name}`, value: g.id }))
)

// === Edit ===
const showEdit = ref(false)
const saving = ref(false)
const editForm = reactive({
  name: '',
  url: '',
  group_id: null as number | null,
  username: '',
  password: '',
  notes: '',
})

function openEdit() {
  if (!entry.value || !decryptedData.value) return
  Object.assign(editForm, {
    name: entry.value.name,
    url: entry.value.url || '',
    group_id: entry.value.group_id,
    username: decryptedData.value.username,
    password: decryptedData.value.password,
    notes: decryptedData.value.notes,
  })
  showEdit.value = true
}

async function handleSave() {
  if (!editForm.name.trim()) return
  saving.value = true
  try {
    const decData: VaultDecryptedData = {
      username: editForm.username,
      password: editForm.password,
      notes: editForm.notes,
    }
    await vaultStore.updateEntry(
      entryId,
      { name: editForm.name.trim(), url: editForm.url || undefined, group_id: editForm.group_id },
      decData,
      masterPassword.value,
    )
    showEdit.value = false
    await loadEntry()
    message.success('已保存')
  } catch {
    message.error('保存失败')
  } finally {
    saving.value = false
  }
}

async function handleDelete() {
  await vaultStore.deleteEntry(entryId)
  navigateTo('/vault')
}

async function copyToClipboard(text: string) {
  try {
    await navigator.clipboard.writeText(text)
    message.success('已复制')
  } catch {
    message.error('复制失败')
  }
}

function formatDate(dateStr: string) {
  const d = new Date(dateStr)
  return `${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, '0')}-${d.getDate().toString().padStart(2, '0')} ${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`
}

// If vault already unlocked (groups loaded), auto-load
onMounted(async () => {
  if (vaultStore.groups.length && vaultStore.entries.length) {
    // Already unlocked in a previous session - but we still need master password
    // User must enter master password to view decrypted data
  }
})
</script>
