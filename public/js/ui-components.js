export function renderModelCards(models, container, selectedSet, onSelect, onTest) {
  container.innerHTML = '';
  if (!models.length) {
    container.innerHTML = '<p class="empty-state">没有找到模型</p>';
    return;
  }
  for (const model of models) {
    const card = document.createElement('div');
    card.className = 'model-card' + (selectedSet.has(model.id) ? ' selected' : '');
    card.dataset.modelId = model.id;

    card.innerHTML = `
      <div class="model-card-header">
        <div>
          <div class="model-name">${escapeHtml(model.id)}</div>
          ${model.owned_by ? `<div class="model-owner">${escapeHtml(model.owned_by)}</div>` : ''}
        </div>
        <div class="model-card-actions">
          <input type="checkbox" ${selectedSet.has(model.id) ? 'checked' : ''} title="选择">
          <button class="btn-test test-single-btn">TEST</button>
        </div>
      </div>
      <div class="model-card-result" id="card-result-${cssId(model.id)}"></div>
    `;

    const checkbox = card.querySelector('input[type="checkbox"]');
    checkbox.addEventListener('change', () => {
      onSelect(model.id, checkbox.checked);
      card.classList.toggle('selected', checkbox.checked);
    });

    card.querySelector('.test-single-btn').addEventListener('click', (e) => {
      e.stopPropagation();
      onTest(model.id);
    });
    container.appendChild(card);
  }
}

export function updateModelCardResult(modelId, result) {
  const el = document.getElementById(`card-result-${cssId(modelId)}`);
  if (!el) return;
  const card = el.closest('.model-card');
  card.classList.remove('testing', 'success', 'error');
  card.classList.add(result.status);

  if (result.status === 'success') {
    el.innerHTML = `
      <div class="metric"><span class="metric-label">TTFT</span><span class="metric-value">${result.ttft != null ? result.ttft + 'ms' : 'N/A'}</span></div>
      <div class="metric"><span class="metric-label">TOTAL</span><span class="metric-value">${result.totalTime}ms</span></div>
      <div class="metric"><span class="metric-label">SPEED</span><span class="metric-value">${result.tokensPerSecond} t/s</span></div>
      <div class="metric"><span class="metric-label">COST</span><span class="metric-value">${result.estimatedCost != null ? '$' + result.estimatedCost.toFixed(4) : 'N/A'}</span></div>
    `;
  } else {
    el.innerHTML = `<div style="color:var(--red-500);grid-column:1/-1;font-size:0.75rem;font-family:var(--font-mono);">${escapeHtml(result.error?.slice(0, 80) || 'Unknown error')}</div>`;
  }
}

export function setModelCardTesting(modelId) {
  const el = document.getElementById(`card-result-${cssId(modelId)}`);
  if (!el) return;
  const card = el.closest('.model-card');
  card.classList.remove('success', 'error');
  card.classList.add('testing');
  el.innerHTML = '<div style="grid-column:1/-1;color:var(--orange-500);font-family:var(--font-mono);font-size:0.75rem;font-weight:600;">TESTING...</div>';
}

export function renderResultsTable(results, container) {
  if (!results.length) {
    container.innerHTML = '<p class="empty-state">暂无测试结果</p>';
    return;
  }
  const rows = results.map(r => `
    <tr>
      <td><span class="status-dot ${r.status}"></span>${escapeHtml(r.modelId)}</td>
      <td>${r.ttft != null ? r.ttft + ' ms' : 'N/A'}</td>
      <td>${r.totalTime} ms</td>
      <td>${r.tokensPerSecond} tok/s</td>
      <td>${r.inputTokens ?? 'N/A'}</td>
      <td>${r.outputTokens ?? 'N/A'}</td>
      <td>${r.estimatedCost != null ? '$' + r.estimatedCost.toFixed(4) : 'N/A'}</td>
      <td>${r.status === 'success' ? '<span style="color:var(--green-600);font-weight:600">OK</span>' : `<span style="color:var(--red-500)">${escapeHtml(r.error?.slice(0, 40) || 'FAIL')}</span>`}</td>
    </tr>
  `).join('');

  container.innerHTML = `
    <table class="results-table">
      <thead>
        <tr>
          <th>MODEL</th><th>TTFT</th><th>TOTAL</th><th>SPEED</th><th>IN TOKENS</th><th>OUT TOKENS</th><th>COST</th><th>STATUS</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
  `;
}

export function renderStreamPreview(text, container) {
  container.textContent = text;
  container.scrollTop = container.scrollHeight;
}

export function renderHistoryList(history, container, onView) {
  if (!history.length) {
    container.innerHTML = '<p class="empty-state">暂无历史记录</p>';
    return;
  }
  container.innerHTML = '';
  for (const entry of history) {
    const item = document.createElement('div');
    item.className = 'history-item';
    const date = new Date(entry.timestamp).toLocaleString('zh-CN');
    const count = entry.results?.length || 0;
    item.innerHTML = `
      <div class="history-info">
        <span class="history-time">${date}</span>
        <span class="history-provider">${escapeHtml(entry.providerName || entry.provider)}</span>
        <span class="history-models">${count} models tested</span>
      </div>
      <div class="history-actions">
        <button class="btn-outline btn-sm view-btn">VIEW</button>
      </div>
    `;
    item.querySelector('.view-btn').addEventListener('click', () => onView(entry));
    container.appendChild(item);
  }
}

export function showNotification(message, type = 'info') {
  const container = document.getElementById('notification-container');
  const n = document.createElement('div');
  n.className = `notification ${type}`;
  n.textContent = message;
  container.appendChild(n);
  setTimeout(() => { n.style.opacity = '0'; n.style.transition = 'opacity 0.3s'; setTimeout(() => n.remove(), 300); }, 3000);
}

export function updateProgress(current, total, modelId) {
  const text = document.getElementById('progress-text');
  const percent = document.getElementById('progress-percent');
  const fill = document.getElementById('progress-fill');
  const pct = total > 0 ? Math.round((current / total) * 100) : 0;
  text.textContent = current >= total ? 'BENCHMARK COMPLETE' : `Testing: ${modelId} (${current + 1}/${total})`;
  percent.textContent = `${pct}%`;
  fill.style.width = `${pct}%`;
}

function escapeHtml(str) {
  const d = document.createElement('div');
  d.textContent = str;
  return d.innerHTML;
}

function cssId(str) {
  return str.replace(/[^a-zA-Z0-9_-]/g, '_');
}
