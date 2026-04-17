<template>
  <div class="toast-container">
    <div v-for="toast in toasts" :key="toast.id" :class="['toast', `toast-${toast.type}`]">
      {{ toast.message }}
    </div>
  </div>
</template>

<script setup>
import { useToast } from '@/composables/useToast'

const { toasts } = useToast()
</script>

<style scoped>
.toast-container {
  position: fixed;
  top: 100px;
  right: 20px;
  z-index: 9999;
}

.toast {
  padding: 12px 24px;
  margin-bottom: 10px;
  border-radius: 8px;
  color: white;
  animation: slideIn 0.5s ease;
}

.toast-success {
  background-color: #3e9241;
}
.toast-error {
  background-color: #c20d00;
}
.toast-info {
  background-color: #1d5888;
}
.toast-warning {
  background-color: #b86e00;
}

@keyframes slideIn {
  from {
    transform: translateX(100%);
    opacity: 0;
  }
  to {
    transform: translateX(0);
    opacity: 1;
  }
}
</style>
