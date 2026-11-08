import type { NextConfig } from 'next';

// 정적 사이트로 내보냄: `npm run build` → out/ 폴더를 Cloudflare Pages, GitHub Pages 등에 그대로 올리면 됨
const nextConfig: NextConfig = {
  output: 'export',
  reactStrictMode: true,
  // 개발 중 왼쪽 아래 'N' 배지가 선택지 체크박스를 가려서 끔 (오류 창은 그대로 뜸)
  devIndicators: false,
};

export default nextConfig;
