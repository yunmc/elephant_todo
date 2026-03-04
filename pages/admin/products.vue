<template>
  <div>
    <!-- Toolbar -->
    <div class="toolbar">
      <n-select v-model:value="typeFilter" :options="typeOptions" placeholder="商品类型" clearable style="width: 140px;" @update:value="loadProducts" />
      <n-select v-model:value="statusFilter" :options="statusOptions" placeholder="状态" clearable style="width: 120px;" @update:value="loadProducts" />
      <div style="flex: 1;" />
      <n-button type="primary" @click="openCreate">+ 新建商品</n-button>
    </div>

    <!-- Products Table -->
    <n-data-table
      :columns="columns"
      :data="products"
      :loading="loading"
      :bordered="false"
      :pagination="pagination"
      remote
      @update:page="handlePageChange"
    />

    <!-- Create / Edit Modal -->
    <n-modal v-model:show="showModal" preset="card" :title="editing ? '编辑商品' : '创建商品'" style="max-width: 520px;" :segmented="{ content: true }">
      <n-form :model="form" label-placement="left" label-width="80">
        <n-form-item label="名称">
          <n-input v-model:value="form.name" placeholder="商品名称" />
        </n-form-item>
        <n-form-item label="类型">
          <n-select v-model:value="form.type" :options="typeOptions.filter(o => o.value)" :disabled="editing" />
        </n-form-item>
        <n-form-item label="价格">
          <n-input-number v-model:value="form.price" :min="0" style="width: 100%;" />
        </n-form-item>
        <n-form-item label="免费">
          <n-switch v-model:value="form.is_free" />
        </n-form-item>
        <n-form-item label="描述">
          <n-input v-model:value="form.description" type="textarea" :rows="2" />
        </n-form-item>
        <n-form-item label="CSS 类名">
          <n-input v-model:value="form.css_class" placeholder="skin-xxx" />
        </n-form-item>
        <n-form-item label="预览图 URL">
          <n-input v-model:value="form.preview_url" placeholder="https://..." />
        </n-form-item>
        <n-form-item label="排序">
          <n-input-number v-model:value="form.sort_order" :min="0" style="width: 100%;" />
        </n-form-item>
        <n-form-item v-if="editing" label="状态">
          <n-select v-model:value="form.status" :options="statusOptions.filter(o => o.value)" />
        </n-form-item>
      </n-form>
      <template #action>
        <n-button type="primary" :loading="saving" @click="saveProduct">{{ editing ? '保存' : '创建' }}</n-button>
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
const products = ref<any[]>([])
const total = ref(0)
const page = ref(1)
const pageSize = 20
const typeFilter = ref<string | null>(null)
const statusFilter = ref<string | null>(null)

const showModal = ref(false)
const editing = ref(false)
const saving = ref(false)
const editId = ref(0)

const form = reactive({
  name: '',
  type: 'skin',
  price: 0,
  is_free: false,
  description: '',
  css_class: '',
  preview_url: '',
  sort_order: 0,
  status: 'active',
})

const typeOptions = [
  { label: '皮肤', value: 'skin' },
  { label: '字体', value: 'font' },
  { label: '贴纸', value: 'sticker' },
  { label: '套装', value: 'bundle' },
]

const statusOptions = [
  { label: '上架', value: 'active' },
  { label: '下架', value: 'inactive' },
]

const pagination = computed(() => ({
  page: page.value,
  pageSize,
  pageCount: Math.ceil(total.value / pageSize),
  itemCount: total.value,
}))

const columns: DataTableColumns = [
  { title: 'ID', key: 'id', width: 50 },
  { title: '名称', key: 'name', width: 140 },
  {
    title: '类型',
    key: 'type',
    width: 80,
    render: (row: any) => h('span', typeOptions.find(o => o.value === row.type)?.label || row.type),
  },
  {
    title: '价格',
    key: 'price',
    width: 80,
    render: (row: any) => h('span', row.is_free ? '免费' : `${row.price} 🪙`),
  },
  {
    title: '销量',
    key: 'sold_count',
    width: 70,
    sorter: 'default',
  },
  {
    title: '状态',
    key: 'status',
    width: 80,
    render: (row: any) => h('span', {
      style: { color: row.status === 'active' ? '#22c55e' : '#ef4444' },
    }, row.status === 'active' ? '上架' : '下架'),
  },
  {
    title: '操作',
    key: 'actions',
    width: 120,
    render: (row: any) => h('div', { style: 'display:flex;gap:8px;' }, [
      h('a', { style: 'color:#6366f1;cursor:pointer;', onClick: () => openEdit(row) }, '编辑'),
      row.status === 'active'
        ? h('a', { style: 'color:#ef4444;cursor:pointer;', onClick: () => confirmDeactivate(row) }, '下架')
        : null,
    ]),
  },
]

async function loadProducts() {
  loading.value = true
  try {
    const data = await api.get('/products', {
      page: page.value,
      pageSize,
      type: typeFilter.value || undefined,
      status: statusFilter.value || undefined,
    })
    products.value = data.products
    total.value = data.total
  } catch { /* ignore */ } finally {
    loading.value = false
  }
}

function handlePageChange(p: number) { page.value = p; loadProducts() }

function openCreate() {
  editing.value = false
  editId.value = 0
  Object.assign(form, { name: '', type: 'skin', price: 0, is_free: false, description: '', css_class: '', preview_url: '', sort_order: 0, status: 'active' })
  showModal.value = true
}

function openEdit(row: any) {
  editing.value = true
  editId.value = row.id
  Object.assign(form, {
    name: row.name,
    type: row.type,
    price: row.price,
    is_free: !!row.is_free,
    description: row.description || '',
    css_class: row.css_class || '',
    preview_url: row.preview_url || '',
    sort_order: row.sort_order || 0,
    status: row.status,
  })
  showModal.value = true
}

async function saveProduct() {
  if (!form.name.trim()) { message.warning('请填写商品名称'); return }
  saving.value = true
  try {
    if (editing.value) {
      await api.put(`/products/${editId.value}`, { ...form })
      message.success('商品已更新')
    } else {
      await api.post('/products', { ...form })
      message.success('商品已创建')
    }
    showModal.value = false
    loadProducts()
  } catch (err: any) {
    message.error(err?.data?.message || '操作失败')
  } finally {
    saving.value = false
  }
}

function confirmDeactivate(row: any) {
  dialog.warning({
    title: '确认下架',
    content: `确定下架「${row.name}」？`,
    positiveText: '下架',
    negativeText: '取消',
    onPositiveClick: async () => {
      try {
        await api.del(`/products/${row.id}`)
        message.success('已下架')
        loadProducts()
      } catch (err: any) {
        message.error(err?.data?.message || '操作失败')
      }
    },
  })
}

onMounted(loadProducts)
</script>

<style lang="scss" scoped>
.toolbar {
  display: flex;
  gap: 12px;
  margin-bottom: 16px;
  align-items: center;
}
</style>
