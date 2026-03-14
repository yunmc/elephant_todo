<template>
  <!-- TODO: 支付功能就绪后恢复 @click="guardPremium()" 和箭头 -->
  <div class="jp-premium-upsell" style="cursor: default;">
    <span class="jp-premium-upsell-icon">{{ icon }}</span>
    <div class="jp-premium-upsell-body">
      <div class="jp-premium-upsell-title">{{ title }}</div>
      <div class="jp-premium-upsell-desc">{{ description }}</div>
    </div>
  </div>
</template>

<script setup lang="ts">
withDefaults(defineProps<{
  icon?: string
  title?: string
  description?: string
}>(), {
  icon: '✨',
  title: '升级会员',
  description: '解锁全部高级功能',
})
</script>
