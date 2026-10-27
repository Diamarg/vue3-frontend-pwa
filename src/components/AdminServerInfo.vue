<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import AButton from '@/components/A-button.vue'
import { systemApi } from '@/api/system'

// Опрос раз в 2 секунды: метрики диска/памяти должны «дышать» без тыканья кнопки
const POLL_INTERVAL_MS = 2000

const info = ref(null)
const isLoading = ref(true)
const hasError = ref(false)
const updatedAt = ref(null)

// Ответ может висеть дольше тика, а складывать запросы нельзя — забьём очередь
let inFlight = false
let timer = null

const loadInfo = async () => {
  if (inFlight) return
  inFlight = true
  isLoading.value = true
  try {
    info.value = await systemApi.getSystemInfo()
    hasError.value = false
    updatedAt.value = new Date().toLocaleTimeString('ru-RU')
  } catch (error) {
    console.error('Ошибка получения сведений о сервере:', error)
    hasError.value = true
  } finally {
    isLoading.value = false
    inFlight = false
  }
}

// Пока вкладка не видна, сервер дёргать незачем
const onVisibilityChange = () => {
  if (document.hidden) {
    clearInterval(timer)
    timer = null
  } else if (!timer) {
    loadInfo()
    timer = setInterval(loadInfo, POLL_INTERVAL_MS)
  }
}

onMounted(() => {
  loadInfo()
  timer = setInterval(loadInfo, POLL_INTERVAL_MS)
  document.addEventListener('visibilitychange', onVisibilityChange)
})

onBeforeUnmount(() => {
  clearInterval(timer)
  document.removeEventListener('visibilitychange', onVisibilityChange)
})

const formatBytes = (bytes) => {
  if (bytes === null || bytes === undefined) return '—'
  if (bytes === 0) return '0 Б'
  const k = 1024
  const sizes = ['Б', 'КБ', 'МБ', 'ГБ', 'ТБ']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${(bytes / Math.pow(k, i)).toFixed(i === 0 ? 0 : 2)} ${sizes[i]}`
}

const formatUptime = (seconds) => {
  if (seconds === null || seconds === undefined) return '—'
  const parts = [
    [Math.floor(seconds / 86400), 'дн'],
    [Math.floor((seconds % 86400) / 3600), 'ч'],
    [Math.floor((seconds % 3600) / 60), 'мин'],
  ]
  // Ведущие нули не показываем: «0 дн 0 ч 5 мин» читается хуже, чем «5 мин»
  const trimmed = parts.filter(([value], index) => value > 0 || index === parts.length - 1)
  return trimmed.map(([value, unit]) => `${value} ${unit}`).join(' ')
}

const usedPercent = (totalBytes, freeBytes) => {
  if (!totalBytes) return 0
  return Math.round(((totalBytes - freeBytes) / totalBytes) * 100)
}

const disk = computed(() => info.value?.disk ?? null)
const memory = computed(() => info.value?.memory ?? null)
const diskIsLow = computed(() => {
  if (!disk.value) return false
  return disk.value.freeBytes < 2 * 1024 * 1024 * 1024
})
const memoryIsLow = computed(() => {
  const mem = memory.value
  if (!mem?.totalBytes) return false
  return mem.availableBytes / mem.totalBytes < 0.15
})

// Параметры сервера выводим парами «что — значение», порядок — от общего к частному
const serverRows = computed(() => {
  const s = info.value?.server
  if (!s) return []
  return [
    ['Имя хоста', s.machineName],
    ['Операционная система', s.os],
    ['Ядро', s.osVersion],
    ['Архитектура', s.architecture],
    ['Среда исполнения', s.framework],
    ['Ядра процессора', s.cpuCount],
    ['Аптайм сервера', formatUptime(s.systemUptimeSeconds)],
    ['Местное время', `${s.serverTimeLocal} (${s.serverTimeZone})`],
  ]
})

const appRows = computed(() => {
  const a = info.value?.application
  if (!a) return []
  return [
    ['Окружение', a.environmentName],
    ['Версия приложения', a.applicationVersion],
    ['Корень приложения', a.contentRootPath],
    ['Записей проектов', a.projectsCount],
    ['PID процесса', a.processId],
    ['Аптайм API', formatUptime(a.processUptimeSeconds)],
  ]
})

const storageRows = computed(() => {
  const st = info.value?.storage
  if (!st) return []
  return [
    ['Файлы проектов', `${st.filesCount} шт · ${formatBytes(st.filesBytes)}`],
    ['Фотографии', `${st.photosCount} шт · ${formatBytes(st.photosBytes)}`],
    ['Каталог загрузок', info.value?.disk?.storagePath],
  ]
})
</script>

<template>
  <div class="sysinfo">
    <div class="sysinfo__head">
      <div>
        <h3 class="sysinfo__title">Сведения о сервере</h3>
        <p class="sysinfo__note">
          Обновляется автоматически каждые {{ POLL_INTERVAL_MS / 1000 }} с
          <template v-if="updatedAt"> · последние данные в {{ updatedAt }}</template>
        </p>
      </div>
      <span v-if="hasError && info" class="sysinfo__stale">
        Нет связи, показаны последние полученные данные
      </span>
    </div>

    <div v-if="isLoading && !info" class="sysinfo__state">Загрузка сведений…</div>

    <div v-else-if="hasError && !info" class="sysinfo__state sysinfo__state--error">
      <p>Не удалось получить данные о сервере</p>
      <AButton @click="loadInfo">Повторить</AButton>
    </div>

    <template v-if="info">
      <div class="sysinfo__grid">
        <div class="sysinfo__card">
          <h4 class="sysinfo__card-title">Диск</h4>
          <div class="sysinfo__meter">
            <div class="sysinfo__meter-track">
              <div
                class="sysinfo__meter-fill"
                :class="{ 'sysinfo__meter-fill--low': diskIsLow }"
                :style="{ width: usedPercent(disk.totalBytes, disk.freeBytes) + '%' }"
              ></div>
            </div>
            <div class="sysinfo__meter-line">
              <span
                >Свободно <strong>{{ formatBytes(disk.freeBytes) }}</strong> из
                {{ formatBytes(disk.totalBytes) }}</span
              >
              <span class="sysinfo__muted"
                >занято {{ usedPercent(disk.totalBytes, disk.freeBytes) }}%</span
              >
            </div>
          </div>
          <p v-if="diskIsLow" class="sysinfo__warning">
            Меньше 2 ГБ: крупный файл не загрузится, а база не вырастет
          </p>
          <dl class="sysinfo__list">
            <div class="sysinfo__row">
              <dt>Том</dt>
              <dd>{{ disk.mountPoint }}</dd>
            </div>
          </dl>
        </div>

        <div class="sysinfo__card">
          <h4 class="sysinfo__card-title">Память</h4>
          <div class="sysinfo__meter">
            <div class="sysinfo__meter-track">
              <div
                class="sysinfo__meter-fill"
                :class="{ 'sysinfo__meter-fill--low': memoryIsLow }"
                :style="{
                  width: usedPercent(memory.totalBytes, memory.availableBytes) + '%',
                }"
              ></div>
            </div>
            <div class="sysinfo__meter-line">
              <span
                >Доступно <strong>{{ formatBytes(memory.availableBytes) }}</strong> из
                {{ formatBytes(memory.totalBytes) }}</span
              >
              <span class="sysinfo__muted">
                занято {{ usedPercent(memory.totalBytes, memory.availableBytes) }}%
              </span>
            </div>
          </div>
          <p v-if="memoryIsLow" class="sysinfo__warning">
            Доступно меньше 15%: тяжёлые выгрузки и качание файлов упрутся в память
          </p>
        </div>
      </div>

      <div class="sysinfo__grid">
        <div class="sysinfo__card">
          <h4 class="sysinfo__card-title">Сервер</h4>
          <dl class="sysinfo__list">
            <div v-for="[label, value] in serverRows" :key="label" class="sysinfo__row">
              <dt>{{ label }}</dt>
              <dd>{{ value ?? '—' }}</dd>
            </div>
          </dl>
        </div>

        <div class="sysinfo__card">
          <h4 class="sysinfo__card-title">Приложение</h4>
          <dl class="sysinfo__list">
            <div v-for="[label, value] in appRows" :key="label" class="sysinfo__row">
              <dt>{{ label }}</dt>
              <dd class="sysinfo__value-break">{{ value ?? '—' }}</dd>
            </div>
          </dl>
        </div>

        <div class="sysinfo__card">
          <h4 class="sysinfo__card-title">Хранилище</h4>
          <dl class="sysinfo__list">
            <div v-for="[label, value] in storageRows" :key="label" class="sysinfo__row">
              <dt>{{ label }}</dt>
              <dd class="sysinfo__value-break">{{ value ?? '—' }}</dd>
            </div>
          </dl>
          <p class="sysinfo__muted">
            Размеры взяты из базы данных, поэтому не учитывают огрызки от прерванных загрузок.
          </p>
        </div>
      </div>
    </template>
  </div>
</template>

<style scoped>
/* Общее оформление «карточки»: стили .admin-card из страницы сюда не доходят,
   они scoped и к дочернему компоненту не применяются */
.sysinfo__head,
.sysinfo__card,
.sysinfo__state {
  box-shadow: 4px 4px 30px -10px rgba(34, 60, 80, 0.2);
  border: 1px solid rgb(230, 230, 230);
  border-radius: 8px;
  background-color: #fff;
}

.sysinfo {
  display: grid;
  gap: 16px;
}

.sysinfo__state {
  padding: 48px 16px;
  text-align: center;
  color: #718096;
}

.sysinfo__state--error {
  color: #c53030;
}

.sysinfo__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  flex-wrap: wrap;
  padding: 16px 24px;
}

.sysinfo__title {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  color: #2d3748;
}

.sysinfo__note {
  margin: 4px 0 0;
  font-size: 13px;
  color: #718096;
}

.sysinfo__stale {
  font-size: 12px;
  color: #c53030;
}

.sysinfo__grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 16px;
}

.sysinfo__card {
  padding: 16px 20px;
}

.sysinfo__card-title {
  margin: 0 0 12px;
  font-size: 12px;
  font-weight: 600;
  color: #718096;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.sysinfo__meter-track {
  height: 8px;
  overflow: hidden;
  background-color: #e2e8f0;
  border-radius: 999px;
}

.sysinfo__meter-fill {
  height: 100%;
  background-color: #4f46e5;
  border-radius: 999px;
  transition: width 0.3s ease;
}

.sysinfo__meter-fill--low {
  background-color: #e53e3e;
}

.sysinfo__meter-line {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 8px;
  margin-top: 8px;
  font-size: 13px;
  color: #4a5568;
}

.sysinfo__warning {
  margin: 10px 0 0;
  font-size: 12px;
  color: #c53030;
}

.sysinfo__list {
  display: grid;
  gap: 6px;
  margin: 12px 0 0;
}

.sysinfo__row {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 12px;
  font-size: 13px;
}

.sysinfo__row dt {
  flex-shrink: 0;
  color: #718096;
}

.sysinfo__row dd {
  margin: 0;
  color: #2d3748;
  text-align: right;
}

.sysinfo__value-break {
  /* Пути и описания ОС длинные — ломают строку, а не уезжают за карточку */
  overflow-wrap: anywhere;
}

.sysinfo__muted {
  margin: 10px 0 0;
  font-size: 12px;
  color: #a0aec0;
}
</style>
