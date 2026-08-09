import { execFile } from 'node:child_process';
import process from 'node:process';

import { startGameServer } from '../server/server.js';

const port = Number(process.env.PORT || 3000);
const url = `http://127.0.0.1:${port}/`;

await startGameServer({ port });

const command = process.platform === 'win32'
  ? ['cmd.exe', ['/c', 'start', '', url]]
  : process.platform === 'darwin'
    ? ['open', [url]]
    : ['xdg-open', [url]];

execFile(command[0], command[1], { windowsHide: true }, (error) => {
  if (error) console.log(`Máy chủ đã sẵn sàng, hãy mở ${url}`);
});

console.log(`Đã mở game tại ${url}. Giữ cửa sổ này chạy trong lúc chơi.`);
