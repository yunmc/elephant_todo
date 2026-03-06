<template>
  <div class="auth-layout">
    <div class="auth-container">
      <div class="auth-logo">
        <img src="/logo.png" alt="Elephant Todo" class="logo-img" />
        <p class="logo-subtitle">高效管理你的每一天</p>
      </div>
      <slot />
    </div>
  </div>
</template>

<style lang="scss" scoped>
.auth-layout {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--color-bg);
  padding: 24px 16px;
  padding-top: max(24px, calc(env(safe-area-inset-top, 0px) + 12px));
  padding-bottom: max(24px, calc(env(safe-area-inset-bottom, 0px) + 12px));
}

.auth-container {
  width: 100%;
  max-width: 380px;
}

.auth-logo {
  text-align: center;
  margin-bottom: 32px;
}

.logo-img {
  width: 80px;
  height: 80px;
  border-radius: 20px;
  margin: 0 auto 12px;
  display: block;
}

.logo-subtitle {
  font-size: 13px;
  color: var(--color-text-secondary);
  margin-top: 4px;
}
</style>
