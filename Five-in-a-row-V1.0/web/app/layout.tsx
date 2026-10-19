import type { Metadata } from 'next';
import './globals.css';
export const metadata: Metadata = {
  metadataBase: new URL(process.env.SITE_ORIGIN || 'http://localhost:4173'),
  title: '弈间 · Swap2 五子棋',
  description:
    '下一手，玩点未来。未来潮玩风 Swap2 五子棋，支持同机双人与局域网联机。',
  icons: { icon: '/icon.svg' },
  openGraph: {
    title: '弈间 · Swap2 五子棋',
    description: '下一手，玩点未来。珊瑚红与冰蓝的未来潮玩棋局。',
    type: 'website',
    images: [
      {
        url: '/og.png',
        width: 1732,
        height: 908,
        alt: '弈间 · 未来潮玩风 Swap2 五子棋',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: '弈间 · Swap2 五子棋',
    description: '下一手，玩点未来。未来潮玩风 Swap2 五子棋。',
    images: ['/og.png'],
  },
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
