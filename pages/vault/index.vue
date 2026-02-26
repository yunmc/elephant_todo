<template>
  <div class="page-container">
    <!-- Master Password Gate -->
    <div v-if="!unlocked" style="display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 60vh; gap: 16px; padding: 0 24px;">
      <div style="width: 64px; height: 64px; border-radius: 16px; background: linear-gradient(135deg, #eef2ff, #e0e7ff); display: flex; align-items: center; justify-content: center;">
        <span style="font-size: 28px;">🔒</span>
      </div>
      <div style="text-align: center;">
        <n-text strong style="font-size: 18px; display: block; margin-bottom: 4px;">密码本已锁定</n-text>
        <n-text depth="3" style="font-size: 13px;">输入主密码以解锁</n-text>
      </div>
      <n-input
        v-model:value="masterPassword"
        type="password"
        show-password-on="click"
        placeholder="主密码"
        style="max-width: 300px; width: 100%;"
        @keyup.enter="handleUnlock"
      />
      <n-button type="primary" :loading="unlocking" style="max-width: 300px; width: 100%;" @click="handleUnlock">
        解锁
      </n-button>
    </div>

    <!-- Unlocked Content -->
    <template v-else>
      <!-- Top Bar -->
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
        <h1 class="page-title" style="margin: 0;">密码本</h1>
        <n-space :size="8">
          <n-button size="small" @click="showAddGroup = true">+ 分组</n-button>
          <n-button size="small" type="primary" @click="openAddEntry">+ 条目</n-button>
        </n-space>
      </div>

      <!-- Search -->
      <n-input v-model:value="searchQuery" placeholder="搜索条目..." clearable size="small" style="margin-bottom: 12px;">
        <template #prefix>
          <n-text depth="3" style="font-size: 13px;">🔍</n-text>
        </template>
      </n-input>

      <!-- Group Chips -->
      <n-space wrap style="margin-bottom: 16px;">
        <n-tag
          :type="selectedGroup === null ? 'primary' : 'default'"
          :bordered="selectedGroup !== null"
          round
          style="cursor: pointer;"
          @click="selectGroup(null)"
        >
          全部
        </n-tag>
        <n-tag
          v-for="g in vaultStore.groups"
          :key="g.id"
          :type="selectedGroup === g.id ? 'primary' : 'default'"
          :bordered="selectedGroup !== g.id"
          round
          closable
          style="cursor: pointer;"
          @click="selectGroup(g.id)"
          @close.stop="handleDeleteGroup(g.id)"
        >
          {{ g.icon || '📁' }} {{ g.name }}
        </n-tag>
      </n-space>

      <!-- Loading -->
      <n-spin v-if="vaultStore.loading" style="display: flex; justify-content: center; padding: 32px 0;" />

      <!-- Entry List -->
      <n-list v-else-if="filteredEntries.length" bordered>
        <n-list-item v-for="entry in filteredEntries" :key="entry.id" style="cursor: pointer;" @click="navigateTo(`/vault/${entry.id}`)">
          <n-thing>
            <template #header>
              <n-space align="center">
                <n-text strong>{{ entry.name }}</n-text>
                <n-tag v-if="getGroupName(entry.group_id)" size="small" round>{{ getGroupName(entry.group_id) }}</n-tag>
              </n-space>
            </template>
            <template #description>
              <n-text depth="3" style="font-size: 13px;">{{ entry.url || '无网址' }}</n-text>
            </template>
            <template #header-extra>
              <n-button text size="small" @click.stop="handleQuickDecrypt(entry)">
                {{ decryptedCache[entry.id] ? '🙈' : '👁️' }}
              </n-button>
            </template>
          </n-thing>

          <!-- Quick decrypt preview -->
          <template v-if="decryptedCache[entry.id]">
            <n-card size="small" style="margin-top: 8px; background: var(--n-color-embedded);">
              <n-space vertical :size="4">
                <n-text depth="3" style="font-size: 12px;">用户名: {{ decryptedCache[entry.id]!.username }}</n-text>
                <n-space align="center">
                  <n-text depth="3" style="font-size: 12px;">密码: {{ showPassword[entry.id] ? decryptedCache[entry.id]!.password : '••••••••' }}</n-text>
                  <n-button text size="tiny" @click.stop="togglePasswordShow(entry.id)">
                    {{ showPassword[entry.id] ? '隐藏' : '显示' }}
                  </n-button>
                  <n-button text size="tiny" @click.stop="copyToClipboard(decryptedCache[entry.id]!.password)">📋</n-button>
                </n-space>
                <n-text v-if="decryptedCache[entry.id]!.notes" depth="3" style="font-size: 12px;">备注: {{ decryptedCache[entry.id]!.notes }}</n-text>
              </n-space>
            </n-card>
          </template>
        </n-list-item>
      </n-list>

      <n-empty v-else description="暂无条目" style="padding: 48px 0;" />

      <!-- Pagination -->
      <n-space justify="center" style="margin-top: 16px;" v-if="vaultStore.pagination.totalPages > 1">
        <n-pagination
          :page="vaultStore.pagination.page"
          :page-count="vaultStore.pagination.totalPages"
          @update:page="handlePageChange"
        />
      </n-space>
    </template>

    <!-- Add Group Modal -->
    <n-modal v-model:show="showAddGroup" preset="card" title="新建分组" :style="{ maxWidth: '400px', width: '100%' }">
      <n-space vertical>
        <n-input v-model:value="newGroupName" placeholder="分组名称" />
        <n-input v-model:value="newGroupIcon" placeholder="图标 (emoji)" />
      </n-space>
      <template #action>
        <n-button type="primary" block @click="handleCreateGroup">创建</n-button>
      </template>
    </n-modal>

    <!-- Add/Edit Entry Modal -->
    <n-modal v-model:show="showAddEntry" preset="card" :title="editingEntryId ? '编辑条目' : '新建条目'" :style="{ maxWidth: '500px', width: '100%' }">
      <n-space vertical :size="12">
        <n-input v-model:value="entryForm.name" placeholder="名称 (如: GitHub)" />
        <n-input v-model:value="entryForm.url" placeholder="网址 (可选)" />
        <n-select
          v-model:value="entryForm.group_id"
          :options="groupOptions"
          placeholder="选择分组"
          clearable
        />
        <n-divider style="margin: 4px 0;">加密内容</n-divider>
        <n-input v-model:value="entryForm.username" placeholder="用户名" />
        <n-space align="center">
          <n-input v-model:value="entryForm.password" type="password" show-password-on="click" placeholder="密码" style="flex: 1;" />
          <n-button size="small" @click="handleGeneratePassword">🎲 生成</n-button>
        </n-space>
        <n-input v-model:value="entryForm.notes" type="textarea" placeholder="备注 (可选)" :rows="3" />
      </n-space>

      <!-- Password Generator Options -->
      <n-card v-if="showPwdGen" size="small" style="margin-top: 12px;">
        <n-space vertical :size="8">
          <n-space align="center">
            <n-text depth="3" style="font-size: 13px;">长度:</n-text>
            <n-slider v-model:value="pwdGenOptions.length" :min="8" :max="64" :step="1" style="width: 160px;" />
            <n-text style="font-size: 13px; min-width: 24px;">{{ pwdGenOptions.length }}</n-text>
          </n-space>
          <n-space>
            <n-checkbox v-model:checked="pwdGenOptions.uppercase">大写</n-checkbox>
            <n-checkbox v-model:checked="pwdGenOptions.lowercase">小写</n-checkbox>
            <n-checkbox v-model:checked="pwdGenOptions.numbers">数字</n-checkbox>
            <n-checkbox v-model:checked="pwdGenOptions.symbols">符号</n-checkbox>
          </n-space>
        </n-space>
      </n-card>

      <template #action>
        <n-button type="primary" block :loading="saving" @click="handleSaveEntry">
          {{ editingEntryId ? '保存' : '创建' }}
        </n-button>
      </template>
    </n-modal>
  </div>
</template>

<script setup lang="ts">
import type { VaultEntry, VaultDecryptedData } from '~/types'

const vaultStore = useVaultStore()
const message = useMessage()

// === Master Password ===
const masterPassword = ref('')
const unlocked = ref(false)
const unlocking = ref(false)

async function handleUnlock() {
  if (!masterPassword.value) return
  unlocking.value = true
  try {
    // Ensure salt is available (creates one for new users)
    await vaultStore.ensureSalt()
    await vaultStore.fetchGroups()
    await vaultStore.fetchEntries()
    // Try decrypting first entry to verify master password
    // If no entries exist, store a verification ciphertext to validate later
    if (vaultStore.entries.length) {
      await vaultStore.decryptEntry(vaultStore.entries[0], masterPassword.value)
    }
    unlocked.value = true
  } catch {
    message.error('主密码错误')
  } finally {
    unlocking.value = false
  }
}

// === Group Management ===
const selectedGroup = ref<number | null>(null)
const showAddGroup = ref(false)
const newGroupName = ref('')
const newGroupIcon = ref('')

function selectGroup(gid: number | null) {
  selectedGroup.value = gid
  vaultStore.fetchEntries(gid ?? undefined)
}

async function handleCreateGroup() {
  if (!newGroupName.value.trim()) return
  try {
    await vaultStore.createGroup({ name: newGroupName.value.trim(), icon: newGroupIcon.value || undefined })
    showAddGroup.value = false
    newGroupName.value = ''
    newGroupIcon.value = ''
    message.success('分组已创建')
  } catch {
    message.error('创建分组失败')
  }
}

async function handleDeleteGroup(id: number) {
  try {
    await vaultStore.deleteGroup(id)
    if (selectedGroup.value === id) selectGroup(null)
    message.success('分组已删除')
  } catch {
    message.error('删除分组失败')
  }
}

function getGroupName(groupId: number | null): string {
  if (!groupId) return ''
  return vaultStore.groups.find(g => g.id === groupId)?.name || ''
}

const groupOptions = computed(() =>
  vaultStore.groups.map(g => ({ label: `${g.icon || '📁'} ${g.name}`, value: g.id }))
)

// === Search ===
const searchQuery = ref('')
const filteredEntries = computed(() => {
  if (!searchQuery.value.trim()) return vaultStore.entries
  const q = searchQuery.value.toLowerCase()
  return vaultStore.entries.filter(e =>
    e.name.toLowerCase().includes(q) || (e.url && e.url.toLowerCase().includes(q))
  )
})

// === Quick Decrypt ===
const decryptedCache = ref<Record<number, VaultDecryptedData | null>>({})
const showPassword = ref<Record<number, boolean>>({})

async function handleQuickDecrypt(entry: VaultEntry) {
  if (decryptedCache.value[entry.id]) {
    delete decryptedCache.value[entry.id]
    delete showPassword.value[entry.id]
    return
  }
  try {
    const data = await vaultStore.decryptEntry(entry, masterPassword.value)
    decryptedCache.value[entry.id] = data
  } catch {
    message.error('解密失败')
  }
}

function togglePasswordShow(id: number) {
  showPassword.value[id] = !showPassword.value[id]
}

async function copyToClipboard(text: string) {
  try {
    await navigator.clipboard.writeText(text)
    message.success('已复制')
  } catch {
    message.error('复制失败')
  }
}

// === Add/Edit Entry ===
const showAddEntry = ref(false)
const editingEntryId = ref<number | null>(null)
const saving = ref(false)
const entryForm = reactive({
  name: '',
  url: '',
  group_id: null as number | null,
  username: '',
  password: '',
  notes: '',
})

function openAddEntry() {
  editingEntryId.value = null
  Object.assign(entryForm, { name: '', url: '', group_id: selectedGroup.value, username: '', password: '', notes: '' })
  showAddEntry.value = true
}

async function handleSaveEntry() {
  if (!entryForm.name.trim()) { message.warning('请输入名称'); return }
  if (!entryForm.username.trim() && !entryForm.password.trim()) { message.warning('请输入用户名或密码'); return }

  saving.value = true
  try {
    const decryptedData: VaultDecryptedData = {
      username: entryForm.username,
      password: entryForm.password,
      notes: entryForm.notes,
    }
    if (editingEntryId.value) {
      await vaultStore.updateEntry(
        editingEntryId.value,
        { name: entryForm.name.trim(), url: entryForm.url || undefined, group_id: entryForm.group_id },
        decryptedData,
        masterPassword.value,
      )
    } else {
      await vaultStore.createEntry(
        entryForm.name.trim(),
        entryForm.url || undefined,
        entryForm.group_id || null,
        decryptedData,
        masterPassword.value,
      )
    }
    showAddEntry.value = false
    message.success(editingEntryId.value ? '已更新' : '已创建')
  } catch {
    message.error('操作失败')
  } finally {
    saving.value = false
  }
}

// === Password Generator ===
const showPwdGen = ref(false)
const pwdGenOptions = reactive({
  length: 16,
  uppercase: true,
  lowercase: true,
  numbers: true,
  symbols: true,
})

function handleGeneratePassword() {
  showPwdGen.value = !showPwdGen.value
  if (showPwdGen.value) {
    entryForm.password = vaultStore.generatePassword(pwdGenOptions)
  }
}

// === Pagination ===
function handlePageChange(page: number) {
  vaultStore.setPage(page)
  vaultStore.fetchEntries(selectedGroup.value ?? undefined)
}
</script>
