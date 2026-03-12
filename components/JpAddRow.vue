<template>
  <div class="jp-add-row">
    <!-- 前置插槽：emoji 选择器等 -->
    <slot name="prepend" />
    <!-- 输入框 -->
    <input
      ref="inputRef"
      v-model="model"
      class="jp-add-input"
      :placeholder="placeholder"
      :maxlength="maxlength"
      @keyup.enter="$emit('submit')"
    />
    <!-- 后置插槽：颜色选择器等 -->
    <slot name="append" />
    <!-- 按钮 -->
    <button class="jp-btn" :disabled="!model.trim()" @click="$emit('submit')">
      {{ btnText }}
    </button>
  </div>
</template>

<script setup lang="ts">
const model = defineModel<string>({ default: '' })

withDefaults(defineProps<{
  placeholder?: string
  btnText?: string
  maxlength?: number
}>(), {
  placeholder: '请输入...',
  btnText: '添加',
  maxlength: 100,
})

defineEmits<{
  submit: []
}>()

const inputRef = ref<HTMLInputElement>()

defineExpose({ focus: () => inputRef.value?.focus() })
</script>
