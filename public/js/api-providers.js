const PRICING = {
  'gpt-4o': { input: 2.50, output: 10.00 },
  'gpt-4o-mini': { input: 0.15, output: 0.60 },
  'gpt-4-turbo': { input: 10.00, output: 30.00 },
  'gpt-4': { input: 30.00, output: 60.00 },
  'gpt-3.5-turbo': { input: 0.50, output: 1.50 },
  'o1': { input: 15.00, output: 60.00 },
  'o1-mini': { input: 3.00, output: 12.00 },
  'o3-mini': { input: 1.10, output: 4.40 },
  'claude-sonnet-4-5-20250514': { input: 3.00, output: 15.00 },
  'claude-opus-4-6-20250515': { input: 15.00, output: 75.00 },
  'claude-haiku-4-5-20251001': { input: 0.80, output: 4.00 },
  'claude-3-5-sonnet-20241022': { input: 3.00, output: 15.00 },
  'gemini-2.0-flash': { input: 0.10, output: 0.40 },
  'gemini-2.0-flash-lite': { input: 0.02, output: 0.10 },
  'gemini-1.5-pro': { input: 1.25, output: 5.00 },
  'gemini-1.5-flash': { input: 0.075, output: 0.30 },
  'deepseek-chat': { input: 0.14, output: 0.28 },
  'deepseek-reasoner': { input: 0.55, output: 2.19 },
  'mistral-large-latest': { input: 2.00, output: 6.00 },
  'mistral-small-latest': { input: 0.20, output: 0.60 },
  'command-r-plus': { input: 2.50, output: 10.00 },
  'command-r': { input: 0.15, output: 0.60 },
};

export function estimateCost(modelId, inputTokens, outputTokens) {
  const key = Object.keys(PRICING).find(k => modelId.includes(k));
  if (!key || !inputTokens) return null;
  const p = PRICING[key];
  return (inputTokens * p.input + (outputTokens || 0) * p.output) / 1_000_000;
}

const openaiCompatible = {
  name: 'OpenAI Compatible',
  id: 'openai',
  detectMatch(baseUrl) {
    const h = new URL(baseUrl).hostname;
    return [
      'api.openai.com', 'api.groq.com', 'api.together.xyz',
      'openrouter.ai', 'api.deepseek.com', 'api.moonshot.cn',
      'api.siliconflow.cn', 'api.lingyiwanwu.com', 'api.minimax.chat',
      'api.baichuan-ai.com', 'api.stepfun.com',
    ].some(d => h.includes(d));
  },
  getListModelsConfig(baseUrl, apiKey) {
    const base = baseUrl.replace(/\/+$/, '');
    return {
      url: `${base}/v1/models`,
      method: 'GET',
      headers: { 'Authorization': `Bearer ${apiKey}` },
    };
  },
  parseModelList(json) {
    const data = json.data || json;
    if (!Array.isArray(data)) return [];
    return data.map(m => ({
      id: m.id,
      name: m.id,
      owned_by: m.owned_by || '',
      created: m.created || null,
    }));
  },
  getChatConfig(baseUrl, apiKey, modelId, prompt, stream) {
    const base = baseUrl.replace(/\/+$/, '');
    return {
      url: `${base}/v1/chat/completions`,
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: {
        model: modelId,
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 256,
        stream,
      },
    };
  },
  parseStreamChunk(line) {
    if (line === 'data: [DONE]') return { done: true };
    if (!line.startsWith('data: ')) return null;
    try {
      const json = JSON.parse(line.slice(6));
      const delta = json.choices?.[0]?.delta;
      const finish = json.choices?.[0]?.finish_reason;
      return {
        text: delta?.content || '',
        done: finish === 'stop',
        usage: json.usage || null,
      };
    } catch { return null; }
  },
  parseResponse(json) {
    return {
      text: json.choices?.[0]?.message?.content || '',
      usage: json.usage || null,
    };
  },
};

const gemini = {
  name: 'Google Gemini',
  id: 'gemini',
  detectMatch(baseUrl) {
    return new URL(baseUrl).hostname.includes('generativelanguage.googleapis.com');
  },
  getListModelsConfig(baseUrl, apiKey) {
    return {
      url: `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}&pageSize=100`,
      method: 'GET',
      headers: {},
    };
  },
  parseModelList(json) {
    const models = json.models || [];
    return models
      .filter(m => m.supportedGenerationMethods?.includes('generateContent'))
      .map(m => ({
        id: m.name?.replace('models/', '') || m.name,
        name: m.displayName || m.name,
        owned_by: 'Google',
        created: null,
      }));
  },
  getChatConfig(baseUrl, apiKey, modelId, prompt, stream) {
    const method = stream ? 'streamGenerateContent' : 'generateContent';
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelId}:${method}?key=${apiKey}${stream ? '&alt=sse' : ''}`;
    return {
      url,
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: {
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { maxOutputTokens: 256 },
      },
    };
  },
  parseStreamChunk(line) {
    if (!line.startsWith('data: ')) return null;
    try {
      const json = JSON.parse(line.slice(6));
      const text = json.candidates?.[0]?.content?.parts?.[0]?.text || '';
      const done = json.candidates?.[0]?.finishReason === 'STOP';
      const usage = json.usageMetadata ? {
        prompt_tokens: json.usageMetadata.promptTokenCount,
        completion_tokens: json.usageMetadata.candidatesTokenCount,
        total_tokens: json.usageMetadata.totalTokenCount,
      } : null;
      return { text, done, usage };
    } catch { return null; }
  },
  parseResponse(json) {
    const text = json.candidates?.[0]?.content?.parts?.[0]?.text || '';
    const u = json.usageMetadata;
    return {
      text,
      usage: u ? { prompt_tokens: u.promptTokenCount, completion_tokens: u.candidatesTokenCount } : null,
    };
  },
};

const anthropic = {
  name: 'Anthropic Claude',
  id: 'anthropic',
  detectMatch(baseUrl) {
    return new URL(baseUrl).hostname.includes('api.anthropic.com');
  },
  getListModelsConfig(baseUrl, apiKey) {
    return {
      url: 'https://api.anthropic.com/v1/models',
      method: 'GET',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
    };
  },
  parseModelList(json) {
    const data = json.data || [];
    return data.map(m => ({
      id: m.id,
      name: m.display_name || m.id,
      owned_by: 'Anthropic',
      created: m.created_at || null,
    }));
  },
  getChatConfig(baseUrl, apiKey, modelId, prompt, stream) {
    return {
      url: 'https://api.anthropic.com/v1/messages',
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'Content-Type': 'application/json',
      },
      body: {
        model: modelId,
        max_tokens: 256,
        messages: [{ role: 'user', content: prompt }],
        stream,
      },
    };
  },
  parseStreamChunk(line) {
    if (line.startsWith('event: ')) {
      anthropic._lastEvent = line.slice(7).trim();
      return null;
    }
    if (!line.startsWith('data: ')) return null;
    try {
      const json = JSON.parse(line.slice(6));
      if (json.type === 'content_block_delta') {
        return { text: json.delta?.text || '', done: false };
      }
      if (json.type === 'message_delta') {
        return { text: '', done: json.delta?.stop_reason === 'end_turn', usage: json.usage || null };
      }
      if (json.type === 'message_stop') {
        return { done: true };
      }
      if (json.type === 'message_start' && json.message?.usage) {
        return { text: '', done: false, usage: { prompt_tokens: json.message.usage.input_tokens } };
      }
      return null;
    } catch { return null; }
  },
  parseResponse(json) {
    const text = json.content?.map(c => c.text).join('') || '';
    return {
      text,
      usage: json.usage ? { prompt_tokens: json.usage.input_tokens, completion_tokens: json.usage.output_tokens } : null,
    };
  },
  _lastEvent: '',
};

const cohere = {
  name: 'Cohere',
  id: 'cohere',
  detectMatch(baseUrl) {
    return new URL(baseUrl).hostname.includes('api.cohere.com') ||
           new URL(baseUrl).hostname.includes('api.cohere.ai');
  },
  getListModelsConfig(baseUrl, apiKey) {
    return {
      url: 'https://api.cohere.com/v1/models',
      method: 'GET',
      headers: { 'Authorization': `Bearer ${apiKey}` },
    };
  },
  parseModelList(json) {
    const models = json.models || [];
    return models.map(m => ({
      id: m.name,
      name: m.name,
      owned_by: 'Cohere',
      created: null,
    }));
  },
  getChatConfig(baseUrl, apiKey, modelId, prompt, stream) {
    return {
      url: 'https://api.cohere.com/v2/chat',
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: {
        model: modelId,
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 256,
        stream,
      },
    };
  },
  parseStreamChunk(line) {
    if (!line.startsWith('data: ')) return null;
    try {
      const json = JSON.parse(line.slice(6));
      if (json.type === 'content-delta') {
        return { text: json.delta?.message?.content?.text || '', done: false };
      }
      if (json.type === 'message-end') {
        const u = json.delta?.usage;
        return { text: '', done: true, usage: u ? { prompt_tokens: u.billed_units?.input_tokens, completion_tokens: u.billed_units?.output_tokens } : null };
      }
      return null;
    } catch { return null; }
  },
  parseResponse(json) {
    const text = json.message?.content?.[0]?.text || json.text || '';
    return { text, usage: null };
  },
};

const mistral = {
  name: 'Mistral AI',
  id: 'mistral',
  detectMatch(baseUrl) {
    return new URL(baseUrl).hostname.includes('api.mistral.ai');
  },
  getListModelsConfig(baseUrl, apiKey) {
    return {
      url: 'https://api.mistral.ai/v1/models',
      method: 'GET',
      headers: { 'Authorization': `Bearer ${apiKey}` },
    };
  },
  parseModelList: openaiCompatible.parseModelList,
  getChatConfig(baseUrl, apiKey, modelId, prompt, stream) {
    return {
      url: 'https://api.mistral.ai/v1/chat/completions',
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: {
        model: modelId,
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 256,
        stream,
      },
    };
  },
  parseStreamChunk: openaiCompatible.parseStreamChunk,
  parseResponse: openaiCompatible.parseResponse,
};

const zhipu = {
  name: '智谱 GLM',
  id: 'zhipu',
  detectMatch(baseUrl) {
    return new URL(baseUrl).hostname.includes('open.bigmodel.cn');
  },
  getListModelsConfig(baseUrl, apiKey) {
    return {
      url: 'https://open.bigmodel.cn/api/paas/v4/models',
      method: 'GET',
      headers: { 'Authorization': `Bearer ${apiKey}` },
    };
  },
  parseModelList: openaiCompatible.parseModelList,
  getChatConfig(baseUrl, apiKey, modelId, prompt, stream) {
    return {
      url: 'https://open.bigmodel.cn/api/paas/v4/chat/completions',
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: {
        model: modelId,
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 256,
        stream,
      },
    };
  },
  parseStreamChunk: openaiCompatible.parseStreamChunk,
  parseResponse: openaiCompatible.parseResponse,
};

const dashscope = {
  name: '通义千问 DashScope',
  id: 'dashscope',
  detectMatch(baseUrl) {
    return new URL(baseUrl).hostname.includes('dashscope.aliyuncs.com');
  },
  getListModelsConfig(baseUrl, apiKey) {
    const base = baseUrl.replace(/\/+$/, '');
    return {
      url: `${base}/compatible-mode/v1/models`,
      method: 'GET',
      headers: { 'Authorization': `Bearer ${apiKey}` },
    };
  },
  parseModelList: openaiCompatible.parseModelList,
  getChatConfig(baseUrl, apiKey, modelId, prompt, stream) {
    const base = baseUrl.replace(/\/+$/, '');
    return {
      url: `${base}/compatible-mode/v1/chat/completions`,
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: {
        model: modelId,
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 256,
        stream,
      },
    };
  },
  parseStreamChunk: openaiCompatible.parseStreamChunk,
  parseResponse: openaiCompatible.parseResponse,
};

const providers = [gemini, anthropic, cohere, mistral, zhipu, dashscope, openaiCompatible];

export function detectProvider(baseUrl) {
  try {
    for (const p of providers) {
      if (p.detectMatch(baseUrl)) return p;
    }
  } catch { /* invalid URL */ }
  return openaiCompatible;
}

export function getProviderById(id) {
  return providers.find(p => p.id === id) || openaiCompatible;
}

export function getAllProviders() {
  return providers.map(p => ({ id: p.id, name: p.name }));
}
