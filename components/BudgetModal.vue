<template>
  <ClientOnly>
    <n-modal v-model:show="visible" preset="card" title="设置预算" :style="{ maxWidth: '500px', width: '100%' }">
      <div class="budget-form">
        <!-- Total Budget -->
        <div class="budget-form-section">
          <div class="budget-form-label">📊 总预算（月度）</div>
          <div class="budget-form-row">
            <n-input-number
              v-model:value="totalAmount"
              :min="0"
              :precision="2"
              placeholder="输入月度总预算"
              style="flex: 1;"
            />
            <n-button
              type="primary"
              :disabled="!totalAmount || totalAmount <= 0"
              @click="saveTotalBudget"
            >
              保存
            </n-button>
          </div>
        </div>

        <!-- Category Budgets -->
        <div class="budget-form-section">
          <div class="budget-form-label">📂 分类预算</div>
          <div v-for="cat in expenseCategories" :key="cat.id" class="budget-cat-row">
            <span class="cat-label">{{ cat.icon }} {{ cat.name }}</span>
            <n-input-number
              v-model:value="categoryAmounts[cat.id]"
              :min="0"
              :precision="2"
              placeholder="金额"
              size="small"
              style="width: 120px;"
            />
            <n-button
              size="small"
              :disabled="!categoryAmounts[cat.id] || categoryAmounts[cat.id]! <= 0"
              @click="saveCategoryBudget(cat.id)"
            >
              保存
            </n-button>
            <n-button
              size="small"
              quaternary
              type="error"
              v-if="existingBudgetIds[cat.id]"
              @click="removeBudget(cat.id)"
            >
              删除
            </n-button>
          </div>
          <n-empty v-if="expenseCategories.length === 0" description="请先添加支出分类" />
        </div>

        <!-- Existing budgets list for cleanup -->
        <div v-if="totalBudgetId" class="budget-form-section">
          <n-button size="small" quaternary type="error" block @click="removeTotalBudget">
            删除总预算
          </n-button>
        </div>
      </div>
    </n-modal>
  </ClientOnly>
</template>

<script setup lang="ts">
import type { FinanceCategory, FinanceBudget } from '~/types'

const props = defineProps<{
  show: boolean
  yearMonth: string
  categories: FinanceCategory[]
  budgets: FinanceBudget[]
}>()

const emit = defineEmits<{
  'update:show': [value: boolean]
  'saved': []
}>()

const financeStore = useFinanceStore()
const message = useMessage()

const visible = computed({
  get: () => props.show,
  set: (val) => emit('update:show', val),
})

const expenseCategories = computed(() =>
  props.categories.filter(c => c.type === 'expense')
)

// 总预算金额
const totalAmount = ref<number | null>(null)
const categoryAmounts = ref<Record<number, number | null>>({})

// 已存在的预算 ID 映射
const totalBudgetId = ref<number | null>(null)
const existingBudgetIds = ref<Record<number, number>>({})

// 当 budgets 变化时同步
watch(() => props.budgets, (budgets) => {
  totalBudgetId.value = null
  existingBudgetIds.value = {}
  for (const b of budgets) {
    if (b.category_id === null) {
      totalAmount.value = Number(b.amount)
      totalBudgetId.value = b.id
    } else {
      categoryAmounts.value[b.category_id] = Number(b.amount)
      existingBudgetIds.value[b.category_id] = b.id
    }
  }
}, { immediate: true })

async function saveTotalBudget() {
  if (!totalAmount.value || totalAmount.value <= 0) return
  try {
    await financeStore.saveBudget({
      category_id: null,
      year_month: props.yearMonth,
      amount: totalAmount.value,
    })
    message.success('总预算已保存')
    emit('saved')
  } catch {
    message.error('保存失败')
  }
}

async function saveCategoryBudget(categoryId: number) {
  const amount = categoryAmounts.value[categoryId]
  if (!amount || amount <= 0) return
  try {
    await financeStore.saveBudget({
      category_id: categoryId,
      year_month: props.yearMonth,
      amount,
    })
    message.success('分类预算已保存')
    emit('saved')
  } catch {
    message.error('保存失败')
  }
}

async function removeBudget(categoryId: number) {
  const budgetId = existingBudgetIds.value[categoryId]
  if (!budgetId) return
  try {
    await financeStore.deleteBudget(budgetId)
    categoryAmounts.value[categoryId] = null
    delete existingBudgetIds.value[categoryId]
    message.success('分类预算已删除')
    emit('saved')
  } catch {
    message.error('删除失败')
  }
}

async function removeTotalBudget() {
  if (!totalBudgetId.value) return
  try {
    await financeStore.deleteBudget(totalBudgetId.value)
    totalAmount.value = null
    totalBudgetId.value = null
    message.success('总预算已删除')
    emit('saved')
  } catch {
    message.error('删除失败')
  }
}
</script>

<style scoped>
.budget-form {
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.budget-form-section {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.budget-form-label {
  font-size: 14px;
  font-weight: 600;
  color: var(--color-text);
}
.budget-form-row {
  display: flex;
  gap: 8px;
  align-items: center;
}
.budget-cat-row {
  display: flex;
  align-items: center;
  gap: 8px;
}
.cat-label {
  font-size: 13px;
  color: var(--color-text);
  min-width: 80px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
</style>
