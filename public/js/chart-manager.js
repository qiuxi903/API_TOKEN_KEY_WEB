let latencyChart = null;
let throughputChart = null;

const CHART_COLORS = [
  '#6366f1', '#22c55e', '#f97316', '#ec4899', '#8b5cf6', '#ef4444',
];

function getThemeColors() {
  const style = getComputedStyle(document.documentElement);
  return {
    text: style.getPropertyValue('--text-secondary').trim() || '#64748b',
    grid: style.getPropertyValue('--border').trim() || '#e2e8f0',
  };
}

export function updateCharts(results) {
  const successful = results.filter(r => r.status === 'success');
  if (!successful.length) return;

  const theme = getThemeColors();

  if (latencyChart) latencyChart.destroy();
  if (throughputChart) throughputChart.destroy();

  const latencyCtx = document.getElementById('latency-chart');
  const throughputCtx = document.getElementById('throughput-chart');

  const sortedByTime = [...successful].sort((a, b) => a.totalTime - b.totalTime);
  const sortedLabels = sortedByTime.map(r => r.modelId.length > 22 ? r.modelId.slice(0, 20) + '...' : r.modelId);

  latencyChart = new Chart(latencyCtx, {
    type: 'bar',
    data: {
      labels: sortedLabels,
      datasets: [
        {
          label: 'TTFT (ms)',
          data: sortedByTime.map(r => r.ttft),
          backgroundColor: CHART_COLORS[0] + '66',
          borderColor: CHART_COLORS[0],
          borderWidth: 1,
          borderRadius: 4,
        },
        {
          label: 'Total (ms)',
          data: sortedByTime.map(r => r.totalTime),
          backgroundColor: CHART_COLORS[4] + '66',
          borderColor: CHART_COLORS[4],
          borderWidth: 1,
          borderRadius: 4,
        },
      ],
    },
    options: {
      indexAxis: 'y',
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          labels: {
            color: theme.text,
            font: { family: "'Inter', sans-serif", size: 11, weight: 600 },
            boxWidth: 12,
            boxHeight: 12,
            borderRadius: 3,
            useBorderRadius: true,
          },
        },
      },
      scales: {
        x: {
          ticks: { color: theme.text, font: { family: "'JetBrains Mono', monospace", size: 10 } },
          grid: { color: theme.grid + '30' },
        },
        y: {
          ticks: { color: theme.text, font: { family: "'JetBrains Mono', monospace", size: 10 } },
          grid: { display: false },
        },
      },
    },
  });

  latencyCtx.parentElement.style.height = Math.max(220, successful.length * 48) + 'px';

  const sortedByThroughput = [...successful].sort((a, b) => b.tokensPerSecond - a.tokensPerSecond);
  const tpLabels = sortedByThroughput.map(r => r.modelId.length > 22 ? r.modelId.slice(0, 20) + '...' : r.modelId);

  throughputChart = new Chart(throughputCtx, {
    type: 'bar',
    data: {
      labels: tpLabels,
      datasets: [{
        label: 'Tokens/s',
        data: sortedByThroughput.map(r => r.tokensPerSecond),
        backgroundColor: sortedByThroughput.map((_, i) => CHART_COLORS[i % CHART_COLORS.length] + '66'),
        borderColor: sortedByThroughput.map((_, i) => CHART_COLORS[i % CHART_COLORS.length]),
        borderWidth: 1,
        borderRadius: 4,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
      },
      scales: {
        x: {
          ticks: { color: theme.text, font: { family: "'JetBrains Mono', monospace", size: 10 }, maxRotation: 45 },
          grid: { display: false },
        },
        y: {
          ticks: { color: theme.text, font: { family: "'JetBrains Mono', monospace", size: 10 } },
          grid: { color: theme.grid + '30' },
        },
      },
    },
  });

  throughputCtx.parentElement.style.height = Math.max(220, 300) + 'px';
}

export function destroyCharts() {
  if (latencyChart) { latencyChart.destroy(); latencyChart = null; }
  if (throughputChart) { throughputChart.destroy(); throughputChart = null; }
}
