<template>
  <div>
    <NuxtLayout name="auth">
      <n-card>
        <template #header>
          <div style="text-align: center; font-size: 18px; font-weight: 600;">忘记密码</div>
        </template>

        <n-result v-if="sent" status="success" title="邮件已发送" description="请检查您的邮箱，点击链接重置密码">
          <template #footer>
            <NuxtLink to="/login"><n-button type="primary">返回登录</n-button></NuxtLink>
          </template>
        </n-result>

        <n-form v-else @submit.prevent="handleSubmit">
          <n-form-item label="邮箱">
            <n-input v-model:value="email" placeholder="请输入注册邮箱" type="email" autocomplete="email" />
          </n-form-item>
          <n-button type="primary" block :loading="loading" attr-type="submit" @click="handleSubmit">
            发送重置链接
          </n-button>
        </n-form>

        <div style="text-align: center; margin-top: 16px;">
          <NuxtLink to="/login"><n-text type="info">返回登录</n-text></NuxtLink>
        </div>
      </n-card>
    </NuxtLayout>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ layout: false })

const message = useMessage()
const email = ref('')
const loading = ref(false)
const sent = ref(false)

async function handleSubmit() {
  if (!email.value.trim()) {
    message.warning('请输入邮箱')
    return
  }
  loading.value = true
  try {
    await $fetch('/api/auth/forgot-password', {
      method: 'POST',
      body: { email: email.value },
    })
    sent.value = true
  } catch (err: any) {
    message.error(err?.data?.message || '发送失败，请稍后重试')
  } finally {
    loading.value = false
  }
}
</script>
