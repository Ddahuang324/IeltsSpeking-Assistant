<div align="center">

<img src="https://github.com/user-attachments/assets/b32944c3-3a05-4380-b5cb-8cc4093f00a9" alt="cover" style="width: 100px; height: 100px;">

<h1 align="center">Gemini-Next-Web</h1>

[English](https://github.com/ElricLiu/Gemini-Next-Web) / 简体中文

一键免费部署您的私人 Gemini 2.0 多模态网页应用

随时随地在电脑和移动设备上访问。

[演示](https://www.gemininextweb.com/) / [反馈](https://github.com/ElricLiu/Gemini-Next-Web/issues) / [QQ](https://qm.qq.com/q/Bxx3eI3ilW) / [赞赏](https://www.buymeacoffee.com/elricliu)

[<img src="https://vercel.com/button" alt="Deploy on Vercel" height="30">](https://vercel.com/new/clone?repository-url=https://github.com/ElricLiu/Gemini-Next-Web&env=NEXT_PUBLIC_GEMINI_API_KEY&project-name=gemini-next-web&repository-name=gemini-next-web)

![cover](https://github.com/user-attachments/assets/0dc224c0-52dd-4b40-bd08-8c744b267803)

</div>

## 开始项目

首先，您需要从 Google aistudio https://aistudio.google.com 获取 API Key

请注意网络环境。非 Gemini 授权的网络环境将不可用

### 环境要求
- Node.js 18+ 和 npm/yarn/pnpm
- Python 3.8+ (用于后端服务)
- Google AI Studio 的 Gemini API Key

### 安装与部署

#### 1. 克隆仓库
```bash
git clone https://github.com/ElricLiu/Gemini-Next-Web.git
cd Gemini-Next-Web
```

#### 2. 前端设置 (Next.js)

##### - Vercel 一键部署

[<img src="https://vercel.com/button" alt="Deploy on Vercel" height="30">](https://vercel.com/new/clone?repository-url=https://github.com/ElricLiu/Gemini-Next-Web&env=NEXT_PUBLIC_GEMINI_API_KEY&project-name=gemini-next-web&repository-name=gemini-next-web)

在 Vercel 中设置环境变量 NEXT_PUBLIC_GEMINI_API_KEY 和 API 密钥

##### - 本地部署

首先，在`.env`文件中填写`NEXT_PUBLIC_GEMINI_API_KEY`并且启动项目

```bash
npm install
# 或
yarn install
# 或
pnpm install
```

```bash
npm run dev
# 或
yarn dev
# 或
pnpm dev
# 或
bun dev
```
然后，用浏览器打开 http://localhost:3000 查看结果。

#### 3. 后端服务设置 (Python)

##### 安装 Python 依赖
```bash
pip install -r requirements.txt
```

##### 环境配置
在项目根目录创建 `.env` 文件：
```env
GEMINI_API_KEY=你的gemini_api_key
# 或者使用：
GOOGLE_API_KEY=你的gemini_api_key
```

##### 下载 Vosk 模型 (用于语音识别)
1. 下载 Vosk 英文模型：
   - [vosk-model-en-us-0.22-lgraph](https://alphacephei.com/vosk/models/vosk-model-en-us-0.22-lgraph.zip)
2. 解压到 `./public/models/vosk-model-en-us-0.22-lgraph 2/`

##### 启动后端服务

**终端 1 - Vosk 语音识别服务：**
```bash
python3 vosk_service.py
```
服务将运行在 http://localhost:5001

**终端 2 - IELTS 分析服务：**
```bash
python3 english_analysis_service.py
```
服务将运行在 http://localhost:5002

##### 服务端点

**Vosk 服务 (端口 5001)：**
- `GET /health` - 健康检查
- `POST /recognize` - 基于文件的语音识别
- `POST /recognize_stream` - 流式语音识别
- `POST /reset` - 重置识别器

**IELTS 分析服务 (端口 5002)：**
- `GET /health` - 健康检查
- `POST /ielts-speaking-gemini` - 分析 IELTS 口语 (上传 .md 文件)

#### 4. 完整系统
所有服务运行后：
- 前端：http://localhost:3000
- Vosk 服务：http://localhost:5001
- IELTS 分析：http://localhost:5002

您可以通过修改 app/page.tsx 开始编辑页面。当您编辑文件时，页面会自动更新。

该项目使用 next/font 自动优化和加载 Geist ，这是 Vercel 的新字体系列。

### 贡献者

<a href="https://github.com/ElricLiu/Gemini-Next-Web/graphs/contributors">
  <img src="https://contrib.rocks/image?repo=ElricLiu/Gemini-Next-Web" />
</a>

## LICENSE

[apache](https://www.apache.org/licenses/LICENSE-2.0)

