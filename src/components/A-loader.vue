<script setup>
const props = defineProps({
  enable: { type: Boolean, default: false },
})
</script>

<template>
  <div v-if="enable" class="loader"></div>
</template>

<style scoped>
.loader {
  position: relative;
  width: 0%;
  height: 2px;
  background-color: rgb(219, 219, 219);
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
