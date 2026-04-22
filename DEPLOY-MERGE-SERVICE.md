# 视频合并服务 — 部署指南

## 架构

```
[Next.js 前端]
  ↓ POST /api/video/merge
[Railway: merge-service]  ← Docker 容器（Node.js + FFmpeg）
  ↓ 下载视频 → FFmpeg 合并
[Cloudflare R2]  ← 永久免费 10GB
  ↓ 返回公开 URL
[前端展示合并结果]
```

---

## 第一步：创建 Cloudflare R2

### 1.1 开通 R2

1. 登录 [Cloudflare Dashboard](https://dash.cloudflare.com/)
2. 左侧菜单 → **R2 Object Storage** → **Create Bucket**
3. Bucket 名称填 `ecommerce-videos`，区域选 **亚太**（延迟低）
4. 创建后进入 Bucket → **Settings** → **Custom Domain**（可选）

### 1.2 获取 API Token

1. Cloudflare Dashboard → 右上角头像 → **My Profile**
2. **API Tokens** → **Create Token** → **Create Custom Token**
3. 配置权限：
   - **Account** → R2 → **Edit**
   - **Bucket** → `ecommerce-videos` → **Edit**
4. Token 名称：`merge-service-rw`
5. 复制保存 `Access Key ID` 和 `Secret Access Key`

### 1.3 开启公开访问

1. 进入 Bucket → **Settings** → **Settings**
2. **Block public access** → 关闭（Allow）
3. 记下 **R2 Account ID**（Dashboard 右侧，64 位字符串）

### 1.4 配置 R2 Public URL

在 R2 Dashboard → 你的 Bucket → **Settings** → **Public URL**：
- 默认格式：`https://<account-id>.r2.dev/<bucket>/<filename>`
- 或者绑定自定义域名（可选）

---

## 第二步：部署到 Railway

### 2.1 安装 Railway CLI

```bash
npm install -g @railway/cli
railway login
```

### 2.2 初始化项目

```bash
cd E:\2026\lancy.site\ecommerce-lancy-site\server

railway init
# 选择：Deploy from Dockerfile
# 输入项目名称：merge-service
```

### 2.3 配置环境变量

在 Railway Dashboard → 项目 → merge-service → **Variables**：

| 变量名 | 值 | 说明 |
|--------|-----|------|
| `R2_ACCOUNT_ID` | `你的 Cloudflare Account ID` | R2 控制台右侧 |
| `R2_ACCESS_KEY_ID` | `API Token 的 Access Key ID` | 刚才创建的 |
| `R2_SECRET_ACCESS_KEY` | `API Token 的 Secret Key` | 刚才创建的 |
| `R2_BUCKET_NAME` | `ecommerce-videos` | Bucket 名称 |
| `R2_PUBLIC_URL` | `https://xxx.r2.dev` | 去掉最后的 `/` |

### 2.4 部署

```bash
cd E:\2026\lancy.site\ecommerce-lancy-site\server
railway up --dockerfile
```

部署成功后，Railway 会给你一个 URL，例如：
```
https://merge-service.railway.app
```

### 2.5 验证服务

```bash
# 健康检查
curl https://merge-service.railway.app/health

# 预期返回
{"status":"ok","busy":false,"uptime":10,"timestamp":"2026-04-21T..."}
```

---

## 第三步：配置 Next.js 前端

### 3.1 设置环境变量

在 `E:\2026\lancy.site\ecommerce-lancy-site\.env.local` 添加：

```env
# 视频合并服务地址（Railway 部署后的地址）
MERGE_SERVICE_URL=https://merge-service.railway.app

# R2 配置（Next.js 也需要能访问 R2）
R2_ACCOUNT_ID=你的AccountID
R2_ACCESS_KEY_ID=你的AccessKeyID
R2_SECRET_ACCESS_KEY=你的SecretKey
R2_BUCKET_NAME=ecommerce-videos
R2_PUBLIC_URL=https://xxx.r2.dev
```

### 3.2 验证完整流程

```bash
cd E:\2026\lancy.site\ecommerce-lancy-site
npm run dev
```

在浏览器打开创建页面，生成视频后点击"合并"，检查：
1. 合并请求是否发出（Network 面板）
2. Railway 日志是否有下载/合并日志
3. 合并完成后 R2 是否有文件
4. 前端是否显示合并后的视频

---

## 第四步：扣子工作流集成（可选）

如果要用扣子编排整个流程：

### 4.1 在扣子创建工作流

1. 扣子控制台 → **工作流** → **新建**
2. 添加节点：
   - **开始**：输入 `{ videoUrls: string[] }`
   - **HTTP 请求**：POST 到 `https://merge-service.railway.app/merge`
     - Body: `{ "videoUrls": "{{videoUrls}}" }`
   - **结束**：输出 `{ mergedUrl: result.mergedUrl }`

### 4.2 发布为 API

1. 工作流编辑页 → **发布** → **发布为 API**
2. 获得 API endpoint 和 Token
3. 前端直接调用扣子 API 触发合并

### 4.3 或者用扣子触发 Next.js

扣子工作流 → **HTTP 请求** → POST 到你的 Next.js 域名：
```
https://your-nextjs-site.com/api/video/merge
```

---

## 本地开发调试

### 启动合并服务（本地）

```bash
cd E:\2026\lancy.site\ecommerce-lancy-site\server

# 安装 FFmpeg（Windows）
# 下载 https://www.gyan.dev/ffmpeg/builds/ 或用 winget:
winget install Gyan.FFmpeg

# 安装依赖
npm install

# 启动
node merge-service.js
```

### 本地开发环境变量

```env
MERGE_SERVICE_URL=http://localhost:8080
R2_ACCOUNT_ID=dev-account
R2_ACCESS_KEY_ID=dev-key
R2_SECRET_ACCESS_KEY=dev-secret
R2_BUCKET_NAME=ecommerce-videos-dev
R2_PUBLIC_URL=https://dev-account.r2.dev
```

本地开发时，`/api/video/merge` 会调用 `http://localhost:8080/merge`。

---

## 故障排查

### Railway 部署失败

```bash
# 查看构建日志
railway logs

# 常见问题：FFmpeg 没装好 → Dockerfile 检查
```

### 合并超时

Railway 免费版容器会休眠。视频合并耗时可能超过冷启动时间。
**解决方案：** Railway Starter Plan（$5/月）= 容器常驻不休眠

### R2 上传失败

1. 检查 API Token 权限（需要 R2 写权限）
2. 检查 Bucket 名称是否正确
3. 检查 `R2_PUBLIC_URL` 末尾没有 `/`

### 前端报 502

合并服务返回了错误。看 Railway 日志：
```bash
railway logs --tail 50
```

---

## 费用总结

| 服务 | 费用 | 说明 |
|------|------|------|
| Railway | $0（免费额度） | 500h/月，休眠后重载 |
| Cloudflare R2 | $0 | 永久免费 10GB |
| **合计** | **免费** | 小规模个人项目够用 |
