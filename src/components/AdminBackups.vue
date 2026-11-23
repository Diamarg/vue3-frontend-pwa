<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import AButton from '@/components/A-button.vue'
import { useToast } from '@/composables/useToast'
import { backupApi } from '@/api/backup'
import { projectsApi } from '@/api/projects'

// Пока сборка идёт, её спрашивают каждые две секунды: сама копия пишется на сервере
// фоном, поэтому частый опрос только мешал бы ей единственное ядро
const POLL_MS = 2000

const toast = useToast()

const info = ref(null)
const build = ref(null)
// Результат показываем только той сборки, которую страница видела вживую: снимок сервера
// живёт до следующей сборки и после перезагрузки полосы и надписи «готова» были бы вчерашние
const result = ref(null)
const projects = ref([])
const selectedProjectId = ref(null)
const isStarting = ref(false)
const isDeleting = ref(false)

let pollTimer = null
let infoInFlight = false
let statusInFlight = false

const storage = computed(() => info.value?.storage ?? null)
const archives = computed(() => info.value?.archives ?? [])
const isRunning = computed(() => build.value?.state === 'running')
const resultIsDone = computed(() => result.value?.state === 'done')
const missing = computed(() => result.value?.missing ?? [])
const percent = computed(() => {
  const current = build.value
  if (!current || !current.totalFiles) return 0
  // По байтам полоса идёт ровно, но если в базе размеры проставлены криво,
  // надёжнее считать по числу файлов
  if (current.totalBytes > 0) {
    return Math.min(100, Math.round((current.packedBytes / current.totalBytes) * 100))
  }
  return Math.min(100, Math.round((current.processedFiles / current.totalFiles) * 100))
})

const formatBytes = (bytes) => {
  if (bytes === null || bytes === undefined) return '—'
  if (bytes === 0) return '0 Б'
  const k = 1024
  const sizes = ['Б', 'КБ', 'МБ', 'ГБ', 'ТБ']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${(bytes / Math.pow(k, i)).toFixed(i === 0 ? 0 : 2)} ${sizes[i]}`
}

// Сервер намеренно возвращает текст ошибки в теле ответа — его и показываем,
// а не «Request failed with status code 409»
const serverMessage = (error, fallback) => {
  const body = error?.response?.data
  if (typeof body === 'string' && body.trim()) return body
  if (body?.error) return body.error
  return fallback
}

const stopPolling = () => {
  clearInterval(pollTimer)
  pollTimer = null
}

const startPolling = () => {
  if (pollTimer) return
  pollTimer = setInterval(pollStatus, POLL_MS)
}

const loadInfo = async () => {
  if (infoInFlight) return
  infoInFlight = true
  try {
    const data = await backupApi.getInfo()
    info.value = data
    build.value = data.build
  } catch (error) {
    console.error('Не удалось получить сведения о резервных копиях:', error)
  } finally {
    infoInFlight = false
  }
}

const pollStatus = async () => {
  if (statusInFlight) return
  statusInFlight = true
  let finished = null

  try {
    build.value = await backupApi.getStatus()
    if (build.value.state !== 'running') finished = build.value.state
  } catch (error) {
    console.error('Не удалось узнать ход сборки копии:', error)
  } finally {
    statusInFlight = false
  }

  if (!finished) return

  stopPolling()
  // Готовый архив должен появиться в списке в тот же момент, когда сборка объявлена завершённой
  await loadInfo()
  result.value = build.value

  if (finished === 'done') {
    toast.success(`Резервная копия ${build.value?.archiveName || ''} готова`.trim())
  } else {
    toast.error(build.value?.error || 'Создание резервной копии не удалось')
  }
}

const startBuild = async () => {
  if (isRunning.value || isStarting.value) return
  isStarting.value = true
  // Предыдущий результат больше не актуален: полоса должна идти с нуля, а не показывать старую
  result.value = null
  try {
    build.value = await backupApi.start(selectedProjectId.value)
    startPolling()
  } catch (error) {
    toast.error(serverMessage(error, 'Не удалось создать резервную копию'))
    // Сервер мог ответить «уже создаётся»: за чужой сборкой надо следить
    await loadInfo()
    if (isRunning.value) startPolling()
  } finally {
    isStarting.value = false
  }
}

const removeArchive = async (archive) => {
  if (
    !confirm(`Удалить резервную копию «${archive.fileName}» (${formatBytes(archive.sizeBytes)})?`)
  )
    return

  isDeleting.value = true
  try {
    await backupApi.remove(archive.fileName)
    toast.success('Копия удалена')
    await loadInfo()
  } catch (error) {
    toast.error(serverMessage(error, 'Не удалось удалить копию'))
  } finally {
    isDeleting.value = false
  }
}

onMounted(async () => {
  await loadInfo()
  try {
    projects.value = (await projectsApi.getProjects()) || []
  } catch (error) {
    console.error('Не удалось получить список проектов:', error)
    projects.value = []
  }
  // Страница могла открыться, когда сборка уже шла — подхватываем её
  if (isRunning.value) startPolling()
})

onBeforeUnmount(stopPolling)
</script>

<template>
  <div class="backup">
    <div class="backup__head">
      <h3 class="backup__title">Резервные копии хранилища</h3>
      <p class="backup__note">
        Файлы и фото раскладываются по папкам с кодовым именем проекта, внутри — папки «файлы» и
        «фото», а сами файлы называются так, как записаны в базе. Готовая копия остаётся на сервере
        и скачивается по ссылке.
      </p>
    </div>

    <div v-if="!info" class="backup__state">Загрузка сведений о хранилище…</div>

    <template v-else>
      <div class="backup__card">
        <dl class="backup__list">
          <div class="backup__row">
            <dt>Файлы проектов</dt>
            <dd>{{ storage.filesCount }} шт · {{ formatBytes(storage.filesBytes) }}</dd>
          </div>
          <div class="backup__row">
            <dt>Фотографии</dt>
            <dd>{{ storage.photosCount }} шт · {{ formatBytes(storage.photosBytes) }}</dd>
          </div>
          <div class="backup__row">
            <dt>Нужно места для копии</dt>
            <dd>{{ formatBytes(storage.estimatedBytes) }}</dd>
          </div>
          <div class="backup__row">
            <dt>Свободно на диске</dt>
            <dd>{{ formatBytes(info.disk.freeBytes) }}</dd>
          </div>
          <div class="backup__row">
            <dt>Папка копий на сервере</dt>
            <dd class="backup__value-break">{{ info.backupFolder }}</dd>
          </div>
        </dl>

        <div class="backup__actions">
          <label class="backup__label" for="backup-project">
            Проект
            <select id="backup-project" v-model="selectedProjectId" class="backup__select">
              <option :value="null">Все проекты</option>
              <option v-for="project in projects" :key="project.id" :value="project.id">
                {{ project.codeName }} (ID {{ project.id }})
              </option>
            </select>
          </label>
          <AButton
            class="backup__button"
            :disabled="isRunning || isStarting"
            title="Собрать архив файлов и фотографий"
            @click="startBuild"
          >
            {{ isRunning ? 'Копия создаётся…' : 'Создать резервную копию' }}
          </AButton>
        </div>

        <div v-if="isRunning" class="backup__progress">
          <div class="backup__meter-track">
            <div class="backup__meter-fill" :style="{ width: percent + '%' }"></div>
          </div>
          <div class="backup__meter-line">
            <span>
              {{ build.processedFiles }} из {{ build.totalFiles }} файлов ·
              {{ formatBytes(build.packedBytes) }} из {{ formatBytes(build.totalBytes) }} ·
              {{ percent }}%
            </span>
            <span v-if="build.currentFolder" class="backup__muted">
              {{ build.currentFolder }}
            </span>
          </div>
        </div>

        <div v-else-if="result" class="backup__progress">
          <p v-if="resultIsDone" class="backup__ok">
            Копия {{ result.archiveName }} · {{ formatBytes(result.archiveBytes) }}
          </p>
          <p v-else class="backup__warning">
            Сборка оборвалась: {{ result.error }}. Временный архив удалён, готовые копии не тронуты.
          </p>
          <p v-if="result.missingCount" class="backup__warning">
            В копии не хватает {{ result.missingCount }} записей: они числятся в базе, но их нет на
            диске.
          </p>
          <ul v-if="missing.length" class="backup__missing">
            <li v-for="entry in missing" :key="entry">{{ entry }}</li>
          </ul>
        </div>
      </div>

      <div class="backup__card">
        <h4 class="backup__card-title">Готовые копии на сервере</h4>

        <p v-if="!archives.length" class="backup__muted">
          Пока ни одной копии — создайте её кнопкой выше.
        </p>
        <table v-else class="backup__table">
          <thead>
            <tr>
              <th class="backup__th">Файл</th>
              <th class="backup__th backup__th--size">Размер</th>
              <th class="backup__th backup__th--date">Создан</th>
              <th class="backup__th backup__th--actions"></th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="archive in archives" :key="archive.fileName" class="backup__item">
              <td class="backup__td backup__td--name" data-label="Файл">
                {{ archive.fileName }}
              </td>
              <td class="backup__td backup__td--size" data-label="Размер">
                {{ formatBytes(archive.sizeBytes) }}
              </td>
              <td class="backup__td backup__td--date" data-label="Создан">
                {{ archive.createdLocal }}
              </td>
              <td class="backup__td backup__td--actions">
                <a class="backup__link" :href="backupApi.getDownloadUrl(archive.fileName)" download>
                  Скачать
                </a>
                <button
                  class="backup__danger"
                  :disabled="isDeleting || isRunning"
                  @click="removeArchive(archive)"
                >
                  Удалить
                </button>
              </td>
            </tr>
          </tbody>
        </table>

        <p class="backup__hint">
          Копии лежат на том же диске, что и основное хранилище, и занимают место на нём: скачанную
          копию лучше удалить отсюда.
        </p>
      </div>
    </template>
  </div>
</template>

<style scoped>
/* Стили страницы-хозяина сюда не доходят: они scoped */
.backup__head,
.backup__card {
  box-shadow: 4px 4px 30px -10px rgba(34, 60, 80, 0.2);
  border: 1px solid rgb(230, 230, 230);
  border-radius: 8px;
  background-color: #fff;
}

.backup {
  display: grid;
  gap: 16px;
}

.backup__head,
.backup__card {
  padding: 16px;
}

.backup__state {
  padding: 16px;
  color: #64748b;
}

.backup__title {
  margin: 0 0 8px;
  font-size: 18px;
  font-weight: 600;
}

.backup__note,
.backup__hint {
  margin: 0;
  font-size: 13px;
  color: #64748b;
  line-height: 1.45;
}

.backup__hint {
  margin-top: 12px;
}

.backup__card-title {
  margin: 0 0 12px;
  font-size: 15px;
  font-weight: 600;
}

.backup__list {
  margin: 0 0 16px;
  display: grid;
  gap: 6px;
}

.backup__row {
  display: flex;
  justify-content: space-between;
  gap: 16px;
  font-size: 14px;
}

.backup__row dt {
  color: #64748b;
}

.backup__row dd {
  margin: 0;
  text-align: right;
}

.backup__value-break {
  word-break: break-all;
}

.backup__actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 12px;
}

.backup__label {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
  color: #334155;
}

.backup__select {
  min-height: 32px;
  padding: 4px 8px;
  border: 1px solid rgb(203, 213, 225);
  border-radius: 6px;
  background: #fff;
  font-size: 14px;
}

.backup__progress {
  margin-top: 16px;
}

.backup__meter-track,
.backup__meter-fill {
  height: 8px;
  border-radius: 4px;
}

.backup__meter-track {
  background: rgb(226, 232, 240);
  overflow: hidden;
}

.backup__meter-fill {
  background: #6366f1;
  transition: width 0.4s ease;
}

.backup__meter-line {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  margin-top: 6px;
  font-size: 13px;
}

.backup__muted {
  color: #94a3b8;
}

.backup__ok {
  margin: 8px 0 0;
  font-size: 13px;
  color: #16a34a;
  /* Имя архива — одно длинное слово, оно не должно растягивать карточку */
  overflow-wrap: anywhere;
}

.backup__warning {
  margin: 8px 0 0;
  font-size: 13px;
  color: #b45309;
}

.backup__missing {
  margin: 8px 0 0;
  padding-left: 20px;
  font-size: 12px;
  color: #b45309;
  max-height: 160px;
  overflow: auto;
  overflow-wrap: anywhere;
}

.backup__table {
  width: 100%;
  border-collapse: collapse;
  font-size: 14px;
}

.backup__th,
.backup__td {
  padding: 6px 8px;
  text-align: left;
  border-bottom: 1px solid rgb(241, 245, 249);
}

.backup__th {
  font-size: 12px;
  color: #64748b;
  font-weight: 600;
}

.backup__th--size,
.backup__td--size {
  width: 90px;
  text-align: right;
}

.backup__th--date,
.backup__td--date {
  width: 140px;
  white-space: nowrap;
}

.backup__th--actions,
.backup__td--actions {
  width: 160px;
}

/* Длинное имя вида backup_…_Клин 2026 (оборотка).zip не должно растягивать таблицу */
.backup__td--name {
  overflow-wrap: anywhere;
}

.backup__td--actions {
  display: flex;
  gap: 12px;
  align-items: center;
}

.backup__link {
  color: #4338ca;
  text-decoration: none;
}

.backup__link:hover {
  text-decoration: underline;
}

.backup__danger {
  border: none;
  background: none;
  padding: 0;
  cursor: pointer;
  color: #b91c1c;
  font-size: 14px;
}

.backup__danger:disabled {
  color: #cbd5e1;
  cursor: default;
}

/* ===================== МОБИЛЬНАЯ ВЕРСИЯ ===================== */
@media (max-width: 600px) {
  .backup__head,
  .backup__card {
    padding: 12px;
  }

  /* Путь к папке копий длинный: в строку с подписью он встаёт только переносом
     на третье слово, поэтому подписи сверху, значения снизу */
  .backup__row {
    flex-direction: column;
    gap: 2px;
  }

  .backup__row dd {
    text-align: left;
  }

  .backup__actions {
    flex-direction: column;
    align-items: stretch;
    gap: 10px;
  }

  .backup__label {
    flex-direction: column;
    align-items: stretch;
    gap: 4px;
  }

  .backup__select,
  .backup__button {
    width: 100%;
  }

  /* Счётчик файлов и текущая папка не должны толкать друг друга по ширине экрана */
  .backup__meter-line {
    flex-direction: column;
    gap: 2px;
  }

  /* Список копий превращается в карточки — как в остальных разделах админки:
     четыре колонки с именем архива на узком экране влезают только по очереди */
  .backup__table thead {
    display: none;
  }

  .backup__table,
  .backup__table tbody {
    display: block;
  }

  .backup__item {
    display: block;
    margin-bottom: 12px;
    padding: 10px 12px;
    border: 1px solid rgb(230, 230, 230);
    border-radius: 10px;
  }

  .backup__item:last-child {
    margin-bottom: 0;
  }

  .backup__td {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    gap: 12px;
    width: auto;
    padding: 6px 0;
    border-bottom: 1px solid rgb(245, 245, 245);
    text-align: left;
  }

  .backup__td:last-child {
    border-bottom: none;
  }

  .backup__td::before {
    content: attr(data-label);
    flex-shrink: 0;
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 0.3px;
    text-transform: uppercase;
    color: #a0aec0;
  }

  .backup__td--name {
    flex-direction: column;
    align-items: flex-start;
    gap: 2px;
  }

  .backup__td--actions {
    justify-content: flex-end;
    gap: 24px;
  }

  .backup__td--actions::before {
    content: none;
  }

  /* Под пальцем цели крупнее: 14 пикселей ссылки промахиваются часто */
  .backup__link,
  .backup__danger {
    font-size: 16px;
    padding: 8px 0;
  }

  .backup__missing {
    max-height: 140px;
  }
}
</style>
