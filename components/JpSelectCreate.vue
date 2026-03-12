<template>
  <div class="jp-select-create">
    <input
      v-model="model"
      class="jp-select-create-input"
      :placeholder="placeholder"
      @keyup.enter="$emit('submit')"
    />
    <button class="jp-select-create-btn" :disabled="!model.trim()" @click="$emit('submit')">
      {{ btnText }}
    </button>
  </div>
</template>

<script setup lang="ts">
const model = defineModel<string>({ default: '' })

withDefaults(defineProps<{
  placeholder?: string
  btnText?: string
}>(), {
  placeholder: '输入名称',
  btnText: '添加',
})

defineEmits<{
  submit: []
}>()
</script>
