const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const moneySpan = document.getElementById('money');
const livesSpan = document.getElementById('lives');
const buildBtn = document.getElementById('build');
const towerMenu = document.getElementById('towerMenu');
let selectedTowerType = 'basic';
const waveSpan = document.getElementById('wave');
const upgradeInfo = document.getElementById('upgradeInfo');
const bgm = document.getElementById('bgm');
const shootSfx = document.getElementById('shootSfx');
const enemyDieSfx = document.getElementById('enemyDieSfx');
const startScreen = document.getElementById('startScreen');
const startBtn = document.getElementById('startBtn');
const pauseBtn = document.getElementById('pauseBtn');
// Play background music on first user interaction
let bgmStarted = false;
function startBgm() {
    if (!bgmStarted) {
        bgm.volume = 0.3;
        bgm.play();
        bgmStarted = true;
    }
}
document.body.addEventListener('mousedown', startBgm, { once: true });

const TILE_SIZE = 40;
const MAP_COLS = 15;
const MAP_ROWS = 10;

let money = 100;
let lives = 10;
let towers = [];
let enemies = [];
let bullets = [];
let wave = 0;
let placingTower = false;
let paused = false;
let running = false;

const path = [
    {x: 0, y: 4}, {x: 5, y: 4}, {x: 5, y: 8}, {x: 12, y: 8}, {x: 12, y: 2}, {x: 14, y: 2}
];

function drawMap() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    // Draw grid
    ctx.save();
    ctx.strokeStyle = '#444';
    for (let i = 0; i <= MAP_COLS; i++) {
        ctx.beginPath();
        ctx.moveTo(i * TILE_SIZE, 0);
        ctx.lineTo(i * TILE_SIZE, canvas.height);
        ctx.stroke();
    }
    for (let j = 0; j <= MAP_ROWS; j++) {
        ctx.beginPath();
        ctx.moveTo(0, j * TILE_SIZE);
        ctx.lineTo(canvas.width, j * TILE_SIZE);
        ctx.stroke();
    }
    ctx.restore();

    // Draw path with gradient
    let grad = ctx.createLinearGradient(0, path[0].y * TILE_SIZE, canvas.width, path[path.length-1].y * TILE_SIZE);
    grad.addColorStop(0, '#ff0');
    grad.addColorStop(1, '#fa0');
    ctx.strokeStyle = grad;
    ctx.lineWidth = TILE_SIZE / 2;
    ctx.beginPath();
    ctx.moveTo(path[0].x * TILE_SIZE + TILE_SIZE/2, path[0].y * TILE_SIZE + TILE_SIZE/2);
    for (let p of path) {
        ctx.lineTo(p.x * TILE_SIZE + TILE_SIZE/2, p.y * TILE_SIZE + TILE_SIZE/2);
    }
    ctx.stroke();
    ctx.lineWidth = 1;

    // Draw tower bases
    for (let t of towers) {
        ctx.save();
        ctx.fillStyle = '#222';
        ctx.beginPath();
        ctx.arc(t.x * TILE_SIZE + TILE_SIZE/2, t.y * TILE_SIZE + TILE_SIZE/2, TILE_SIZE/2 - 2, 0, 2*Math.PI);
        ctx.fill();
        ctx.restore();
    }

    // Draw towers with glow and level
    for (let t of towers) {
        ctx.save();
        if (t.type === 'fast') ctx.fillStyle = '#0f8';
        else if (t.type === 'strong') ctx.fillStyle = '#f0f';
        else if (t.type === 'splash') ctx.fillStyle = '#fa0';
        else ctx.fillStyle = '#0af';
        ctx.shadowColor = ctx.fillStyle;
        ctx.shadowBlur = 16;
        ctx.beginPath();
        ctx.arc(t.x * TILE_SIZE + TILE_SIZE/2, t.y * TILE_SIZE + TILE_SIZE/2, TILE_SIZE/2 - 8, 0, 2*Math.PI);
        ctx.fill();
        ctx.shadowBlur = 0;
        // Draw upgrade level
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 13px sans-serif';
        ctx.fillText('Lv' + t.level, t.x * TILE_SIZE + TILE_SIZE/2 - 14, t.y * TILE_SIZE + TILE_SIZE/2 + 4);
        ctx.restore();
    }

    // Draw enemies with shadow and hit/death animation
    for (let e of enemies) {
        ctx.save();
        // Shadow
        ctx.globalAlpha = 0.3;
        ctx.fillStyle = '#000';
        ctx.beginPath();
        ctx.ellipse(e.x, e.y + 12, TILE_SIZE/3, TILE_SIZE/6, 0, 0, 2*Math.PI);
        ctx.fill();
        ctx.globalAlpha = 1;
        // Enemy body
        if (e.type === 'fast') ctx.fillStyle = '#0ff';
        else if (e.type === 'armored') ctx.fillStyle = '#888';
        else if (e.type === 'boss') ctx.fillStyle = '#ff0';
        else ctx.fillStyle = '#f44';
        // Hit flash
        if (e._hitFlash && e._hitFlash > 0) {
            ctx.save();
            ctx.globalAlpha = 0.7;
            ctx.fillStyle = '#fff';
            ctx.beginPath();
            ctx.arc(e.x, e.y, TILE_SIZE/3 + 2, 0, 2*Math.PI);
            ctx.fill();
            ctx.globalAlpha = 1;
            ctx.restore();
            e._hitFlash--;
        }
        ctx.beginPath();
        ctx.arc(e.x, e.y, TILE_SIZE/3, 0, 2*Math.PI);
        ctx.fill();
        // Health bar
        ctx.fillStyle = '#000';
        ctx.fillRect(e.x - 18, e.y - 28, 36, 6);
        ctx.fillStyle = '#0f0';
        ctx.fillRect(e.x - 18, e.y - 28, 36 * (e.hp / e.maxHp), 6);
        ctx.strokeStyle = '#fff';
        ctx.strokeRect(e.x - 18, e.y - 28, 36, 6);
        ctx.restore();
    }

    // Draw bullet trails and bullets
    for (let b of bullets) {
        ctx.save();
        // Trail
        ctx.globalAlpha = 0.3;
        ctx.strokeStyle = b.type === 'splash' ? '#fa0' : '#fff';
        ctx.beginPath();
        ctx.moveTo(b.x - b.dx*2, b.y - b.dy*2);
        ctx.lineTo(b.x, b.y);
        ctx.stroke();
        ctx.globalAlpha = 1;
        // Bullet
        if (b.type === 'splash') ctx.fillStyle = '#fa0';
        else ctx.fillStyle = '#fff';
        ctx.beginPath();
        ctx.arc(b.x, b.y, 5, 0, 2*Math.PI);
        ctx.fill();
        ctx.restore();
    }
}

function spawnEnemy(type) {
    const start = path[0];
    let hp = 3 + wave, speed = 1.2, reward = 10, maxHp = hp;
    if (type === 'fast') { speed = 2.2; hp = 2 + Math.floor(wave/2); maxHp = hp; reward = 12; }
    else if (type === 'armored') { hp = 8 + wave*2; maxHp = hp; reward = 20; }
    else if (type === 'boss') { hp = 30 + wave*5; maxHp = hp; speed = 0.8; reward = 100; }
    enemies.push({
        x: start.x * TILE_SIZE + TILE_SIZE/2,
        y: start.y * TILE_SIZE + TILE_SIZE/2,
        pathIndex: 0,
        hp,
        maxHp,
        speed,
        reward,
        type: type || 'normal'
    });
}

function updateEnemies() {
    for (let e of enemies) {
        const target = path[e.pathIndex+1];
        if (!target) continue;
        const tx = target.x * TILE_SIZE + TILE_SIZE/2;
        const ty = target.y * TILE_SIZE + TILE_SIZE/2;
        const dx = tx - e.x;
        const dy = ty - e.y;
        const dist = Math.sqrt(dx*dx + dy*dy);
        const speed = e.speed || 1.2;
        if (dist < speed) {
            e.x = tx; e.y = ty;
            e.pathIndex++;
            if (e.pathIndex === path.length-1) {
                lives--;
                e.hp = 0;
            }
        } else {
            e.x += dx/dist * speed;
            e.y += dy/dist * speed;
        }
    }
    enemies = enemies.filter(e => e.hp > 0);
}

function updateTowers() {
    for (let t of towers) {
        t.cooldown--;
        if (t.cooldown <= 0) {
            // Find enemy in range
            for (let e of enemies) {
                const dx = (t.x * TILE_SIZE + TILE_SIZE/2) - e.x;
                const dy = (t.y * TILE_SIZE + TILE_SIZE/2) - e.y;
                let range = 120 + t.level*10;
                if (dx*dx + dy*dy < range*range) {
                    let bulletType = t.type;
                    let speed = 15 - t.level*2;
                    if (speed < 6) speed = 6;
                    let damage = 1 + (t.type === 'strong' ? 2 : 0) + t.level;
                    if (t.type === 'splash') damage = 1 + t.level;
                    bullets.push({
                        x: t.x * TILE_SIZE + TILE_SIZE/2,
                        y: t.y * TILE_SIZE + TILE_SIZE/2,
                        dx: (e.x - (t.x * TILE_SIZE + TILE_SIZE/2))/speed,
                        dy: (e.y - (t.y * TILE_SIZE + TILE_SIZE/2))/speed,
                        target: e,
                        type: bulletType,
                        damage,
                        splash: t.type === 'splash',
                        splashRadius: t.type === 'splash' ? 40 + t.level*10 : 0
                    });
                    // Play shoot sound
                    if (shootSfx) { try { shootSfx.currentTime = 0; shootSfx.play(); } catch(e){} }
                    t.cooldown = t.type === 'fast' ? 10 : t.type === 'strong' ? 40 : t.type === 'splash' ? 50 : 30;
                    break;
                }
            }
        }
    }
}

function updateBullets() {
    for (let b of bullets) {
        b.x += b.dx;
        b.y += b.dy;
        // Hit detection
        if (b.target && Math.abs(b.x - b.target.x) < 12 && Math.abs(b.y - b.target.y) < 12) {
            let playedDeath = false;
            if (b.splash) {
                // Splash damage
                for (let e of enemies) {
                    const dx = b.x - e.x, dy = b.y - e.y;
                    if (dx*dx + dy*dy < b.splashRadius*b.splashRadius) {
                        e.hp -= b.damage;
                        e._hitFlash = 3;
                        if (e.hp <= 0 && !playedDeath) { money += e.reward || 10; playedDeath = true; if (enemyDieSfx) { try { enemyDieSfx.currentTime = 0; enemyDieSfx.play(); } catch(e){} } }
                    }
                }
            } else {
                b.target.hp -= b.damage;
                b.target._hitFlash = 3;
                if (b.target.hp <= 0) { money += b.target.reward || 10; if (enemyDieSfx) { try { enemyDieSfx.currentTime = 0; enemyDieSfx.play(); } catch(e){} } }
            }
            b.hit = true;
        }
    }
    bullets = bullets.filter(b => !b.hit && b.x >= 0 && b.x <= canvas.width && b.y >= 0 && b.y <= canvas.height);
}

function gameLoop() {
    if (!running || paused) return;
    drawMap();
    updateEnemies();
    updateTowers();
    updateBullets();
    moneySpan.textContent = 'Money: ' + money;
    livesSpan.textContent = 'Lives: ' + lives;
    waveSpan.textContent = 'Wave: ' + (wave+1);
    if (enemies.length === 0) {
        wave++;
        // Mix of enemy types
        for (let i = 0; i < 3 + wave; i++) {
            let type = 'normal';
            if (wave > 2 && i % 5 === 0) type = 'fast';
            if (wave > 4 && i % 7 === 0) type = 'armored';
            if (wave > 7 && i === 0) type = 'boss';
            setTimeout(() => spawnEnemy(type), i * 600);
        }
    }
    if (lives > 0) requestAnimationFrame(gameLoop);
    else {
        ctx.fillStyle = '#fff';
        ctx.font = '48px sans-serif';
        ctx.fillText('Game Over', 180, 200);
        running = false;
        setTimeout(()=>{
            startScreen.style.display = 'flex';
            startBtn.textContent = 'Restart';
        }, 1200);
    }
}


canvas.addEventListener('click', e => {
    const rect = canvas.getBoundingClientRect();
    const x = Math.floor((e.clientX - rect.left) / TILE_SIZE);
    const y = Math.floor((e.clientY - rect.top) / TILE_SIZE);
    // Tower placement
    if (placingTower) {
        for (let p of path) if (p.x === x && p.y === y) return;
        for (let t of towers) if (t.x === x && t.y === y) return;
        let type = selectedTowerType;
        let cost = type === 'fast' ? 60 : type === 'strong' ? 80 : type === 'splash' ? 100 : 50;
        if (money >= cost) {
            towers.push({x, y, type, cooldown: 0, level: 1});
            money -= cost;
        }
        placingTower = false;
        buildBtn.disabled = false;
        return;
    }
    // Tower menu selection logic: click to build
    if (towerMenu) {
        towerMenu.querySelectorAll('.tower-btn').forEach(btn => {
            btn.addEventListener('click', function() {
                towerMenu.querySelectorAll('.tower-btn').forEach(b => b.style.outline = '');
                this.style.outline = '3px solid #fff';
                selectedTowerType = this.getAttribute('data-type');
                // Try to build tower at next valid location (prompt user to tap map)
                placingTower = true;
                buildBtn.disabled = true;
            });
        });
        // Default select first
        towerMenu.querySelector('.tower-btn[data-type="basic"]').style.outline = '3px solid #fff';
    }
    // Tower upgrade
    for (let t of towers) {
        if (t.x === x && t.y === y) {
            let upgradeCost = 40 + t.level*30;
            if (money >= upgradeCost && t.level < 5) {
                t.level++;
                money -= upgradeCost;
                upgradeInfo.textContent = `Upgraded to Lv${t.level}!`;
                setTimeout(()=>upgradeInfo.textContent = 'Click a tower to upgrade', 1200);
            } else if (t.level >= 5) {
                upgradeInfo.textContent = 'Max level!';
                setTimeout(()=>upgradeInfo.textContent = 'Click a tower to upgrade', 1200);
            } else {
                upgradeInfo.textContent = 'Not enough money!';
                setTimeout(()=>upgradeInfo.textContent = 'Click a tower to upgrade', 1200);
            }
            return;
        }
    }
});

// Remove buildBtn click logic (no longer needed)


// Start screen logic
function startGame() {
    money = 100;
    lives = 10;
    towers = [];
    enemies = [];
    bullets = [];
    wave = 0;
    placingTower = false;
    paused = false;
    running = true;
    startScreen.style.display = 'none';
    buildBtn.disabled = false;
    pauseBtn.textContent = 'Pause';
    gameLoop();
}
startBtn.addEventListener('click', startGame);

// Pause/resume logic
pauseBtn.addEventListener('click', () => {
    if (!running) return;
    paused = !paused;
    pauseBtn.textContent = paused ? 'Resume' : 'Pause';
    if (!paused) gameLoop();
});
