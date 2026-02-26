<template>
  <div>
    <NuxtLayout name="auth">
      <n-card>
        <template #header>
          <div style="text-align: center; font-size: 18px; font-weight: 600;">登录</div>
        </template>

        <n-form ref="formRef" :model="form" :rules="rules" @submit.prevent="handleLogin">
          <n-form-item label="邮箱" path="email">
            <n-input v-model:value="form.email" placeholder="请输入邮箱" type="email" autocomplete="email" />
          </n-form-item>
          <n-form-item label="密码" path="password">
            <n-input v-model:value="form.password" type="password" placeholder="请输入密码" show-password-on="click" autocomplete="current-password" />
          </n-form-item>
          <n-button type="primary" block :loading="authStore.loading || submitting" attr-type="submit" @click="handleLogin">
            登录
          </n-button>
        </n-form>

        <n-space justify="space-between" style="margin-top: 16px;">
          <NuxtLink to="/forgot-password"><n-text type="info">忘记密码？</n-text></NuxtLink>
          <NuxtLink to="/register"><n-text type="info">没有账号？注册</n-text></NuxtLink>
        </n-space>
      </n-card>
    </NuxtLayout>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ layout: false })

const authStore = useAuthStore()
const router = useRouter()
const message = useMessage()

const form = reactive({ email: '', password: '' })
const rules = {
  email: { required: true, message: '请输入邮箱', trigger: 'blur' },
  password: { required: true, message: '请输入密码', trigger: 'blur' },
}

const submitting = ref(false)

async function handleLogin() {
  if (submitting.value) return
  submitting.value = true
  try {
    const success = await authStore.login(form.email, form.password)
    if (success) {
      router.push('/')
    } else {
      message.error('邮箱或密码错误')
    }
  } finally {
    submitting.value = false
  }
}
</script>
