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
  top: 90%;
  right: 20px;
  z-index: 9999;
}

.toast {
  padding: 12px 24px;
  margin-bottom: 10px;
  border-radius: 8px;
  color: white;
  animation: slideIn 0.3s ease;
}

.toast-success {
  background-color: #4caf50;
}
.toast-error {
  background-color: #f44336;
}
.toast-info {
  background-color: #2196f3;
}
.toast-warning {
  background-color: #ff9800;
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
