const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

const GRID_SIZE = 20;
const COLS = canvas.width / GRID_SIZE;
const ROWS = canvas.height / GRID_SIZE;

// Grid States
const TILE_EMPTY = 0;
const TILE_FILLED = 1;
const TILE_TRAIL = 2;

// Initialize Grid
let grid = [];
for (let r = 0; r < ROWS; r++) {
    grid[r] = [];
    for (let c = 0; c < COLS; c++) {
        if (r === 0 || r === ROWS - 1 || c === 0 || c === COLS - 1) {
            grid[r][c] = TILE_FILLED;
        } else {
            grid[r][c] = TILE_EMPTY;
        }
    }
}

// Player Object
const player = {
    x: 0, // Grid coordinates
    y: 0,
    dx: 0,
    dy: 0,
    color: '#00ff00',
    speed: 100, // ms per move (lower is faster)
    moveTimer: 0
};

// RPG Stats
const playerStats = {
    level: 1,
    xp: 0,
    xpToNext: 100,
    hp: 100,
    maxHp: 100,
    speed: 5, // Just a visual stat, real speed is player.speed (ms per move)
    attack: 10,
    defense: 5,
    inventory: []
};

// Item definitions
const ITEMS = [
    { name: "Leather Boots", type: "speed", value: 5, description: "Speed +5" },
    { name: "Iron Sword", type: "attack", value: 5, description: "Attack +5" },
    { name: "Wooden Shield", type: "defense", value: 3, description: "Defense +3" },
    { name: "Health Potion", type: "heal", value: 50, description: "Heals 50 HP" }
];

// Enemy Object
const enemy = {
    x: COLS / 2 * GRID_SIZE, // Pixel coords for smooth movement
    y: ROWS / 2 * GRID_SIZE,
    vx: 150, // Pixels per second
    vy: 150,
    radius: 8,
    color: '#ff0000',
    hp: 100,
    maxHp: 100
};

// Projectiles
let projectiles = [];
const mouse = { x: 0, y: 0 };

canvas.addEventListener('mousemove', (e) => {
    const rect = canvas.getBoundingClientRect();
    mouse.x = e.clientX - rect.left;
    mouse.y = e.clientY - rect.top;
});

canvas.addEventListener('mousedown', (e) => {
    shootSkill();
});

function shootSkill() {
    // Basic Magic Bolt
    // Convert player grid pos to pixels
    const px = player.x * GRID_SIZE + GRID_SIZE / 2;
    const py = player.y * GRID_SIZE + GRID_SIZE / 2;

    const angle = Math.atan2(mouse.y - py, mouse.x - px);
    const velocity = {
        x: Math.cos(angle) * 300, // speed
        y: Math.sin(angle) * 300
    };

    projectiles.push({
        x: px,
        y: py,
        vx: velocity.x,
        vy: velocity.y,
        radius: 4,
        color: '#00ffff',
        damage: playerStats.attack
    });
}

// Start player on the border
player.x = Math.floor(COLS / 2);
player.y = 0;

let lastTime = 0;

// Input Handling
const keys = {};
window.addEventListener('keydown', (e) => {
    keys[e.key] = true;
});
window.addEventListener('keyup', (e) => {
    keys[e.key] = false;
});

function handleInput() {
    let nextDx = player.dx;
    let nextDy = player.dy;

    if (keys['ArrowUp'] || keys['w'] || keys['W']) { nextDx = 0; nextDy = -1; }
    else if (keys['ArrowDown'] || keys['s'] || keys['S']) { nextDx = 0; nextDy = 1; }
    else if (keys['ArrowLeft'] || keys['a'] || keys['A']) { nextDx = -1; nextDy = 0; }
    else if (keys['ArrowRight'] || keys['d'] || keys['D']) { nextDx = 1; nextDy = 0; }
    else {
        // Stop moving if no keys pressed?
        // In Qix, you usually stop when you release.
        nextDx = 0; nextDy = 0;
    }

    // Prevent immediate reverse if moving (unless stopped)
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
    // Update Player
    player.moveTimer += deltaTime;
    if (player.moveTimer >= player.speed) {
        player.moveTimer = 0;
        movePlayer();
    }

    // Update Enemy
    updateEnemy(deltaTime);

    // Update Projectiles
    updateProjectiles(deltaTime);
}

function updateProjectiles(deltaTime) {
    const seconds = deltaTime / 1000;
    for (let i = projectiles.length - 1; i >= 0; i--) {
        const p = projectiles[i];
        p.x += p.vx * seconds;
        p.y += p.vy * seconds;

        // Remove if off screen
        if (p.x < 0 || p.x > canvas.width || p.y < 0 || p.y > canvas.height) {
            projectiles.splice(i, 1);
            continue;
        }

        // Check collision with Enemy
        const dist = Math.hypot(p.x - enemy.x, p.y - enemy.y);
        if (dist < p.radius + enemy.radius) {
            damageEnemy(p.damage);
            projectiles.splice(i, 1);
        }
    }
}

function damageEnemy(amount) {
    enemy.hp -= amount;
    console.log(`Enemy took ${amount} damage. HP: ${enemy.hp}`);
    // Flash enemy?

    if (enemy.hp <= 0) {
        console.log("Enemy Defeated!");
        gainXp(500); // Bonus XP
        // Respawn stronger enemy
        resetEnemy(true);
    }
}

function resetEnemy(makeStronger = false) {
    enemy.x = COLS / 2 * GRID_SIZE;
    enemy.y = ROWS / 2 * GRID_SIZE;
    enemy.vx = 150 + (makeStronger ? 50 : 0);
    enemy.vy = 150 + (makeStronger ? 50 : 0);
    enemy.maxHp = 100 + (makeStronger ? 50 : 0);
    enemy.hp = enemy.maxHp;
}

function updateEnemy(deltaTime) {
    const seconds = deltaTime / 1000;
    let nextX = enemy.x + enemy.vx * seconds;
    let nextY = enemy.y + enemy.vy * seconds;

    // Simple wall bouncing against Canvas edges (Safety fallback)
    if (nextX < 0 || nextX > canvas.width) enemy.vx *= -1;
    if (nextY < 0 || nextY > canvas.height) enemy.vy *= -1;

    // Grid Collision for bouncing
    // Check points around the enemy's circumference
    // Simplified: check center point for now, but better to check edges

    // Check collision with filled areas (bounce)
    // We need to convert pixel to grid coords
    const gridX = Math.floor(nextX / GRID_SIZE);
    const gridY = Math.floor(nextY / GRID_SIZE);

    if (gridX >= 0 && gridX < COLS && gridY >= 0 && gridY < ROWS) {
        if (grid[gridY][gridX] === TILE_FILLED) {
             // Simple bounce - reverse both? No, need to know which side.
             // Very simple logic: just reverse the direction that caused the collision.
             // This is imperfect but works for basic cases.
             const prevGridX = Math.floor(enemy.x / GRID_SIZE);
             const prevGridY = Math.floor(enemy.y / GRID_SIZE);

             if (prevGridX !== gridX) enemy.vx *= -1;
             if (prevGridY !== gridY) enemy.vy *= -1;

             // Recalculate next position
             nextX = enemy.x + enemy.vx * seconds;
             nextY = enemy.y + enemy.vy * seconds;
        }
    }

    enemy.x = nextX;
    enemy.y = nextY;

    // Collision with Player Trail or Player Body
    checkEnemyCollision();
}

function checkEnemyCollision() {
    // Check if enemy is hitting the trail (TILE_TRAIL)
    // Check 4 corners of enemy bounding box
    const margin = 4; // collision margin
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

        if (gx >= 0 && gx < COLS && gy >= 0 && gy < ROWS) {
            if (grid[gy][gx] === TILE_TRAIL) {
                console.log("Enemy hit the line! Player damage/die.");
                takeDamage(50);
                resetTrail();
                return;
            }
        }
    }

    // Check collision with player
    const dist = Math.hypot(enemy.x - (player.x * GRID_SIZE + GRID_SIZE/2), enemy.y - (player.y * GRID_SIZE + GRID_SIZE/2));
    if (dist < GRID_SIZE/2 + enemy.radius) {
         console.log("Enemy hit the player! Player damage/die.");
         takeDamage(30);
         resetPlayerPos();
         return;
    }
}

function resetTrail() {
    for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) {
            if (grid[r][c] === TILE_TRAIL) {
                grid[r][c] = TILE_EMPTY;
            }
        }
    }
    player.dx = 0;
    player.dy = 0;
    resetPlayerPos();
}

function resetPlayerPos() {
    player.x = Math.floor(COLS / 2);
    player.y = 0;
    player.dx = 0;
    player.dy = 0;
}

function movePlayer() {
    if (player.dx === 0 && player.dy === 0) return;

    const nextX = player.x + player.dx;
    const nextY = player.y + player.dy;

    // Boundary checks
    if (nextX < 0 || nextX >= COLS || nextY < 0 || nextY >= ROWS) {
        return; // Hit canvas edge
    }

    const currentTile = grid[player.y][player.x];
    const nextTile = grid[nextY][nextX];

    // Logic for moving
    // 1. Moving on Safe (FILLED) -> Safe
    // 2. Moving from Safe (FILLED) to Empty (EMPTY) -> Start Drawing (TRAIL)
    // 3. Moving on Empty (EMPTY) -> Continue Drawing (TRAIL)
    // 4. Moving from Empty (EMPTY) to Safe (FILLED) -> Close Shape
    // 5. Moving into own Trail -> Game Over (TODO)

    if (nextTile === TILE_TRAIL) {
        // Self collision - Game Over logic placeholder
        console.log("Hit own trail!");
        takeDamage(20);
        resetTrail();
        return;
    }

    player.x = nextX;
    player.y = nextY;

    if (nextTile === TILE_EMPTY) {
        grid[player.y][player.x] = TILE_TRAIL;
    } else if (nextTile === TILE_FILLED && currentTile === TILE_TRAIL) {
        // Closed the shape!
        console.log("Shape closed!");
        fillArea();
        player.dx = 0;
        player.dy = 0;
    }
}

function fillArea() {
    // 1. Convert all Trail to Filled
    // 2. Flood fill from Enemy position on a temp grid to find "Safe Empty"
    // 3. Convert all other Empty to Filled

    // Step 1: Solidify the trail
    for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) {
            if (grid[r][c] === TILE_TRAIL) {
                grid[r][c] = TILE_FILLED;
            }
        }
    }

    // Step 2: Flood Fill to identify empty space reachable by enemy
    // Create a copy or a visited array
    const visited = new Array(ROWS).fill(0).map(() => new Array(COLS).fill(false));
    const queue = [];

    // Get Enemy Grid Position
    const ex = Math.floor(enemy.x / GRID_SIZE);
    const ey = Math.floor(enemy.y / GRID_SIZE);

    // If enemy is somehow outside grid or on filled (bug case), handle gracefully
    if (ex >= 0 && ex < COLS && ey >= 0 && ey < ROWS && grid[ey][ex] === TILE_EMPTY) {
        queue.push({x: ex, y: ey});
        visited[ey][ex] = true;
    }

    while (queue.length > 0) {
        const {x, y} = queue.shift();

        const dirs = [
            {dx: 0, dy: -1},
            {dx: 0, dy: 1},
            {dx: -1, dy: 0},
            {dx: 1, dy: 0}
        ];

        for (let dir of dirs) {
            const nx = x + dir.dx;
            const ny = y + dir.dy;

            if (nx >= 0 && nx < COLS && ny >= 0 && ny < ROWS) {
                if (!visited[ny][nx] && grid[ny][nx] === TILE_EMPTY) {
                    visited[ny][nx] = true;
                    queue.push({x: nx, y: ny});
                }
            }
        }
    }

    // Step 3: Fill everything that was NOT visited and is EMPTY
    let filledCount = 0;
    for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) {
            if (grid[r][c] === TILE_EMPTY && !visited[r][c]) {
                grid[r][c] = TILE_FILLED;
                filledCount++;
            }
        }
    }

    console.log(`Filled ${filledCount} blocks.`);
    gainXp(filledCount * 10);
}

function gainXp(amount) {
    playerStats.xp += amount;
    console.log(`Gained ${amount} XP. Total: ${playerStats.xp}/${playerStats.xpToNext}`);

    if (playerStats.xp >= playerStats.xpToNext) {
        levelUp();
    }
    updateUI();
}

function levelUp() {
    playerStats.level++;
    playerStats.xp -= playerStats.xpToNext;
    playerStats.xpToNext = Math.floor(playerStats.xpToNext * 1.5);

    // Increase Stats
    playerStats.maxHp += 20;
    playerStats.hp = playerStats.maxHp;
    playerStats.attack += 5;
    playerStats.defense += 2;

    // Increase Speed (lower ms per move)
    player.speed = Math.max(20, player.speed - 5);

    console.log("Level Up! Level " + playerStats.level);

    // Drop Item
    const randomItem = ITEMS[Math.floor(Math.random() * ITEMS.length)];
    playerStats.inventory.push(randomItem);
    console.log("Got item: " + randomItem.name);

    renderInventory();
}

function renderInventory() {
    const list = document.getElementById('inventory-list');
    if (!list) return;
    list.innerHTML = '';

    playerStats.inventory.forEach((item, index) => {
        const el = document.createElement('div');
        el.className = 'item';
        el.innerText = item.name;
        el.title = item.description;
        el.onclick = () => useItem(index);
        list.appendChild(el);
    });
}

function useItem(index) {
    const item = playerStats.inventory[index];
    if (!item) return;

    if (item.type === 'heal') {
        playerStats.hp = Math.min(playerStats.maxHp, playerStats.hp + item.value);
        playerStats.inventory.splice(index, 1);
        renderInventory();
        updateUI();
    } else if (item.type === 'speed') {
        player.speed = Math.max(10, player.speed - item.value);
        // Equip items are permanent for now (simplified)
        // Ideally we'd have slots, but consuming to upgrade is easier for prototype
        playerStats.inventory.splice(index, 1);
        renderInventory();
    } else if (item.type === 'attack') {
        playerStats.attack += item.value;
        playerStats.inventory.splice(index, 1);
        renderInventory();
    } else if (item.type === 'defense') {
        playerStats.defense += item.value;
        playerStats.inventory.splice(index, 1);
        renderInventory();
    }
}

function updateUI() {
    // Placeholder for UI update
    const hpPercent = Math.max(0, (playerStats.hp / playerStats.maxHp) * 100);
    const xpPercent = (playerStats.xp / playerStats.xpToNext) * 100;

    const hpBar = document.getElementById('hp-bar-fill');
    if (hpBar) hpBar.style.width = hpPercent + '%';

    const xpBar = document.getElementById('xp-bar-fill');
    if (xpBar) xpBar.style.width = xpPercent + '%';

    const levelDisplay = document.getElementById('level-display');
    if (levelDisplay) levelDisplay.innerText = "Level " + playerStats.level;
}

function takeDamage(amount) {
    // Defense mitigation (simple)
    const damage = Math.max(1, amount - Math.floor(playerStats.defense / 2));
    playerStats.hp -= damage;
    console.log(`Took ${damage} damage. HP: ${playerStats.hp}/${playerStats.maxHp}`);

    updateUI();

    if (playerStats.hp <= 0) {
        console.log("Game Over");
        resetGame(); // Soft reset for now
        playerStats.hp = playerStats.maxHp; // Restore HP on reset
        updateUI();
    }
}

function resetGame() {
    // Reset Grid
    for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) {
            if (r === 0 || r === ROWS - 1 || c === 0 || c === COLS - 1) {
                grid[r][c] = TILE_FILLED;
            } else {
                grid[r][c] = TILE_EMPTY;
            }
        }
    }
    // Reset Player
    player.x = Math.floor(COLS / 2);
    player.y = 0;
    player.dx = 0;
    player.dy = 0;

    // Reset Enemy
    enemy.x = COLS / 2 * GRID_SIZE;
    enemy.y = ROWS / 2 * GRID_SIZE;
    enemy.vx = 150;
    enemy.vy = 150;
}

function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw Grid
    for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) {
            if (grid[r][c] === TILE_FILLED) {
                ctx.fillStyle = '#555'; // Safe area
                ctx.fillRect(c * GRID_SIZE, r * GRID_SIZE, GRID_SIZE, GRID_SIZE);
            } else if (grid[r][c] === TILE_TRAIL) {
                ctx.fillStyle = '#ff0'; // Drawing line
                ctx.fillRect(c * GRID_SIZE, r * GRID_SIZE, GRID_SIZE, GRID_SIZE);
            }
        }
    }

    // Draw Player
    ctx.fillStyle = player.color;
    ctx.fillRect(player.x * GRID_SIZE, player.y * GRID_SIZE, GRID_SIZE, GRID_SIZE);

    // Draw Enemy
    ctx.beginPath();
    ctx.arc(enemy.x, enemy.y, enemy.radius, 0, Math.PI * 2);
    ctx.fillStyle = enemy.color;
    ctx.fill();
    // Health bar for enemy
    ctx.fillStyle = 'red';
    ctx.fillRect(enemy.x - 10, enemy.y - 15, 20, 4);
    ctx.fillStyle = 'green';
    ctx.fillRect(enemy.x - 10, enemy.y - 15, 20 * (enemy.hp / enemy.maxHp), 4);
    ctx.closePath();

    // Draw Projectiles
    projectiles.forEach(p => {
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.fillStyle = p.color;
        ctx.fill();
        ctx.closePath();
    });
}

// Start the game loop
requestAnimationFrame(gameLoop);
