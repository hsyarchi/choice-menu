// Default Preset Lists
const DEFAULT_MENUS = [
    { id: 1, name: '부대찌개', emoji: '🍲', category: 'korean', enabled: true },
    { id: 2, name: '김치찌개', emoji: '🍲', category: 'korean', enabled: true },
    { id: 3, name: '돈까스', emoji: '🍛', category: 'japanese', enabled: true },
    { id: 4, name: '짜장면', emoji: '🍜', category: 'chinese', enabled: true },
    { id: 5, name: '초밥', emoji: '🍣', category: 'japanese', enabled: true },
    { id: 6, name: '피자', emoji: '🍕', category: 'western', enabled: true },
    { id: 7, name: '햄버거', emoji: '🍔', category: 'western', enabled: true },
    { id: 8, name: '떡볶이', emoji: '🍲', category: 'etc', enabled: true },
    { id: 9, name: '샌드위치', emoji: '🥪', category: 'etc', enabled: true },
    { id: 10, name: '커피 & 디저트', emoji: '☕', category: 'etc', enabled: true }
];

const DEFAULT_MEMBERS = [
    { id: 1, name: '민수', votedMenuId: null },
    { id: 2, name: '지영', votedMenuId: null },
    { id: 3, name: '준호', votedMenuId: null },
    { id: 4, name: '혜원', votedMenuId: null }
];

// App State
let menus = [];
let members = [];
let activeMemberId = null; // Currently selected member voting
let activeCategory = 'all';
let currentMode = 'roulette'; // 'roulette' | 'slot'
let decisionMethod = 'weighted'; // 'weighted' | 'majority'
let isSoundEnabled = true;
let isSpinning = false;

// Web Audio API Sound Synthesizer
let audioCtx = null;

function initAudio() {
    if (!audioCtx) {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (audioCtx.state === 'suspended') {
        audioCtx.resume();
    }
}

function playTickSound(frequency = 800, duration = 0.05) {
    if (!isSoundEnabled) return;
    initAudio();
    try {
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(frequency, audioCtx.currentTime);
        gain.gain.setValueAtTime(0.08, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + duration);
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.start();
        osc.stop(audioCtx.currentTime + duration);
    } catch (e) {
        console.error('Audio play failed', e);
    }
}

function playWinSound() {
    if (!isSoundEnabled) return;
    initAudio();
    const now = audioCtx.currentTime;
    
    const playNote = (freq, start, dur, type = 'sine') => {
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = type;
        osc.frequency.setValueAtTime(freq, now + start);
        gain.gain.setValueAtTime(0.12, now + start);
        gain.gain.exponentialRampToValueAtTime(0.001, now + start + dur);
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.start(now + start);
        osc.stop(now + start + dur);
    };
    
    // Success chime chord
    playNote(523.25, 0, 0.15);     // C5
    playNote(659.25, 0.1, 0.15);   // E5
    playNote(783.99, 0.2, 0.15);   // G5
    playNote(1046.50, 0.3, 0.4, 'triangle');  // C6
}

// LocalStorage Persistence
function loadData() {
    const savedMenus = localStorage.getItem('team_lunch_menus');
    const savedMembers = localStorage.getItem('team_lunch_members');
    
    if (savedMenus) {
        try { menus = JSON.parse(savedMenus); } catch (e) { menus = [...DEFAULT_MENUS]; }
    } else {
        menus = [...DEFAULT_MENUS];
    }

    if (savedMembers) {
        try { 
            members = JSON.parse(savedMembers).map(m => ({
                ...m,
                excluded: m.excluded !== undefined ? m.excluded : false
            })); 
        } catch (e) { 
            members = DEFAULT_MEMBERS.map(m => ({ ...m, excluded: false })); 
        }
    } else {
        members = DEFAULT_MEMBERS.map(m => ({ ...m, excluded: false }));
    }

    // Default active member to first one who hasn't voted yet
    selectNextVoter();
}

function saveData() {
    localStorage.setItem('team_lunch_menus', JSON.stringify(menus));
    localStorage.setItem('team_lunch_members', JSON.stringify(members));
}

// Select the next member in the list who hasn't voted yet
function selectNextVoter() {
    const nextVoter = members.find(m => !m.excluded && m.votedMenuId == null);
    if (nextVoter) {
        activeMemberId = nextVoter.id;
    } else {
        const activeMembersList = members.filter(m => !m.excluded);
        activeMemberId = activeMembersList.length > 0 ? activeMembersList[0].id : null;
    }
}

// Particle Canvas Animation (Confetti)
const canvas = document.getElementById('particleCanvas');
const ctx = canvas.getContext('2d');
let particles = [];

function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
}
window.addEventListener('resize', resizeCanvas);
resizeCanvas();

class ConfettiParticle {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.size = Math.random() * 8 + 6;
        this.color = `hsl(${Math.random() * 360}, 85%, 60%)`;
        this.shape = Math.random() > 0.5 ? 'circle' : 'rect';
        
        const angle = Math.random() * Math.PI * 2;
        const speed = Math.random() * 8 + 4;
        this.vx = Math.cos(angle) * speed;
        this.vy = Math.sin(angle) * speed - 2;
        
        this.alpha = 1;
        this.decay = Math.random() * 0.015 + 0.01;
        this.gravity = 0.15;
        this.rotation = Math.random() * 360;
        this.rotationSpeed = Math.random() * 10 - 5;
    }

    update() {
        this.x += this.vx;
        this.vy += this.gravity;
        this.y += this.vy;
        this.rotation += this.rotationSpeed;
        this.alpha -= this.decay;
    }

    draw() {
        ctx.save();
        ctx.globalAlpha = this.alpha;
        ctx.translate(this.x, this.y);
        ctx.rotate((this.rotation * Math.PI) / 180);
        ctx.fillStyle = this.color;
        ctx.beginPath();
        if (this.shape === 'circle') {
            ctx.arc(0, 0, this.size / 2, 0, Math.PI * 2);
            ctx.fill();
        } else {
            ctx.fillRect(-this.size / 2, -this.size / 2, this.size, this.size);
        }
        ctx.restore();
    }
}

function spawnConfetti(count = 100) {
    const x = window.innerWidth / 2;
    const y = window.innerHeight / 2 - 100;
    for (let i = 0; i < count; i++) {
        particles.push(new ConfettiParticle(x + (Math.random() * 80 - 40), y));
    }
}

function animateParticles() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.update();
        p.draw();
        if (p.alpha <= 0 || p.y > canvas.height) {
            particles.splice(i, 1);
        }
    }
    requestAnimationFrame(animateParticles);
}
animateParticles();

// DOM Elements
const memberList = document.getElementById('memberList');
const addMemberForm = document.getElementById('addMemberForm');
const memberNameInput = document.getElementById('memberNameInput');
const voterHelperText = document.getElementById('voterHelperText');

const menuList = document.getElementById('menuList');
const addMenuForm = document.getElementById('addMenuForm');
const menuNameInput = document.getElementById('menuNameInput');
const menuEmojiSelect = document.getElementById('menuEmojiSelect');
const menuCatSelect = document.getElementById('menuCatSelect');

const themeToggleBtn = document.getElementById('themeToggleBtn');
const soundToggleBtn = document.getElementById('soundToggleBtn');
const modeRouletteBtn = document.getElementById('modeRouletteBtn');
const modeSlotBtn = document.getElementById('modeSlotBtn');

const decideWeightedBtn = document.getElementById('decideWeightedBtn');
const decideEqualBtn = document.getElementById('decideEqualBtn');
const decideMajorityBtn = document.getElementById('decideMajorityBtn');

const rouletteContainer = document.getElementById('rouletteContainer');
const slotContainer = document.getElementById('slotContainer');
const rouletteSvg = document.getElementById('rouletteSvg');
const spinBtn = document.getElementById('spinBtn');
const leverBtn = document.getElementById('leverBtn');
const slotReels = document.getElementById('slotReels');

const locationInput = document.getElementById('locationInput');
const clearVotesBtn = document.getElementById('clearVotesBtn');
const resetPresetBtn = document.getElementById('resetPresetBtn');
const scoreboardList = document.getElementById('scoreboardList');

// Result Modal Elements
const resultModal = document.getElementById('resultModal');
const modalBadge = document.getElementById('modalBadge');
const resultEmoji = document.getElementById('resultEmoji');
const resultTitle = document.getElementById('resultTitle');
const resultCategory = document.getElementById('resultCategory');
const voterInfoBox = document.getElementById('voterInfoBox');
const voterNames = document.getElementById('voterNames');
const naverSearchLink = document.getElementById('naverSearchLink');
const kakaoSearchLink = document.getElementById('kakaoSearchLink');
const modalCloseBtn = document.getElementById('modalCloseBtn');
const modalRetryBtn = document.getElementById('modalRetryBtn');

const sliceColors = [
    '#6366f1', // Indigo
    '#ec4899', // Pink
    '#10b981', // Emerald
    '#f97316', // Orange
    '#8b5cf6', // Violet
    '#06b6d4', // Cyan
    '#eab308', // Yellow
    '#f43f5e'  // Rose
];

// Initialize
function init() {
    loadData();
    initTheme();
    renderMemberList();
    renderMenuList();
    renderRoulette();
    setupEventListeners();
}

function initTheme() {
    const savedTheme = localStorage.getItem('team_lunch_theme') || 'dark';
    if (savedTheme === 'light') {
        document.body.classList.add('light-theme');
        themeToggleBtn.textContent = '🌙 다크 분위기';
    } else {
        document.body.classList.remove('light-theme');
        themeToggleBtn.textContent = '☀️ 라이트 분위기';
    }
}

function toggleTheme() {
    const isLight = document.body.classList.toggle('light-theme');
    localStorage.setItem('team_lunch_theme', isLight ? 'light' : 'dark');
    themeToggleBtn.textContent = isLight ? '🌙 다크 분위기' : '☀️ 라이트 분위기';
    playTickSound(700, 0.05);
}

function setupEventListeners() {
    // Theme toggle
    themeToggleBtn.addEventListener('click', toggleTheme);

    // Mode toggle
    modeRouletteBtn.addEventListener('click', () => switchMode('roulette'));
    modeSlotBtn.addEventListener('click', () => switchMode('slot'));

    // Decision Methods
    decideWeightedBtn.addEventListener('click', () => switchDecisionMethod('weighted'));
    decideEqualBtn.addEventListener('click', () => switchDecisionMethod('equal'));
    decideMajorityBtn.addEventListener('click', () => switchDecisionMethod('majority'));

    // Sound toggle
    soundToggleBtn.addEventListener('click', toggleSound);

    // Form submits
    addMemberForm.addEventListener('submit', handleAddMember);
    addMenuForm.addEventListener('submit', handleAddMenu);

    // Bulk actions
    clearVotesBtn.addEventListener('click', clearAllVotes);
    resetPresetBtn.addEventListener('click', resetPresets);

    // Category Tabs
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            activeCategory = btn.dataset.category;
            renderMenuList();
        });
    });

    // Spin Roulette
    spinBtn.addEventListener('click', () => {
        initAudio();
        startDecision();
    });

    // Lever Slot Machine
    leverBtn.addEventListener('click', () => {
        initAudio();
        startDecision();
    });

    // Modal Close
    modalCloseBtn.addEventListener('click', closeModal);
    window.addEventListener('click', (e) => {
        if (e.target === resultModal) closeModal();
    });

    // Modal Retry
    modalRetryBtn.addEventListener('click', () => {
        closeModal();
        setTimeout(startDecision, 300);
    });
}

function toggleSound() {
    isSoundEnabled = !isSoundEnabled;
    soundToggleBtn.textContent = isSoundEnabled ? '🔊 소리 켜짐' : '🔇 소리 꺼짐';
    if (isSoundEnabled) playTickSound(600, 0.05);
}

function switchMode(mode) {
    if (isSpinning) return;
    currentMode = mode;
    if (mode === 'roulette') {
        modeRouletteBtn.classList.add('active');
        modeSlotBtn.classList.remove('active');
        rouletteContainer.classList.add('active');
        slotContainer.classList.remove('active');
        renderRoulette();
    } else {
        modeSlotBtn.classList.add('active');
        modeRouletteBtn.classList.remove('active');
        slotContainer.classList.add('active');
        rouletteContainer.classList.remove('active');
        initSlotMachine();
    }
    playTickSound(700, 0.06);
}

function switchDecisionMethod(method) {
    if (isSpinning) return;
    decisionMethod = method;
    
    // Toggle active state for all three buttons
    decideWeightedBtn.classList.toggle('active', method === 'weighted');
    decideEqualBtn.classList.toggle('active', method === 'equal');
    decideMajorityBtn.classList.toggle('active', method === 'majority');
    
    playTickSound(800, 0.05);
    renderRoulette(); // Redraw with highlights or updates if needed
}

// Get active enabled menus
function getActiveMenus() {
    return menus.filter(m => m.enabled);
}

// ----------------------------------------------------
// TEAM MEMBER MANAGEMENT
// ----------------------------------------------------
function renderMemberList() {
    memberList.innerHTML = '';
    
    // Update helper text dynamically
    const activeMember = members.find(m => m.id === activeMemberId);
    if (activeMember) {
        voterHelperText.innerHTML = `📢 <strong style="color: #f472b6; font-size: 0.88rem;">${activeMember.name}</strong> 님의 투표 차례입니다! 아래 메뉴판에서 먹고 싶은 점심 메뉴를 클릭해 주세요.`;
    } else {
        voterHelperText.innerHTML = `💡 팀원을 목록에서 선택하거나 추가하여 투표를 시작해 주세요.`;
    }

    members.forEach(member => {
        const badge = document.createElement('div');
        badge.className = 'member-badge';
        if (member.excluded) badge.classList.add('excluded');
        if (member.id === activeMemberId && !member.excluded) badge.classList.add('active');
        if (member.votedMenuId != null && !member.excluded) badge.classList.add('voted');

        // Look up voted menu name
        let votedText = '';
        if (member.excluded) {
            votedText = `<span class="member-voted-food excluded-tag">제외됨</span>`;
        } else if (member.votedMenuId != null) {
            const menu = menus.find(m => m.id === member.votedMenuId);
            if (menu) {
                votedText = `<span class="member-voted-food">${menu.emoji} ${menu.name}</span>`;
            }
        }

        const namePrefix = (member.id === activeMemberId && !member.excluded) ? '🎯 ' : '';
        badge.innerHTML = `
            <span>${namePrefix}${member.name}</span>
            ${votedText}
            <div class="member-badge-controls">
                <button class="btn-exclude-member" data-id="${member.id}" title="${member.excluded ? '식사 참여로 전환' : '오늘 식사 제외'}">${member.excluded ? '➕' : '🚫'}</button>
                <button class="btn-remove-member" data-id="${member.id}" title="제거">&times;</button>
            </div>
        `;

        // Badge click selects voter (if not excluded)
        badge.addEventListener('click', (e) => {
            if (e.target.closest('.member-badge-controls')) return;
            if (member.excluded) return;
            activeMemberId = member.id;
            renderMemberList();
            playTickSound(750, 0.04);
        });

        // Toggle exclude click
        badge.querySelector('.btn-exclude-member').addEventListener('click', (e) => {
            e.stopPropagation();
            toggleExcludeMember(member.id);
        });

        // Remove member click
        badge.querySelector('.btn-remove-member').addEventListener('click', (e) => {
            e.stopPropagation();
            removeMember(member.id);
        });

        memberList.appendChild(badge);
    });
}

function handleAddMember(e) {
    e.preventDefault();
    const name = memberNameInput.value.trim();
    if (!name) return;

    const newMember = {
        id: Date.now(),
        name,
        votedMenuId: null,
        excluded: false
    };

    members.push(newMember);
    activeMemberId = newMember.id; // select new member
    saveData();
    renderMemberList();
    memberNameInput.value = '';
    playTickSound(900, 0.08);
}

function toggleExcludeMember(id) {
    members = members.map(m => {
        if (m.id === id) {
            const nextExcluded = !m.excluded;
            return {
                ...m,
                excluded: nextExcluded,
                votedMenuId: nextExcluded ? null : m.votedMenuId // Clear vote if excluded
            };
        }
        return m;
    });

    // If the active voter was excluded, select another active voter
    const activeMember = members.find(m => m.id === activeMemberId);
    if (activeMember && activeMember.excluded) {
        selectNextVoter();
    }
    
    saveData();
    renderMemberList();
    renderMenuList();
    renderRoulette();
    playTickSound(700, 0.06);
}

function removeMember(id) {
    members = members.filter(m => m.id !== id);
    if (activeMemberId === id) {
        selectNextVoter();
    }
    saveData();
    renderMemberList();
    renderMenuList();
    renderRoulette();
    playTickSound(400, 0.08);
}

function clearAllVotes() {
    members = members.map(m => ({ ...m, votedMenuId: null }));
    selectNextVoter();
    saveData();
    renderMemberList();
    renderMenuList();
    renderRoulette();
    playTickSound(500, 0.1);
}

// ----------------------------------------------------
// MENU MANAGEMENT
// ----------------------------------------------------
function getMenuVoteData(menuId) {
    const voters = members.filter(m => m.votedMenuId === menuId);
    return {
        count: voters.length,
        names: voters.map(v => v.name)
    };
}

function renderMenuList() {
    menuList.innerHTML = '';
    const filtered = menus.filter(m => {
        if (activeCategory === 'all') return true;
        return m.category === activeCategory;
    });

    filtered.forEach(menu => {
        const li = document.createElement('li');
        li.className = `menu-item ${menu.enabled ? '' : 'disabled'}`;

        const voteData = getMenuVoteData(menu.id);
        const votesDisplay = voteData.count > 0 ? `<span class="menu-vote-count">${voteData.count}표</span>` : '';
        const votersDisplay = voteData.count > 0 ? `<span class="menu-voters" title="${voteData.names.join(', ')}">(${voteData.names.join(', ')})</span>` : '';

        let catKo = '기타';
        if (menu.category === 'korean') catKo = '한식';
        else if (menu.category === 'chinese') catKo = '중식';
        else if (menu.category === 'japanese') catKo = '일식';
        else if (menu.category === 'western') catKo = '양식';

        li.innerHTML = `
            <div class="menu-item-left">
                <span class="menu-emoji">${menu.emoji}</span>
                <span class="menu-name">${menu.name}</span>
                ${votesDisplay}
                ${votersDisplay}
            </div>
            <div class="menu-item-right">
                <span class="menu-tag tag-${menu.category}">${catKo}</span>
                <button class="btn-delete" data-id="${menu.id}" title="삭제">&times;</button>
            </div>
        `;

        // Click to vote for selected member
        li.querySelector('.menu-item-left').addEventListener('click', () => {
            if (activeMemberId === null) {
                showToast('투표할 팀원을 먼저 왼쪽 리스트에서 선택하거나 추가해 주세요!');
                return;
            }
            castVote(activeMemberId, menu.id);
        });

        // Delete menu item
        li.querySelector('.btn-delete').addEventListener('click', (e) => {
            e.stopPropagation();
            deleteMenu(menu.id);
        });

        menuList.appendChild(li);
    });
    
    updateScoreboard();
}

function updateScoreboard() {
    scoreboardList.innerHTML = '';
    
    const activeList = getActiveMenus();
    const votedItems = activeList.map(menu => {
        const voteData = getMenuVoteData(menu.id);
        return { menu, count: voteData.count, names: voteData.names };
    }).filter(item => item.count > 0);

    votedItems.sort((a, b) => b.count - a.count);

    if (votedItems.length === 0) {
        scoreboardList.innerHTML = '<div class="scoreboard-empty">아직 득표한 메뉴가 없습니다.<br>팀원 배지를 누르고 메뉴를 클릭하여 투표해 주세요!</div>';
        return;
    }

    const maxVotes = votedItems[0].count;

    votedItems.forEach(item => {
        const pct = (item.count / maxVotes) * 100;
        const itemDiv = document.createElement('div');
        itemDiv.className = 'scoreboard-item';
        
        itemDiv.innerHTML = `
            <div class="scoreboard-item-header">
                <span class="scoreboard-item-name">
                    <span>${item.menu.emoji}</span>
                    <span>${item.menu.name}</span>
                </span>
                <span class="scoreboard-item-votes">${item.count}표</span>
            </div>
            <div class="scoreboard-progress-track">
                <div class="scoreboard-progress-fill" style="width: 0%"></div>
            </div>
            <div class="scoreboard-voters-list">
                투표자: ${item.names.join(', ')}
            </div>
        `;

        scoreboardList.appendChild(itemDiv);

        setTimeout(() => {
            const fill = itemDiv.querySelector('.scoreboard-progress-fill');
            if (fill) fill.style.width = `${pct}%`;
        }, 50);
    });
}

function castVote(memberId, menuId) {
    // Cast/toggle vote
    members = members.map(m => {
        if (m.id === memberId) {
            // If clicking the same voted menu, toggle it off (retract vote)
            return { ...m, votedMenuId: m.votedMenuId === menuId ? null : menuId };
        }
        return m;
    });

    saveData();
    renderMemberList();
    renderMenuList();
    renderRoulette();
    playTickSound(850, 0.06);
}

function deleteMenu(id) {
    menus = menus.filter(m => m.id !== id);
    // Clear votes associated with this deleted menu
    members = members.map(m => m.votedMenuId === id ? { ...m, votedMenuId: null } : m);
    saveData();
    renderMemberList();
    renderMenuList();
    renderRoulette();
    playTickSound(400, 0.08);
}

function handleAddMenu(e) {
    e.preventDefault();
    const name = menuNameInput.value.trim();
    if (!name) return;

    // Check for duplicate menu names
    if (menus.some(m => m.name === name)) {
        showToast('이미 존재하는 메뉴 후보입니다!');
        return;
    }

    const emoji = menuEmojiSelect.value;
    const category = menuCatSelect.value;
    const id = Date.now();

    const newMenu = { id, name, emoji, category, enabled: true };
    menus.unshift(newMenu);
    saveData();
    
    menuNameInput.value = '';
    renderMenuList();
    renderRoulette();
    playTickSound(900, 0.1);
}

function resetPresets() {
    if (confirm('모든 데이터를 복원하시겠습니까? (커스텀 데이터 및 투표 결과 전체가 리셋됩니다)')) {
        menus = [...DEFAULT_MENUS];
        members = [...DEFAULT_MEMBERS];
        selectNextVoter();
        saveData();
        renderMemberList();
        renderMenuList();
        renderRoulette();
        playTickSound(500, 0.15);
    }
}

// Refactored slices getter to handle weighted slices correctly
function getWeightedSlices() {
    const activeList = getActiveMenus();
    if (activeList.length === 0) return [];

    const itemVotes = activeList.map(menu => {
        const votesCount = getMenuVoteData(menu.id).count;
        return { menu, votes: votesCount };
    });

    const totalVotes = itemVotes.reduce((sum, item) => sum + item.votes, 0);

    // If no votes are cast, everyone gets equal slices
    if (totalVotes === 0) {
        const sliceAngle = 360 / activeList.length;
        return itemVotes.map((item, index) => ({
            ...item,
            startAngle: index * sliceAngle,
            endAngle: (index + 1) * sliceAngle,
            angleWidth: sliceAngle
        }));
    }

    // Filter to menus that received at least 1 vote
    const votedItems = itemVotes.filter(item => item.votes > 0);
    
    // If decisionMethod is 'equal', give equal slices to voted items
    if (decisionMethod === 'equal') {
        const sliceAngle = 360 / votedItems.length;
        return votedItems.map((item, index) => ({
            ...item,
            startAngle: index * sliceAngle,
            endAngle: (index + 1) * sliceAngle,
            angleWidth: sliceAngle
        }));
    }
    
    let currentAngle = 0;
    return votedItems.map(item => {
        const angleWidth = (item.votes / totalVotes) * 360;
        const startAngle = currentAngle;
        const endAngle = currentAngle + angleWidth;
        currentAngle = endAngle;

        return {
            ...item,
            startAngle,
            endAngle,
            angleWidth
        };
    });
}

function renderRoulette() {
    rouletteSvg.innerHTML = '';
    const slices = getWeightedSlices();

    if (slices.length === 0) {
        // Draw empty indicator
        const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        text.setAttribute('x', '250');
        text.setAttribute('y', '255');
        text.setAttribute('text-anchor', 'middle');
        text.setAttribute('fill', '#94a3b8');
        text.setAttribute('font-size', '15');
        text.setAttribute('font-weight', 'bold');
        text.textContent = '팀원 투표를 진행하거나 메뉴를 추가해 주세요!';
        rouletteSvg.appendChild(text);

        const outerCircle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        outerCircle.setAttribute('cx', '250');
        outerCircle.setAttribute('cy', '250');
        outerCircle.setAttribute('r', '240');
        outerCircle.setAttribute('fill', 'none');
        outerCircle.setAttribute('stroke', 'rgba(255, 255, 255, 0.1)');
        outerCircle.setAttribute('stroke-width', '4');
        rouletteSvg.appendChild(outerCircle);
        return;
    }

    slices.forEach((slice, index) => {
        const { menu, startAngle, endAngle, angleWidth } = slice;
        const color = sliceColors[index % sliceColors.length];

        // Draw path sector
        const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        const d = getSectorPathData(250, 250, 240, startAngle, endAngle);
        path.setAttribute('d', d);
        path.setAttribute('fill', color);
        path.setAttribute('stroke', '#090d16');
        path.setAttribute('stroke-width', '3');
        rouletteSvg.appendChild(path);

        // Label group
        const labelGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        const bisectorAngle = startAngle + angleWidth / 2;
        labelGroup.setAttribute('transform', `rotate(${bisectorAngle}, 250, 250)`);

        // Emoji Element
        const emojiEl = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        const emojiSize = slices.length > 12 ? '22' : (slices.length > 8 ? '30' : '38');
        const emojiY = slices.length > 12 ? 65 : (slices.length > 8 ? 70 : 75);
        emojiEl.setAttribute('x', '250');
        emojiEl.setAttribute('y', emojiY.toString());
        emojiEl.setAttribute('text-anchor', 'middle');
        emojiEl.setAttribute('font-size', emojiSize);
        emojiEl.textContent = menu.emoji;
        emojiEl.setAttribute('transform', `rotate(90, 250, ${emojiY})`);
        labelGroup.appendChild(emojiEl);

        // Name Element
        const nameEl = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        let nameFontSize = '22px';
        if (slices.length > 12) nameFontSize = '12px';
        else if (slices.length > 8) nameFontSize = '15px';
        else if (slices.length > 5) nameFontSize = '18px';
        else nameFontSize = '22px';

        const nameY = slices.length > 12 ? 130 : (slices.length > 8 ? 135 : (slices.length > 5 ? 140 : 145));
        nameEl.setAttribute('x', '250');
        nameEl.setAttribute('y', nameY.toString());
        nameEl.setAttribute('text-anchor', 'middle');
        nameEl.setAttribute('fill', '#ffffff');
        nameEl.setAttribute('font-weight', '900');
        nameEl.setAttribute('font-size', nameFontSize);
        
        // High visibility outline
        nameEl.setAttribute('stroke', '#090d16');
        nameEl.setAttribute('stroke-width', '4px');
        nameEl.setAttribute('paint-order', 'stroke fill');
        nameEl.setAttribute('stroke-linejoin', 'round');
        
        let labelText = menu.name;
        if (labelText.length > 8 && slices.length > 8) {
            labelText = labelText.substring(0, 7) + '..';
        }

        const hasVotes = slice.votes > 0 && (decisionMethod === 'weighted' || decisionMethod === 'equal');
        const fontSizeVal = parseInt(nameFontSize);
        const dyVal = Math.round(fontSizeVal * 0.95);

        // Render name tspan
        const nameTspan = document.createElementNS('http://www.w3.org/2000/svg', 'tspan');
        nameTspan.setAttribute('x', '250');
        if (hasVotes) {
            nameTspan.setAttribute('dy', (-dyVal / 2).toString());
        } else {
            nameTspan.setAttribute('dy', '0');
        }
        nameTspan.textContent = labelText;
        nameEl.appendChild(nameTspan);

        // Render vote count tspan on the next line if it has votes
        if (hasVotes) {
            const votesTspan = document.createElementNS('http://www.w3.org/2000/svg', 'tspan');
            votesTspan.setAttribute('x', '250');
            const votesFontSize = Math.round(fontSizeVal * 0.8) + 'px';
            
            votesTspan.setAttribute('dy', dyVal.toString());
            votesTspan.setAttribute('font-size', votesFontSize);
            votesTspan.setAttribute('font-weight', '700');
            votesTspan.setAttribute('fill', '#e2e8f0'); // slate gray color for separation
            votesTspan.textContent = `(${slice.votes}표)`;
            nameEl.appendChild(votesTspan);
        }
        
        nameEl.setAttribute('transform', `rotate(90, 250, ${nameY})`);
        labelGroup.appendChild(nameEl);

        rouletteSvg.appendChild(labelGroup);
    });

    // Draw high-visibility outer border circle
    const borderRing = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    borderRing.setAttribute('cx', '250');
    borderRing.setAttribute('cy', '250');
    borderRing.setAttribute('r', '238.5');
    borderRing.setAttribute('fill', 'none');
    borderRing.setAttribute('stroke', 'rgba(255, 255, 255, 0.4)');
    borderRing.setAttribute('stroke-width', '3');
    rouletteSvg.appendChild(borderRing);
}

function polarToCartesian(centerX, centerY, radius, angleInDegrees) {
    const angleInRadians = ((angleInDegrees - 90) * Math.PI) / 180.0;
    return {
        x: centerX + radius * Math.cos(angleInRadians),
        y: centerY + radius * Math.sin(angleInRadians)
    };
}

function getSectorPathData(x, y, radius, startAngle, endAngle) {
    if (endAngle - startAngle >= 360) {
        return `M ${x} ${y} m -${radius} 0 a ${radius} ${radius} 0 1 0 ${radius * 2} 0 a ${radius} ${radius} 0 1 0 -${radius * 2} 0`;
    }
    const start = polarToCartesian(x, y, radius, endAngle);
    const end = polarToCartesian(x, y, radius, startAngle);
    const largeArcFlag = endAngle - startAngle <= 180 ? '0' : '1';
    return [
        'M', x, y,
        'L', start.x, start.y,
        'A', radius, radius, 0, largeArcFlag, 0, end.x, end.y,
        'Z'
    ].join(' ');
}

// ----------------------------------------------------
// DECISION LOGIC & ANIMATION ACTIONS
// ----------------------------------------------------
let currentRotation = 0;

function startDecision() {
    if (isSpinning) return;
    
    // Check if there is at least one non-excluded team member
    const activeMembers = members.filter(m => !m.excluded);
    if (activeMembers.length === 0) {
        showToast('식사에 참여하는 팀원이 최소 1명 이상 있어야 합니다!');
        return;
    }
    
    // Check if all active (non-excluded) team members have voted
    const unvotedMembers = activeMembers.filter(m => m.votedMenuId == null);
    if (unvotedMembers.length > 0) {
        const names = unvotedMembers.map(m => m.name).join(', ');
        showToast(`아직 메뉴를 선택하지 않은 팀원(${names})이 있어서 룰렛 혹은 슬롯머신을 시작할 수 없습니다. 모든 팀원이 투표를 완료해 주세요.`);
        return;
    }

    const slices = getWeightedSlices();
    
    if (slices.length === 0) {
        showToast('후보 대상 메뉴나 투표 결과가 존재하지 않습니다! 메뉴판에서 후보를 선택하거나 투표를 진행해 주세요.');
        return;
    }

    // Determine winner
    let winnerSlice = null;

    if (decisionMethod === 'majority') {
        // Option B: Majority rule wins instantly
        // Find item with highest vote counts
        let maxVotes = -1;
        let candidates = [];
        
        slices.forEach(slice => {
            if (slice.votes > maxVotes) {
                maxVotes = slice.votes;
                candidates = [slice];
            } else if (slice.votes === maxVotes) {
                candidates.push(slice);
            }
        });
        
        // Randomly resolve ties
        winnerSlice = candidates[Math.floor(Math.random() * candidates.length)];
    } else {
        // Option A: Weighted Draw
        // Pick a random number between 0 and 360, landing on proportional coordinates
        const rand = Math.random() * 360;
        winnerSlice = slices.find(slice => rand >= slice.startAngle && rand < slice.endAngle);
        
        // Safety fallback
        if (!winnerSlice) winnerSlice = slices[0];
    }

    // Run layout animation
    if (currentMode === 'roulette') {
        runRouletteAnimation(winnerSlice);
    } else {
        runSlotMachineAnimation(winnerSlice);
    }
}

function runRouletteAnimation(winnerSlice) {
    isSpinning = true;
    spinBtn.disabled = true;

    // Pick slice index in rendering list
    const slices = getWeightedSlices();
    const winnerIndex = slices.findIndex(s => s.menu.id === winnerSlice.menu.id);
    const slice = slices[winnerIndex];

    // SVG pointers targets top (12 o'clock, 0 degree rotation)
    // Land slice center at top: rotation theta satisfies (360 - theta % 360) = sliceCenter
    const sliceCenterAngle = slice.startAngle + (slice.angleWidth / 2);
    const targetSliceRotation = 360 - sliceCenterAngle;
    
    const extraSpins = 5 + Math.floor(Math.random() * 3);
    const totalRotationTarget = currentRotation + (extraSpins * 360) + (targetSliceRotation - (currentRotation % 360));
    
    const startRotation = currentRotation;
    const distance = totalRotationTarget - startRotation;
    
    const duration = 4000;
    const startTime = performance.now();
    let lastTickAngle = startRotation;
    const tickFrequencyAngle = 20; // tick every 20 degrees approximate

    function animateSpin(currentTime) {
        const elapsed = currentTime - startTime;
        
        if (elapsed >= duration) {
            currentRotation = totalRotationTarget;
            rouletteSvg.style.transform = `rotate(${currentRotation}deg)`;
            isSpinning = false;
            spinBtn.disabled = false;
            showResult(winnerSlice);
            return;
        }

        const t = elapsed / duration;
        const easeOut = 1 - Math.pow(1 - t, 5);
        currentRotation = startRotation + distance * easeOut;
        rouletteSvg.style.transform = `rotate(${currentRotation}deg)`;

        // Audio ticks
        const currentTickAngle = currentRotation;
        if (currentTickAngle - lastTickAngle > tickFrequencyAngle) {
            const pitchVel = (1 - t) * 6;
            playTickSound(650 + pitchVel * 50, 0.03);
            lastTickAngle = currentTickAngle;
        }

        requestAnimationFrame(animateSpin);
    }

    requestAnimationFrame(animateSpin);
}

// ----------------------------------------------------
// SLOT MACHINE RUNNER FOR DECISION
// ----------------------------------------------------
function initSlotMachine() {
    const activeList = getActiveMenus();
    const strip = slotReels.querySelector('.reel-strip');
    strip.innerHTML = '';
    
    if (activeList.length === 0) {
        strip.innerHTML = '<div class="reel-item">메뉴 없음</div>';
        return;
    }
    
    activeList.slice(0, 10).forEach(menu => {
        const item = document.createElement('div');
        item.className = 'reel-item';
        item.innerHTML = `
            <span class="reel-item-emoji">${menu.emoji}</span>
            <span>${menu.name}</span>
        `;
        strip.appendChild(item);
    });
}

function runSlotMachineAnimation(winnerSlice) {
    isSpinning = true;
    leverBtn.disabled = true;

    const activeList = getActiveMenus();
    const strip = slotReels.querySelector('.reel-strip');
    strip.innerHTML = '';

    // Put items together making winner land at index targetItemIndex
    const numSpins = 4;
    const itemsCount = numSpins * activeList.length;
    const winnerSubIndex = activeList.findIndex(m => m.id === winnerSlice.menu.id);
    const targetItemIndex = itemsCount + winnerSubIndex;
    
    const totalItems = targetItemIndex + 4;
    for (let i = 0; i < totalItems; i++) {
        const menu = activeList[i % activeList.length];
        const item = document.createElement('div');
        item.className = 'reel-item';
        item.innerHTML = `
            <span class="reel-item-emoji">${menu.emoji}</span>
            <span>${menu.name}</span>
        `;
        strip.appendChild(item);
    }

    const sampleItem = strip.querySelector('.reel-item');
    const itemHeight = sampleItem ? sampleItem.offsetHeight : 142;
    const targetOffset = targetItemIndex * itemHeight;

    strip.style.transition = 'none';
    strip.style.transform = 'translateY(0px)';
    strip.getBoundingClientRect(); // reflow

    const startTime = performance.now();
    const duration = 4000;
    let lastTickIndex = 0;

    function animateSlot(currentTime) {
        const elapsed = currentTime - startTime;
        
        if (elapsed >= duration) {
            strip.style.transform = `translateY(-${targetOffset}px)`;
            isSpinning = false;
            leverBtn.disabled = false;
            showResult(winnerSlice);
            return;
        }

        const t = elapsed / duration;
        const easeOut = 1 - Math.pow(1 - t, 5);
        const currentOffset = targetOffset * easeOut;
        strip.style.transform = `translateY(-${currentOffset}px)`;

        const currentTickIndex = Math.floor(currentOffset / itemHeight);
        if (currentTickIndex > lastTickIndex) {
            playTickSound(450 + (1 - t) * 150, 0.04);
            lastTickIndex = currentTickIndex;
        }

        requestAnimationFrame(animateSlot);
    }

    requestAnimationFrame(animateSlot);
}

// ----------------------------------------------------
// RESULT DISPLAY MODAL & SEARCH INTEGRATION
// ----------------------------------------------------
function showResult(winnerSlice) {
    const winner = winnerSlice.menu;
    const voteData = getMenuVoteData(winner.id);

    playWinSound();
    spawnConfetti(80);

    resultEmoji.textContent = winner.emoji;
    resultTitle.textContent = winner.name;
    
    let catKo = '기타';
    if (winner.category === 'korean') catKo = '한식';
    else if (winner.category === 'chinese') catKo = '중식';
    else if (winner.category === 'japanese') catKo = '일식';
    else if (winner.category === 'western') catKo = '양식';

    // Show vote status
    resultCategory.textContent = `${catKo} (${voteData.count}표 획득)`;
    modalBadge.textContent = decisionMethod === 'majority' ? 'MAJORITY WINNER' : (decisionMethod === 'equal' ? 'EQUAL DRAW WINNER' : 'LUCKY SPIN WINNER');

    // List voters in result modal
    if (voteData.count > 0) {
        voterInfoBox.style.display = 'block';
        voterNames.innerHTML = '';
        voteData.names.forEach(name => {
            const span = document.createElement('span');
            span.className = 'voter-badge';
            span.textContent = name;
            voterNames.appendChild(span);
        });
    } else {
        voterInfoBox.style.display = 'none';
    }

    // Map Search
    const location = locationInput.value.trim() || '내 위치';
    const searchQuery = `${location} ${winner.name} 맛집`;
    naverSearchLink.href = `https://map.naver.com/v5/search/${encodeURIComponent(searchQuery)}`;
    kakaoSearchLink.href = `https://map.kakao.com/?q=${encodeURIComponent(searchQuery)}`;

    // Open Modal
    resultModal.classList.add('active');
}

function closeModal() {
    resultModal.classList.remove('active');
    playTickSound(500, 0.05);
}

// ----------------------------------------------------
// TOAST SYSTEM FOR UI WARNINGS / ERRORS
// ----------------------------------------------------
function showToast(message, type = 'error') {
    const container = document.getElementById('toastContainer') || createToastContainer();
    
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    
    const icon = type === 'error' ? '⚠️' : '💡';
    
    toast.innerHTML = `
        <span class="toast-icon">${icon}</span>
        <div class="toast-content">${message}</div>
        <button class="toast-close">&times;</button>
    `;
    
    container.appendChild(toast);
    
    // Trigger animation
    setTimeout(() => {
        toast.classList.add('show');
    }, 10);
    
    // Auto-remove after 4500ms
    const timer = setTimeout(() => {
        hideToast(toast);
    }, 4500);
    
    toast.querySelector('.toast-close').addEventListener('click', () => {
        clearTimeout(timer);
        hideToast(toast);
    });
}

function createToastContainer() {
    const container = document.createElement('div');
    container.id = 'toastContainer';
    container.className = 'toast-container';
    document.body.appendChild(container);
    return container;
}

function hideToast(toast) {
    toast.classList.remove('show');
    toast.addEventListener('transitionend', () => {
        toast.remove();
    });
}

// Run Initializer
window.addEventListener('DOMContentLoaded', init);
