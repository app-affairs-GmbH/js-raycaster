class Player {
  constructor(x, y) {
    this.x = x
    this.y = y
    this.radians = 0
    this.lineLength = 40
    this.size = 20
    this.speed = 2
  }

  drawPlayer(mapContext) {
    mapContext.save()
    mapContext.fillStyle = "white"
    mapContext.fillRect(this.x - this.size / 2, this.y - this.size / 2, this.size, this.size)

    mapContext.beginPath()
    mapContext.moveTo(this.x, this.y)
    mapContext.strokeStyle = "white"
    mapContext.lineTo(
      this.x + Math.cos(this.radians) * this.lineLength,
      this.y + Math.sin(this.radians) * this.lineLength
    )
    mapContext.stroke()
    mapContext.restore()
  }
}

class Ray {
  constructor(x, y, radians, isVertical) {
    this.x = x
    this.y = y
    this.radians = radians
    this.length = 9999
    this.isVertical = isVertical
  }

  drawRay(mapContext) {
    mapContext.save()
    mapContext.beginPath()
    mapContext.moveTo(this.x, this.y)
    mapContext.strokeStyle = this.isVertical ? "#99a600" : "#b0c700"
    mapContext.lineTo(
      this.x + Math.cos(this.radians) * this.length,
      this.y + Math.sin(this.radians) * this.length
    )
    mapContext.stroke()

    if (this.hitX && this.hitY) {
      mapContext.beginPath()
      mapContext.fillStyle = this.isVertical ? "#99a600" : "#b0c700"
      mapContext.arc(this.hitX, this.hitY, 4, 0, 2 * Math.PI)
      mapContext.fill()
    }
    mapContext.restore()
  }
}

class Raycaster {
  constructor(mapCanvas, gameCanvas) {
    this.mapCanvas = mapCanvas
    this.gameCanvas = gameCanvas
    this.raysArray = []
    this.init()
  }

  init() {
    this.map = [
      [1,1,1,1,1,1,1,1],
      [1,0,1,0,0,0,0,1],
      [1,0,1,1,1,1,0,1],
      [1,0,0,0,1,0,0,1],
      [1,0,1,1,1,0,0,1],
      [1,0,0,0,0,0,0,1],
      [1,0,0,0,0,0,0,1],
      [1,1,1,1,1,1,1,1],
    ]

    this.tileSize = 64
    this.mapScale = 0.5
    this.mapSizeX = this.map[0].length
    this.mapSizeY = this.map.length

    this.mapContext = this.mapCanvas.getContext("2d")
    this.mapContext.width = this.tileSize * this.mapSizeX
    this.mapContext.height = this.tileSize * this.mapSizeY
    this.mapCanvas.width = this.mapContext.width * this.mapScale
    this.mapCanvas.height = this.mapContext.height * this.mapScale
    this.mapContext.scale(this.mapScale, this.mapScale)

    this.gameContext = this.gameCanvas.getContext("2d")
    this.gameContext.width = 640
    this.gameContext.height = 480
    this.gameCanvas.width = this.gameContext.width
    this.gameCanvas.height = this.gameContext.height

    this.player = new Player(2.5 * this.tileSize, 5.5 * this.tileSize)

    this.keysDown = {}
    document.addEventListener('keydown', (evt) => {
      this.keysDown[evt.key] = true
    })
    document.addEventListener('keyup', (evt) => {
      delete this.keysDown[evt.key]
    })
    window.addEventListener("blur", (evt) => {
      this.keysDown = {}
    })

    this.drawMap()
    this.tick()
  }

  isInbounds(tileX, tileY) {
    return tileX >= 0 && tileX < this.mapSizeX && tileY >= 0 && tileY < this.mapSizeY
  }

  getWallTileAtPos(x, y) {
    const tileX = Math.floor(x / this.tileSize)
    const tileY = Math.floor(y / this.tileSize)
    return { tileX, tileY, type: this.isInbounds(tileX, tileY) ? this.map[tileY][tileX] : 0}
  }

  clampRadians(r) {
    if (r > 2 * Math.PI) r -= 2 * Math.PI
    if (r < 0) r += 2 * Math.PI
    return r
  }

  tick() {
    const deltaX = Math.cos(this.player.radians) * this.player.speed
    const deltaY = Math.sin(this.player.radians) * this.player.speed
    let newPosX = this.player.x
    let newPosY = this.player.y

    if (this.keysDown['w']) {
      newPosX = this.player.x + deltaX
      newPosY = this.player.y + deltaY
    }
    else if (this.keysDown['s']) {
      newPosX = this.player.x - deltaX
      newPosY = this.player.y - deltaY
    }

    if (this.getWallTileAtPos(newPosX, this.player.y).type == 0) {
      this.player.x = newPosX
    }
    if (this.getWallTileAtPos(this.player.x, newPosY).type == 0) {
      this.player.y = newPosY
    }

    if (this.keysDown['a']) {
      this.player.radians = this.clampRadians(this.player.radians - 0.05)
    }
    else if (this.keysDown['d']) {
      this.player.radians = this.clampRadians(this.player.radians + 0.05)
    }

    this.drawMap()
    this.castRays()
    this.drawGame()
    setTimeout(() => { this.tick() }, 10)
  }

  getVerticalIntersection(ray) {
    const radians = this.clampRadians(ray.radians)
    const facingRight = radians <= 0.5 * Math.PI || radians >= 1.5 * Math.PI
    const { tileX, tileY } = this.getWallTileAtPos(this.player.x, this.player.y)
    const firstX = tileX * this.tileSize + (facingRight ? this.tileSize : 0)
    const firstY = this.player.y + (firstX - this.player.x) * Math.tan(radians)
    const deltaXPerTile = facingRight ? this.tileSize : -this.tileSize
    const deltaYPerTile = deltaXPerTile * Math.tan(radians)

    let wall
    let nextX = firstX
    let nextY = firstY

    while (!wall) {
      const nextTile = this.getWallTileAtPos(nextX, nextY)
      const nextTileX = nextTile.tileX - (facingRight ? 0 : 1)
      const nextTileY = nextTile.tileY

      if (!this.isInbounds(nextTileX, nextTileY)) {
        break
      }

      wall = this.map[nextTileY][nextTileX]
      if (!wall) {
        nextX += deltaXPerTile
        nextY += deltaYPerTile
      }

      ray.hitX = nextX
      ray.hitY = nextY

      const deltaX = nextX - this.player.x
      const deltaY = nextY - this.player.y
      ray.length = Math.sqrt(deltaX * deltaX + deltaY * deltaY)
    }
    return ray
  }

  getHorizontalIntersection(ray) {
    const radians = this.clampRadians(ray.radians)
    const facingUp = radians >= Math.PI
    const { tileX, tileY } = this.getWallTileAtPos(this.player.x, this.player.y)
    const firstY = tileY * this.tileSize + (facingUp ? 0 : this.tileSize)
    const firstX = this.player.x + (firstY - this.player.y) / Math.tan(radians)
    const deltaYPerTile = facingUp ? -this.tileSize : this.tileSize
    const deltaXPerTile = deltaYPerTile / Math.tan(radians)

    let wall
    let nextX = firstX
    let nextY = firstY

    while (!wall) {
      const nextTile = this.getWallTileAtPos(nextX, nextY)
      const nextTileX = nextTile.tileX
      const nextTileY = nextTile.tileY - (facingUp ? 1 : 0)

      if (!this.isInbounds(nextTileX, nextTileY)) {
        break
      }

      wall = this.map[nextTileY][nextTileX]
      if (!wall) {
        nextX += deltaXPerTile
        nextY += deltaYPerTile
      }

      ray.hitX = nextX
      ray.hitY = nextY

      const deltaX = nextX - this.player.x
      const deltaY = nextY - this.player.y
      ray.length = Math.sqrt(deltaX * deltaX + deltaY * deltaY)
    }
    return ray
  }

  castRays() {
    this.fov = 45 / 180 * Math.PI
    this.rayCount = 320
    this.radiansPerRay = this.fov / this.rayCount
    const startRadians = this.player.radians - this.fov / 2
    this.raysArray = []
    for (var r = 0; r < this.rayCount; r++) {
      const radians = startRadians + r * this.radiansPerRay
      let rayV = this.getVerticalIntersection(new Ray(this.player.x, this.player.y, radians, true))
      let rayH = this.getHorizontalIntersection(new Ray(this.player.x, this.player.y, radians, false))
      let ray = rayV.length < rayH.length ? rayV : rayH
      this.raysArray.push(ray)
      ray.drawRay(this.mapContext)
    }
  }

  drawMap() {
    this.mapContext.save()
    this.mapContext.clearRect(0,0,this.mapContext.width / this.mapScale, this.mapContext.height / this.mapScale)
    this.mapContext.fillStyle = "#888888"
    for (var row = 0; row < this.mapSizeY; row++) {
      for (var col = 0; col < this.mapSizeX; col++) {
        const wallType = this.map[row][col]
        if (wallType > 0) {
          this.mapContext.fillRect(col * this.tileSize, row * this.tileSize, this.tileSize - 1, this.tileSize - 1)
        }
      }
    }
    this.mapContext.restore()
    this.player.drawPlayer(this.mapContext)
  }

  fixFishEye(distance, radians) {
    const diff = radians - this.player.radians
    return distance * Math.cos(diff)
  }

  drawGame() {
    this.gameContext.save()
    this.gameContext.clearRect(0, 0, this.gameContext.width, this.gameContext.height)

    var xPos = 0
    const yCenter = this.gameContext.height / 2
    const rayLineWidth = this.gameContext.width / this.rayCount

    for (let ray of this.raysArray) {
      const rayLength = this.fixFishEye(ray.length, ray.radians)
      const wallHeight = (100 / rayLength) * this.gameContext.height
      const wallTop = yCenter - wallHeight / 2
      const wallBottom = wallTop + wallHeight

      this.gameContext.fillStyle = ray.isVertical ? "#0000cc" : "#0000ff"
      this.gameContext.fillRect(xPos, wallTop, rayLineWidth, wallHeight)

      this.gameContext.fillStyle = "#555555"
      this.gameContext.fillRect(xPos, wallBottom, rayLineWidth, this.gameContext.height - wallBottom)

      this.gameContext.fillStyle = "#999999"
      this.gameContext.fillRect(xPos, 0, rayLineWidth, wallTop)

      xPos += rayLineWidth
    }
    this.gameContext.restore()
  }
}