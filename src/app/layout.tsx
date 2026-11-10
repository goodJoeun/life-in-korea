import type { Metadata, Viewport } from 'next';
import { Nanum_Myeongjo } from 'next/font/google';
// 본문: Pretendard Variable 을 직접 호스팅한다. 글자 범위별로 92조각으로 나뉘어 있어 화면에 나온 글자의 조각만 받는다.
import 'pretendard/dist/web/variable/pretendardvariable-dynamic-subset.css';
import './globals.css';

// 제목·이름: 나눔명조. next/font 가 빌드할 때 받아 직접 호스팅한다(구글로 요청하지 않음).
// 한글 조각 수백 개가 모두 미리 받기(preload) 대상이 되므로 끄고, 화면에 쓰인 글자의 조각만 그때그때 받는다.
// 명조는 제목·이름에만 쓰고 모두 굵기 800이라 그것만 받는다.
const serif = Nanum_Myeongjo({
  weight: '800',
  subsets: ['latin'],
  display: 'swap',
  preload: false,
  variable: '--font-serif',
});

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
    <html lang="ko" className={serif.variable}>
      <body>{children}</body>
    </html>
  );
}
