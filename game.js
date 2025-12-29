const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// --- Global Constants & Config ---
const GRID_SIZE = 4; // High density
const WORLD_W = 800; // Grid cells
const WORLD_H = 800; // Grid cells

// Grid States
const TILE_EMPTY = 0;
const TILE_FILLED = 1;
const TILE_TRAIL = 2;

// --- Initialize Grid (Large World) ---
let grid = new Array(WORLD_H);
for (let r = 0; r < WORLD_H; r++) {
    grid[r] = new Uint8Array(WORLD_W).fill(TILE_EMPTY);
}

// Camera System
const camera = {
    x: 0,
    y: 0,
    zoom: 1.0,
    targetZoom: 1.0
};

// Player Object
const player = {
    x: Math.floor(WORLD_W / 2),
    y: Math.floor(WORLD_H / 2),
    dx: 0,
    dy: 0,
    color: '#00ff00',
    baseSpeed: 50,
    currentSpeed: 50,
    moveTimer: 0,
    facing: 0 // Angle in radians
};

// Weapons System
const WEAPONS = {
    SWORD: { name: "Sword", type: "melee", range: 40, arc: Math.PI / 1.5, damage: 20, cooldown: 500, color: '#ffaa00' },
    BOW: { name: "Bow", type: "ranged", range: 300, speed: 400, damage: 15, cooldown: 300, color: '#00ffff' }
};

const playerStats = {
    level: 1,
    xp: 0,
    xpToNext: 100,
    hp: 100,
    maxHp: 100,
    attack: 10,
    defense: 5,
    inventory: [],
    weapon: WEAPONS.SWORD,
    lastAttackTime: 0
};

let attackVisuals = []; // Store visual effects for melee swings

// Enemy Object Array
let enemies = [];

// Projectiles
let projectiles = [];
const mouse = { x: 0, y: 0, worldX: 0, worldY: 0 };

canvas.addEventListener('mousemove', (e) => {
    const rect = canvas.getBoundingClientRect();
    mouse.x = e.clientX - rect.left;
    mouse.y = e.clientY - rect.top;
});

canvas.addEventListener('mousedown', (e) => {
    useWeapon();
});

function logMessage(msg) {
    const logContainer = document.getElementById('game-log');
    if (!logContainer) return;
    const entry = document.createElement('div');
    entry.className = 'log-entry';
    entry.innerText = `> ${msg}`;
    logContainer.appendChild(entry);
    logContainer.scrollTop = logContainer.scrollHeight;
}

function updateMouseWorldCoords() {
    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    mouse.worldX = (mouse.x - centerX) / camera.zoom + camera.x;
    mouse.worldY = (mouse.y - centerY) / camera.zoom + camera.y;
}

function useWeapon() {
    const now = Date.now();
    if (now - playerStats.lastAttackTime < playerStats.weapon.cooldown) return;

    playerStats.lastAttackTime = now;
    updateMouseWorldCoords();

    const px = player.x * GRID_SIZE + GRID_SIZE / 2;
    const py = player.y * GRID_SIZE + GRID_SIZE / 2;
    const angle = Math.atan2(mouse.worldY - py, mouse.worldX - px);
    player.facing = angle;

    const w = playerStats.weapon;

    if (w.type === 'melee') {
        // Create Arc Hitbox
        attackVisuals.push({
            x: px, y: py, angle: angle,
            arc: w.arc, radius: w.range,
            color: w.color, duration: 200, startTime: now
        });

        // Check Collisions immediately
        enemies.forEach((e, idx) => {
            const dist = Math.hypot(e.x - px, e.y - py);
            if (dist < w.range + e.radius) {
                // Check angle
                const angleToEnemy = Math.atan2(e.y - py, e.x - px);
                let angleDiff = angleToEnemy - angle;
                // Normalize to -PI to PI
                while (angleDiff > Math.PI) angleDiff -= Math.PI*2;
                while (angleDiff < -Math.PI) angleDiff += Math.PI*2;

                if (Math.abs(angleDiff) < w.arc / 2) {
                    damageEnemy(idx, w.damage + playerStats.attack);
                    // Push back
                    e.x += Math.cos(angleToEnemy) * 10;
                    e.y += Math.sin(angleToEnemy) * 10;
                }
            }
        });

    } else if (w.type === 'ranged') {
         projectiles.push({
            x: px, y: py,
            vx: Math.cos(angle) * w.speed,
            vy: Math.sin(angle) * w.speed,
            radius: 4,
            color: w.color,
            damage: w.damage + playerStats.attack
        });
    }
}

// ... (Input and Loop remain similar) ...

let lastTime = 0;
const keys = {};
window.addEventListener('keydown', (e) => { keys[e.key] = true; });
window.addEventListener('keyup', (e) => { keys[e.key] = false; });

function handleInput() {
    let nextDx = player.dx;
    let nextDy = player.dy;

    if (keys['ArrowUp'] || keys['w'] || keys['W']) { nextDx = 0; nextDy = -1; }
    else if (keys['ArrowDown'] || keys['s'] || keys['S']) { nextDx = 0; nextDy = 1; }
    else if (keys['ArrowLeft'] || keys['a'] || keys['A']) { nextDx = -1; nextDy = 0; }
    else if (keys['ArrowRight'] || keys['d'] || keys['D']) { nextDx = 1; nextDy = 0; }
    else { nextDx = 0; nextDy = 0; }

    if (player.dx !== 0 && nextDx === -player.dx && nextDy === 0) return;
    if (player.dy !== 0 && nextDy === -player.dy && nextDx === 0) return;

    player.dx = nextDx;
    player.dy = nextDy;
}

function gameLoop(timestamp) {
    const deltaTime = timestamp - lastTime;
    lastTime = timestamp;

    handleInput();
    update(deltaTime);
    draw();

    requestAnimationFrame(gameLoop);
}

function update(deltaTime) {
    // Update Camera Target
    const targetCamX = player.x * GRID_SIZE + GRID_SIZE/2;
    const targetCamY = player.y * GRID_SIZE + GRID_SIZE/2;

    // Smooth Camera
    camera.x += (targetCamX - camera.x) * 0.1;
    camera.y += (targetCamY - camera.y) * 0.1;

    // Smooth Zoom
    camera.zoom += (camera.targetZoom - camera.zoom) * 0.05;

    // Update Player
    player.moveTimer += deltaTime;
    if (player.moveTimer >= player.currentSpeed) {
        player.moveTimer = 0;
        movePlayer();
    }

    updateEnemies(deltaTime);
    updateProjectiles(deltaTime);

    // Update Visuals
    const now = Date.now();
    for(let i=attackVisuals.length-1; i>=0; i--) {
        if(now - attackVisuals[i].startTime > attackVisuals[i].duration) {
            attackVisuals.splice(i, 1);
        }
    }
}

function updateProjectiles(deltaTime) {
    const seconds = deltaTime / 1000;
    for (let i = projectiles.length - 1; i >= 0; i--) {
        const p = projectiles[i];
        p.x += p.vx * seconds;
        p.y += p.vy * seconds;

        if (p.x < 0 || p.x > WORLD_W * GRID_SIZE || p.y < 0 || p.y > WORLD_H * GRID_SIZE) {
            projectiles.splice(i, 1);
            continue;
        }

        let hit = false;
        for (let j = 0; j < enemies.length; j++) {
            const e = enemies[j];
            const dist = Math.hypot(p.x - e.x, p.y - e.y);
            if (dist < p.radius + e.radius) {
                damageEnemy(j, p.damage);
                projectiles.splice(i, 1);
                hit = true;
                break;
            }
        }
        if (hit) continue;
    }
}

function damageEnemy(index, amount) {
    const e = enemies[index];
    if(!e) return;
    e.hp -= amount;

    if (e.hp <= 0) {
        gainXp(50);
        enemies.splice(index, 1);
        spawnEnemy();
    }
}

function spawnEnemy() {
    let ex, ey, valid = false;
    for(let i=0; i<100; i++) {
        ex = Math.floor(Math.random() * WORLD_W);
        ey = Math.floor(Math.random() * WORLD_H);
        if (grid[ey][ex] === TILE_EMPTY) {
            const dist = Math.hypot(ex - player.x, ey - player.y);
            if (dist > 50) {
                valid = true;
                break;
            }
        }
    }

    if (valid) {
        enemies.push({
            x: ex * GRID_SIZE,
            y: ey * GRID_SIZE,
            vx: (Math.random() - 0.5) * 100,
            vy: (Math.random() - 0.5) * 100,
            radius: 8,
            color: '#ff0000',
            hp: 100,
            maxHp: 100
        });
    }
}

function updateEnemies(deltaTime) {
    const seconds = deltaTime / 1000;

    enemies.forEach(enemy => {
        let nextX = enemy.x + enemy.vx * seconds;
        let nextY = enemy.y + enemy.vy * seconds;

        if (nextX < 0 || nextX > WORLD_W * GRID_SIZE) enemy.vx *= -1;
        if (nextY < 0 || nextY > WORLD_H * GRID_SIZE) enemy.vy *= -1;

        const gx = Math.floor(nextX / GRID_SIZE);
        const gy = Math.floor(nextY / GRID_SIZE);

        if (gx >= 0 && gx < WORLD_W && gy >= 0 && gy < WORLD_H) {
             if (grid[gy][gx] === TILE_FILLED) {
                 // Erosion Logic: Destroy the wall
                 grid[gy][gx] = TILE_EMPTY;
                 // Bounce to avoid getting stuck in now-empty space immediately?
                 // Or just keep moving. Keep moving is fine, they are "eating" it.
                 enemy.vx *= -1;
                 enemy.vy *= -1;
             }
        }

        enemy.x = nextX;
        enemy.y = nextY;

        checkEnemyPlayerCollision(enemy);
    });
}

function checkEnemyPlayerCollision(enemy) {
    const margin = 4;
    const checkPoints = [
        {x: enemy.x, y: enemy.y},
        {x: enemy.x - margin, y: enemy.y},
        {x: enemy.x + margin, y: enemy.y},
        {x: enemy.x, y: enemy.y - margin},
        {x: enemy.x, y: enemy.y + margin},
    ];

    for (let p of checkPoints) {
        const gx = Math.floor(p.x / GRID_SIZE);
        const gy = Math.floor(p.y / GRID_SIZE);
        if (gx >= 0 && gx < WORLD_W && gy >= 0 && gy < WORLD_H) {
            if (grid[gy][gx] === TILE_TRAIL) {
                takeDamage(20);
                resetTrail();
                return;
            }
        }
    }

    const dist = Math.hypot(enemy.x - (player.x * GRID_SIZE + GRID_SIZE/2), enemy.y - (player.y * GRID_SIZE + GRID_SIZE/2));
    if (dist < GRID_SIZE/2 + enemy.radius) {
         takeDamage(30);
         enemy.vx *= -1;
         enemy.vy *= -1;
    }
}

function resetTrail() {
    for (let r = 0; r < WORLD_H; r++) {
        for (let c = 0; c < WORLD_W; c++) {
            if (grid[r][c] === TILE_TRAIL) {
                grid[r][c] = TILE_EMPTY;
            }
        }
    }
    player.dx = 0;
    player.dy = 0;
}

function movePlayer() {
    if (player.dx === 0 && player.dy === 0) return;

    const nextX = player.x + player.dx;
    const nextY = player.y + player.dy;

    if (nextX < 0 || nextX >= WORLD_W || nextY < 0 || nextY >= WORLD_H) return;

    const currentTile = grid[player.y][player.x];
    const nextTile = grid[nextY][nextX];

    if (nextTile === TILE_TRAIL) {
        logMessage("You hit your own trail!");
        takeDamage(10);
        resetTrail();
        return;
    }

    player.x = nextX;
    player.y = nextY;

    if (nextTile === TILE_EMPTY) {
        grid[player.y][player.x] = TILE_TRAIL;
    } else if (nextTile === TILE_FILLED && currentTile === TILE_TRAIL) {
        fillArea();
        player.dx = 0;
        player.dy = 0;
    }
}

let totalFilled = 0; // Track total filled area for scaling

function fillArea() {
    let minR = WORLD_H, maxR = 0, minC = WORLD_W, maxC = 0;

    for (let r = 0; r < WORLD_H; r++) {
        for (let c = 0; c < WORLD_W; c++) {
            if (grid[r][c] === TILE_TRAIL) {
                grid[r][c] = TILE_FILLED;
                if (r < minR) minR = r;
                if (r > maxR) maxR = r;
                if (c < minC) minC = c;
                if (c > maxC) maxC = c;
            }
        }
    }

    minR = Math.max(0, minR - 1);
    maxR = Math.min(WORLD_H - 1, maxR + 1);
    minC = Math.max(0, minC - 1);
    maxC = Math.min(WORLD_W - 1, maxC + 1);

    const visited = new Uint8Array(WORLD_W * WORLD_H).fill(0);
    const queue = [];

    enemies.forEach(e => {
        const ex = Math.floor(e.x / GRID_SIZE);
        const ey = Math.floor(e.y / GRID_SIZE);
        if (ex >= 0 && ex < WORLD_W && ey >= 0 && ey < WORLD_H) {
             const idx = ey * WORLD_W + ex;
             if (grid[ey][ex] === TILE_EMPTY) {
                 queue.push(idx);
                 visited[idx] = 1;
             }
        }
    });

    let head = 0;
    while(head < queue.length) {
        const idx = queue[head++];
        const cx = idx % WORLD_W;
        const cy = Math.floor(idx / WORLD_W);

        if (cy > 0) checkNode(cx, cy - 1, visited, queue);
        if (cy < WORLD_H - 1) checkNode(cx, cy + 1, visited, queue);
        if (cx > 0) checkNode(cx - 1, cy, visited, queue);
        if (cx < WORLD_W - 1) checkNode(cx + 1, cy, visited, queue);
    }

    let filledCount = 0;
    for (let r = minR; r <= maxR; r++) {
        for (let c = minC; c <= maxC; c++) {
            const idx = r * WORLD_W + c;
            if (grid[r][c] === TILE_EMPTY && visited[idx] === 0) {
                grid[r][c] = TILE_FILLED;
                filledCount++;
            }
        }
    }

    gainXp(filledCount * 10);

    totalFilled += filledCount;
    updateDynamicProgression();
}

function updateDynamicProgression() {
    // Requirements: Speed Increases, Zoom Increases (Camera Zooms OUT -> scale decreases)
    // Scale factor based on totalFilled
    // Max filled approx 640000.

    const fillRatio = Math.min(1.0, totalFilled / 100000); // Soft cap for scaling

    // Zoom: 1.0 -> 0.3
    camera.targetZoom = 1.0 - (fillRatio * 0.7);

    // Speed: 50 -> 10 (Lower is faster)
    player.currentSpeed = Math.max(10, player.baseSpeed - (fillRatio * 40));
}

function checkNode(x, y, visited, queue) {
    const idx = y * WORLD_W + x;
    if (grid[y][x] === TILE_EMPTY && visited[idx] === 0) {
        visited[idx] = 1;
        queue.push(idx);
    }
}

function gainXp(amount) {
    playerStats.xp += amount;
    if (playerStats.xp >= playerStats.xpToNext) {
        levelUp();
    }
    updateUI();
}

function levelUp() {
    playerStats.level++;
    playerStats.xp -= playerStats.xpToNext;
    playerStats.xpToNext = Math.floor(playerStats.xpToNext * 1.5);
    playerStats.maxHp += 20;
    playerStats.hp = playerStats.maxHp;
    playerStats.attack += 5;
    playerStats.defense += 2;
    logMessage(`Level Up! Lv ${playerStats.level}`);
    updateUI();
}

function updateUI() {
    const hpPercent = Math.max(0, (playerStats.hp / playerStats.maxHp) * 100);
    const xpPercent = Math.min(100, (playerStats.xp / playerStats.xpToNext) * 100);

    const hpBar = document.getElementById('hp-bar-fill');
    if (hpBar) hpBar.style.width = hpPercent + '%';
    const xpBar = document.getElementById('xp-bar-fill');
    if (xpBar) xpBar.style.width = xpPercent + '%';

    const levelVal = document.getElementById('level-val');
    if (levelVal) levelVal.innerText = playerStats.level;
    const atkVal = document.getElementById('atk-val');
    if (atkVal) atkVal.innerText = playerStats.attack;
    const defVal = document.getElementById('def-val');
    if (defVal) defVal.innerText = playerStats.defense;
}

function takeDamage(amount) {
    const damage = Math.max(1, amount - Math.floor(playerStats.defense / 2));
    playerStats.hp -= damage;
    logMessage(`Took ${damage} damage.`);
    updateUI();

    if (playerStats.hp <= 0) {
        logMessage("GAME OVER! Resetting...");
        setTimeout(() => {
            resetGame();
        }, 2000);
    }
}

function resetGame() {
    for (let r = 0; r < WORLD_H; r++) {
        grid[r].fill(TILE_EMPTY);
    }

    const centerR = Math.floor(WORLD_H / 2);
    const centerC = Math.floor(WORLD_W / 2);
    const safeRadius = 10;

    for(let r = centerR - safeRadius; r <= centerR + safeRadius; r++) {
        for(let c = centerC - safeRadius; c <= centerC + safeRadius; c++) {
            grid[r][c] = TILE_FILLED;
        }
    }

    player.x = centerC;
    player.y = centerR - safeRadius;
    player.dx = 0;
    player.dy = 0;
    playerStats.hp = playerStats.maxHp;
    totalFilled = 0;
    camera.targetZoom = 1.0;
    camera.zoom = 1.0;
    player.currentSpeed = player.baseSpeed;

    camera.x = player.x * GRID_SIZE;
    camera.y = player.y * GRID_SIZE;

    enemies = [];
    for(let i=0; i<30; i++) spawnEnemy(); // Increased enemy count

    projectiles = [];
    updateUI();
}

function draw() {
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.save();

    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;

    ctx.translate(centerX, centerY);
    ctx.scale(camera.zoom, camera.zoom);
    ctx.translate(-camera.x, -camera.y);

    const viewW = canvas.width / camera.zoom;
    const viewH = canvas.height / camera.zoom;
    const viewX = camera.x - viewW / 2;
    const viewY = camera.y - viewH / 2;

    const minC = Math.max(0, Math.floor(viewX / GRID_SIZE));
    const maxC = Math.min(WORLD_W, Math.floor((viewX + viewW) / GRID_SIZE) + 1);
    const minR = Math.max(0, Math.floor(viewY / GRID_SIZE));
    const maxR = Math.min(WORLD_H, Math.floor((viewY + viewH) / GRID_SIZE) + 1);

    for (let r = minR; r < maxR; r++) {
        for (let c = minC; c < maxC; c++) {
            const tile = grid[r][c];
            if (tile !== TILE_EMPTY) {
                const gx = c * GRID_SIZE;
                const gy = r * GRID_SIZE;

                if (tile === TILE_FILLED) {
                    ctx.fillStyle = '#222';
                    ctx.fillRect(gx, gy, GRID_SIZE, GRID_SIZE);
                } else if (tile === TILE_TRAIL) {
                    ctx.fillStyle = '#00ff00';
                    ctx.fillRect(gx, gy, GRID_SIZE, GRID_SIZE);
                }
            } else {
                 if (camera.zoom > 0.5 && (r+c)%2===0) {
                     ctx.fillStyle = '#050505';
                     ctx.fillRect(c*GRID_SIZE, r*GRID_SIZE, GRID_SIZE, GRID_SIZE);
                 }
            }
        }
    }

    const px = player.x * GRID_SIZE;
    const py = player.y * GRID_SIZE;
    ctx.fillStyle = '#00ff00';
    ctx.beginPath();
    ctx.moveTo(px + GRID_SIZE/2, py);
    ctx.lineTo(px + GRID_SIZE, py + GRID_SIZE);
    ctx.lineTo(px, py + GRID_SIZE);
    ctx.fill();

    // Draw Weapon Swing
    attackVisuals.forEach(vis => {
        ctx.beginPath();
        ctx.arc(vis.x, vis.y, vis.radius, vis.angle - vis.arc/2, vis.angle + vis.arc/2);
        ctx.lineWidth = 10; // Wide swing
        ctx.strokeStyle = vis.color;
        ctx.stroke();
    });

    enemies.forEach(e => {
        if (e.x + e.radius > viewX && e.x - e.radius < viewX + viewW &&
            e.y + e.radius > viewY && e.y - e.radius < viewY + viewH) {

            ctx.beginPath();
            ctx.arc(e.x, e.y, e.radius, 0, Math.PI * 2);
            ctx.fillStyle = e.color;
            ctx.fill();
            ctx.strokeStyle = '#fff';
            ctx.lineWidth = 1;
            ctx.stroke();

            const hpW = 16;
            ctx.fillStyle = '#f00';
            ctx.fillRect(e.x - hpW/2, e.y - e.radius - 6, hpW * (e.hp / e.maxHp), 3);
        }
    });

    projectiles.forEach(p => {
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.fillStyle = p.color;
        ctx.fill();
    });

    ctx.strokeStyle = '#333';
    ctx.lineWidth = 2;
    ctx.strokeRect(0, 0, WORLD_W * GRID_SIZE, WORLD_H * GRID_SIZE);

    ctx.restore();
}

resetGame();
requestAnimationFrame(gameLoop);
