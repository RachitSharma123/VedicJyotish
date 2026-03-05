export type AIProvider = 'deepseek' | 'openrouter' | 'kimi';

export type ProviderConfig = {
  label: string;
  modelsUrl: string;
  chatUrl: string;
  modelField?: string;
  keyEnv?: string;
  defaultModel: string;
};

export const PROVIDERS: Record<AIProvider, ProviderConfig> = {
  deepseek: {
    label: 'DeepSeek',
    modelsUrl: 'https://api.deepseek.com/models',
    chatUrl: 'https://api.deepseek.com/chat/completions',
    keyEnv: 'DEEPSEEK_API_KEY',
    defaultModel: 'deepseek-chat',
  },
  openrouter: {
    label: 'OpenRouter',
    modelsUrl: 'https://openrouter.ai/api/v1/models',
    chatUrl: 'https://openrouter.ai/api/v1/chat/completions',
    keyEnv: 'OPENROUTER_API_KEY',
    defaultModel: 'openai/gpt-4o-mini',
  },
  kimi: {
    label: 'Kimi (Moonshot)',
    modelsUrl: 'https://api.moonshot.cn/v1/models',
    chatUrl: 'https://api.moonshot.cn/v1/chat/completions',
    keyEnv: 'KIMI_API_KEY',
    defaultModel: 'moonshot-v1-8k',
  },
};

export function normalizeModelsPayload(payload: unknown): string[] {
  if (!payload || typeof payload !== 'object') return [];
  const data = (payload as { data?: unknown }).data;
  if (!Array.isArray(data)) return [];

  return data
    .map((item) => {
      if (typeof item === 'string') return item;
      if (item && typeof item === 'object') {
        const id = (item as { id?: unknown; name?: unknown }).id;
        if (typeof id === 'string') return id;
        const name = (item as { id?: unknown; name?: unknown }).name;
        if (typeof name === 'string') return name;
      }
      return '';
    })
    .filter(Boolean)
    .slice(0, 200);
}
