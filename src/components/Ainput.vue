<script setup>
const model = defineModel()

const props = defineProps({
  placeholder: { type: String, default: '' },
  type: { type: String, default: 'text' },
})
</script>

<template>
  <input
    class="input"
    :placeholder="props.placeholder"
    :type="props.type"
    v-model="model"
    autocomplete="off"
  />
</template>

<style scoped>
.input {
  /* Базовые стили */
  display: flex;
  padding: 12px 16px;
  font-size: 16px;
  border-radius: 8px;
  border-style: solid;
  border-width: 1px;
  border-color: #d9d9d9;
  cursor: pointer;
}
</style>
