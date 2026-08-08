import { io } from 'socket.io-client';

const url = process.env.GAME_URL || 'http://127.0.0.1:3000';
const roomCode = `NET-${Date.now().toString(36).slice(-6).toUpperCase()}`;

function connect(name, faction) {
  return new Promise((resolve, reject) => {
    const socket = io(url, { transports: ['websocket'], forceNew: true, timeout: 5_000 });
    socket.once('connect_error', reject);
    socket.once('connect', () => {
      socket.emit('room:join', { roomCode, name, faction }, (ack) => {
        if (!ack?.ok) reject(new Error(ack?.error?.message || 'Join failed'));
        else resolve({ socket, ack });
      });
    });
  });
}

function waitForSnapshot(socket, predicate, timeoutMs = 5_000) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      socket.off('world:snapshot', onSnapshot);
      reject(new Error('Timed out waiting for authoritative snapshot'));
    }, timeoutMs);
    const onSnapshot = (snapshot) => {
      if (!predicate(snapshot)) return;
      clearTimeout(timeout);
      socket.off('world:snapshot', onSnapshot);
      resolve(snapshot);
    };
    socket.on('world:snapshot', onSnapshot);
  });
}

function emitWithAck(socket, event, payload) {
  return new Promise((resolve, reject) => {
    socket.timeout(4_000).emit(event, payload, (error, response) => {
      if (error) reject(error);
      else if (!response?.ok) reject(new Error(response?.error?.message || `${event} failed`));
      else resolve(response);
    });
  });
}

const clients = [];
try {
  const first = await connect('Thanh Vân', 'orthodox');
  clients.push(first.socket);
  const second = await connect('Huyết Ảnh', 'demonic');
  clients.push(second.socket);
  const snapshot = await waitForSnapshot(first.socket, (next) => next.players?.length === 2 && next.enemies?.length === 6);
  const meditation = await emitWithAck(first.socket, 'cultivation:meditate', { active: true });
  const block = await emitWithAck(first.socket, 'combat:block', { active: true });
  const ability = await emitWithAck(second.socket, 'combat:ability', { ability: 'basic', aim: { x: 0, z: -1 } });
  process.stdout.write(`${JSON.stringify({
    passed: true,
    roomCode,
    players: snapshot.players.map(({ name, faction }) => ({ name, faction })),
    enemies: snapshot.enemies.length,
    meditation: meditation.ok,
    authoritativeBlock: block.player.blocking,
    authoritativeAbility: ability.ability,
  }, null, 2)}\n`);
} finally {
  clients.forEach((socket) => socket.disconnect());
}
