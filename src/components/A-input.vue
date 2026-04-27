<script setup>
import { computed, watch, ref } from 'vue'

const emit = defineEmits(['onTouch'])

const model = defineModel()

const props = defineProps({
  id: { type: String },
  placeholder: { type: String, default: '' },
  type: { type: String, default: 'text' },
})
</script>

<template>
  <div>
    <input
      :id="id"
      class="input"
      :placeholder="props.placeholder"
      :type="props.type"
      v-model="model"
      autocomplete="off"
      @input="$emit('onTouch')"
    />
  </div>
</template>

<style scoped>
.input {
  /* Базовые стили */
  display: flex;
  padding: 8px 16px;
  font-size: 16px;
  font-weight: 200;
  border-radius: 8px;
  border-style: solid;
  border-width: 1px;
  border-color: #d9d9d9;
  cursor: pointer;
  min-height: 30px;
  width: 100%;
}

.valid-error {
  font-weight: 200;
  font-size: 13px;
  color: red;
}
</style>
