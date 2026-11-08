import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: '5000만분의 1 · 대한민국에서 태어나 한 번 살아보기',
  description: '대한민국 어딘가에서 오늘 태어나는 한 아이가 되어, 실제 통계를 따라 한 생을 끝까지 살아보는 인생 시뮬레이션.',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#f3efe6',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
