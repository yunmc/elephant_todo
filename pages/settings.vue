<template>
  <div class="page-container">
    <h1 class="page-title">设置</h1>

    <!-- User Info -->
    <div class="section-card">
    <n-card title="账户信息" size="small">
      <n-descriptions bordered :column="1" label-placement="left" v-if="authStore.user">
        <n-descriptions-item label="用户名">{{ authStore.user.username }}</n-descriptions-item>
        <n-descriptions-item label="邮箱">{{ authStore.user.email }}</n-descriptions-item>
      </n-descriptions>
    </n-card>
    </div>

    <!-- Premium (Coming Soon) -->
    <div class="section-card">
      <n-card size="small" class="premium-card premium-card--free">
        <div style="display: flex; align-items: center; justify-content: space-between; padding: 4px 0;">
          <div>
            <div style="font-weight: 600; font-size: 15px; line-height: 1.6;">🐘 高级功能</div>
            <div style="font-size: 13px; color: var(--color-text-muted); line-height: 1.6; margin-top: 4px;">更多高级功能正在开发中，敬请期待</div>
          </div>
          <n-tag type="info" size="small" style="flex-shrink: 0; margin-left: 12px;">敬请期待</n-tag>
        </div>
      </n-card>
    </div>

    <!-- Category Management -->
    <div class="section-card">
    <n-card size="small">
      <template #header>
        <n-space align="center" :size="4">
          <span>分类管理</span>
          <n-tooltip style="max-width: 200px;">
            <template #trigger>
              <n-button text size="tiny" style="color: var(--n-text-color-3); font-size: 14px;">❓</n-button>
            </template>
            每个待办只能属于一个分类，适合按领域划分，如“工作”“生活”“学习”
          </n-tooltip>
        </n-space>
      </template>
      <n-spin v-if="categoriesStore.loading" style="display: flex; justify-content: center; padding: 16px 0;" />
      <n-list v-else bordered>
        <n-list-item v-for="cat in categoriesStore.categories" :key="cat.id">
          <n-space justify="space-between" align="center" style="width: 100%;">
            <n-space align="center">
              <span :style="{ width: '12px', height: '12px', borderRadius: '50%', background: cat.color, display: 'inline-block' }"></span>
              <n-text>{{ cat.name }}</n-text>
            </n-space>
            <n-popconfirm positive-text="确认" negative-text="取消" @positive-click="handleDeleteCategory(cat.id)">
              <template #trigger>
                <n-button text type="error" size="small">删除</n-button>
              </template>
              删除分类「{{ cat.name }}」？
            </n-popconfirm>
          </n-space>
        </n-list-item>
        <n-list-item>
          <div style="display: flex; gap: 8px; align-items: center; width: 100%;">
            <n-input v-model:value="newCategoryName" placeholder="新分类名称" size="medium" style="flex: 1; min-width: 0;" @keyup.enter="handleAddCategory" />
            <input type="color" v-model="newCategoryColor" class="color-input" />
            <n-button size="medium" type="primary" style="flex-shrink: 0; min-width: 56px;" @click="handleAddCategory">添加</n-button>
          </div>
        </n-list-item>
      </n-list>
    </n-card>
    </div>

    <!-- Tag Management -->
    <div class="section-card">
    <n-card size="small">
      <template #header>
        <n-space align="center" :size="4">
          <span>标签管理</span>
          <n-tooltip style="max-width: 200px;">
            <template #trigger>
              <n-button text size="tiny" style="color: var(--n-text-color-3); font-size: 14px;">❓</n-button>
            </template>
            每个待办可以打多个标签，适合横向标记，如“紧急”“周末”“需要资料”
          </n-tooltip>
        </n-space>
      </template>
      <n-spin v-if="tagsStore.loading" style="display: flex; justify-content: center; padding: 16px 0;" />
      <n-list v-else bordered>
        <n-list-item v-for="tag in tagsStore.tags" :key="tag.id">
          <n-space justify="space-between" align="center" style="width: 100%;">
            <n-text>{{ tag.name }}</n-text>
            <n-popconfirm positive-text="确认" negative-text="取消" @positive-click="handleDeleteTag(tag.id)">
              <template #trigger>
                <n-button text type="error" size="small">删除</n-button>
              </template>
              删除标签「{{ tag.name }}」？
            </n-popconfirm>
          </n-space>
        </n-list-item>
        <n-list-item>
          <div style="display: flex; gap: 8px; align-items: center; width: 100%;">
            <n-input v-model:value="newTagName" placeholder="新标签名称" size="medium" style="flex: 1;" @keyup.enter="handleAddTag" />
            <n-button size="medium" type="primary" style="min-width: 56px;" @click="handleAddTag">添加</n-button>
          </div>
        </n-list-item>
      </n-list>
    </n-card>
    </div>

    <!-- Change Password -->
    <div class="section-card">
    <n-card title="修改密码" size="small">
      <n-space vertical :size="12">
        <n-input v-model:value="pwdForm.currentPassword" type="password" show-password-on="click" placeholder="当前密码" />
        <n-input v-model:value="pwdForm.newPassword" type="password" show-password-on="click" placeholder="新密码 (至少6位)" />
        <n-input v-model:value="pwdForm.confirmPassword" type="password" show-password-on="click" placeholder="确认新密码" />
        <n-text depth="3" type="warning" style="font-size: 12px;">
          ⚠️ 修改密码后，密码本将使用新密码重新加密。确保记住新密码。
        </n-text>
        <n-button type="warning" size="small" block :loading="changingPwd" @click="handleChangePassword">修改密码</n-button>
      </n-space>
    </n-card>
    </div>

    <!-- Theme -->
    <div class="section-card">
    <n-card title="主题" size="small">
      <ClientOnly>
        <n-skeleton v-if="!themeReady" text :repeat="1" />
        <n-space v-else>
          <n-button
            size="small"
            :type="themeMode === 'system' ? 'primary' : 'default'"
            :ghost="themeMode !== 'system'"
            @click="handleThemeChange('system')"
          >跟随系统</n-button>
          <n-button
            size="small"
            :type="themeMode === 'light' ? 'primary' : 'default'"
            :ghost="themeMode !== 'light'"
            @click="handleThemeChange('light')"
          >浅色</n-button>
          <n-button
            size="small"
            :type="themeMode === 'dark' ? 'primary' : 'default'"
            :ghost="themeMode !== 'dark'"
            @click="handleThemeChange('dark')"
          >深色</n-button>
        </n-space>
      </ClientOnly>
    </n-card>
    </div>

    <!-- Logout -->
    <n-button type="error" block ghost @click="handleLogout" style="margin-top: 20px;">
      退出登录
    </n-button>

    <n-text depth="3" style="display: block; text-align: center; margin-top: 24px; font-size: 12px; padding-bottom: 8px;">
      Elephant Todo v1.0.0 · 🐘
    </n-text>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ ssr: false })

const authStore = useAuthStore()
const categoriesStore = useCategoriesStore()
const tagsStore = useTagsStore()
const api = useApi()
const message = useMessage()

// Load data
await useAsyncData('settings-data', async () => {
  await Promise.all([
    categoriesStore.fetchCategories(),
    tagsStore.fetchTags(),
  ])
  return true
})

// === Category ===
const newCategoryName = ref('')
const newCategoryColor = ref('#4D96FF')

async function handleAddCategory() {
  if (!newCategoryName.value.trim()) return
  try {
    await categoriesStore.createCategory({ name: newCategoryName.value.trim(), color: newCategoryColor.value })
    newCategoryName.value = ''
    message.success('分类已添加')
  } catch (e: any) {
    message.error(e?.data?.message || '添加分类失败')
  }
}

async function handleDeleteCategory(id: number) {
  try {
    await categoriesStore.deleteCategory(id)
    message.success('分类已删除')
  } catch {
    message.error('删除分类失败')
  }
}

// === Tag ===
const newTagName = ref('')

async function handleAddTag() {
  if (!newTagName.value.trim()) return
  try {
    await tagsStore.createTag({ name: newTagName.value.trim() })
    newTagName.value = ''
    message.success('标签已添加')
  } catch (e: any) {
    message.error(e?.data?.message || '添加标签失败')
  }
}

async function handleDeleteTag(id: number) {
  try {
    await tagsStore.deleteTag(id)
    message.success('标签已删除')
  } catch {
    message.error('删除标签失败')
  }
}

// === Change Password ===
const pwdForm = reactive({
  currentPassword: '',
  newPassword: '',
  confirmPassword: '',
})
const changingPwd = ref(false)

async function handleChangePassword() {
  if (!pwdForm.currentPassword || !pwdForm.newPassword) {
    message.warning('请填写所有字段')
    return
  }
  if (pwdForm.newPassword.length < 6) {
    message.warning('新密码至少6位')
    return
  }
  if (pwdForm.newPassword !== pwdForm.confirmPassword) {
    message.warning('两次密码不一致')
    return
  }

  changingPwd.value = true
  try {
    await api.post('/auth/change-password', {
      currentPassword: pwdForm.currentPassword,
      newPassword: pwdForm.newPassword,
    }).then((res: any) => {
      // Save new tokens to invalidate old sessions
      if (res?.data?.accessToken && res?.data?.refreshToken) {
        const authStore = useAuthStore()
        const accessTokenCookie = useCookie('accessToken', { maxAge: 60 * 60 * 24 * 7 })
        const refreshTokenCookie = useCookie('refreshToken', { maxAge: 60 * 60 * 24 * 30 })
        accessTokenCookie.value = res.data.accessToken
        refreshTokenCookie.value = res.data.refreshToken
      }
    })

    // Re-encrypt vault entries
    const vaultStore = useVaultStore()
    if (vaultStore.entries.length) {
      try {
        await vaultStore.reEncryptAll(pwdForm.currentPassword, pwdForm.newPassword)
        message.success('密码已修改，密码本已重新加密')
      } catch {
        message.warning('密码已修改，但密码本重新加密失败。请手动处理。')
      }
    } else {
      message.success('密码已修改')
    }

    Object.assign(pwdForm, { currentPassword: '', newPassword: '', confirmPassword: '' })
  } catch {
    message.error('修改失败，请检查当前密码')
  } finally {
    changingPwd.value = false
  }
}

// === Theme ===
type ThemeMode = 'system' | 'light' | 'dark'
const { preference, initialize, setPreference } = useThemePreference()
const themeMode = preference
const themeReady = ref(false)

onMounted(() => {
  initialize()
  themeReady.value = true
})

function handleThemeChange(theme: ThemeMode) {
  setPreference(theme)
}

// === Logout ===
function handleLogout() {
  authStore.logout()
  navigateTo('/login')
}
</script>
