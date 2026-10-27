<script setup>
import { ref } from 'vue'

const props = defineProps({
  accept: { type: String, default: '' },
  multiple: { type: Boolean, default: false },
  disabled: { type: Boolean, default: false },
  hint: { type: String, default: '' },
})

const emit = defineEmits(['select'])

const inputEl = ref(null)
const isDragging = ref(false)

// Нативный input после выбора держит тот же файл, и повторный выбор того же
// имени не вызвал бы change — обнуляем value каждый раз
const pick = () => {
  if (props.disabled) return
  inputEl.value?.click()
}

const matchesAccept = (file) => {
  if (!props.accept) return true
  return props.accept
    .split(',')
    .map((pattern) => pattern.trim().toLowerCase())
    .filter(Boolean)
    .some((pattern) => {
      if (pattern.endsWith('/*')) return file.type.toLowerCase().startsWith(pattern.slice(0, -1))
      if (pattern.startsWith('.')) return file.name.toLowerCase().endsWith(pattern)
      return file.type.toLowerCase() === pattern
    })
}

const onNativeChange = (event) => {
  emitSelect(event.target.files)
  event.target.value = ''
}

const emitSelect = (list) => {
  const files = Array.from(list).filter(matchesAccept)
  if (files.length === 0) return
  emit('select', props.multiple ? files : files.slice(0, 1))
}

const onDrop = (event) => {
  isDragging.value = false
  if (props.disabled) return
  emitSelect(event.dataTransfer.files)
}
</script>

<template>
  <!-- Один корень: при двух Vue не пробрасывает class родителя на компонент -->
  <div class="file-input-wrap">
    <button
      type="button"
      class="file-input"
      :class="{ 'file-input--dragging': isDragging, 'file-input--disabled': disabled }"
      :disabled="disabled"
      @click="pick"
      @dragover.prevent="!disabled && (isDragging = true)"
      @dragleave="isDragging = false"
      @drop.prevent="onDrop"
    >
      <span class="file-input__icon" aria-hidden="true">
        <svg
          viewBox="0 0 24 24"
          width="22"
          height="22"
          fill="none"
          stroke="currentColor"
          stroke-width="1.8"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <path d="M12 16V4" />
          <polyline points="6 10 12 4 18 10" />
          <path d="M4 17v2a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-2" />
        </svg>
      </span>
      <span class="file-input__text">
        <span class="file-input__label">
          {{ isDragging ? 'Отпустите файлы' : 'Выбрать файлы' }}
        </span>
        <span class="file-input__hint">
          {{ hint || 'Перетащите файл сюда или нажмите, чтобы открыть проводник' }}
        </span>
      </span>
    </button>

    <input
      ref="inputEl"
      class="file-input__native"
      type="file"
      :accept="accept"
      :multiple="multiple"
      :disabled="disabled"
      tabindex="-1"
      aria-hidden="true"
      @change="onNativeChange"
    />
  </div>
</template>

<style scoped>
.file-input-wrap {
  position: relative;
  display: block;
}

.file-input {
  display: flex;
  align-items: center;
  gap: 12px;
  width: 100%;
  padding: 14px 16px;
  text-align: left;
  cursor: pointer;
  background-color: #f8fafc;
  border: 1px dashed #c7d2fe;
  border-radius: 8px;
  transition:
    background-color 0.2s,
    border-color 0.2s;
}

.file-input:hover:not(.file-input--disabled) {
  background-color: #eef2ff;
  border-color: #6366f1;
}

.file-input--dragging {
  background-color: #eef2ff;
  border-color: #4f46e5;
}

.file-input--disabled {
  cursor: default;
  opacity: 0.6;
}

.file-input__icon {
  display: flex;
  flex-shrink: 0;
  color: #4f46e5;
}

.file-input__text {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.file-input__label {
  font-size: 14px;
  font-weight: 500;
  color: #374151;
}

.file-input__hint {
  font-size: 12px;
  color: #6b7280;
}

/* Нативный инпут остаётся в DOM для programmatic click, но не показывается */
.file-input__native {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0 0 0 0);
  white-space: nowrap;
  border: 0;
}
</style>
