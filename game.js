
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
}
window.addEventListener('resize', resizeCanvas);
resizeCanvas();

let lang = 'ar';
const translations = {
    ar: {
        title: "المملكة المفقودة",
        subtitle: "أساطير الحرير والطحالب",
        desc: "هبط عبر المغارات الزمردية المتشابكة، وقرية الأصداف المضاءة بالفوانيس، وأبراج الأجراس الغارقة لإسكات النسّاج القديم.",
        start: "دخول المملكة",
        hints: "الحركة: A/D أو الأسهم | القفز: K / X / Space\nالإبرة: Z / J (+أعلى/أسفل) | الاندفاع/العلاج: L/C أو H/V",
        pause: "الإيقاف المؤقت",
        resume: "استمرار",
        mainMenu: "العودة للقائمة الرئيسية"
    },
    en: {
        title: "THE LOST KINGDOM",
        subtitle: "Legends of Silk & Moss",
        desc: "Descend through tangled emerald caverns, lantern-lit shell villages, and sunken bell towers to quiet the Ancient Weaver.",
        start: "Enter Kingdom",
        hints: "Move: A/D or Arrows | Jump: K/X/Space\nNeedle: Z/J (+Up/Down) | Dash/Heal: L/C or H/V",
        pause: "Paused",
        resume: "Resume",
        mainMenu: "Main Menu"
    }
};

window.toggleLang = function() {
    lang = lang === 'ar' ? 'en' : 'ar';
    document.documentElement.lang = lang;
    document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
    document.getElementById('mainTitleText').innerText = translations[lang].title;
    document.getElementById('subText').innerText = translations[lang].subtitle;
    document.getElementById('descText').innerText = translations[lang].desc;
    document.getElementById('startBtn').innerText = translations[lang].start;
    document.getElementById('hintsText').innerHTML = translations[lang].hints.replace('\n', '<br>');
};

let gameStarted = false;
let audioCtx = null;

function initAudio() {
    try {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    } catch(e) {}
}

window.startGame = function() {
    initAudio();
    const ts = document.getElementById('titleScreen');
    if (ts) ts.style.display = 'none';
    const gc = document.getElementById('gameContainer');
    if (gc) gc.style.display = 'block';
    gameStarted = true;
    resetToCheckpoint();
    requestAnimationFrame(gameLoop);
};

let player = {
    x: 200, y: 300, w: 28, h: 46,
    vx: 0, vy: 0, speed: 4.8, jumpForce: -12.2,
    grounded: false, facing: 1, hp: 5, maxHp: 5,
    silk: 100, maxSilk: 100, dashCooldown: 0,
    isAttacking: false, attackTimer: 0, attackType: 'neutral',
    isHealing: false, healTimer: 0, cloakWave: 0,
    checkpoint: { x: 200, y: 300, zone: 'الغابة الزمردية (Moss Grotto)' }
};

let camera = { x: 0, y: 0 };
let currentZoneName = 'الغابة الزمردية (Moss Grotto)';
let worldWidth = 7500;
let particles = [];

let enemies = [
    { x: 900, y: 410, w: 34, h: 30, vx: 1.5, hp: 3, maxHp: 3, type: 'crawler', patrolMin: 750, patrolMax: 1200 },
    { x: 1900, y: 360, w: 32, h: 32, vx: 2, hp: 4, maxHp: 4, type: 'flyer', patrolMin: 1700, patrolMax: 2200 },
    { x: 3200, y: 400, w: 45, h: 40, vx: 1, hp: 6, maxHp: 6, type: 'crawler', patrolMin: 3000, patrolMax: 3600 },
    { x: 4800, y: 380, w: 40, h: 35, vx: 2.2, hp: 5, maxHp: 5, type: 'flyer', patrolMin: 4500, patrolMax: 5200 }
];

let npcs = [
    { x: 2400, y: 400, name: 'النسّاج التجاري', text: 'أهلاً بك أيها المسافر في قرية الأصداف المضاءة. احذر أعماق القلعة القديمة!' }
];

let benches = [
    { x: 210, y: 440, w: 60, h: 25, zone: 'الغابة الزمردية (Moss Grotto)' },
    { x: 2450, y: 440, w: 60, h: 25, zone: 'قرية الأصداف (Shellwood Village)' },
    { x: 5500, y: 440, w: 60, h: 25, zone: 'القلعة القديمة (Citadel of Weavers)' }
];

let boss = {
    x: 6700, y: 300, w: 90, h: 100, hp: 40, maxHp: 40, active: false, phase: 1, attackTimer: 0
};

function resetToCheckpoint() {
    player.x = player.checkpoint.x;
    player.y = player.checkpoint.y;
    player.vx = 0; player.vy = 0;
    player.hp = player.maxHp;
    player.isAttacking = false;
    player.isHealing = false;
}

let keys = {};
window.addEventListener('keydown', e => { 
    keys[e.key.toLowerCase()] = true; 
    if([' ', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(e.key.toLowerCase())) e.preventDefault(); 
    if(e.key.toLowerCase() === 'z' || e.key.toLowerCase() === 'j') window.playerAttack();
    if(e.key.toLowerCase() === 'k' || e.key.toLowerCase() === 'x' || e.key === ' ') window.playerJump();
    if(e.key.toLowerCase() === 'l' || e.key.toLowerCase() === 'h') window.playerDash();
    if(e.key.toLowerCase() === 'c' || e.key.toLowerCase() === 'v') window.playerHeal();
});
window.addEventListener('keyup', e => { keys[e.key.toLowerCase()] = false; });

window.playerAttack = function() {
    if (player.isAttacking) return;
    player.isAttacking = true;
    player.attackTimer = 15;
    if (keys['arrowup'] || keys['w']) player.attackType = 'up';
    else if ((keys['arrowdown'] || keys['s']) && !player.grounded) player.attackType = 'down';
    else player.attackType = 'neutral';

    // Check hit on enemies
    enemies.forEach((en, idx) => {
        if (Math.abs(player.x - en.x) < 55 && Math.abs(player.y - en.y) < 55) {
            en.hp--;
            if (player.attackType === 'down') {
                player.vy = -10; // Pogo bounce!
            }
            if (en.hp <= 0) {
                enemies.splice(idx, 1);
                player.silk = Math.min(player.maxSilk, player.silk + 25);
            }
        }
    });

    if (boss.active && Math.abs(player.x - boss.x) < 70 && Math.abs(player.y - boss.y) < 70) {
        boss.hp--;
        if (player.attackType === 'down') player.vy = -10;
        if (boss.hp <= 0) {
            boss.active = false;
            document.getElementById('bossHpBar').style.display = 'none';
        }
    }
};

window.playerJump = function() {
    if (player.grounded) {
        player.vy = player.jumpForce;
        player.grounded = false;
    }
};

window.playerDash = function() {
    if (player.dashCooldown <= 0) {
        player.vx = player.facing * 14;
        player.dashCooldown = 40;
        for(let i=0; i<8; i++) {
            particles.push({
                x: player.x, y: player.y + 20,
                vx: -player.facing * (Math.random() * 4), vy: (Math.random() - 0.5) * 2,
                life: 20, color: '#ff5252'
            });
        }
    }
};

window.playerSkill = function() {
    if (player.silk >= 33) {
        player.silk -= 33;
        for(let i=0; i<20; i++) {
            particles.push({
                x: player.x + player.w/2, y: player.y + player.h/2,
                vx: (Math.random()-0.5)*9, vy: (Math.random()-0.5)*9,
                life: 35, color: '#e0f2f1'
            });
        }
    }
};

window.playerHeal = function() {
    if (player.silk >= 33 && player.hp < player.maxHp && !player.isHealing) {
        player.isHealing = true;
        player.healTimer = 40;
    }
};

let isPaused = false;
window.togglePause = function() {
    isPaused = !isPaused;
    document.getElementById('pauseMenu').style.display = isPaused ? 'flex' : 'none';
};
window.toggleMap = function() {
    let m = document.getElementById('mapModal');
    m.style.display = m.style.display === 'none' ? 'flex' : 'none';
};
window.toggleQuests = function() {
    let q = document.getElementById('questsModal');
    q.style.display = q.style.display === 'none' ? 'flex' : 'none';
};
let soundEnabled = true;
window.toggleSound = function() {
    soundEnabled = !soundEnabled;
    document.getElementById('soundBtn').innerText = soundEnabled ? '🔊' : '🔇';
};

// Touch joystick support
let joystickActive = false;
let joystickCenter = { x: 0, y: 0 };
const dpadElem = document.getElementById('dpad');
const knobElem = document.getElementById('joystickKnob');

dpadElem.addEventListener('touchstart', e => {
    joystickActive = true;
    let rect = dpadElem.getBoundingClientRect();
    joystickCenter.x = rect.left + rect.width / 2;
    joystickCenter.y = rect.top + rect.height / 2;
});

window.addEventListener('touchmove', e => {
    if (!joystickActive) return;
    let touch = e.touches[0];
    let dx = touch.clientX - joystickCenter.x;
    let dy = touch.clientY - joystickCenter.y;
    let dist = Math.sqrt(dx*dx + dy*dy);
    let maxDist = 50;
    if (dist > maxDist) {
        dx = (dx / dist) * maxDist;
        dy = (dy / dist) * maxDist;
    }
    knobElem.style.transform = `translate(${dx}px, ${dy}px)`;
    
    if (dx < -15) { keys['a'] = true; keys['d'] = false; }
    else if (dx > 15) { keys['d'] = true; keys['a'] = false; }
    else { keys['a'] = false; keys['d'] = false; }
}, {passive: true});

window.addEventListener('touchend', e => {
    if (joystickActive) {
        joystickActive = false;
        knobElem.style.transform = `translate(0px, 0px)`;
        keys['a'] = false; keys['d'] = false;
    }
});

function updateGame() {
    if (isPaused) return;

    let moveDir = 0;
    if (keys['a'] || keys['arrowleft']) moveDir = -1;
    if (keys['d'] || keys['arrowright']) moveDir = 1;

    if (moveDir !== 0) {
        player.facing = moveDir;
        player.vx += (moveDir * player.speed - player.vx) * 0.25;
    } else {
        player.vx *= 0.78;
    }

    player.vy += 0.58; // Gravity
    player.x += player.vx;
    player.y += player.vy;

    let groundY = 440;
    if (player.y + player.h >= groundY) {
        player.y = groundY - player.h;
        player.vy = 0;
        player.grounded = true;
    }

    if (player.x < 0) player.x = 0;
    if (player.x > worldWidth - player.w) player.x = worldWidth - player.w;

    if (player.dashCooldown > 0) player.dashCooldown--;

    if (player.isHealing) {
        player.healTimer--;
        if (player.healTimer <= 0) {
            player.hp = Math.min(player.maxHp, player.hp + 1);
            player.silk -= 33;
            player.isHealing = false;
        }
    }

    if (player.isAttacking) {
        player.attackTimer--;
        if (player.attackTimer <= 0) player.isAttacking = false;
    }

    player.cloakWave += 0.18;

    // Determine current zone based on player position
    if (player.x < 2000) currentZoneName = 'الغابة الزمردية (Moss Grotto)';
    else if (player.x < 4200) currentZoneName = 'قرية الأصداف (Shellwood Village)';
    else if (player.x < 6000) currentZoneName = 'الكهوف المظلمة (Sunken Caverns)';
    else currentZoneName = 'القلعة القديمة (Citadel of Weavers)';
    
    document.getElementById('zoneIndicator').innerText = currentZoneName;

    let targetCamX = player.x - canvas.width / 2;
    camera.x += (targetCamX - camera.x) * 0.12;
    if (camera.x < 0) camera.x = 0;
    if (camera.x > worldWidth - canvas.width) camera.x = worldWidth - canvas.width;

    enemies.forEach(en => {
        en.x += en.vx;
        if (en.x < en.patrolMin || en.x > en.patrolMax) en.vx *= -1;

        if (Math.abs(player.x - en.x) < 28 && Math.abs(player.y - en.y) < 28) {
            player.hp--;
            player.vx = -player.facing * 9;
            player.vy = -6;
            if (player.hp <= 0) {
                resetToCheckpoint();
            }
        }
    });

    benches.forEach(b => {
        if (Math.abs(player.x - b.x) < 45 && Math.abs(player.y - b.y) < 45) {
            player.checkpoint.x = b.x;
            player.checkpoint.y = b.y - 20;
            player.checkpoint.zone = b.zone;
            player.hp = player.maxHp;
            player.silk = player.maxSilk;
        }
    });

    if (player.x > 6200 && !boss.active && boss.hp > 0) {
        boss.active = true;
        document.getElementById('bossHpBar').style.display = 'block';
    }

    if (boss.active) {
        boss.x += Math.sin(Date.now() / 350) * 3;
        document.getElementById('bossHpFill').style.width = (boss.hp / boss.maxHp * 100) + '%';
        if (Math.abs(player.x - boss.x) < 55 && Math.abs(player.y - boss.y) < 55) {
            player.hp--;
            player.vy = -7;
            if (player.hp <= 0) resetToCheckpoint();
        }
    }

    particles.forEach((p, idx) => {
        p.x += p.vx; p.y += p.vy; p.life--;
        if (p.life <= 0) particles.splice(idx, 1);
    });

    let healthContainer = document.getElementById('healthContainer');
    healthContainer.innerHTML = '';
    for(let i=0; i<player.maxHp; i++) {
        let m = document.createElement('div');
        m.className = 'mask-icon' + (i >= player.hp ? ' empty' : '');
        healthContainer.appendChild(m);
    }
    document.getElementById('spoolCount').innerText = Math.floor(player.silk);
}

function renderGame() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    ctx.save();
    ctx.translate(-camera.x, 0);

    // Zone 1: Moss Grotto
    ctx.fillStyle = '#0b2414';
    ctx.fillRect(0, 0, 2000, canvas.height);
    ctx.fillStyle = '#1e4620';
    for(let i=0; i<2000; i+=90) {
        ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i+35, 0); ctx.lineTo(i+18, 140 + Math.sin(i)*25); ctx.fill();
    }

    // Zone 2: Shellwood Village
    ctx.fillStyle = '#141c24';
    ctx.fillRect(2000, 0, 2200, canvas.height);
    ctx.fillStyle = '#2c3e50';
    ctx.beginPath(); ctx.arc(2800, 440, 110, Math.PI, 0, false); ctx.fill();
    ctx.fillStyle = '#ffe082';
    ctx.shadowBlur = 25; ctx.shadowColor = '#ffe082';
    ctx.beginPath(); ctx.arc(3100, 380, 20, 0, Math.PI*2); ctx.fill();
    ctx.shadowBlur = 0;

    // Zone 3: Sunken Caverns
    ctx.fillStyle = '#0a1520';
    ctx.fillRect(4200, 0, 2000, canvas.height);
    ctx.fillStyle = '#006064';
    ctx.fillRect(4500, 200, 80, 240);
    ctx.fillRect(5200, 150, 100, 290);

    // Zone 4: Citadel of Weavers
    ctx.fillStyle = '#1a0f0a';
    ctx.fillRect(6200, 0, 1300, canvas.height);
    ctx.strokeStyle = '#d4af37'; ctx.lineWidth = 3;
    ctx.strokeRect(6500, 130, 900, 310);

    // Ground
    ctx.fillStyle = '#112214';
    ctx.fillRect(0, 440, worldWidth, 300);

    // Benches (Checkpoints)
    benches.forEach(b => {
        ctx.fillStyle = '#4e342e';
        ctx.fillRect(b.x, b.y, b.w, b.h);
        ctx.fillStyle = '#8d6e63';
        ctx.fillRect(b.x + 6, b.y - 14, b.w - 12, 14);
    });

    // NPCs
    npcs.forEach(n => {
        ctx.fillStyle = '#ffffff';
        ctx.beginPath(); ctx.arc(n.x + 18, n.y + 18, 18, 0, Math.PI*2); ctx.fill();
        ctx.fillStyle = '#e57373';
        ctx.fillRect(n.x + 6, n.y + 12, 24, 20);
    });

    // Enemies
    enemies.forEach(en => {
        ctx.fillStyle = '#ab47bc';
        ctx.beginPath(); ctx.arc(en.x + en.w/2, en.y + en.h/2, en.w/2, 0, Math.PI*2); ctx.fill();
        ctx.fillStyle = '#fff';
        ctx.fillRect(en.x + 6, en.y + 6, 7, 7);
        ctx.fillRect(en.x + en.w - 13, en.y + 6, 7, 7);
    });

    // Boss
    if (boss.active && boss.hp > 0) {
        ctx.fillStyle = '#d32f2f';
        ctx.beginPath(); ctx.arc(boss.x + boss.w/2, boss.y + boss.h/2, boss.w/2, 0, Math.PI*2); ctx.fill();
        ctx.fillStyle = '#ffeb3b';
        ctx.beginPath(); ctx.arc(boss.x + boss.w/2 + boss.facing*12, boss.y + 35, 9, 0, Math.PI*2); ctx.fill();
    }

    // Player
    ctx.save();
    ctx.translate(player.x + player.w/2, player.y + player.h/2);
    if (player.facing === -1) ctx.scale(-1, 1);

    // Crimson Cloak with physics wave
    ctx.fillStyle = '#c62828';
    ctx.beginPath();
    ctx.moveTo(-11, -11);
    ctx.quadraticCurveTo(-28 + Math.sin(player.cloakWave)*7, 12, -16, 28);
    ctx.lineTo(16, 28);
    ctx.quadraticCurveTo(11, 12, 11, -11);
    ctx.fill();

    // Ivory Mask Head
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.ellipse(0, -6, 13, 17, 0, 0, Math.PI*2);
    ctx.fill();

    // Horns
    ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 3.5;
    ctx.beginPath();
    ctx.moveTo(-4, -20); ctx.quadraticCurveTo(-15, -35, -20, -42);
    ctx.moveTo(4, -20); ctx.quadraticCurveTo(15, -35, 20, -42);
    ctx.stroke();

    // Eyes
    ctx.fillStyle = '#000';
    ctx.fillRect(-7, -9, 3.5, 7);
    ctx.fillRect(3.5, -9, 3.5, 7);

    // Glowing Iridescent Needle Weapon
    let needleGrad = ctx.createLinearGradient(0, 0, 40, 12);
    needleGrad.addColorStop(0, '#e0f2f1');
    needleGrad.addColorStop(0.5, '#ffd54f');
    needleGrad.addColorStop(1, '#ff4081');
    ctx.strokeStyle = needleGrad; ctx.lineWidth = 4;
    ctx.shadowBlur = 15; ctx.shadowColor = '#ffd54f';
    ctx.beginPath();
    ctx.moveTo(9, 6);
    ctx.lineTo(42 + (player.isAttacking ? 18 : 0), -14 + (player.attackType === 'up' ? -25 : player.attackType === 'down' ? 30 : 0));
    ctx.stroke();
    ctx.shadowBlur = 0;

    ctx.restore();

    // Particles
    particles.forEach(p => {
        ctx.fillStyle = p.color || '#5cb85c';
        ctx.fillRect(p.x, p.y, 4, 4);
    });

    ctx.restore();
}

function gameLoop() {
    if (!gameStarted) return;
    updateGame();
    renderGame();
    requestAnimationFrame(gameLoop);
}
