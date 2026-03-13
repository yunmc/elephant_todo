<template>
  <div>
    <NuxtLayout name="auth">
      <n-card>
        <template #header>
          <div style="text-align: center; font-size: 18px; font-weight: 600;">重置密码</div>
        </template>

        <n-result v-if="tokenMissing" status="error" title="无效的重置链接" description="缺少重置令牌，请通过邮件中的链接访问此页面">
          <template #footer>
            <NuxtLink to="/forgot-password"><n-button type="primary">重新发送重置邮件</n-button></NuxtLink>
          </template>
        </n-result>

        <n-result v-else-if="successMsg" status="success" :title="successMsg">
          <template #footer>
            <NuxtLink to="/login"><n-button type="primary">前往登录</n-button></NuxtLink>
          </template>
        </n-result>

        <n-form v-else @submit.prevent="handleReset">
          <n-form-item label="新密码">
            <n-input v-model:value="form.password" type="password" placeholder="请输入新密码（至少6位）" show-password-on="click" autocomplete="new-password" />
          </n-form-item>
          <n-form-item label="确认新密码">
            <n-input v-model:value="form.confirmPassword" type="password" placeholder="请再次输入新密码" show-password-on="click" autocomplete="new-password" />
          </n-form-item>
          <n-button type="primary" block :loading="loading" attr-type="submit" @click="handleReset">
            重置密码
          </n-button>
        </n-form>

      </n-card>
    </NuxtLayout>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ layout: false })

const route = useRoute()
const message = useMessage()
const token = computed(() => route.query.token as string)

const form = reactive({ password: '', confirmPassword: '' })
const loading = ref(false)
const successMsg = ref('')
const tokenMissing = ref(false)

onMounted(() => {
  if (!token.value) {
    tokenMissing.value = true
  }
})

async function handleReset() {
  if (!token.value) {
    message.error('无效的重置链接')
    return
  }
  if (form.password !== form.confirmPassword) {
    message.error('两次输入的密码不一致')
    return
  }
  if (form.password.length < 6) {
    message.error('密码长度不能少于6位')
    return
  }
  loading.value = true
  try {
    await $fetch('/api/auth/reset-password', {
      method: 'POST',
      body: { token: token.value, password: form.password },
    })
    successMsg.value = '密码已重置成功！'
  } catch (err: any) {
    message.error(err?.data?.message || '重置失败，链接可能已过期')
  } finally {
    loading.value = false
  }
}
</script>
