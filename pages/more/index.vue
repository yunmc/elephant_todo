<template>
  <div class="page-container">
    <h1 class="page-title">更多功能</h1>

    <div class="feature-grid">
      <NuxtLink to="/vault" class="feature-card">
        <span class="feature-icon">🔐</span>
        <span class="feature-name">密码本</span>
        <span class="feature-desc">安全管理密码</span>
      </NuxtLink>

      <NuxtLink to="/finance" class="feature-card">
        <span class="feature-icon">💰</span>
        <span class="feature-name">记账</span>
        <span class="feature-desc">收支记录与统计</span>
      </NuxtLink>

      <NuxtLink to="/important-dates" class="feature-card">
        <span class="feature-icon">📅</span>
        <span class="feature-name">重要日期</span>
        <span class="feature-desc">生日纪念日倒计时</span>
      </NuxtLink>

      <NuxtLink to="/period" class="feature-card">
        <span class="feature-icon">🌸</span>
        <span class="feature-name">经期追踪</span>
        <span class="feature-desc">记录与预测周期</span>
      </NuxtLink>

      <NuxtLink to="/settings" class="feature-card">
        <span class="feature-icon">⚙️</span>
        <span class="feature-name">设置</span>
        <span class="feature-desc">主题·分类·标签·密码</span>
      </NuxtLink>
    </div>
  </div>
</template>

<style scoped>
.feature-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 12px;
}

.feature-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 24px 16px;
  background: var(--color-bg-card);
  border-radius: var(--radius-md, 12px);
  text-decoration: none;
  cursor: pointer;
  transition: background var(--transition-fast), transform var(--transition-fast);
  -webkit-tap-highlight-color: transparent;
}
.feature-card:active {
  background: var(--color-bg-elevated);
  transform: scale(0.97);
}

.feature-icon {
  font-size: 36px;
  margin-bottom: 10px;
}

.feature-name {
  font-size: 15px;
  font-weight: 600;
  color: var(--color-text);
  margin-bottom: 4px;
}

.feature-desc {
  font-size: 12px;
  color: var(--color-text-muted);
  text-align: center;
}
</style>
