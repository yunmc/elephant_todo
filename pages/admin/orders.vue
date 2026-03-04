<template>
  <div>
    <!-- Tab Switch -->
    <n-tabs v-model:value="activeTab" type="segment" style="margin-bottom: 16px;" @update:value="loadData">
      <n-tab-pane name="premium" tab="Premium 订单" />
      <n-tab-pane name="purchases" tab="商品购买记录" />
    </n-tabs>

    <!-- Status Filter (premium only) -->
    <div v-if="activeTab === 'premium'" class="toolbar">
      <n-select v-model:value="statusFilter" :options="statusOptions" placeholder="订单状态" clearable style="width: 140px;" @update:value="loadData" />
    </div>

    <!-- Data Table -->
    <n-data-table
      :columns="activeTab === 'premium' ? premiumColumns : purchaseColumns"
      :data="items"
      :loading="loading"
      :bordered="false"
      :pagination="pagination"
      remote
      @update:page="handlePageChange"
    />
  </div>
</template>

<script setup lang="ts">
import type { DataTableColumns } from 'naive-ui'

definePageMeta({
  layout: 'admin',
  middleware: 'admin',
})

const api = useAdminApi()

const loading = ref(false)
const items = ref<any[]>([])
const total = ref(0)
const page = ref(1)
const pageSize = 20
const activeTab = ref('premium')
const statusFilter = ref<string | null>(null)

const statusOptions = [
  { label: '待支付', value: 'pending' },
  { label: '已支付', value: 'paid' },
  { label: '已过期', value: 'expired' },
  { label: '已退款', value: 'refunded' },
]

const pagination = computed(() => ({
  page: page.value,
  pageSize,
  pageCount: Math.ceil(total.value / pageSize),
  itemCount: total.value,
}))

function formatDate(d: string): string {
  if (!d) return '-'
  return new Date(d).toLocaleString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
}

const statusColors: Record<string, string> = {
  pending: '#f59e0b',
  paid: '#22c55e',
  expired: '#6b7280',
  refunded: '#ef4444',
}

const premiumColumns: DataTableColumns = [
  { title: '订单号', key: 'order_no', width: 180, ellipsis: { tooltip: true } },
  { title: '用户', key: 'username', width: 100 },
  { title: '邮箱', key: 'email', width: 160, ellipsis: { tooltip: true } },
  {
    title: '套餐',
    key: 'plan_type',
    width: 80,
    render: (row: any) => h('span', row.plan_type === 'yearly' ? '年费' : '月费'),
  },
  {
    title: '金额',
    key: 'amount',
    width: 80,
    render: (row: any) => h('span', `¥${row.amount}`),
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
    title: '支付方式',
    key: 'payment_method',
    width: 100,
    render: (row: any) => h('span', row.payment_method || '-'),
  },
  {
    title: '创建时间',
    key: 'created_at',
    width: 150,
    render: (row: any) => h('span', formatDate(row.created_at)),
  },
]

const purchaseColumns: DataTableColumns = [
  { title: 'ID', key: 'id', width: 60 },
  { title: '用户', key: 'username', width: 100 },
  { title: '商品', key: 'product_name', width: 140 },
  {
    title: '类型',
    key: 'product_type',
    width: 80,
  },
  {
    title: '购买时间',
    key: 'purchased_at',
    width: 160,
    render: (row: any) => h('span', formatDate(row.purchased_at)),
  },
]

async function loadData() {
  loading.value = true
  try {
    const data = await api.get('/orders', {
      page: page.value,
      pageSize,
      tab: activeTab.value,
      status: activeTab.value === 'premium' ? statusFilter.value || undefined : undefined,
    })
    items.value = data.items
    total.value = data.total
  } catch { /* ignore */ } finally {
    loading.value = false
  }
}

function handlePageChange(p: number) { page.value = p; loadData() }

onMounted(loadData)
</script>

<style lang="scss" scoped>
.toolbar {
  display: flex;
  gap: 12px;
  margin-bottom: 16px;
}
</style>
