/*
 * 출생 카드를 PNG 로 그린다 (브라우저 캔버스). 1080px 너비, 내용이 길면 세로로 늘어난다.
 * 지도는 koreaMap 의 SVG 경로를 Path2D 로 그대로 쓴다.
 */
import type { BirthCardData } from '@/lib/birthCard';
import { MAP_REGIONS } from '@/lib/koreaMap';

const W = 1080;
const MIN_H = 1350;
const PAD = 80;
const C = { paper: '#f3efe6', card: '#ffffff', ink: '#221f1a', ink2: '#5d564b', ink3: '#8d8576', line: '#d8d0c0', accent: '#b2432b', land: '#d9cebd' };
// 화면과 같은 폰트를 쓴다. next/font 는 폰트 이름을 바꿔 등록하므로 그릴 때 CSS 변수(--serif, --sans)에서 읽는다.
let SERIF = 'serif';
let SANS = 'sans-serif';
/** 남한만 보이는 지도 영역 (koreaMap 좌표) */
const MAP_BOX = { x: 52, y: 236, w: 266, h: 278 };

/** 글자 단위로 줄을 나눈다 (한국어는 어절 사이가 아니어도 줄을 바꿀 수 있지만, 어절을 우선 지킨다) */
function wrap(ctx: CanvasRenderingContext2D, text: string, width: number): string[] {
  const out: string[] = [];
  let line = '';
  for (const word of text.split(' ')) {
    const next = line ? `${line} ${word}` : word;
    if (ctx.measureText(next).width <= width) {
      line = next;
      continue;
    }
    if (line) out.push(line);
    line = word;
    while (ctx.measureText(line).width > width) {
      let i = line.length - 1;
      while (i > 1 && ctx.measureText(line.slice(0, i)).width > width) i--;
      out.push(line.slice(0, i));
      line = line.slice(i);
    }
  }
  if (line) out.push(line);
  return out;
}

/** 카드를 그리고 실제로 쓴 높이를 돌려준다 */
function draw(ctx: CanvasRenderingContext2D, d: BirthCardData, height: number): number {
  const inner = W - PAD * 2;
  ctx.fillStyle = C.paper;
  ctx.fillRect(0, 0, W, height);
  ctx.fillStyle = C.card;
  ctx.strokeStyle = C.line;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.roundRect(40, 40, W - 80, height - 80, 32);
  ctx.fill();
  ctx.stroke();
  ctx.textBaseline = 'alphabetic';

  // 지도 (오른쪽 위)
  const mapW = 300;
  const s = mapW / MAP_BOX.w;
  const mx = W - PAD - mapW;
  const my = 92;
  ctx.save();
  ctx.translate(mx - MAP_BOX.x * s, my - MAP_BOX.y * s);
  ctx.scale(s, s);
  ctx.lineWidth = 0.8;
  ctx.strokeStyle = C.card;
  let home: (typeof MAP_REGIONS)[number] | undefined;
  for (const r of MAP_REGIONS) {
    const path = new Path2D(r.d);
    ctx.fillStyle = r.id === d.regionId ? C.accent : C.land;
    if (r.id === d.regionId) home = r;
    ctx.fill(path);
    ctx.stroke(path);
  }
  if (home) {
    ctx.fillStyle = C.ink;
    ctx.beginPath();
    ctx.arc(home.cx, home.cy, 3.2, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();

  // 머리말
  const leftW = inner - mapW - 32;
  let y = PAD + 50;
  ctx.fillStyle = C.accent;
  ctx.font = `700 28px ${SANS}`;
  ctx.fillText('5000만분의 1 · 출생 카드', PAD, y);
  y += 110;
  ctx.fillStyle = C.ink;
  ctx.font = `800 92px ${SERIF}`;
  ctx.fillText(d.name, PAD, y);
  y += 66;
  ctx.font = `600 36px ${SANS}`;
  for (const l of wrap(ctx, `${d.year}년 · ${d.place}`, leftW)) {
    ctx.fillText(l, PAD, y);
    y += 48;
  }
  ctx.fillStyle = C.ink2;
  ctx.font = `400 30px ${SANS}`;
  ctx.fillText(d.who, PAD, y);
  y = Math.max(y + 40, my + MAP_BOX.h * s + 30);

  const heading = (t: string) => {
    ctx.strokeStyle = C.line;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(PAD, y);
    ctx.lineTo(W - PAD, y);
    ctx.stroke();
    y += 52;
    ctx.fillStyle = C.accent;
    ctx.font = `700 26px ${SANS}`;
    ctx.fillText(t, PAD, y);
    y += 50;
  };
  const rows = (items: [string, string][]) => {
    for (const [k, v] of items) {
      ctx.fillStyle = C.ink3;
      ctx.font = `400 28px ${SANS}`;
      ctx.textAlign = 'left';
      ctx.fillText(k, PAD, y);
      ctx.fillStyle = C.ink;
      ctx.font = `600 29px ${SANS}`;
      ctx.textAlign = 'right';
      ctx.fillText(v, W - PAD, y);
      ctx.textAlign = 'left';
      y += 46;
    }
    y += 8;
  };
  const para = (items: string[], tag?: string) => {
    ctx.font = `400 29px ${SANS}`;
    for (const t of items) {
      const lines = wrap(ctx, tag ? `${tag}  ${t}` : t, inner);
      for (const l of lines) {
        ctx.fillStyle = C.ink;
        ctx.fillText(l, PAD, y);
        y += 42;
      }
      y += 6;
    }
  };

  heading(`${d.year}년 대한민국`);
  rows(d.national);
  if (d.local.length) {
    heading('태어난 곳');
    rows(d.local);
  }
  if (d.kr.length || d.world.length) {
    heading('그해 있었던 일');
    para(d.kr.slice(0, 2), '한국');
    para(d.world.slice(0, 2), '세계');
  }
  if (d.born.length) {
    heading('같은 해 태어난 사람');
    para([d.born.join(' · ')]);
  }

  y += 20;
  ctx.fillStyle = C.ink3;
  ctx.font = `400 24px ${SANS}`;
  ctx.fillText(`너는 ${d.year}년에 누구로 태어날까?  #5000만분의1`, PAD, y);
  if (d.note) {
    ctx.textAlign = 'right';
    ctx.fillText(d.note, W - PAD, y);
    ctx.textAlign = 'left';
  }
  return y + PAD;
}

export async function birthCardPng(d: BirthCardData): Promise<Blob> {
  const css = getComputedStyle(document.documentElement);
  SERIF = css.getPropertyValue('--serif').trim() || SERIF;
  SANS = css.getPropertyValue('--sans').trim() || SANS;
  // 폰트는 글자 범위별 조각으로 나뉘어 있어, 카드에 쓸 글자가 든 조각을 먼저 받아 둔다
  const text = [d.name, d.place, d.who, ...d.national.flat(), ...d.local.flat(), ...d.kr, ...d.world, ...d.born,
    '5000만분의 1 · 출생 카드 대한민국 태어난 곳 그해 있었던 일 같은 해 태어난 사람 한국 세계 너는 누구로 태어날까? #', d.note ?? ''].join(' ');
  try {
    await Promise.all([
      document.fonts.load(`800 92px ${SERIF}`, d.name),
      ...[400, 600, 700].map((w) => document.fonts.load(`${w} 30px ${SANS}`, text)),
    ]);
  } catch {
    /* 못 받으면 시스템 폰트로 그린다 */
  }
  await document.fonts?.ready;
  // 한 번 그려 보고 높이를 정한 뒤 다시 그린다
  const probe = document.createElement('canvas');
  probe.width = W;
  probe.height = 2600;
  const h = Math.max(MIN_H, Math.ceil(draw(probe.getContext('2d')!, d, 2600)));
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = h;
  draw(canvas.getContext('2d')!, d, h);
  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('이미지를 만들지 못했습니다'))), 'image/png'));
}
