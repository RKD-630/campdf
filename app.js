/* ═══════════════ DocScan Pro – app.js ═══════════════ */
'use strict';

// ── State ──
const state = {
  pages: [],          // { dataURL }[]
  stream: null,
  currentImage: null, // ImageBitmap of captured frame
  rotation: 0,
  cropActive: false,
  crop: { x:40, y:40, w:200, h:260 },
  adj: { brightness:0, contrast:0, darkness:0, sharpness:0 },
  preset: 'original',
  textItems: [],
  detectInterval: null,
  flashOn: false,
};

// ── DOM refs ──
const $ = id => document.getElementById(id);
const splash            = $('splash');
const app               = $('app');
const screens           = { home:$('screenHome'), camera:$('screenCamera'), edit:$('screenEdit'), pages:$('screenPages') };
const cameraVideo       = $('cameraVideo');
const overlayCanvas     = $('overlayCanvas');
const editCanvas        = $('editCanvas');
const canvasWrapper     = $('canvasWrapper');
const cropOverlay       = $('cropOverlay');
const cropBox           = $('cropBox');
const textLayer         = $('textLayer');
const detectRing        = $('detectRing');
const detectLabel       = $('detectLabel');
const modalPerm         = $('modalPermission');
const modalProgress     = $('modalProgress');
const progressCircle    = $('progressCircle');
const progressPct       = $('progressPct');
const progressLabel     = $('progressLabel');
const pagesGrid         = $('pagesGrid');
const pageBadge         = $('pageBadge');
const pageCount         = $('pageCount');
const pdfReadyBanner    = $('pdfReadyBanner');

// ── Splash ──
setTimeout(() => {
  splash.classList.add('fade-out');
  setTimeout(() => { splash.classList.add('hidden'); app.classList.remove('hidden'); }, 500);
}, 2200);

// ── Screen switcher ──
function showScreen(name) {
  Object.values(screens).forEach(s => s.classList.remove('active'));
  screens[name].classList.add('active');
}

// ── Toast ──
function toast(msg, type='') {
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.textContent = msg;
  $('toastContainer').appendChild(el);
  setTimeout(() => el.remove(), 2800);
}

// ═══════════ HOME ═══════════
$('btnCamera').addEventListener('click', () => modalPerm.classList.remove('hidden'));
$('btnGallery').addEventListener('click', () => $('galleryInput').click());
$('galleryInput').addEventListener('change', e => {
  const files = [...e.target.files];
  if (!files.length) return;
  Promise.all(files.map(f => new Promise(res => {
    const r = new FileReader();
    r.onload = ev => res(ev.target.result);
    r.readAsDataURL(f);
  }))).then(results => {
    results.forEach(d => state.pages.push({ dataURL: d }));
    updatePageBadge();
    toast(`${results.length} image(s) added`, 'success');
    if (results.length === 1) { loadIntoEditor(results[0]); showScreen('edit'); }
    else { renderPagesGrid(); showScreen('pages'); }
  });
  e.target.value = '';
});

// ═══════════ PERMISSION MODAL ═══════════
$('btnPermAllow').addEventListener('click', async () => {
  modalPerm.classList.add('hidden');
  await startCamera();
});
$('btnPermDeny').addEventListener('click', () => {
  modalPerm.classList.add('hidden');
  toast('Camera access denied', 'error');
});

// ═══════════ CAMERA ═══════════
async function startCamera() {
  try {
    const constraints = { video: { facingMode: 'environment', width: { ideal: 1920 }, height: { ideal: 1080 } } };
    state.stream = await navigator.mediaDevices.getUserMedia(constraints);
    cameraVideo.srcObject = state.stream;
    await cameraVideo.play();
    showScreen('camera');
    startDocumentDetection();
  } catch (err) {
    toast('Camera error: ' + err.message, 'error');
  }
}

function stopCamera() {
  if (state.stream) { state.stream.getTracks().forEach(t => t.stop()); state.stream = null; }
  clearInterval(state.detectInterval);
  detectRing.classList.remove('found');
}

// ── Auto-detect simulation ──
function startDocumentDetection() {
  let detected = false;
  let tick = 0;
  state.detectInterval = setInterval(() => {
    tick++;
    if (tick > 10) {
      detected = true;
      detectRing.classList.add('found');
      detectLabel.textContent = '✓ Document detected – tap to capture';
    } else {
      detectLabel.textContent = 'Searching for document…';
    }
  }, 400);
}

// ── Capture ──
$('btnCapture').addEventListener('click', captureFrame);
function captureFrame() {
  const video = cameraVideo;
  if (!video.videoWidth) { toast('Camera not ready', 'error'); return; }
  const canvas = document.createElement('canvas');
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  canvas.getContext('2d').drawImage(video, 0, 0);
  const dataURL = canvas.toDataURL('image/jpeg', 0.95);
  stopCamera();
  loadIntoEditor(dataURL);
  showScreen('edit');
}

$('btnCamClose').addEventListener('click', () => { stopCamera(); showScreen('home'); });
$('btnFlash').addEventListener('click', () => {
  state.flashOn = !state.flashOn;
  const track = state.stream?.getVideoTracks()[0];
  if (track && track.getCapabilities && track.getCapabilities().torch) {
    track.applyConstraints({ advanced: [{ torch: state.flashOn }] });
  }
  toast(state.flashOn ? 'Flash ON' : 'Flash OFF');
});

// ═══════════ EDITOR ═══════════
function loadIntoEditor(dataURL) {
  state.currentImage = dataURL;
  state.rotation = 0;
  state.adj = { brightness:0, contrast:0, darkness:0, sharpness:0 };
  state.preset = 'original';
  state.textItems = [];
  textLayer.innerHTML = '';
  ['slBrightness','slContrast','slDarkness','slSharpness'].forEach(id => { $(id).value = 0; });
  ['valBrightness','valContrast','valDarkness','valSharpness'].forEach(id => { $(id).textContent = '0'; });
  cropOverlay.classList.add('hidden');
  state.cropActive = false;
  renderEdit();
}

function renderEdit() {
  const img = new Image();
  img.onload = () => {
    let w = img.naturalWidth, h = img.naturalHeight;
    if (state.rotation % 180 !== 0) [w, h] = [h, w];
    const wrapW = canvasWrapper.clientWidth || 360;
    const wrapH = canvasWrapper.clientHeight || 400;
    const scale = Math.min(wrapW / w, wrapH / h, 1);
    editCanvas.width = Math.round(w * scale);
    editCanvas.height = Math.round(h * scale);
    const ctx = editCanvas.getContext('2d');
    ctx.clearRect(0, 0, editCanvas.width, editCanvas.height);
    ctx.save();
    ctx.translate(editCanvas.width / 2, editCanvas.height / 2);
    ctx.rotate((state.rotation * Math.PI) / 180);
    ctx.scale(scale, scale);
    ctx.drawImage(img, -img.naturalWidth / 2, -img.naturalHeight / 2);
    ctx.restore();
    applyFilters(ctx, editCanvas.width, editCanvas.height);
    if (state.cropActive) layoutCropBox(editCanvas.width, editCanvas.height);
  };
  img.src = state.currentImage;
}

function applyFilters(ctx, w, h) {
  const { brightness, contrast, darkness, sharpness } = state.adj;
  const id = ctx.getImageData(0, 0, w, h);
  const d = id.data;
  const bFactor = brightness / 100 * 255;
  const cFactor = (contrast / 100 + 1) ** 2;
  const darkFactor = darkness / 100;
  for (let i = 0; i < d.length; i += 4) {
    let r = d[i], g = d[i+1], b = d[i+2];
    // brightness
    r += bFactor; g += bFactor; b += bFactor;
    // contrast
    r = cFactor * (r - 128) + 128;
    g = cFactor * (g - 128) + 128;
    b = cFactor * (b - 128) + 128;
    // darkness
    r *= (1 - darkFactor); g *= (1 - darkFactor); b *= (1 - darkFactor);
    d[i]   = Math.max(0, Math.min(255, r));
    d[i+1] = Math.max(0, Math.min(255, g));
    d[i+2] = Math.max(0, Math.min(255, b));
  }
  if (sharpness > 0) applySharpen(d, w, h, sharpness / 10);
  ctx.putImageData(id, 0, 0);
}

function applySharpen(d, w, h, amount) {
  const kernel = [0,-1,0,-1,5,-1,0,-1,0];
  const copy = new Uint8ClampedArray(d);
  for (let y = 1; y < h-1; y++) {
    for (let x = 1; x < w-1; x++) {
      for (let c = 0; c < 3; c++) {
        let val = 0;
        for (let ky = -1; ky <= 1; ky++)
          for (let kx = -1; kx <= 1; kx++)
            val += copy[((y+ky)*w+(x+kx))*4+c] * kernel[(ky+1)*3+(kx+1)];
        const idx = (y*w+x)*4+c;
        d[idx] = Math.max(0, Math.min(255, d[idx] + (val - d[idx]) * amount));
      }
    }
  }
}

// ── Sliders ──
function bindSlider(id, key, valId) {
  $(id).addEventListener('input', e => {
    state.adj[key] = +e.target.value;
    $(valId).textContent = e.target.value;
    renderEdit();
  });
}
bindSlider('slBrightness','brightness','valBrightness');
bindSlider('slContrast','contrast','valContrast');
bindSlider('slDarkness','darkness','valDarkness');
bindSlider('slSharpness','sharpness','valSharpness');

// ── Presets ──
window.applyPreset = function(name) {
  const presets = {
    original:  { brightness:0,   contrast:0,   darkness:0,  sharpness:0 },
    magic:     { brightness:15,  contrast:30,  darkness:0,  sharpness:3 },
    grayscale: { brightness:0,   contrast:20,  darkness:0,  sharpness:2 },
    bw:        { brightness:-10, contrast:80,  darkness:20, sharpness:5 },
    enhance:   { brightness:10,  contrast:15,  darkness:0,  sharpness:4 },
  };
  state.adj = { ...presets[name] };
  ['Brightness','Contrast','Darkness','Sharpness'].forEach(k => {
    const key = k.toLowerCase();
    $('sl'+k).value = state.adj[key];
    $('val'+k).textContent = state.adj[key];
  });
  state.preset = name;
  if (name === 'grayscale' || name === 'bw') {
    const ctx = editCanvas.getContext('2d');
    const id = ctx.getImageData(0, 0, editCanvas.width, editCanvas.height);
    const d = id.data;
    for (let i = 0; i < d.length; i+=4) {
      const avg = 0.299*d[i]+0.587*d[i+1]+0.114*d[i+2];
      d[i]=d[i+1]=d[i+2]=avg;
    }
    ctx.putImageData(id,0,0);
  }
  renderEdit();
};

// ── Tabs ──
document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.tool-panel').forEach(p => p.classList.remove('active'));
    btn.classList.add('active');
    $('panel' + btn.dataset.tab.charAt(0).toUpperCase() + btn.dataset.tab.slice(1)).classList.add('active');
  });
});

// ── Rotate ──
$('btnRotate').addEventListener('click', () => { state.rotation = (state.rotation + 90) % 360; renderEdit(); });

// ── Crop ──
function layoutCropBox(cw, ch) {
  const c = state.crop;
  cropBox.style.left   = c.x + 'px';
  cropBox.style.top    = c.y + 'px';
  cropBox.style.width  = c.w + 'px';
  cropBox.style.height = c.h + 'px';
  // masks
  const masks = cropOverlay.querySelectorAll('.crop-mask');
  masks[0].style.cssText = `top:0;left:0;right:0;height:${c.y}px`;
  masks[1].style.cssText = `top:${c.y+c.h}px;left:0;right:0;bottom:0`;
  masks[2].style.cssText = `top:${c.y}px;left:0;width:${c.x}px;height:${c.h}px`;
  masks[3].style.cssText = `top:${c.y}px;left:${c.x+c.w}px;right:0;height:${c.h}px`;
}

$('btnCropToggle').addEventListener('click', () => {
  state.cropActive = !state.cropActive;
  if (state.cropActive) {
    const cw = editCanvas.width, ch = editCanvas.height;
    state.crop = { x: Math.round(cw*.1), y: Math.round(ch*.1), w: Math.round(cw*.8), h: Math.round(ch*.8) };
    cropOverlay.classList.remove('hidden');
    layoutCropBox(cw, ch);
    $('btnCropToggle').textContent = 'Cancel Crop';
  } else {
    cropOverlay.classList.add('hidden');
    $('btnCropToggle').innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 2 6 8 2 8"/><polyline points="18 22 18 16 22 16"/><path d="M2 8h14a2 2 0 0 1 2 2v10"/><path d="M22 16H8a2 2 0 0 1-2-2V2"/></svg> Manual Crop';
  }
});

$('btnAutoCrop').addEventListener('click', () => {
  state.cropActive = true;
  const cw = editCanvas.width, ch = editCanvas.height;
  state.crop = { x: Math.round(cw*.05), y: Math.round(ch*.05), w: Math.round(cw*.9), h: Math.round(ch*.9) };
  cropOverlay.classList.remove('hidden');
  layoutCropBox(cw, ch);
  toast('Auto crop applied – adjust handles if needed', 'success');
});

$('btnApplyCrop').addEventListener('click', () => {
  if (!state.cropActive) { toast('Enable crop first'); return; }
  const ctx = editCanvas.getContext('2d');
  const { x, y, w, h } = state.crop;
  const id = ctx.getImageData(x, y, w, h);
  const tmp = document.createElement('canvas');
  tmp.width = w; tmp.height = h;
  tmp.getContext('2d').putImageData(id, 0, 0);
  state.currentImage = tmp.toDataURL('image/jpeg', 0.95);
  state.cropActive = false;
  cropOverlay.classList.add('hidden');
  renderEdit();
  toast('Crop applied', 'success');
});

// ── Crop drag ──
let dragState = null;
cropBox.addEventListener('pointerdown', e => {
  if (e.target.classList.contains('crop-handle')) return;
  dragState = { type:'move', startX:e.clientX, startY:e.clientY, ox:state.crop.x, oy:state.crop.y };
  e.currentTarget.setPointerCapture(e.pointerId);
});
cropBox.addEventListener('pointermove', e => {
  if (!dragState) return;
  const dx = e.clientX - dragState.startX, dy = e.clientY - dragState.startY;
  state.crop.x = Math.max(0, dragState.ox + dx);
  state.crop.y = Math.max(0, dragState.oy + dy);
  layoutCropBox(editCanvas.width, editCanvas.height);
});
cropBox.addEventListener('pointerup', () => dragState = null);

document.querySelectorAll('.crop-handle').forEach(h => {
  h.addEventListener('pointerdown', e => {
    e.stopPropagation();
    dragState = { type:'resize', dir:h.dataset.dir, startX:e.clientX, startY:e.clientY, ...state.crop };
    h.setPointerCapture(e.pointerId);
  });
  h.addEventListener('pointermove', e => {
    if (!dragState || dragState.type !== 'resize') return;
    const dx = e.clientX - dragState.startX, dy = e.clientY - dragState.startY;
    let { x, y, w, h: hh } = dragState;
    const dir = dragState.dir;
    if (dir.includes('e')) w = Math.max(40, dragState.w + dx);
    if (dir.includes('s')) hh = Math.max(40, dragState.h + dy);
    if (dir.includes('w')) { x = dragState.x + dx; w = Math.max(40, dragState.w - dx); }
    if (dir.includes('n')) { y = dragState.y + dy; hh = Math.max(40, dragState.h - dy); }
    state.crop = { x, y, w, h: hh };
    layoutCropBox(editCanvas.width, editCanvas.height);
  });
  h.addEventListener('pointerup', () => dragState = null);
});

// ── Text ──
$('btnAddText').addEventListener('click', () => {
  const txt = $('textInput').value.trim();
  if (!txt) { toast('Enter text first'); return; }
  const color = $('colorText').value;
  const bg = $('chkTransparent').checked ? 'transparent' : $('colorTextBg').value;
  const size = $('fontSize').value;
  const font = $('fontFamily').value;
  addTextItem(txt, color, bg, size, font);
  $('textInput').value = '';
});

function addTextItem(txt, color, bg, size, font) {
  const el = document.createElement('div');
  el.className = 'draggable-text';
  el.textContent = txt;
  Object.assign(el.style, {
    position:'absolute', left:'10%', top:'10%',
    color, background: bg, fontSize: size+'px', fontFamily: font,
    padding: bg === 'transparent' ? '0' : '4px 10px',
    borderRadius:'6px', cursor:'move', userSelect:'none',
    pointerEvents:'all', maxWidth:'80%', wordBreak:'break-word',
    border: '1px dashed rgba(255,255,255,.4)',
  });
  textLayer.style.pointerEvents = 'all';
  textLayer.appendChild(el);
  makeDraggable(el);
  // double-tap to delete
  el.addEventListener('dblclick', () => el.remove());
}

function makeDraggable(el) {
  let ox=0, oy=0, sx=0, sy=0;
  el.addEventListener('pointerdown', e => {
    sx = e.clientX; sy = e.clientY;
    const r = el.getBoundingClientRect();
    const wr = textLayer.getBoundingClientRect();
    ox = r.left - wr.left; oy = r.top - wr.top;
    el.setPointerCapture(e.pointerId);
  });
  el.addEventListener('pointermove', e => {
    const dx = e.clientX - sx, dy = e.clientY - sy;
    el.style.left = (ox + dx) + 'px';
    el.style.top  = (oy + dy) + 'px';
  });
}

// ── Done ──
$('btnAddToDoc').addEventListener('click', () => {
  // flatten text onto canvas
  const ctx = editCanvas.getContext('2d');
  [...textLayer.children].forEach(el => {
    const wr = canvasWrapper.getBoundingClientRect();
    const er = el.getBoundingClientRect();
    const scaleX = editCanvas.width / wr.width;
    const scaleY = editCanvas.height / wr.height;
    const x = (er.left - wr.left) * scaleX;
    const y = (er.top  - wr.top)  * scaleY;
    const size = parseFloat(el.style.fontSize) * scaleX;
    ctx.font = `${size}px ${el.style.fontFamily}`;
    if (el.style.background && el.style.background !== 'transparent') {
      ctx.fillStyle = el.style.background;
      ctx.fillRect(x, y - size, el.offsetWidth * scaleX, el.offsetHeight * scaleY);
    }
    ctx.fillStyle = el.style.color;
    ctx.fillText(el.textContent, x, y);
  });
  const dataURL = editCanvas.toDataURL('image/jpeg', 0.92);
  state.pages.push({ dataURL });
  updatePageBadge();
  renderPagesGrid();
  pdfReadyBanner.classList.remove('hidden');
  toast('Page added!', 'success');
  showScreen('home');
});

$('btnEditBack').addEventListener('click', () => { stopCamera(); showScreen('home'); });

// ═══════════ PAGES ═══════════
function updatePageBadge() {
  pageBadge.textContent = state.pages.length;
  pageCount.textContent = state.pages.length;
}

function renderPagesGrid() {
  pagesGrid.innerHTML = '';
  state.pages.forEach((pg, i) => {
    const card = document.createElement('div');
    card.className = 'page-card';
    card.innerHTML = `<img src="${pg.dataURL}" alt="Page ${i+1}" /><span class="page-num">Page ${i+1}</span><button class="del-page" data-i="${i}">✕</button>`;
    card.querySelector('.del-page').addEventListener('click', () => {
      state.pages.splice(i, 1);
      updatePageBadge();
      renderPagesGrid();
      if (!state.pages.length) pdfReadyBanner.classList.add('hidden');
    });
    pagesGrid.appendChild(card);
  });
}

$('btnPages').addEventListener('click', () => { renderPagesGrid(); showScreen('pages'); });
$('btnPagesBack').addEventListener('click', () => showScreen('home'));
$('btnAddMorePages').addEventListener('click', () => showScreen('home'));

// ═══════════ PDF ═══════════
$('btnDownloadPDF').addEventListener('click', generatePDF);

async function generatePDF() {
  if (!state.pages.length) { toast('No pages to export', 'error'); return; }
  modalProgress.classList.remove('hidden');
  await tick();
  try {
    const { jsPDF } = window.jspdf;
    const total = state.pages.length;
    for (let i = 0; i < total; i++) {
      const pct = Math.round(((i + 0.5) / total) * 100);
      updateProgress(pct, `Processing page ${i+1} of ${total}…`);
      await tick();
      const img = await loadImg(state.pages[i].dataURL);
      const isLandscape = img.width > img.height;
      if (i === 0) {
        var pdf = new jsPDF({ orientation: isLandscape ? 'l' : 'p', unit: 'px', format: [img.width, img.height] });
      } else {
        pdf.addPage([img.width, img.height], isLandscape ? 'l' : 'p');
      }
      pdf.addImage(state.pages[i].dataURL, 'JPEG', 0, 0, img.width, img.height);
    }
    updateProgress(100, 'Saving PDF…');
    await tick();
    pdf.save('DocScan_Pro.pdf');
    modalProgress.classList.add('hidden');
    toast('PDF downloaded!', 'success');
    offerReset();
  } catch (err) {
    modalProgress.classList.add('hidden');
    toast('PDF error: ' + err.message, 'error');
  }
}

function updateProgress(pct, label) {
  const circ = 2 * Math.PI * 26;
  progressCircle.style.strokeDashoffset = circ - (circ * pct / 100);
  progressPct.textContent = pct + '%';
  progressLabel.textContent = label;
}

function loadImg(src) {
  return new Promise((res, rej) => {
    const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = src;
  });
}

function tick() { return new Promise(r => setTimeout(r, 30)); }

function offerReset() {
  state.pages = [];
  updatePageBadge();
  renderPagesGrid();
  pdfReadyBanner.classList.add('hidden');
  showScreen('home');
  toast('Ready for next scan!', 'success');
}
