import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Lancy AI Video - 电商批量生视频",
  description: "AI-powered 电商创意视频批量生成平台，支持商品图生成、分镜剧本、AI视频拼接",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh">
      <body className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 antialiased">
        <header className="sticky top-0 z-50 w-full border-b bg-white/80 backdrop-blur">
          <div className="container mx-auto flex h-16 items-center justify-between px-4">
            <a href="/" className="flex items-center gap-2">
              <span className="text-xl font-bold tracking-tight">🎬 Lancy AI Video</span>
            </a>
            <nav className="flex items-center gap-6 text-sm text-muted-foreground">
              <a href="/" className="hover:text-foreground transition-colors">首页</a>
              <a href="/create" className="hover:text-foreground transition-colors font-medium text-foreground">开始创作</a>
            </nav>
          </div>
        </header>
        {children}
      </body>
    </html>
  );
}
