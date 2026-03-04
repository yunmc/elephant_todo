<template>
  <div class="admin-login">
    <div class="login-card">
      <div class="login-header">
        <span class="logo-icon">🐘</span>
        <h1>Elephant Admin</h1>
        <p>管理后台登录</p>
      </div>

      <n-form ref="formRef" :model="form" :rules="rules" @submit.prevent="handleLogin">
        <n-form-item label="用户名" path="username">
          <n-input v-model:value="form.username" placeholder="请输入管理员用户名" autofocus />
        </n-form-item>

        <n-form-item label="密码" path="password">
          <n-input v-model:value="form.password" type="password" show-password-on="click" placeholder="请输入密码" @keyup.enter="handleLogin" />
        </n-form-item>

        <n-button type="primary" block :loading="adminAuth.loading" @click="handleLogin" style="margin-top: 8px;">
          登录
        </n-button>
      </n-form>
    </div>
  </div>
</template>

<script setup lang="ts">
definePageMeta({
  layout: false,
})

const adminAuth = useAdminAuthStore()
const message = useMessage()

// If already logged in, redirect
if (adminAuth.isLoggedIn) {
  navigateTo('/admin')
}

const form = reactive({
  username: '',
  password: '',
})

const rules = {
  username: { required: true, message: '请输入用户名', trigger: 'blur' },
  password: { required: true, message: '请输入密码', trigger: 'blur' },
}

const formRef = ref()

async function handleLogin() {
  try {
    await formRef.value?.validate()
  } catch { return }

  const result = await adminAuth.login(form.username, form.password)
  if (result.success) {
    message.success('登录成功')
    navigateTo('/admin')
  } else {
    message.error(result.message || '登录失败')
  }
}
</script>

<style lang="scss" scoped>
.admin-login {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #1e1e2e 0%, #2d2b55 100%);
}

.login-card {
  width: 100%;
  max-width: 400px;
  background: #fff;
  border-radius: 16px;
  padding: 40px 32px;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
}

.login-header {
  text-align: center;
  margin-bottom: 32px;

  .logo-icon {
    font-size: 48px;
    display: block;
    margin-bottom: 12px;
  }

  h1 {
    margin: 0;
    font-size: 24px;
    font-weight: 700;
    color: #1f2937;
  }

  p {
    margin: 4px 0 0;
    font-size: 14px;
    color: #6b7280;
  }
}
</style>
