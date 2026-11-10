/* 결과·출생 카드 공유 도구 (브라우저 전용) */

export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const ta = document.createElement('textarea');
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    let ok = false;
    try {
      ok = document.execCommand('copy');
    } catch {
      ok = false;
    }
    ta.remove();
    return ok;
  }
}

/** 공유 시트가 있으면 그걸로(이미지가 있으면 이미지째), 없으면 글을 복사한다 */
export async function shareOrCopy(opts: { title: string; text: string; file?: File }): Promise<'shared' | 'copied' | 'cancelled' | 'failed'> {
  const url = window.location.href.split('#')[0];
  if (typeof navigator.share === 'function') {
    const withFile = opts.file && navigator.canShare?.({ files: [opts.file] }) ? { files: [opts.file] } : {};
    try {
      await navigator.share({ title: opts.title, text: opts.text, url, ...withFile });
      return 'shared';
    } catch (e) {
      if ((e as DOMException)?.name === 'AbortError') return 'cancelled';
    }
  }
  return (await copyText(`${opts.text}\n${url}`)) ? 'copied' : 'failed';
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
