const canvas = document.querySelector("#game");
const ctx = canvas.getContext("2d");

const scoreEl = document.querySelector("#score");
const coinsEl = document.querySelector("#coins");
const levelEl = document.querySelector("#level");
const livesEl = document.querySelector("#lives");
const powerEl = document.querySelector("#power");
const homeScreen = document.querySelector("#homeScreen");
const shopScreen = document.querySelector("#shopScreen");
const playButton = document.querySelector("#playButton");
const shopButton = document.querySelector("#shopButton");
const backHomeButton = document.querySelector("#backHomeButton");
const skinGrid = document.querySelector("#skinGrid");
const shopCoinsEl = document.querySelector("#shopCoins");
const homeButton = document.querySelector("#homeButton");
const shopToolbarButton = document.querySelector("#shopToolbarButton");
const startButton = document.querySelector("#startButton");
const pauseButton = document.querySelector("#pauseButton");
const resetButton = document.querySelector("#resetButton");

const W = canvas.width;
const H = canvas.height;
const keys = new Set();
const saveKey = "breakoutLabSave";
const coinsPerBrick = 1;
let lastQuilloVoiceAt = 0;

const powerTypes = {
  wide: { color: "#47d7ac", label: "Breit" },
  slow: { color: "#ffcb66", label: "Langsam" },
  laser: { color: "#7bb7ff", label: "Laser" },
  life: { color: "#ff6f7f", label: "+1 Leben" },
};

const skins = [
  { id: "classic", name: "Der Kleine", price: 0, colors: ["#f4f7fb", "#47d7ac"] },
  { id: "sun", name: "Der Tolle", price: 20, colors: ["#ffcb66", "#ff8f70"] },
  { id: "aqua", name: "Der Hervorragende", price: 50, colors: ["#7bb7ff", "#47d7ac"] },
  { id: "berry", name: "Die Lele", price: 80, colors: ["#d98cff", "#ff6f7f"] },
  { id: "mono", name: "Der Neutronenstern", price: 140, colors: ["#f4f7fb", "#9da8b7"] },
  { id: "lime", name: "Der Säurekiller", price: 200, colors: ["#c7ff6b", "#47d7ac"] },
  { id: "ember", name: "Der King", price: 350, colors: ["#ff8f70", "#ffcb66"] },
  { id: "nebula", name: "Der Nebulak", price: 500, colors: ["#d98cff", "#7bb7ff"] },
  { id: "crystal", name: "Der Respektlose", price: 750, colors: ["#ffffff", "#7bb7ff"] },
  { id: "shadow", name: "Der Ultimat", price: 1000, colors: ["#9da8b7", "#2f3947"] },
  { id: "ruby", name: "Der Schöne", price: 2000, colors: ["#ff6f7f", "#d98cff"] },
  { id: "gold", name: "Der Maximal Aura", price: 3000, colors: ["#ffe38a", "#ffcb66"] },
  { id: "plasma", name: "Der Nonchalant", price: 5000, colors: ["#47d7ac", "#d98cff"] },
  { id: "void", name: "Der Chickennuggetzerstörer", price: 7500, colors: ["#e6a23c", "#c77f28"] },
  { id: "ultimate", name: "Der Maskulineendbossfighter", price: 10000, colors: ["#ffffff", "#ffcb66"] },
];

let game;
let lastTime = 0;
let save = loadSave();

function createGame() {
  return {
    state: "ready",
    score: 0,
    level: 1,
    lives: 3,
    combo: 0,
    paddle: {
      x: W / 2 - 65,
      y: H - 48,
      w: 130,
      h: 15,
      speed: 560,
      baseW: 130,
    },
    balls: [makeBall()],
    bricks: [],
    powerups: [],
    lasers: [],
    particles: [],
    activePower: null,
    powerTimer: 0,
    shake: 0,
    message: "Klicke Start oder drücke die Leertaste",
  };
}

function makeBall() {
  return {
    x: W / 2,
    y: H - 72,
    r: 8,
    vx: 245,
    vy: -315,
    speed: 400,
    stuck: true,
  };
}

function loadSave() {
  const fallback = { coins: 0, ownedSkins: ["classic"], equippedSkin: "classic" };

  try {
    const loaded = JSON.parse(localStorage.getItem(saveKey));
    if (!loaded || !Array.isArray(loaded.ownedSkins)) return fallback;

    const ownedSkins = loaded.ownedSkins.includes("classic")
      ? loaded.ownedSkins
      : ["classic", ...loaded.ownedSkins];

    return {
      coins: Number.isFinite(loaded.coins) ? loaded.coins : 0,
      ownedSkins,
      equippedSkin: ownedSkins.includes(loaded.equippedSkin) ? loaded.equippedSkin : "classic",
    };
  } catch (error) {
    return fallback;
  }
}

function writeSave() {
  localStorage.setItem(saveKey, JSON.stringify(save));
}

function currentSkin() {
  return skins.find((skin) => skin.id === save.equippedSkin) || skins[0];
}

function addCoins(amount) {
  save.coins += amount;
  writeSave();
  updateHud();
}

function sayQuillo() {
  if (!("speechSynthesis" in window) || !("SpeechSynthesisUtterance" in window)) return;

  const now = performance.now();
  if (now - lastQuilloVoiceAt < 180) return;
  lastQuilloVoiceAt = now;

  const utterance = new SpeechSynthesisUtterance("Quillo");
  const voices = speechSynthesis.getVoices();
  const japaneseVoice = voices.find((voice) => voice.lang && voice.lang.toLowerCase().startsWith("ja"));
  if (japaneseVoice) utterance.voice = japaneseVoice;
  utterance.lang = japaneseVoice ? japaneseVoice.lang : "ja-JP";
  utterance.pitch = 1.65;
  utterance.rate = 1.18;
  utterance.volume = 0.85;
  speechSynthesis.cancel();
  speechSynthesis.speak(utterance);
}
function showScreen(name) {
  homeScreen.classList.toggle("active", name === "home");
  shopScreen.classList.toggle("active", name === "shop");

  if (name === "shop") {
    if (game.state === "playing") game.state = "paused";
    game.message = "Shop";
    renderShop();
  }
}

function hideScreens() {
  homeScreen.classList.remove("active");
  shopScreen.classList.remove("active");
}

function buildLevel() {
  game.bricks.length = 0;
  const rows = Math.min(4 + game.level, 8);
  const cols = 10;
  const gap = 8;
  const top = 76;
  const brickW = (W - 92 - gap * (cols - 1)) / cols;
  const palette = ["#47d7ac", "#ffcb66", "#7bb7ff", "#ff8f70", "#d98cff"];

  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < cols; col += 1) {
      const tough = row < Math.floor(game.level / 2);
      game.bricks.push({
        x: 46 + col * (brickW + gap),
        y: top + row * 26,
        w: brickW,
        h: 18,
        hp: tough ? 2 : 1,
        maxHp: tough ? 2 : 1,
        color: palette[(row + col + game.level) % palette.length],
      });
    }
  }
}

function resetBall() {
  game.balls = [makeBall()];
  game.paddle.x = W / 2 - game.paddle.w / 2;
  game.message = "Bereit";
}

function startGame() {
  hideScreens();

  if (game.state === "gameover" || game.state === "win") {
    game = createGame();
    buildLevel();
  }

  game.state = "playing";
  game.message = "";
  for (const ball of game.balls) {
    ball.stuck = false;
  }
}

function togglePause() {
  if (game.state === "playing") {
    game.state = "paused";
    game.message = "Pause";
  } else if (game.state === "paused") {
    game.state = "playing";
    game.message = "";
  }
}

function resetGame() {
  game = createGame();
  buildLevel();
  hideScreens();
  updateHud();
}

function renderShop() {
  shopCoinsEl.textContent = save.coins;
  skinGrid.innerHTML = "";

  for (const skin of skins) {
    const owned = save.ownedSkins.includes(skin.id);
    const equipped = save.equippedSkin === skin.id;
    const card = document.createElement("article");
    card.className = `skin-card${equipped ? " equipped" : ""}`;
    card.innerHTML = `
      <div class="skin-preview" style="color: ${skin.colors[1]}; background: radial-gradient(circle at 32% 30%, #ffffff 0 12%, ${skin.colors[0]} 13% 48%, ${skin.colors[1]} 49% 100%);"></div>
      <h3>${skin.name}</h3>
      <p>${owned ? "Gekauft" : `${skin.price} Quillo`}</p>
      <button type="button" data-skin="${skin.id}">${equipped ? "Aktiv" : owned ? "Auswählen" : "Kaufen"}</button>
    `;

    const button = card.querySelector("button");
    button.disabled = equipped || (!owned && save.coins < skin.price);
    button.addEventListener("click", () => buyOrEquipSkin(skin.id));
    skinGrid.append(card);
  }
}

function buyOrEquipSkin(id) {
  const skin = skins.find((item) => item.id === id);
  if (!skin) return;

  if (!save.ownedSkins.includes(id)) {
    if (save.coins < skin.price) return;
    save.coins -= skin.price;
    save.ownedSkins.push(id);
  }

  save.equippedSkin = id;
  writeSave();
  renderShop();
  updateHud();
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function rectsOverlap(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

function spawnParticles(x, y, color, amount = 10) {
  for (let i = 0; i < amount; i += 1) {
    const angle = Math.random() * Math.PI * 2;
    const speed = 80 + Math.random() * 240;
    game.particles.push({
      x,
      y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      life: 0.35 + Math.random() * 0.35,
      color,
    });
  }
}

function spawnPowerup(x, y) {
  if (Math.random() > 0.24) return;
  const types = Object.keys(powerTypes);
  const type = types[Math.floor(Math.random() * types.length)];
  game.powerups.push({ x, y, w: 28, h: 18, vy: 130, type });
}

function activatePower(type) {
  if (type === "life") {
    game.lives += 1;
    game.activePower = "+1 Leben";
    game.powerTimer = 1.2;
    return;
  }

  game.activePower = powerTypes[type].label;
  game.powerTimer = 8;

  if (type === "wide") {
    game.paddle.w = 190;
  }

  if (type === "slow") {
    for (const ball of game.balls) {
      ball.vx *= 0.78;
      ball.vy *= 0.78;
    }
  }
}

function fireLaser() {
  if (game.activePower !== "Laser") return;
  if (game.lasers.length > 5) return;

  game.lasers.push({
    x: game.paddle.x + 16,
    y: game.paddle.y - 10,
    w: 4,
    h: 16,
    vy: -650,
  });
  game.lasers.push({
    x: game.paddle.x + game.paddle.w - 20,
    y: game.paddle.y - 10,
    w: 4,
    h: 16,
    vy: -650,
  });
}

function update(dt) {
  if (game.state !== "playing") return;

  const paddle = game.paddle;
  const moveLeft = keys.has("ArrowLeft") || keys.has("KeyA");
  const moveRight = keys.has("ArrowRight") || keys.has("KeyD");

  if (moveLeft) paddle.x -= paddle.speed * dt;
  if (moveRight) paddle.x += paddle.speed * dt;
  paddle.x = clamp(paddle.x, 14, W - paddle.w - 14);

  if (game.activePower) {
    game.powerTimer -= dt;
    if (game.powerTimer <= 0) {
      game.activePower = null;
      game.paddle.w = game.paddle.baseW;
      game.paddle.x = clamp(game.paddle.x, 14, W - game.paddle.w - 14);
    }
  }

  updateBalls(dt);
  updatePowerups(dt);
  updateLasers(dt);
  updateParticles(dt);
  game.shake = Math.max(0, game.shake - dt * 18);

  if (game.bricks.length === 0) {
    game.level += 1;
    game.score += 500;
    game.activePower = null;
    game.paddle.w = game.paddle.baseW;
    buildLevel();
    resetBall();
    game.state = "ready";
    game.message = "Level geschafft!";
  }
}

function updateBalls(dt) {
  for (const ball of game.balls) {
    if (ball.stuck) {
      ball.x = game.paddle.x + game.paddle.w / 2;
      ball.y = game.paddle.y - ball.r - 2;
      continue;
    }

    ball.x += ball.vx * dt;
    ball.y += ball.vy * dt;

    if (ball.x - ball.r < 0 || ball.x + ball.r > W) {
      ball.vx *= -1;
      ball.x = clamp(ball.x, ball.r, W - ball.r);
    }
    if (ball.y - ball.r < 0) {
      ball.vy *= -1;
      ball.y = ball.r;
    }

    const paddleBox = { x: game.paddle.x, y: game.paddle.y, w: game.paddle.w, h: game.paddle.h };
    const ballBox = { x: ball.x - ball.r, y: ball.y - ball.r, w: ball.r * 2, h: ball.r * 2 };
    if (ball.vy > 0 && rectsOverlap(ballBox, paddleBox)) {
      const hit = (ball.x - (game.paddle.x + game.paddle.w / 2)) / (game.paddle.w / 2);
      ball.vx = hit * ball.speed;
      ball.vy = -Math.sqrt(Math.max(90000, ball.speed * ball.speed - ball.vx * ball.vx));
      ball.y = game.paddle.y - ball.r - 1;
      game.combo = 0;
    }

    hitBricksWithBall(ball);
  }

  game.balls = game.balls.filter((ball) => ball.y - ball.r < H + 20);
  if (game.balls.length === 0) {
    game.lives -= 1;
    game.combo = 0;
    game.activePower = null;
    game.paddle.w = game.paddle.baseW;

    if (game.lives <= 0) {
      game.state = "gameover";
      game.message = "Game Over";
    } else {
      resetBall();
      game.state = "ready";
    }
  }
}

function hitBricksWithBall(ball) {
  const ballBox = { x: ball.x - ball.r, y: ball.y - ball.r, w: ball.r * 2, h: ball.r * 2 };

  for (let i = game.bricks.length - 1; i >= 0; i -= 1) {
    const brick = game.bricks[i];
    if (!rectsOverlap(ballBox, brick)) continue;

    brick.hp -= 1;
    ball.vy *= -1;
    game.shake = 0.45;
    game.combo += 1;
    game.score += 50 + game.combo * 5;
    spawnParticles(ball.x, ball.y, brick.color);

    if (brick.hp <= 0) {
      game.bricks.splice(i, 1);
      addCoins(coinsPerBrick);
      spawnPowerup(brick.x + brick.w / 2, brick.y + brick.h / 2);
    }
    break;
  }
}

function updatePowerups(dt) {
  for (const powerup of game.powerups) {
    powerup.y += powerup.vy * dt;
  }

  const paddleBox = { x: game.paddle.x, y: game.paddle.y, w: game.paddle.w, h: game.paddle.h };
  for (let i = game.powerups.length - 1; i >= 0; i -= 1) {
    const powerup = game.powerups[i];
    if (rectsOverlap(powerup, paddleBox)) {
      activatePower(powerup.type);
      spawnParticles(powerup.x, powerup.y, powerTypes[powerup.type].color, 16);
      game.powerups.splice(i, 1);
    } else if (powerup.y > H + 30) {
      game.powerups.splice(i, 1);
    }
  }
}

function updateLasers(dt) {
  for (const laser of game.lasers) {
    laser.y += laser.vy * dt;
  }

  for (let i = game.lasers.length - 1; i >= 0; i -= 1) {
    const laser = game.lasers[i];
    let used = false;

    for (let j = game.bricks.length - 1; j >= 0; j -= 1) {
      const brick = game.bricks[j];
      if (!rectsOverlap(laser, brick)) continue;

      brick.hp -= 1;
      game.score += 35;
      spawnParticles(laser.x, laser.y, brick.color, 7);
      if (brick.hp <= 0) {
        game.bricks.splice(j, 1);
        addCoins(coinsPerBrick);
        spawnPowerup(brick.x + brick.w / 2, brick.y + brick.h / 2);
      }
      used = true;
      break;
    }

    if (used || laser.y < -20) {
      game.lasers.splice(i, 1);
    }
  }
}

function updateParticles(dt) {
  for (const particle of game.particles) {
    particle.x += particle.vx * dt;
    particle.y += particle.vy * dt;
    particle.vy += 420 * dt;
    particle.life -= dt;
  }
  game.particles = game.particles.filter((particle) => particle.life > 0);
}

function draw() {
  ctx.save();
  ctx.clearRect(0, 0, W, H);

  if (game.shake > 0) {
    ctx.translate((Math.random() - 0.5) * game.shake * 6, (Math.random() - 0.5) * game.shake * 6);
  }

  drawBackground();
  drawBricks();
  drawPaddle();
  drawBalls();
  drawPowerups();
  drawLasers();
  drawParticles();

  if (game.message) {
    drawMessage(game.message);
  }

  ctx.restore();
  updateHud();
}

function drawBackground() {
  ctx.fillStyle = "#0d1117";
  ctx.fillRect(0, 0, W, H);

  ctx.strokeStyle = "rgba(255,255,255,0.06)";
  ctx.lineWidth = 1;
  for (let x = 0; x < W; x += 40) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, H);
    ctx.stroke();
  }
  for (let y = 0; y < H; y += 40) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(W, y);
    ctx.stroke();
  }
}

function drawBricks() {
  for (const brick of game.bricks) {
    ctx.fillStyle = brick.hp < brick.maxHp ? "#f4f7fb" : brick.color;
    roundRect(brick.x, brick.y, brick.w, brick.h, 5);
    ctx.fill();

    ctx.fillStyle = "rgba(0,0,0,0.20)";
    ctx.fillRect(brick.x, brick.y + brick.h - 4, brick.w, 4);
  }
}

function drawPaddle() {
  const paddle = game.paddle;
  const gradient = ctx.createLinearGradient(paddle.x, paddle.y, paddle.x + paddle.w, paddle.y);
  gradient.addColorStop(0, "#47d7ac");
  gradient.addColorStop(1, "#7bb7ff");
  ctx.fillStyle = gradient;
  roundRect(paddle.x, paddle.y, paddle.w, paddle.h, 8);
  ctx.fill();
}

function drawBalls() {
  const skin = currentSkin();
  for (const ball of game.balls) {
    const gradient = ctx.createRadialGradient(ball.x - 3, ball.y - 4, 2, ball.x, ball.y, ball.r);
    gradient.addColorStop(0, "#ffffff");
    gradient.addColorStop(0.45, skin.colors[0]);
    gradient.addColorStop(1, skin.colors[1]);
    ctx.beginPath();
    ctx.fillStyle = gradient;
    ctx.shadowColor = skin.colors[1];
    ctx.shadowBlur = 14;
    ctx.arc(ball.x, ball.y, ball.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
  }
}

function drawPowerups() {
  for (const powerup of game.powerups) {
    ctx.fillStyle = powerTypes[powerup.type].color;
    roundRect(powerup.x - powerup.w / 2, powerup.y - powerup.h / 2, powerup.w, powerup.h, 6);
    ctx.fill();

    ctx.fillStyle = "#111318";
    ctx.font = "700 12px Segoe UI, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(powerup.type[0].toUpperCase(), powerup.x, powerup.y);
  }
}

function drawLasers() {
  ctx.fillStyle = "#7bb7ff";
  for (const laser of game.lasers) {
    roundRect(laser.x, laser.y, laser.w, laser.h, 2);
    ctx.fill();
  }
}

function drawParticles() {
  for (const particle of game.particles) {
    ctx.globalAlpha = clamp(particle.life * 2.2, 0, 1);
    ctx.fillStyle = particle.color;
    ctx.fillRect(particle.x, particle.y, 4, 4);
  }
  ctx.globalAlpha = 1;
}

function drawMessage(text) {
  ctx.fillStyle = "rgba(13,17,23,0.72)";
  roundRect(W / 2 - 240, H / 2 - 54, 480, 108, 8);
  ctx.fill();

  ctx.fillStyle = "#f4f7fb";
  ctx.font = "800 30px Segoe UI, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text, W / 2, H / 2 - 12);

  ctx.fillStyle = "#9da8b7";
  ctx.font = "600 16px Segoe UI, sans-serif";
  ctx.fillText("A/D oder Pfeile bewegen, Leertaste startet, F schiesst", W / 2, H / 2 + 24);
}

function roundRect(x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
}

function updateHud() {
  scoreEl.textContent = game.score;
  coinsEl.textContent = save.coins;
  shopCoinsEl.textContent = save.coins;
  levelEl.textContent = game.level;
  livesEl.textContent = game.lives;
  powerEl.textContent = game.activePower || "-";
}

function loop(time) {
  const dt = Math.min(0.033, (time - lastTime) / 1000 || 0);
  lastTime = time;
  update(dt);
  draw();
  requestAnimationFrame(loop);
}

window.addEventListener("keydown", (event) => {
  keys.add(event.code);

  if (event.code === "Space") {
    event.preventDefault();
    if (homeScreen.classList.contains("active") || shopScreen.classList.contains("active")) hideScreens();
    if (game.state === "ready" || game.state === "gameover" || game.state === "win") startGame();
  }
  if (event.code === "KeyP") togglePause();
  if (event.code === "KeyF") fireLaser();
});

window.addEventListener("keyup", (event) => {
  keys.delete(event.code);
});

function movePaddleToClientX(clientX) {
  const rect = canvas.getBoundingClientRect();
  const scale = W / rect.width;
  game.paddle.x = clamp((clientX - rect.left) * scale - game.paddle.w / 2, 14, W - game.paddle.w - 14);
}

canvas.addEventListener("mousemove", (event) => {
  movePaddleToClientX(event.clientX);
});

canvas.addEventListener("pointerdown", (event) => {
  event.preventDefault();
  canvas.setPointerCapture(event.pointerId);
  movePaddleToClientX(event.clientX);
  hideScreens();
  if (game.state !== "playing") startGame();
});

canvas.addEventListener("pointermove", (event) => {
  if (event.pointerType === "touch" || event.buttons === 1) {
    event.preventDefault();
    movePaddleToClientX(event.clientX);
  }
});

canvas.addEventListener("click", () => {
  hideScreens();
  if (game.state !== "playing") startGame();
});

playButton.addEventListener("click", () => {
  hideScreens();
  startGame();
});
shopButton.addEventListener("click", () => showScreen("shop"));
homeButton.addEventListener("click", () => showScreen("home"));
shopToolbarButton.addEventListener("click", () => showScreen("shop"));
backHomeButton.addEventListener("click", () => showScreen("home"));
startButton.addEventListener("click", startGame);
pauseButton.addEventListener("click", togglePause);
resetButton.addEventListener("click", resetGame);

game = createGame();
buildLevel();
renderShop();
updateHud();
requestAnimationFrame(loop);





