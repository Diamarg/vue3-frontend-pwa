<script setup>
const props = defineProps({
  variant: { type: String, default: 'primary' },
  type: { type: String },
  disabled: { type: Boolean, default: false },
})
</script>

<template>
  <div :class="['btn', `btn-${props.variant}`, `btn-disabled-${disabled}`]">
    <button :disabled="props.disabled" :type="props.type">
      <slot />
    </button>
  </div>
</template>

<style scoped>
.btn {
  display: flex;
  border: none;
  font-weight: 300;
  cursor: pointer;
  font-size: 16px;
  min-height: 30px;
  border-radius: 8px;
  border-width: 1px;
  border-style: solid;
  transition: var(--md-sys-motion-duration-short);
  padding: 8px 16px;
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

.btn-disabled-true {
  background-color: rgb(175, 175, 175);
  color: aliceblue;
  border: none;
  cursor: default;
}
.btn-disabled-true:hover {
  background-color: rgb(175, 175, 175);
  color: rgb(255, 255, 255);
  border: none;
  cursor: default;
}
</style>
