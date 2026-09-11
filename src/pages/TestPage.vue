<template>
  <div class="game-container">
    <!-- Главное меню -->
    <div v-if="showMenu" class="menu-container">
      <h1 class="menu-title">🐍 SNAKE</h1>

      <div class="settings-section">
        <h2 class="settings-title">РЕЖИМ ИГРЫ</h2>
        <div class="button-group">
          <button
            @click="gameMode = 'single'"
            :class="['setting-btn', { active: gameMode === 'single' }]"
          >
            ОДИНОЧНЫЙ
          </button>
          <button
            @click="gameMode = 'multi'"
            :class="['setting-btn', { active: gameMode === 'multi' }]"
          >
            НА ДВОИХ (1 экран)
          </button>
        </div>
      </div>

      <div class="settings-section">
        <h2 class="settings-title">РАЗМЕР ПОЛЯ</h2>
        <div class="button-group">
          <button
            v-for="size in gridSizeOptions"
            :key="size.value"
            @click="selectedGridSize = size.value"
            :class="['setting-btn', { active: selectedGridSize === size.value }]"
          >
            {{ size.label }}
          </button>
        </div>
      </div>

      <div class="settings-section">
        <h2 class="settings-title">СКОРОСТЬ</h2>
        <div class="button-group">
          <button
            v-for="speed in speedOptions"
            :key="speed.value"
            @click="selectedSpeed = speed.value"
            :class="['setting-btn', { active: selectedSpeed === speed.value }]"
          >
            {{ speed.label }}
          </button>
        </div>
      </div>

      <button @click="startGame" class="start-btn">НАЧАТЬ ИГРУ</button>
    </div>

    <!-- Игровой экран -->
    <div v-else class="game-screen">
      <div class="game-header">
        <h1 class="title">🐍 SNAKE {{ gameMode === 'multi' ? 'DUO' : '' }}</h1>

        <!-- Табло очков -->
        <div class="score-board" :class="{ 'multi-mode': gameMode === 'multi' }">
          <div class="score-item p1">
            <span class="label">ИГРОК 1 (WASD)</span>
            <span class="value">{{ scores.p1 }}</span>
          </div>
          <div v-if="gameMode === 'multi'" class="score-item p2">
            <span class="label">ИГРОК 2 (СТРЕЛКИ)</span>
            <span class="value">{{ scores.p2 }}</span>
          </div>
        </div>
      </div>

      <div class="canvas-wrapper">
        <canvas
          ref="gameCanvas"
          :width="canvasSize"
          :height="canvasSize"
          class="game-canvas"
        ></canvas>

        <div v-if="gameOver" class="game-over-overlay">
          <div class="game-over-content">
            <h2 :style="{ color: winnerColor }">{{ winnerText }}</h2>
            <div class="final-scores" v-if="gameMode === 'multi'">
              <p>Игрок 1: {{ scores.p1 }} | Игрок 2: {{ scores.p2 }}</p>
            </div>
            <p v-else>Твой счёт: {{ scores.p1 }}</p>

            <div class="game-over-buttons">
              <button @click="restartGame" class="restart-btn">ИГРАТЬ СНОВА</button>
              <button @click="backToMenu" class="menu-btn">В МЕНЮ</button>
            </div>
          </div>
        </div>
      </div>

      <div class="controls-info">
        <p v-if="gameMode === 'single'">
          Управление: <kbd>←</kbd> <kbd>↑</kbd> <kbd>↓</kbd> <kbd>→</kbd> или <kbd>W</kbd>
          <kbd>A</kbd> <kbd>S</kbd> <kbd>D</kbd>
        </p>
        <p v-else class="multi-controls">
          <span class="p1-hint"
            >🟢 Игрок 1: <kbd>W</kbd> <kbd>A</kbd> <kbd>S</kbd> <kbd>D</kbd></span
          >
          <span class="p2-hint"
            >🔵 Игрок 2: <kbd>↑</kbd> <kbd>←</kbd> <kbd>↓</kbd> <kbd>→</kbd></span
          >
        </p>
      </div>

      <button v-if="!gameOver" @click="backToMenu" class="menu-btn-small">В МЕНЮ</button>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue'

const canvasSize = 400
const showMenu = ref(true)
const gameOver = ref(false)
const gameMode = ref('single') // 'single' или 'multi'

const gridSizeOptions = [
  { label: '15×15', value: 15 },
  { label: '20×20', value: 20 },
  { label: '25×25', value: 25 },
]

const speedOptions = [
  { label: 'МЕДЛЕННАЯ', value: 200 },
  { label: 'СРЕДНЯЯ', value: 150 },
  { label: 'БЫСТРАЯ', value: 100 },
]

const selectedGridSize = ref(20)
const selectedSpeed = ref(150)
const gameCanvas = ref(null)

// Состояние игры
let players = {}
let food = { x: 0, y: 0 }
let gameLoop = null
let ctx = null
const scores = ref({ p1: 0, p2: 0 })
const winnerText = ref('')
const winnerColor = ref('#fff')

// Инициализация игроков
const initPlayers = () => {
  const center = Math.floor(selectedGridSize.value / 2)

  players = {
    p1: {
      id: 'p1',
      body:
        gameMode.value === 'multi'
          ? [
              { x: center - 4, y: center },
              { x: center - 5, y: center },
              { x: center - 6, y: center },
            ]
          : [
              { x: center, y: center },
              { x: center - 1, y: center },
              { x: center - 2, y: center },
            ],
      direction: { x: 1, y: 0 },
      nextDirection: { x: 1, y: 0 },
      color: '#00ff88', // Неоновый зеленый
      isAlive: true,
    },
  }

  if (gameMode.value === 'multi') {
    players.p2 = {
      id: 'p2',
      body: [
        { x: center + 4, y: center },
        { x: center + 5, y: center },
        { x: center + 6, y: center },
      ],
      direction: { x: -1, y: 0 }, // Начинает движение влево
      nextDirection: { x: -1, y: 0 },
      color: '#00ccff', // Неоновый голубой
      isAlive: true,
    }
  }

  scores.value = { p1: 0, p2: 0 }
  generateFood()
}

const generateFood = () => {
  let newFood
  let isValid = false

  while (!isValid) {
    newFood = {
      x: Math.floor(Math.random() * selectedGridSize.value),
      y: Math.floor(Math.random() * selectedGridSize.value),
    }

    // Проверяем, не попала ли еда на тело любого из игроков
    isValid = true
    for (const p of Object.values(players)) {
      if (p.body.some((segment) => segment.x === newFood.x && segment.y === newFood.y)) {
        isValid = false
        break
      }
    }
  }
  food = newFood
}

const draw = () => {
  if (!ctx) return
  const cellSize = canvasSize / selectedGridSize.value

  // Фон
  const gradient = ctx.createLinearGradient(0, 0, canvasSize, canvasSize)
  gradient.addColorStop(0, '#0a0e27')
  gradient.addColorStop(1, '#1a1f3a')
  ctx.fillStyle = gradient
  ctx.fillRect(0, 0, canvasSize, canvasSize)

  // Сетка
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.03)'
  ctx.lineWidth = 1
  for (let i = 0; i <= selectedGridSize.value; i++) {
    ctx.beginPath()
    ctx.moveTo(i * cellSize, 0)
    ctx.lineTo(i * cellSize, canvasSize)
    ctx.stroke()
    ctx.beginPath()
    ctx.moveTo(0, i * cellSize)
    ctx.lineTo(canvasSize, i * cellSize)
    ctx.stroke()
  }

  // Еда
  ctx.shadowBlur = 20
  ctx.shadowColor = '#ff006e'
  ctx.fillStyle = '#ff006e'
  ctx.beginPath()
  ctx.arc(
    food.x * cellSize + cellSize / 2,
    food.y * cellSize + cellSize / 2,
    cellSize / 2 - 2,
    0,
    Math.PI * 2,
  )
  ctx.fill()
  ctx.shadowBlur = 0

  // Отрисовка всех игроков
  Object.values(players).forEach((player) => {
    if (!player.isAlive) return

    player.body.forEach((segment, index) => {
      const isHead = index === 0

      ctx.shadowBlur = isHead ? 15 : 10
      ctx.shadowColor = player.color
      ctx.fillStyle = isHead ? player.color : player.color + 'CC' // Добавляем прозрачность хвосту

      const padding = isHead ? 1 : 2
      ctx.fillRect(
        segment.x * cellSize + padding,
        segment.y * cellSize + padding,
        cellSize - padding * 2,
        cellSize - padding * 2,
      )
    })
    ctx.shadowBlur = 0
  })
}

const update = () => {
  // 1. Применяем направления
  Object.values(players).forEach((p) => {
    if (p.isAlive) p.direction = { ...p.nextDirection }
  })

  // 2. Вычисляем новые головы
  const newHeads = {}
  Object.values(players).forEach((p) => {
    if (p.isAlive) {
      newHeads[p.id] = {
        x: p.body[0].x + p.direction.x,
        y: p.body[0].y + p.direction.y,
      }
    }
  })

  // 3. Проверка столкновений
  let someoneDied = false

  Object.values(players).forEach((p) => {
    if (!p.isAlive) return
    const head = newHeads[p.id]

    // А) Столкновение со стеной
    if (
      head.x < 0 ||
      head.x >= selectedGridSize.value ||
      head.y < 0 ||
      head.y >= selectedGridSize.value
    ) {
      p.isAlive = false
      someoneDied = true
      return
    }

    // Б) Столкновение с любым телом (своим или чужим)
    for (const otherP of Object.values(players)) {
      if (otherP.body.some((segment) => segment.x === head.x && segment.y === head.y)) {
        p.isAlive = false
        someoneDied = true
        return
      }
    }

    // В) Лобовое столкновение голов (Ничья)
    const otherPlayerId = p.id === 'p1' ? 'p2' : 'p1'
    if (gameMode.value === 'multi' && players[otherPlayerId].isAlive) {
      const otherHead = newHeads[otherPlayerId]
      if (head.x === otherHead.x && head.y === otherHead.y) {
        p.isAlive = false
        players[otherPlayerId].isAlive = false
        someoneDied = true
      }
    }
  })

  // 4. Движение и поедание еды
  Object.values(players).forEach((p) => {
    if (!p.isAlive) return
    const head = newHeads[p.id]
    p.body.unshift(head)

    if (head.x === food.x && head.y === food.y) {
      scores.value[p.id] += 10
      generateFood()
    } else {
      p.body.pop()
    }
  })

  // 5. Проверка окончания игры
  if (someoneDied) {
    endGame()
  } else {
    draw()
  }
}

const endGame = () => {
  gameOver.value = true
  if (gameLoop) {
    clearInterval(gameLoop)
    gameLoop = null
  }

  if (gameMode.value === 'multi') {
    const p1Alive = players.p1.isAlive
    const p2Alive = players.p2.isAlive

    if (p1Alive && !p2Alive) {
      winnerText.value = 'ПОБЕДИЛ ИГРОК 1!'
      winnerColor.value = players.p1.color
    } else if (!p1Alive && p2Alive) {
      winnerText.value = 'ПОБЕДИЛ ИГРОК 2!'
      winnerColor.value = players.p2.color
    } else {
      winnerText.value = 'НИЧЬЯ!'
      winnerColor.value = '#ff006e'
    }
  } else {
    winnerText.value = 'GAME OVER'
    winnerColor.value = '#ff006e'
  }

  draw() // Финальная отрисовка, чтобы показать момент столкновения
}

const startGame = () => {
  showMenu.value = false
  gameOver.value = false

  setTimeout(() => {
    ctx = gameCanvas.value.getContext('2d')
    initPlayers()
    draw()
    gameLoop = setInterval(update, selectedSpeed.value)
  }, 100)
}

const restartGame = () => {
  if (gameLoop) clearInterval(gameLoop)
  gameOver.value = false
  initPlayers()
  draw()
  gameLoop = setInterval(update, selectedSpeed.value)
}

const backToMenu = () => {
  if (gameLoop) {
    clearInterval(gameLoop)
    gameLoop = null
  }
  showMenu.value = true
  gameOver.value = false
}

const handleKeyPress = (e) => {
  if (showMenu.value) return

  if (gameOver.value) {
    if (e.key === 'Enter' || e.key === ' ') restartGame()
    else if (e.key === 'Escape') backToMenu()
    return
  }

  const key = e.key.toLowerCase()

  // Управление Игроком 1 (WASD) - работает всегда
  if (key === 'w' && players.p1.direction.y === 0) players.p1.nextDirection = { x: 0, y: -1 }
  else if (key === 's' && players.p1.direction.y === 0) players.p1.nextDirection = { x: 0, y: 1 }
  else if (key === 'a' && players.p1.direction.x === 0) players.p1.nextDirection = { x: -1, y: 0 }
  else if (key === 'd' && players.p1.direction.x === 0) players.p1.nextDirection = { x: 1, y: 0 }

  // Управление Игроком 2 (Стрелки) - только в мультиплеере
  if (gameMode.value === 'multi') {
    if (key === 'arrowup' && players.p2.direction.y === 0)
      players.p2.nextDirection = { x: 0, y: -1 }
    else if (key === 'arrowdown' && players.p2.direction.y === 0)
      players.p2.nextDirection = { x: 0, y: 1 }
    else if (key === 'arrowleft' && players.p2.direction.x === 0)
      players.p2.nextDirection = { x: -1, y: 0 }
    else if (key === 'arrowright' && players.p2.direction.x === 0)
      players.p2.nextDirection = { x: 1, y: 0 }
  } else {
    // В одиночном режиме стрелки тоже управляют единственной змейкой
    if (key === 'arrowup' && players.p1.direction.y === 0)
      players.p1.nextDirection = { x: 0, y: -1 }
    else if (key === 'arrowdown' && players.p1.direction.y === 0)
      players.p1.nextDirection = { x: 0, y: 1 }
    else if (key === 'arrowleft' && players.p1.direction.x === 0)
      players.p1.nextDirection = { x: -1, y: 0 }
    else if (key === 'arrowright' && players.p1.direction.x === 0)
      players.p1.nextDirection = { x: 1, y: 0 }
  }
}

onMounted(() => {
  window.addEventListener('keydown', handleKeyPress)
})

onUnmounted(() => {
  if (gameLoop) clearInterval(gameLoop)
  window.removeEventListener('keydown', handleKeyPress)
})
</script>

<style scoped>
/* ... (Здесь оставь все стили из предыдущей версии, они отлично работают) ... */
/* Добавь только эти новые стили для мультиплеера: */

.score-board.multi-mode {
  gap: 40px;
}

.score-item.p1 .value {
  color: #00ff88;
  text-shadow: 0 0 10px rgba(0, 255, 136, 0.5);
}

.score-item.p2 .value {
  color: #00ccff;
  text-shadow: 0 0 10px rgba(0, 204, 255, 0.5);
}

.multi-controls {
  display: flex;
  justify-content: center;
  gap: 30px;
  margin-top: 15px;
}

.p1-hint {
  color: #00ff88;
  font-weight: 600;
}

.p2-hint {
  color: #00ccff;
  font-weight: 600;
}

.final-scores p {
  font-size: 1.2rem;
  color: rgba(255, 255, 255, 0.8);
  margin-bottom: 20px;
}

/* Адаптивность для мобильных (скрываем мультиплеер на телефонах, так как клавиатуры нет) */
@media (max-width: 768px) {
  .multi-controls {
    flex-direction: column;
    gap: 10px;
  }
}
</style>
