# 正好照

浏览器端证件照裁剪工具，支持国内常用规格、自定义宽高、自定义 DPI、图片参数读取，以及带真实 DPI 元数据的 JPG 导出。照片仅在用户浏览器本地处理。

## 本地运行

需要 Node.js `>=22.13.0`。

```bash
npm ci
npm run dev
```

## 构建

```bash
# Sites / Cloudflare Worker 构建
npm run build

# Render 静态站点构建
npm run build:render
```

Render 构建产物位于 `render-dist/`。项目没有 Python 依赖，因此不需要 `requirements.txt`。

## Render 部署

仓库根目录包含 `render.yaml`。在 Render 控制台选择 **New → Blueprint**，连接本仓库并部署即可。

- Runtime：Static
- Build Command：`npm ci && npm run build:render`
- Publish Directory：`render-dist`
- Start Command：不需要（静态站点由 Render CDN 托管）
- Port：不需要（静态站点没有常驻服务进程）
- Environment Variables：不需要

## 安全

`.env*`、证书、依赖目录、构建目录和本地工具状态均已加入 `.gitignore`。请勿将 API Key、密码或访问令牌写入源码或 `render.yaml`。
