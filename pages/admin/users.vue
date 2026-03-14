<template>
  <div>
    <!-- Search & Filter Bar -->
    <div class="toolbar">
      <n-input v-model:value="search" placeholder="搜索用户名或邮箱" clearable style="width: 260px;" @update:value="debouncedLoad">
        <template #prefix>🔍</template>
      </n-input>
      <n-select v-model:value="planFilter" :options="planOptions" placeholder="会员筛选" clearable style="width: 140px;" @update:value="loadUsers" />
    </div>

    <!-- Users Table -->
    <n-data-table
      :columns="columns"
      :data="users"
      :loading="loading"
      :bordered="false"
      :pagination="pagination"
      remote
      @update:page="handlePageChange"
    />

    <!-- User Detail / Edit Modal -->
    <n-modal v-model:show="showDetail" preset="card" title="用户详情" style="max-width: 500px;" :segmented="{ content: true }">
      <template v-if="selectedUser">
        <n-descriptions :column="1" label-placement="left" bordered size="small">
          <n-descriptions-item label="ID">{{ selectedUser.id }}</n-descriptions-item>
          <n-descriptions-item label="用户名">{{ selectedUser.username }}</n-descriptions-item>
          <n-descriptions-item label="邮箱">{{ selectedUser.email }}</n-descriptions-item>
          <n-descriptions-item label="注册时间">{{ formatDate(selectedUser.created_at) }}</n-descriptions-item>
          <n-descriptions-item label="象币余额">{{ selectedUser.coin_balance }} 🪙</n-descriptions-item>
          <n-descriptions-item label="待办数">{{ selectedUser.todo_count }}</n-descriptions-item>
          <n-descriptions-item label="随手记数">{{ selectedUser.idea_count }}</n-descriptions-item>
          <n-descriptions-item label="记账数">{{ selectedUser.finance_count }}</n-descriptions-item>
        </n-descriptions>

        <n-divider />

        <h4 style="margin: 0 0 12px;">修改会员状态</h4>
        <n-space vertical>
          <n-radio-group v-model:value="editPlan">
            <n-radio value="free">免费用户</n-radio>
            <n-radio value="premium">Premium</n-radio>
          </n-radio-group>
          <n-date-picker v-if="editPlan === 'premium'" v-model:value="editExpires" type="datetime" clearable placeholder="留空则为永久会员" style="width: 100%;" />
          <n-button type="primary" :loading="saving" @click="savePlan">保存</n-button>
        </n-space>

        <n-divider />

        <h4 style="margin: 0 0 12px;">手动发放象币</h4>
        <n-space>
          <n-input-number v-model:value="grantAmount" :min="1" :max="10000" placeholder="数量" style="width: 140px;" />
          <n-button type="warning" :loading="granting" @click="grantCoins">发放</n-button>
        </n-space>
      </template>
    </n-modal>
  </div>
</template>

<script setup lang="ts">
import type { DataTableColumns } from 'naive-ui'

definePageMeta({
  layout: 'admin',
  middleware: 'admin',
})

const api = useAdminApi()
const message = useMessage()

const loading = ref(false)
const users = ref<any[]>([])
const total = ref(0)
const page = ref(1)
const pageSize = 20
const search = ref('')
const planFilter = ref<string | null>(null)

const showDetail = ref(false)
const selectedUser = ref<any>(null)
const editPlan = ref<'free' | 'premium'>('free')
const editExpires = ref<number | null>(null)
const saving = ref(false)
const grantAmount = ref<number | null>(null)
const granting = ref(false)

const planOptions = [
  { label: '免费用户', value: 'free' },
  { label: 'Premium', value: 'premium' },
]

const pagination = computed(() => ({
  page: page.value,
  pageSize,
  pageCount: Math.ceil(total.value / pageSize),
  itemCount: total.value,
}))

const columns: DataTableColumns = [
  { title: 'ID', key: 'id', width: 60 },
  { title: '用户名', key: 'username', width: 120 },
  { title: '邮箱', key: 'email', ellipsis: { tooltip: true } },
  {
    title: '会员',
    key: 'plan',
    width: 100,
    render: (row: any) => h('span', {
      style: { color: row.plan === 'premium' ? '#6366f1' : '#6b7280', fontWeight: row.plan === 'premium' ? '600' : '400' },
    }, row.plan === 'premium' ? '✨ Premium' : '免费'),
  },
  {
    title: '象币',
    key: 'coin_balance',
    width: 80,
    render: (row: any) => h('span', `${row.coin_balance} 🪙`),
  },
  {
    title: '注册时间',
    key: 'created_at',
    width: 160,
    render: (row: any) => h('span', formatDate(row.created_at)),
  },
  {
    title: '操作',
    key: 'actions',
    width: 80,
    render: (row: any) => h('a', {
      style: { color: '#6366f1', cursor: 'pointer' },
      onClick: () => openDetail(row),
    }, '详情'),
  },
]

function formatDate(d: string): string {
  if (!d) return '-'
  return new Date(d).toLocaleString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
}

let debounceTimer: ReturnType<typeof setTimeout>
function debouncedLoad() {
  clearTimeout(debounceTimer)
  debounceTimer = setTimeout(() => { page.value = 1; loadUsers() }, 300)
}

async function loadUsers() {
  loading.value = true
  try {
    const data = await api.get('/users', {
      page: page.value,
      pageSize,
      search: search.value || undefined,
      plan: planFilter.value || undefined,
    })
    users.value = data.users
    total.value = data.total
  } catch { /* ignore */ } finally {
    loading.value = false
  }
}

function handlePageChange(p: number) {
  page.value = p
  loadUsers()
}

function openDetail(user: any) {
  selectedUser.value = user
  editPlan.value = user.plan || 'free'
  editExpires.value = user.plan_expires_at ? new Date(user.plan_expires_at).getTime() : null
  grantAmount.value = null
  showDetail.value = true
}

async function savePlan() {
  saving.value = true
  try {
    await api.put(`/users/${selectedUser.value.id}`, {
      plan: editPlan.value,
      plan_expires_at: editPlan.value === 'premium' && editExpires.value
        ? new Date(editExpires.value).toISOString()
        : null,
    })
    message.success('会员状态已更新')
    showDetail.value = false
    loadUsers()
  } catch (err: any) {
    message.error(err?.data?.message || '更新失败')
  } finally {
    saving.value = false
  }
}

async function grantCoins() {
  if (!grantAmount.value || grantAmount.value <= 0) {
    message.warning('请输入有效数量')
    return
  }
  granting.value = true
  try {
    await api.post(`/users/${selectedUser.value.id}/grant-coins`, { amount: grantAmount.value })
    message.success(`已发放 ${grantAmount.value} 象币`)
    grantAmount.value = null
    // Reload user detail
    const detail = await api.get(`/users/${selectedUser.value.id}`)
    selectedUser.value = detail
    loadUsers()
  } catch (err: any) {
    message.error(err?.data?.message || '发放失败')
  } finally {
    granting.value = false
  }
}

onMounted(loadUsers)
</script>

<style lang="scss" scoped>
.toolbar {
  display: flex;
  gap: 12px;
  margin-bottom: 16px;
}
</style>
