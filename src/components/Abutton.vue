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
  font: var(--md-sys-typescale-font-family);
  padding: 10px 20px;
  border-radius: var(--md-sys-shape-corner-medium);
  border: none;
  font-weight: 500;
  cursor: pointer;
  box-shadow: var(--md-sys-elevation-0);
  transition: var(--md-sys-motion-duration-short);
}

.btn:hover {
  box-shadow: var(--md-sys-elevation-2);
}

.btn-primary {
  background-color: var(--md-sys-color-primary);
  color: var(--md-sys-color-on-primary);
}

.btn-secondary {
  background-color: var(--md-sys-color-secondary-container);
  color: var(--md-sys-color-on-secondary-container);
}

.btn-succeed {
  background-color: var(--md-sys-color-tertiary);
  color: var(--md-sys-color-on-tertiary);
}

.btn-danger {
  background-color: var(--md-sys-color-error);
  color: var(--md-sys-color-on-error);
}
</style>
