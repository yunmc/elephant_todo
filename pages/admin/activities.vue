<template>
  <div>
    <!-- Toolbar -->
    <div class="toolbar">
      <n-select v-model:value="statusFilter" :options="statusOptions" placeholder="活动状态" clearable style="width: 140px;" @update:value="loadActivities" />
      <div style="flex: 1;" />
      <n-button type="primary" @click="openCreate">+ 创建活动</n-button>
    </div>

    <!-- Activities Table -->
    <n-data-table
      :columns="columns"
      :data="activities"
      :loading="loading"
      :bordered="false"
      :pagination="pagination"
      remote
      @update:page="handlePageChange"
    />

    <!-- Create / Edit Modal -->
    <n-modal v-model:show="showModal" preset="card" :title="editing ? '编辑活动' : '创建活动'" style="max-width: 560px;" :segmented="{ content: true }">
      <n-form :model="form" label-placement="left" label-width="80">
        <n-form-item label="标题">
          <n-input v-model:value="form.title" placeholder="活动标题" />
        </n-form-item>
        <n-form-item label="类型">
          <n-select v-model:value="form.type" :options="typeOptions" />
        </n-form-item>
        <n-form-item label="描述">
          <n-input v-model:value="form.description" type="textarea" :rows="2" placeholder="活动描述" />
        </n-form-item>
        <n-form-item label="开始时间">
          <n-date-picker v-model:value="form.starts_at" type="datetime" style="width: 100%;" />
        </n-form-item>
        <n-form-item label="结束时间">
          <n-date-picker v-model:value="form.ends_at" type="datetime" style="width: 100%;" />
        </n-form-item>
        <n-form-item label="配置 (JSON)">
          <n-input v-model:value="form.configStr" type="textarea" :rows="3" placeholder='{"reward": 10, "discount": 0.8}' />
        </n-form-item>
        <n-form-item v-if="editing" label="状态">
          <n-select v-model:value="form.status" :options="statusOptions.filter(o => o.value)" />
        </n-form-item>
      </n-form>
      <template #action>
        <n-button type="primary" :loading="saving" @click="saveActivity">{{ editing ? '保存' : '创建' }}</n-button>
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
const dialog = useDialog()

const loading = ref(false)
const activities = ref<any[]>([])
const total = ref(0)
const page = ref(1)
const pageSize = 20
const statusFilter = ref<string | null>(null)

const showModal = ref(false)
const editing = ref(false)
const saving = ref(false)
const editId = ref(0)

const form = reactive({
  title: '',
  type: 'custom',
  description: '',
  starts_at: null as number | null,
  ends_at: null as number | null,
  configStr: '',
  status: 'draft',
})

const typeOptions = [
  { label: '签到奖励', value: 'sign_in_bonus' },
  { label: '节日活动', value: 'holiday_event' },
  { label: '限时折扣', value: 'flash_sale' },
  { label: '自定义', value: 'custom' },
]

const statusOptions = [
  { label: '草稿', value: 'draft' },
  { label: '进行中', value: 'active' },
  { label: '已结束', value: 'ended' },
  { label: '已取消', value: 'cancelled' },
]

const pagination = computed(() => ({
  page: page.value,
  pageSize,
  pageCount: Math.ceil(total.value / pageSize),
  itemCount: total.value,
}))

const statusColors: Record<string, string> = {
  draft: '#6b7280',
  active: '#22c55e',
  ended: '#f59e0b',
  cancelled: '#ef4444',
}

function formatDate(d: string): string {
  if (!d) return '-'
  return new Date(d).toLocaleString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
}

const columns: DataTableColumns = [
  { title: 'ID', key: 'id', width: 50 },
  { title: '标题', key: 'title', width: 160 },
  {
    title: '类型',
    key: 'type',
    width: 100,
    render: (row: any) => h('span', typeOptions.find(o => o.value === row.type)?.label || row.type),
  },
  {
    title: '状态',
    key: 'status',
    width: 80,
    render: (row: any) => h('span', {
      style: { color: statusColors[row.status] || '#6b7280', fontWeight: '500' },
    }, statusOptions.find(o => o.value === row.status)?.label || row.status),
  },
  {
    title: '开始时间',
    key: 'starts_at',
    width: 150,
    render: (row: any) => h('span', formatDate(row.starts_at)),
  },
  {
    title: '结束时间',
    key: 'ends_at',
    width: 150,
    render: (row: any) => h('span', formatDate(row.ends_at)),
  },
  {
    title: '创建者',
    key: 'admin_username',
    width: 90,
    render: (row: any) => h('span', row.admin_username || '-'),
  },
  {
    title: '操作',
    key: 'actions',
    width: 120,
    render: (row: any) => h('div', { style: 'display:flex;gap:8px;' }, [
      h('a', { style: 'color:#6366f1;cursor:pointer;', onClick: () => openEdit(row) }, '编辑'),
      h('a', { style: 'color:#ef4444;cursor:pointer;', onClick: () => confirmDelete(row) }, '删除'),
    ]),
  },
]

async function loadActivities() {
  loading.value = true
  try {
    const data = await api.get('/activities', {
      page: page.value,
      pageSize,
      status: statusFilter.value || undefined,
    })
    activities.value = data.activities
    total.value = data.total
  } catch { /* ignore */ } finally {
    loading.value = false
  }
}

function handlePageChange(p: number) { page.value = p; loadActivities() }

function openCreate() {
  editing.value = false
  editId.value = 0
  Object.assign(form, { title: '', type: 'custom', description: '', starts_at: null, ends_at: null, configStr: '', status: 'draft' })
  showModal.value = true
}

function openEdit(row: any) {
  editing.value = true
  editId.value = row.id
  Object.assign(form, {
    title: row.title,
    type: row.type,
    description: row.description || '',
    starts_at: row.starts_at ? new Date(row.starts_at).getTime() : null,
    ends_at: row.ends_at ? new Date(row.ends_at).getTime() : null,
    configStr: row.config ? JSON.stringify(row.config, null, 2) : '',
    status: row.status,
  })
  showModal.value = true
}

async function saveActivity() {
  if (!form.title.trim()) { message.warning('请填写活动标题'); return }
  if (!form.starts_at || !form.ends_at) { message.warning('请选择开始和结束时间'); return }

  let config = {}
  if (form.configStr.trim()) {
    try { config = JSON.parse(form.configStr) }
    catch { message.error('配置 JSON 格式错误'); return }
  }

  saving.value = true
  try {
    const payload = {
      title: form.title,
      type: form.type,
      description: form.description,
      starts_at: new Date(form.starts_at).toISOString(),
      ends_at: new Date(form.ends_at).toISOString(),
      config,
      ...(editing.value ? { status: form.status } : {}),
    }

    if (editing.value) {
      await api.put(`/activities/${editId.value}`, payload)
      message.success('活动已更新')
    } else {
      await api.post('/activities', payload)
      message.success('活动已创建')
    }
    showModal.value = false
    loadActivities()
  } catch (err: any) {
    message.error(err?.data?.message || '操作失败')
  } finally {
    saving.value = false
  }
}

function confirmDelete(row: any) {
  dialog.warning({
    title: '确认删除',
    content: `确定删除活动「${row.title}」？`,
    positiveText: '删除',
    negativeText: '取消',
    onPositiveClick: async () => {
      try {
        await api.del(`/activities/${row.id}`)
        message.success('已删除')
        loadActivities()
      } catch (err: any) {
        message.error(err?.data?.message || '操作失败')
      }
    },
  })
}

onMounted(loadActivities)
</script>

<style lang="scss" scoped>
.toolbar {
  display: flex;
  gap: 12px;
  margin-bottom: 16px;
  align-items: center;
}
</style>
