(function () {
  'use strict';

  const inputEl = document.getElementById('cj-input');
  const resultsEl = document.getElementById('cj-results');
  const emptyEl = document.getElementById('cj-empty');
  const themeInputs = document.querySelectorAll('input[name="cj-theme"]');

  const handwritingEl = document.getElementById('handwriting-slot');
  const toggleBtn = document.getElementById('cj-hw-toggle');
  const canvasEl = document.getElementById('cj-canvas');
  const placeholderEl = document.getElementById('cj-canvas-placeholder');
  const undoBtn = document.getElementById('cj-hw-undo');
  const clearBtn = document.getElementById('cj-hw-clear');
  const statusEl = document.getElementById('cj-hw-status');
  const candidatesEl = document.getElementById('cj-hw-candidates');

  const HW_COLLAPSED_KEY = 'handwritingCollapsed';

  const HW_API = 'https://inputtools.google.com/request?ime=handwriting';
  const HW_LANG = 'zh_TW';
  const HW_AREA = 280;
  const HW_DEBOUNCE_MS = 600;
  const HW_MAX_RESULTS = 10;

  let lastPendingTs = 0;

  let strokes = [];
  let currentStroke = null;
  let strokeSessionStart = 0;
  let recognizeTimer = null;
  let recognizeSeq = 0;

  CangjieCore.initTheme(document.documentElement, (current) => {
    for (const input of themeInputs) {
      input.checked = input.value === current;
    }
    redrawCanvas();
  });

  for (const input of themeInputs) {
    input.addEventListener('change', () => {
      if (!input.checked) return;
      chrome.storage.sync.set({ [CangjieCore.THEME_KEY]: input.value });
    });
  }

  function render(text) {
    const html = CangjieCore.renderRowsHtml(text || '');
    resultsEl.innerHTML = html;
    emptyEl.style.display = html ? 'none' : '';
  }

  function applyText(text) {
    inputEl.value = text;
    render(text);
    inputEl.focus();
  }

  inputEl.addEventListener('input', () => {
    render(inputEl.value);
  });

  function inkColor() {
    return getComputedStyle(document.documentElement)
      .getPropertyValue('--cj-ink')
      .trim() || '#222';
  }

  function canvasCtx() {
    return canvasEl.getContext('2d');
  }

  function setupCanvasSize() {
    const dpr = window.devicePixelRatio || 1;
    const rect = canvasEl.getBoundingClientRect();
    const cssW = Math.round(rect.width);
    const cssH = Math.round(rect.height);
    if (cssW === 0 || cssH === 0) return;
    canvasEl.width = cssW * dpr;
    canvasEl.height = cssH * dpr;
    const ctx = canvasCtx();
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    redrawCanvas();
  }

  function applyInkStyle(ctx) {
    ctx.strokeStyle = inkColor();
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
  }

  function redrawCanvas() {
    const ctx = canvasCtx();
    const rect = canvasEl.getBoundingClientRect();
    ctx.clearRect(0, 0, rect.width, rect.height);
    applyInkStyle(ctx);
    for (const stroke of strokes) {
      drawStroke(ctx, stroke);
    }
  }

  function drawStroke(ctx, stroke) {
    if (stroke.length === 0) return;
    ctx.beginPath();
    ctx.moveTo(stroke[0].x, stroke[0].y);
    if (stroke.length === 1) {
      ctx.lineTo(stroke[0].x + 0.01, stroke[0].y + 0.01);
    } else {
      for (let i = 1; i < stroke.length; i++) {
        ctx.lineTo(stroke[i].x, stroke[i].y);
      }
    }
    ctx.stroke();
  }

  function pointFromEvent(ev) {
    const rect = canvasEl.getBoundingClientRect();
    return {
      x: ev.clientX - rect.left,
      y: ev.clientY - rect.top,
      t: performance.now() - strokeSessionStart,
    };
  }

  function updateToolbar() {
    const has = strokes.length > 0 || !!currentStroke;
    placeholderEl.style.display = has ? 'none' : '';
    undoBtn.disabled = strokes.length === 0;
    clearBtn.disabled = strokes.length === 0;
  }

  canvasEl.addEventListener('pointerdown', (ev) => {
    ev.preventDefault();
    try { canvasEl.setPointerCapture(ev.pointerId); } catch {}
    if (strokes.length === 0) {
      strokeSessionStart = performance.now();
    }
    currentStroke = [pointFromEvent(ev)];
    const ctx = canvasCtx();
    applyInkStyle(ctx);
    ctx.beginPath();
    ctx.moveTo(currentStroke[0].x, currentStroke[0].y);
    updateToolbar();
  });

  canvasEl.addEventListener('pointermove', (ev) => {
    if (!currentStroke) return;
    const p = pointFromEvent(ev);
    currentStroke.push(p);
    const ctx = canvasCtx();
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
  });

  function endStroke(ev) {
    if (!currentStroke) return;
    try { canvasEl.releasePointerCapture(ev.pointerId); } catch {}
    if (currentStroke.length === 1) {
      const p = currentStroke[0];
      const ctx = canvasCtx();
      ctx.lineTo(p.x + 0.01, p.y + 0.01);
      ctx.stroke();
    }
    strokes.push(currentStroke);
    currentStroke = null;
    updateToolbar();
    scheduleRecognize();
  }

  canvasEl.addEventListener('pointerup', endStroke);
  canvasEl.addEventListener('pointercancel', endStroke);
  canvasEl.addEventListener('pointerleave', (ev) => {
    if (currentStroke) endStroke(ev);
  });

  function scheduleRecognize() {
    if (recognizeTimer) clearTimeout(recognizeTimer);
    recognizeTimer = setTimeout(runRecognize, HW_DEBOUNCE_MS);
  }

  async function runRecognize() {
    recognizeTimer = null;
    if (strokes.length === 0) {
      renderCandidates([]);
      setStatus('');
      return;
    }
    setStatus('辨識中…');
    const seq = ++recognizeSeq;
    try {
      const list = await recognize(strokes);
      if (seq !== recognizeSeq) return;
      renderCandidates(list);
      setStatus(list.length === 0 ? '無候選字' : '');
    } catch (err) {
      if (seq !== recognizeSeq) return;
      renderCandidates([]);
      setStatus('辨識失敗，可改用系統手寫輸入法', 'error');
    }
  }

  async function recognize(strokesRaw) {
    const rect = canvasEl.getBoundingClientRect();
    const sx = HW_AREA / rect.width;
    const sy = HW_AREA / rect.height;
    const ink = strokesRaw.map((s) => [
      s.map((p) => Math.round(p.x * sx)),
      s.map((p) => Math.round(p.y * sy)),
      s.map((p) => Math.round(p.t)),
    ]);
    const body = {
      options: 'enable_pre_space',
      requests: [{
        writing_guide: { writing_area_width: HW_AREA, writing_area_height: HW_AREA },
        ink,
        language: HW_LANG,
        max_num_results: HW_MAX_RESULTS,
        max_completions: 0,
      }],
    };
    const res = await fetch(HW_API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error('http ' + res.status);
    const json = await res.json();
    if (!Array.isArray(json) || json[0] !== 'SUCCESS') throw new Error('recognize failed');
    return json[1]?.[0]?.[1] ?? [];
  }

  function setStatus(text, state) {
    statusEl.textContent = text;
    if (state) statusEl.setAttribute('data-state', state);
    else statusEl.removeAttribute('data-state');
  }

  function renderCandidates(list) {
    candidatesEl.innerHTML = '';
    for (const ch of list) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'cj-hw-candidate';
      btn.textContent = ch;
      btn.addEventListener('click', () => pickCandidate(ch));
      candidatesEl.appendChild(btn);
    }
  }

  function pickCandidate(ch) {
    inputEl.value = (inputEl.value || '') + ch;
    render(inputEl.value);
    resetCanvas();
    inputEl.focus();
  }

  function resetCanvas() {
    strokes = [];
    currentStroke = null;
    strokeSessionStart = 0;
    if (recognizeTimer) {
      clearTimeout(recognizeTimer);
      recognizeTimer = null;
    }
    recognizeSeq++;
    renderCandidates([]);
    setStatus('');
    redrawCanvas();
    updateToolbar();
  }

  undoBtn.addEventListener('click', () => {
    if (strokes.length === 0) return;
    strokes.pop();
    redrawCanvas();
    updateToolbar();
    if (strokes.length === 0) {
      renderCandidates([]);
      setStatus('');
      if (recognizeTimer) {
        clearTimeout(recognizeTimer);
        recognizeTimer = null;
      }
      recognizeSeq++;
    } else {
      scheduleRecognize();
    }
  });

  clearBtn.addEventListener('click', resetCanvas);

  function applyCollapsed(collapsed) {
    handwritingEl.dataset.collapsed = collapsed ? 'true' : 'false';
    toggleBtn.setAttribute('aria-expanded', collapsed ? 'false' : 'true');
    if (!collapsed) {
      setupCanvasSize();
    }
  }

  toggleBtn.addEventListener('click', () => {
    const collapsed = handwritingEl.dataset.collapsed !== 'true';
    applyCollapsed(collapsed);
    chrome.storage.sync.set({ [HW_COLLAPSED_KEY]: collapsed });
  });

  chrome.storage.sync.get(HW_COLLAPSED_KEY).then((stored) => {
    applyCollapsed(stored[HW_COLLAPSED_KEY] === true);
  }).catch(() => {});

  setupCanvasSize();
  window.addEventListener('resize', setupCanvasSize);
  updateToolbar();

  (async () => {
    try {
      await CangjieCore.loadDict();
    } catch (err) {
      resultsEl.innerHTML = '<div class="cj-error">字典載入失敗</div>';
      return;
    }

    const stored = await chrome.storage.session.get('pendingQuery');
    const pending = stored.pendingQuery;
    if (pending && pending.text) {
      lastPendingTs = pending.ts || 0;
      applyText(pending.text);
      chrome.storage.session.remove('pendingQuery');
    } else {
      render('');
    }
  })();

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'session') return;
    const change = changes.pendingQuery;
    if (!change || !change.newValue) return;
    const { text, ts } = change.newValue;
    if (!text || ts === lastPendingTs) return;
    lastPendingTs = ts;
    applyText(text);
    chrome.storage.session.remove('pendingQuery');
  });
})();
