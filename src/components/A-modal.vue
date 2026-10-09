<script setup>
import { computed, useAttrs, Transition } from 'vue'

const props = defineProps({
  title: { type: String, default: 'Заголовок' },
  opened: { type: Boolean, default: false },
})

// Класс страницы-владельца включает режим просмотра фото: там кнопка закрытия своя
const attrs = useAttrs()
const isPhotoView = computed(() => String(attrs.class ?? '').includes('photo-view-modal'))
</script>

<template>
  <transition name="modal-fade">
    <div v-if="opened" class="modal__overlay">
      <!-- Добавляем класс-модификатор, если это модалка просмотра фото -->
      <div class="modal__wrapper" :class="{ 'modal--photo-view': isPhotoView }">
        <div v-if="!isPhotoView" class="modal__header">
          <h2 class="modal__title">{{ title }}</h2>
          <button class="modal__close" @click="$emit('closeEmit')">&times;</button>
        </div>
        <div class="modal__body">
          <slot></slot>
        </div>
      </div>
    </div>
  </transition>
</template>

<style scoped>
/* Анимации */
.modal-fade-enter-active,
.modal-fade-leave-active {
  transition: opacity 0.3s ease;
}
.modal-fade-enter-from,
.modal-fade-leave-to {
  opacity: 0;
}
.modal-fade-enter-active .modal__wrapper,
.modal-fade-leave-active .modal__wrapper {
  transition: transform 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
}
.modal-fade-enter-from .modal__wrapper,
.modal-fade-leave-to .modal__wrapper {
  transform: scale(0.95);
}

/* Оверлей */
.modal__overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.6);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: 16px;
}

/* Стандартное модальное окно */
.modal__wrapper {
  background: #fff;
  border-radius: 12px;
  padding: 24px;
  width: 100%;
  max-width: 700px;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.2);
  position: relative;
  max-height: 90vh;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
}

/* === СПЕЦИАЛЬНЫЙ РЕЖИМ ДЛЯ ФОТО === */
.modal--photo-view {
  padding: 0 !important; /* Убираем отступы вокруг картинки */
  background: transparent; /* Прозрачный фон самого враппера */
  box-shadow: none;
  overflow: visible; /* Разрешаем контенту определять размер */
  width: auto;
  height: auto;
  max-width: none;
  max-height: none;
}

/* Кнопка закрытия (общая) */
.modal__close {
  background: none;
  border: none;
  font-size: 28px;
  line-height: 1;
  cursor: pointer;
  color: #999;
  transition: color 0.2s;
  padding: 0;
  margin: 0;
  display: flex;
  align-items: center;
  justify-content: center;
}

.modal__close:hover {
  color: #333;
}

.modal__header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}

.modal__title {
  font-size: 18px;
  font-weight: 600;
  margin: 0;
  color: #333;
}

.modal__body {
  width: 100%;
}
</style>
