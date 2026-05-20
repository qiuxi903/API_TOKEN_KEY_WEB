import { detectProvider, getProviderById, getAllProviders } from './api-providers.js';
import { testModel, batchTest } from './api-tester.js';
import {
  renderModelCards, updateModelCardResult, setModelCardTesting,
  renderResultsTable, renderStreamPreview, renderHistoryList,
  showNotification, updateProgress,
} from './ui-components.js';
import { updateCharts, destroyCharts } from './chart-manager.js';
import { loadHistory, saveTestRun, clearHistory, exportAsJSON, exportAsCSV } from './history-manager.js';

const state = {
  baseUrl: '',
  apiKey: '',
  provider: null,
  models: [],
  selectedModels: new Set(),
  testResults: [],
  isTesting: false,
  activeTab: 'connect',
  redirectMap: {},
};

const $ = id => document.getElementById(id);

function init() {
  populateProviderSelect();
  bindNavigation();
  bindEvents();
  bindRedirect();
  refreshHistory();
  updateFooterDate();
}

function updateFooterDate() {
  const el = $('footer-date');
  if (el) el.textContent = new Date().toISOString().slice(0, 10);
}

/* === Tab / Sidebar Navigation === */
function bindNavigation() {
  document.querySelectorAll('.sidebar-nav .nav-item').forEach(btn => {
    btn.addEventListener('click', () => switchTab(btn.dataset.tab));
  });

  $('sidebar-toggle').addEventListener('click', () => {
    const sidebar = $('sidebar');
    if (window.innerWidth <= 768) {
      sidebar.classList.toggle('mobile-open');
    } else {
      sidebar.classList.toggle('collapsed');
    }
  });

  $('quick-connect-btn')?.addEventListener('click', () => {
    $('base-url').focus();
  });

  $('global-search').addEventListener('input', e => {
    const q = e.target.value.toLowerCase();
    if (state.models.length && q) {
      switchTab('models');
      $('model-search').value = q;
      rerender();
    }
  });
}

function switchTab(tabId) {
  state.activeTab = tabId;
  document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
  document.querySelectorAll('.sidebar-nav .nav-item').forEach(el => el.classList.remove('active'));

  const tab = $(`tab-${tabId}`);
  if (tab) tab.classList.add('active');

  const navBtn = document.querySelector(`.nav-item[data-tab="${tabId}"]`);
  if (navBtn) navBtn.classList.add('active');

  if (window.innerWidth <= 768) {
    $('sidebar').classList.remove('mobile-open');
  }
}

function populateProviderSelect() {
  const sel = $('provider-select');
  for (const p of getAllProviders()) {
    const opt = document.createElement('option');
    opt.value = p.id;
    opt.textContent = p.name;
    sel.appendChild(opt);
  }
}

/* === Events === */
function bindEvents() {
  $('connect-btn').addEventListener('click', handleConnect);
  $('base-url').addEventListener('keydown', e => { if (e.key === 'Enter') handleConnect(); });
  $('api-key').addEventListener('keydown', e => { if (e.key === 'Enter') handleConnect(); });

  $('toggle-key-vis').addEventListener('click', () => {
    const inp = $('api-key');
    inp.type = inp.type === 'password' ? 'text' : 'password';
  });

  $('theme-toggle').addEventListener('click', toggleTheme);

  $('select-all-btn').addEventListener('click', () => {
    state.models.forEach(m => state.selectedModels.add(m.id));
    rerender();
  });
  $('deselect-all-btn').addEventListener('click', () => {
    state.selectedModels.clear();
    rerender();
  });

  $('model-search').addEventListener('input', rerender);
  $('model-sort').addEventListener('change', rerender);

  $('batch-test-btn').addEventListener('click', handleBatchTest);
  $('test-all-btn').addEventListener('click', handleTestAll);

  $('save-history-btn').addEventListener('click', () => {
    if (!state.testResults.length) return;
    saveTestRun(state.provider?.name || 'Unknown', state.baseUrl, state.testResults);
    refreshHistory();
    showNotification('已保存到历史记录', 'success');
  });
  $('export-json-btn').addEventListener('click', () => {
    if (!state.testResults.length) return;
    exportAsJSON(state.testResults);
    showNotification('JSON 已导出', 'success');
  });
  $('export-csv-btn').addEventListener('click', () => {
    if (!state.testResults.length) return;
    exportAsCSV(state.testResults);
    showNotification('CSV 已导出', 'success');
  });
  $('clear-results-btn').addEventListener('click', () => {
    state.testResults = [];
    destroyCharts();
    $('results-table-container').innerHTML = '';
    showNotification('结果已清除', 'info');
  });

  $('clear-history-btn').addEventListener('click', () => {
    clearHistory();
    refreshHistory();
    showNotification('历史记录已清除', 'info');
  });
}

/* === Connection === */
function setHeaderStatus(online, text) {
  const el = $('header-status');
  el.className = `header-status ${online ? 'online' : 'offline'}`;
  el.querySelector('.status-text').textContent = text;

  const led = $('footer-led');
  led.className = `led ${online ? 'led-green' : 'led-red'}`;
  $('footer-status-text').textContent = online ? 'CONNECTED' : 'DISCONNECTED';
}

async function handleConnect() {
  const baseUrl = $('base-url').value.trim();
  const apiKey = $('api-key').value.trim();
  if (!baseUrl || !apiKey) {
    showNotification('请输入 Base URL 和 API Key', 'error');
    return;
  }

  state.baseUrl = baseUrl;
  state.apiKey = apiKey;

  const providerSel = $('provider-select').value;
  state.provider = providerSel === 'auto' ? detectProvider(baseUrl) : getProviderById(providerSel);

  const statusBar = $('connection-status');
  statusBar.className = 'connection-status loading';
  statusBar.textContent = `正在连接 ${state.provider.name}...`;
  statusBar.classList.remove('hidden');
  $('connect-btn').disabled = true;

  try {
    const config = state.provider.getListModelsConfig(baseUrl, apiKey);
    const res = await fetch('/api/proxy', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        targetUrl: config.url,
        method: config.method,
        headers: config.headers,
        body: config.body || null,
      }),
    });

    const text = await res.text();
    if (!res.ok) {
      let msg;
      try { msg = JSON.parse(text).error?.message || text; } catch { msg = text; }
      throw new Error(msg.slice(0, 200));
    }

    const json = JSON.parse(text);
    state.models = state.provider.parseModelList(json);
    state.selectedModels.clear();
    state.testResults = [];

    if (!state.models.length) {
      statusBar.className = 'connection-status error';
      statusBar.textContent = '连接成功，但未找到模型。可能需要手动选择提供商。';
      setHeaderStatus(false, '未找到模型');
    } else {
      statusBar.className = 'connection-status success';
      statusBar.textContent = `已连接 - ${state.provider.name} (${state.models.length} 个模型)`;
      setHeaderStatus(true, `${state.provider.name} · ${state.models.length} 模型`);
    }

    destroyCharts();
    rerender();
    showNotification(`成功获取 ${state.models.length} 个模型`, 'success');

    if (state.models.length) {
      setTimeout(() => switchTab('models'), 500);
    }
  } catch (err) {
    statusBar.className = 'connection-status error';
    statusBar.textContent = `连接失败: ${err.message}`;
    setHeaderStatus(false, '连接失败');
    showNotification(`连接失败: ${err.message}`, 'error');
  } finally {
    $('connect-btn').disabled = false;
  }
}

/* === Model Rendering === */
function rerender() {
  const search = $('model-search').value.toLowerCase();
  const sortBy = $('model-sort').value;

  let filtered = state.models.filter(m =>
    m.id.toLowerCase().includes(search) ||
    (m.owned_by || '').toLowerCase().includes(search)
  );

  filtered.sort((a, b) => a.id.localeCompare(b.id));

  $('model-count').textContent = `${filtered.length} / ${state.models.length} models · ${state.selectedModels.size} selected`;
  $('selected-count').textContent = state.selectedModels.size;

  renderModelCards(
    filtered,
    $('model-grid'),
    state.selectedModels,
    (id, checked) => {
      if (checked) state.selectedModels.add(id);
      else state.selectedModels.delete(id);
      $('selected-count').textContent = state.selectedModels.size;
      $('model-count').textContent = `${filtered.length} / ${state.models.length} models · ${state.selectedModels.size} selected`;
    },
    handleSingleTest,
  );

  for (const r of state.testResults) {
    updateModelCardResult(r.modelId, r);
  }
}

/* === Testing === */
async function handleSingleTest(modelId) {
  if (state.isTesting) {
    showNotification('当前有测试正在运行', 'error');
    return;
  }
  state.isTesting = true;
  setModelCardTesting(modelId);

  switchTab('test');
  const streamSection = $('stream-preview-section');
  const streamPreview = $('stream-preview');
  streamSection.classList.remove('hidden');
  streamPreview.textContent = '';

  const prompt = $('test-prompt').value || "Say 'hello' and then count from 1 to 20, one number per line.";

  const result = await testModel(state.provider, state.baseUrl, state.apiKey, modelId, prompt, (chunk) => {
    renderStreamPreview(streamPreview.textContent + chunk, streamPreview);
  });

  const existingIdx = state.testResults.findIndex(r => r.modelId === modelId);
  if (existingIdx >= 0) state.testResults[existingIdx] = result;
  else state.testResults.push(result);

  updateModelCardResult(modelId, result);
  showResultsPanel();
  state.isTesting = false;

  if (result.status === 'success') {
    showNotification(`${modelId} 测试完成 - ${result.tokensPerSecond} tok/s`, 'success');
  } else {
    showNotification(`${modelId} 测试失败: ${result.error}`, 'error');
  }
}

async function handleBatchTest() {
  const ids = [...state.selectedModels];
  if (!ids.length) {
    showNotification('请先选择要测试的模型', 'error');
    return;
  }
  await runBatch(ids);
}

async function handleTestAll() {
  if (!state.models.length) return;
  await runBatch(state.models.map(m => m.id));
}

async function runBatch(modelIds) {
  if (state.isTesting) {
    showNotification('当前有测试正在运行', 'error');
    return;
  }
  state.isTesting = true;

  switchTab('test');
  const progressContainer = $('progress-container');
  progressContainer.classList.remove('hidden');
  updateProgress(0, modelIds.length, modelIds[0]);

  const streamSection = $('stream-preview-section');
  const streamPreview = $('stream-preview');
  streamSection.classList.remove('hidden');

  $('batch-test-btn').disabled = true;
  $('test-all-btn').disabled = true;

  const prompt = $('test-prompt').value || "Say 'hello' and then count from 1 to 20, one number per line.";

  for (const id of modelIds) {
    setModelCardTesting(id);
  }

  const results = await batchTest(
    state.provider, state.baseUrl, state.apiKey, modelIds, prompt,
    (current, total, id) => {
      updateProgress(current, total, id);
      if (id !== 'done') {
        streamPreview.textContent = '';
      }
    },
    (id, chunk) => {
      renderStreamPreview(streamPreview.textContent + chunk, streamPreview);
    },
  );

  for (const result of results) {
    const existingIdx = state.testResults.findIndex(r => r.modelId === result.modelId);
    if (existingIdx >= 0) state.testResults[existingIdx] = result;
    else state.testResults.push(result);
    updateModelCardResult(result.modelId, result);
  }

  showResultsPanel();
  state.isTesting = false;
  $('batch-test-btn').disabled = false;
  $('test-all-btn').disabled = false;

  const successCount = results.filter(r => r.status === 'success').length;
  showNotification(`批量测试完成: ${successCount}/${results.length} 成功`, successCount > 0 ? 'success' : 'error');
}

function showResultsPanel() {
  switchTab('results');
  renderResultsTable(state.testResults, $('results-table-container'));
  updateCharts(state.testResults);
}

function refreshHistory() {
  const history = loadHistory();
  renderHistoryList(history, $('history-list'), (entry) => {
    state.testResults = entry.results || [];
    showResultsPanel();
    showNotification('已加载历史记录', 'info');
  });
}

/* === Theme === */
function toggleTheme() {
  const html = document.documentElement;
  const isDark = html.getAttribute('data-theme') === 'dark';
  if (isDark) {
    html.removeAttribute('data-theme');
  } else {
    html.setAttribute('data-theme', 'dark');
  }
  $('theme-icon-dark').style.display = isDark ? '' : 'none';
  $('theme-icon-light').style.display = isDark ? 'none' : '';
  if (state.testResults.length) updateCharts(state.testResults);
}

/* === Redirect === */
function bindRedirect() {
  const prefixInput = $('redirect-prefix');
  prefixInput.addEventListener('input', updatePrefixPreview);

  $('redirect-generate-btn').addEventListener('click', generateRedirect);
  $('redirect-template-btn').addEventListener('click', fillTemplate);
  $('redirect-copy-btn').addEventListener('click', copyRedirectJSON);
  $('redirect-copy-models-btn').addEventListener('click', copyChannelModels);
  $('channel-models-copy-btn').addEventListener('click', copyChannelModels);

  $('mode-visual-btn').addEventListener('click', () => setRedirectMode('visual'));
  $('mode-manual-btn').addEventListener('click', () => setRedirectMode('manual'));

  $('redirect-json').addEventListener('input', () => {
    try {
      state.redirectMap = JSON.parse($('redirect-json').value);
      syncChannelModels();
    } catch { /* ignore parse errors while typing */ }
  });
}

function updatePrefixPreview() {
  const prefix = $('redirect-prefix').value;
  const sample = state.models.length ? state.models[0].id : 'gpt-4o';
  $('prefix-preview').textContent = prefix + sample;
  $('prefix-preview-result').textContent = sample;
}

function generateRedirect() {
  if (!state.models.length) {
    showNotification('请先连接 API 获取模型列表', 'error');
    return;
  }
  const prefix = $('redirect-prefix').value;
  if (!prefix) {
    showNotification('请输入自定义前缀', 'error');
    $('redirect-prefix').focus();
    return;
  }

  state.redirectMap = {};
  for (const m of state.models) {
    state.redirectMap[prefix + m.id] = m.id;
  }

  renderRedirectVisual();
  syncRedirectJSON();
  syncChannelModels();
  showNotification(`已生成 ${state.models.length} 条重定向规则`, 'success');
}

function fillTemplate() {
  if (!state.models.length) {
    showNotification('请先连接 API 获取模型列表', 'error');
    return;
  }
  state.redirectMap = {};
  for (const m of state.models) {
    state.redirectMap[m.id] = m.id;
  }
  renderRedirectVisual();
  syncRedirectJSON();
  syncChannelModels();
  showNotification('已填入模板（无前缀），可自行编辑键名', 'info');
}

function renderRedirectVisual() {
  const container = $('redirect-rows');
  const entries = Object.entries(state.redirectMap);
  if (!entries.length) {
    container.innerHTML = '<p class="empty-state">请先连接 API 获取模型列表，然后设置前缀并生成重定向。</p>';
    return;
  }

  container.innerHTML = '';
  for (const [key, val] of entries) {
    const row = document.createElement('div');
    row.className = 'redirect-row';
    row.innerHTML = `
      <input type="text" class="key-input" value="${escHtml(key)}" data-orig-key="${escHtml(key)}">
      <span class="redirect-row-arrow">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
      </span>
      <input type="text" value="${escHtml(val)}">
      <button class="redirect-row-del" title="删除">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
      </button>
    `;

    const keyInput = row.querySelector('.key-input');
    const valInput = row.querySelectorAll('input')[1];

    keyInput.addEventListener('change', () => {
      rebuildMapFromRows();
      syncRedirectJSON();
      syncChannelModels();
    });
    valInput.addEventListener('change', () => {
      rebuildMapFromRows();
      syncRedirectJSON();
      syncChannelModels();
    });

    row.querySelector('.redirect-row-del').addEventListener('click', () => {
      row.remove();
      rebuildMapFromRows();
      syncRedirectJSON();
      syncChannelModels();
    });

    container.appendChild(row);
  }
}

function rebuildMapFromRows() {
  state.redirectMap = {};
  const rows = $('redirect-rows').querySelectorAll('.redirect-row');
  for (const row of rows) {
    const inputs = row.querySelectorAll('input');
    const k = inputs[0].value.trim();
    const v = inputs[1].value.trim();
    if (k && v) state.redirectMap[k] = v;
  }
}

function syncRedirectJSON() {
  $('redirect-json').value = JSON.stringify(state.redirectMap, null, 2);
}

function syncChannelModels() {
  const values = Object.values(state.redirectMap);
  const textarea = $('channel-models-text');
  const countEl = $('channel-models-count');
  if (!values.length) {
    textarea.value = '';
    countEl.textContent = '';
    return;
  }
  const unique = [...new Set(values)];
  textarea.value = unique.join(',');
  countEl.textContent = `共 ${unique.length} 个模型`;
}

function copyRedirectJSON() {
  const json = JSON.stringify(state.redirectMap, null, 2);
  if (!Object.keys(state.redirectMap).length) {
    showNotification('没有可复制的重定向规则', 'error');
    return;
  }
  clipCopy(json, '重定向 JSON 已复制到剪贴板');
}

function copyChannelModels() {
  const values = [...new Set(Object.values(state.redirectMap))];
  if (!values.length) {
    showNotification('没有可复制的模型列表', 'error');
    return;
  }
  clipCopy(values.join(','), '模型列表已复制到剪贴板');
}

function clipCopy(text, msg) {
  navigator.clipboard.writeText(text).then(() => {
    showNotification(msg, 'success');
  }).catch(() => {
    const t = document.createElement('textarea');
    t.value = text;
    document.body.appendChild(t);
    t.select();
    document.execCommand('copy');
    t.remove();
    showNotification(msg, 'success');
  });
}

function setRedirectMode(mode) {
  $('mode-visual-btn').classList.toggle('active', mode === 'visual');
  $('mode-manual-btn').classList.toggle('active', mode === 'manual');
  $('redirect-visual').classList.toggle('hidden', mode !== 'visual');
  $('redirect-manual').classList.toggle('hidden', mode !== 'manual');

  if (mode === 'manual') {
    syncRedirectJSON();
  } else {
    try {
      state.redirectMap = JSON.parse($('redirect-json').value);
    } catch { /* keep existing */ }
    renderRedirectVisual();
  }
}

function escHtml(s) {
  const d = document.createElement('div');
  d.textContent = s;
  return d.innerHTML;
}

document.addEventListener('DOMContentLoaded', init);
