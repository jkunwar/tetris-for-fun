const COLORS = [
  null,
  '#FF0D72',
  '#0DC2FF',
  '#0DFF72',
  '#F538FF',
  '#FF8E0D',
  '#FFE30D'
]

const SHAPES = {
  T: [
    [0, 1, 0],
    [1, 1, 1],
    [0, 0, 0]
  ],
  O: [
    [2, 2],
    [2, 2]
  ],
  L: [
    [0, 0, 3],
    [3, 3, 3],
    [0, 0, 0]
  ],
  I: [
    [0, 4, 0],
    [0, 4, 0],
    [0, 4, 0]
  ],
  N: [
    [0, 5, 0],
    [5, 5, 0],
    [5, 0, 0]
  ],
  U: [
    [0, 0, 0],
    [6, 0, 6],
    [6, 6, 6]
  ]
}

const LEVELS = {
  EASY: 400,
  MEDIUM: 300,
  HARD: 200
}

const lineClearSound = new Audio('sounds/clear.ogg')

class Tetris {
  constructor() {
    this.canvas = document.getElementById('canvas')
    this.context = this.canvas.getContext('2d')
    this.context.setTransform(1, 0, 0, 1, 0, 0)
    this.context.scale(20, 20)
    this.clearAnimations = []

    this.registerEventListener()
  }

  resetGameState() {
    const levelSelect = document.getElementById('speed')
    const selectedLevel = levelSelect.value || 'EASY'
    this.dropInterval = LEVELS[selectedLevel]

    this.clearAnimations = []
    this.dropCounter = 0
    this.lastTime = 0
    this.score = 0
    this.paused = false
    this.gameOver = false
    this.animationId = null

    this.arena = this.createMatrix(12, 20)
    this.player = {
      pos: {x: 0, y: 0},
      matrix: null
    }

    this.updateScore()
  }

  init() {
    this.resetGameState()
    this.playerReset()
    this.update()

    // Disable level selection during gameplay
    const levelSelect = document.getElementById('speed')
    levelSelect.disabled = true
  }

  updateScore() {
    document.getElementById('score').innerText = this.score
  }

  // =====================
  // Matrix / Arena Logic
  // =====================
  createMatrix(width, height) {
    return Array.from({length: height}, () => new Array(width).fill(0))
  }

  createShape(type) {
    return SHAPES[type]
  }

  collide(arena, player) {
    const {matrix, pos} = player

    for (let y = 0; y < matrix.length; ++y) {
      for (let x = 0; x < matrix[y].length; ++x) {
        if (
          matrix[y][x] !== 0 &&
          (arena[y + pos.y] && arena[y + pos.y][x + pos.x]) !== 0
        ) {
          return true
        }
      }
    }

    return false
  }

  merge() {
    const {matrix, pos} = this.player
    matrix.forEach((row, y) => {
      row.forEach((value, x) => {
        if (value !== 0) {
          this.arena[y + pos.y][x + pos.x] = value
        }
      })
    })
  }

  arenaSweep() {
    let linesCleared = 0

    for (let y = this.arena.length - 1; y > 0; --y) {
      if (this.arena[y].every(cell => cell !== 0)) {
        this.clearAnimations.push({row: y, startTime: performance.now()})

        // this.arena.splice(y, 1)
        // this.arena.unshift(new Array(this.arena[0].length).fill(0))
        this.score += 10
        linesCleared++
      }
    }

    if (linesCleared > 0) {
      this.updateScore()
      lineClearSound.currentTime = 0
      lineClearSound.play()
    }
  }

  stopGame() {
    this.gameOver = true
    cancelAnimationFrame(this.animationId)
    this.animationId = null

    this.context.fillStyle = '#000'
    this.context.fillRect(0, 0, this.canvas.width, this.canvas.height)

    this.score = 0
    this.updateScore()

    // Re-enable level selection after game ends
    const levelSelect = document.getElementById('speed')
    levelSelect.disabled = false
  }

  pause() {
    this.paused = true
    cancelAnimationFrame(this.animationId)
  }

  resume() {
    if (!this.paused) return

    this.paused = false
    this.update()
  }

  // =====================
  // Player Logic
  // =====================
  playerReset() {
    if (this.gameOver) return

    const types = Object.keys(SHAPES)
    const type = types[Math.floor(Math.random() * types.length)]

    this.player.matrix = this.createShape(type)
    this.player.pos.y = 0
    this.player.pos.x =
      ((this.arena[0].length / 2) | 0) -
      ((this.player.matrix[0].length / 2) | 0)

    if (this.collide(this.arena, this.player)) {
      this.arena.forEach(row => row.fill(0))
      alert('Game Over')
      this.stopGame()
    }
  }

  playerDrop() {
    this.player.pos.y++
    if (this.collide(this.arena, this.player)) {
      this.player.pos.y--
      this.merge(this.arena, this.player)
      this.playerReset()
      this.arenaSweep()
    }

    this.dropCounter = 0
  }

  playerMove(dir) {
    this.player.pos.x += dir
    if (this.collide(this.arena, this.player)) {
      this.player.pos.x -= dir
    }
  }

  rotate(matrix, dir) {
    for (let y = 0; y < matrix.length; ++y) {
      for (let x = 0; x < y; ++x) {
        ;[matrix[x][y], matrix[y][x]] = [matrix[y][x], matrix[x][y]]
      }
    }

    if (dir > 0) {
      matrix.forEach(row => row.reverse())
    } else {
      matrix.reverse()
    }
  }

  playerRotate(dir) {
    const pos = this.player.pos.x
    let offset = 1
    this.rotate(this.player.matrix, dir)

    while (this.collide(this.arena, this.player)) {
      this.player.pos.x += offset
      offset = -(offset + (offset > 0 ? 1 : -1))
      if (offset > this.player.matrix[0].length) {
        this.rotate(this.player.matrix, -dir)
        this.player.pos.x = pos
        return
      }
    }
  }

  // =====================
  // Drawing & Loop
  // =====================
  drawMatrix(matrix, offset, opacity = 1) {
    this.context.globalAlpha = opacity

    matrix.forEach((row, y) => {
      row.forEach((value, x) => {
        if (value !== 0) {
          this.context.fillStyle = COLORS[value]
          this.context.fillRect(x + offset.x, y + offset.y, 1, 1)
        }
      })
    })

    this.context.globalAlpha = 1
  }

  drawClearAnimations(time) {
    const duration = 600 // ms
    const remaining = []

    for (const anim of this.clearAnimations) {
      const progress = (time - anim.startTime) / duration

      if (progress >= 1) {
        // Remove the row
        this.arena.splice(anim.row, 1)
        this.arena.unshift(new Array(this.arena[0].length).fill(0))
        this.score += 10
        this.updateScore()
      } else {
        const opacity = 1 - progress
        const fakeRow = this.arena[anim.row].map(v => (v === 0 ? 0 : 7))
        this.drawMatrix([fakeRow], {x: 0, y: anim.row}, opacity)
        remaining.push(anim)
      }
    }

    this.clearAnimations = remaining
  }

  draw() {
    if (this.gameOver) return

    this.context.fillStyle = '#000'
    this.context.fillRect(0, 0, this.canvas.clientWidth, this.canvas.height)

    this.drawMatrix(this.arena, {x: 0, y: 0})

    this.drawMatrix(this.player.matrix, this.player.pos)

    this.drawClearAnimations(performance.now())
  }

  update(time = 0) {
    if (this.paused || this.gameOver) return

    const deltaTime = time - this.lastTime
    this.lastTime = time
    this.dropCounter += deltaTime
    if (this.dropCounter > this.dropInterval) {
      this.playerDrop()
    }

    this.draw()
    this.animationId = requestAnimationFrame(t => this.update(t))
  }

  registerEventListener() {
    document.addEventListener('keydown', event => {
      switch (event.key) {
        case 'ArrowLeft':
          this.playerMove(-1)
          break
        case 'ArrowRight':
          this.playerMove(1)
          break
        case 'ArrowDown':
          this.playerDrop()
          break
        case 'q':
          this.playerRotate(-1)
          break
        case 'w':
          this.playerRotate(1)
          break
      }
    })
  }
}

let game = null

function startGame() {
  if (game) return

  game = new Tetris()
  game.init()
}

function stopGame() {
  if (!game) return

  game.stopGame()
  game = null
}

function pauseGame() {
  if (game) game.pause()
}

function resumeGame() {
  if (game) game.resume()
}
