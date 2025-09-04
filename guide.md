使用 Gemini API 的雅思口语分析服务
这是一个重构后的 Python Flask 应用，它利用 Google 的 Gemini API 来提供详尽的雅思口语评估。用户可以通过上传一个 Markdown 文件来进行分析。
特性
AI 驱动分析: 核心分析由强大的 gemini-1.5-flash 模型驱动。
结构化输出: API 返回详细的、结构化的 JSON 响应，便于前端集成和可视化。
全面的评估标准: 评估涵盖了雅思口语的所有关键维度，包括流利度、词汇、语法、时态、句子结构等。
简化的依赖: 不再需要 spaCy, textblob, language-tool-python 等多个本地 NLP 库。
文件输入: 接受 Markdown (.md) 文件作为输入，方便用户提交长篇回答。
安装指南
1. 克隆或下载代码
将 gemini_ielts_analyzer.py, README.md 和 .env.example 文件保存在同一个目录下。
2. 安装 Python 依赖库
请确保您已安装 Python 3.7 或更高版本。然后通过 pip 安装所有必要的库：
pip install flask flask-cors google-generativeai python-dotenv markdown


3. 设置 Gemini API 密钥
a. 获取 API 密钥: 访问 Google AI Studio 并获取您的 API 密钥。
b. 创建 .env 文件: 将 .env.example 文件复制并重命名为 .env。
c. 配置密钥: 打开 .env 文件，将 YOUR_API_KEY_HERE 替换为您真实的 Gemini API 密钥。文件内容应如下所示：
GEMINI_API_KEY="your-real-api-key-goes-here"


如何运行服务
在您的终端中，导航到项目目录并运行以下命令：
python gemini_ielts_analyzer.py


服务启动后，您会看到类似以下的输出：
Initializing Gemini IELTS Analysis Service...
Gemini API key loaded.

Starting Flask server on http://localhost:5002
Available Endpoints:
  GET  /health
  POST /ielts-speaking-gemini (Upload a .md file with key 'file')


API 端点
健康检查
URL: /health
方法: GET
描述: 检查服务是否正在运行以及 Gemini API 密钥是否已配置。
成功响应 (200):
{
  "status": "healthy",
  "service": "Gemini IELTS Speaking Analysis Service",
  "model_used": "gemini-1.5-flash",
  "gemini_api_configured": "Yes"
}


雅思口语分析
URL: /ielts-speaking-gemini
方法: POST
描述: 接收一个 Markdown 文件进行分析。
请求: multipart/form-data
key: file
value: (选择一个 .md 文件)
使用 curl 的示例:
curl -X POST -F "file=@/path/to/your/speech.md" http://localhost:5002/ielts-speaking-gemini


成功响应 (200): 一个包含完整评估结果的 JSON 对象（结构请参见 SYSTEM_PROMPT）。
从旧版迁移
端点变更: 旧的 /ielts-speaking 端点已被 /ielts-speaking-gemini 替代。
输入变更: 不再接受 JSON 格式的 text 字段，现在必须上传文件。
依赖减少: 您可以从您的环境中卸载 spacy, textblob, 和 language-tool-python。