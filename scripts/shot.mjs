// 화면 확인용 스크린샷 (claude/testing/SKILL.md). 헤드리스 Edge 를 CDP 로 조종한다. 개발 서버가 떠 있어야 한다.
//   node scripts/shot.mjs <url> <저장할 png> [너비=1280] [높이=1000] [누를 버튼 글자...]
// 예: node scripts/shot.mjs http://localhost:3000/ out.png 1280 1000 "돈 관리"
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';

const [url, out, width = '1280', height = '1000', ...clicks] = process.argv.slice(2);
if (!url || !out) {
  console.error('사용법: node scripts/shot.mjs <url> <png> [너비] [높이] [버튼 글자...]');
  process.exit(1);
}
const EDGE = process.env.EDGE ?? 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const PORT = 9300 + Math.floor(Math.random() * 600);
const prof = mkdtempSync(join(tmpdir(), 'shot-'));
const proc = spawn(EDGE, ['--headless=new', '--disable-gpu', '--hide-scrollbars', `--remote-debugging-port=${PORT}`, `--user-data-dir=${prof}`, `--window-size=${width},${height}`, 'about:blank']);
try {
  let target;
  for (let i = 0; i < 60 && !target; i++) {
    await sleep(250);
    try { target = (await (await fetch(`http://127.0.0.1:${PORT}/json`)).json()).find((t) => t.type === 'page'); } catch { /* 아직 */ }
  }
  if (!target) throw new Error('브라우저에 연결하지 못했다');
  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((r) => ws.addEventListener('open', r));
  let id = 0;
  const pending = new Map();
  ws.addEventListener('message', (ev) => {
    const m = JSON.parse(ev.data);
    if (m.id && pending.has(m.id)) { pending.get(m.id)(m.result ?? m.error); pending.delete(m.id); }
  });
  const send = (method, params = {}) => new Promise((r) => { const i = ++id; pending.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
  await send('Page.enable');
  await send('Emulation.setDeviceMetricsOverride', { width: Number(width), height: Number(height), deviceScaleFactor: 1, mobile: Number(width) < 600 });
  await send('Page.navigate', { url });
  await sleep(5000);
  for (const text of clicks) {
    const r = await send('Runtime.evaluate', {
      expression: `(() => { const b = [...document.querySelectorAll('button')].find((x) => x.textContent.trim().startsWith(${JSON.stringify(text)})); if (!b) return false; b.click(); return true; })()`,
      returnByValue: true,
    });
    if (!r?.result?.value) console.error(`버튼을 찾지 못했다: ${text}`);
    await sleep(800);
  }
  const shot = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true });
  writeFileSync(out, Buffer.from(shot.data, 'base64'));
  console.log(`저장: ${out}`);
  ws.close();
} finally {
  proc.kill();
  await sleep(300);
  try { rmSync(prof, { recursive: true, force: true }); } catch { /* 무시 */ }
}
