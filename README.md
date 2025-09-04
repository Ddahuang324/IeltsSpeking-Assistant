<div align="center">

<img src="https://github.com/user-attachments/assets/b32944c3-3a05-4380-b5cb-8cc4093f00a9" alt="cover" style="width: 100px; height: 100px;">

<h1 align="center">Gemini-Next-Web</h1>

English / [简体中文](https://github.com/ElricLiu/Gemini-Next-Web/blob/main/README-CN.md)

One-Click Free Deployment of Your Private Gemini 2.0 Multi-Modal Web Application

Accessible anytime on both computer and mobile devices.

[Demo](https://www.gemininextweb.com/) / [Issues](https://github.com/ElricLiu/Gemini-Next-Web/issues) / [Join Discord](https://discord.gg/XMwSFHfm7u) / [Buy Me a Coffee](https://www.buymeacoffee.com/elricliu)

[<img src="https://vercel.com/button" alt="Deploy on Vercel" height="30">](https://vercel.com/new/clone?repository-url=https://github.com/ElricLiu/Gemini-Next-Web&env=NEXT_PUBLIC_GEMINI_API_KEY&project-name=gemini-next-web&repository-name=gemini-next-web)

![cover](https://github.com/user-attachments/assets/0dc224c0-52dd-4b40-bd08-8c744b267803)

</div>



## Getting Started
First of all，you need to obtain the API Key from google aistudio https://aistudio.google.com

Please pay attention to the network environment. Non-Gemini authorized network environments will not be available.

### Prerequisites
- Node.js 18+ and npm/yarn/pnpm
- Python 3.8+ (for backend services)
- Gemini API Key from Google AI Studio

### Installation & Deployment

#### 1. Clone the Repository
```bash
git clone https://github.com/ElricLiu/Gemini-Next-Web.git
cd Gemini-Next-Web
```

#### 2. Frontend Setup (Next.js)

##### - Vercel one-click deployment

[<img src="https://vercel.com/button" alt="Deploy on Vercel" height="30">](https://vercel.com/new/clone?repository-url=https://github.com/ElricLiu/Gemini-Next-Web&env=NEXT_PUBLIC_GEMINI_API_KEY&project-name=gemini-next-web&repository-name=gemini-next-web)

Set you Environment Variables `NEXT_PUBLIC_GEMINI_API_KEY` & API Key in vercel

##### - Local deployment
First, set you `NEXT_PUBLIC_GEMINI_API_KEY` in `.env` and run the development server:

```bash
npm install
# or
yarn install
# or
pnpm install
```

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Then, open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

#### 3. Backend Services Setup (Python)

##### Install Python Dependencies
```bash
pip install -r requirements.txt
```

##### Environment Configuration
Create a `.env` file in the project root:
```env
GEMINI_API_KEY=your_gemini_api_key_here
# or alternatively:
GOOGLE_API_KEY=your_gemini_api_key_here
```

##### Download Vosk Model (for Speech Recognition)
1. Download the Vosk English model:
   - [vosk-model-en-us-0.22-lgraph](https://alphacephei.com/vosk/models/vosk-model-en-us-0.22-lgraph.zip)
2. Extract to `./public/models/vosk-model-en-us-0.22-lgraph 2/`

##### Start Backend Services

**Terminal 1 - Vosk Speech Recognition Service:**
```bash
python3 vosk_service.py
```
Service will run on http://localhost:5001

**Terminal 2 - IELTS Analysis Service:**
```bash
python3 english_analysis_service.py
```
Service will run on http://localhost:5002

##### Service Endpoints

**Vosk Service (Port 5001):**
- `GET /health` - Health check
- `POST /recognize` - File-based speech recognition
- `POST /recognize_stream` - Streaming speech recognition
- `POST /reset` - Reset recognizer

**IELTS Analysis Service (Port 5002):**
- `GET /health` - Health check
- `POST /ielts-speaking-gemini` - Analyze IELTS speaking (upload .md file)

#### 4. Complete System
Once all services are running:
- Frontend: http://localhost:3000
- Vosk Service: http://localhost:5001
- IELTS Analysis: http://localhost:5002

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

### Contributors

<a href="https://github.com/ElricLiu/Gemini-Next-Web/graphs/contributors">
  <img src="https://contrib.rocks/image?repo=ElricLiu/Gemini-Next-Web" />
</a>

## LICENSE

[apache](https://www.apache.org/licenses/LICENSE-2.0)
# IeltsSpeking-Assistant-Gemini
