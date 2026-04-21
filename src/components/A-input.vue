<script setup>
import { computed, watch, ref } from 'vue'

const isTouched = ref(false)

const emit = defineEmits(['isValid'])

const model = defineModel()

const props = defineProps({
  id: { type: String },
  placeholder: { type: String, default: '' },
  type: { type: String, default: 'text' },
  loading: { type: Boolean, default: false },
  regexp: { type: String, default: '^.+$' },
  validationMessage: { type: String, default: 'Нужно заполнить' },
  validate: { type: Boolean, default: false },
})

// Функция проверки валидности
function checkValidity(value) {
  if (!isTouched.value) return false
  if (!props.validate) return true

  // Если поле пустое
  if (!value || value.trim().length === 0) return false

  try {
    const pattern = new RegExp(props.regexp)
    return pattern.test(value)
  } catch (e) {
    console.log('Ошибка в регулярном выражении:', e)
    return false
  }
}

const isValidComputed = computed(() => checkValidity(model.value))

const validationMessageComputed = computed(() => {
  // Если поле не тронуто
  if (!isTouched.value) return ''
  // Если валидация выключена — нет ошибки
  if (!props.validate) return ''
  // Если поле валидно — нет ошибки
  if (isValidComputed.value) return ''
  // Во всех остальных случаях показываем сообщение
  return props.validationMessage
})

watch(
  isValidComputed,
  (valid) => {
    emit('isValid', valid) // Эмитим и true, и false
  },
  { immediate: false }, // ✅ Важно! Отправить начальное состояние сразу
)
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
      @focus="isTouched = true"
    />
    <div v-if="loading" class="loader"></div>
    <p class="valid-error" v-if="!isValidComputed">{{ validationMessageComputed }}</p>
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

.loader {
  position: relative;
  width: 0%;
  height: 1px;
  background-color: rgb(116, 116, 116);
  animation: loader 1s ease-in-out infinite;
}

.loader::after {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  width: 0%;
  height: 100%;
  background-color: white;
  animation: inherit;
  animation-timing-function: ease-out;
}

.valid-error {
  font-weight: 200;
  font-size: 14px;
  color: red;
}

@keyframes loader {
  0% {
    width: 0%;
  }

  75% {
    width: 100%;
  }

  100% {
    width: 100%;
  }
}
</style>
