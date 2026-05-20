const STORAGE_KEY = 'api_token_key_history';
const MAX_ENTRIES = 50;

export function loadHistory() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
  } catch {
    return [];
  }
}

export function saveTestRun(providerName, baseUrl, results) {
  const history = loadHistory();
  history.unshift({
    timestamp: Date.now(),
    providerName,
    provider: providerName,
    baseUrl,
    results,
  });
  if (history.length > MAX_ENTRIES) history.length = MAX_ENTRIES;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(history));
  return history;
}

export function clearHistory() {
  localStorage.removeItem(STORAGE_KEY);
}

export function exportAsJSON(results) {
  const blob = new Blob([JSON.stringify(results, null, 2)], { type: 'application/json' });
  download(blob, `api-test-results-${dateTag()}.json`);
}

export function exportAsCSV(results) {
  const headers = ['模型', 'TTFT(ms)', '总时间(ms)', 'Tokens/s', '输入Token', '输出Token', '费用($)', '状态', '错误'];
  const rows = results.map(r => [
    r.modelId,
    r.ttft ?? '',
    r.totalTime,
    r.tokensPerSecond,
    r.inputTokens ?? '',
    r.outputTokens ?? '',
    r.estimatedCost != null ? r.estimatedCost.toFixed(4) : '',
    r.status,
    r.error || '',
  ]);
  const csv = [headers, ...rows].map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')).join('\n');
  const bom = '﻿';
  const blob = new Blob([bom + csv], { type: 'text/csv;charset=utf-8' });
  download(blob, `api-test-results-${dateTag()}.csv`);
}

function download(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function dateTag() {
  return new Date().toISOString().slice(0, 19).replace(/[T:]/g, '-');
}
