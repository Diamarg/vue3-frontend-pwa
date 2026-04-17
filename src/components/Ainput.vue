<script setup>
const model = defineModel()

const props = defineProps({
  id: { type: String },
  placeholder: { type: String, default: '' },
  type: { type: String, default: 'text' },
  loading: { type: Boolean, default: false },
  invalidMessage: { type: String, default: '' },
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
    />
    <div v-if="loading" class="loader"></div>
    <p class="valid-error" v-if="invalidMessage">{{ invalidMessage }}</p>
  </div>
</template>

<style scoped>
.input {
  /* Базовые стили */
  display: flex;
  padding: 12px 16px;
  font-size: 16px;
  font-weight: 200;
  border-radius: 8px;
  border-style: solid;
  border-width: 1px;
  border-color: #d9d9d9;
  cursor: pointer;
  min-height: 40px;
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
