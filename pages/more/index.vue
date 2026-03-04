<template>
  <div class="page-container">
    <h1 class="page-title">更多功能</h1>

    <div class="feature-grid">
      <NuxtLink to="/shop" class="feature-card">
        <span class="feature-icon">🏪</span>
        <span class="feature-name">手帐商店</span>
        <span class="feature-desc">皮肤·贴纸·字体</span>
      </NuxtLink>

      <NuxtLink to="/shop/inventory" class="feature-card">
        <span class="feature-icon">🎒</span>
        <span class="feature-name">我的仓库</span>
        <span class="feature-desc">已购商品·装扮搭配</span>
      </NuxtLink>

      <NuxtLink to="/vault" class="feature-card">
        <span class="feature-icon">🔐</span>
        <span class="feature-name">密码本</span>
        <span class="feature-desc">安全存储密码</span>
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

      <NuxtLink to="/ai/report" class="feature-card">
        <span class="feature-icon">🤖</span>
        <span class="feature-name">AI 报告</span>
        <span class="feature-desc">月度·年度智能分析</span>
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
