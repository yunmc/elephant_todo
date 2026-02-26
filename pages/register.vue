<template>
  <div>
    <NuxtLayout name="auth">
      <n-card>
        <template #header>
          <div style="text-align: center; font-size: 18px; font-weight: 600;">注册</div>
        </template>

        <n-form :model="form" @submit.prevent="handleRegister">
          <n-form-item label="用户名">
            <n-input v-model:value="form.username" placeholder="请输入用户名" autocomplete="username" />
          </n-form-item>
          <n-form-item label="邮箱">
            <n-input v-model:value="form.email" placeholder="请输入邮箱" type="email" autocomplete="email" />
          </n-form-item>
          <n-form-item label="密码">
            <n-input v-model:value="form.password" type="password" placeholder="请输入密码（至少6位）" show-password-on="click" autocomplete="new-password" />
          </n-form-item>
          <n-form-item label="确认密码">
            <n-input v-model:value="form.confirmPassword" type="password" placeholder="请再次输入密码" show-password-on="click" autocomplete="new-password" />
          </n-form-item>
          <n-button type="primary" block :loading="authStore.loading || submitting" attr-type="submit" @click="handleRegister">
            注册
          </n-button>
        </n-form>

        <div style="text-align: center; margin-top: 16px;">
          <NuxtLink to="/login"><n-text type="info">已有账号？登录</n-text></NuxtLink>
        </div>
      </n-card>
    </NuxtLayout>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ layout: false })

const authStore = useAuthStore()
const router = useRouter()
const message = useMessage()

const form = reactive({
  username: '',
  email: '',
  password: '',
  confirmPassword: '',
})

const submitting = ref(false)

async function handleRegister() {
  if (submitting.value) return
  if (form.password !== form.confirmPassword) {
    message.error('两次输入的密码不一致')
    return
  }
  if (form.password.length < 6) {
    message.error('密码长度不能少于6位')
    return
  }
  submitting.value = true
  try {
    const success = await authStore.register(form.username, form.email, form.password)
    if (success) {
      router.push('/')
    } else {
      message.error('注册失败，用户名或邮箱已被注册')
    }
  } finally {
    submitting.value = false
  }
}
</script>
