<script setup>
import { Transition } from 'vue'

const props = defineProps({
  title: { type: String, default: 'Заголовок' },
  opened: { type: Boolean, default: false },
})
</script>

<template>
  <transition name="modal-fade">
    <div v-if="opened" class="modal__overlay">
      <!-- Само модальное окно -->

      <div class="modal__wrapper">
        <div class="modal__header">
          <h2 class="modal__title">{{ title }}</h2>
          <button class="modal__close" @click="$emit('closeEmit')">&times;</button>
        </div>
        <div>
          <div class="modal__content">
            <slot></slot>
          </div>
        </div>
      </div>
    </div>
  </transition>
</template>

<style scoped>
/* Анимация для оверлея (плавное появление/исчезновение) */
.modal-fade-enter-active,
.modal-fade-leave-active {
  transition: opacity 0.5s cubic-bezier(0.075, 0.82, 0.165, 1);
}

.modal-fade-enter-from,
.modal-fade-leave-to {
  opacity: 0;
}

/* Анимация для wrapper (масштабирование) */
.modal-fade-enter-active .modal__wrapper,
.modal-fade-leave-active .modal__wrapper {
  transition: transform 0.5s cubic-bezier(0.075, 0.82, 0.165, 1);
}

.modal-fade-enter-from .modal__wrapper,
.modal-fade-leave-to .modal__wrapper {
  transform: scale(0.3);
}

.modal__overlay {
  position: fixed;
  inset: 0; /* top/right/bottom/left: 0 */
  background: rgba(0, 0, 0, 0.5); /* Полупрозрачное затемнение */
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000; /* Поверх всех элементов */
  padding: 16px; /* Отступ от краёв экрана на мобильных */
}

.modal__wrapper {
  background: #fff;
  border-radius: 8px;
  padding: 24px;
  min-width: 500px;

  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
  position: relative;
  /* Опционально: запретить контенту вылезать за пределы */
  max-height: 90dvh;
  overflow-y: auto;
}

.modal__header {
  font-size: 20px;
  display: flex;
  justify-content: space-between;
  margin-bottom: 24px;
}

.modal__content {
  display: grid;
}
</style>
