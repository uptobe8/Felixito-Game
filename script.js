const canvas = document.querySelector('#game');
const ctx = canvas.getContext('2d');

const scoreEl = document.querySelector('#score');
const bestScoreEl = document.querySelector('#bestScore');
const levelEl = document.querySelector('#level');
const livesEl = document.querySelector('#lives');
const timeEl = document.querySelector('#time');
const startBtn = document.querySelector('#startBtn');
const pauseBtn = document.querySelector('#pauseBtn');
const resetBtn = document.querySelector('#resetBtn');

const state = {
  running: false,
  paused: false,
  score: 0,
  best: Number(localStorage.getItem('felixitoBest') || 0),
  level: 1,
  lives: 3,
  time: 60,
  lastTick: 0,
  keys: new Set(),
  player: { x: 460, y: 450, w: 64, h: 64, speed: 520 },
  items: []
};

bestScoreEl.textContent = state.best;

function resetGame() {
  state.running = false;
  state.paused = false;
  state.score = 0;
  state.level = 1;
  state.lives = 3;
  state.time = 60;
  state.player.x = canvas.width / 2 - state.player.w / 2;
  state.items = [];
  updateHud();
  drawStartScreen();
  startBtn.disabled = false;
  pauseBtn.disabled = true;
  pauseBtn.textContent = 'Pausa';
}

function updateHud() {
  scoreEl.textContent = state.score;
  bestScoreEl.textContent = state.best;
  levelEl.textContent = state.level;
  livesEl.textContent = state.lives;
  timeEl.textContent = Math.max(0, Math.ceil(state.time));
}

function startGame() {
  if (!state.running) {
    state.running = true;
    state.paused = false;
    state.lastTick = performance.now();
    startBtn.disabled = true;
    pauseBtn.disabled = false;
    requestAnimationFrame(loop);
  }
}

function endGame() {
  state.running = false;
  if (state.score > state.best) {
    state.best = state.score;
    localStorage.setItem('felixitoBest', String(state.best));
  }
  updateHud();
  drawGameOver();
  startBtn.disabled = false;
  pauseBtn.disabled = true;
}

function spawnItem() {
  const isStar = Math.random() > 0.28;
  state.items.push({
    type: isStar ? 'star' : 'bomb',
    x: Math.random() * (canvas.width - 44) + 22,
    y: -30,
    r: isStar ? 17 : 19,
    vy: 150 + state.level * 28 + Math.random() * 90,
    spin: Math.random() * Math.PI
  });
}

function loop(now) {
  if (!state.running) return;
  const dt = Math.min((now - state.lastTick) / 1000, 0.05);
  state.lastTick = now;

  if (!state.paused) update(dt);
  draw();
  requestAnimationFrame(loop);
}

function update(dt) {
  state.time -= dt;
  if (state.time <= 0 || state.lives <= 0) return endGame();

  state.level = 1 + Math.floor(state.score / 100);

  if (state.keys.has('arrowleft') || state.keys.has('a')) state.player.x -= state.player.speed * dt;
  if (state.keys.has('arrowright') || state.keys.has('d')) state.player.x += state.player.speed * dt;
  state.player.x = Math.max(0, Math.min(canvas.width - state.player.w, state.player.x));

  const spawnChance = 0.022 + state.level * 0.003;
  if (Math.random() < spawnChance) spawnItem();

  for (const item of state.items) {
    item.y += item.vy * dt;
    item.spin += dt * 4;
  }

  state.items = state.items.filter(item => {
    const hit = circleRect(item, state.player);
    if (hit) {
      if (item.type === 'star') state.score += 10;
      else state.lives -= 1;
      updateHud();
      return false;
    }
    return item.y < canvas.height + 40;
  });

  updateHud();
}

function circleRect(circle, rect) {
  const testX = Math.max(rect.x, Math.min(circle.x, rect.x + rect.w));
  const testY = Math.max(rect.y, Math.min(circle.y, rect.y + rect.h));
  const dx = circle.x - testX;
  const dy = circle.y - testY;
  return dx * dx + dy * dy <= circle.r * circle.r;
}

function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawBackground();
  drawPlayer();
  for (const item of state.items) item.type === 'star' ? drawStar(item) : drawBomb(item);
}

function drawBackground() {
  const grd = ctx.createLinearGradient(0, 0, 0, canvas.height);
  grd.addColorStop(0, '#122849');
  grd.addColorStop(1, '#07101d');
  ctx.fillStyle = grd;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = 'rgba(255,255,255,.12)';
  for (let i = 0; i < 50; i += 1) {
    const x = (i * 197) % canvas.width;
    const y = (i * 89) % canvas.height;
    ctx.beginPath();
    ctx.arc(x, y, (i % 3) + 1, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawPlayer() {
  const p = state.player;
  ctx.save();
  ctx.translate(p.x + p.w / 2, p.y + p.h / 2);
  ctx.fillStyle = '#ffd166';
  ctx.beginPath();
  ctx.roundRect(-p.w / 2, -p.h / 2, p.w, p.h, 18);
  ctx.fill();
  ctx.fillStyle = '#111827';
  ctx.beginPath();
  ctx.arc(-14, -8, 5, 0, Math.PI * 2);
  ctx.arc(14, -8, 5, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#111827';
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.arc(0, 5, 18, 0.15 * Math.PI, 0.85 * Math.PI);
  ctx.stroke();
  ctx.restore();
}

function drawStar(item) {
  ctx.save();
  ctx.translate(item.x, item.y);
  ctx.rotate(item.spin);
  ctx.fillStyle = '#ffd166';
  ctx.beginPath();
  for (let i = 0; i < 10; i += 1) {
    const r = i % 2 === 0 ? item.r : item.r / 2;
    const a = i * Math.PI / 5 - Math.PI / 2;
    ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
  }
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function drawBomb(item) {
  ctx.save();
  ctx.translate(item.x, item.y);
  ctx.fillStyle = '#ef476f';
  ctx.beginPath();
  ctx.arc(0, 0, item.r, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#ffd166';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(8, -14);
  ctx.quadraticCurveTo(22, -32, 2, -34);
  ctx.stroke();
  ctx.restore();
}

function drawCenteredMessage(title, subtitle) {
  drawBackground();
  ctx.fillStyle = 'rgba(3,7,17,.62)';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'center';
  ctx.font = '800 54px system-ui';
  ctx.fillText(title, canvas.width / 2, canvas.height / 2 - 18);
  ctx.fillStyle = '#a9bad3';
  ctx.font = '24px system-ui';
  ctx.fillText(subtitle, canvas.width / 2, canvas.height / 2 + 28);
}

function drawStartScreen() {
  drawCenteredMessage('Felixito Game', 'Pulsa Empezar para jugar');
}

function drawGameOver() {
  drawCenteredMessage('Fin de partida', `Puntuación final: ${state.score}`);
}

window.addEventListener('keydown', event => state.keys.add(event.key.toLowerCase()));
window.addEventListener('keyup', event => state.keys.delete(event.key.toLowerCase()));

canvas.addEventListener('pointermove', event => {
  const rect = canvas.getBoundingClientRect();
  const x = (event.clientX - rect.left) / rect.width * canvas.width;
  state.player.x = Math.max(0, Math.min(canvas.width - state.player.w, x - state.player.w / 2));
});

startBtn.addEventListener('click', startGame);
pauseBtn.addEventListener('click', () => {
  state.paused = !state.paused;
  pauseBtn.textContent = state.paused ? 'Continuar' : 'Pausa';
});
resetBtn.addEventListener('click', resetGame);

if (!CanvasRenderingContext2D.prototype.roundRect) {
  CanvasRenderingContext2D.prototype.roundRect = function roundRect(x, y, w, h, r) {
    this.beginPath();
    this.moveTo(x + r, y);
    this.arcTo(x + w, y, x + w, y + h, r);
    this.arcTo(x + w, y + h, x, y + h, r);
    this.arcTo(x, y + h, x, y, r);
    this.arcTo(x, y, x + w, y, r);
    this.closePath();
    return this;
  };
}

resetGame();
