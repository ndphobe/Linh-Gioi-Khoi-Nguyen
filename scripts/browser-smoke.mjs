import { spawn, execFile } from 'node:child_process';
import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const chromePath = process.env.CHROME_PATH || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const targetUrl = process.env.GAME_URL || 'http://127.0.0.1:3000';
const debugPort = Number(process.env.CHROME_DEBUG_PORT || 9339);
const outputPath = process.env.GAME_SCREENSHOT || 'gameplay-check.png';
const userDataDir = path.resolve(process.env.CHROME_TEST_PROFILE || '.chrome-gameplay');
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function waitForTarget(timeoutMs = 15_000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    try {
      const response = await fetch(`http://127.0.0.1:${debugPort}/json/list`);
      const targets = await response.json();
      const page = targets.find((target) => target.type === 'page');
      if (page?.webSocketDebuggerUrl) return page;
    } catch {
      // Chrome is still booting.
    }
    await delay(160);
  }
  throw new Error(`Chrome DevTools target did not become ready (exit ${chromeExit ?? 'running'}). ${chromeDiagnostics.slice(-1200)}`);
}

function terminateProcess(pid) {
  return new Promise((resolve) => {
    execFile('taskkill', ['/PID', String(pid), '/T', '/F'], { windowsHide: true }, () => resolve());
  });
}

let chromeExit = null;
let chromeDiagnostics = '';
const chrome = spawn(chromePath, [
  '--headless=new',
  '--hide-scrollbars',
  '--enable-unsafe-swiftshader',
  '--use-angle=swiftshader',
  '--autoplay-policy=no-user-gesture-required',
  '--remote-allow-origins=*',
  `--remote-debugging-port=${debugPort}`,
  `--user-data-dir=${userDataDir}`,
  '--window-size=1440,1000',
  targetUrl,
], { windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
chrome.stdout.on('data', (chunk) => { chromeDiagnostics += chunk.toString(); });
chrome.stderr.on('data', (chunk) => { chromeDiagnostics += chunk.toString(); });
chrome.on('exit', (code) => { chromeExit = code; });

const runtimeErrors = [];

try {
  const target = await waitForTarget();
  const websocket = new WebSocket(target.webSocketDebuggerUrl);
  const pending = new Map();
  let sequence = 0;

  const command = (method, params = {}) => new Promise((resolve, reject) => {
    const id = ++sequence;
    pending.set(id, { resolve, reject });
    websocket.send(JSON.stringify({ id, method, params }));
  });

  await new Promise((resolve, reject) => {
    websocket.addEventListener('open', resolve, { once: true });
    websocket.addEventListener('error', reject, { once: true });
  });

  websocket.addEventListener('message', (message) => {
    const payload = JSON.parse(message.data);
    if (payload.id && pending.has(payload.id)) {
      const entry = pending.get(payload.id);
      pending.delete(payload.id);
      if (payload.error) entry.reject(new Error(payload.error.message));
      else entry.resolve(payload.result);
      return;
    }
    if (payload.method === 'Runtime.exceptionThrown') {
      runtimeErrors.push(payload.params?.exceptionDetails?.text || 'Runtime exception');
    }
    if (payload.method === 'Log.entryAdded' && payload.params?.entry?.level === 'error') {
      const entry = payload.params.entry;
      if (!String(entry.url || '').endsWith('/favicon.ico')) runtimeErrors.push(entry.text);
    }
  });

  await command('Page.enable');
  await command('Runtime.enable');
  await command('Log.enable');
  // Vite's first transform and software WebGL startup are slower on cold CI
  // machines. Wait for the lobby module to populate the generated name instead
  // of racing a fixed timeout and clicking before listeners exist.
  let lobbyReady = false;
  for (let attempt = 0; attempt < 60; attempt += 1) {
    const readiness = await command('Runtime.evaluate', {
      expression: `Boolean(document.querySelector('#name-input')?.value && document.querySelector('#start-game'))`,
      returnByValue: true,
    });
    lobbyReady = readiness.result.value === true;
    if (lobbyReady) break;
    await delay(200);
  }
  if (!lobbyReady) throw new Error('Lobby did not become interactive within 12 seconds.');
  const interactionResult = await command('Runtime.evaluate', {
    expression: `(() => {
      const before = {
        readyState: document.readyState,
        name: document.querySelector('#name-input')?.value,
        selected: document.querySelector('.sect-card.is-selected')?.dataset.sect,
        startDisabled: document.querySelector('#start-game')?.disabled,
        webgl2: Boolean(document.createElement('canvas').getContext('webgl2'))
      };
      document.querySelector('#name-input').value = 'Kiểm Thử Thiên';
      document.querySelector('#room-input').value = 'SMOKE-01';
      document.querySelector('.sect-card[data-sect="demonic"]').click();
      document.querySelector('#start-game').click();
      return { before, after: {
        name: document.querySelector('#name-input')?.value,
        selected: document.querySelector('.sect-card.is-selected')?.dataset.sect,
        startDisabled: document.querySelector('#start-game')?.disabled
      }};
    })()`,
    awaitPromise: true,
    returnByValue: true,
  });
  await delay(7_000);

  const stateResult = await command('Runtime.evaluate', {
    expression: `JSON.stringify({
      title: document.title,
      onboardingHidden: document.querySelector('#onboarding').hidden,
      hudHidden: document.querySelector('#hud').hidden,
      bossVisible: !document.querySelector('#boss-hud').hidden,
      status: document.querySelector('#connection-status').textContent,
      canvas: [document.querySelector('#game-canvas').width, document.querySelector('#game-canvas').height],
      objective: document.querySelector('#objective-title').textContent,
      online: document.querySelector('#online-count').textContent
    })`,
    returnByValue: true,
  });
  const screenshot = await command('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
  await writeFile(outputPath, Buffer.from(screenshot.data, 'base64'));
  const state = JSON.parse(stateResult.result.value);
  const passed = state.onboardingHidden && !state.hudHidden && state.bossVisible && state.canvas[0] > 0 && runtimeErrors.length === 0;
  process.stdout.write(`${JSON.stringify({ passed, interaction: interactionResult.result.value, state, runtimeErrors, screenshot: outputPath }, null, 2)}\n`);
  websocket.close();
  if (!passed) process.exitCode = 1;
} finally {
  await terminateProcess(chrome.pid);
}
