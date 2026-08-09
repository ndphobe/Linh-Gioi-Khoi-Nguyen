import { io } from 'socket.io-client';
import { AudioEngine } from './game/AudioEngine.js';
import { DEFAULT_PROFILE, FACTIONS } from './game/data.js';
import { loadProfile, normalizeRoomCode, sanitizeName, saveProfile } from './game/rules.js';
import { SaveSystem } from './game/SaveSystem.js';
import { CharacterManager } from './game/CharacterManager.js';

const STORAGE_KEY = 'van-kiep-tu-tien:profile:v1';
const ROOM_KEY = 'van-kiep-tu-tien:last-room';
const onboarding = document.getElementById('onboarding');
const canvas = document.getElementById('game-canvas');
const nameInput = document.getElementById('name-input');
const roomInput = document.getElementById('room-input');
const startButton = document.getElementById('start-game');
const status = document.getElementById('connection-status');
const cards = [...document.querySelectorAll('.sect-card[data-sect]')];

function memoryStorage() {
  const values = new Map();
  return {
    getItem: (key) => values.has(key) ? values.get(key) : null,
    setItem: (key, value) => values.set(key, String(value)),
    removeItem: (key) => values.delete(key),
  };
}

function usableStorage(name) {
  try {
    const storage = window[name];
    const probe = `__storage_probe__${Date.now()}`;
    storage.setItem(probe, probe);
    storage.removeItem(probe);
    return storage;
  } catch {
    return memoryStorage();
  }
}

const persistentStorage = usableStorage('localStorage');
const transientStorage = usableStorage('sessionStorage');
const stored = loadProfile(persistentStorage.getItem(STORAGE_KEY));
const characterManager = new CharacterManager(new SaveSystem(persistentStorage));
let selectedSect = FACTIONS[stored.factionId] ? stored.factionId : DEFAULT_PROFILE.factionId;
let socket = null;
let game = null;
let journeyStarting = false;
const audio = new AudioEngine();

function renderSectPreviews() {
  const atlas = new Image();
  atlas.src = new URL(`${import.meta.env.BASE_URL}assets/sect-character-atlas-v2.png`, document.baseURI).href;
  atlas.onload = () => cards.forEach((card, row) => {
    const host = card.querySelector('.sect-card__art'); if (!host) return;
    host.querySelectorAll(':scope > *').forEach(node => node.remove());
    const preview = document.createElement('canvas'); preview.className = 'sect-preview-canvas'; preview.width = 220; preview.height = 220;
    const context = preview.getContext('2d'); context.imageSmoothingEnabled = false;
    const sw = atlas.naturalWidth / 4, sh = atlas.naturalHeight / 3;
    context.drawImage(atlas, 0, row * sh, sw, sh, 0, 0, 220, 220);
    host.appendChild(preview);
  });
}

function generatedName() {
  const family = ['Lạc', 'Vân', 'Diệp', 'Tần', 'Sở', 'Mặc', 'Bạch', 'Hàn'];
  const given = ['Trường Phong', 'Thanh Dao', 'Vô Trần', 'Nhược Thủy', 'Thiên Vũ', 'Tử Yên', 'Cửu Ca', 'Mộng Ly'];
  return `${family[Math.floor(Math.random() * family.length)]} ${given[Math.floor(Math.random() * given.length)]}`;
}

function generatedRoomCode() {
  const bytes = new Uint8Array(3);
  if (globalThis.crypto?.getRandomValues) globalThis.crypto.getRandomValues(bytes);
  else bytes.forEach((_, index) => { bytes[index] = Math.floor(Math.random() * 256); });
  return `THAI-${[...bytes].map((value) => value.toString(36).padStart(2, '0')).join('').slice(0, 6).toUpperCase()}`;
}

function setStatus(message, state = 'connecting') {
  if (!status) return;
  status.textContent = message;
  status.dataset.state = state;
  status.closest('.connection-row')?.setAttribute('data-state', state);
}

function selectSect(sect) {
  if (!FACTIONS[sect]) return;
  selectedSect = sect;
  cards.forEach((card) => {
    const selected = card.dataset.sect === sect;
    card.classList.toggle('is-selected', selected);
    card.setAttribute('aria-pressed', String(selected));
  });
  document.documentElement.dataset.sect = sect;
}

function connectLobby() {
  if (socket) socket.disconnect();
  socket = io({
    autoConnect: true,
    reconnection: true,
    reconnectionDelay: 600,
    reconnectionDelayMax: 3500,
    transports: ['websocket', 'polling'],
  });
  socket.on('connect', () => setStatus('Linh mạch ổn định · máy chủ đã sẵn sàng', 'online'));
  socket.on('disconnect', () => setStatus('Đang nối lại linh mạch máy chủ…', 'connecting'));
  socket.on('connect_error', () => setStatus('Chưa thể cảm ứng máy chủ · đang thử lại', 'offline'));
}

function showInputError(message) {
  setStatus(message, 'error');
  const row = status?.closest('.connection-row');
  row?.classList.remove('is-shaking');
  requestAnimationFrame(() => row?.classList.add('is-shaking'));
}

function canvas2DAvailable() {
  try {
    const probe = document.createElement('canvas');
    return Boolean(probe.getContext('2d'));
  } catch {
    return false;
  }
}

async function beginJourney() {
  if (journeyStarting || game) return;
  const name = sanitizeName(nameInput.value);
  if (name.length < 2) {
    nameInput.focus();
    showInputError('Đạo hiệu cần ít nhất 2 ký tự.');
    return;
  }
  if (!canvas2DAvailable()) {
    showInputError('Trình duyệt chưa hỗ trợ Canvas 2D.');
    return;
  }
  let roomCode = normalizeRoomCode(roomInput.value);
  if (!roomCode) roomCode = generatedRoomCode();
  roomInput.value = roomCode;
  transientStorage.setItem(ROOM_KEY, roomCode);

  journeyStarting = true;
  startButton.disabled = true;
  startButton.classList.add('is-loading');
  const startLabel = startButton.querySelector('span');
  if (startLabel) startLabel.textContent = 'Đang mở tiên môn…';
  try {
  const gameModulePromise = import('./game/Game.js');
  await Promise.all([
    gameModulePromise,
    Promise.race([
      audio.init().catch(() => undefined),
      new Promise((resolve) => setTimeout(resolve, 450)),
    ]),
  ]);
  const { CultivationGame } = await gameModulePromise;
  const activeCharacter=characterManager.selectByFaction(selectedSect,name);

  const clientProfile = {
    name,
    faction: selectedSect,
    sect: selectedSect,
    roomCode,
    characterId: activeCharacter.id,
    resumeToken: activeCharacter.resumeToken,
    realm: activeCharacter.realm,
    realmName: activeCharacter.realmName,
    qi: activeCharacter.currentExp,
    hp: 120,
    maxHp: 120,
    mp: 100,
    maxMp: 100,
    manaRegen: 3.5,
    minorLevel: activeCharacter.minorLevel,
    skillSystem: activeCharacter.skillSystem,
    cultivationSystem: activeCharacter.cultivationSystem,
    shopSystem: {gold:activeCharacter.gold,inventory:activeCharacter.inventory,equipment:activeCharacter.equipment},
    gold: activeCharacter.gold,
    allocatedStats: activeCharacter.allocatedStats,
    currentRegion: activeCharacter.currentRegion,
    resources: activeCharacter.resources,
  };

  game = new CultivationGame({
    canvas,
    socket,
    profile: clientProfile,
    audio,
    onProfileChange: (next) => {
      characterManager.updateActive(next);
      const realmId = next.cultivationSystem?.realmId ?? next.realm ?? 'qi_refining';
      persistentStorage.setItem(STORAGE_KEY, saveProfile({
        ...stored,
        name: next.name,
        factionId: next.faction,
        realmId,
        cultivation: next.qi,
        questPhase: next.cultivationSystem?.level > 1 ? 'complete' : 'arrival',
        skillSystem: next.skillSystem,
        cultivationSystem: next.cultivationSystem,
        shopSystem: next.shopSystem,
        currentRegion: next.currentRegion,
      }));
    },
    onExit: returnToOnboarding,
  });
  onboarding.classList.add('is-departing');
  await new Promise((resolve) => setTimeout(resolve, 520));
  onboarding.hidden = true;
  onboarding.classList.remove('is-departing');
  canvas.classList.add('is-active');
  document.body.classList.add('is-playing');
  game.start();
  } catch (error) {
    console.error('Không thể khởi động game:', error);
    game?.destroy();
    game = null;
    onboarding.hidden = false;
    onboarding.classList.remove('is-departing');
    canvas.classList.remove('is-active');
    document.body.classList.remove('is-playing');
    showInputError('Không thể tải game. Hãy kiểm tra máy chủ rồi thử lại.');
  } finally {
    journeyStarting = false;
    if (!game) {
      startButton.disabled = false;
      startButton.classList.remove('is-loading');
      if (startLabel) startLabel.textContent = 'Bước vào tiên lộ';
    }
  }
}

function returnToOnboarding() {
  game = null;
  journeyStarting = false;
  document.body.classList.remove('is-playing');
  canvas.classList.remove('is-active');
  const hud = document.getElementById('hud');
  hud?.setAttribute('hidden', '');
  hud?.classList.remove('is-visible');
  document.querySelectorAll('.screen-overlay').forEach((overlay) => {
    overlay.hidden = true;
    overlay.classList.remove('is-open');
  });
  onboarding.hidden = false;
  startButton.disabled = false;
  startButton.classList.remove('is-loading');
  const startLabel = startButton.querySelector('span');
  if (startLabel) startLabel.textContent = 'Bước vào tiên lộ';
  connectLobby();
}

cards.forEach((card) => card.addEventListener('click', () => selectSect(card.dataset.sect)));
startButton.addEventListener('click', beginJourney);
nameInput.addEventListener('keydown', (event) => {
  if (event.key === 'Enter' && !event.isComposing && event.keyCode !== 229) beginJourney();
});
// Do not rewrite the value on every input event: Vietnamese Telex/VNI uses an
// active IME composition and mutating the field mid-composition breaks accents.
roomInput.addEventListener('blur', () => {
  roomInput.value = normalizeRoomCode(roomInput.value);
});
roomInput.addEventListener('keydown', (event) => {
  if (event.key === 'Enter' && !event.isComposing && event.keyCode !== 229) beginJourney();
});

document.querySelector('[data-action="toggle-map"]')?.addEventListener('click', () => game?.toggleWorldMap());
document.querySelector('[data-action="leave-game"]')?.addEventListener('click', () => {
  game?.destroy();
  returnToOnboarding();
});

nameInput.value = stored.name && stored.name !== DEFAULT_PROFILE.name ? stored.name : generatedName();
roomInput.value = normalizeRoomCode(transientStorage.getItem(ROOM_KEY) ?? '');
selectSect(selectedSect);
renderSectPreviews();
connectLobby();
