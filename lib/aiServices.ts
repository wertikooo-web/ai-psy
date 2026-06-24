export interface AiService {
  id: string;
  name: string;
  url: string;
  emoji: string;
  description: string;
}

export const DEFAULT_AI_SERVICES: AiService[] = [
  {
    id: "chatgpt",
    name: "ChatGPT",
    url: "https://chat.openai.com",
    emoji: "🤖",
    description: "GPT-4o · OpenAI",
  },
  {
    id: "claude",
    name: "Claude",
    url: "https://claude.ai",
    emoji: "🔮",
    description: "Claude Sonnet · Anthropic",
  },
  {
    id: "gemini",
    name: "Gemini",
    url: "https://gemini.google.com",
    emoji: "✨",
    description: "Gemini 2.0 · Google",
  },
  {
    id: "deepseek",
    name: "DeepSeek",
    url: "https://chat.deepseek.com",
    emoji: "🌊",
    description: "DeepSeek-V3 · DeepSeek AI",
  },
  {
    id: "grok",
    name: "Grok",
    url: "https://grok.com",
    emoji: "⚡",
    description: "Grok 3 · xAI",
  },
  {
    id: "perplexity",
    name: "Perplexity",
    url: "https://www.perplexity.ai",
    emoji: "🔍",
    description: "AI-поиск с источниками",
  },
  {
    id: "notebooklm",
    name: "NotebookLM",
    url: "https://notebooklm.google.com",
    emoji: "📓",
    description: "Анализ документов · Google",
  },
  {
    id: "gamma",
    name: "Gamma",
    url: "https://gamma.app",
    emoji: "🎨",
    description: "AI-презентации и документы",
  },
];
