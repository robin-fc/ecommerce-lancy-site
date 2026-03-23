import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export default function HomePage() {
  return (
    <main className="flex flex-col items-center">
      {/* Hero */}
      <section className="w-full py-24 md:py-32 text-center">
        <div className="container mx-auto px-4">
          <h1 className="text-4xl md:text-6xl font-bold tracking-tight mb-6">
            用 AI 把商品变成
            <span className="text-blue-600"> 爆款视频</span>
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto mb-10">
            上传商品图，AI 生成创意分镜，批量产出高质量视频。
            <br />
            支持 TikTok、抖音竖屏，横屏广告，微短剧等多种风格。
          </p>
          <Link href="/create">
            <Button size="lg" className="text-base px-8">
              立即开始创作 →
            </Button>
          </Link>
        </div>
      </section>

      {/* Features */}
      <section className="w-full py-16 bg-white">
        <div className="container mx-auto px-4">
          <h2 className="text-2xl font-bold text-center mb-12">三步搞定创意视频</h2>
          <div className="grid md:grid-cols-3 gap-8 max-w-4xl mx-auto">
            {[
              {
                step: "01",
                title: "上传商品图",
                desc: "批量上传商品参考图，最多9张，拖拽调整顺序",
              },
              {
                step: "02",
                title: "AI 生成故事板",
                desc: "描述你的创意方向，AI 拆解分镜、生成四宫格预览",
              },
              {
                step: "03",
                title: "批量生成视频",
                desc: "确认分镜后，AI 并行生成所有片段，自动拼接成片",
              },
            ].map((f) => (
              <Card key={f.step} className="text-center border-0 shadow-none bg-transparent">
                <CardContent className="pt-6">
                  <div className="text-5xl font-bold text-blue-100 mb-4">{f.step}</div>
                  <h3 className="font-semibold text-lg mb-2">{f.title}</h3>
                  <p className="text-muted-foreground text-sm">{f.desc}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="w-full py-20 text-center">
        <div className="container mx-auto px-4">
          <h2 className="text-2xl font-bold mb-4">准备好开始了吗？</h2>
          <p className="text-muted-foreground mb-8">完全免费体验，生成你的第一个 AI 视频</p>
          <Link href="/create">
            <Button size="lg">开始创作 →</Button>
          </Link>
        </div>
      </section>
    </main>
  );
}
