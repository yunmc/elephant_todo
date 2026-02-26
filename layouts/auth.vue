<template>
  <div class="auth-layout">
    <div class="auth-container">
      <div class="auth-logo">
        <div class="logo-circle">
          <span class="logo-icon">🐘</span>
        </div>
        <h1 class="logo-text">Elephant Todo</h1>
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
  padding-top: calc(24px + var(--safe-area-top));
  padding-bottom: calc(24px + var(--safe-area-bottom));
}

.auth-container {
  width: 100%;
  max-width: 380px;
}

.auth-logo {
  text-align: center;
  margin-bottom: 32px;
}

.logo-circle {
  width: 72px;
  height: 72px;
  border-radius: 20px;
  background: linear-gradient(135deg, #eef2ff, #e0e7ff);
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 0 auto 12px;
}

.dark .logo-circle,
[data-theme='dark'] .logo-circle {
  background: linear-gradient(135deg, #312e81, #3730a3);
}

.logo-icon {
  font-size: 36px;
  line-height: 1;
}

.logo-text {
  font-size: 22px;
  font-weight: 700;
  color: var(--color-text);
  letter-spacing: -0.3px;
}

.logo-subtitle {
  font-size: 13px;
  color: var(--color-text-secondary);
  margin-top: 4px;
}
</style>
