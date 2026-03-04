<template>
  <div class="admin-layout">
    <!-- Sidebar -->
    <aside class="admin-sidebar">
      <div class="sidebar-logo">
        <span class="logo-icon">🐘</span>
        <span class="logo-text">Admin</span>
      </div>

      <nav class="sidebar-nav">
        <NuxtLink to="/admin" class="nav-item" :class="{ active: route.path === '/admin' }">
          <span class="nav-icon">📊</span>
          <span>数据统计</span>
        </NuxtLink>
        <NuxtLink to="/admin/users" class="nav-item" :class="{ active: route.path === '/admin/users' }">
          <span class="nav-icon">👥</span>
          <span>用户管理</span>
        </NuxtLink>
        <NuxtLink to="/admin/products" class="nav-item" :class="{ active: route.path === '/admin/products' }">
          <span class="nav-icon">🛍️</span>
          <span>商品管理</span>
        </NuxtLink>
        <NuxtLink to="/admin/orders" class="nav-item" :class="{ active: route.path === '/admin/orders' }">
          <span class="nav-icon">📋</span>
          <span>订单查看</span>
        </NuxtLink>
        <NuxtLink to="/admin/activities" class="nav-item" :class="{ active: route.path === '/admin/activities' }">
          <span class="nav-icon">🎉</span>
          <span>活动配置</span>
        </NuxtLink>
      </nav>

      <div class="sidebar-footer">
        <div class="admin-info">
          <span class="admin-name">{{ adminAuth.admin?.username }}</span>
          <n-tag :type="adminAuth.isSuperAdmin ? 'success' : 'info'" size="small">
            {{ adminAuth.isSuperAdmin ? '超级管理员' : '运营员' }}
          </n-tag>
        </div>
        <n-button text @click="handleLogout">退出登录</n-button>
      </div>
    </aside>

    <!-- Main Content -->
    <div class="admin-main">
      <header class="admin-header">
        <h2 class="page-title">{{ pageTitle }}</h2>
      </header>
      <div class="admin-content">
        <slot />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
const route = useRoute()
const adminAuth = useAdminAuthStore()

const pageTitle = computed(() => {
  const titles: Record<string, string> = {
    '/admin': '数据统计',
    '/admin/users': '用户管理',
    '/admin/products': '商品管理',
    '/admin/orders': '订单查看',
    '/admin/activities': '活动配置',
  }
  return titles[route.path] || '管理后台'
})

function handleLogout() {
  adminAuth.logout()
  navigateTo('/admin/login')
}
</script>

<style lang="scss" scoped>
.admin-layout {
  display: flex;
  min-height: 100vh;
  background: #f5f5f5;
}

.admin-sidebar {
  width: 220px;
  background: #1e1e2e;
  color: #cdd6f4;
  display: flex;
  flex-direction: column;
  flex-shrink: 0;
}

.sidebar-logo {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 20px 16px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);

  .logo-icon {
    font-size: 28px;
  }

  .logo-text {
    font-size: 18px;
    font-weight: 700;
    color: #fff;
    letter-spacing: 1px;
  }
}

.sidebar-nav {
  flex: 1;
  padding: 12px 8px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.nav-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  border-radius: 8px;
  color: #a6adc8;
  text-decoration: none;
  font-size: 14px;
  transition: all 0.15s;

  &:hover {
    background: rgba(255, 255, 255, 0.06);
    color: #cdd6f4;
  }

  &.active {
    background: #6366f1;
    color: #fff;
  }

  .nav-icon {
    font-size: 18px;
    width: 24px;
    text-align: center;
  }
}

.sidebar-footer {
  padding: 16px;
  border-top: 1px solid rgba(255, 255, 255, 0.08);
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.admin-info {
  display: flex;
  align-items: center;
  gap: 8px;

  .admin-name {
    font-size: 13px;
    color: #fff;
    font-weight: 500;
  }
}

.admin-main {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: auto;
}

.admin-header {
  padding: 20px 32px;
  background: #fff;
  border-bottom: 1px solid #e5e7eb;

  .page-title {
    margin: 0;
    font-size: 20px;
    font-weight: 600;
    color: #1f2937;
  }
}

.admin-content {
  flex: 1;
  padding: 24px 32px;
}
</style>
