<template>
  <div class="page-container jp-page">
    <!-- ====== Header ====== -->
    <div class="jp-header">
      <div class="jp-header-content">
        <img class="jp-header-icon" src="/elephant-icon.png" alt="logo" />
        <h1 class="jp-header-title">設置</h1>
      </div>
      <p class="jp-header-ver">v1.0.0 · 🐘</p>
    </div>

    <!-- ====== 账户信息 ====== -->
    <section class="jp-section">
      <div class="jp-card">
        <h3 class="jp-card-title"><i>👤</i> 账户信息</h3>
        <template v-if="authStore.user">
          <div class="jp-info-row">
            <span class="jp-label">用户名</span>
            <span class="jp-value">{{ authStore.user.username }}</span>
          </div>
          <div class="jp-info-row">
            <span class="jp-label">邮箱</span>
            <span class="jp-value">{{ authStore.user.email }}</span>
          </div>
        </template>
      </div>
    </section>

    <!-- ====== 高级功能 ====== -->
    <section class="jp-section">
      <div class="jp-card jp-card--premium">
        <div class="jp-card-title"><i>🍵</i> 高级功能 <span class="jp-premium-badge">敬请期待</span></div>
        <p class="jp-muted">更多高级功能正在开发中，敬请期待</p>
      </div>
    </section>

    <!-- ====== 分类管理 ====== -->
    <section class="jp-section">
      <div class="jp-card">
        <h3 class="jp-card-title"><i>🍃</i> 分类管理</h3>
        <n-spin v-if="categoriesStore.loading" style="display: flex; justify-content: center; padding: 16px 0;" />
        <template v-else>
          <div v-for="cat in categoriesStore.categories" :key="cat.id" class="jp-list-row">
            <div class="jp-list-left">
              <span class="jp-dot" :style="{ background: cat.color }"></span>
              <span>{{ cat.name }}</span>
            </div>
            <n-popconfirm positive-text="确认" negative-text="取消" @positive-click="handleDeleteCategory(cat.id)">
              <template #trigger>
                <button class="jp-del">删除</button>
              </template>
              删除分类「{{ cat.name }}」？
            </n-popconfirm>
          </div>
          <div class="jp-add-row">
            <n-input v-model:value="newCategoryName" placeholder="新分类名称" size="medium" style="flex: 1; min-width: 0;" @keyup.enter="handleAddCategory" />
            <input type="color" v-model="newCategoryColor" class="color-input" />
            <button class="jp-btn" @click="handleAddCategory">添加</button>
          </div>
        </template>
      </div>
    </section>

    <!-- ====== 标签管理 ====== -->
    <section class="jp-section">
      <div class="jp-card">
        <h3 class="jp-card-title"><i>🏷️</i> 标签管理</h3>
        <n-spin v-if="tagsStore.loading" style="display: flex; justify-content: center; padding: 16px 0;" />
        <template v-else>
          <div v-for="tag in tagsStore.tags" :key="tag.id" class="jp-list-row">
            <div class="jp-list-left">
              <span class="jp-dot" :style="{ background: tag.color || 'var(--color-text-muted)' }"></span>
              <span>{{ tag.name }}</span>
            </div>
            <n-popconfirm positive-text="确认" negative-text="取消" @positive-click="handleDeleteTag(tag.id)">
              <template #trigger>
                <button class="jp-del">删除</button>
              </template>
              删除标签「{{ tag.name }}」？
            </n-popconfirm>
          </div>
          <div class="jp-add-row">
            <n-input v-model:value="newTagName" placeholder="输入新标签" size="medium" style="flex: 1;" @keyup.enter="handleAddTag" />
            <input type="color" v-model="newTagColor" class="color-input" />
            <button class="jp-btn" @click="handleAddTag">添加</button>
          </div>
        </template>
      </div>
    </section>

    <!-- ====== 修改密码 ====== -->
    <section class="jp-section">
      <div class="jp-card">
        <h3 class="jp-card-title"><i>🔑</i> 修改密码</h3>
        <div class="jp-form-col">
          <n-input v-model:value="pwdForm.currentPassword" type="password" show-password-on="click" placeholder="当前密码" />
          <n-input v-model:value="pwdForm.newPassword" type="password" show-password-on="click" placeholder="新密码 (至少6位)" />
          <n-input v-model:value="pwdForm.confirmPassword" type="password" show-password-on="click" placeholder="确认新密码" />
        </div>
        <p class="jp-hint">⚠ 修改密码后，密码本将使用新密码重新加密。确保记住新密码。</p>
        <button class="jp-btn-primary" :disabled="changingPwd" @click="handleChangePassword">
          {{ changingPwd ? '修改中...' : '修改密码' }}
        </button>
      </div>
    </section>

    <!-- ====== 主题 ====== -->
    <section class="jp-section">
      <div class="jp-card">
        <h3 class="jp-card-title"><i>☀️</i> 主题</h3>
        <ClientOnly>
          <n-skeleton v-if="!themeReady" text :repeat="1" />
          <div v-else class="jp-theme-toggle">
            <button class="jp-theme-item" :class="{ active: themeMode === 'system' }" @click="handleThemeChange('system')">跟随系统</button>
            <button class="jp-theme-item" :class="{ active: themeMode === 'light' }" @click="handleThemeChange('light')">浅色</button>
            <button class="jp-theme-item" :class="{ active: themeMode === 'dark' }" @click="handleThemeChange('dark')">深色</button>
          </div>
        </ClientOnly>
      </div>
    </section>

    <!-- ====== 退出 ====== -->
    <div class="jp-logout" @click="handleLogout">退出登录</div>
    <p class="jp-footer">Elephant Todo v1.0.0 · 🐘</p>
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
const newTagColor = ref('#4a5a75')

async function handleAddTag() {
  if (!newTagName.value.trim()) return
  try {
    await tagsStore.createTag({ name: newTagName.value.trim(), color: newTagColor.value })
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
      if (res?.data?.accessToken && res?.data?.refreshToken) {
        const authStore = useAuthStore()
        const accessTokenCookie = useCookie('accessToken', { maxAge: 60 * 60 * 24 * 7 })
        const refreshTokenCookie = useCookie('refreshToken', { maxAge: 60 * 60 * 24 * 30 })
        accessTokenCookie.value = res.data.accessToken
        refreshTokenCookie.value = res.data.refreshToken
      }
    })

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

<style scoped lang="scss">
/* ========== Settings 页面 — 仅保留页面特有样式 ========== */
/* 通用组件样式(jp-card/jp-btn/jp-list-row等)已沉淀到 main.scss */

/* ========== Header ========== */
.jp-header {
  text-align: center;
  margin-bottom: 24px;
}
.jp-header-content {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 10px 0 0;
}
.jp-header-icon {
  width: 48px;
  opacity: 0.65;
}
.jp-header-title {
  font-size: 26px;
  font-weight: 400;
  letter-spacing: 3px;
  margin: 0;
}
.jp-header-ver {
  font-size: 10px;
  color: var(--color-text-secondary);
  margin: 4px 0 0;
}

/* Premium card */
.jp-card--premium {
  background: var(--color-bg-elevated);
  opacity: 0.8;
}
.jp-premium-badge {
  font-size: 11px;
  margin-left: auto;
  color: var(--color-text-secondary);
  font-weight: 400;
}

/* Form column */
.jp-form-col {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

/* Primary button (金色, settings专用) */
.jp-btn-primary {
  width: 100%;
  height: auto;
  padding: 13px;
  background: var(--color-accent);
  color: var(--color-text-inverse);
  border: none;
  border-radius: var(--radius-sm);
  font-size: 15px;
  font-weight: 400;
  cursor: pointer;
  margin-top: 15px;
  min-height: auto;
  font-family: inherit;
  &:active { opacity: 0.85; }
  &:disabled { opacity: 0.6; cursor: not-allowed; }
}

/* Theme toggle (reuse jp-pill from global) */
.jp-theme-toggle {
  display: flex;
  gap: 8px;
}
.jp-theme-item {
  padding: 7px 18px;
  font-size: 13px;
  border-radius: 14px;
  cursor: pointer;
  color: var(--color-text-secondary);
  background: transparent;
  border: 1px solid var(--color-border);
  min-height: 0 !important;
  min-width: 0 !important;
  line-height: 1.4;
  transition: all var(--transition-fast);
  font-family: inherit;

  &.active {
    background: var(--color-pill-active);
    color: var(--color-text-inverse);
    border-color: var(--color-pill-active);
  }
}

/* Logout */
.jp-logout {
  text-align: center;
  color: var(--color-danger);
  margin-top: 30px;
  font-size: 16px;
  cursor: pointer;
  letter-spacing: 1px;
}

/* Footer */
.jp-footer {
  text-align: center;
  margin-top: 15px;
  padding-bottom: 8px;
  font-size: 10px;
  color: var(--color-text-secondary);
}

/* Naive UI overrides */
:deep(.n-input) {
  --n-border-radius: 6px !important;
  --n-color: var(--color-bg-input) !important;
  --n-color-focus: var(--color-bg-input) !important;
  --n-border: none !important;
  --n-border-hover: none !important;
  --n-border-focus: none !important;
  --n-box-shadow-focus: none !important;
  --n-font-size: 15px !important;
  --n-placeholder-color: var(--color-text-secondary) !important;
  --n-text-color: var(--color-text) !important;
  --n-caret-color: var(--color-accent) !important;
  --n-height: auto !important;
  --n-padding-left: 14px !important;
  --n-padding-right: 14px !important;

  .n-input__input,
  .n-input__textarea {
    padding: 10px 0 !important;
  }
}
:deep(.n-input__eye) {
  color: var(--color-text-secondary) !important;
}
:deep(.n-spin-content) {
  --n-color: var(--color-accent) !important;
}
:deep(.n-skeleton) {
  --n-color: rgba(120, 100, 70, 0.04) !important;
  --n-color-end: rgba(120, 100, 70, 0.08) !important;
}

/* Dark mode overrides (settings-specific) */
:global(.dark) .jp-page,
:global([data-theme='dark']) .jp-page,
:global([data-app-theme='dark']) .jp-page {
  .jp-card--premium {
    background: var(--color-bg-elevated);
    opacity: 0.9;
  }

  .jp-header-icon {
    filter: invert(1);
    opacity: 0.55;
  }

  .jp-theme-item {
    border-color: var(--color-border);
    &.active {
      background: var(--color-pill-active);
      border-color: var(--color-pill-active);
    }
  }

  :deep(.n-skeleton) {
    --n-color: rgba(255, 255, 255, 0.04) !important;
    --n-color-end: rgba(255, 255, 255, 0.08) !important;
  }
}
</style>
