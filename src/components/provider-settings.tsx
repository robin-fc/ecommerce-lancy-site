"use client";

import { useState, useEffect } from "react";
import { Settings, Eye, EyeOff, Check, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PROVIDERS, getModelsForTask } from "@/lib/providers";
import type { ProviderId, ModelOption } from "@/lib/providers";
import type { UserLLMConfig } from "@/lib/types";
import { cn } from "@/lib/utils";

interface ProviderSettingsProps {
  onSave: (config: UserLLMConfig) => void;
  initialConfig?: Partial<UserLLMConfig>;
}

export function ProviderSettings({ onSave, initialConfig }: ProviderSettingsProps) {
  const [open, setOpen] = useState(false);
  const [providerId, setProviderId] = useState<ProviderId>(
    (initialConfig?.providerId as ProviderId) ?? "yunwu"
  );
  const [apiKey, setApiKey] = useState(initialConfig?.apiKey ?? "");
  const [baseUrl, setBaseUrl] = useState(initialConfig?.baseUrl ?? "");
  const [chatModel, setChatModel] = useState(initialConfig?.chatModel ?? "");
  const [videoModel, setVideoModel] = useState(initialConfig?.videoModel ?? "");
  const [imageModel, setImageModel] = useState(initialConfig?.imageModel ?? "");
  const [showKey, setShowKey] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; msg: string } | null>(null);

  const chatModels = getModelsForTask(providerId, "chat");
  const imageModels = getModelsForTask(providerId, "image");
  const videoModels = getModelsForTask(providerId, "video");

  // 切换厂商时自动设置默认值
  useEffect(() => {
    if (providerId === "yunwu") setBaseUrl("https://api.yunwu.ai/v1");
    else if (providerId === "openai") setBaseUrl("https://api.openai.com/v1");
    else setBaseUrl("");

    if (!chatModel && chatModels.length > 0) setChatModel(chatModels[0].id);
    if (!videoModel && videoModels.length > 0) setVideoModel(videoModels[0].id);
    if (!imageModel && imageModels.length > 0) setImageModel(imageModels[0].id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [providerId]);

  const buildConfig = (): UserLLMConfig => ({
    providerId,
    apiKey,
    baseUrl: baseUrl || undefined,
    chatModel: chatModel || chatModels[0]?.id || "",
    imageModel: imageModel || imageModels[0]?.id,
    videoModel: videoModel || videoModels[0]?.id || "",
  });

  const handleTest = async () => {
    if (!apiKey) return;
    setTesting(true);
    setTestResult(null);
    try {
      const res = await fetch("/api/test-connection", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildConfig()),
      });
      const data = (await res.json()) as { ok: boolean; msg: string };
      setTestResult({ ok: data.ok, msg: data.msg });
    } catch {
      setTestResult({ ok: false, msg: "请求失败，请检查网络" });
    } finally {
      setTesting(false);
    }
  };

  const handleSave = () => {
    if (!apiKey) return;
    onSave(buildConfig());
    setOpen(false);
  };

  const isValid = !!apiKey && !!chatModel && !!videoModel;

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className={cn(
          "flex items-center gap-2 px-3 py-1.5 rounded-lg border text-sm transition-colors",
          initialConfig?.apiKey
            ? "border-green-200 bg-green-50 text-green-700 hover:bg-green-100"
            : "border-gray-200 text-gray-600 hover:bg-gray-50"
        )}
      >
        <Settings className="w-4 h-4" />
        {initialConfig?.apiKey ? "已配置模型" : "配置模型厂商"}
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => setOpen(false)}
          />

          <div className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl overflow-hidden">
            <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-4">
              <h2 className="text-white font-semibold text-lg">配置模型厂商</h2>
              <p className="text-blue-100 text-sm">选择 AI 服务商，填入你的 API Key</p>
            </div>

            <div className="p-6 space-y-5 max-h-[70vh] overflow-y-auto">
              {/* 1. 选择厂商 */}
              <div>
                <Label className="mb-2 block">AI 厂商</Label>
                <div className="grid grid-cols-3 gap-2">
                  {PROVIDERS.map((p) => (
                    <button
                      key={p.id}
                      onClick={() => setProviderId(p.id as ProviderId)}
                      className={cn(
                        "flex flex-col items-center gap-1 p-3 rounded-xl border-2 transition-all",
                        providerId === p.id
                          ? "border-blue-500 bg-blue-50 text-blue-700"
                          : "border-gray-100 hover:border-gray-200 text-gray-600"
                      )}
                    >
                      <span className="text-2xl">{p.logo}</span>
                      <span className="text-xs font-medium">{p.name}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* 2. API Key */}
              <div>
                <Label className="mb-1 block">
                  API Key <span className="text-red-500">*</span>
                </Label>
                <div className="relative">
                  <Input
                    type={showKey ? "text" : "password"}
                    placeholder={providerId === "yunwu" ? "sk-xxxxxxxx" : "sk-..."}
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    className="pr-10"
                  />
                  <button
                    type="button"
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    onClick={() => setShowKey(!showKey)}
                  >
                    {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                {providerId === "yunwu" && (
                  <p className="text-xs text-gray-400 mt-1">
                    没有账号？访问{" "}
                    <a
                      href="https://yunwu.apifox.cn"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-500 underline"
                    >
                      yunwu.apifox.cn
                    </a>{" "}
                    获取 API Key
                  </p>
                )}
              </div>

              {/* 3. 自定义 Base URL */}
              <div>
                <Label className="mb-1 block">Base URL（中转地址，可选）</Label>
                <Input
                  type="url"
                  placeholder={
                    providerId === "yunwu"
                      ? "https://api.yunwu.ai/v1"
                      : "https://..."
                  }
                  value={baseUrl}
                  onChange={(e) => setBaseUrl(e.target.value)}
                />
                <p className="text-xs text-gray-400 mt-1">
                  使用第三方中转时填写，例如 OpenAI 兼容格式的中转服务
                </p>
              </div>

              {/* 4. 模型选择 */}
              {chatModels.length > 0 && (
                <div>
                  <Label className="mb-1.5 block">
                    🤖 故事板生成模型（GPT 类）
                  </Label>
                  <div className="flex flex-wrap gap-2">
                    {chatModels.map((m) => (
                      <button
                        key={m.id}
                        onClick={() => setChatModel(m.id)}
                        className={cn(
                          "px-3 py-1.5 rounded-lg border text-sm transition-colors",
                          chatModel === m.id
                            ? "border-blue-500 bg-blue-50 text-blue-700"
                            : "border-gray-200 hover:border-gray-300 text-gray-600"
                        )}
                      >
                        {m.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {videoModels.length > 0 && (
                <div>
                  <Label className="mb-1.5 block">
                    🎬 视频生成模型（图生视频 I2V）
                  </Label>
                  <div className="flex flex-wrap gap-2">
                    {videoModels.map((m) => (
                      <button
                        key={m.id}
                        onClick={() => setVideoModel(m.id)}
                        className={cn(
                          "px-3 py-1.5 rounded-lg border text-sm transition-colors",
                          videoModel === m.id
                            ? "border-purple-500 bg-purple-50 text-purple-700"
                            : "border-gray-200 hover:border-gray-300 text-gray-600"
                        )}
                      >
                        {m.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {imageModels.length > 0 && (
                <div>
                  <Label className="mb-1.5 block">
                    🖼️ 图像生成模型（可选）
                  </Label>
                  <div className="flex flex-wrap gap-2">
                    {imageModels.map((m) => (
                      <button
                        key={m.id}
                        onClick={() =>
                          setImageModel(imageModel === m.id ? "" : m.id)
                        }
                        className={cn(
                          "px-3 py-1.5 rounded-lg border text-sm transition-colors",
                          imageModel === m.id
                            ? "border-green-500 bg-green-50 text-green-700"
                            : "border-gray-200 hover:border-gray-300 text-gray-600"
                        )}
                      >
                        {m.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {testResult && (
                <div
                  className={cn(
                    "flex items-center gap-2 p-3 rounded-lg text-sm",
                    testResult.ok ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"
                  )}
                >
                  {testResult.ok ? (
                    <Check className="w-4 h-4 shrink-0" />
                  ) : (
                    <AlertCircle className="w-4 h-4 shrink-0" />
                  )}
                  {testResult.msg}
                </div>
              )}
            </div>

            <div className="px-6 py-4 bg-gray-50 border-t flex justify-between items-center">
              <Button
                variant="outline"
                size="sm"
                onClick={handleTest}
                disabled={!apiKey || testing}
              >
                {testing ? "测试中..." : "测试连接"}
              </Button>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => setOpen(false)}>
                  取消
                </Button>
                <Button size="sm" onClick={handleSave} disabled={!isValid}>
                  <Check className="w-4 h-4 mr-1" />
                  保存配置
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
