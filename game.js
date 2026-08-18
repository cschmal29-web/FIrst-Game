"use strict";

const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

const WIDTH = canvas.width;
const HEIGHT = canvas.height;

const WINNING_SCORE = 7;
const GOAL_HEIGHT = 185;
const GOAL_TOP = (HEIGHT - GOAL_HEIGHT) / 2;
const GOAL_BOTTOM = GOAL_TOP + GOAL_HEIGHT;

const keys = {
  up: false,
  down: false,
  left: false,
  right: false,
  kick: false
};

let audioContext = null;
let soundEnabled = true;

const game = {
  running: false,
  gameOver: false,
  level: 1,
  playerScore: 0,
  cpuScore: 0,
  serveTimer: 0,
  message: "PRESS SPACE TO KICK OFF",
  messageTimer: 999,
  lastTime: 0,

  player: {
    x: 185,
    y: HEIGHT / 2,
    radius: 21,
    speed: 315,
    color: "#4dd7ff",
    directionX: 1,
    directionY: 0,
    kickCooldown: 0
  },

  cpu: {
    x: WIDTH - 185,
    y: HEIGHT / 2,
    radius: 21,
    speed: 200,
    color: "#ff6565",
    kickCooldown: 0
  },

  ball: {
    x: WIDTH / 2,
    y: HEIGHT / 2,
    radius: 12,
    vx: 0,
    vy: 0
  }
};

window.addEventListener("keydown", (event) => {
  const key = event.key.toLowerCase();

  if (
    ["w", "a", "s", "d", "arrowup", "arrowdown", "arrowleft", "arrowright"].includes(key) ||
    event.code === "Space"
  ) {
    event.preventDefault();
  }

  if (key === "w" || key === "arrowup") keys.up = true;
  if (key === "s" || key === "arrowdown") keys.down = true;
  if (key === "a" || key === "arrowleft") keys.left = true;
  if (key === "d" || key === "arrowright") keys.right = true;

  if (event.code === "Space" && !event.repeat) {
    initializeAudio();

    if (!game.running) {
      startMatch();
    } else {
      keys.kick = true;
    }
  }
});

window.addEventListener("keyup", (event) => {
  const key = event.key.toLowerCase();

  if (key === "w" || key === "arrowup") keys.up = false;
  if (key === "s" || key === "arrowdown") keys.down = false;
  if (key === "a" || key === "arrowleft") keys.left = false;
  if (key === "d" || key === "arrowright") keys.right = false;

  if (event.code === "Space") {
    keys.kick = false;
  }
});

function initializeAudio() {
  if (!audioContext) {
    audioContext = new AudioContext();
  }

  if (audioContext.state === "suspended") {
    audioContext.resume();
  }
}

function playTone(frequency, duration, volume, endFrequency = null) {
  if (!soundEnabled || !audioContext) return;

  const oscillator = audioContext.createOscillator();
  const gain = audioContext.createGain();
  const now = audioContext.currentTime;

  oscillator.type = "square";
  oscillator.frequency.setValueAtTime(frequency, now);

  if (endFrequency !== null) {
    oscillator.frequency.exponentialRampToValueAtTime(
      Math.max(1, endFrequency),
      now + duration
    );
  }

  gain.gain.setValueAtTime(0.001, now);
  gain.gain.exponentialRampToValueAtTime(volume, now + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

  oscillator.connect(gain);
  gain.connect(audioContext.destination);

  oscillator.start(now);
  oscillator.stop(now + duration + 0.03);
}

function playKickSound() {
  playTone(180, 0.055, 0.065, 390);
}

function playWallSound() {
  playTone(110, 0.035, 0.045, 95);
}

function playScoreSound(playerScored) {
  playTone(
    playerScored ? 520 : 165,
    0.22,
    0.09,
    playerScored ? 920 : 80
  );
}

function playStartSound() {
  playTone(330, 0.08, 0.06, 550);

  window.setTimeout(() => {
    playTone(660, 0.1, 0.06, 880);
  }, 100);
}

function startMatch() {
  if (game.gameOver) {
    game.playerScore = 0;
    game.cpuScore = 0;
    game.level = 1;
    game.gameOver = false;
  }

  game.running = true;
  game.message = "KICK OFF!";
  game.messageTimer = 0.8;
  game.serveTimer = 0.75;

  resetPositions();
  playStartSound();
}

function resetPositions() {
  game.player.x = 185;
  game.player.y = HEIGHT / 2;
  game.cpu.x = WIDTH - 185;
  game.cpu.y = HEIGHT / 2;

  game.ball.x = WIDTH / 2;
  game.ball.y = HEIGHT / 2;
  game.ball.vx = 0;
  game.ball.vy = 0;
}

function launchBall(direction) {
  const angle = (Math.random() - 0.5) * 0.8;
  const speed = 245 + game.level * 17;

  game.ball.vx = Math.cos(angle) * speed * direction;
  game.ball.vy = Math.sin(angle) * speed;
}

function updatePlayer(delta) {
  const player = game.player;
  let moveX = 0;
  let moveY = 0;

  if (keys.left) moveX -= 1;
  if (keys.right) moveX += 1;
  if (keys.up) moveY -= 1;
  if (keys.down) moveY += 1;

  if (moveX !== 0 || moveY !== 0) {
    const length = Math.hypot(moveX, moveY);
    moveX /= length;
    moveY /= length;

    player.directionX = moveX;
    player.directionY = moveY;

    player.x += moveX * player.speed * delta;
    player.y += moveY * player.speed * delta;
  }

  keepPlayerOnPitch(player);
  player.kickCooldown = Math.max(0, player.kickCooldown - delta);

  if (keys.kick && player.kickCooldown <= 0) {
    tryKick(player, 1);
  }
}

function updateCPU(delta) {
  const cpu = game.cpu;
  const ball = game.ball;

  cpu.kickCooldown = Math.max(0, cpu.kickCooldown - delta);

  // The AI targets the ball, then returns toward center when the ball is far away.
  let targetX = ball.x;
  let targetY = ball.y;

  if (ball.x < WIDTH * 0.42) {
    targetX = WIDTH * 0.68;
    targetY = HEIGHT / 2;
  }

  const dx = targetX - cpu.x;
  const dy = targetY - cpu.y;
  const distance = Math.hypot(dx, dy) || 1;

  const cpuSpeed = Math.min(365, 150 + game.level * 26);

  cpu.x += (dx / distance) * cpuSpeed * delta;
  cpu.y += (dy / distance) * cpuSpeed * delta;

  keepPlayerOnPitch(cpu);

  if (distanceTo(cpu.x, cpu.y, ball.x, ball.y) < 58 && cpu.kickCooldown <= 0) {
    tryKick(cpu, -1);
  }
}

function tryKick(player, preferredDirection) {
  const ball = game.ball;
  const dx = ball.x - player.x;
  const dy = ball.y - player.y;
  const distance = Math.hypot(dx, dy);

  if (distance > player.radius + ball.radius + 26) return;

  let directionX = dx / (distance || 1);
  let directionY = dy / (distance || 1);

  // Player kick uses movement direction if the ball is extremely close.
  if (player === game.player && Math.abs(player.directionX) + Math.abs(player.directionY) > 0) {
    directionX = player.directionX;
    directionY = player.directionY;
  }

  // CPU favors shooting toward the player goal.
  if (player === game.cpu) {
    directionX = -1;
    directionY = clamp((ball.y - HEIGHT / 2) / 260, -0.65, 0.65);
  }

  const length = Math.hypot(directionX, directionY) || 1;
  const kickSpeed = 410 + game.level * 18;

  ball.vx = (directionX / length) * kickSpeed;
  ball.vy = (directionY / length) * kickSpeed;

  player.kickCooldown = 0.28;
  playKickSound();
}

function updateBall(delta) {
  const ball = game.ball;

  ball.x += ball.vx * delta;
  ball.y += ball.vy * delta;

  ball.vx *= 0.998;
  ball.vy *= 0.998;

  if (ball.y - ball.radius <= 18) {
    ball.y = 18 + ball.radius;
    ball.vy *= -0.9;
    playWallSound();
  }

  if (ball.y + ball.radius >= HEIGHT - 18) {
    ball.y = HEIGHT - 18 - ball.radius;
    ball.vy *= -0.9;
    playWallSound();
  }

  handleSideWallsAndGoals();
  pushBallFromPlayer(game.player);
  pushBallFromPlayer(game.cpu);
}

function handleSideWallsAndGoals() {
  const ball = game.ball;
  const ballInGoalOpening = ball.y > GOAL_TOP && ball.y < GOAL_BOTTOM;

  if (ball.x - ball.radius <= 15) {
    if (ballInGoalOpening) {
      scoreGoal("cpu");
    } else {
      ball.x = 15 + ball.radius;
      ball.vx *= -0.88;
      playWallSound();
    }
  }

  if (ball.x + ball.radius >= WIDTH - 15) {
    if (ballInGoalOpening) {
      scoreGoal("player");
    } else {
      ball.x = WIDTH - 15 - ball.radius;
      ball.vx *= -0.88;
      playWallSound();
    }
  }
}

function pushBallFromPlayer(player) {
  const ball = game.ball;
  const dx = ball.x - player.x;
  const dy = ball.y - player.y;
  const distance = Math.hypot(dx, dy) || 1;
  const minimumDistance = player.radius + ball.radius;

  if (distance >= minimumDistance) return;

  const normalX = dx / distance;
  const normalY = dy / distance;
  const overlap = minimumDistance - distance;

  ball.x += normalX * overlap;
  ball.y += normalY * overlap;

  const dot = ball.vx * normalX + ball.vy * normalY;

  if (dot < 0) {
    ball.vx -= dot * 1.7 * normalX;
    ball.vy -= dot * 1.7 * normalY;
  }
}

function scoreGoal(winner) {
  const playerScored = winner === "player";

  if (playerScored) {
    game.playerScore += 1;
    game.message = "GOOOAL! YOU SCORE!";
  } else {
    game.cpuScore += 1;
    game.message = "GOAL! THE CPU SCORES!";
  }

  game.level = Math.min(
    12,
    1 + Math.floor((game.playerScore + game.cpuScore) / 2)
  );

  playScoreSound(playerScored);
  game.messageTimer = 1.5;

  if (game.playerScore >= WINNING_SCORE || game.cpuScore >= WINNING_SCORE) {
    game.running = false;
    game.gameOver = true;

    game.message = playerScored
      ? "YOU WIN THE CUP — SPACE TO RESTART"
      : "CPU WINS THE CUP — SPACE TO RESTART";

    game.messageTimer = 999;
    return;
  }

  resetPositions();
  game.serveTimer = 1.0;
}

function keepPlayerOnPitch(player) {
  player.x = clamp(player.x, 42 + player.radius, WIDTH - 42 - player.radius);
  player.y = clamp(player.y, 28 + player.radius, HEIGHT - 28 - player.radius);
}

function update(delta) {
  if (game.messageTimer > 0 && game.messageTimer < 900) {
    game.messageTimer -= delta;
  }

  if (!game.running) return;

  if (game.serveTimer > 0) {
    game.serveTimer -= delta;

    if (game.serveTimer <= 0) {
      launchBall(Math.random() > 0.5 ? 1 : -1);
    }

    return;
  }

  updatePlayer(delta);
  updateCPU(delta);
  updateBall(delta);
}

function drawPitch() {
  ctx.fillStyle = "#104d27";
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  for (let x = 0; x < WIDTH; x += 80) {
    ctx.fillStyle = (x / 80) % 2 === 0 ? "#176b34" : "#135c2d";
    ctx.fillRect(x, 0, 80, HEIGHT);
  }

  ctx.strokeStyle = "#efffde";
  ctx.lineWidth = 3;
  ctx.strokeRect(28, 28, WIDTH - 56, HEIGHT - 56);

  ctx.beginPath();
  ctx.moveTo(WIDTH / 2, 28);
  ctx.lineTo(WIDTH / 2, HEIGHT - 28);
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(WIDTH / 2, HEIGHT / 2, 70, 0, Math.PI * 2);
  ctx.stroke();

  ctx.fillStyle = "#efffde";
  ctx.beginPath();
  ctx.arc(WIDTH / 2, HEIGHT / 2, 4, 0, Math.PI * 2);
  ctx.fill();

  drawGoal(15, GOAL_TOP, 1);
  drawGoal(WIDTH - 15, GOAL_TOP, -1);
}

function drawGoal(x, y, direction) {
  const depth = 30 * direction;

  ctx.strokeStyle = "#efffde";
  ctx.lineWidth = 3;

  ctx.strokeRect(
    direction === 1 ? x - 30 : x,
    y,
    30,
    GOAL_HEIGHT
  );

  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x + depth, y - 13);
  ctx.lineTo(x + depth, y + GOAL_HEIGHT + 13);
  ctx.lineTo(x, y + GOAL_HEIGHT);
  ctx.stroke();
}

function drawPlayer(player, number) {
  ctx.save();
  ctx.translate(player.x, player.y);

  ctx.fillStyle = "#08120b";
  ctx.beginPath();
  ctx.arc(2, 4, player.radius + 3, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = player.color;
  ctx.beginPath();
  ctx.arc(0, 0, player.radius, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#f4ffed";
  ctx.font = "bold 17px 'Courier New', monospace";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(number, 0, 1);

  ctx.restore();
}

function drawBall() {
  const ball = game.ball;

  ctx.save();
  ctx.translate(ball.x, ball.y);

  ctx.fillStyle = "#f7f3dc";
  ctx.beginPath();
  ctx.arc(0, 0, ball.radius, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = "#1b2c20";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(0, 0, ball.radius - 4, 0, Math.PI * 2);
  ctx.stroke();

  ctx.fillStyle = "#1b2c20";
  ctx.beginPath();
  ctx.arc(0, 0, 3, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

function drawScoreboard() {
  ctx.textAlign = "center";

  ctx.font = "bold 42px 'Courier New', monospace";
  ctx.fillStyle = "#ffe490";
  ctx.fillText(game.playerScore, WIDTH * 0.25, 72);
  ctx.fillText(game.cpuScore, WIDTH * 0.75, 72);

  ctx.font = "bold 14px 'Courier New', monospace";
  ctx.fillStyle = "#a9ffe2";
  ctx.fillText("YOU", WIDTH * 0.25, 98);
  ctx.fillText("CPU", WIDTH * 0.75, 98);

  ctx.fillStyle = "#efffde";
  ctx.fillText(`CUP LEVEL ${game.level}`, WIDTH / 2, 42);
}

function drawMessage() {
  const shouldShow = !game.running || game.gameOver || game.messageTimer > 0;

  if (!shouldShow) return;

  ctx.save();

  ctx.fillStyle = "rgba(1, 20, 8, 0.8)";
  ctx.fillRect(185, HEIGHT - 87, WIDTH - 370, 49);

  ctx.strokeStyle = "#93f2b4";
  ctx.lineWidth = 2;
  ctx.strokeRect(185, HEIGHT - 87, WIDTH - 370, 49);

  ctx.font = "bold 18px 'Courier New', monospace";
  ctx.textAlign = "center";
  ctx.fillStyle = "#ffe490";
  ctx.fillText(game.message, WIDTH / 2, HEIGHT - 56);

  ctx.restore();
}

function draw() {
  ctx.clearRect(0, 0, WIDTH, HEIGHT);

  drawPitch();
  drawScoreboard();
  drawPlayer(game.player, "1");
  drawPlayer(game.cpu, "2");
  drawBall();
  drawMessage();
}

function loop(timestamp) {
  if (!game.lastTime) game.lastTime = timestamp;

  const delta = Math.min((timestamp - game.lastTime) / 1000, 0.03);
  game.lastTime = timestamp;

  update(delta);
  draw();

  requestAnimationFrame(loop);
}

function clamp(value, minimum, maximum) {
  return Math.max(minimum, Math.min(maximum, value));
}

function distanceTo(x1, y1, x2, y2) {
  return Math.hypot(x2 - x1, y2 - y1);
}

const soundToggle = document.getElementById("soundToggle");

soundToggle.addEventListener("click", () => {
  initializeAudio();

  soundEnabled = !soundEnabled;

  soundToggle.textContent = soundEnabled
    ? "SOUND: ON"
    : "SOUND: OFF";

  if (soundEnabled) {
    playKickSound();
  }
});

requestAnimationFrame(loop);