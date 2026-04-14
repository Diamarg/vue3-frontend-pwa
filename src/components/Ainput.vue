<script setup>
const model = defineModel()

const props = defineProps({
  placeholder: { type: String, default: '' },
  type: { type: String, default: 'text' },
})
</script>

<template>
  <input class="input" :placeholder="props.placeholder" :type="props.type" v-model="model" />
</template>

<style scoped>
.input {
  /* Базовые стили кнопки */
  font: var(--md-sys-typescale-font-family);
  padding: 10px 20px;
  border-radius: var(--md-sys-shape-corner-medium);
  border: none;
  font-weight: 500;
  cursor: pointer;
  background-color: var(--md-sys-color-surface-container-highest);
  box-shadow: var(--md-sys-elevation-0);
  transition: var(--md-sys-motion-duration-short);
}

.input:hover {
  box-shadow: var(--md-sys-elevation-1);
  background-color: color-mix(
    in srgb,
    var(--md-sys-color-on-surface) 8%,
    var(--md-sys-color-surface-container-highest)
  );
}

.input:focus {
  box-shadow: var(--md-sys-elevation-1);
  background-color: color-mix(
    in srgb,
    var(--md-sys-color-primary) 8%,
    var(--md-sys-color-surface-container-highest)
  );
}
</style>
