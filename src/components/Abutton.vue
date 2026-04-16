<script setup>
const props = defineProps({
  variant: { type: String, default: 'primary' },
  type: { type: String },
})
</script>

<template>
  <button :class="['btn', `btn-${props.variant}`]" :type="props.type">
    <slot />
  </button>
</template>

<style scoped>
.btn {
  /* Базовые стили кнопки */
  border: none;
  font-weight: 300;
  cursor: pointer;
  font-size: 16px;
  min-height: 40px;
  border-radius: 8px;
  border-width: 1px;
  border-style: solid;
  transition: var(--md-sys-motion-duration-short);
  padding-inline: 24px;
}

.btn-primary {
  color: rgb(255, 255, 255);
  background-color: rgb(31, 31, 31);
  border-color: rgb(31, 31, 31);
}

.btn-primary:hover {
  color: rgb(41, 41, 41);
  background-color: rgb(255, 255, 255);
  border-color: rgb(209, 209, 209);
}

.btn-secondary {
  color: var(--md-sys-color-on-secondary-container);
  background-color: rgb(31, 31, 31);
}

.btn-succeed {
  color: var(--md-sys-color-on-tertiary);
}

.btn-danger {
  color: var(--md-sys-color-on-error);
}
</style>
