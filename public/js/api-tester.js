import { estimateCost } from './api-providers.js';

export async function testModel(provider, baseUrl, apiKey, modelId, prompt, onChunk) {
  const config = provider.getChatConfig(baseUrl, apiKey, modelId, prompt, true);

  const startTime = performance.now();
  let ttft = null;
  let fullText = '';
  let usage = null;
  let outputTokenEstimate = 0;

  try {
    const res = await fetch('/api/proxy/stream', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        targetUrl: config.url,
        method: config.method,
        headers: config.headers,
        body: config.body,
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      let errMsg;
      try { errMsg = JSON.parse(errText).error?.message || errText; } catch { errMsg = errText; }
      throw new Error(errMsg.slice(0, 200));
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop();

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;

        const parsed = provider.parseStreamChunk(trimmed);
        if (!parsed) continue;

        if (parsed.text) {
          if (ttft === null) ttft = performance.now() - startTime;
          fullText += parsed.text;
          outputTokenEstimate++;
          if (onChunk) onChunk(parsed.text);
        }
        if (parsed.usage) usage = { ...usage, ...parsed.usage };
        if (parsed.done) break;
      }
    }

    const totalTime = performance.now() - startTime;
    const approxOutputTokens = usage?.completion_tokens || Math.ceil(fullText.length / 3.5);
    const tokensPerSecond = totalTime > 0 ? (approxOutputTokens / (totalTime / 1000)) : 0;
    const cost = estimateCost(
      modelId,
      usage?.prompt_tokens || 15,
      usage?.completion_tokens || approxOutputTokens
    );

    return {
      modelId,
      provider: provider.id,
      timestamp: Date.now(),
      status: 'success',
      error: null,
      ttft: ttft !== null ? Math.round(ttft) : null,
      totalTime: Math.round(totalTime),
      tokensPerSecond: Math.round(tokensPerSecond * 10) / 10,
      inputTokens: usage?.prompt_tokens || null,
      outputTokens: usage?.completion_tokens || approxOutputTokens,
      responsePreview: fullText.slice(0, 300),
      estimatedCost: cost,
    };
  } catch (err) {
    return {
      modelId,
      provider: provider.id,
      timestamp: Date.now(),
      status: 'error',
      error: err.message,
      ttft: null,
      totalTime: Math.round(performance.now() - startTime),
      tokensPerSecond: 0,
      inputTokens: null,
      outputTokens: null,
      responsePreview: '',
      estimatedCost: null,
    };
  }
}

export async function testModelNonStreaming(provider, baseUrl, apiKey, modelId, prompt) {
  const config = provider.getChatConfig(baseUrl, apiKey, modelId, prompt, false);
  const startTime = performance.now();

  try {
    const res = await fetch('/api/proxy', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        targetUrl: config.url,
        method: config.method,
        headers: config.headers,
        body: config.body,
      }),
    });

    const text = await res.text();
    if (!res.ok) throw new Error(text.slice(0, 200));

    const json = JSON.parse(text);
    const parsed = provider.parseResponse(json);
    const totalTime = performance.now() - startTime;
    const approxTokens = parsed.usage?.completion_tokens || Math.ceil(parsed.text.length / 3.5);
    const cost = estimateCost(modelId, parsed.usage?.prompt_tokens || 15, approxTokens);

    return {
      modelId,
      provider: provider.id,
      timestamp: Date.now(),
      status: 'success',
      error: null,
      ttft: null,
      totalTime: Math.round(totalTime),
      tokensPerSecond: Math.round((approxTokens / (totalTime / 1000)) * 10) / 10,
      inputTokens: parsed.usage?.prompt_tokens || null,
      outputTokens: approxTokens,
      responsePreview: parsed.text.slice(0, 300),
      estimatedCost: cost,
    };
  } catch (err) {
    return {
      modelId,
      provider: provider.id,
      timestamp: Date.now(),
      status: 'error',
      error: err.message,
      ttft: null,
      totalTime: Math.round(performance.now() - startTime),
      tokensPerSecond: 0,
      inputTokens: null,
      outputTokens: null,
      responsePreview: '',
      estimatedCost: null,
    };
  }
}

export async function batchTest(provider, baseUrl, apiKey, modelIds, prompt, onProgress, onChunk) {
  const results = [];
  for (let i = 0; i < modelIds.length; i++) {
    if (onProgress) onProgress(i, modelIds.length, modelIds[i]);
    const result = await testModel(provider, baseUrl, apiKey, modelIds[i], prompt, (chunk) => {
      if (onChunk) onChunk(modelIds[i], chunk);
    });
    results.push(result);
    if (i < modelIds.length - 1) {
      await new Promise(r => setTimeout(r, 500));
    }
  }
  if (onProgress) onProgress(modelIds.length, modelIds.length, 'done');
  return results;
}
