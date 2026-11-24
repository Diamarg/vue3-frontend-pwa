<template>
  <div class="app-splash" role="status" aria-label="Загрузка приложения" aria-live="polite">
    <div class="app-splash__content">
      <div class="app-splash__logo-wrap" aria-hidden="true">
        <span class="app-splash__ripple"></span>
        <span class="app-splash__ripple"></span>
        <span class="app-splash__ripple"></span>
        <img class="app-splash__logo" src="/images/app-loading-logo.svg" alt="" />
      </div>
      <div class="app-splash__brand">А-Сервис</div>
      <p class="app-splash__caption">Загружаем рабочее пространство</p>
      <div class="app-splash__progress" aria-hidden="true"><span></span></div>
    </div>
  </div>
</template>
