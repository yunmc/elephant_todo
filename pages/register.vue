<template>
  <div>
    <NuxtLayout name="auth">
      <n-card>
        <template #header>
          <div style="text-align: center; font-size: 18px; font-weight: 600;">注册</div>
        </template>

        <n-form ref="formRef" :model="form" :rules="rules" @submit.prevent="handleRegister">
          <n-form-item label="用户名" path="username">
            <n-input v-model:value="form.username" placeholder="请输入用户名" autocomplete="username" />
          </n-form-item>
          <n-form-item label="邮箱" path="email">
            <n-input v-model:value="form.email" placeholder="请输入邮箱" type="email" autocomplete="email" />
          </n-form-item>
          <n-form-item label="密码" path="password">
            <n-input v-model:value="form.password" type="password" placeholder="请输入密码（至少6位）" show-password-on="click" autocomplete="new-password" />
          </n-form-item>
          <n-form-item label="确认密码" path="confirmPassword">
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

const formRef = ref<any>(null)
const rules = {
  username: { required: true, message: '请输入用户名', trigger: 'blur' },
  email: [
    { required: true, message: '请输入邮箱', trigger: 'blur' },
    { type: 'email', message: '请输入有效的邮箱地址', trigger: 'blur' },
  ],
  password: [
    { required: true, message: '请输入密码', trigger: 'blur' },
    { min: 6, message: '密码长度不能少于6位', trigger: 'blur' },
  ],
  confirmPassword: [
    { required: true, message: '请再次输入密码', trigger: 'blur' },
    {
      validator: (_rule: any, value: string) => value === form.password,
      message: '两次输入的密码不一致',
      trigger: 'blur',
    },
  ],
}

const submitting = ref(false)

async function handleRegister() {
  if (submitting.value) return
  try {
    await formRef.value?.validate()
  } catch {
    return
  }
  submitting.value = true
  try {
    const result = await authStore.register(form.username, form.email, form.password)
    if (result.success) {
      router.push('/')
    } else {
      message.error(result.message || '注册失败')
    }
  } finally {
    submitting.value = false
  }
}
</script>
