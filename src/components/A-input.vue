<script setup>
import { computed, watch, ref } from 'vue'

const isTouched = ref(false)

const emit = defineEmits(['onValid'])

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
    emit('onValid', valid) // Эмитим и true, и false
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
    <p class="valid-error">{{ validationMessageComputed }}</p>
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
