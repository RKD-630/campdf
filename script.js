/* =========================================================
   SMART PAINT - Full Implementation
   ========================================================= */

// ---------- State ----------
const state = {
  tool: 'pencil',
  fgColor: '#000000',
  bgColor: '#ffffff',
  brushSize: 4,
  brushOpacity: 100,
  smoothing: 50,
  hardness: 100,
  brushType: 'round',
  gradientType: 'solid',
  gradColor1: '#ff0000',
  gradColor2: '#0000ff',
  gradAngle: 90,
  fillStyle: 'stroke',
  zoom: 1,
  panX: 0, panY: 0,
  canvasLocked: false,
  gridOn: false,
  snapGrid: false,
  transparent: false,
  darkMode: false,
  canvasW: 1200,
  canvasH: 800,
  drawing: false,
  startX: 0, startY: 0,
  lastX: 0, lastY: 0,
  points: [],
  layers: [],
  activeLayerIdx: 0,
  history: [],
  historyIdx: -1,
  maxHistory: 50,
  correctionBackup: null,
  curvePoints: [],
  curveStage: 0,
  pressure: 0.5,
};

// ---------- Canvas Setup ----------
const canvasContainer = document.getElementById('canvasContainer');
const mainCanvas = document.getElementById('mainCanvas');
const previewCanvas = document.getElementById('previewCanvas');
const gridCanvas = document.getElementById('gridCanvas');
const mainCtx = mainCanvas.getContext('2d');
const previewCtx = previewCanvas.getContext('2d');
const gridCtx = gridCanvas.getContext('2d');

function initCanvas(w, h) {
  state.canvasW = w; state.canvasH = h;
  [mainCanvas, previewCanvas, gridCanvas].forEach(c => {
    c.width = w; c.height = h;
    c.style.width = w + 'px'; c.style.height = h + 'px';
  });
  canvasContainer.style.width = w + 'px';
  canvasContainer.style.height = h + 'px';
  document.getElementById('statusCanvas').textContent = `Canvas: ${w}×${h}`;
  // Init layer
  if (state.layers.length === 0) {
    state.layers = [{ name: 'Background', visible: true, locked: false, opacity: 100, canvas: createLayerCanvas(w, h) }];
  }
  state.activeLayerIdx = 0;
  renderLayers();
  saveHistory();
  updateZoom();
  drawGrid();
}

function createLayerCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return c;
}

function renderLayers() {
  mainCtx.clearRect(0, 0, state.canvasW, state.canvasH);
  if (!state.transparent) {
    mainCtx.fillStyle = '#ffffff';
    mainCtx.fillRect(0, 0, state.canvasW, state.canvasH);
  }
  for (const layer of state.layers) {
    if (!layer.visible) continue;
    mainCtx.globalAlpha = layer.opacity / 100;
    mainCtx.drawImage(layer.canvas, 0, 0);
  }
  mainCtx.globalAlpha = 1;
  renderLayersList();
}

function renderLayersList() {
  const list = document.getElementById('layersList');
  list.innerHTML = '';
  state.layers.forEach((layer, idx) => {
    const item = document.createElement('div');
    item.className = 'layer-item' + (idx === state.activeLayerIdx ? ' active' : '');
    item.draggable = true;
    
    item.ondragstart = (e) => {
      e.dataTransfer.setData('text/plain', idx);
      e.dataTransfer.effectAllowed = 'move';
      setTimeout(() => item.style.opacity = '0.5', 0);
    };
    item.ondragend = () => {
      item.style.opacity = '1';
    };
    item.ondragover = (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      item.style.borderTop = '2px solid var(--accent)';
    };
    item.ondragleave = (e) => {
      item.style.borderTop = '';
    };
    item.ondrop = (e) => {
      e.preventDefault();
      item.style.borderTop = '';
      const fromIdx = parseInt(e.dataTransfer.getData('text/plain'));
      if (!isNaN(fromIdx) && fromIdx !== idx) {
        moveLayer(fromIdx, idx);
      }
    };

    item.innerHTML = `
      <canvas class="layer-thumb" width="28" height="28"></canvas>
      <span class="layer-name">${layer.name}</span>
      <div class="layer-actions">
        <button onclick="event.stopPropagation();moveLayer(${idx}, ${idx + 1})" title="Move Up">↑</button>
        <button onclick="event.stopPropagation();moveLayer(${idx}, ${idx - 1})" title="Move Down">↓</button>
        <button onclick="event.stopPropagation();toggleLayerVisibility(${idx})">${layer.visible ? '👁' : '⊘'}</button>
        <button onclick="event.stopPropagation();toggleLayerLock(${idx})">${layer.locked ? '🔒' : '🔓'}</button>
      </div>
    `;
    item.onclick = () => { 
      if (state.tool === 'move') rasterizeMove();
      state.activeLayerIdx = idx; 
      renderLayersList(); 
      document.getElementById('layerOpacity').value = layer.opacity; 
      document.getElementById('layerOpacityVal').textContent = layer.opacity; 
    };
    list.appendChild(item);
    const thumb = item.querySelector('canvas');
    const tctx = thumb.getContext('2d');
    tctx.drawImage(layer.canvas, 0, 0, 28, 28);
  });
}

function addLayer() {
  const name = 'Layer ' + (state.layers.length + 1);
  state.layers.push({ name, visible: true, locked: false, opacity: 100, canvas: createLayerCanvas(state.canvasW, state.canvasH) });
  state.activeLayerIdx = state.layers.length - 1;
  renderLayers();
  saveHistory();
}

function deleteLayer() {
  if (state.layers.length <= 1) return alert('Cannot delete last layer');
  state.layers.splice(state.activeLayerIdx, 1);
  state.activeLayerIdx = Math.max(0, state.activeLayerIdx - 1);
  renderLayers();
  saveHistory();
}

function moveLayer(fromIdx, toIdx) {
  if (toIdx < 0 || toIdx >= state.layers.length) return;
  const layer = state.layers.splice(fromIdx, 1)[0];
  state.layers.splice(toIdx, 0, layer);
  
  if (state.activeLayerIdx === fromIdx) {
    state.activeLayerIdx = toIdx;
  } else if (fromIdx < state.activeLayerIdx && toIdx >= state.activeLayerIdx) {
    state.activeLayerIdx--;
  } else if (fromIdx > state.activeLayerIdx && toIdx <= state.activeLayerIdx) {
    state.activeLayerIdx++;
  }
  
  renderLayers();
  saveHistory();
}

function toggleLayerVisibility(idx) {
  state.layers[idx].visible = !state.layers[idx].visible;
  renderLayers();
}

function toggleLayerLock(idx) {
  state.layers[idx].locked = !state.layers[idx].locked;
  renderLayersList();
}

function updateLayerOpacity(v) {
  state.layers[state.activeLayerIdx].opacity = +v;
  document.getElementById('layerOpacityVal').textContent = v;
  renderLayers();
}

// ---------- History ----------
function saveHistory() {
  const snap = state.layers.map(l => ({ ...l, canvas: cloneCanvas(l.canvas) }));
  state.history = state.history.slice(0, state.historyIdx + 1);
  state.history.push({ layers: snap, tool: state.tool });
  if (state.history.length > state.maxHistory) state.history.shift();
  state.historyIdx = state.history.length - 1;
}

function cloneCanvas(c) {
  const n = createLayerCanvas(c.width, c.height);
  n.getContext('2d').drawImage(c, 0, 0);
  return n;
}

function undo() {
  if (state.historyIdx > 0) {
    state.historyIdx--;
    restoreHistory();
  }
}

function redo() {
  if (state.historyIdx < state.history.length - 1) {
    state.historyIdx++;
    restoreHistory();
  }
}

function restoreHistory() {
  const snap = state.history[state.historyIdx];
  const layers = Array.isArray(snap) ? snap : snap.layers;
  state.layers = layers.map(l => ({ ...l, canvas: cloneCanvas(l.canvas) }));
  state.activeLayerIdx = Math.min(state.activeLayerIdx, state.layers.length - 1);
  renderLayers();
}

function getUndoBrushSource() {
  for (let i = state.historyIdx; i >= 0; i--) {
    const snap = state.history[i];
    if (snap.tool && snap.tool !== 'eraser' && snap.tool !== 'undo-brush') {
      return snap.layers[state.activeLayerIdx].canvas;
    }
  }
  const oldest = state.history[0];
  if (!oldest) return null;
  const layers = Array.isArray(oldest) ? oldest : oldest.layers;
  return layers[state.activeLayerIdx] ? layers[state.activeLayerIdx].canvas : null;
}

// ---------- Drawing ----------
function getActiveCtx() {
  return state.layers[state.activeLayerIdx].canvas.getContext('2d');
}

function getPos(e) {
  const rect = mainCanvas.getBoundingClientRect();
  const scaleX = state.canvasW / rect.width;
  const scaleY = state.canvasH / rect.height;
  let x, y, pressure = 0.5;
  if (e.touches && e.touches.length > 0) {
    x = (e.touches[0].clientX - rect.left) * scaleX;
    y = (e.touches[0].clientY - rect.top) * scaleY;
    pressure = e.touches[0].force || 0.5;
  } else if (e.changedTouches && e.changedTouches.length > 0) {
    x = (e.changedTouches[0].clientX - rect.left) * scaleX;
    y = (e.changedTouches[0].clientY - rect.top) * scaleY;
    pressure = e.changedTouches[0].force || 0.5;
  } else {
    x = (e.clientX - rect.left) * scaleX;
    y = (e.clientY - rect.top) * scaleY;
    pressure = e.pressure || 0.5;
  }
  return { x, y, pressure };
}

function makeStrokeStyle(ctx) {
  if (state.gradientType === 'linear') {
    const rad = state.gradAngle * Math.PI / 180;
    const len = Math.max(state.canvasW, state.canvasH);
    const cx = state.canvasW / 2, cy = state.canvasH / 2;
    const g = ctx.createLinearGradient(
      cx - Math.cos(rad) * len, cy - Math.sin(rad) * len,
      cx + Math.cos(rad) * len, cy + Math.sin(rad) * len
    );
    g.addColorStop(0, state.gradColor1);
    g.addColorStop(1, state.gradColor2);
    return g;
  } else if (state.gradientType === 'radial') {
    const g = ctx.createRadialGradient(state.canvasW/2, state.canvasH/2, 0, state.canvasW/2, state.canvasH/2, Math.max(state.canvasW, state.canvasH)/2);
    g.addColorStop(0, state.gradColor1);
    g.addColorStop(1, state.gradColor2);
    return g;
  }
  return state.fgColor;
}

function setupCtx(ctx) {
  ctx.globalAlpha = state.brushOpacity / 100;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  
  if (state.tool === 'brush') {
    if (state.brushType === 'square') {
      ctx.lineCap = 'butt';
      ctx.lineJoin = 'miter';
    } else if (state.brushType === 'marker') {
      ctx.globalAlpha = (state.brushOpacity / 100) * 0.5;
      ctx.globalCompositeOperation = 'multiply';
    } else if (state.brushType === 'highlighter') {
      ctx.lineCap = 'butt';
      ctx.globalAlpha = (state.brushOpacity / 100) * 0.3;
      ctx.globalCompositeOperation = 'multiply';
    }
  }

  ctx.strokeStyle = makeStrokeStyle(ctx);
  ctx.fillStyle = ctx.strokeStyle; // sync fill with stroke
  ctx.lineWidth = state.brushSize;
}

// ---------- Pointer Events ----------
function onPointerDown(e) {
  if (e.touches && e.touches.length > 1) return; // pan/zoom
  e.preventDefault();
  const layer = state.layers[state.activeLayerIdx];
  if (layer.locked) return;
  const { x, y, pressure } = getPos(e);
  state.drawing = true;
  state.startX = x; state.startY = y;
  state.lastX = x; state.lastY = y;
  state.points = [{ x, y, pressure }];
  state.pressure = pressure;
  const ctx = getActiveCtx();

  if (state.tool === 'pencil' || state.tool === 'brush' || state.tool === 'airbrush' || state.tool === 'eraser' || state.tool === 'undo-brush') {
    if (state.tool === 'undo-brush') {
      const src = getUndoBrushSource();
      if (src) {
        const tmp = createLayerCanvas(state.canvasW, state.canvasH);
        const tCtx = tmp.getContext('2d');
        setupCtx(tCtx);
        tCtx.beginPath();
        tCtx.arc(x, y, state.brushSize/2, 0, Math.PI*2);
        tCtx.fill();
        tCtx.globalCompositeOperation = 'source-in';
        tCtx.drawImage(src, 0, 0);
        ctx.globalCompositeOperation = 'source-over';
        ctx.drawImage(tmp, 0, 0);
        renderLayers();
      }
    } else {
      setupCtx(ctx);
      if (state.tool === 'eraser') {
        ctx.globalCompositeOperation = 'destination-out';
        ctx.strokeStyle = 'rgba(0,0,0,1)';
      } else {
        ctx.globalCompositeOperation = 'source-over';
      }
      ctx.beginPath();
      if (state.tool === 'airbrush' || (state.tool === 'brush' && state.brushType === 'airbrush')) {
        sprayAt(ctx, x, y);
      } else {
        ctx.arc(x, y, state.brushSize/2, 0, Math.PI*2);
        ctx.fill();
      }
      renderLayers();
    }
  } else if (state.tool === 'fill') {
    floodFill(Math.floor(x), Math.floor(y), state.fgColor);
    renderLayers();
    saveHistory();
    state.drawing = false;
  } else if (state.tool === 'picker') {
    pickColor(x, y);
    state.drawing = false;
  } else if (state.tool === 'text') {
    state.drawing = false;
  } else if (state.tool === 'move') {
    if (state.selection) {
      state.selectionDragging = true;
      state.dragOffsetX = x - state.selection.x;
      state.dragOffsetY = y - state.selection.y;
      return;
    }
    
    if (state.moveCanvas) {
      const s = 10 / state.zoom;
      const sx = state.moveRect.x, sy = state.moveRect.y, sw = state.moveRect.w, sh = state.moveRect.h;
      
      if (Math.abs(x - sx) <= s && Math.abs(y - sy) <= s) state.moveResizing = 'tl';
      else if (Math.abs(x - (sx + sw)) <= s && Math.abs(y - sy) <= s) state.moveResizing = 'tr';
      else if (Math.abs(x - sx) <= s && Math.abs(y - (sy + sh)) <= s) state.moveResizing = 'bl';
      else if (Math.abs(x - (sx + sw)) <= s && Math.abs(y - (sy + sh)) <= s) state.moveResizing = 'br';
      else if (Math.abs(x - (sx + sw/2)) <= s && Math.abs(y - sy) <= s) state.moveResizing = 't';
      else if (Math.abs(x - (sx + sw/2)) <= s && Math.abs(y - (sy + sh)) <= s) state.moveResizing = 'b';
      else if (Math.abs(x - sx) <= s && Math.abs(y - (sy + sh/2)) <= s) state.moveResizing = 'l';
      else if (Math.abs(x - (sx + sw)) <= s && Math.abs(y - (sy + sh/2)) <= s) state.moveResizing = 'r';
      else if (x >= sx && x <= sx + sw && y >= sy && y <= sy + sh) {
        state.moveDragging = true;
        state.dragOffsetX = x - sx;
        state.dragOffsetY = y - sy;
      } else {
        rasterizeMove();
      }
      if (state.moveResizing || state.moveDragging) return;
    }

    if (!state.moveCanvas) {
      const tmp = document.createElement('canvas');
      tmp.width = state.canvasW; tmp.height = state.canvasH;
      tmp.getContext('2d').drawImage(layer.canvas, 0, 0);
      state.moveCanvas = tmp;
      state.moveRect = { x: 0, y: 0, w: state.canvasW, h: state.canvasH };
      getActiveCtx().clearRect(0, 0, state.canvasW, state.canvasH);
      renderLayers();
    }
    
    state.dragOffsetX = x - state.moveRect.x;
    state.dragOffsetY = y - state.moveRect.y;
    state.moveDragging = true;
    drawMovePreview();
  } else if (state.tool === 'freehand' || state.tool === 'lasso') {
    if (state.tool === 'lasso' && state.selection) {
      if (x >= state.selection.x && x <= state.selection.x + state.selection.w &&
          y >= state.selection.y && y <= state.selection.y + state.selection.h) {
        state.selectionDragging = true;
        state.dragOffsetX = x - state.selection.x;
        state.dragOffsetY = y - state.selection.y;
        return;
      } else {
        rasterizeSelection();
      }
    }
    state.selectionDragging = false;
    state.points = [{ x, y }];
  } else if (state.tool === 'crop' || state.tool === 'select') {
    if (state.tool === 'select' && state.selection) {
      const s = 10 / state.zoom;
      const sx = state.selection.x, sy = state.selection.y, sw = state.selection.w, sh = state.selection.h;
      
      if (Math.abs(x - sx) <= s && Math.abs(y - sy) <= s) {
        state.selectionResizing = 'tl';
      } else if (Math.abs(x - (sx + sw)) <= s && Math.abs(y - sy) <= s) {
        state.selectionResizing = 'tr';
      } else if (Math.abs(x - sx) <= s && Math.abs(y - (sy + sh)) <= s) {
        state.selectionResizing = 'bl';
      } else if (Math.abs(x - (sx + sw)) <= s && Math.abs(y - (sy + sh)) <= s) {
        state.selectionResizing = 'br';
      } else if (Math.abs(x - (sx + sw/2)) <= s && Math.abs(y - sy) <= s) {
        state.selectionResizing = 't';
      } else if (Math.abs(x - (sx + sw/2)) <= s && Math.abs(y - (sy + sh)) <= s) {
        state.selectionResizing = 'b';
      } else if (Math.abs(x - sx) <= s && Math.abs(y - (sy + sh/2)) <= s) {
        state.selectionResizing = 'l';
      } else if (Math.abs(x - (sx + sw)) <= s && Math.abs(y - (sy + sh/2)) <= s) {
        state.selectionResizing = 'r';
      } else if (x >= sx && x <= sx + sw && y >= sy && y <= sy + sh) {
        state.selectionDragging = true;
        state.dragOffsetX = x - sx;
        state.dragOffsetY = y - sy;
        return;
      } else {
        rasterizeSelection();
      }
    }
    state.selectionDragging = false;
    state.selectionResizing = false;
    state.startX = x; state.startY = y;
  } else if (state.tool === 'perspective-crop') {
    if (state.perspectiveQuad) {
      const s = 10 / state.zoom;
      for (let i = 0; i < 4; i++) {
        if (Math.abs(x - state.perspectiveQuad[i].x) <= s && Math.abs(y - state.perspectiveQuad[i].y) <= s) {
          state.perspectiveDragging = i;
          return;
        }
      }
    }
    state.perspectiveDragging = -1;
    state.startX = x; state.startY = y;
  } else if (state.tool === 'curve') {
    if (!state.curveStage) state.curveStage = 0;
    if (state.curveStage === 0) {
      state.curveP1 = { x, y };
      state.curveStage = 1;
    } else if (state.curveStage === 1) {
      state.curveCp = { x, y };
      state.curveStage = 2;
    }
  }
}

function onPointerMove(e) {
  if (!state.drawing) {
    const { x, y } = getPos(e);
    document.getElementById('statusPos').textContent = `X: ${Math.floor(x)}, Y: ${Math.floor(y)}`;
    return;
  }
  e.preventDefault();
  const { x, y, pressure } = getPos(e);
  state.pressure = pressure;
  const ctx = getActiveCtx();

  if (state.tool === 'pencil' || (state.tool === 'brush' && state.brushType !== 'airbrush') || state.tool === 'eraser' || state.tool === 'undo-brush') {
    const smooth = state.smoothing / 100;
    const tx = state.lastX + (x - state.lastX) * (1 - smooth * 0.85);
    const ty = state.lastY + (y - state.lastY) * (1 - smooth * 0.85);
    state.points.push({ x: tx, y: ty, pressure });
    state.lastX = tx; state.lastY = ty;

    if (state.points.length >= 3) {
      const p1 = state.points[state.points.length - 3];
      const p2 = state.points[state.points.length - 2];
      const p3 = state.points[state.points.length - 1];
      const mid1 = { x: (p1.x + p2.x)/2, y: (p1.y + p2.y)/2 };
      const mid2 = { x: (p2.x + p3.x)/2, y: (p2.y + p3.y)/2 };
      
      if (state.tool === 'undo-brush') {
        const src = getUndoBrushSource();
        if (src) {
          const tmp = createLayerCanvas(state.canvasW, state.canvasH);
          const tCtx = tmp.getContext('2d');
          setupCtx(tCtx);
          tCtx.lineWidth = state.brushSize * (0.5 + pressure);
          tCtx.beginPath();
          tCtx.moveTo(mid1.x, mid1.y);
          tCtx.quadraticCurveTo(p2.x, p2.y, mid2.x, mid2.y);
          tCtx.stroke();
          tCtx.globalCompositeOperation = 'source-in';
          tCtx.drawImage(src, 0, 0);
          ctx.globalCompositeOperation = 'source-over';
          ctx.drawImage(tmp, 0, 0);
        }
      } else {
        setupCtx(ctx);
        if (state.tool === 'eraser') {
          ctx.globalCompositeOperation = 'destination-out';
          ctx.strokeStyle = 'rgba(0,0,0,1)';
        }
        ctx.lineWidth = state.brushSize * (0.5 + pressure);
        ctx.beginPath();
        ctx.moveTo(mid1.x, mid1.y);
        ctx.quadraticCurveTo(p2.x, p2.y, mid2.x, mid2.y);
        ctx.stroke();
      }
    }
    renderLayers();
  } else if (state.tool === 'airbrush' || (state.tool === 'brush' && state.brushType === 'airbrush')) {
    sprayAt(ctx, x, y);
    renderLayers();
  } else if (['select', 'lasso', 'move'].includes(state.tool) && state.selectionDragging) {
    state.selection.x = x - state.dragOffsetX;
    state.selection.y = y - state.dragOffsetY;
    drawSelectionPreview();
  } else if (state.tool === 'select' && state.selectionResizing) {
    if (state.selectionResizing === 'tl') {
      state.selection.w += state.selection.x - x;
      state.selection.h += state.selection.y - y;
      state.selection.x = x;
      state.selection.y = y;
    } else if (state.selectionResizing === 'tr') {
      state.selection.w = x - state.selection.x;
      state.selection.h += state.selection.y - y;
      state.selection.y = y;
    } else if (state.selectionResizing === 'bl') {
      state.selection.w += state.selection.x - x;
      state.selection.x = x;
      state.selection.h = y - state.selection.y;
    } else if (state.selectionResizing === 'br') {
      state.selection.w = x - state.selection.x;
      state.selection.h = y - state.selection.y;
    } else if (state.selectionResizing === 't') {
      state.selection.h += state.selection.y - y;
      state.selection.y = y;
    } else if (state.selectionResizing === 'b') {
      state.selection.h = y - state.selection.y;
    } else if (state.selectionResizing === 'l') {
      state.selection.w += state.selection.x - x;
      state.selection.x = x;
    } else if (state.selectionResizing === 'r') {
      state.selection.w = x - state.selection.x;
    }
    drawSelectionPreview();
  } else if (state.tool === 'perspective-crop') {
    previewCtx.clearRect(0, 0, state.canvasW, state.canvasH);
    if (state.perspectiveDragging !== -1) {
      state.perspectiveQuad[state.perspectiveDragging].x = x;
      state.perspectiveQuad[state.perspectiveDragging].y = y;
    } else {
      state.perspectiveQuad = [
        { x: state.startX, y: state.startY },
        { x: x, y: state.startY },
        { x: x, y: y },
        { x: state.startX, y: y }
      ];
    }
    drawPerspectivePreview();
  } else if (state.tool === 'freehand' || state.tool === 'lasso') {
    state.points.push({ x, y });
    previewCtx.clearRect(0, 0, state.canvasW, state.canvasH);
    setupCtx(previewCtx);
    if (state.tool === 'lasso') {
      previewCtx.setLineDash([5, 5]);
      previewCtx.strokeStyle = 'blue';
      previewCtx.lineWidth = 1;
    }
    previewCtx.beginPath();
    previewCtx.moveTo(state.points[0].x, state.points[0].y);
    for (let i = 1; i < state.points.length; i++) previewCtx.lineTo(state.points[i].x, state.points[i].y);
    if (state.tool === 'lasso') previewCtx.closePath();
    previewCtx.stroke();
    if (state.tool === 'lasso') previewCtx.setLineDash([]);
  } else if (state.tool === 'move' && state.moveCanvas) {
    if (state.moveResizing) {
      if (state.moveResizing === 'tl') {
        state.moveRect.w += state.moveRect.x - x;
        state.moveRect.h += state.moveRect.y - y;
        state.moveRect.x = x;
        state.moveRect.y = y;
      } else if (state.moveResizing === 'tr') {
        state.moveRect.w = x - state.moveRect.x;
        state.moveRect.h += state.moveRect.y - y;
        state.moveRect.y = y;
      } else if (state.moveResizing === 'bl') {
        state.moveRect.w += state.moveRect.x - x;
        state.moveRect.x = x;
        state.moveRect.h = y - state.moveRect.y;
      } else if (state.moveResizing === 'br') {
        state.moveRect.w = x - state.moveRect.x;
        state.moveRect.h = y - state.moveRect.y;
      } else if (state.moveResizing === 't') {
        state.moveRect.h += state.moveRect.y - y;
        state.moveRect.y = y;
      } else if (state.moveResizing === 'b') {
        state.moveRect.h = y - state.moveRect.y;
      } else if (state.moveResizing === 'l') {
        state.moveRect.w += state.moveRect.x - x;
        state.moveRect.x = x;
      } else if (state.moveResizing === 'r') {
        state.moveRect.w = x - state.moveRect.x;
      }
    } else if (state.moveDragging) {
      state.moveRect.x = x - state.dragOffsetX;
      state.moveRect.y = y - state.dragOffsetY;
    }
    drawMovePreview();
  } else if (state.tool === 'select' && !state.selectionDragging) {
    // handled below together with crop
  } else if (state.tool === 'crop' || (state.tool === 'select' && !state.selectionDragging)) {
    previewCtx.clearRect(0, 0, state.canvasW, state.canvasH);
    previewCtx.setLineDash([5, 5]);
    previewCtx.strokeStyle = state.tool === 'crop' ? 'rgba(0,0,0,0.8)' : 'blue';
    previewCtx.lineWidth = 1;
    previewCtx.strokeRect(state.startX, state.startY, x - state.startX, y - state.startY);
    previewCtx.setLineDash([]);
  } else if (state.tool === 'curve') {
    previewCtx.clearRect(0, 0, state.canvasW, state.canvasH);
    setupCtx(previewCtx);
    previewCtx.beginPath();
    previewCtx.moveTo(state.curveP1.x, state.curveP1.y);
    if (state.curveStage === 1) {
      previewCtx.lineTo(x, y);
    } else if (state.curveStage === 2) {
      previewCtx.quadraticCurveTo(x, y, state.curveP2.x, state.curveP2.y);
    }
    applyFillStroke(previewCtx);
  } else if (['line','rect','rrect','circle','ellipse','triangle','isosceles','acute-triangle','right-triangle','diamond','quad','parallelogram','pentagon','hexagon','star','arrow','polygon','cone','cylinder','cube','semi-circle','arch'].includes(state.tool)) {
    previewCtx.clearRect(0, 0, state.canvasW, state.canvasH);
    setupCtx(previewCtx);
    drawShapePreview(previewCtx, state.startX, state.startY, x, y);
  }
}

function onPointerUp(e) {
  if (!state.drawing) return;
  state.drawing = false;
  const ctx = getActiveCtx();
  ctx.globalCompositeOperation = 'source-over';
  const { x, y } = getPos(e);

  if (['line','rect','rrect','circle','ellipse','triangle','isosceles','acute-triangle','right-triangle','diamond','quad','parallelogram','pentagon','hexagon','star','arrow','polygon','cone','cylinder','cube','semi-circle','arch'].includes(state.tool)) {
    previewCtx.clearRect(0, 0, state.canvasW, state.canvasH);
    setupCtx(ctx);
    drawShapeFinal(ctx, state.startX, state.startY, x, y);
    saveHistory();
  } else if (state.tool === 'freehand') {
    previewCtx.clearRect(0, 0, state.canvasW, state.canvasH);
    setupCtx(ctx);
    recognizeAndDraw(ctx);
    saveHistory();
  } else if (state.tool === 'lasso') {
    if (state.selectionDragging) {
      state.selectionDragging = false;
      saveHistory();
    } else {
      previewCtx.clearRect(0, 0, state.canvasW, state.canvasH);
      if (state.points.length > 2) {
        let minX = state.canvasW, minY = state.canvasH, maxX = 0, maxY = 0;
        state.points.forEach(p => {
          if (p.x < minX) minX = p.x;
          if (p.x > maxX) maxX = p.x;
          if (p.y < minY) minY = p.y;
          if (p.y > maxY) maxY = p.y;
        });
        const w = maxX - minX, h = maxY - minY;
        if (w > 5 && h > 5) {
          const layerCanvas = state.layers[state.activeLayerIdx].canvas;
          const selCanvas = createLayerCanvas(w, h);
          const sCtx = selCanvas.getContext('2d');
          
          sCtx.beginPath();
          sCtx.moveTo(state.points[0].x - minX, state.points[0].y - minY);
          for (let i = 1; i < state.points.length; i++) sCtx.lineTo(state.points[i].x - minX, state.points[i].y - minY);
          sCtx.closePath();
          sCtx.clip();
          sCtx.drawImage(layerCanvas, minX, minY, w, h, 0, 0, w, h);
          
          ctx.save();
          ctx.beginPath();
          ctx.moveTo(state.points[0].x, state.points[0].y);
          for (let i = 1; i < state.points.length; i++) ctx.lineTo(state.points[i].x, state.points[i].y);
          ctx.closePath();
          ctx.clip();
          ctx.clearRect(0, 0, state.canvasW, state.canvasH);
          ctx.restore();
          
          state.selection = { canvas: selCanvas, x: minX, y: minY, w, h };
          drawSelectionPreview();
          saveHistory();
        }
      }
    }
  } else if (state.tool === 'move' && state.selectionDragging) {
    state.selectionDragging = false;
    saveHistory();
  } else if (state.tool === 'move' && state.moveCanvas) {
    if (state.moveResizing || state.moveDragging) {
      state.moveResizing = false;
      state.moveDragging = false;
      if (state.moveRect.w < 0) { state.moveRect.x += state.moveRect.w; state.moveRect.w = Math.abs(state.moveRect.w); }
      if (state.moveRect.h < 0) { state.moveRect.y += state.moveRect.h; state.moveRect.h = Math.abs(state.moveRect.h); }
      drawMovePreview();
    }
  } else if (state.tool === 'crop') {
    previewCtx.clearRect(0, 0, state.canvasW, state.canvasH);
    const minX = Math.min(state.startX, x), minY = Math.min(state.startY, y);
    const w = Math.abs(x - state.startX), h = Math.abs(y - state.startY);
    if (w > 10 && h > 10) {
      document.getElementById('resizeW').value = Math.floor(w);
      document.getElementById('resizeH').value = Math.floor(h);
      const newLayers = state.layers.map(l => {
        const nc = createLayerCanvas(w, h);
        nc.getContext('2d').drawImage(l.canvas, -minX, -minY);
        return { ...l, canvas: nc };
      });
      state.canvasW = w; state.canvasH = h;
      state.layers = newLayers;
      [mainCanvas, previewCanvas, gridCanvas].forEach(c => {
        c.width = w; c.height = h; c.style.width = w + 'px'; c.style.height = h + 'px';
      });
      canvasContainer.style.width = w + 'px'; canvasContainer.style.height = h + 'px';
      document.getElementById('statusCanvas').textContent = `Canvas: ${w}×${h}`;
      renderLayers(); updateZoom(); drawGrid(); saveHistory();
      showPopup('✂️ Cropped. Please check if "Transparent BG" button is not "ON"');
    }
    document.querySelector('.tool-btn[data-tool="pencil"]')?.click();
  } else if (state.tool === 'perspective-crop') {
    if (state.perspectiveDragging !== -1) {
      state.perspectiveDragging = -1;
    } else {
      document.getElementById('perspectiveToolbar').style.display = 'flex';
    }
  } else if (state.tool === 'select') {
    if (state.selectionDragging || state.selectionResizing) {
      state.selectionDragging = false;
      state.selectionResizing = false;
      // fix negative width/height
      if (state.selection.w < 0) { state.selection.x += state.selection.w; state.selection.w = Math.abs(state.selection.w); }
      if (state.selection.h < 0) { state.selection.y += state.selection.h; state.selection.h = Math.abs(state.selection.h); }
      drawSelectionPreview();
      saveHistory();
    } else {
      const minX = Math.min(state.startX, x), minY = Math.min(state.startY, y);
      const w = Math.abs(x - state.startX), h = Math.abs(y - state.startY);
      if (w > 5 && h > 5) {
        const layerCanvas = state.layers[state.activeLayerIdx].canvas;
        const selCanvas = createLayerCanvas(w, h);
        selCanvas.getContext('2d').drawImage(layerCanvas, minX, minY, w, h, 0, 0, w, h);
        ctx.clearRect(minX, minY, w, h);
        state.selection = { canvas: selCanvas, x: minX, y: minY, w: w, h: h };
        drawSelectionPreview();
        updateSelectionToolbar();
        saveHistory();
      }
    }
  } else if (state.tool === 'curve') {
    if (state.curveStage === 1) {
      state.curveP2 = { x, y };
      previewCtx.clearRect(0, 0, state.canvasW, state.canvasH);
      setupCtx(previewCtx);
      previewCtx.beginPath();
      previewCtx.moveTo(state.curveP1.x, state.curveP1.y);
      previewCtx.lineTo(state.curveP2.x, state.curveP2.y);
      applyFillStroke(previewCtx);
    } else if (state.curveStage === 2) {
      state.curveCp = { x, y };
      previewCtx.clearRect(0, 0, state.canvasW, state.canvasH);
      setupCtx(ctx);
      ctx.beginPath();
      ctx.moveTo(state.curveP1.x, state.curveP1.y);
      ctx.quadraticCurveTo(state.curveCp.x, state.curveCp.y, state.curveP2.x, state.curveP2.y);
      applyFillStroke(ctx);
      state.curveStage = 0;
      saveHistory();
    }
  } else if (state.tool === 'pencil' || state.tool === 'brush' || state.tool === 'airbrush' || state.tool === 'eraser' || state.tool === 'undo-brush') {
    if (state.points.length >= 2 && state.tool !== 'airbrush' && !(state.tool === 'brush' && state.brushType === 'airbrush')) {
      const p1 = state.points[state.points.length - 2];
      const p2 = state.points[state.points.length - 1];
      const mid = { x: (p1.x + p2.x)/2, y: (p1.y + p2.y)/2 };
      
      if (state.tool === 'undo-brush') {
        const src = getUndoBrushSource();
        if (src) {
          const tmp = createLayerCanvas(state.canvasW, state.canvasH);
          const tCtx = tmp.getContext('2d');
          setupCtx(tCtx);
          tCtx.beginPath();
          tCtx.moveTo(mid.x, mid.y);
          tCtx.lineTo(p2.x, p2.y);
          tCtx.stroke();
          tCtx.globalCompositeOperation = 'source-in';
          tCtx.drawImage(src, 0, 0);
          ctx.globalCompositeOperation = 'source-over';
          ctx.drawImage(tmp, 0, 0);
        }
      } else {
        setupCtx(ctx);
        if (state.tool === 'eraser') {
          ctx.globalCompositeOperation = 'destination-out';
          ctx.strokeStyle = 'rgba(0,0,0,1)';
        }
        ctx.beginPath();
        ctx.moveTo(mid.x, mid.y);
        ctx.lineTo(p2.x, p2.y);
        ctx.stroke();
      }
    }
    saveHistory();
  }
  renderLayers();
}

function sprayAt(ctx, x, y) {
  const density = state.brushSize * 2;
  const radius = state.brushSize * 2;
  ctx.fillStyle = state.fgColor;
  for (let i = 0; i < density; i++) {
    const angle = Math.random() * Math.PI * 2;
    const r = Math.random() * radius;
    ctx.fillRect(x + Math.cos(angle) * r, y + Math.sin(angle) * r, 1, 1);
  }
}

// ---------- Shape Drawing ----------
function drawShapePreview(ctx, x1, y1, x2, y2) {
  ctx.beginPath();
  if (state.tool === 'freehand') {
    // Just show points
    ctx.arc(x2, y2, 2, 0, Math.PI * 2);
    ctx.fill();
    return;
  }
  drawShapePath(ctx, x1, y1, x2, y2);
  applyFillStroke(ctx, x1, y1, x2, y2);
}

function drawShapeFinal(ctx, x1, y1, x2, y2) {
  if (state.tool === 'freehand') {
    // Smart shape recognition
    recognizeAndDraw(ctx);
    return;
  }
  ctx.beginPath();
  drawShapePath(ctx, x1, y1, x2, y2);
  applyFillStroke(ctx, x1, y1, x2, y2);
}

function drawShapePath(ctx, x1, y1, x2, y2) {
  const w = x2 - x1, h = y2 - y1;
  const cx = (x1 + x2) / 2, cy = (y1 + y2) / 2;
  const rx = Math.min(x1, x2), ry = Math.min(y1, y2);
  const wid = Math.abs(w), hgt = Math.abs(h);

  switch (state.tool) {
    case 'line':
      ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); break;
    case 'rect':
      ctx.rect(x1, y1, w, h); break;
    case 'rrect': {
      const r = Math.min(Math.abs(w), Math.abs(h)) * 0.2;
      roundRect(ctx, x1, y1, w, h, r); break;
    }
    case 'circle': {
      const r = Math.min(Math.abs(w), Math.abs(h)) / 2;
      ctx.arc(cx, cy, r, 0, Math.PI * 2); break;
    }
    case 'ellipse':
      ctx.ellipse(cx, cy, Math.abs(w)/2, Math.abs(h)/2, 0, 0, Math.PI * 2); break;
    case 'triangle':
    case 'isosceles':
      ctx.moveTo(cx, ry); ctx.lineTo(rx + wid, ry + hgt); ctx.lineTo(rx, ry + hgt); ctx.closePath(); break;
    case 'acute-triangle':
      ctx.moveTo(rx + wid*0.3, ry); ctx.lineTo(rx + wid, ry + hgt); ctx.lineTo(rx, ry + hgt); ctx.closePath(); break;
    case 'right-triangle':
      ctx.moveTo(rx, ry); ctx.lineTo(rx, ry + hgt); ctx.lineTo(rx + wid, ry + hgt); ctx.closePath(); break;
    case 'diamond':
      ctx.moveTo(cx, ry); ctx.lineTo(rx + wid, cy); ctx.lineTo(cx, ry + hgt); ctx.lineTo(rx, cy); ctx.closePath(); break;
    case 'parallelogram': {
      const off = wid * 0.25;
      ctx.moveTo(rx + off, ry); ctx.lineTo(rx + wid, ry); ctx.lineTo(rx + wid - off, ry + hgt); ctx.lineTo(rx, ry + hgt); ctx.closePath(); break;
    }
    case 'semi-circle':
      ctx.arc(cx, ry + hgt, wid/2, Math.PI, 0); ctx.closePath(); break;
    case 'arch':
      ctx.moveTo(rx, ry + hgt); ctx.lineTo(rx, cy); ctx.arc(cx, cy, wid/2, Math.PI, 0); ctx.lineTo(rx + wid, ry + hgt); ctx.closePath(); break;
    case 'cone': {
      const ch = Math.min(hgt*0.15, wid/4);
      ctx.ellipse(cx, ry + hgt - ch, wid/2, ch, 0, 0, Math.PI * 2);
      ctx.moveTo(rx, ry + hgt - ch); ctx.lineTo(cx, ry); ctx.lineTo(rx + wid, ry + hgt - ch);
      break;
    }
    case 'cylinder': {
      const ch = Math.min(hgt*0.15, wid/4);
      ctx.ellipse(cx, ry + ch, wid/2, ch, 0, 0, Math.PI * 2);
      ctx.moveTo(rx, ry + ch); ctx.lineTo(rx, ry + hgt - ch);
      ctx.ellipse(cx, ry + hgt - ch, wid/2, ch, 0, Math.PI, 0, true);
      ctx.lineTo(rx + wid, ry + ch);
      break;
    }
    case 'cube': {
      const off = Math.min(wid, hgt) * 0.25;
      ctx.moveTo(rx + off, ry); ctx.lineTo(rx + wid, ry); ctx.lineTo(rx + wid, ry + hgt - off);
      ctx.lineTo(rx + wid - off, ry + hgt); ctx.lineTo(rx, ry + hgt); ctx.lineTo(rx, ry + off); ctx.closePath();
      ctx.moveTo(rx, ry + off); ctx.lineTo(rx + wid - off, ry + off); ctx.lineTo(rx + wid - off, ry + hgt);
      ctx.moveTo(rx + wid - off, ry + off); ctx.lineTo(rx + wid, ry);
      break;
    }
    case 'quad': {
      const off = Math.min(Math.abs(w), Math.abs(h)) * 0.3;
      ctx.moveTo(x1 + off, y1); ctx.lineTo(x2, y1); ctx.lineTo(x2 - off, y2); ctx.lineTo(x1, y2); ctx.closePath(); break;
    }
    case 'pentagon': polygon(ctx, cx, cy, Math.min(Math.abs(w), Math.abs(h))/2, 5, -Math.PI/2); break;
    case 'hexagon': polygon(ctx, cx, cy, Math.min(Math.abs(w), Math.abs(h))/2, 6, -Math.PI/2); break;
    case 'star': star(ctx, cx, cy, Math.min(Math.abs(w), Math.abs(h))/2, 5); break;
    case 'arrow': drawArrow(ctx, x1, y1, x2, y2); break;
    case 'polygon': polygon(ctx, cx, cy, Math.min(Math.abs(w), Math.abs(h))/2, 8, 0); break;
  }
}

function roundRect(ctx, x, y, w, h, r) {
  const signW = w < 0 ? -1 : 1, signH = h < 0 ? -1 : 1;
  const aw = Math.abs(w), ah = Math.abs(h);
  r = Math.min(r, aw/2, ah/2);
  ctx.moveTo(x + (signW>0?r:aw-r), y);
  ctx.arcTo(x + aw, y, x + aw, y + ah, r);
  ctx.arcTo(x + aw, y + ah, x, y + ah, r);
  ctx.arcTo(x, y + ah, x, y, r);
  ctx.arcTo(x, y, x + aw, y, r);
  ctx.closePath();
}

function polygon(ctx, cx, cy, r, sides, startAngle) {
  for (let i = 0; i < sides; i++) {
    const a = startAngle + (i * 2 * Math.PI / sides);
    const x = cx + Math.cos(a) * r, y = cy + Math.sin(a) * r;
    if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  }
  ctx.closePath();
}

function star(ctx, cx, cy, r, points) {
  const inner = r * 0.4;
  for (let i = 0; i < points * 2; i++) {
    const a = -Math.PI/2 + (i * Math.PI / points);
    const rad = i % 2 === 0 ? r : inner;
    const x = cx + Math.cos(a) * rad, y = cy + Math.sin(a) * rad;
    if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  }
  ctx.closePath();
}

function drawArrow(ctx, x1, y1, x2, y2) {
  const head = Math.max(10, state.brushSize * 3);
  const angle = Math.atan2(y2 - y1, x2 - x1);
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.moveTo(x2, y2);
  ctx.lineTo(x2 - head * Math.cos(angle - Math.PI/6), y2 - head * Math.sin(angle - Math.PI/6));
  ctx.moveTo(x2, y2);
  ctx.lineTo(x2 - head * Math.cos(angle + Math.PI/6), y2 - head * Math.sin(angle + Math.PI/6));
}

function applyFillStroke(ctx, x1, y1, x2, y2) {
  if (state.fillStyle === 'fill' || state.fillStyle === 'both') {
    ctx.fill();
  }
  if (state.fillStyle === 'stroke' || state.fillStyle === 'both') {
    ctx.stroke();
  }
}

// ---------- Smart Shape Recognition ----------
function recognizeAndDraw(ctx) {
  const pts = state.points;
  if (pts.length < 5) {
    // Too few points - just draw line
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
    ctx.stroke();
    return;
  }

  const shape = analyzeShape(pts);
  let shapeName = 'Freehand';

  ctx.beginPath();
  if (shape.type === 'line') {
    ctx.moveTo(pts[0].x, pts[0].y);
    ctx.lineTo(pts[pts.length-1].x, pts[pts.length-1].y);
    shapeName = 'Line';
  } else if (shape.type === 'circle') {
    ctx.arc(shape.cx, shape.cy, shape.r, 0, Math.PI * 2);
    shapeName = 'Circle';
  } else if (shape.type === 'halfcircle') {
    ctx.arc(shape.cx, shape.cy, shape.r, shape.angle + (shape.sign > 0 ? 0 : Math.PI), shape.angle + (shape.sign > 0 ? Math.PI : 2*Math.PI));
    shapeName = 'Half Circle';
  } else if (shape.type === 'halfmoon') {
    const { p1, p2, pts, cx, cy } = shape;
    let maxDevPt = pts[0], maxD = 0;
    for(const p of pts) {
      const d = pointToLineDist(p, p1, p2);
      if (d > maxD) { maxD = d; maxDevPt = p; }
    }
    const cpOutX = 2 * maxDevPt.x - cx;
    const cpOutY = 2 * maxDevPt.y - cy;
    const innerPeakX = cx + (maxDevPt.x - cx) * 0.4;
    const innerPeakY = cy + (maxDevPt.y - cy) * 0.4;
    const cpInX = 2 * innerPeakX - cx;
    const cpInY = 2 * innerPeakY - cy;

    ctx.moveTo(p1.x, p1.y);
    ctx.quadraticCurveTo(cpOutX, cpOutY, p2.x, p2.y);
    ctx.quadraticCurveTo(cpInX, cpInY, p1.x, p1.y);
    ctx.closePath();
    shapeName = 'Half Moon';
  } else if (shape.type === 'ellipse') {
    ctx.ellipse(shape.cx, shape.cy, shape.rx, shape.ry, shape.rot || 0, 0, Math.PI * 2);
    shapeName = 'Ellipse';
  } else if (shape.type === 'rectangle') {
    ctx.rect(shape.x, shape.y, shape.w, shape.h);
    shapeName = 'Rectangle';
  } else if (shape.type === 'square') {
    ctx.rect(shape.x, shape.y, shape.s, shape.s);
    shapeName = 'Box / Square';
  } else if (shape.type === 'triangle') {
    ctx.moveTo(shape.p1.x, shape.p1.y);
    ctx.lineTo(shape.p2.x, shape.p2.y);
    ctx.lineTo(shape.p3.x, shape.p3.y);
    ctx.closePath();
    shapeName = 'Triangle';
  } else if (shape.type === 'bird') {
    ctx.moveTo(shape.p1.x, shape.p1.y);
    ctx.lineTo(shape.p2.x, shape.p2.y);
    ctx.lineTo(shape.p3.x, shape.p3.y);
    shapeName = 'Bird';
  } else if (shape.type === 'star') {
    star(ctx, shape.cx, shape.cy, shape.r, 5);
    shapeName = 'Star';
  } else if (shape.type === 'pentagon') {
    polygon(ctx, shape.cx, shape.cy, shape.r, 5, -Math.PI/2);
    shapeName = 'Pentagon';
  } else if (shape.type === 'hexagon') {
    polygon(ctx, shape.cx, shape.cy, shape.r, 6, -Math.PI/2);
    shapeName = 'Hexagon';
  } else if (shape.type === 'polygon') {
    ctx.moveTo(shape.pts[0].x, shape.pts[0].y);
    for (let i = 1; i < shape.pts.length; i++) ctx.lineTo(shape.pts[i].x, shape.pts[i].y);
    ctx.closePath();
    if (shape.pts.length === 4) shapeName = 'Polygun (Quad)';
    else if (shape.pts.length === 5) shapeName = 'Home (Polygun)';
    else if (shape.pts.length >= 7) shapeName = 'Arrow (Polygun)';
    else shapeName = 'Polygun';
  } else {
    // Smooth freehand
    smoothDraw(ctx, pts);
    shapeName = 'Smoothed Curve';
  }
  applyFillStroke(ctx);

  if (shape.type !== 'freehand') {
    showPopup(`✨ Shape Corrected: ${shapeName}`);
    state.correctionBackup = { type: shape.type };
  }
}

function analyzeShape(pts) {
  // Compute bounding box
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const p of pts) {
    if (p.x < minX) minX = p.x; if (p.y < minY) minY = p.y;
    if (p.x > maxX) maxX = p.x; if (p.y > maxY) maxY = p.y;
  }
  const w = maxX - minX, h = maxY - minY;
  const cx = (minX + maxX) / 2, cy = (minY + maxY) / 2;

  // Check if closed
  const first = pts[0], last = pts[pts.length - 1];
  const dist = Math.hypot(last.x - first.x, last.y - first.y);
  const perimeter = Math.max(w, h) * 4;
  const closed = dist < perimeter * 0.3;

  // Check line-ness (deviation from straight line)
  const lineLen = Math.hypot(last.x - first.x, last.y - first.y);
  let maxDev = 0, totalDev = 0;
  for (const p of pts) {
    const d = pointToLineDist(p, first, last);
    if (d > maxDev) maxDev = d;
    totalDev += d;
  }
  const avgDev = totalDev / pts.length;
  if (lineLen > 20 && maxDev < lineLen * 0.1 && avgDev < lineLen * 0.05) {
    return { type: 'line' };
  }

  if (!closed) {
    if (lineLen > 20) {
      const openCorners = findCorners(pts);
      if (openCorners.length === 1) {
        return { type: 'bird', p1: pts[0], p2: openCorners[0], p3: pts[pts.length-1] };
      }

      let pathLen = 0;
      for (let i = 1; i < pts.length; i++) pathLen += Math.hypot(pts[i].x - pts[i-1].x, pts[i].y - pts[i-1].y);
      const expectedArc = (Math.PI / 2) * lineLen;
      if (pathLen > lineLen * 1.05 && pathLen < expectedArc * 1.5) {
        if (Math.abs(maxDev - (lineLen / 2)) < lineLen * 0.4) {
          let avgSign = 0;
          const dx = last.x - first.x, dy = last.y - first.y;
          for(const p of pts) {
            avgSign += Math.sign((p.x - first.x)*dy - (p.y - first.y)*dx);
          }
          const sign = avgSign > 0 ? 1 : -1;
          const angle = Math.atan2(dy, dx);
          return { type: 'halfcircle', cx: first.x + dx/2, cy: first.y + dy/2, r: lineLen/2, angle, sign };
        }
      }
    }
    return { type: 'freehand' };
  }

  // Check circularity
  let sumR = 0;
  for (const p of pts) sumR += Math.hypot(p.x - cx, p.y - cy);
  const avgR = sumR / pts.length;
  let variance = 0;
  for (const p of pts) {
    const r = Math.hypot(p.x - cx, p.y - cy);
    variance += (r - avgR) ** 2;
  }
  variance = Math.sqrt(variance / pts.length);
  const circularity = variance / avgR;

  if (circularity < 0.1 && w > 20 && h > 20) {
    const ratio = Math.min(w, h) / Math.max(w, h);
    if (ratio > 0.9) {
      return { type: 'circle', cx, cy, r: avgR };
    } else {
      return { type: 'ellipse', cx, cy, rx: w/2, ry: h/2, rot: 0 };
    }
  }

  // Detect corners using angle changes
  const corners = findCorners(pts);

  if (corners.length === 2) {
    const p1 = corners[0], p2 = corners[1];
    const d = Math.hypot(p2.x - p1.x, p2.y - p1.y);
    if (d > 20) return { type: 'halfmoon', p1, p2, pts, cx, cy };
  }

  if (corners.length === 3) {
    return { type: 'triangle', p1: corners[0], p2: corners[1], p3: corners[2] };
  }
  if (corners.length === 4) {
    // Check if rectangle/square
    const sides = [];
    for (let i = 0; i < 4; i++) {
      sides.push(Math.hypot(corners[(i+1)%4].x - corners[i].x, corners[(i+1)%4].y - corners[i].y));
    }
    const maxSide = Math.max(...sides), minSide = Math.min(...sides);
    if (maxSide / minSide < 1.15) {
      const s = (maxSide + minSide) / 2;
      const x = Math.min(...corners.map(c=>c.x)), y = Math.min(...corners.map(c=>c.y));
      return { type: 'square', x, y, s };
    } else {
      const x = Math.min(...corners.map(c=>c.x)), y = Math.min(...corners.map(c=>c.y));
      return { type: 'rectangle', x, y, w: maxX - minX, h: maxY - minY };
    }
  }
  
  if (corners.length === 5) {
    const ratio = Math.min(w, h) / Math.max(w, h);
    if (ratio > 0.8) return { type: 'pentagon', cx, cy, r: Math.min(w, h)/2 };
    return { type: 'polygon', pts: corners }; // Home shape
  }

  if (corners.length === 6) {
    const ratio = Math.min(w, h) / Math.max(w, h);
    if (ratio > 0.8) return { type: 'hexagon', cx, cy, r: Math.min(w, h)/2 };
    return { type: 'polygon', pts: corners };
  }

  if (corners.length >= 8) {
    return { type: 'star', cx, cy, r: Math.min(w, h)/2 };
  }

  if (corners.length >= 4) {
    return { type: 'polygon', pts: corners };
  }

  return { type: 'freehand' };
}

function pointToLineDist(p, a, b) {
  const dx = b.x - a.x, dy = b.y - a.y;
  const len2 = dx*dx + dy*dy;
  if (len2 === 0) return Math.hypot(p.x - a.x, p.y - a.y);
  let t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(p.x - (a.x + t*dx), p.y - (a.y + t*dy));
}

function findCorners(pts) {
  // Simplify using RDP-like approach
  const simplified = simplifyPath(pts, 5);
  // Find sharpest angles
  const angles = [];
  for (let i = 1; i < simplified.length - 1; i++) {
    const a = simplified[i-1], b = simplified[i], c = simplified[i+1];
    const v1 = { x: a.x - b.x, y: a.y - b.y };
    const v2 = { x: c.x - b.x, y: c.y - b.y };
    const dot = v1.x*v2.x + v1.y*v2.y;
    const m1 = Math.hypot(v1.x, v1.y), m2 = Math.hypot(v2.x, v2.y);
    const cos = dot / (m1 * m2);
    const angle = Math.acos(Math.max(-1, Math.min(1, cos)));
    angles.push({ idx: i, angle, pt: b });
  }
  angles.sort((a, b) => a.angle - b.angle);
  // Take top corners with minimum separation
  const corners = [];
  for (const a of angles) {
    if (a.angle < Math.PI * 0.7) {
      let ok = true;
      for (const c of corners) {
        if (Math.abs(c.idx - a.idx) < pts.length * 0.1) { ok = false; break; }
      }
      if (ok) corners.push(a);
      if (corners.length >= 6) break;
    }
  }
  return corners.map(c => c.pt);
}

function simplifyPath(pts, tolerance) {
  if (pts.length < 3) return pts;
  let maxDist = 0, idx = 0;
  const start = pts[0], end = pts[pts.length - 1];
  for (let i = 1; i < pts.length - 1; i++) {
    const d = pointToLineDist(pts[i], start, end);
    if (d > maxDist) { maxDist = d; idx = i; }
  }
  if (maxDist > tolerance) {
    const left = simplifyPath(pts.slice(0, idx + 1), tolerance);
    const right = simplifyPath(pts.slice(idx), tolerance);
    return left.slice(0, -1).concat(right);
  }
  return [start, end];
}

function smoothDraw(ctx, pts) {
  if (pts.length < 2) return;
  ctx.moveTo(pts[0].x, pts[0].y);
  for (let i = 1; i < pts.length - 1; i++) {
    const xc = (pts[i].x + pts[i+1].x) / 2;
    const yc = (pts[i].y + pts[i+1].y) / 2;
    ctx.quadraticCurveTo(pts[i].x, pts[i].y, xc, yc);
  }
  const last = pts[pts.length - 1];
  ctx.lineTo(last.x, last.y);
}

// ---------- Flood Fill ----------
function floodFill(startX, startY, fillColor) {
  const layer = state.layers[state.activeLayerIdx];
  const ctx = layer.canvas.getContext('2d');
  const imgData = ctx.getImageData(0, 0, state.canvasW, state.canvasH);
  const data = imgData.data;
  const w = state.canvasW, h = state.canvasH;

  const idx = (startY * w + startX) * 4;
  const startR = data[idx], startG = data[idx+1], startB = data[idx+2], startA = data[idx+3];

  // Parse fill color
  const tmp = document.createElement('canvas').getContext('2d');
  tmp.fillStyle = fillColor;
  tmp.fillRect(0, 0, 1, 1);
  const px = tmp.getImageData(0, 0, 1, 1).data;
  const fillR = px[0], fillG = px[1], fillB = px[2], fillA = px[3];

  if (startR === fillR && startG === fillG && startB === fillB && startA === fillA) return;

  const stack = [[startX, startY]];
  const visited = new Uint8Array(w * h);
  const tolerance = 20;

  function matches(i) {
    return Math.abs(data[i] - startR) <= tolerance &&
           Math.abs(data[i+1] - startG) <= tolerance &&
           Math.abs(data[i+2] - startB) <= tolerance &&
           Math.abs(data[i+3] - startA) <= tolerance;
  }

  while (stack.length) {
    const [x, y] = stack.pop();
    if (x < 0 || x >= w || y < 0 || y >= h) continue;
    const pos = y * w + x;
    if (visited[pos]) continue;
    const i = pos * 4;
    if (!matches(i)) continue;
    visited[pos] = 1;
    data[i] = fillR; data[i+1] = fillG; data[i+2] = fillB; data[i+3] = fillA;
    stack.push([x+1, y], [x-1, y], [x, y+1], [x, y-1]);
  }
  ctx.putImageData(imgData, 0, 0);
}

// ---------- Color Picker ----------
function pickColor(x, y) {
  const px = mainCtx.getImageData(Math.floor(x), Math.floor(y), 1, 1).data;
  const hex = '#' + [px[0], px[1], px[2]].map(v => v.toString(16).padStart(2, '0')).join('');
  setFgColor(hex);
  showPopup(`🎨 Picked: ${hex}`);
}

// ---------- Text Tool ----------
let activeTextNode = null;
function setActiveTextNode(node) {
  activeTextNode = node;
  const bar = document.getElementById('textFormatBar');
  if (node) {
    bar.classList.add('show');
    document.getElementById('tfFont').value = node.style.fontFamily.replace(/"/g, '') || 'Arial';
    document.getElementById('tfSize').value = parseInt(node.style.fontSize) || 16;
    document.getElementById('tfColor').value = rgbToHex(node.style.color) || '#000000';
    document.getElementById('tfBold').style.background = (node.style.fontWeight === 'bold') ? 'var(--hover)' : '';
    document.getElementById('tfItalic').style.background = (node.style.fontStyle === 'italic') ? 'var(--hover)' : '';
    document.getElementById('tfUnderline').style.background = (node.style.textDecoration === 'underline') ? 'var(--hover)' : '';
    
    if (node.dataset.gradient) {
      document.getElementById('tfColorType').value = 'gradient';
      try {
        const g = JSON.parse(node.dataset.gradient);
        document.getElementById('tfGrad1').value = g.c1 || '#ff0000';
        document.getElementById('tfGrad2').value = g.c2 || '#0000ff';
        document.getElementById('tfGradAngle').value = g.a || 90;
      } catch(e) {}
    } else {
      document.getElementById('tfColorType').value = 'solid';
    }
    toggleTextGradientUI();
  } else {
    bar.classList.remove('show');
  }
}

function updateActiveText(prop, val) {
  if (activeTextNode) {
    if (prop === 'color') {
      activeTextNode.style.backgroundImage = '';
      activeTextNode.style.webkitBackgroundClip = '';
      activeTextNode.style.webkitTextFillColor = '';
      delete activeTextNode.dataset.gradient;
    }
    activeTextNode.style[prop] = val;
    if (prop === 'fontWeight') document.getElementById('tfBold').style.background = (val === 'bold') ? 'var(--hover)' : '';
    if (prop === 'fontStyle') document.getElementById('tfItalic').style.background = (val === 'italic') ? 'var(--hover)' : '';
    if (prop === 'textDecoration') document.getElementById('tfUnderline').style.background = (val === 'underline') ? 'var(--hover)' : '';
  }
}

function toggleActiveText(prop, activeVal, defaultVal) {
  if (activeTextNode) {
    const current = activeTextNode.style[prop];
    updateActiveText(prop, (current === activeVal) ? defaultVal : activeVal);
  }
}

function toggleTextGradientUI() {
  const type = document.getElementById('tfColorType').value;
  if (type === 'gradient') {
    document.getElementById('tfSolidOpts').style.display = 'none';
    document.getElementById('tfGradOpts').style.display = 'flex';
    applyGradientToText();
  } else {
    document.getElementById('tfSolidOpts').style.display = 'flex';
    document.getElementById('tfGradOpts').style.display = 'none';
    if (activeTextNode) updateActiveText('color', document.getElementById('tfColor').value);
  }
}

function applyGradientToText() {
  if (activeTextNode) {
    const c1 = document.getElementById('tfGrad1').value;
    const c2 = document.getElementById('tfGrad2').value;
    const angle = document.getElementById('tfGradAngle').value;
    const bg = `linear-gradient(${angle}deg, ${c1}, ${c2})`;
    activeTextNode.style.backgroundImage = bg;
    activeTextNode.style.webkitBackgroundClip = 'text';
    activeTextNode.style.webkitTextFillColor = 'transparent';
    activeTextNode.dataset.gradient = JSON.stringify({
      c1: c1,
      c2: c2,
      a: angle
    });
  }
}

function applyWordArt(val) {
  if (!activeTextNode) return;
  activeTextNode.dataset.wordart = val;
  
  if (val === 'none') {
    activeTextNode.style.textShadow = 'none';
    activeTextNode.style.webkitTextStroke = '0';
    activeTextNode.style.backgroundImage = 'none';
    activeTextNode.style.webkitTextFillColor = 'initial';
  } else if (val === 'wa1') {
    activeTextNode.style.backgroundImage = 'linear-gradient(90deg, red, orange, yellow, green, blue, indigo, violet)';
    activeTextNode.style.webkitBackgroundClip = 'text';
    activeTextNode.style.webkitTextFillColor = 'transparent';
    activeTextNode.style.textShadow = '2px 2px 4px rgba(0,0,0,0.5)';
    activeTextNode.style.webkitTextStroke = '1px black';
  } else if (val === 'wa2') {
    activeTextNode.style.backgroundImage = 'none';
    activeTextNode.style.webkitTextFillColor = '#00aaff';
    activeTextNode.style.textShadow = '1px 1px 0 #0055aa, 2px 2px 0 #0055aa, 3px 3px 0 #0055aa, 4px 4px 0 #0055aa, 5px 5px 0 #0055aa, 6px 6px 5px rgba(0,0,0,0.5)';
    activeTextNode.style.webkitTextStroke = '0';
  } else if (val === 'wa3') {
    activeTextNode.style.backgroundImage = 'none';
    activeTextNode.style.webkitTextFillColor = '#ffff00';
    activeTextNode.style.webkitTextStroke = '2px #ff0000';
    activeTextNode.style.textShadow = '3px 3px 0px #880000';
  } else if (val === 'wa4') {
    activeTextNode.style.backgroundImage = 'linear-gradient(180deg, #ffffff 0%, #aaaaaa 45%, #222222 50%, #888888 100%)';
    activeTextNode.style.webkitBackgroundClip = 'text';
    activeTextNode.style.webkitTextFillColor = 'transparent';
    activeTextNode.style.webkitTextStroke = '1px black';
    activeTextNode.style.textShadow = '2px 2px 2px rgba(0,0,0,0.8)';
  }
  activeTextNode.focus();
}

function fillBackgroundGradient() {
  const layer = state.layers[state.activeLayerIdx];
  const ctx = layer.canvas.getContext('2d');
  
  if (state.gradientType === 'solid') {
    ctx.fillStyle = state.fgColor;
  } else {
    let grad;
    if (state.gradientType === 'linear') {
      const angleRad = state.gradAngle * Math.PI / 180;
      const x1 = state.canvasW/2 - Math.cos(angleRad) * state.canvasW/2;
      const y1 = state.canvasH/2 - Math.sin(angleRad) * state.canvasH/2;
      const x2 = state.canvasW/2 + Math.cos(angleRad) * state.canvasW/2;
      const y2 = state.canvasH/2 + Math.sin(angleRad) * state.canvasH/2;
      grad = ctx.createLinearGradient(x1, y1, x2, y2);
    } else {
      grad = ctx.createRadialGradient(state.canvasW/2, state.canvasH/2, 0, state.canvasW/2, state.canvasH/2, Math.max(state.canvasW, state.canvasH)/2);
    }
    grad.addColorStop(0, state.gradColor1);
    grad.addColorStop(1, state.gradColor2);
    ctx.fillStyle = grad;
  }
  
  ctx.save();
  ctx.globalCompositeOperation = 'source-over';
  ctx.fillRect(0, 0, state.canvasW, state.canvasH);
  ctx.restore();
  renderLayers();
  saveHistory();
  showPopup('🎨 Filled with Gradient');
}

function rgbToHex(rgb) {
  if (!rgb || !rgb.startsWith('rgb')) return rgb;
  const m = rgb.match(/\d+/g);
  if (!m || m.length < 3) return '#000000';
  return '#' + m.slice(0,3).map(x => parseInt(x).toString(16).padStart(2, '0')).join('');
}

window.addEventListener('mousedown', e => {
  const isFormatBar = document.getElementById('textFormatBar').contains(e.target);
  if (activeTextNode && !activeTextNode.contains(e.target) && !isFormatBar) {
    setActiveTextNode(null);
  }
  
  if (!document.getElementById('brushMenu').contains(e.target) && !e.target.closest('[data-tool="brush"]') &&
      !document.getElementById('selectMenu').contains(e.target) && !e.target.closest('[data-tool="select"]') &&
      !document.getElementById('cropMenu').contains(e.target) && !e.target.closest('[data-tool="crop"]')) {
    document.querySelectorAll('.brush-menu').forEach(m => m.classList.remove('show'));
  }
  
  const isTextNode = e.target.classList && e.target.classList.contains('canvas-text');
  if (!isTextNode && !isFormatBar && document.getElementById('textLayer').children.length > 0) {
    rasterizeTexts();
  }
});

function spawnTextNode(x, y, data = null) {
  const div = document.createElement('div');
  div.className = 'canvas-text';
  div.contentEditable = true;
  div.style.position = 'absolute';
  div.style.left = (data ? data.left : x + 'px');
  div.style.top = (data ? data.top : y + 'px');
  div.style.color = data ? data.color : state.fgColor;
  div.style.fontSize = data ? data.fontSize : Math.max(16, state.brushSize * 4) + 'px';
  div.style.fontFamily = data ? data.fontFamily : 'Arial';
  div.style.pointerEvents = 'auto';
  div.style.whiteSpace = 'pre-wrap';
  div.style.minWidth = '20px';
  div.style.minHeight = '20px';
  div.style.outline = '1px dashed #999';
  div.style.cursor = 'text';
  div.style.zIndex = '100';
  div.style.lineHeight = '1.2';
  div.style.fontWeight = data ? data.fontWeight : 'normal';
  div.style.fontStyle = data ? data.fontStyle : 'normal';
  div.style.textDecoration = data ? data.textDecoration : 'none';
  div.innerText = data ? data.text : 'Text';
  
  if (data && data.gradient) {
    div.dataset.gradient = data.gradient;
    const g = JSON.parse(data.gradient);
    const bg = `linear-gradient(${g.a || 90}deg, ${g.c1}, ${g.c2})`;
    div.style.backgroundImage = bg;
    div.style.webkitBackgroundClip = 'text';
    div.style.webkitTextFillColor = 'transparent';
  }

  div.onfocus = () => { setActiveTextNode(div); };
  div.onblur = () => { div.style.outline = 'none'; div.contentEditable = false; };
  div.ondblclick = (e) => { e.stopPropagation(); div.contentEditable = true; div.focus(); div.style.outline = '1px dashed #999'; };
  
  let isDragging = false, startX, startY, initL, initT;
  div.onmousedown = e => {
    setActiveTextNode(div);
    if (div.isContentEditable) return;
    isDragging = true;
    startX = e.clientX; startY = e.clientY;
    initL = parseFloat(div.style.left); initT = parseFloat(div.style.top);
    e.stopPropagation();
  };
  window.addEventListener('mousemove', e => {
    if (isDragging) {
      div.style.left = initL + (e.clientX - startX) / state.zoom + 'px';
      div.style.top = initT + (e.clientY - startY) / state.zoom + 'px';
    }
  });
  window.addEventListener('mouseup', () => { isDragging = false; });
  
  document.getElementById('textLayer').appendChild(div);
  if (!data) div.focus();
}

// ---------- Curve Tool ----------
// Handled directly in Pointer Events

// ---------- Photo Sketch Effect ----------
function applyPhotoSketch() {
  const layer = state.layers[state.activeLayerIdx];
  const c = layer.canvas;
  const w = c.width, h = c.height;

  const grayC = createLayerCanvas(w, h);
  const grayCtx = grayC.getContext('2d');
  grayCtx.filter = 'grayscale(100%)';
  grayCtx.drawImage(c, 0, 0);

  const blurC = createLayerCanvas(w, h);
  const blurCtx = blurC.getContext('2d');
  blurCtx.filter = 'invert(100%) blur(8px)';
  blurCtx.drawImage(grayC, 0, 0);

  const finalC = createLayerCanvas(w, h);
  const finalCtx = finalC.getContext('2d');
  finalCtx.drawImage(grayC, 0, 0);
  finalCtx.globalCompositeOperation = 'color-dodge';
  finalCtx.drawImage(blurC, 0, 0);

  const ctx = c.getContext('2d');
  ctx.clearRect(0, 0, w, h);
  ctx.drawImage(finalC, 0, 0);

  renderLayers();
  saveHistory();
  showPopup('✨ Sketch Effect Applied');
}

// ---------- Popup ----------
function showPopup(text) {
  const p = document.getElementById('popup');
  document.getElementById('popupText').textContent = text;
  p.classList.remove('hidden');
  clearTimeout(p._timer);
  p._timer = setTimeout(() => p.classList.add('hidden'), 3500);
}

function acceptCorrection() {
  document.getElementById('popup').classList.add('hidden');
}

function undoCorrection() {
  document.getElementById('popup').classList.add('hidden');
  undo();
}

// ---------- Modal ----------
function closeModal() {
  document.getElementById('modal').classList.remove('show');
}

function showExportModal() {
  const modal = document.getElementById('modal');
  document.getElementById('modalContent').innerHTML = `
    <h3>Export Image</h3>
    <div class="form-row"><label>Format</label>
      <select id="exportFormat" style="width:100%;padding:6px;border:1px solid var(--border);border-radius:4px;background:var(--toolbar);color:var(--text)">
        <option value="png">PNG</option>
        <option value="jpeg">JPG</option>
        <option value="webp">WEBP</option>
        <option value="gif">GIF</option>
        <option value="bmp">BMP</option>
        <option value="svg">SVG (basic)</option>
      </select>
    </div>
    <div class="form-row"><label>Quality: <span id="qVal">92</span>%</label>
      <input type="range" id="exportQuality" min="10" max="100" value="92" oninput="document.getElementById('qVal').textContent=this.value" style="width:100%">
    </div>
    <div class="form-row"><label><input type="checkbox" id="exportTransparent" ${state.transparent?'checked':''}> Transparent Background</label></div>
    <div class="modal-actions">
      <button class="btn" onclick="closeModal()">Cancel</button>
      <button class="btn primary" onclick="doExport()">Export</button>
    </div>
  `;
  modal.classList.add('show');
}

function doExport() {
  rasterizeSelection();
  rasterizeTexts();
  
  const format = document.getElementById('exportFormat').value;
  const quality = +document.getElementById('exportQuality').value / 100;
  const transparent = document.getElementById('exportTransparent').checked;

  const exportCanvas = createLayerCanvas(state.canvasW, state.canvasH);
  const ectx = exportCanvas.getContext('2d');
  if (!transparent && !state.transparent) {
    ectx.fillStyle = '#ffffff';
    ectx.fillRect(0, 0, state.canvasW, state.canvasH);
  }
  for (const layer of state.layers) {
    if (!layer.visible) continue;
    ectx.globalAlpha = layer.opacity / 100;
    ectx.drawImage(layer.canvas, 0, 0);
  }

  // Render text layers
  ectx.globalAlpha = 1;
  document.getElementById('textLayer').querySelectorAll('.canvas-text').forEach(node => {
    const left = parseFloat(node.style.left);
    const top = parseFloat(node.style.top);
    let style = '';
    if (node.style.fontStyle === 'italic') style += 'italic ';
    if (node.style.fontWeight === 'bold') style += 'bold ';
    ectx.font = style + node.style.fontSize + ' ' + node.style.fontFamily;
    ectx.fillStyle = node.style.color;
    ectx.textBaseline = 'top';
    const lines = node.innerText.split('\n');
    const lh = parseInt(node.style.fontSize) * 1.2;
    lines.forEach((l, i) => {
      ectx.fillText(l, left, top + i * lh);
      if (node.style.textDecoration === 'underline') {
        const m = ectx.measureText(l);
        ectx.strokeStyle = node.style.color;
        ectx.lineWidth = Math.max(1, parseInt(node.style.fontSize) / 20);
        ectx.beginPath();
        ectx.moveTo(left, top + i * lh + parseInt(node.style.fontSize) * 1.1);
        ectx.lineTo(left + m.width, top + i * lh + parseInt(node.style.fontSize) * 1.1);
        ectx.stroke();
      }
    });
  });

  let mime = 'image/png', ext = 'png';
  if (format === 'jpeg') { mime = 'image/jpeg'; ext = 'jpg'; }
  else if (format === 'webp') { mime = 'image/webp'; ext = 'webp'; }
  else if (format === 'gif') { mime = 'image/gif'; ext = 'gif'; }
  else if (format === 'bmp') { mime = 'image/bmp'; ext = 'bmp'; }

  if (format === 'svg') {
    const dataUrl = exportCanvas.toDataURL('image/png');
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${state.canvasW}" height="${state.canvasH}"><image href="${dataUrl}" width="${state.canvasW}" height="${state.canvasH}"/></svg>`;
    downloadFile(svg, 'drawing.svg', 'image/svg+xml');
  } else {
    exportCanvas.toBlob(blob => {
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = `drawing.${ext}`;
      a.click();
      URL.revokeObjectURL(url);
    }, mime, quality);
  }
  closeModal();
}

function downloadFile(content, name, type) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

function saveProject() {
  rasterizeSelection();
  rasterizeTexts();
  
  const data = {
    version: 1,
    canvasW: state.canvasW, canvasH: state.canvasH,
    layers: state.layers.map(l => ({
      name: l.name, visible: l.visible, locked: l.locked, opacity: l.opacity,
      data: l.canvas.toDataURL()
    })),
    texts: Array.from(document.querySelectorAll('.canvas-text')).map(node => ({
      text: node.innerText,
      left: node.style.left, top: node.style.top,
      color: node.style.color, fontSize: node.style.fontSize, fontFamily: node.style.fontFamily,
      fontWeight: node.style.fontWeight, fontStyle: node.style.fontStyle, textDecoration: node.style.textDecoration
    })),
    activeLayerIdx: state.activeLayerIdx,
    transparent: state.transparent
  };
  const json = JSON.stringify(data);
  downloadFile(json, 'project.paint', 'application/json');
  showPopup('💾 Project saved');
}

function showResizeModal() {
  const modal = document.getElementById('modal');
  document.getElementById('modalContent').innerHTML = `
    <h3>Resize Image / Canvas</h3>
    <div class="form-row">
      <label>Width</label>
      <input type="number" id="resizeW" value="${state.canvasW}" style="width:100%;padding:6px;border:1px solid var(--border);border-radius:4px;background:var(--toolbar);color:var(--text)">
    </div>
    <div class="form-row">
      <label>Height</label>
      <input type="number" id="resizeH" value="${state.canvasH}" style="width:100%;padding:6px;border:1px solid var(--border);border-radius:4px;background:var(--toolbar);color:var(--text)">
    </div>
    <div class="form-row" style="flex-direction:row; align-items:center; gap: 5px; margin-top: 10px;">
      <input type="checkbox" id="resizeAspect" checked>
      <label for="resizeAspect" style="margin:0; font-size:14px;">Keep Aspect Ratio</label>
    </div>
    <div class="form-row" style="flex-direction:row; align-items:center; gap: 5px; margin-bottom: 15px;">
      <input type="checkbox" id="resizeScale" checked>
      <label for="resizeScale" style="margin:0; font-size:14px;">Scale Image Contents</label>
    </div>
    <div style="display:flex; gap:10px; margin-top:20px;">
      <button class="btn" onclick="closeModal()">Cancel</button>
      <button class="btn primary" onclick="doResize()">Resize</button>
    </div>
  `;
  modal.classList.add('show');
  
  const wInput = document.getElementById('resizeW');
  const hInput = document.getElementById('resizeH');
  const aspectCb = document.getElementById('resizeAspect');
  const ratio = state.canvasW / state.canvasH;
  
  wInput.oninput = () => { if(aspectCb.checked) hInput.value = Math.round(wInput.value / ratio); };
  hInput.oninput = () => { if(aspectCb.checked) wInput.value = Math.round(hInput.value * ratio); };
}

function doResize() {
  const w = +document.getElementById('resizeW').value;
  const h = +document.getElementById('resizeH').value;
  const scale = document.getElementById('resizeScale').checked;
  if (w < 10 || h < 10 || w > 5000 || h > 5000) { alert('Invalid size'); return; }
  const newLayers = state.layers.map(l => {
    const nc = createLayerCanvas(w, h);
    if (scale) {
      nc.getContext('2d').drawImage(l.canvas, 0, 0, w, h);
    } else {
      nc.getContext('2d').drawImage(l.canvas, 0, 0);
    }
    return { ...l, canvas: nc };
  });
  state.canvasW = w; state.canvasH = h;
  state.layers = newLayers;
  [mainCanvas, previewCanvas, gridCanvas].forEach(c => {
    c.width = w; c.height = h;
    c.style.width = w + 'px'; c.style.height = h + 'px';
  });
  canvasContainer.style.width = w + 'px';
  canvasContainer.style.height = h + 'px';
  document.getElementById('statusCanvas').textContent = `Canvas: ${w}×${h}`;
  renderLayers();
  updateZoom();
  drawGrid();
  saveHistory();
  closeModal();
}

// ---------- Canvas Operations ----------
function newCanvas() {
  if (!confirm('Create new canvas? Unsaved changes will be lost.')) return;
  state.layers = [];
  state.history = []; state.historyIdx = -1;
  initCanvas(1200, 800);
}

function clearCanvas() {
  if (!confirm('Clear current layer?')) return;
  const ctx = getActiveCtx();
  ctx.clearRect(0, 0, state.canvasW, state.canvasH);
  renderLayers();
  saveHistory();
}

function getLayerBounds(canvas) {
  const ctx = canvas.getContext('2d');
  const w = canvas.width, h = canvas.height;
  const data = ctx.getImageData(0, 0, w, h).data;
  let minX = w, minY = h, maxX = 0, maxY = 0;
  let hasPixels = false;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (data[(y * w + x) * 4 + 3] > 0) {
        if (!hasPixels) { minX = maxX = x; minY = maxY = y; hasPixels = true; }
        else {
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
        }
      }
    }
  }
  return hasPixels ? { x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1 } : null;
}

function transformLayer(transformCallback) {
  if (state.selection) {
    const c = state.selection.canvas;
    const tmp = cloneCanvas(c);
    const res = transformCallback(tmp, state.selection.w, state.selection.h);
    if (res) {
      state.selection.canvas = res.canvas;
      const cx = state.selection.x + state.selection.w / 2;
      const cy = state.selection.y + state.selection.h / 2;
      state.selection.w = res.w;
      state.selection.h = res.h;
      state.selection.x = cx - res.w / 2;
      state.selection.y = cy - res.h / 2;
    }
    drawSelectionPreview();
    return;
  }
  
  const layer = state.layers[state.activeLayerIdx];
  const c = layer.canvas;
  const bounds = getLayerBounds(c);
  if (!bounds) return;
  
  const tmp = createLayerCanvas(bounds.w, bounds.h);
  tmp.getContext('2d').drawImage(c, bounds.x, bounds.y, bounds.w, bounds.h, 0, 0, bounds.w, bounds.h);
  
  const res = transformCallback(tmp, bounds.w, bounds.h);
  
  if (res) {
    const ctx = c.getContext('2d');
    ctx.clearRect(0, 0, c.width, c.height);
    const cx = bounds.x + bounds.w / 2;
    const cy = bounds.y + bounds.h / 2;
    ctx.drawImage(res.canvas, cx - res.w / 2, cy - res.h / 2);
    renderLayers();
    saveHistory();
  }
}

function flipH() {
  transformLayer((src, w, h) => {
    const nc = createLayerCanvas(w, h);
    const ctx = nc.getContext('2d');
    ctx.scale(-1, 1);
    ctx.drawImage(src, -w, 0);
    return { canvas: nc, w, h };
  });
}

function flipV() {
  transformLayer((src, w, h) => {
    const nc = createLayerCanvas(w, h);
    const ctx = nc.getContext('2d');
    ctx.scale(1, -1);
    ctx.drawImage(src, 0, -h);
    return { canvas: nc, w, h };
  });
}

function rotateCanvas() {
  transformLayer((src, w, h) => {
    const nc = createLayerCanvas(h, w);
    const ctx = nc.getContext('2d');
    ctx.translate(h/2, w/2);
    ctx.rotate(Math.PI / 2);
    ctx.drawImage(src, -w/2, -h/2);
    return { canvas: nc, w: h, h: w };
  });
}

function toggleTransparent() {
  state.transparent = !state.transparent;
  document.getElementById('transpBtn').textContent = 'Transparent BG: ' + (state.transparent ? 'ON' : 'OFF');
  renderLayers();
}

// ---------- Zoom / Pan ----------
function updateZoom() {
  const wrap = document.getElementById('canvasWrap');
  const scale = state.zoom;
  canvasContainer.style.transform = `translate(${state.panX}px, ${state.panY}px) scale(${scale})`;
  canvasContainer.style.transformOrigin = 'center center';
  document.getElementById('statusZoom').textContent = `Zoom: ${Math.round(scale * 100)}%`;
}

function zoomIn() { if (state.canvasLocked) return; state.zoom = Math.min(5, state.zoom * 1.2); updateZoom(); }
function zoomOut() { if (state.canvasLocked) return; state.zoom = Math.max(0.1, state.zoom / 1.2); updateZoom(); }
function resetZoom() {
  if (state.canvasLocked) return;
  state.zoom = 1; state.panX = 0; state.panY = 0;
  const wrap = document.getElementById('canvasWrap');
  const maxW = wrap.clientWidth - 40, maxH = wrap.clientHeight - 40;
  const scale = Math.min(maxW / state.canvasW, maxH / state.canvasH, 1);
  state.zoom = scale;
  updateZoom();
}

// ---------- Grid & Ruler ----------
function toggleRuler() {
  state.rulerOn = !state.rulerOn;
  document.getElementById('rulerBtn').style.background = state.rulerOn ? 'var(--accent)' : '';
  document.getElementById('rulerBtn').style.color = state.rulerOn ? 'white' : '';
  drawGrid();
}

function toggleGrid() {
  state.gridOn = !state.gridOn;
  document.getElementById('gridBtn').style.background = state.gridOn ? 'var(--accent)' : '';
  document.getElementById('gridBtn').style.color = state.gridOn ? 'white' : '';
  drawGrid();
}

function drawGrid() {
  gridCtx.clearRect(0, 0, state.canvasW, state.canvasH);
  if (state.gridOn) {
    const step = 20;
    gridCtx.strokeStyle = state.darkMode ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.15)';
    gridCtx.lineWidth = 1;
    gridCtx.beginPath();
    for (let x = 0; x <= state.canvasW; x += step) { gridCtx.moveTo(x, 0); gridCtx.lineTo(x, state.canvasH); }
    for (let y = 0; y <= state.canvasH; y += step) { gridCtx.moveTo(0, y); gridCtx.lineTo(state.canvasW, y); }
    gridCtx.stroke();
  }
  if (state.rulerOn) {
    gridCtx.fillStyle = state.darkMode ? '#444' : '#eee';
    gridCtx.fillRect(0, 0, state.canvasW, 20);
    gridCtx.fillRect(0, 0, 20, state.canvasH);
    gridCtx.fillStyle = state.darkMode ? '#fff' : '#000';
    gridCtx.font = '10px Arial';
    gridCtx.textBaseline = 'top';
    gridCtx.beginPath();
    for (let x = 0; x <= state.canvasW; x += 100) { gridCtx.fillText(x, x + 2, 2); gridCtx.fillRect(x, 0, 1, 20); }
    for (let y = 0; y <= state.canvasH; y += 100) { if (y>0) gridCtx.fillText(y, 2, y + 2); gridCtx.fillRect(0, y, 20, 1); }
  }
}

// ---------- Theme ----------
function toggleTheme() {
  state.darkMode = !state.darkMode;
  document.body.dataset.theme = state.darkMode ? 'dark' : 'light';
  document.getElementById('themeBtn').textContent = state.darkMode ? '☀️' : '🌙';
  drawGrid();
}

function toggleSidebar() {
  document.getElementById('rightSidebar').classList.toggle('show');
}

function toggleFullscreen() {
  if (!document.fullscreenElement) document.documentElement.requestFullscreen();
  else document.exitFullscreen();
}

// ---------- Colors ----------
function setFgColor(c) {
  state.fgColor = c;
  document.getElementById('fgColor').value = c;
  document.getElementById('fgPreview').style.background = c;
  document.getElementById('fgColorMobile').value = c;
  document.getElementById('fgPreviewMobile').style.background = c;
  document.getElementById('hexInput').value = c;
}

function setBgColor(c) {
  state.bgColor = c;
  document.getElementById('bgColor').value = c;
  document.getElementById('bgPreview').style.background = c;
}

function swapColors() {
  const t = state.fgColor; setFgColor(state.bgColor); setBgColor(t);
}

function insertImage(e) {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = ev => {
    const img = new Image();
    img.onload = () => {
      let w = img.width;
      let h = img.height;
      if (w > state.canvasW || h > state.canvasH) {
        const ratio = Math.min(state.canvasW / w, state.canvasH / h);
        w = Math.floor(w * ratio);
        h = Math.floor(h * ratio);
      }
      
      const x = Math.floor((state.canvasW - w) / 2);
      const y = Math.floor((state.canvasH - h) / 2);
      
      const nc = createLayerCanvas(state.canvasW, state.canvasH);
      state.layers.splice(state.activeLayerIdx + 1, 0, {
        name: 'Inserted Image', visible: true, locked: false, opacity: 100, canvas: nc
      });
      state.activeLayerIdx++;
      
      const moveTmp = createLayerCanvas(w, h);
      moveTmp.getContext('2d').drawImage(img, 0, 0, w, h);
      
      if (state.tool !== 'move') {
        const btn = document.querySelector('.tool-btn[data-tool="move"]');
        if (btn) btn.click();
      }
      
      state.moveCanvas = moveTmp;
      state.moveRect = { x, y, w, h };
      state.moveResizing = false;
      state.moveDragging = false;
      state.dragOffsetX = 0;
      state.dragOffsetY = 0;
      
      renderLayers();
      drawMovePreview();
      saveHistory();
      showPopup('🖼️ Image Inserted & Ready to Move/Resize');
    };
    img.src = ev.target.result;
  };
  reader.readAsDataURL(file);
  e.target.value = '';
}

// ---------- Background Fill Modal ----------
function showBackgroundModal() {
  const modal = document.getElementById('modal');
  document.getElementById('modalContent').innerHTML = `
    <h3>Change Background</h3>
    <div class="form-row"><label>Fill Type</label>
      <select id="bgFillType" onchange="updateBgModalUI()" style="width:100%;padding:6px;border:1px solid var(--border);border-radius:4px;background:var(--toolbar);color:var(--text)">
        <option value="solid">Solid Color</option>
        <option value="linear">Linear Gradient</option>
        <option value="radial">Radial Gradient</option>
      </select>
    </div>
    
    <div id="bgSolidOpts" class="form-row">
      <label>Color</label>
      <input type="color" id="bgFillColor" value="${state.bgColor}" style="width:100%; height:32px; padding:0; border:none;">
    </div>
    
    <div id="bgGradOpts" style="display:none;">
      <div class="form-row" style="display:flex; gap:10px;">
        <div style="flex:1"><label>Color 1</label><input type="color" id="bgGrad1" value="${state.gradColor1}" style="width:100%; height:32px; padding:0; border:none;"></div>
        <div style="flex:1"><label>Color 2</label><input type="color" id="bgGrad2" value="${state.gradColor2}" style="width:100%; height:32px; padding:0; border:none;"></div>
      </div>
      <div class="form-row" id="bgAngleRow">
        <label>Angle (Linear)</label>
        <input type="number" id="bgGradAngle" value="${state.gradAngle}" style="width:100%;padding:6px;border:1px solid var(--border);border-radius:4px;background:var(--toolbar);color:var(--text)">
      </div>
    </div>
    
    <div class="modal-actions">
      <button class="btn" onclick="closeModal()">Cancel</button>
      <button class="btn primary" onclick="applyBackgroundFill()">Apply to Background</button>
    </div>
  `;
  modal.classList.add('show');
}

window.updateBgModalUI = function() {
  const type = document.getElementById('bgFillType').value;
  if (type === 'solid') {
    document.getElementById('bgSolidOpts').style.display = 'block';
    document.getElementById('bgGradOpts').style.display = 'none';
  } else {
    document.getElementById('bgSolidOpts').style.display = 'none';
    document.getElementById('bgGradOpts').style.display = 'block';
    document.getElementById('bgAngleRow').style.display = (type === 'linear') ? 'block' : 'none';
  }
}

window.applyBackgroundFill = function() {
  const type = document.getElementById('bgFillType').value;
  const layer = state.layers[state.activeLayerIdx];
  const ctx = layer.canvas.getContext('2d');
  
  if (type === 'solid') {
    ctx.fillStyle = document.getElementById('bgFillColor').value;
  } else {
    const c1 = document.getElementById('bgGrad1').value;
    const c2 = document.getElementById('bgGrad2').value;
    let grad;
    if (type === 'linear') {
      const angle = document.getElementById('bgGradAngle').value;
      const angleRad = angle * Math.PI / 180;
      const x1 = state.canvasW/2 - Math.cos(angleRad) * state.canvasW/2;
      const y1 = state.canvasH/2 - Math.sin(angleRad) * state.canvasH/2;
      const x2 = state.canvasW/2 + Math.cos(angleRad) * state.canvasW/2;
      const y2 = state.canvasH/2 + Math.sin(angleRad) * state.canvasH/2;
      grad = ctx.createLinearGradient(x1, y1, x2, y2);
    } else {
      grad = ctx.createRadialGradient(state.canvasW/2, state.canvasH/2, 0, state.canvasW/2, state.canvasH/2, Math.max(state.canvasW, state.canvasH)/2);
    }
    grad.addColorStop(0, c1);
    grad.addColorStop(1, c2);
    ctx.fillStyle = grad;
  }
  
  ctx.save();
  ctx.globalCompositeOperation = 'destination-over';
  ctx.fillRect(0, 0, state.canvasW, state.canvasH);
  ctx.restore();
  
  renderLayers();
  saveHistory();
  closeModal();
  showPopup('🪣 Background Applied');
}

// ---------- File Open ----------
function openFile(e) {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = ev => {
    if (file.name.endsWith('.paint')) {
      try {
        const data = JSON.parse(ev.target.result);
        state.canvasW = data.canvasW; state.canvasH = data.canvasH;
        state.transparent = data.transparent || false;
        state.layers = [];
        let loaded = 0;
        data.layers.forEach((ld, i) => {
          const img = new Image();
          img.onload = () => {
            const c = createLayerCanvas(state.canvasW, state.canvasH);
            c.getContext('2d').drawImage(img, 0, 0);
            state.layers[i] = { name: ld.name, visible: ld.visible, locked: ld.locked, opacity: ld.opacity, canvas: c };
            loaded++;
            if (loaded === data.layers.length) {
              state.activeLayerIdx = data.activeLayerIdx || 0;
              [mainCanvas, previewCanvas, gridCanvas].forEach(c => {
                c.width = state.canvasW; c.height = state.canvasH;
                c.style.width = state.canvasW + 'px'; c.style.height = state.canvasH + 'px';
              });
              canvasContainer.style.width = state.canvasW + 'px';
              canvasContainer.style.height = state.canvasH + 'px';
              renderLayers();
              updateZoom();
              if (data.texts) {
                document.getElementById('textLayer').innerHTML = '';
                data.texts.forEach(t => spawnTextNode(parseFloat(t.left), parseFloat(t.top), t));
              }
              saveHistory();
            }
          };
          img.src = ld.data;
        });
        showPopup('📂 Project loaded');
      } catch (err) { alert('Invalid project file'); }
    } else {
      const img = new Image();
      img.onload = () => {
        state.canvasW = img.width; state.canvasH = img.height;
        state.layers = [{ name: 'Image', visible: true, locked: false, opacity: 100, canvas: createLayerCanvas(img.width, img.height) }];
        state.layers[0].canvas.getContext('2d').drawImage(img, 0, 0);
        state.activeLayerIdx = 0;
        [mainCanvas, previewCanvas, gridCanvas].forEach(c => {
          c.width = img.width; c.height = img.height;
          c.style.width = img.width + 'px'; c.style.height = img.height + 'px';
        });
        canvasContainer.style.width = img.width + 'px';
        canvasContainer.style.height = img.height + 'px';
        renderLayers();
        updateZoom();
        saveHistory();
        showPopup('📂 Image loaded');
      };
      img.src = ev.target.result;
    }
  };
  if (file.name.endsWith('.paint')) reader.readAsText(file);
  else reader.readAsDataURL(file);
  e.target.value = '';
}

// ---------- Color Swatches ----------
function buildSwatches() {
  const colors = [
    '#000000','#404040','#808080','#c0c0c0','#ffffff',
    '#ff0000','#ff7f00','#ffff00','#00ff00','#00ffff',
    '#0000ff','#7f00ff','#ff00ff','#800000','#808000',
    '#008000','#800080','#008080','#000080','#ff6b6b',
    '#ffa94d','#ffd43b','#69db7c','#3bc9db','#4dabf7',
    '#9775fa','#f783ac','#a61e4d','#5c940d','#e67700'
  ];
  const grid = document.getElementById('swatchGrid');
  grid.innerHTML = '';
  colors.forEach(c => {
    const s = document.createElement('div');
    s.className = 'color-swatch';
    s.style.background = c;
    s.onclick = () => setFgColor(c);
    s.oncontextmenu = e => { e.preventDefault(); setBgColor(c); };
    grid.appendChild(s);
  });
}

let clipboardCanvas = null;

function copySelection() {
  if (state.selection) {
    clipboardCanvas = document.createElement('canvas');
    clipboardCanvas.width = state.selection.canvas.width;
    clipboardCanvas.height = state.selection.canvas.height;
    clipboardCanvas.getContext('2d').drawImage(state.selection.canvas, 0, 0);
    showPopup('📋 Selection copied');
  } else {
    showPopup('⚠️ No selection to copy');
  }
}

function cutSelection() {
  if (state.selection) {
    copySelection();
    deleteSelection();
  }
}

function pasteSelection() {
  if (clipboardCanvas) {
    if (state.selection) rasterizeSelection();
    document.querySelector('.tool-btn[data-tool="select"]').click();
    
    const selCanvas = createLayerCanvas(clipboardCanvas.width, clipboardCanvas.height);
    selCanvas.getContext('2d').drawImage(clipboardCanvas, 0, 0);
    
    state.selection = { canvas: selCanvas, x: 0, y: 0, w: clipboardCanvas.width, h: clipboardCanvas.height };
    drawSelectionPreview();
    updateSelectionToolbar();
    showPopup('📋⬇️ Selection pasted');
  } else {
    showPopup('⚠️ Clipboard is empty');
  }
}

function deleteSelection() {
  if (state.selection) {
    state.selection = null;
    previewCtx.clearRect(0, 0, state.canvasW, state.canvasH);
    updateSelectionToolbar();
    saveHistory();
    showPopup('🗑️ Selection deleted');
  }
}

function updateSelectionToolbar() {
  const tb = document.getElementById('selectionToolbar');
  if (state.selection) {
    tb.style.display = 'flex';
  } else {
    tb.style.display = 'none';
  }
}

function rasterizeSelection() {
  if (state.selection) {
    const layer = state.layers[state.activeLayerIdx];
    const ctx = layer.canvas.getContext('2d');
    ctx.save();
    ctx.globalCompositeOperation = 'source-over';
    ctx.drawImage(state.selection.canvas, state.selection.x, state.selection.y, state.selection.w, state.selection.h);
    ctx.restore();
    state.selection = null;
    previewCtx.clearRect(0, 0, state.canvasW, state.canvasH);
    updateSelectionToolbar();
    renderLayers();
    saveHistory();
  }
}

function rasterizeMove() {
  if (state.moveCanvas) {
    const ctx = getActiveCtx();
    ctx.drawImage(state.moveCanvas, state.moveRect.x, state.moveRect.y, state.moveRect.w, state.moveRect.h);
    state.moveCanvas = null;
    state.moveRect = null;
    state.moveResizing = false;
    state.moveDragging = false;
    previewCtx.clearRect(0, 0, state.canvasW, state.canvasH);
    renderLayers();
    saveHistory();
  }
}

function drawMovePreview() {
  if (!state.moveCanvas) return;
  previewCtx.clearRect(0, 0, state.canvasW, state.canvasH);
  previewCtx.drawImage(state.moveCanvas, state.moveRect.x, state.moveRect.y, state.moveRect.w, state.moveRect.h);
  
  // Draw resize corners
  previewCtx.setLineDash([5, 5]);
  previewCtx.strokeStyle = 'rgba(0,0,0,0.5)';
  previewCtx.lineWidth = 1;
  previewCtx.strokeRect(state.moveRect.x, state.moveRect.y, state.moveRect.w, state.moveRect.h);
  previewCtx.setLineDash([]);
  
  previewCtx.fillStyle = 'white';
  previewCtx.strokeStyle = 'blue';
  const s = 6 / state.zoom;
  const drawHandle = (hx, hy) => {
    previewCtx.fillRect(hx - s/2, hy - s/2, s, s);
    previewCtx.strokeRect(hx - s/2, hy - s/2, s, s);
  };
  drawHandle(state.moveRect.x, state.moveRect.y);
  drawHandle(state.moveRect.x + state.moveRect.w / 2, state.moveRect.y);
  drawHandle(state.moveRect.x + state.moveRect.w, state.moveRect.y);
  drawHandle(state.moveRect.x, state.moveRect.y + state.moveRect.h / 2);
  drawHandle(state.moveRect.x + state.moveRect.w, state.moveRect.y + state.moveRect.h / 2);
  drawHandle(state.moveRect.x, state.moveRect.y + state.moveRect.h);
  drawHandle(state.moveRect.x + state.moveRect.w / 2, state.moveRect.y + state.moveRect.h);
  drawHandle(state.moveRect.x + state.moveRect.w, state.moveRect.y + state.moveRect.h);
}

function cropToSelection() {
  if (!state.selection) return;
  const { x, y, w, h } = state.selection;
  rasterizeSelection();
  
  document.getElementById('resizeW').value = Math.floor(w);
  document.getElementById('resizeH').value = Math.floor(h);
  
  const newLayers = state.layers.map(l => {
    const nc = createLayerCanvas(w, h);
    nc.getContext('2d').drawImage(l.canvas, -x, -y);
    return { ...l, canvas: nc };
  });
  
  state.canvasW = w; state.canvasH = h;
  state.layers = newLayers;
  [mainCanvas, previewCanvas, gridCanvas].forEach(c => {
    c.width = w; c.height = h; c.style.width = w + 'px'; c.style.height = h + 'px';
  });
  canvasContainer.style.width = w + 'px'; canvasContainer.style.height = h + 'px';
  document.getElementById('statusCanvas').textContent = `Canvas: ${w}×${h}`;
  
  renderLayers();
  updateZoom();
  drawGrid();
  saveHistory();
  showPopup('✂️ Cropped to Selection. Please check if "Transparent BG" button is not "ON"');
}

function drawSelectionPreview() {
  previewCtx.clearRect(0, 0, state.canvasW, state.canvasH);
  if (state.selection) {
    previewCtx.drawImage(state.selection.canvas, state.selection.x, state.selection.y, state.selection.w, state.selection.h);
    previewCtx.setLineDash([5, 5]);
    previewCtx.strokeStyle = 'blue';
    previewCtx.lineWidth = 1;
    previewCtx.strokeRect(state.selection.x, state.selection.y, state.selection.w, state.selection.h);
    previewCtx.setLineDash([]);
    
    // Draw corner handles
    previewCtx.fillStyle = 'white';
    previewCtx.strokeStyle = 'blue';
    previewCtx.lineWidth = 1;
    const s = 6 / state.zoom;
    const drawHandle = (hx, hy) => {
      previewCtx.fillRect(hx - s/2, hy - s/2, s, s);
      previewCtx.strokeRect(hx - s/2, hy - s/2, s, s);
    };
    drawHandle(state.selection.x, state.selection.y);
    drawHandle(state.selection.x + state.selection.w / 2, state.selection.y);
    drawHandle(state.selection.x + state.selection.w, state.selection.y);
    drawHandle(state.selection.x, state.selection.y + state.selection.h / 2);
    drawHandle(state.selection.x + state.selection.w, state.selection.y + state.selection.h / 2);
    drawHandle(state.selection.x, state.selection.y + state.selection.h);
    drawHandle(state.selection.x + state.selection.w / 2, state.selection.y + state.selection.h);
    drawHandle(state.selection.x + state.selection.w, state.selection.y + state.selection.h);
  }
}

function setBrushType(type, btn) {
  state.brushType = type;
  document.querySelectorAll('#brushMenu .brush-option').forEach(b => b.classList.remove('active'));
  if (btn) btn.classList.add('active');
  document.getElementById('brushMenu').classList.remove('show');
  document.querySelector('.tool-btn[data-tool="brush"]')?.click();
}

function setSelectType(type, btn) {
  // Currently only 'rect' is implemented, but this sets up the UI for more
  document.querySelectorAll('#selectMenu .brush-option').forEach(b => b.classList.remove('active'));
  if (btn) btn.classList.add('active');
  document.getElementById('selectMenu').classList.remove('show');
  document.querySelector('.tool-btn[data-tool="select"]')?.click();
}

function setCropType(type, btn) {
  document.querySelectorAll('#cropMenu .brush-option').forEach(b => b.classList.remove('active'));
  if (btn) btn.classList.add('active');
  document.getElementById('cropMenu').classList.remove('show');
  if (type === 'perspective') {
    document.querySelector('.tool-btn[data-tool="crop"]').dataset.tool = 'perspective-crop';
    document.querySelector('.tool-btn[data-tool="perspective-crop"]')?.click();
  } else {
    // If it was perspective, revert to crop
    const btnCrop = document.querySelector('.tool-btn[data-tool="perspective-crop"]');
    if (btnCrop) btnCrop.dataset.tool = 'crop';
    document.querySelector('.tool-btn[data-tool="crop"]')?.click();
  }
}

function drawPerspectivePreview() {
  if (!state.perspectiveQuad) return;
  const q = state.perspectiveQuad;
  previewCtx.strokeStyle = 'blue';
  previewCtx.lineWidth = 1;
  previewCtx.setLineDash([5, 5]);
  previewCtx.beginPath();
  previewCtx.moveTo(q[0].x, q[0].y);
  previewCtx.lineTo(q[1].x, q[1].y);
  previewCtx.lineTo(q[2].x, q[2].y);
  previewCtx.lineTo(q[3].x, q[3].y);
  previewCtx.closePath();
  previewCtx.stroke();
  previewCtx.setLineDash([]);
  
  previewCtx.fillStyle = 'white';
  previewCtx.strokeStyle = 'blue';
  const s = 6 / state.zoom;
  for (let i = 0; i < 4; i++) {
    previewCtx.fillRect(q[i].x - s/2, q[i].y - s/2, s, s);
    previewCtx.strokeRect(q[i].x - s/2, q[i].y - s/2, s, s);
  }
}

function applyPerspectiveCrop() {
  if (!state.perspectiveQuad) return;
  const q = state.perspectiveQuad;
  
  const w = Math.round(Math.max(Math.hypot(q[1].x - q[0].x, q[1].y - q[0].y), Math.hypot(q[2].x - q[3].x, q[2].y - q[3].y)));
  const h = Math.round(Math.max(Math.hypot(q[3].x - q[0].x, q[3].y - q[0].y), Math.hypot(q[2].x - q[1].x, q[2].y - q[1].y)));
  
  if (w < 5 || h < 5) {
    cancelPerspectiveCrop();
    return;
  }
  
  const newLayers = state.layers.map(l => {
    const lCtx = l.canvas.getContext('2d');
    const lData = lCtx.getImageData(0, 0, state.canvasW, state.canvasH);
    const dCanvas = createLayerCanvas(w, h);
    const dCtx = dCanvas.getContext('2d');
    const dData = dCtx.createImageData(w, h);
    for (let y = 0; y < h; y++) {
      const v = y / (h - 1 || 1);
      for (let x = 0; x < w; x++) {
        const u = x / (w - 1 || 1);
        const px = (1-u)*(1-v)*q[0].x + u*(1-v)*q[1].x + u*v*q[2].x + (1-u)*v*q[3].x;
        const py = (1-u)*(1-v)*q[0].y + u*(1-v)*q[1].y + u*v*q[2].y + (1-u)*v*q[3].y;
        const sx = Math.floor(px);
        const sy = Math.floor(py);
        if (sx >= 0 && sx < state.canvasW && sy >= 0 && sy < state.canvasH) {
          const srcIdx = (sy * state.canvasW + sx) * 4;
          const destIdx = (y * w + x) * 4;
          dData.data[destIdx] = lData.data[srcIdx];
          dData.data[destIdx+1] = lData.data[srcIdx+1];
          dData.data[destIdx+2] = lData.data[srcIdx+2];
          dData.data[destIdx+3] = lData.data[srcIdx+3];
        }
      }
    }
    dCtx.putImageData(dData, 0, 0);
    return { ...l, canvas: dCanvas };
  });
  
  document.getElementById('resizeW').value = Math.floor(w);
  document.getElementById('resizeH').value = Math.floor(h);
  
  state.canvasW = w; state.canvasH = h;
  state.layers = newLayers;
  [mainCanvas, previewCanvas, gridCanvas].forEach(c => {
    c.width = w; c.height = h; c.style.width = w + 'px'; c.style.height = h + 'px';
  });
  canvasContainer.style.width = w + 'px'; canvasContainer.style.height = h + 'px';
  document.getElementById('statusCanvas').textContent = `Canvas: ${w}×${h}`;
  
  cancelPerspectiveCrop();
  renderLayers(); updateZoom(); drawGrid(); saveHistory();
  showPopup('📐 Perspective Cropped');
}

function cancelPerspectiveCrop() {
  state.perspectiveQuad = null;
  state.perspectiveDragging = -1;
  previewCtx.clearRect(0, 0, state.canvasW, state.canvasH);
  document.getElementById('perspectiveToolbar').style.display = 'none';
  document.querySelector('.tool-btn[data-tool="pencil"]')?.click();
}

function rasterizeTexts() {
  const tLayer = document.getElementById('textLayer');
  if (tLayer.children.length === 0) return;
  const ctx = getActiveCtx();
  ctx.save();
  ctx.textBaseline = 'top';
  tLayer.querySelectorAll('.canvas-text').forEach(node => {
    const left = parseFloat(node.style.left);
    const top = parseFloat(node.style.top);
    let style = '';
    if (node.style.fontStyle === 'italic') style += 'italic ';
    if (node.style.fontWeight === 'bold') style += 'bold ';
    ctx.font = style + node.style.fontSize + ' ' + node.style.fontFamily;
    
    let hasGradient = node.dataset.gradient;
    let fillStyle = node.style.color;
    const lines = node.innerText.split('\n');
    const lh = parseInt(node.style.fontSize) * 1.2;

    let maxW = 0;
    lines.forEach(l => { const m = ctx.measureText(l); if (m.width > maxW) maxW = m.width; });
    const textH = lines.length * lh;

    if (hasGradient) {
      try {
        const g = JSON.parse(hasGradient);
        const angleRad = (g.a || 90) * Math.PI / 180;
        const x1 = left + maxW/2 - Math.cos(angleRad) * maxW/2;
        const y1 = top + textH/2 - Math.sin(angleRad) * textH/2;
        const x2 = left + maxW/2 + Math.cos(angleRad) * maxW/2;
        const y2 = top + textH/2 + Math.sin(angleRad) * textH/2;
        const ctxGrad = ctx.createLinearGradient(x1, y1, x2, y2);
        ctxGrad.addColorStop(0, g.c1);
        ctxGrad.addColorStop(1, g.c2);
        fillStyle = ctxGrad;
      } catch(e) {}
    }
    
    const wa = node.dataset.wordart || 'none';
    
    lines.forEach((l, i) => {
      const drawWa = (dx, dy, clr) => {
         ctx.save();
         ctx.fillStyle = clr;
         ctx.fillText(l, left + dx, top + i * lh + dy);
         ctx.restore();
      };

      ctx.save();
      if (wa === 'wa1') {
         const grad = ctx.createLinearGradient(left, top, left + maxW, top);
         grad.addColorStop(0, 'red'); grad.addColorStop(1/6, 'orange'); grad.addColorStop(2/6, 'yellow');
         grad.addColorStop(3/6, 'green'); grad.addColorStop(4/6, 'blue'); grad.addColorStop(5/6, 'indigo'); grad.addColorStop(1, 'violet');
         
         ctx.shadowColor = 'rgba(0,0,0,0.5)'; ctx.shadowBlur = 4; ctx.shadowOffsetX = 2; ctx.shadowOffsetY = 2;
         ctx.fillStyle = grad;
         ctx.fillText(l, left, top + i * lh);
         
         ctx.shadowColor = 'transparent';
         ctx.strokeStyle = 'black'; ctx.lineWidth = 2;
         ctx.strokeText(l, left, top + i * lh);
         ctx.fillText(l, left, top + i * lh);
      } else if (wa === 'wa2') {
         ctx.shadowColor = 'rgba(0,0,0,0.5)'; ctx.shadowBlur = 5; ctx.shadowOffsetX = 0; ctx.shadowOffsetY = 0;
         drawWa(6, 6, 'transparent');
         ctx.shadowColor = 'transparent';
         for (let j = 6; j >= 1; j--) drawWa(j, j, '#0055aa');
         ctx.fillStyle = '#00aaff';
         ctx.fillText(l, left, top + i * lh);
      } else if (wa === 'wa3') {
         ctx.shadowColor = '#880000'; ctx.shadowBlur = 0; ctx.shadowOffsetX = 3; ctx.shadowOffsetY = 3;
         ctx.fillStyle = '#ffff00';
         ctx.fillText(l, left, top + i * lh);
         ctx.shadowColor = 'transparent';
         ctx.strokeStyle = '#ff0000'; ctx.lineWidth = 4;
         ctx.strokeText(l, left, top + i * lh);
         ctx.fillText(l, left, top + i * lh);
      } else if (wa === 'wa4') {
         const grad = ctx.createLinearGradient(left, top + i*lh, left, top + (i+1)*lh);
         grad.addColorStop(0, '#ffffff'); grad.addColorStop(0.45, '#aaaaaa'); grad.addColorStop(0.5, '#222222'); grad.addColorStop(1, '#888888');
         ctx.shadowColor = 'rgba(0,0,0,0.8)'; ctx.shadowBlur = 2; ctx.shadowOffsetX = 2; ctx.shadowOffsetY = 2;
         ctx.fillStyle = grad;
         ctx.fillText(l, left, top + i * lh);
         ctx.shadowColor = 'transparent';
         ctx.strokeStyle = 'black'; ctx.lineWidth = 2;
         ctx.strokeText(l, left, top + i * lh);
         ctx.fillText(l, left, top + i * lh);
      } else {
         ctx.fillStyle = fillStyle;
         ctx.fillText(l, left, top + i * lh);
      }
      ctx.restore();
      
      if (node.style.textDecoration === 'underline') {
        const m = ctx.measureText(l);
        ctx.strokeStyle = fillStyle;
        ctx.lineWidth = Math.max(1, parseInt(node.style.fontSize) / 20);
        ctx.beginPath();
        ctx.moveTo(left, top + i * lh + parseInt(node.style.fontSize) * 1.1);
        ctx.lineTo(left + m.width, top + i * lh + parseInt(node.style.fontSize) * 1.1);
        ctx.stroke();
      }
    });
  });
  ctx.restore();
  tLayer.innerHTML = '';
  setActiveTextNode(null);
  renderLayers();
  saveHistory();
}

document.querySelectorAll('.tool-btn[data-tool]').forEach(btn => {
  btn.onclick = (e) => {
    if (state.tool === 'text' && btn.dataset.tool !== 'text') {
      rasterizeTexts();
    }
    
    if (btn.dataset.tool === 'crop') {
      showPopup('Please check if "Transparent BG" button is not "ON"');
      if (state.selection) {
        cropToSelection();
        document.querySelector('.tool-btn[data-tool="pencil"]')?.click();
        return;
      }
    }
    
    if ((state.tool === 'select' || state.tool === 'lasso') && !['select', 'lasso', 'move'].includes(btn.dataset.tool)) {
      rasterizeSelection();
    }
    
    if (state.tool === 'move' && state.moveCanvas && btn.dataset.tool !== 'move') {
      rasterizeMove();
    }
    
    if (btn.dataset.tool === 'brush' || btn.dataset.tool === 'select' || btn.dataset.tool === 'crop') {
      const menu = document.getElementById(btn.dataset.tool + 'Menu');
      if (menu) {
        if (state.tool === btn.dataset.tool || (btn.dataset.tool === 'crop' && state.tool === 'perspective-crop')) {
          const rect = btn.getBoundingClientRect();
          menu.style.top = rect.top + 'px';
          menu.classList.toggle('show');
          e.stopPropagation();
          return;
        } else {
          const rect = btn.getBoundingClientRect();
          menu.style.top = rect.top + 'px';
          menu.classList.add('show');
        }
      }
    } else {
      document.querySelectorAll('.brush-menu').forEach(m => m.classList.remove('show'));
    }
    
    document.querySelectorAll('.tool-btn[data-tool]').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    state.tool = btn.dataset.tool;
    document.getElementById('statusTool').textContent = 'Tool: ' + state.tool.charAt(0).toUpperCase() + state.tool.slice(1);
    canvasContainer.className = 'canvas-container ' + state.tool;
  };
});

// ---------- Slider Bindings ----------
function bindSlider(id, prop, valId, suffix='') {
  const el = document.getElementById(id);
  el.oninput = () => {
    state[prop] = +el.value;
    document.getElementById(valId).textContent = el.value + suffix;
    if (prop === 'brushSize') document.getElementById('statusSize').textContent = 'Size: ' + el.value;
  };
}
bindSlider('brushSize', 'brushSize', 'brushSizeVal');
bindSlider('brushOpacity', 'brushOpacity', 'brushOpacityVal');
bindSlider('smoothing', 'smoothing', 'smoothingVal');
bindSlider('hardness', 'hardness', 'hardnessVal');
bindSlider('gradAngle', 'gradAngle', 'gradAngleVal', '°');

document.getElementById('fgColor').oninput = e => setFgColor(e.target.value);
document.getElementById('bgColor').oninput = e => setBgColor(e.target.value);
document.getElementById('fgColorMobile').oninput = e => setFgColor(e.target.value);
document.getElementById('hexInput').onchange = e => {
  const v = e.target.value.trim();
  if (/^#?[0-9a-f]{6}$/i.test(v)) setFgColor(v.startsWith('#') ? v : '#' + v);
};
document.getElementById('gradColor1Input').oninput = e => {
  state.gradColor1 = e.target.value;
  document.getElementById('gradColor1').style.background = e.target.value;
};
document.getElementById('gradColor2Input').oninput = e => {
  state.gradColor2 = e.target.value;
  document.getElementById('gradColor2').style.background = e.target.value;
};
document.getElementById('gradientType').onchange = e => state.gradientType = e.target.value;
document.getElementById('fillStyle').onchange = e => state.fillStyle = e.target.value;
document.getElementById('brushSizeMobile').oninput = e => {
  state.brushSize = +e.target.value;
  document.getElementById('brushSize').value = e.target.value;
  document.getElementById('brushSizeVal').textContent = e.target.value;
  document.getElementById('statusSize').textContent = 'Size: ' + e.target.value;
};

// ---------- Pointer Events on Canvas ----------
previewCanvas.addEventListener('pointerdown', onPointerDown);
previewCanvas.addEventListener('pointermove', onPointerMove);
previewCanvas.addEventListener('pointerup', onPointerUp);
previewCanvas.addEventListener('pointercancel', onPointerUp);
previewCanvas.addEventListener('pointerleave', onPointerUp);
previewCanvas.addEventListener('dblclick', e => {
  if (state.tool === 'text') {
    const { x, y } = getPos(e);
    spawnTextNode(x, y);
  }
});

// Touch pan/zoom
let touches = {};
let lastPinchDist = 0;
let lastPanCenter = null;

previewCanvas.addEventListener('touchstart', e => {
  if (e.touches.length === 2) {
    e.preventDefault();
    state.drawing = false;
    const t1 = e.touches[0], t2 = e.touches[1];
    lastPinchDist = Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);
    lastPanCenter = { x: (t1.clientX + t2.clientX) / 2, y: (t1.clientY + t2.clientY) / 2 };
  }
}, { passive: false });

previewCanvas.addEventListener('touchmove', e => {
  if (e.touches.length === 2) {
    e.preventDefault();
    if (state.canvasLocked) return;
    const t1 = e.touches[0], t2 = e.touches[1];
    const dist = Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);
    const center = { x: (t1.clientX + t2.clientX) / 2, y: (t1.clientY + t2.clientY) / 2 };
    if (lastPinchDist > 0) {
      const scale = dist / lastPinchDist;
      state.zoom = Math.max(0.1, Math.min(5, state.zoom * scale));
    }
    if (lastPanCenter) {
      state.panX += center.x - lastPanCenter.x;
      state.panY += center.y - lastPanCenter.y;
    }
    lastPinchDist = dist;
    lastPanCenter = center;
    updateZoom();
  }
}, { passive: false });

previewCanvas.addEventListener('touchend', e => {
  if (e.touches.length < 2) {
    lastPinchDist = 0;
    lastPanCenter = null;
  }
});

// Mouse wheel zoom
document.getElementById('canvasWrap').addEventListener('wheel', e => {
  e.preventDefault();
  if (state.canvasLocked) return;
  if (e.ctrlKey || e.metaKey) {
    if (e.deltaY < 0) zoomIn(); else zoomOut();
  } else {
    state.panX -= e.deltaX;
    state.panY -= e.deltaY;
    updateZoom();
  }
}, { passive: false });

// ---------- Keyboard Shortcuts ----------
document.addEventListener('keydown', e => {
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT' || e.target.isContentEditable) return;
  
  if (e.ctrlKey && (e.key === 'a' || e.key === 'A')) {
    e.preventDefault();
    if (state.selection) rasterizeSelection();
    document.querySelector('.tool-btn[data-tool="select"]').click();
    
    const layerCanvas = state.layers[state.activeLayerIdx].canvas;
    const selCanvas = createLayerCanvas(state.canvasW, state.canvasH);
    selCanvas.getContext('2d').drawImage(layerCanvas, 0, 0, state.canvasW, state.canvasH, 0, 0, state.canvasW, state.canvasH);
    getActiveCtx().clearRect(0, 0, state.canvasW, state.canvasH);
    
    state.selection = { canvas: selCanvas, x: 0, y: 0, w: state.canvasW, h: state.canvasH };
    drawSelectionPreview();
    renderLayers();
    return;
  }
  
  if (e.key === 'Delete' || e.key === 'Backspace') {
    if (state.tool === 'select' && state.selection) {
      deleteSelection();
    } else {
      if (state.tool === 'move' && state.moveCanvas) {
        state.moveCanvas = null;
        previewCtx.clearRect(0, 0, state.canvasW, state.canvasH);
        state.drawing = false;
      }
      getActiveCtx().clearRect(0, 0, state.canvasW, state.canvasH);
      renderLayers();
      saveHistory();
    }
    return;
  }
  
  if (e.key.startsWith('Arrow')) {
    if (state.tool === 'select' && state.selection) {
      e.preventDefault();
      if (e.key === 'ArrowUp') state.selection.y -= 1;
      if (e.key === 'ArrowDown') state.selection.y += 1;
      if (e.key === 'ArrowLeft') state.selection.x -= 1;
      if (e.key === 'ArrowRight') state.selection.x += 1;
      drawSelectionPreview();
      return;
    }
  }

  if (e.ctrlKey || e.metaKey) {
    if (e.key === 'z') { e.preventDefault(); undo(); }
    else if (e.key === 'y') { e.preventDefault(); redo(); }
    else if (e.key === 's') { e.preventDefault(); saveProject(); }
    else if (e.key === 'n') { e.preventDefault(); newCanvas(); }
    else if (e.key === 'c' || e.key === 'C') { if (state.selection) { e.preventDefault(); copySelection(); } }
    else if (e.key === 'x' || e.key === 'X') { if (state.selection) { e.preventDefault(); cutSelection(); } }
    else if (e.key === 'v' || e.key === 'V') { e.preventDefault(); pasteSelection(); }
  }
  
  if (e.key === 'Enter') {
    if (state.tool === 'move' && state.moveCanvas) rasterizeMove();
    if (state.tool === 'perspective-crop' && state.perspectiveQuad) applyPerspectiveCrop();
  }
});

// ---------- Auto-save ----------
setInterval(() => {
  try {
    const data = {
      canvasW: state.canvasW, canvasH: state.canvasH,
      layers: state.layers.map(l => ({
        name: l.name, visible: l.visible, locked: l.locked, opacity: l.opacity,
        data: l.canvas.toDataURL()
      })),
      texts: Array.from(document.querySelectorAll('.canvas-text')).map(node => ({
        text: node.innerText,
        left: node.style.left, top: node.style.top,
        color: node.style.color, fontSize: node.style.fontSize, fontFamily: node.style.fontFamily,
        fontWeight: node.style.fontWeight, fontStyle: node.style.fontStyle, textDecoration: node.style.textDecoration,
        gradient: node.dataset.gradient
      })),
      activeLayerIdx: state.activeLayerIdx,
      transparent: state.transparent
    };
    localStorage.setItem('smartpaint_autosave', JSON.stringify(data));
  } catch (e) {}
}, 30000);

// Recover on load
function tryRecover() {
  try {
    const saved = localStorage.getItem('smartpaint_autosave');
    if (!saved) return false;
    if (!confirm('Recover unsaved work from last auto-save?')) return false;
    const data = JSON.parse(saved);
    state.canvasW = data.canvasW; state.canvasH = data.canvasH;
    state.transparent = data.transparent || false;
    state.layers = [];
    let loaded = 0;
    data.layers.forEach((ld, i) => {
      const img = new Image();
      img.onload = () => {
        const c = createLayerCanvas(state.canvasW, state.canvasH);
        c.getContext('2d').drawImage(img, 0, 0);
        state.layers[i] = { name: ld.name, visible: ld.visible, locked: ld.locked, opacity: ld.opacity, canvas: c };
        loaded++;
        if (loaded === data.layers.length) {
          state.activeLayerIdx = data.activeLayerIdx || 0;
          [mainCanvas, previewCanvas, gridCanvas].forEach(c => {
            c.width = state.canvasW; c.height = state.canvasH;
            c.style.width = state.canvasW + 'px'; c.style.height = state.canvasH + 'px';
          });
          canvasContainer.style.width = state.canvasW + 'px';
          canvasContainer.style.height = state.canvasH + 'px';
          renderLayers();
          updateZoom();
          if (data.texts) {
            document.getElementById('textLayer').innerHTML = '';
            data.texts.forEach(t => spawnTextNode(parseFloat(t.left), parseFloat(t.top), t));
          }
          saveHistory();
          showPopup('✨ Work recovered');
        }
      };
      img.src = ld.data;
    });
    return true;
  } catch (e) { return false; }
}

// ---------- Drag & Drop ----------
document.body.addEventListener('dragover', e => { e.preventDefault(); });
document.body.addEventListener('drop', e => {
  e.preventDefault();
  const file = e.dataTransfer.files[0];
  if (!file) return;
  const input = document.getElementById('fileInput');
  const dt = new DataTransfer();
  dt.items.add(file);
  input.files = dt.files;
  openFile({ target: input });
});

// ---------- Init ----------
buildSwatches();
initCanvas(1200, 800);
setTimeout(() => {
  if (!tryRecover()) {
    resetZoom();
  }
}, 100);

// Prevent context menu on canvas
previewCanvas.addEventListener('contextmenu', e => e.preventDefault());

// Long press for mobile context
let longPressTimer;
previewCanvas.addEventListener('touchstart', e => {
  if (e.touches.length === 1) {
    longPressTimer = setTimeout(() => {
      const { x, y } = getPos(e);
      pickColor(x, y);
    }, 600);
  }
});
previewCanvas.addEventListener('touchend', () => clearTimeout(longPressTimer));
previewCanvas.addEventListener('touchmove', () => clearTimeout(longPressTimer));

console.log('🎨 Smart Paint loaded! Try drawing shapes in Freehand mode for AI correction.');