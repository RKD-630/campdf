(function(){
'use strict';
/* ================= UTILS ================= */
const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const pad2=n=>String(n+1).padStart(2,'0'), pad3=n=>String(n+1).padStart(3,'0');
const uid=()=> 'p'+Math.random().toString(36).slice(2,9)+Date.now().toString(36).slice(-3);
const tick=()=>new Promise(r=>setTimeout(r,0));
const fmtBytes=b=> b<1024?b+' B' : b<1048576?(b/1024).toFixed(1)+' KB' : (b/1048576).toFixed(2)+' MB';
const isMobile=()=>innerWidth<761, isNarrow=()=>innerWidth<1100;
const ICONS={
upload:'<path d="M12 16V4"/><path d="m6 9 6-6 6 6"/><path d="M4 20h16"/>',
download:'<path d="M12 4v12"/><path d="m7 11 5 5 5-5"/><path d="M5 20h14"/>',
plus:'<path d="M12 5v14M5 12h14"/>', minus:'<path d="M5 12h14"/>', x:'<path d="M6 6l12 12M18 6 6 18"/>', check:'<path d="m4 12.5 5 5L20 7"/>',
hash:'<path d="M4 9h16M4 15h16M10 3L8 21M16 3l-2 18"/>', alignL:'<path d="M4 6h16M4 12h10M4 18h14"/>', alignC:'<path d="M4 6h16M7 12h10M5 18h14"/>', alignR:'<path d="M4 6h16M10 12h10M6 18h14"/>',
trash:'<path d="M4 7h16"/><path d="M9 7V4h6v3"/><path d="M6.5 7 7.5 20h9L17.5 7"/><path d="M10 11v5M14 11v5"/>',
grip:'<g fill="currentColor" stroke="none"><circle cx="9" cy="6" r="1.4"/><circle cx="15" cy="6" r="1.4"/><circle cx="9" cy="12" r="1.4"/><circle cx="15" cy="12" r="1.4"/><circle cx="9" cy="18" r="1.4"/><circle cx="15" cy="18" r="1.4"/></g>',
undo:'<path d="M9 14 4 9l5-5"/><path d="M4 9h10a6 6 0 0 1 0 12h-4"/>',
redo:'<path d="m15 14 5-5-5-5"/><path d="M20 9H10a6 6 0 0 0 0 12h4"/>',
crop:'<path d="M6.13 1 6 16a2 2 0 0 0 2 2h15"/><path d="M1 6.13 16 6a2 2 0 0 1 2 2v15"/>',
sun:'<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
contrast:'<circle cx="12" cy="12" r="9"/><path d="M12 3a9 9 0 0 1 0 18Z" fill="currentColor" stroke="none"/>',
moon:'<path d="M20.5 14.5A8.5 8.5 0 1 1 9.5 3.5a7 7 0 0 0 11 11Z"/>',
type:'<path d="M5 7V4h14v3"/><path d="M12 4v16"/><path d="M9 20h6"/>',
eraser:'<path d="m6.5 21-3.7-3.7a2 2 0 0 1 0-2.8L13.9 3.4a2 2 0 0 1 2.8 0l4 4a2 2 0 0 1 0 2.8L11.5 21Z"/><path d="M6 11.5 12.5 18"/><path d="M6.5 21H21"/>',
replace:'<path d="m17 3 4 4-4 4"/><path d="M21 7H8a4 4 0 0 0-4 4"/><path d="m7 21-4-4 4-4"/><path d="M3 17h13a4 4 0 0 0 4-4"/>',
chevL:'<path d="m14 6-6 6 6 6"/>', chevR:'<path d="m10 6 6 6-6 6"/>',
arrowL:'<path d="M20 12H4"/><path d="m10 6-6 6 6 6"/>', arrowR:'<path d="M4 12h16"/><path d="m14 6 6 6-6 6"/>',
arrowU:'<path d="M12 20V4"/><path d="m6 10 6-6 6 6"/>', arrowD:'<path d="M12 4v16"/><path d="m6 14 6 6 6-6"/>',
grid:'<rect x="3" y="3" width="7.5" height="7.5" rx="1.5"/><rect x="13.5" y="3" width="7.5" height="7.5" rx="1.5"/><rect x="3" y="13.5" width="7.5" height="7.5" rx="1.5"/><rect x="13.5" y="13.5" width="7.5" height="7.5" rx="1.5"/>',
list:'<path d="M8.5 6h12M8.5 12h12M8.5 18h12"/><g fill="currentColor" stroke="none"><circle cx="4" cy="6" r="1.4"/><circle cx="4" cy="12" r="1.4"/><circle cx="4" cy="18" r="1.4"/></g>',
dots:'<g fill="currentColor" stroke="none"><circle cx="12" cy="5" r="1.7"/><circle cx="12" cy="12" r="1.7"/><circle cx="12" cy="19" r="1.7"/></g>',
archive:'<rect x="2.5" y="3.5" width="19" height="5" rx="1"/><path d="M4.5 8.5V19a1.5 1.5 0 0 0 1.5 1.5h12a1.5 1.5 0 0 0 1.5-1.5V8.5"/><path d="M10 12.5h4"/>',
file:'<path d="M14 2.5H7A1.5 1.5 0 0 0 5.5 4v16A1.5 1.5 0 0 0 7 21.5h10a1.5 1.5 0 0 0 1.5-1.5V7Z"/><path d="M14 2.5V7h4.5"/>',
image:'<rect x="3.5" y="4.5" width="17" height="15" rx="2"/><circle cx="9" cy="10" r="1.6"/><path d="m20.5 15.5-4.5-4.5L7 20"/>',
pages:'<rect x="9" y="9" width="12.5" height="12.5" rx="2"/><path d="M5.5 15h-1a2 2 0 0 1-2-2V4.5a2 2 0 0 1 2-2H13a2 2 0 0 1 2 2v1"/>',
pencil:'<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7.5 18.5 3 20l1.5-4.5Z"/>',
shield:'<path d="M12 22s7.5-3.5 7.5-9.5V5.5L12 2.5l-7.5 3v7C4.5 18.5 12 22 12 22Z"/><path d="m9 11.5 2 2 4-4"/>',
alert:'<path d="M12 3 1.8 20.2h20.4Z"/><path d="M12 9.5V14"/><path d="M12 17.5h.01"/>',
camera:'<rect x="2.5" y="7" width="19" height="13" rx="2"/><path d="M8.5 7 10 4.5h4L15.5 7"/><circle cx="12" cy="13" r="3.5"/>',
blank:'<rect x="4.5" y="2.5" width="15" height="19" rx="2"/><path d="M9 8h6M9 12h6M9 16h4"/>',
sparkle:'<path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9Z"/>',
rotL:'<path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/>',
rotR:'<path d="M21 12a9 9 0 1 1-9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/>',
settings:'<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1Z"/>'};
const ic=(n,cls='')=>`<svg class="${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[n]}</svg>`;
const esc=s=>String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));

/* ================= STATE ================= */
const state={ pages:[], selection:new Set(), view: isMobile()?'list':'grid', editingId:null, tool:'' };
const sources=new Map(); let srcSeq=0, pdfSeq=0;
const hist={stack:[],i:-1};
const brush={px:26,opacity:1,color:'#ffffff'};
const textDefaults={font:'Helvetica',size:30,bold:false,italic:false,underline:false,color:'#171b26',align:'left',opacity:1,spacing:0};
let selectedTextId=null, lastExport=null, replaceTargetId=null, fontsReady=false;

const FONTS=[
 {name:'Arial',css:'Arial, Helvetica, sans-serif'},{name:'Helvetica',css:'Helvetica, Arial, sans-serif'},
 {name:'Times New Roman',css:'"Times New Roman", Times, serif'},{name:'Georgia',css:'Georgia, serif'},
 {name:'Verdana',css:'Verdana, sans-serif'},{name:'Courier New',css:'"Courier New", Courier, monospace'},
 {name:'Roboto',css:'Roboto, sans-serif'},{name:'Open Sans',css:'"Open Sans", sans-serif'},
 {name:'Montserrat',css:'Montserrat, sans-serif'}];
const fontCss=n=>(FONTS.find(f=>f.name===n)||FONTS[1]).css;
const FONT_PRELOAD=FONTS.filter(f=>!['Arial','Helvetica','Times New Roman','Georgia','Verdana','Courier New'].includes(f.name))
  .flatMap(f=>[`400 32px "${f.name}"`,`700 32px "${f.name}"`,`italic 400 32px "${f.name}"`]);

function regSrc(src){ const id='s'+(++srcSeq); src.id=id; sources.set(id,src); return id; }
const getSrc=id=>sources.get(id);
function makePage(srcId,w,h,meta){ return {id:uid(),srcId,w,h,ptype:meta.ptype,fileName:meta.fileName,tag:meta.tag,
  crop:null,bright:0,contrast:0,dark:0,hue:0,texts:[],erasures:[],v:0,rot:0}; }
const currentPage=()=>state.pages.find(p=>p.id===state.editingId)||null;
const idxOf=id=>state.pages.findIndex(p=>p.id===id);
const cropOf=p=>p.crop||{x:0,y:0,w:1,h:1};

/* ================= HISTORY ================= */
function serializePages(){ return JSON.stringify(state.pages.map(p=>({id:p.id,srcId:p.srcId,w:p.w,h:p.h,ptype:p.ptype,
  fileName:p.fileName,tag:p.tag,crop:p.crop,bright:p.bright,contrast:p.contrast,dark:p.dark,hue:p.hue,texts:p.texts,erasures:p.erasures,rot:p.rot}))); }
function pushHistory(){ const snap=serializePages(); if(hist.stack[hist.i]===snap) return;
  hist.stack=hist.stack.slice(0,hist.i+1); hist.stack.push(snap); if(hist.stack.length>80) hist.stack.shift();
  hist.i=hist.stack.length-1; updateHistUI(); }
function restore(snap){ state.pages=JSON.parse(snap).map(o=>Object.assign(o,{v:0}));
  [...state.selection].forEach(id=>{ if(!state.pages.some(p=>p.id===id)) state.selection.delete(id); });
  selectedTextId=null;
  if(state.editingId && !state.pages.some(p=>p.id===state.editingId)) closeEditor(true);
  renderWorkspace(); if(state.editingId){ refreshEditor(); } }
function undo(){ if(hist.i>0){ hist.i--; restore(hist.stack[hist.i]); updateHistUI(); } }
function redo(){ if(hist.i<hist.stack.length-1){ hist.i++; restore(hist.stack[hist.i]); updateHistUI(); } }
function updateHistUI(){ const canU=hist.i>0, canR=hist.i<hist.stack.length-1;
  [['#btnUndo',canU],['#btnRedo',canR],['#edUndo',canU],['#edRedo',canR],['#mbUndo',canU],['#mbRedo',canR]]
  .forEach(([s,v])=>{ const el=$(s); if(el) el.disabled=!v; }); }

/* ================= RENDER CORE ================= */
const baseCache=new Map();
async function getBase(src,width){
  const bucket=clamp(Math.round(width/64)*64,160,2600), key=src.id+'|'+bucket;
  if(baseCache.has(key)) return baseCache.get(key);
  let cv;
  if(src.kind==='pdf'){
    const page=await src.doc.getPage(src.pageNum);
    const vp1=page.getViewport({scale:1}), s=bucket/vp1.width, vp=page.getViewport({scale:s});
    cv=document.createElement('canvas'); cv.width=Math.round(vp.width); cv.height=Math.round(vp.height);
    await page.render({canvasContext:cv.getContext('2d'),viewport:vp}).promise;
  } else if(src.kind==='image'){
    const s=bucket/src.w; cv=document.createElement('canvas');
    cv.width=Math.round(src.w*s); cv.height=Math.round(src.h*s);
    const ctx=cv.getContext('2d'); ctx.fillStyle='#fff'; ctx.fillRect(0,0,cv.width,cv.height);
    ctx.drawImage(src.img,0,0,cv.width,cv.height);
  } else { cv=document.createElement('canvas'); cv.width=src.w; cv.height=src.h;
    const ctx=cv.getContext('2d'); ctx.fillStyle=src.color||'#fff'; ctx.fillRect(0,0,cv.width,cv.height); }
  baseCache.set(key,cv); if(baseCache.size>44) baseCache.delete(baseCache.keys().next().value);
  return cv;
}
function pixelAdjust(ctx,w,h,b,c){
  const d=ctx.getImageData(0,0,w,h), px=d.data, cf=(100+c)/100, ba=b*1.2;
  for(let i=0;i<px.length;i+=4){ for(let k=0;k<3;k++){ let v=px[i+k]+ba; v=(v-128)*cf+128; px[i+k]=v<0?0:v>255?255:v; } }
  ctx.putImageData(d,0,0);
}
async function ensureFonts(){ if(fontsReady) return; try{ await Promise.all(FONT_PRELOAD.map(f=>document.fonts.load(f))); await document.fonts.ready; }catch(e){} fontsReady=true; }
function drawStroke(ctx,st,outW,outH,crop){
  const pts=st.points; if(!pts.length) return;
  ctx.save(); ctx.globalAlpha=st.opacity; ctx.strokeStyle=st.color; ctx.fillStyle=st.color;
  ctx.lineWidth=st.size*outW; ctx.lineCap='round'; ctx.lineJoin='round';
  const X=n=>(n.x-crop.x)/crop.w*outW, Y=n=>(n.y-crop.y)/crop.h*outH;
  if(pts.length===1){ ctx.beginPath(); ctx.arc(X(pts[0].x),Y(pts[0].y),st.size*outW/2,0,7); ctx.fill(); }
  else { ctx.beginPath(); ctx.moveTo(X(pts[0].x),Y(pts[0].y));
    for(let i=1;i<pts.length;i++) ctx.lineTo(X(pts[i].x),Y(pts[i].y)); ctx.stroke(); }
  ctx.restore();
}
function fontString(t,px){ return `${t.italic?'italic ':''}${t.bold?'bold ':''}${px}px ${fontCss(t.font)}`; }
function layoutLines(ctx,t,fontPx,maxW){
  const sp=t.spacing||0, paras=String(t.text===''?' ':t.text).split('\n'), lines=[];
  const wOf=s=>{ let w=ctx.measureText(s).width; if(sp&&s.length>1) w+=sp*(s.length-1); return w; };
  for(const para of paras){ if(!para.length){ lines.push(''); continue; }
    const words=para.split(/\s+/).filter(Boolean); let line='';
    for(const wd of words){ const test=line?line+' '+wd:wd;
      if(wOf(test)<=maxW||!line){ line=test; }
      else{ lines.push(line);
        if(wOf(wd)>maxW){ let chunk=''; for(const ch of wd){ if(wOf(chunk+ch)>maxW&&chunk){lines.push(chunk);chunk=ch;} else chunk+=ch; } line=chunk; }
        else line=wd; } }
    lines.push(line); }
  return lines;
}
function drawTextOnCanvas(ctx,t,outW,outH,crop){
  const fontPx=t.size*outW/800, lineH=fontPx*1.3;
  const x=(t.x-crop.x)/crop.w*outW, y=(t.y-crop.y)/crop.h*outH, wPx=t.w/crop.w*outW;
  ctx.save(); ctx.font=fontString(t,fontPx); ctx.textBaseline='alphabetic';
  const lines=layoutLines(ctx,t,fontPx,wPx), sp=t.spacing||0;
  ctx.globalAlpha=clamp(t.opacity,0,1); 
  if(t.bgColor) {
    ctx.fillStyle=t.bgColor;
    ctx.fillRect(x, y, wPx, lines.length*lineH + fontPx*0.1);
  }
  ctx.fillStyle=t.color;
  if(t.shadowColor) {
    ctx.shadowColor = t.shadowColor;
    ctx.shadowBlur = Math.max(2, fontPx * 0.1);
    ctx.shadowOffsetX = Math.max(1, fontPx * 0.05);
    ctx.shadowOffsetY = Math.max(1, fontPx * 0.05);
  }
  lines.forEach((line,i)=>{ const base=y+fontPx*0.94+i*lineH; let lw=ctx.measureText(line).width; if(sp&&line.length>1) lw+=sp*(line.length-1);
    let sx=x; if(t.align==='center') sx=x+(wPx-lw)/2; else if(t.align==='right') sx=x+wPx-lw;
    if(sp){ let cx=sx; for(const ch of line){ ctx.fillText(ch,cx,base); cx+=ctx.measureText(ch).width+sp; } }
    else ctx.fillText(line,sx,base);
    if(t.underline){ ctx.fillRect(sx,base+fontPx*0.09,lw,Math.max(1,fontPx*0.06)); } });
  ctx.restore(); return lines.length*lineH;
}
async function getRotatedBase(p, src, width){
  const base = await getBase(src, width);
  if(!p.rot) return base;
  const cv = document.createElement('canvas');
  if(p.rot===90 || p.rot===270){ cv.width=base.height; cv.height=base.width; }
  else { cv.width=base.width; cv.height=base.height; }
  const ctx = cv.getContext('2d');
  ctx.translate(cv.width/2, cv.height/2);
  ctx.rotate(p.rot * Math.PI/180);
  ctx.drawImage(base, -base.width/2, -base.height/2);
  return cv;
}
async function composePage(p,outW,{text=true,erase=true}={}){
  outW=Math.min(outW,2600);
  const crop=cropOf(p), src=getSrc(p.srcId);
  const cw=crop.w*p.w, ch=crop.h*p.h;
  const base=await getRotatedBase(p, src, outW/crop.w), s=base.width/p.w;
  const W=Math.max(1,Math.round(outW)), H=Math.max(1,Math.round(outW*ch/cw));
  const cv=document.createElement('canvas'); cv.width=W; cv.height=H;
  const ctx=cv.getContext('2d'); ctx.fillStyle='#fff'; ctx.fillRect(0,0,W,H);
  const useFilter='filter' in ctx; ctx.save();
  if(useFilter&&(p.bright||p.contrast||p.hue)) ctx.filter=`brightness(${1+p.bright/100}) contrast(${1+p.contrast/100}) hue-rotate(${p.hue*1.8}deg)`;
  ctx.drawImage(base,crop.x*p.w*s,crop.y*p.h*s,cw*s,ch*s,0,0,W,H); ctx.restore();
  if(!useFilter&&(p.bright||p.contrast)) pixelAdjust(ctx,W,H,p.bright,p.contrast);
  if(p.dark>0){ ctx.fillStyle=`rgba(10,12,18,${p.dark/100*0.88})`; ctx.fillRect(0,0,W,H); }
  else if(p.dark<0){ ctx.fillStyle=`rgba(255,255,255,${-p.dark/100*0.88})`; ctx.fillRect(0,0,W,H); }
  if(erase) for(const st of p.erasures) drawStroke(ctx,st,W,H,crop);
  if(text){ await ensureFonts(); for(const t of p.texts) drawTextOnCanvas(ctx,t,W,H,crop); }
  return cv;
}

/* ================= THUMBNAILS ================= */
const cardEls=new Map(), visibleThumbs=new Set();
const io=new IntersectionObserver(es=>{ for(const e of es){ const id=e.target.dataset.id;
  if(e.isIntersecting){ visibleThumbs.add(id); renderThumbById(id); } else visibleThumbs.delete(id); } },
  {rootMargin:'380px'});
async function renderThumbById(id){
  const p=state.pages.find(x=>x.id===id); const holder=cardEls.get(id)?.querySelector('.thumb-box');
  if(!p||!holder) return;
  if(p._tv===p.v&&holder.querySelector('canvas')) return;
  holder.classList.add('loading');
  try{ const cv=await composePage(p,isMobile()?340:460); cv.className='thumb-cv';
    if(p._tv===p.v&&holder.querySelector('canvas')){holder.classList.remove('loading');return;}
    holder.replaceChildren(cv); p._tv=p.v; }
  catch(e){ holder.innerHTML='<div class="thumb-err">Preview failed</div>'; }
  holder.classList.remove('loading');
}
function markDirty(pages){ pages.forEach(p=>p.v++); visibleThumbs.forEach(renderThumbById);
  if(state.editingId&&pages.some(p=>p.id===state.editingId)) refreshEditor(); renderRail(); }

/* ================= IMPORT ================= */
const IMG_EXT=['jpg','jpeg','png','webp','gif','bmp','tif','tiff','svg','heic','heif'];
async function decodeImage(file){
  const ext=(file.name.split('.').pop()||'').toLowerCase();
  try{ const bmp=await createImageBitmap(file,{imageOrientation:'from-image'});
    return {img:bmp,w:bmp.width||1024,h:bmp.height||1024}; }catch(e){}
  try{ const url=URL.createObjectURL(file), img=new Image();
    await new Promise((res,rej)=>{ img.onload=res; img.onerror=rej; img.src=url; });
    await img.decode?.().catch(()=>{});
    return {img,w:img.naturalWidth||1024,h:img.naturalHeight||1024}; }catch(e){}
  throw new Error(ext==='heic'||ext==='heif'
    ? 'HEIC/HEIF isn\'t supported by this browser — please convert it to JPG or PNG first.'
    : ext==='tif'||ext==='tiff' ? 'This browser can\'t decode TIFF. Please convert it to JPG or PNG.'
    : 'The image could not be decoded — the file may be corrupted.');
}
async function importFiles(fileList,opts={}){
  const files=[...fileList]; if(!files.length) return {added:0};
  const at=opts.atIndex??state.pages.length;
  showLoader('Importing files…');
  const added=[], errs=[]; 
  for(let fi=0;fi<files.length;fi++){
    const f=files[fi], ext=(f.name.split('.').pop()||'').toLowerCase();
    try{
      if(ext==='pdf'||f.type==='application/pdf'){
        setLoader(fi/files.length,`Opening ${f.name}…`); await tick();
        const buf=await f.arrayBuffer();
        let doc; try{ doc=await pdfjsLib.getDocument({data:buf}).promise; }
        catch(e){ throw new Error(/password/i.test(e&&e.message||'')
          ? 'This PDF is password-protected. Remove the password and try again.'
          : 'Unable to open this PDF. Please check that the file is a valid, uncorrupted PDF.'); }
        pdfSeq++;
        for(let i=1;i<=doc.numPages;i++){
          setLoader((fi+(i/doc.numPages))/files.length,`Processing page ${i} of ${doc.numPages} — ${f.name}`);
          const pg=await doc.getPage(i), vp=pg.getViewport({scale:1});
          const srcId=regSrc({kind:'pdf',doc,pageNum:i});
          added.push(makePage(srcId,vp.width,vp.height,{ptype:'pdf',fileName:f.name,tag:`PDF ${pad2(pdfSeq-1)} · Page ${i}`}));
          await tick();
        }
      } else if(IMG_EXT.includes(ext)||(f.type||'').startsWith('image/')){
        setLoader(fi/files.length,`Reading ${f.name}…`);
        const {img,w,h}=await decodeImage(f);
        added.push(makePage(regSrc({kind:'image',img,w,h}),w,h,{ptype:'image',fileName:f.name,tag:'Image'}));
      } else errs.push({name:f.name,msg:'Unsupported format'});
    }catch(e){ errs.push({name:f.name,msg:e.message||'Could not process this file.'}); }
  }
  hideLoader();
  if(added.length){ state.pages.splice(at,0,...added); pushHistory(); renderWorkspace(); }
  if(errs.length) toast(errs.length===1
      ? `Couldn't import “${errs[0].name}” — ${errs[0].msg}`
      : `Couldn't import ${errs.length} file(s). ${errs[0].msg}`,
    'err',{label:'Try again',fn:()=>$('#fileImport').click()});
  else if(added.length) toast(`Imported ${added.length} page${added.length>1?'s':''}`,'ok');
  return {added:added.length};
}

/* ================= WORKSPACE ================= */
function renderWorkspace(){
  const n=state.pages.length;
  $('#emptyState').hidden=n>0; $('#workspace').hidden=n===0;
  document.body.classList.toggle('has-doc',n>0);
  const files=new Set(state.pages.map(p=>p.fileName)).size;
  $('#docMeta').textContent=`${n} page${n===1?'':'s'} · ${files} source file${files===1?'':'s'}`;
  const area=$('#pageArea'); 
  const isMini = area.classList.contains('zoom-mini');
  area.className=state.view + (isMini ? ' zoom-mini' : ''); 
  area.innerHTML='';
  cardEls.clear(); io.disconnect?.(); visibleThumbs.clear();
  state.pages.forEach((p,i)=>{ const el=cardEl(p,i); cardEls.set(p.id,el); area.appendChild(el);
    io.observe(el.querySelector('.thumb-box')); });
  updateSelectionUI(); updateHistUI();
}
function cardEl(p,i){
  const el=document.createElement('article');
  el.className='pcard'+(state.selection.has(p.id)?' selected':'');
  el.dataset.id=p.id; el.setAttribute('role','listitem'); el.tabIndex=0;
  el.style.animationDelay=Math.min(i*22,330)+'ms';
  el.setAttribute('aria-label',`Page ${i+1}: ${p.fileName}`);
  const badge=p.ptype==='pdf'?'<span class="badge acc pc-badge">PDF</span>':p.ptype==='blank'?'<span class="badge amb pc-badge">BLANK</span>':'<span class="badge pc-badge">IMG</span>';
  el.innerHTML=`
    <div class="pc-top">
      <label class="pcheck"><input type="checkbox" aria-label="Select page ${i+1}" ${state.selection.has(p.id)?'checked':''}><span class="box">${ic('check')}</span></label>
      <div class="pc-names"><span class="pc-num">${pad2(i)}</span></div>
      <button class="icon-btn pa-more" data-act="menu" aria-label="Page actions" style="width:34px;height:34px">${ic('dots')}</button>
    </div>
    <div class="pc-thumb"><div class="thumb-box" data-id="${p.id}">${badge}</div></div>
    <div class="pc-actions">
      <button class="pa-btn" data-act="rotL" title="Rotate left" aria-label="Rotate left">${ic('rotL')}</button>
      <button class="pa-btn" data-act="rotR" title="Rotate right" aria-label="Rotate right">${ic('rotR')}</button>
      <button class="pa-btn" data-act="edit" title="Edit" aria-label="Edit">${ic('pencil')}</button>
      <button class="pa-btn" data-act="replace" title="Replace" aria-label="Replace">${ic('replace')}</button>
      <button class="pa-btn danger" data-act="remove" title="Remove" aria-label="Remove">${ic('trash')}</button>
      <button class="pa-btn mv" data-act="left" title="Move left" aria-label="Move left">${ic('chevL')}</button>
      <button class="pa-btn mv" data-act="right" title="Move right" aria-label="Move right">${ic('chevR')}</button>
      <button class="pa-grip" data-drag aria-label="Drag to reorder">${ic('grip')}</button>
    </div>`;
  el.querySelector('input[type=checkbox]').addEventListener('change',e=>{ e.stopPropagation(); toggleSelect(p.id,e.target.checked); });
  el.querySelectorAll('[data-act]').forEach(b=>b.addEventListener('click',e=>{ e.stopPropagation(); pageAction(p.id,b.dataset.act,b); }));
  el.addEventListener('click',e=>{ if(e.target.closest('button,label,input')) return; toggleSelect(p.id); });
  el.addEventListener('dblclick',e=>{ if(!e.target.closest('button,input')) openEditor(p.id); });
  el.addEventListener('keydown',e=>{ if(e.key==='Enter') openEditor(p.id); if(e.key===' '){e.preventDefault();toggleSelect(p.id);} });
  el.addEventListener('contextmenu',e=>{ if(e.target.closest('.pcard')) e.preventDefault(); });
  bindCardDrag(el,p); bindCardFileDrop(el,p);
  return el;
}
function pageAction(id,act,anchor){
  const i=idxOf(id); if(i<0) return;
  if(act==='edit') openEditor(id);
  else if(act==='replace'){ replaceTargetId=id; $('#fileReplace').click(); }
  else if(act==='remove') removePages([id]);
  else if(act==='left') movePage(id,-1);
  else if(act==='right') movePage(id,1);
  else if(act==='rotL') rotatePage(id,-90);
  else if(act==='rotR') rotatePage(id,90);
  else if(act==='duplicate') duplicatePage(id);
  else if(act==='menu') openPageMenu(id,anchor);
}
function openPageMenu(id,anchor){
  const items=[
    {label:'Edit',icon:'pencil',fn:()=>openEditor(id)},
    {label:'Rotate left',icon:'rotL',fn:()=>rotatePage(id,-90)},
    {label:'Rotate right',icon:'rotR',fn:()=>rotatePage(id,90)},
    {label:'Replace',icon:'replace',fn:()=>pageAction(id,'replace')},
    {label:'Duplicate',icon:'pages',fn:()=>duplicatePage(id)},
    {label:'Move left',icon:'arrowL',fn:()=>movePage(id,-1)},
    {label:'Move right',icon:'arrowR',fn:()=>movePage(id,1)},
    {label:'Remove',icon:'trash',fn:()=>removePages([id]),danger:true}];
  if(isMobile()) openSheet({title:pageLabel(id),body:sheetList(items)});
  else openPopover(anchor,items);
}
const pageLabel=id=>{ const i=idxOf(id); return i<0?'Page':`Page ${pad2(i)} · ${state.pages[i].fileName}`; };
function sheetList(items){ const w=document.createElement('div'); w.className='sheet-list';
  items.forEach(it=>{ const b=document.createElement('button'); b.className='sheet-item'+(it.danger?' danger':'');
    b.innerHTML=ic(it.icon)+`<span>${it.label}</span>`;
    b.addEventListener('click',()=>{ closeSheet(); it.fn(); }); w.appendChild(b); }); return w; }
function toggleSelect(id,on){ on===undefined? (state.selection.has(id)?state.selection.delete(id):state.selection.add(id))
    : (on?state.selection.add(id):state.selection.delete(id));
  const el=cardEls.get(id); if(el){ el.classList.toggle('selected',state.selection.has(id));
    el.querySelector('input').checked=state.selection.has(id); }
  updateSelectionUI(); }
function updateSelectionUI(){
  const n=state.selection.size; $('#bulkBar').hidden=n===0;
  if(n){ $('#bulkCount').textContent=`${n} selected`; }
  $('#selAll').checked = state.pages.length>0 && n===state.pages.length;
}

/* ---- page operations ---- */
function removePages(ids){
  if(!ids.length) return;
  pushHistory();
  state.pages=state.pages.filter(p=>!ids.includes(p.id));
  ids.forEach(id=>state.selection.delete(id));
  pushHistory(); hist.i--; if(hist.i>0){} hist.i=Math.min(hist.i,hist.stack.length-1);
  renderWorkspace();
  toast(`Removed ${ids.length} page${ids.length>1?'s':''}`,'info',{label:'Undo',fn:undo});
}
function movePage(id,dir){ const i=idxOf(id), j=i+dir; if(i<0||j<0||j>=state.pages.length) return;
  pushHistory(); const [p]=state.pages.splice(i,1); state.pages.splice(j,0,p);
  renderWorkspace(); if(state.editingId===id) updateEditorChrome(); }
function moveSelected(dir){
  if(!state.selection.size) return; pushHistory();
  const order=dir<0?[...state.pages.keys()]:[...state.pages.keys()].reverse();
  for(const i of order){ const p=state.pages[i], j=i+dir;
    if(j>=0&&j<state.pages.length&&!state.selection.has(state.pages[j].id)){
      state.pages[i]=state.pages[j]; state.pages[j]=p; } }
  renderWorkspace(); }
function duplicatePage(id){ const i=idxOf(id); if(i<0) return; pushHistory();
  const p=state.pages[i], c=JSON.parse(JSON.stringify(p)); c.id=uid(); c.v=0;
  state.pages.splice(i+1,0,c); pushHistory(); renderWorkspace(); toast('Page duplicated','ok'); }
function reorderPage(dragId,targetId,before){
  const from=idxOf(dragId), t=idxOf(targetId); if(from<0||t<0||dragId===targetId) return;
  pushHistory(); const [p]=state.pages.splice(from,1);
  let to=idxOf(targetId)+(before?0:1); state.pages.splice(to,0,p);
  renderWorkspace();
}
function rotatePage(id, angle){
  const p=state.pages.find(x=>x.id===id); if(!p) return;
  pushHistory();
  p.rot = ((p.rot||0) + angle + 360) % 360;
  if(Math.abs(angle)===90 || Math.abs(angle)===270){
    const t=p.w; p.w=p.h; p.h=t;
  }
  if(p.crop || p.texts.length || p.erasures.length){
    p.crop = null; p.texts = []; p.erasures = [];
    toast('Crop and edits were reset due to rotation');
  }
  markDirty([p]);
  if(state.editingId===id) refreshEditor();
}

/* ---- drag to reorder (pointer-based, mouse + touch) ---- */
let drag=null;
function bindCardDrag(el,p){
  const grip=el.querySelector('[data-drag]');
  grip.addEventListener('pointerdown',e=>{ e.preventDefault(); startCardDrag(e,el,p,false); });
  let timer=null,sx=0,sy=0;
  el.addEventListener('pointerdown',e=>{
    if(e.pointerType==='mouse') return;
    if(e.target.closest('button,input,label,a')) return;
    sx=e.clientX; sy=e.clientY;
    timer=setTimeout(()=>{ timer=null; startCardDrag(e,el,p,true); },330);
  });
  el.addEventListener('pointermove',e=>{ if(timer&&(Math.abs(e.clientX-sx)>9||Math.abs(e.clientY-sy)>9)){clearTimeout(timer);timer=null;} });
  ['pointerup','pointercancel'].forEach(ev=>el.addEventListener(ev,()=>{ if(timer){clearTimeout(timer);timer=null;} }));
}
function startCardDrag(e,el,p,longPress){
  if(drag) return;
  const r=el.getBoundingClientRect();
  const ghost=el.cloneNode(true); ghost.id='dragGhost';
  ghost.style.width=r.width+'px'; document.body.appendChild(ghost);
  drag={id:p.id,ghost,el,ox:e.clientX-r.left,oy:e.clientY-r.top,target:null,before:true};
  el.classList.add('dragging'); document.body.classList.add('is-dragging');
  document.body.style.overflow='hidden';
  const prevent=ev=>ev.preventDefault();
  document.addEventListener('touchmove',prevent,{passive:false});
  const move=ev=>{
    ghost.style.left=(ev.clientX-drag.ox)+'px'; ghost.style.top=(ev.clientY-drag.oy)+'px';
    if(ev.clientY<90) window.scrollBy(0,-16); else if(innerHeight-ev.clientY<90) window.scrollBy(0,16);
    ghost.style.display='none'; const under=document.elementFromPoint(ev.clientX,ev.clientY);
    ghost.style.display='';
    const card=under?.closest?.('.pcard');
    $$('.pcard.drop-before,.pcard.drop-after').forEach(c=>c.classList.remove('drop-before','drop-after'));
    if(card&&card.dataset.id!==p.id){ const cr=card.getBoundingClientRect();
      const before= state.view==='grid' ? (ev.clientX-cr.left)<cr.width/2 : (ev.clientY-cr.top)<cr.height/2;
      card.classList.add(before?'drop-before':'drop-after'); drag.target=card.dataset.id; drag.before=before; }
    else drag.target=null;
  };
  const up=()=>{
    document.removeEventListener('touchmove',prevent);
    window.removeEventListener('pointermove',move); window.removeEventListener('pointerup',up); window.removeEventListener('pointercancel',up);
    ghost.remove(); el.classList.remove('dragging'); document.body.classList.remove('is-dragging'); document.body.style.overflow='';
    $$('.pcard.drop-before,.pcard.drop-after').forEach(c=>c.classList.remove('drop-before','drop-after'));
    if(drag.target) reorderPage(drag.id,drag.target,drag.before);
    drag=null;
  };
  window.addEventListener('pointermove',move); window.addEventListener('pointerup',up); window.addEventListener('pointercancel',up);
  move(e);
}
/* drop files onto a card = replace */
function bindCardFileDrop(el,p){
  el.addEventListener('dragover',e=>{ if([...e.dataTransfer.types].includes('Files')){ e.preventDefault(); e.stopPropagation(); el.classList.add('file-target'); } });
  el.addEventListener('dragleave',()=>el.classList.remove('file-target'));
  el.addEventListener('drop',e=>{ e.preventDefault(); e.stopPropagation(); el.classList.remove('file-target');
    hideVeil(); if(e.dataTransfer.files.length) handleReplaceFiles(e.dataTransfer.files,p.id); });
}

/* ================= REPLACE ================= */
async function handleReplaceFiles(files,targetId){
  const t=idxOf(targetId); if(t<0) return;
  showLoader('Preparing replacement…');
  const temp=[];
  for(const f of files){
    const ext=(f.name.split('.').pop()||'').toLowerCase();
    try{
      if(ext==='pdf'||f.type==='application/pdf'){
        const doc=await pdfjsLib.getDocument({data:await f.arrayBuffer()}).promise;
        pdfSeq++;
        for(let i=1;i<=doc.numPages;i++){ const vp=(await doc.getPage(i).getViewport({scale:1}));
          temp.push(makePage(regSrc({kind:'pdf',doc,pageNum:i}),vp.width,vp.height,
            {ptype:'pdf',fileName:f.name,tag:`PDF ${pad2(pdfSeq-1)} · Page ${i}`})); }
      } else { const {img,w,h}=await decodeImage(f);
        temp.push(makePage(regSrc({kind:'image',img,w,h}),w,h,{ptype:'image',fileName:f.name,tag:'Image'})); }
    }catch(e){ toast(`Couldn't use “${f.name}” — ${e.message||'unsupported file.'}`,'err'); }
  }
  hideLoader();
  if(!temp.length) return;
  const finish=pages=>{ pushHistory(); state.pages.splice(t,1,...pages); pushHistory(); renderWorkspace();
    toast(`Page replaced with ${pages.length} page${pages.length>1?'s':''}`,'ok');
    if(state.editingId===targetId){ state.editingId=pages[0].id; refreshEditor(); } };
  if(temp.length>1) openPicker(temp,finish); else finish(temp);
}
function openPicker(temp,done){
  const grid=$('#pickerGrid'); grid.innerHTML=''; const sel=new Set(temp.map(p=>p.id));
  temp.forEach((p,i)=>{ const d=document.createElement('div'); d.className='pick on'; d.tabIndex=0;
    d.innerHTML=`<span class="ptick">${ic('check')}</span><span class="pn">${i+1}</span>`;
    composePage(p,200).then(cv=>d.prepend(cv)).catch(()=>{});
    const tog=()=>{ sel.has(p.id)?sel.delete(p.id):sel.add(p.id); d.classList.toggle('on',sel.has(p.id));
      $('#pickAll').checked=sel.size===temp.length; upd(); };
    d.addEventListener('click',tog); d.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();tog();}});
    grid.appendChild(d); });
  const upd=()=>$('#pickConfirm').textContent=`Use ${sel.size} page${sel.size===1?'':'s'}`; upd();
  $('#pickAll').onchange=e=>{ sel.clear(); if(e.target.checked) temp.forEach(p=>sel.add(p.id));
    [...grid.children].forEach((d,i)=>d.classList.toggle('on',sel.has(temp[i].id))); upd(); };
  $('#pickConfirm').onclick=()=>{ hideModal('#pickerModal'); done(temp.filter(p=>sel.has(p.id))); };
  showModal('#pickerModal');
}

/* ================= EDITOR ================= */
const layer=$('#layer'), mainCanvas=$('#mainCanvas'), eraseCanvas=$('#eraseCanvas');
let dispW=0,dispH=0,dpr=1, renderQueued=false, cropPx=null, cropAspect=0, cropHandle=null;
const textBoxEls=new Map();

function openEditor(id){
  if(!state.pages.some(p=>p.id===id)) return;
  state.editingId=id; $('#editor').hidden=false; document.body.style.overflow='hidden';
  setTool(''); selectedTextId=null;
  refreshEditor(); renderRail();
}
function closeEditor(silent){
  $('#editor').hidden=true; state.editingId=null; document.body.style.overflow='';
  textBoxEls.clear(); removeCropBox();
  if(!silent) renderWorkspace();
}
function refreshEditor(){
  const p=currentPage(); if(!p) return;
  updateEditorChrome(); layoutEditor(); renderEditorCanvas();
  syncAdjust(); syncTextPanel(); syncErasePanel();
}
function updateEditorChrome(){
  const p=currentPage(); if(!p) return; const i=idxOf(p.id);
  $('#edTitle').textContent=`Page ${pad2(i)}`;
  $('#edSub').textContent=`${p.fileName} · ${p.tag}`;
  $('#edPrev').disabled=i===0; $('#edNext').disabled=i===state.pages.length-1;
  $('#ordPos').textContent=`${i+1} / ${state.pages.length}`;
  $$('.rail-item').forEach(r=>r.classList.toggle('on',r.dataset.id===p.id));
}
function layoutEditor(){
  const p=currentPage(); if(!p) return;
  const stage=$('#edStage'), crop=cropOf(p);
  const aspect=(crop.w*p.w)/(crop.h*p.h);
  const availW=stage.clientWidth-36, availH=stage.clientHeight-36;
  dispW=clamp(Math.min(availW,availH*aspect),140,2200); dispH=dispW/aspect;
  dpr=Math.min(devicePixelRatio||1,2);
  mainCanvas.style.width=dispW+'px'; mainCanvas.style.height=dispH+'px';
  const wrap=$('#canvasWrap'); wrap.style.width=dispW+'px'; wrap.style.height=dispH+'px';
  eraseCanvas.width=Math.round(dispW*dpr); eraseCanvas.height=Math.round(dispH*dpr);
  eraseCanvas.style.width=dispW+'px'; eraseCanvas.style.height=dispH+'px';
}
async function renderEditorCanvas(){
  const p=currentPage(); if(!p) return;
  if(renderQueued) return; renderQueued=true;
  requestAnimationFrame(async()=>{ renderQueued=false;
    try{ const cv=await composePage(p,Math.round(dispW*dpr),{text:false,erase:false});
      mainCanvas.width=cv.width; mainCanvas.height=cv.height;
      mainCanvas.style.width=dispW+'px'; mainCanvas.style.height=dispH+'px';
      mainCanvas.getContext('2d').drawImage(cv,0,0);
      drawEraseOverlay(); positionTextBoxes();
    }catch(e){} });
}
function drawEraseOverlay(){
  const p=currentPage(); if(!p) return;
  const ctx=eraseCanvas.getContext('2d'); ctx.clearRect(0,0,eraseCanvas.width,eraseCanvas.height);
  const crop=cropOf(p);
  ctx.save(); ctx.scale(eraseCanvas.width/dispW,eraseCanvas.height/dispH);
  for(const st of p.erasures) drawStroke(ctx,st,dispW,dispH,crop);
  ctx.restore();
}
/* ---- tools ---- */
function setTool(t){
  const prevTool = state.tool;
  if(prevTool==='crop'&&t!=='crop') removeCropBox();
  state.tool=t; layer.dataset.tool=t;
  $('#secCrop').hidden=t!=='crop'; $('#secText').hidden=t!=='text'; $('#secErase').hidden=t!=='erase'; $('#secPgNum').hidden=t!=='pgnum';
  $$('.tool-btn').forEach(b=>b.classList.toggle('on',b.dataset.tool===t));
  $$('#edChips .chip').forEach(c=>c.classList.toggle('on',c.dataset.tool===t));
  eraseCanvas.style.pointerEvents=t==='erase'?'none':'';
  if(t==='crop') initCropBox();
  if(t!=='text'){ selectedTextId=null; positionTextBoxes(); syncTextPanel(); }
  else {
    const p = currentPage();
    if(p) {
      if(prevTool !== 'text' && p.texts.length === 0) addTextBox(0.5, 0.42);
      else if(prevTool === 'text') addTextBox(0.5, 0.42);
    }
  }
}
/* ---- crop ---- */
const CROP_PRESETS=[['Free',0],['Original','orig'],['1:1',1],['4:3',4/3],['3:4',3/4],['16:9',16/9],['A4',210/297],['Letter',8.5/11]];
function initCropBox(){
  removeCropBox();
  const box=document.createElement('div'); box.id='cropBox';
  box.innerHTML='<div class="grid"></div>'+['nw','n','ne','e','se','s','sw','w'].map(h=>`<div class="ch ${h}" data-h="${h}"></div>`).join('');
  layer.appendChild(box); cropPx={x:0,y:0,w:dispW,h:dispH}; cropAspect=0;
  paintCropBox();
  box.addEventListener('pointerdown',cropDown);
  $$('#cropPresets .preset').forEach(b=>b.classList.toggle('on',b.dataset.a==='0'));
}
function removeCropBox(){ $('#cropBox')?.remove(); cropPx=null; }
function paintCropBox(){ const b=$('#cropBox'); if(!b||!cropPx) return;
  b.style.left=cropPx.x+'px'; b.style.top=cropPx.y+'px'; b.style.width=cropPx.w+'px'; b.style.height=cropPx.h+'px'; }
function cropDown(e){
  e.preventDefault(); e.stopPropagation();
  const p=currentPage(); if(!p||!cropPx) return;
  const h=e.target.dataset?.h||'move';
  const start={...cropPx}, sx=e.clientX, sy=e.clientY;
  if(h==='move'&&cropAspect){/* keep */}
  $('#cropBox').setPointerCapture(e.pointerId);
  const move=ev=>{ const dx=ev.clientX-sx, dy=ev.clientY-sy;
    cropPx=h==='move'?moveRect(start,dx,dy):computeCropRect(h,start,dx,dy,cropAspect,p);
    paintCropBox(); };
  const up=()=>{ $('#cropBox')?.removeEventListener('pointermove',move);
    $('#cropBox')?.removeEventListener('pointerup',up); };
  $('#cropBox').addEventListener('pointermove',move);
  $('#cropBox').addEventListener('pointerup',up);
}
function moveRect(s,dx,dy){ return {x:clamp(s.x+dx,0,dispW-s.w),y:clamp(s.y+dy,0,dispH-s.h),w:s.w,h:s.h}; }
function computeCropRect(h,s,dx,dy,A,p){
  let L=s.x,T=s.y,R=s.x+s.w,B=s.y+s.h;
  if(h.includes('w')) L=s.x+dx; if(h.includes('e')) R=s.x+s.w+dx;
  if(h.includes('n')) T=s.y+dy; if(h.includes('s')) B=s.y+s.h+dy;
  L=clamp(L,0,dispW); R=clamp(R,0,dispW); T=clamp(T,0,dispH); B=clamp(B,0,dispH);
  if(R-L<24){ h.includes('w')?L=R-24:R=L+24; } if(B-T<24){ h.includes('n')?T=B-24:B=T+24; }
  if(A){
    const corner=h.length===2;
    if(corner){
      if(h==='se'){ let w=R-L,ht=w/A; B=T+ht; if(B>dispH){B=dispH;ht=B-T;w=ht*A;R=L+w;} }
      if(h==='nw'){ let ht=B-T,w=ht*A; L=R-w; T=B-ht; if(L<0){L=0;w=R;ht=w/A;T=B-ht;} if(T<0){T=0;ht=B;w=ht*A;L=R-w;} }
      if(h==='ne'){ let w=R-L,ht=w/A; T=B-ht; if(T<0){T=0;ht=B;w=ht*A;R=L+w;} }
      if(h==='sw'){ let ht=B-T,w=ht*A; L=R-w; if(L<0){L=0;w=R;ht=w/A;B=T+ht;} if(B>dispH){B=dispH;ht=B-T;w=ht*A;L=R-w;} }
    } else if(h==='e'||h==='w'){ const cy=(T+B)/2, w=R-L, ht=w/A; T=cy-ht/2; B=cy+ht/2;
      if(T<0){B-=T;T=0;} if(B>dispH){T-=B-dispH;B=dispH;} }
    else { const cx=(L+R)/2, ht=B-T, w=ht*A; L=cx-w/2; R=cx+w/2;
      if(L<0){R-=L;L=0;} if(R>dispW){L-=R-dispW;R=dispW;} }
  }
  return {x:L,y:T,w:Math.max(24,R-L),h:Math.max(24,B-T)};
}
function applyCrop(){
  const p=currentPage(); if(!p||!cropPx) return;
  const cur=cropOf(p);
  const nx=cur.x+(cropPx.x/dispW)*cur.w, ny=cur.y+(cropPx.y/dispH)*cur.h;
  const nw=(cropPx.w/dispW)*cur.w, nh=(cropPx.h/dispH)*cur.h;
  if(nw>=0.999&&nh>=0.999&&nx<=0.001&&ny<=0.001){ setTool(''); return; }
  p.crop={x:nx,y:ny,w:nw,h:nh}; pushHistory(); setTool(''); markDirty([p]);
}
function resetCrop(){ const p=currentPage(); if(!p) return;
  if(p.crop){ p.crop=null; pushHistory(); markDirty([p]); } setTool(''); }

/* ---- adjustments ---- */
let activeAdj = 'bright';
function buildAdjust(){
  const modes=[['bright','sun','Brightness'],['contrast','contrast','Contrast'],['dark','moon','Darkness'],['hue','sparkle','Hue']];
  $('#secAdjust').innerHTML='<h4>Adjust</h4>' +
    `<div class="adj-modes" style="display:flex;gap:8px;margin-bottom:16px;">` +
      modes.map(([k,icn,lab])=>`<button class="btn btn-sec btn-sm adj-mode-btn" data-mode="${k}" style="flex:1;padding:0;flex-direction:column;height:54px;font-size:11px;gap:2px;">${ic(icn)} ${lab}</button>`).join('') +
    `</div>` +
    `<div class="adj-row" style="margin-bottom:0;">
      <div class="adj-head">
        <span class="adj-label" id="adj-main-label" style="display:flex;align-items:center;gap:6px;"></span>
        <span class="adj-val" id="adj-main-val">0</span>
        <button class="mini-reset" id="adj-main-reset">Reset</button>
      </div>
      <input type="range" min="-100" max="100" value="0" step="1" id="adj-main-slider">
    </div>`;

  const slider = $('#adj-main-slider');
  $$('.adj-mode-btn').forEach(b => {
    b.addEventListener('click', () => { activeAdj = b.dataset.mode; syncAdjust(); });
  });

  slider.addEventListener('input', () => {
    const p = currentPage(); if(!p) return;
    p[activeAdj] = +slider.value;
    $('#adj-main-val').textContent = (slider.value > 0 ? '+' : '') + slider.value;
    renderEditorCanvas(); markDirty([p]);
  });
  slider.addEventListener('change', () => pushHistory());

  $('#adj-main-reset').addEventListener('click', () => {
    const p = currentPage(); if(!p) return;
    p[activeAdj] = 0;
    syncAdjust(); renderEditorCanvas(); markDirty([p]); pushHistory();
  });
}
function syncAdjust(){
  const p = currentPage(); if(!p) return;
  const modes = [['bright','sun','Brightness'],['contrast','contrast','Contrast'],['dark','moon','Darkness'],['hue','sparkle','Hue']];
  
  $$('.adj-mode-btn').forEach(b => {
    const isAct = b.dataset.mode === activeAdj;
    b.classList.toggle('btn-sec', !isAct);
    b.classList.toggle('btn-primary', isAct);
  });
  
  const modeData = modes.find(m => m[0] === activeAdj);
  if(modeData){
    $('#adj-main-label').innerHTML = `${ic(modeData[1])} ${modeData[2]}`;
    const svg = $('#adj-main-label svg');
    if(svg){ svg.style.width = '15px'; svg.style.height = '15px'; }
  }
  
  const val = p[activeAdj] || 0;
  $('#adj-main-slider').value = val;
  $('#adj-main-val').textContent = (val > 0 ? '+' : '') + val;
}

/* ---- text ---- */
function buildTextControls(host){
  host.innerHTML=`
    <div class="ctl-row"><label for="txFont">Font</label>
      <select id="txFont" style="flex:1">${FONTS.map(f=>`<option>${f.name}</option>`).join('')}</select></div>
    <div class="ctl-row"><label for="txSize">Size</label>
      <input type="range" id="txSize" min="10" max="160" value="30" style="flex:1"><input class="num-in" id="txSizeNum" type="number" min="6" max="300" value="30"></div>
    <div class="ctl-row"><label>Style</label><div class="seg-mini">
      <button id="txBold" aria-label="Bold" style="font-weight:800">B</button>
      <button id="txItalic" aria-label="Italic" style="font-style:italic;font-family:Georgia">I</button>
      <button id="txUnder" aria-label="Underline" style="text-decoration:underline">U</button></div></div>
    <div class="ctl-row"><label>Align</label><div class="seg-mini">
      <button id="txAl" aria-label="Align left"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M4 6h16M4 12h10M4 18h14"/></svg></button>
      <button id="txAc" aria-label="Align center"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M4 6h16M7 12h10M5 18h14"/></svg></button>
      <button id="txAr" aria-label="Align right"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M4 6h16M10 12h10M6 18h14"/></svg></button></div></div>
    <div class="ctl-row"><label>Color</label><div class="swatches" id="txSwatches">
      ${['#171b26','#ffffff','#d8443c','#2743e3','#e8960c'].map(c=>`<button class="sw" data-c="${c}" style="background:${c}" aria-label="Color ${c}"></button>`).join('')}
      <span class="sw custom" title="Custom color"><input type="color" id="txColor" value="#171b26" aria-label="Custom text color"></span></div></div>
    <div class="ctl-row"><label>Background</label><div class="swatches">
      <span class="sw custom" title="Background color"><input type="color" id="txBgColor" value="#ffffff" aria-label="Background color"></span>
      <button class="btn btn-sm btn-ghost" id="txBgClear" style="padding:0 6px">None</button></div></div>
    <div class="ctl-row"><label>Shadow</label><div class="swatches">
      <span class="sw custom" title="Shadow color"><input type="color" id="txShadowColor" value="#000000" aria-label="Shadow color"></span>
      <button class="btn btn-sm btn-ghost" id="txShadowClear" style="padding:0 6px">None</button></div></div>
    <div class="ctl-row"><label for="txOp">Opacity</label>
      <input type="range" id="txOp" min="10" max="100" value="100" style="flex:1"><span class="adj-val" id="txOpVal">100%</span></div>
    <div class="ctl-row"><label for="txSp">Spacing</label>
      <input type="range" id="txSp" min="-2" max="14" step="0.5" value="0" style="flex:1"><span class="adj-val" id="txSpVal">0</span></div>
    <div class="order-row" style="margin-top:4px">
      <button class="btn btn-sec btn-sm" id="txAdd" style="flex:1">${ic('plus')} Add text</button>
      <button class="btn btn-sec btn-sm danger" id="txDel" style="color:var(--danger)" disabled>${ic('trash')} Delete</button>
    </div>
    <p class="panel-hint">Double-tap a box to type, drag to move, pull the corner dot to resize.</p>`;
  const tgt=()=>state.pages.find(p=>p.id===state.editingId)?.texts.find(t=>t.id===selectedTextId)||null;
  const apply=(fn,commit)=>{ 
    const t=tgt(); 
    if(t){ fn(t); styleTextBox(t); markDirty([currentPage()]); if(commit) pushHistory(); } 
    else { fn(textDefaults); syncTextPanel(); }
  };
  
  host.addEventListener('mousedown', e => {
    if (e.target.closest('button')) {
      if (document.activeElement && document.activeElement.classList.contains('tb-text')) {
        e.preventDefault();
      }
    }
  });

  host.querySelector('#txFont').addEventListener('input',e=>apply((t)=>{t.font=e.target.value;}));
  host.querySelector('#txFont').addEventListener('change',e=>apply((t)=>{t.font=e.target.value;},true));
  const size=host.querySelector('#txSize'), sizeN=host.querySelector('#txSizeNum');
  size.addEventListener('input',()=>{ sizeN.value=size.value; apply(t=>{t.size=+size.value;}); });
  size.addEventListener('change',()=>pushHistory());
  sizeN.addEventListener('change',()=>{ size.value=clamp(+sizeN.value||30,6,300); sizeN.value=size.value; apply(t=>{t.size=+size.value;},true); });
  [['#txBold','bold'],['#txItalic','italic'],['#txUnder','underline']].forEach(([s,k])=>
    host.querySelector(s).addEventListener('click',()=>{ const t=tgt(); const on=t?!t[k]:!textDefaults[k];
      textDefaults[k]=on; apply(x=>{x[k]=on;},true); syncTextPanel(); }));
  [['#txAl','left'],['#txAc','center'],['#txAr','right']].forEach(([s,a])=>
    host.querySelector(s).addEventListener('click',()=>{ textDefaults.align=a; apply(t=>{t.align=a;},true); syncTextPanel(); }));
  host.querySelectorAll('#txSwatches .sw[data-c]').forEach(b=>b.addEventListener('click',()=>{
    textDefaults.color=b.dataset.c; apply(t=>{t.color=b.dataset.c;},true); syncTextPanel(); }));
  host.querySelector('#txColor').addEventListener('input',e=>{ textDefaults.color=e.target.value; apply(t=>{t.color=e.target.value;}); });
  host.querySelector('#txColor').addEventListener('change',()=>pushHistory());
  
  host.querySelector('#txBgColor').addEventListener('input',e=>apply(t=>{t.bgColor=e.target.value;}));
  host.querySelector('#txBgColor').addEventListener('change',()=>pushHistory());
  host.querySelector('#txBgClear').addEventListener('click',()=>apply(t=>{t.bgColor='';},true));
  
  host.querySelector('#txShadowColor').addEventListener('input',e=>apply(t=>{t.shadowColor=e.target.value;}));
  host.querySelector('#txShadowColor').addEventListener('change',()=>pushHistory());
  host.querySelector('#txShadowClear').addEventListener('click',()=>apply(t=>{t.shadowColor='';},true));
  
  const op=host.querySelector('#txOp');
  op.addEventListener('input',()=>{ host.querySelector('#txOpVal').textContent=op.value+'%'; apply(t=>{t.opacity=op.value/100;}); });
  op.addEventListener('change',()=>pushHistory());
  const sp=host.querySelector('#txSp');
  sp.addEventListener('input',()=>{ host.querySelector('#txSpVal').textContent=sp.value; apply(t=>{t.spacing=+sp.value;}); });
  sp.addEventListener('change',()=>pushHistory());
  host.querySelector('#txAdd').addEventListener('click',()=>addTextBox(0.5,0.42));
  host.querySelector('#txDel').addEventListener('click',()=>{ if(selectedTextId) deleteTextBox(selectedTextId); });
}
function syncTextPanel(){
  ['#secText','#textContent'].forEach(s=>{ const el=$(s); if(!el) return; });
  const t=state.pages.find(p=>p.id===state.editingId)?.texts.find(x=>x.id===selectedTextId)||null;
  const v=t||textDefaults;
  ['secText','textContent'].forEach(id=>{ const host=id==='secText'?$('#secText'):null; void host; });
  const q=s=>[document.querySelector('#secText '+s),document.querySelector('#textContent '+s)].find(Boolean);
  const set=(s,val)=>{ const el=q(s); if(el) el.value=val; };
  set('#txFont',v.font); set('#txSize',v.size); set('#txSizeNum',v.size); set('#txOp',Math.round(v.opacity*100));
  set('#txBgColor',v.bgColor||'#ffffff'); set('#txShadowColor',v.shadowColor||'#000000');
  const opv=q('#txOpVal'); if(opv) opv.textContent=Math.round(v.opacity*100)+'%';
  set('#txSp',v.spacing); const spv=q('#txSpVal'); if(spv) spv.textContent=v.spacing;
  [['#txBold','bold'],['#txItalic','italic'],['#txUnder','underline']].forEach(([s,k])=>q(s)?.classList.toggle('on',!!v[k]));
  [['#txAl','left'],['#txAc','center'],['#txAr','right']].forEach(([s,a])=>q(s)?.classList.toggle('on',v.align===a));
  q('#txSwatches')?.querySelectorAll('.sw[data-c]').forEach(b=>b.classList.toggle('on',b.dataset.c.toLowerCase()===String(v.color).toLowerCase()));
  const del=q('#txDel'); if(del) del.disabled=!t;
}
function addTextBox(nx,ny){
  const p=currentPage(); if(!p) return;
  const crop=cropOf(p);
  const t={id:uid(),x:crop.x+crop.w*nx-crop.w*0.2,y:crop.y+crop.h*ny,w:crop.w*0.42,
    text:'Tap to type',...JSON.parse(JSON.stringify(textDefaults))};
  t.x=clamp(t.x,crop.x,crop.x+crop.w-t.w);
  p.texts.push(t); selectedTextId=t.id; pushHistory();
  positionTextBoxes(); markDirty([p]); syncTextPanel();
  const el=textBoxEls.get(t.id); if(el) enterTextEditMode(el,t);
}
function deleteTextBox(tid){ const p=currentPage(); if(!p) return;
  p.texts=p.texts.filter(t=>t.id!==tid);
  textBoxEls.get(tid)?.remove(); textBoxEls.delete(tid);
  if(selectedTextId===tid) selectedTextId=null;
  pushHistory(); syncTextPanel(); markDirty([p]); }
function positionTextBoxes(){
  const p=currentPage(); if(!p) return;
  const crop=cropOf(p), seen=new Set();
  p.texts.forEach(t=>{ seen.add(t.id); const el=ensureTextBoxEl(t); styleTextBox(t,el); });
  [...textBoxEls.keys()].forEach(id=>{ if(!seen.has(id)){ textBoxEls.get(id).remove(); textBoxEls.delete(id); } });
}
function ensureTextBoxEl(t){
  let el=textBoxEls.get(t.id); if(el) return el;
  el=document.createElement('div'); el.className='tbox'; el.dataset.tid=t.id;
  el.innerHTML='<div class="tb-text" spellcheck="false"></div><div class="tb-resize" aria-hidden="true"></div>';
  const txt=el.querySelector('.tb-text');
  el.addEventListener('pointerdown',e=>{
    if(el.classList.contains('editing')) { e.stopPropagation(); return; }
    e.preventDefault(); e.stopPropagation();
    selectTextBox(t.id);
    const p=currentPage(), crop=cropOf(p), r=layer.getBoundingClientRect();
    const sx=e.clientX, sy=e.clientY, ox=t.x, oy=t.y; let moved=false;
    el.setPointerCapture(e.pointerId);
    const mv=ev=>{ const dx=(ev.clientX-sx)/r.width*crop.w, dy=(ev.clientY-sy)/r.height*crop.h;
      if(Math.abs(dx)>0.001||Math.abs(dy)>0.001) moved=true;
      t.x=clamp(ox+dx,crop.x-t.w*0.6,crop.x+crop.w-t.w*0.4);
      t.y=clamp(oy+dy,crop.y-0.02,crop.y+crop.h-0.02); styleTextBox(t); };
    const up=()=>{ el.removeEventListener('pointermove',mv); el.removeEventListener('pointerup',up);
      if(moved){ pushHistory(); markDirty([p]); } };
    el.addEventListener('pointermove',mv); el.addEventListener('pointerup',up);
  });
  el.addEventListener('dblclick',e=>{ e.stopPropagation(); enterTextEditMode(el,t); });
  el.querySelector('.tb-resize').addEventListener('pointerdown',e=>{
    e.preventDefault(); e.stopPropagation();
    const p=currentPage(), crop=cropOf(p), r=layer.getBoundingClientRect(), sx=e.clientX, w0=t.w;
    const h=e.target; h.setPointerCapture(e.pointerId);
    const mv=ev=>{ t.w=Math.max(60/r.width*crop.w, w0+(ev.clientX-sx)/r.width*crop.w); styleTextBox(t); };
    const up=()=>{ h.removeEventListener('pointermove',mv); h.removeEventListener('pointerup',up); pushHistory(); markDirty([p]); };
    h.addEventListener('pointermove',mv); h.addEventListener('pointerup',up);
  });
  txt.addEventListener('blur',()=>{ if(!el.classList.contains('editing')) return;
    el.classList.remove('editing'); txt.contentEditable='false';
    const nt=txt.innerText.replace(/\u00a0/g,' ');
    if(nt!==t.text){ t.text=nt; pushHistory(); markDirty([currentPage()]); } });
  layer.appendChild(el); textBoxEls.set(t.id,el);
  return el;
}
function selectTextBox(tid){ selectedTextId=tid;
  textBoxEls.forEach((el,id)=>el.classList.toggle('sel',id===tid)); syncTextPanel(); }
function enterTextEditMode(el,t){
  const txt=el.querySelector('.tb-text');
  el.classList.add('editing','sel'); txt.contentEditable='true'; txt.focus();
  const range=document.createRange(); range.selectNodeContents(txt);
  const sel=getSelection(); sel.removeAllRanges(); sel.addRange(range);
}
function styleTextBox(t,el){
  el=el||textBoxEls.get(t.id); if(!el) return;
  const p=currentPage(); if(!p) return; const crop=cropOf(p);
  const txt=el.querySelector('.tb-text');
  el.style.left=((t.x-crop.x)/crop.w*100)+'%'; el.style.top=((t.y-crop.y)/crop.h*100)+'%';
  el.style.width=(t.w/crop.w*100)+'%';
  const px=t.size*dispW/800;
  txt.style.fontSize=px+'px'; txt.style.fontFamily=fontCss(t.font);
  txt.style.fontWeight=t.bold?'700':'400'; txt.style.fontStyle=t.italic?'italic':'normal';
  txt.style.textDecoration=t.underline?'underline':'none';
  txt.style.color=t.color; txt.style.textAlign=t.align; txt.style.opacity=t.opacity;
  txt.style.backgroundColor=t.bgColor||'transparent';
  txt.style.textShadow=t.shadowColor?`1px 1px 3px ${t.shadowColor}`:'none';
  txt.style.letterSpacing=(t.spacing||0)*dispW/800+'px';
  if(txt.innerText!==t.text&&document.activeElement!==txt) txt.textContent=t.text;
}
/* ---- erase ---- */
function buildEraseControls(host){
  host.innerHTML=`
    <div class="ctl-row"><label for="erSize">Size</label>
      <input type="range" id="erSize" min="4" max="120" value="${brush.px}" style="flex:1"><span class="adj-val" id="erSizeVal">${brush.px}</span></div>
    <div class="ctl-row"><label for="erOp">Opacity</label>
      <input type="range" id="erOp" min="10" max="100" value="${brush.opacity*100}" style="flex:1"><span class="adj-val" id="erOpVal">${Math.round(brush.opacity*100)}%</span></div>
    <div class="ctl-row"><label>Erase color</label><div class="swatches" id="erSwatches">
      ${['#ffffff','#171b26','#f5f0e6','#d8443c'].map(c=>`<button class="sw${c===brush.color?' on':''}" data-c="${c}" style="background:${c}" aria-label="Erase color ${c}"></button>`).join('')}
      <span class="sw custom" title="Custom color"><input type="color" id="erColor" value="${brush.color}" aria-label="Custom erase color"></span></div></div>
    <div class="order-row" style="margin-top:4px">
      <button class="btn btn-sec btn-sm danger" id="erClear" style="flex:1;color:var(--danger)">${ic('trash')} Clear all erasures</button>
    </div>
    <p class="panel-hint">Paint over anything you want to cover. The erase color can be any color — use white for scanned pages or match the page background. Undo/Redo works on every stroke.</p>`;
  const size=host.querySelector('#erSize');
  size.addEventListener('input',()=>{ brush.px=+size.value; host.querySelector('#erSizeVal').textContent=size.value; });
  const op=host.querySelector('#erOp');
  op.addEventListener('input',()=>{ brush.opacity=op.value/100; host.querySelector('#erOpVal').textContent=op.value+'%'; });
  host.querySelectorAll('#erSwatches .sw[data-c]').forEach(b=>b.addEventListener('click',()=>{
    brush.color=b.dataset.c; host.querySelectorAll('#erSwatches .sw').forEach(x=>x.classList.remove('on')); b.classList.add('on');
    const ci=host.querySelector('#erColor'); if(ci) ci.value=b.dataset.c; }));
  host.querySelector('#erColor').addEventListener('input',e=>{ brush.color=e.target.value;
    host.querySelectorAll('#erSwatches .sw[data-c]').forEach(x=>x.classList.remove('on')); });
  host.querySelector('#erClear').addEventListener('click',()=>{ const p=currentPage(); if(!p||!p.erasures.length) return;
    p.erasures=[]; pushHistory(); drawEraseOverlay(); markDirty([p]); });
}
function syncErasePanel(){ ['#secErase #erSize','#eraseContent #erSize'].forEach(()=>{}); }
let eraseStroke=null;
eraseCanvas.parentElement.addEventListener('pointerdown',e=>{
  if(state.tool!=='erase') return; e.preventDefault();
  const p=currentPage(); if(!p) return;
  const r=layer.getBoundingClientRect(), crop=cropOf(p);
  const norm=ev=>({x:crop.x+((ev.clientX-r.left)/r.width)*crop.w, y:crop.y+((ev.clientY-r.top)/r.height)*crop.h});
  eraseStroke={color:brush.color,opacity:brush.opacity,size:brush.px/dispW,points:[norm(e)]};
  layer.setPointerCapture(e.pointerId);
  let lastPx={x:e.clientX,y:e.clientY};
  const ctx=eraseCanvas.getContext('2d');
  const drawSeg=(a,b)=>{ ctx.save(); ctx.scale(eraseCanvas.width/dispW,eraseCanvas.height/dispH);
    ctx.globalAlpha=eraseStroke.opacity; ctx.strokeStyle=eraseStroke.color; ctx.lineCap='round'; ctx.lineJoin='round';
    ctx.lineWidth=eraseStroke.size*dispW; ctx.beginPath();
    ctx.moveTo((a.x-crop.x)/crop.w*dispW,(a.y-crop.y)/crop.h*dispH);
    ctx.lineTo((b.x-crop.x)/crop.w*dispW,(b.y-crop.y)/crop.h*dispH); ctx.stroke(); ctx.restore(); };
  const mv=ev=>{ const n=norm(ev); eraseStroke.points.push(n); drawSeg(norm({clientX:lastPx.x,clientY:lastPx.y}),n);
    lastPx={x:ev.clientX,y:ev.clientY}; };
  const up=()=>{ layer.removeEventListener('pointermove',mv); layer.removeEventListener('pointerup',up); layer.removeEventListener('pointercancel',up);
    if(eraseStroke){ p.erasures.push(eraseStroke); eraseStroke=null; pushHistory(); drawEraseOverlay(); markDirty([p]); } };
  layer.addEventListener('pointermove',mv); layer.addEventListener('pointerup',up); layer.addEventListener('pointercancel',up);
});
layer.addEventListener('click',e=>{
  if(state.tool!=='text') return;
  if(e.target.closest('.tbox')) return;
  if(selectedTextId) {
    selectedTextId = null;
    positionTextBoxes();
    syncTextPanel();
  }
});

/* ---- editor rail ---- */
async function renderRail(){
  const rail=$('#edRail'); rail.innerHTML='';
  state.pages.forEach((p,i)=>{ const d=document.createElement('div');
    d.className='rail-item'+(p.id===state.editingId?' on':''); d.dataset.id=p.id; d.tabIndex=0;
    d.innerHTML=`<i>${i+1}</i>`; d.setAttribute('aria-label',`Go to page ${i+1}`);
    d.addEventListener('click',()=>{ state.editingId=p.id; setTool(''); selectedTextId=null; refreshEditor(); renderRail(); });
    d.addEventListener('keydown',e=>{ if(e.key==='Enter') d.click(); });
    rail.appendChild(d);
    composePage(p,120).then(cv=>{ if(d.isConnected) d.prepend(cv); }).catch(()=>{});
  });
}

/* ================= SHEETS / POPOVERS / MODALS ================= */
function openSheet({title,body}){
  closeSheet(); const host=$('#sheetHost');
  host.innerHTML=`<div class="backdrop"></div><div class="sheet" role="dialog" aria-modal="true"><div class="sheet-grab"></div>${title?`<h3>${esc(title)}</h3>`:''}<div class="sheet-body"></div></div>`;
  host.hidden=false; host.querySelector('.sheet-body').appendChild(body);
  host.querySelector('.backdrop').addEventListener('click',closeSheet);
}
function closeSheet(){ const host=$('#sheetHost'); if(host.hidden) return;
  const moved=host.querySelector('#secCrop,#secText,#secErase,#secAdjust,#secPgNum');
  if(moved){ const home={secCrop:$('#edPanel'),secAdjust:null}[moved.id];
    (moved.id==='secAdjust'?$('#secAdjust').parentElement||$('#edPanel'):$('#edPanel')).appendChild(moved);
    restorePanelOrder(); }
  host.hidden=true; host.innerHTML=''; }
function restorePanelOrder(){ const panel=$('#edPanel');
  ['secOrder','secTools','secAdjust','secCrop','secText','secErase','secPgNum'].forEach(id=>{ const el=document.getElementById(id); if(el) panel.appendChild(el); }); }
let popoverEl=null;
function openPopover(anchor,items){
  closePopover(); const m=document.createElement('div'); m.className='popmenu'; m.setAttribute('role','menu');
  items.forEach(it=>{ const b=document.createElement('button'); b.setAttribute('role','menuitem');
    b.className=it.danger?'danger':''; b.innerHTML=ic(it.icon)+`<span>${it.label}</span>`;
    b.addEventListener('click',()=>{ closePopover(); it.fn(); }); m.appendChild(b); });
  document.body.appendChild(m); popoverEl=m;
  const r=anchor.getBoundingClientRect(), mw=m.offsetWidth, mh=m.offsetHeight;
  m.style.left=clamp(r.right-mw,8,innerWidth-mw-8)+'px';
  m.style.top=(r.bottom+mh+8<innerHeight? r.bottom+6 : r.top-mh-6)+'px';
  setTimeout(()=>{ document.addEventListener('pointerdown',popOut); },0);
}
function popOut(e){ if(popoverEl&&!popoverEl.contains(e.target)) closePopover(); }
function closePopover(){ if(popoverEl){ popoverEl.remove(); popoverEl=null; } document.removeEventListener('pointerdown',popOut); }
function showModal(sel){ $(sel).hidden=false; }
function hideModal(sel){ $(sel).hidden=true; }
$$('.overlay [data-close]').forEach(b=>b.addEventListener('click',e=>{ const ov=e.target.closest('.overlay'); if(ov) hideModal('#'+ov.id); }));
$$('.overlay').forEach(ov=>ov.addEventListener('pointerdown',e=>{ if(e.target===ov&&ov.id!=='exportModal') hideModal('#'+ov.id); }));

/* ================= TOASTS / LOADER ================= */
function toast(msg,kind='info',action=null,timeout=4200){
  const t=document.createElement('div'); t.className='toast '+kind;
  t.innerHTML=ic(kind==='err'?'alert':kind==='ok'?'check':'sparkle')+`<span>${esc(msg)}</span>`;
  if(action){ const b=document.createElement('button'); b.textContent=action.label;
    b.addEventListener('click',()=>{ action.fn(); dismiss(); }); t.appendChild(b); }
  $('#toasts').appendChild(t);
  const dismiss=()=>{ t.classList.add('out'); setTimeout(()=>t.remove(),260); };
  setTimeout(dismiss,timeout);
}
function showLoader(label){ $('#loaderLabel').textContent=label; $('#loaderBar').style.width='4%'; $('#loader').hidden=false; }
function setLoader(frac,label){ if(label) $('#loaderLabel').textContent=label;
  $('#loaderBar').style.width=Math.round(clamp(frac,0,1)*100)+'%'; }
function hideLoader(){ $('#loader').hidden=true; }

/* ================= EXPORT ================= */
const expOpts={format:'pdf',scope:'all',pdfq:'high',size:'original',orient:'auto',zipq:'high',uniformSize:false};
function openExport(prefScope){
  if(!state.pages.length){ toast('Import some pages first','info'); return; }
  lastExport=null; expOpts.scope=(prefScope==='sel'&&state.selection.size)?'sel':'all';
  buildExportBody(); showModal('#exportModal');
}
function exportScope(){ return expOpts.scope==='sel'&&state.selection.size
  ? state.pages.filter(p=>state.selection.has(p.id)) : state.pages; }
function buildExportBody(){
  const n=exportScope().length, hasSel=state.selection.size>0&&state.selection.size<state.pages.length;
  $('#expBody').innerHTML=`
    ${hasSel?`<div class="opt-group"><h5>Scope</h5><div class="seg-wide">
      <button class="chip ${expOpts.scope==='all'?'on':''}" data-x="scope" data-v="all">All pages (${state.pages.length})</button>
      <button class="chip ${expOpts.scope==='sel'?'on':''}" data-x="scope" data-v="sel">Selected (${state.selection.size})</button></div></div>`:''}
    <div class="opt-group"><h5>Format</h5><div class="opt-cards">
      <button class="opt-card ${expOpts.format==='pdf'?'on':''}" data-x="format" data-v="pdf">${ic('file')}<span><b>Save as PDF</b><span>One merged PDF document</span></span></button>
      <button class="opt-card ${expOpts.format==='zip'?'on':''}" data-x="format" data-v="zip">${ic('archive')}<span><b>Save as ZIP</b><span>Each page as an image</span></span></button></div></div>
    <div id="expPdfOpts" ${expOpts.format!=='pdf'?'hidden':''}>
      <div class="opt-group"><h5>PDF quality</h5><div class="opt-cards" style="grid-template-columns: repeat(3, 1fr)">
        ${[['standard','Standard'],['high','High'],['maximum','Maximum']].map(([v,l])=>`<button class="opt-card ${expOpts.pdfq===v?'on':''}" data-x="pdfq" data-v="${v}" style="justify-content:center;padding:12px 6px"><b>${l}</b></button>`).join('')}</div></div>
      <div class="opt-group"><h5>Page size</h5><div class="opt-cards">
        ${[['original','Original'],['a4','A4'],['letter','Letter'],['fit','Fit to content']].map(([v,l])=>`<button class="opt-card ${expOpts.size===v?'on':''}" data-x="size" data-v="${v}" style="justify-content:center;padding:12px 6px"><b>${l}</b></button>`).join('')}</div>
        <div style="margin-top:10px;"><label style="display:flex;align-items:center;gap:8px;font-size:13.5px;color:var(--ink);cursor:pointer;font-weight:500;"><input type="checkbox" id="chkUniform" ${expOpts.uniformSize?'checked':''}> Force all pages to match first page size</label></div>
      </div>
      <div class="opt-group" id="orientGroup" ${['original','fit'].includes(expOpts.size)?'hidden':''}><h5>Orientation</h5><div class="opt-cards" style="grid-template-columns: repeat(3, 1fr)">
        ${[['auto','Automatic'],['portrait','Portrait'],['landscape','Landscape']].map(([v,l])=>`<button class="opt-card ${expOpts.orient===v?'on':''}" data-x="orient" data-v="${v}" style="justify-content:center;padding:12px 6px"><b>${l}</b></button>`).join('')}</div></div>
    </div>
    <div id="expZipOpts" ${expOpts.format!=='zip'?'hidden':''}>
      <div class="opt-group"><h5>Image quality</h5><div class="opt-cards" style="grid-template-columns: repeat(3, 1fr)">
        ${[['low','Low'],['medium','Medium'],['high','High']].map(([v,l])=>`<button class="opt-card ${expOpts.zipq===v?'on':''}" data-x="zipq" data-v="${v}" style="justify-content:center;padding:12px 6px"><b>${l}</b></button>`).join('')}</div></div>
    </div>
    <button class="btn btn-primary btn-block" id="btnGenerate" style="height:48px;font-size:15.5px">${ic('download')} ${expOpts.format==='pdf'?'Export PDF':'Export ZIP'} · ${n} page${n===1?'':'s'}</button>
    <div class="exp-prog" id="expProg" hidden><div class="bar striped"><i id="expBar"></i></div><div class="prog-label" id="expProgLabel"></div></div>`;
  $('#expBody').querySelectorAll('[data-x]').forEach(b=>b.addEventListener('click',()=>{
    expOpts[b.dataset.x]=b.dataset.v; buildExportBody(); }));
  const chk = $('#chkUniform');
  if(chk) chk.addEventListener('change', (e) => { expOpts.uniformSize = e.target.checked; });
  $('#btnGenerate').addEventListener('click',generateExport);
}
async function canvasJpeg(cv,q){ return new Promise(res=>cv.toBlob(b=>res(b),'image/jpeg',q)); }
async function generateExport(){
  const pages=exportScope(), n=pages.length; if(!n) return;
  $('#btnGenerate').disabled=true; $('#expProg').hidden=false;
  const setP=(f,l)=>{ $('#expBar').style.width=Math.round(f*100)+'%'; if(l) $('#expProgLabel').textContent=l; };
  await ensureFonts();
  try{
    let blob,name;
    if(expOpts.format==='pdf'){
      const doc=await PDFLib.PDFDocument.create();
      doc.setTitle('Rkrid document'); doc.setCreator('Rkrid — local PDF studio');
      const baseW={standard:1240,high:1750,maximum:2400}[expOpts.pdfq], q={standard:.78,high:.88,maximum:.95}[expOpts.pdfq];
      let uniformW, uniformH;
      for(let i=0;i<n;i++){
        setP(i/n*0.9,`Rendering page ${i+1} of ${n}…`); await tick();
        const cv=await composePage(pages[i],baseW);
        const iw=cv.width*0.75, ih=cv.height*0.75;
        let pw=iw, ph=ih;
        if(i===0 && expOpts.uniformSize) { uniformW=iw; uniformH=ih; }
        if(expOpts.size==='a4'||expOpts.size==='letter'){
          const base=expOpts.size==='a4'?[595.28,841.89]:[612,792];
          const land = expOpts.orient==='landscape'||(expOpts.orient==='auto'&&iw>ih);
          pw=land?base[1]:base[0]; ph=land?base[0]:base[1];
        } else if(expOpts.uniformSize && uniformW) {
          pw=uniformW; ph=uniformH;
        }
        const jpg=await canvasJpeg(cv,q);
        const img=await doc.embedJpg(await jpg.arrayBuffer());
        const pg=doc.addPage([pw,ph]);
        const sc=Math.min(pw/iw,ph/ih), dw=iw*sc, dh=ih*sc;
        pg.drawImage(img,{x:(pw-dw)/2,y:(ph-dh)/2,width:dw,height:dh});
      }
      setP(0.94,'Generating PDF…');
      blob=new Blob([await doc.save()],{type:'application/pdf'});
      let counter = parseInt(localStorage.getItem('rkrid-export-counter') || '1', 10);
      localStorage.setItem('rkrid-export-counter', counter + 1);
      name=`rkrid-document-${counter}.pdf`;
    } else {
      const zip=new JSZip(), w={low:1000,medium:1600,high:2200}[expOpts.zipq], q={low:.7,medium:.85,high:.92}[expOpts.zipq];
      for(let i=0;i<n;i++){
        setP(i/n*0.7,`Rendering page ${i+1} of ${n}…`); await tick();
        const cv=await composePage(pages[i],w);
        zip.file(`page-${pad3(i)}.jpg`, await canvasJpeg(cv,q));
      }
      setP(0.72,'Preparing ZIP…');
      blob=await zip.generateAsync({type:'blob'},m=>setP(0.72+m.percent/100*0.26));
      let counter = parseInt(localStorage.getItem('rkrid-export-counter') || '1', 10);
      localStorage.setItem('rkrid-export-counter', counter + 1);
      name=`rkrid-pages-${counter}.zip`;
    }
    setP(1,'Done');
    lastExport={blob,name};
    $('#expBody').innerHTML=`
      <div class="success-big">
        <span class="ok">${ic('check')}</span>
        <h3>Your document is ready</h3>
        <p>${n} page${n===1?'':'s'} · ${fmtBytes(blob.size)}</p>
        <div class="meta mono">${name}</div>
        <button class="btn btn-primary btn-block" id="btnDownload" style="height:50px;margin-top:18px">${ic('download')} Download ${expOpts.format.toUpperCase()}</button>
        <button class="btn btn-sec btn-block" id="btnOther" style="margin-top:9px">${expOpts.format==='pdf'?ic('archive')+' Export as ZIP instead':ic('file')+' Export as PDF instead'}</button>
        <button class="btn btn-ghost btn-block" id="btnAgain" style="margin-top:4px">${ic('pencil')} Edit again</button>
      </div>`;
    $('#btnDownload').addEventListener('click',()=>saveBlob(lastExport.blob,lastExport.name));
    $('#btnOther').addEventListener('click',()=>{ expOpts.format=expOpts.format==='pdf'?'zip':'pdf'; buildExportBody(); });
    $('#btnAgain').addEventListener('click',()=>hideModal('#exportModal'));
  }catch(e){
    $('#expProg').hidden=true; $('#btnGenerate').disabled=false;
    toast('Export failed — '+(e.message||'something went wrong. Try again or lower the quality.'),'err',{label:'Try again',fn:generateExport});
  }
}
function saveBlob(blob,name){ const a=document.createElement('a');
  a.href=URL.createObjectURL(blob); a.download=name; document.body.appendChild(a); a.click();
  setTimeout(()=>{ URL.revokeObjectURL(a.href); a.remove(); },4000); }

/* ================= SAMPLE DOCUMENT ================= */
function sampleCanvas(w,h,draw){ const c=document.createElement('canvas'); c.width=w; c.height=h; draw(c.getContext('2d'),w,h); return c; }
function loadSample(){
  const W=1240,H=1754;
  const p1=sampleCanvas(W,H,(x,w,h)=>{ x.fillStyle='#171b26'; x.fillRect(0,0,w,h);
    x.fillStyle='#2743e3'; x.fillRect(110,150,180,14);
    x.fillStyle='#fff'; x.font='800 118px "Bricolage Grotesque", sans-serif';
    x.fillText('The Rkrid',110,420); x.fillText('Sample',110,545);
    x.font='500 34px "IBM Plex Mono", monospace'; x.fillStyle='#8ea0ff';
    x.fillText('IMPORT → ORGANIZE → EDIT → EXPORT',110,650);
    x.fillStyle='rgba(255,255,255,.14)'; for(let i=0;i<4;i++) x.fillRect(110,1350+i*66,760,3);
    x.fillStyle='#e8960c'; x.beginPath(); x.arc(w-220,1420,120,0,7); x.fill();
    x.fillStyle='#171b26'; x.font='800 44px "Bricolage Grotesque", sans-serif'; x.fillText('A4',w-262,1436); });
  const p2=sampleCanvas(W,H,(x,w,h)=>{ x.fillStyle='#fff'; x.fillRect(0,0,w,h);
    x.fillStyle='#171b26'; x.font='800 64px "Bricolage Grotesque", sans-serif';
    x.fillText('1 · Reorder anything',110,220);
    x.fillStyle='#2743e3'; x.fillRect(110,252,320,8);
    x.fillStyle='#c8cdd8';
    x.font='400 30px "Instrument Sans", sans-serif';
    for(let i=0;i<24;i++){ const wd=[900,820,870,700,850,640][i%6]; x.fillRect(110,340+i*54,wd,16); }
    x.fillStyle='#2743e3'; x.font='800 150px Georgia, serif'; x.fillText('D',110,470);
    x.fillStyle='#e8960c'; x.fillRect(110,h-260,1020,10);
    x.fillStyle='#5b6474'; x.font='500 26px "IBM Plex Mono", monospace';
    x.fillText('TIP — drag the ⠿ handle, or long-press a card on mobile',110,h-190); });
  const p3=sampleCanvas(W,H,(x,w,h)=>{ x.fillStyle='#2743e3'; x.fillRect(0,0,w,h);
    x.fillStyle='rgba(255,255,255,.12)'; for(let gx=0;gx<w;gx+=62) for(let gy=0;gy<h;gy+=62) x.fillRect(gx,gy,3,3);
    x.fillStyle='#fff'; x.font='800 92px "Bricolage Grotesque", sans-serif';
    x.fillText('“Crop it. Fix it.',110,620); x.fillText(' Ship it.”',110,740);
    x.font='500 32px "IBM Plex Mono", monospace'; x.fillStyle='#ffd58a';
    x.fillText('— every page, fully editable',114,840);
    x.fillStyle='#fff'; x.beginPath(); x.roundRect(110,h-380,460,170,18); x.fill();
    x.fillStyle='#171b26'; x.font='700 40px "Instrument Sans", sans-serif';
    x.fillText('Try the tools →',150,h-275); });
  [['sample-cover.png',p1],['sample-notes.png',p2],['sample-quote.png',p3]].forEach(([fn,cv])=>{
    state.pages.push(makePage(regSrc({kind:'image',img:cv,w:W,h:H}),W,H,{ptype:'image',fileName:fn,tag:'Sample'})); });
  pushHistory(); renderWorkspace();
  toast('Sample document loaded — 3 pages','ok');
}

/* ================= WIRING ================= */
function wireStatic(){
  /* theme toggle */
  const savedTheme = localStorage.getItem('bindery-theme') || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
  document.documentElement.setAttribute('data-theme', savedTheme);
  const updateThemeIcon = (t) => { const btn = $('#btnThemeToggle'); if(btn) btn.innerHTML = t === 'dark' ? ic('sun') : ic('moon'); };
  updateThemeIcon(savedTheme);
  $('#btnThemeToggle')?.addEventListener('click', () => {
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    const newTheme = isDark ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', newTheme);
    localStorage.setItem('bindery-theme', newTheme);
    updateThemeIcon(newTheme);
  });

  /* settings toggle */
  const btnSettingsToggle = $('#btnSettingsToggle');
  if(btnSettingsToggle) {
    btnSettingsToggle.innerHTML = ic('settings');
    const drop = $('#settingsDropdown');
    btnSettingsToggle.addEventListener('click', (e) => {
      e.stopPropagation();
      drop.style.display = drop.style.display === 'none' ? 'flex' : 'none';
    });
    document.addEventListener('click', (e) => {
      if(!btnSettingsToggle.contains(e.target) && !drop.contains(e.target)){
        drop.style.display = 'none';
      }
    });
    
    /* zoom application */
    const zoomSlider = $('#appZoomSlider');
    const zoomVal = $('#appZoomVal');
    zoomSlider?.addEventListener('input', (e) => {
      const v = e.target.value;
      zoomVal.textContent = v + '%';
      document.body.style.zoom = v / 100;
    });

    /* font size */
    const fontSlider = $('#appFontSlider');
    const fontVal = $('#appFontVal');
    fontSlider?.addEventListener('input', (e) => {
      const v = e.target.value;
      fontVal.textContent = v + '%';
      document.documentElement.style.fontSize = (16 * (v / 100)) + 'px';
    });
  }
  /* icons into buttons */
  $('#btnUndo').innerHTML=ic('undo'); $('#btnRedo').innerHTML=ic('redo');
  $('#edUndo').innerHTML=ic('undo'); $('#edRedo').innerHTML=ic('redo');
  $('#viewGrid').innerHTML=ic('grid'); $('#viewList').innerHTML=ic('list');
  $('#zoomOut').innerHTML=ic('minus'); $('#zoomIn').innerHTML=ic('plus');
  $('#btnAdd').innerHTML=ic('plus')+'<span>Add</span>'; $('#btnExport').innerHTML=ic('download')+'<span>Export PDF</span>';
  $('#btnImportMain').innerHTML=ic('upload')+' Import Files'; $('#btnSample').innerHTML=ic('sparkle')+' Try a sample';
  $('#privacyLine').innerHTML=ic('shield')+'<span><b>Your files are processed locally whenever possible.</b> Nothing is uploaded — Rkrid runs entirely in your browser. *HEIC works where your browser supports it.</span>';
  $('#mbPages').innerHTML=ic('pages')+'Pages'; $('#mbAdd').innerHTML=ic('plus')+'Add';
  $('#mbTools').innerHTML=ic('grid')+'Tools'; $('#mbAdjust').innerHTML=ic('sun')+'Adjust';
  $('#mbText').innerHTML=ic('type')+'Text'; $('#mbExport').innerHTML=ic('download')+'Export';
  $('#bulkExport').innerHTML=ic('download')+'<span class="lbl">Export</span>';
  $('#bulkLeft').innerHTML=ic('arrowL'); $('#bulkRight').innerHTML=ic('arrowR');
  $('#bulkRemove').innerHTML=ic('trash')+'<span class="lbl">Remove</span>'; $('#bulkClear').innerHTML=ic('x');
  $('#edBack').innerHTML=ic('arrowL')+'<span>Back</span>'; $('#edDone').innerHTML=ic('check')+'<span>Done</span>';
  $('#edPrev').innerHTML=ic('chevL'); $('#edNext').innerHTML=ic('chevR');
  $('#toolCrop').innerHTML=ic('crop')+'Crop'; $('#toolText').innerHTML=ic('type')+'Text'; $('#toolErase').innerHTML=ic('eraser')+'Erase';
  $('#ordLeft').innerHTML=ic('chevL')+' Left'; $('#ordRight').innerHTML='Right '+ic('chevR');
  $('#btnEdReplace').innerHTML=ic('replace')+' Replace page'; $('#btnEdDup').innerHTML=ic('pages')+' Duplicate';
  $('#btnEdRemove').innerHTML=ic('trash')+' Remove';
  $('#cropApply').innerHTML=ic('check')+' Apply';
  $('#cropRotL').innerHTML=ic('rotL')+'<span>Left</span>'; $('#cropRotR').innerHTML=ic('rotR')+'<span>Right</span>';
  $$('#pickerModal .pcheck .box').forEach(b=>b.innerHTML=ic('check'));
  /* chips */
  const chips=[['crop','crop','Crop'],['bright','sun','Brightness'],['contrast','contrast','Contrast'],
    ['dark','moon','Darkness'],['hue','sparkle','Hue'],['text','type','Text'],['erase','eraser','Erase'],['replace','replace','Replace']];
  $('#edChips').innerHTML=chips.map(([t,icn,l])=>`<button class="chip" data-tool="${t}" data-chip>${ic(icn)}${l}</button>`).join('');
  $$('#edChips [data-chip]').forEach(c=>c.addEventListener('click',()=>{
    const t=c.dataset.tool;
    if(t==='replace'){ pageAction(state.editingId,'replace'); return; }
    if(['bright','contrast','dark','hue'].includes(t)){ openSheet({title:'Adjust page',body:$('#secAdjust')}); return; }
    if(state.tool===t){ setTool(''); return; }
    setTool(t);
    if(isNarrow()) openSheet({title:t==='crop'?'Crop':t==='text'?'Add text':'Erase',
      body:$('#sec'+t[0].toUpperCase()+t.slice(1))});
  }));
  /* crop presets */
  $('#cropPresets').innerHTML=CROP_PRESETS.map(([l,a],i)=>`<button class="preset${i===0?' on':''}" data-a="${a}">${l}</button>`).join('');
  $$('#cropPresets .preset').forEach(b=>b.addEventListener('click',()=>{
    const p = currentPage(); if(!p || !cropPx) return;
    $$('#cropPresets .preset').forEach(x=>x.classList.remove('on')); b.classList.add('on');
    const a=b.dataset.a; cropAspect=a==='orig'?(p.w/p.h):+a;
    if(cropAspect){ const cx=cropPx.x+cropPx.w/2, cy=cropPx.y+cropPx.h/2;
      let w=cropPx.w, h=w/cropAspect; if(h>dispH){h=dispH;w=h*cropAspect;}
      cropPx={x:clamp(cx-w/2,0,dispW-w),y:clamp(cy-h/2,0,dispH-h),w,h}; paintCropBox(); }
  }));
  $('#cropApply').addEventListener('click',applyCrop);
  $('#cropCancel').addEventListener('click',()=>setTool(''));
  $('#cropReset').addEventListener('click',resetCrop);
  $('#cropRotL').addEventListener('click',()=>rotatePage(state.editingId,-90));
  $('#cropRotR').addEventListener('click',()=>rotatePage(state.editingId,90));
  $('#toolPgNum').innerHTML=ic('hash')+'<span>Pg Number</span>';
  $('#pnAl').innerHTML=ic('alignL'); $('#pnAc').innerHTML=ic('alignC'); $('#pnAr').innerHTML=ic('alignR');
  $$('#secPgNum .seg-mini button').forEach(b=>b.addEventListener('click',e=>{
    if(b.id.startsWith('pnMv')) return;
    $$('#secPgNum .seg-mini button').forEach(x=>{ if(!x.id.startsWith('pnMv')) x.classList.remove('on'); });
    b.classList.add('on');
  }));
  $('#pnMvU').innerHTML=ic('arrowU'); $('#pnMvD').innerHTML=ic('arrowD');
  $('#pnMvL').innerHTML=ic('arrowL'); $('#pnMvR').innerHTML=ic('arrowR');
  const updatePgNums = (fn) => { let changed = false; state.pages.forEach(p => { p.texts.forEach(t => { if(t.isPgNum) { fn(t, p); changed = true; } }); }); if(changed) { markDirty(state.pages); if(!$('#editor').hidden) refreshEditor(); } };
  $('#pnMvU').addEventListener('click', () => { pushHistory(); updatePgNums((t,p) => t.y -= p.h * 0.015); });
  $('#pnMvD').addEventListener('click', () => { pushHistory(); updatePgNums((t,p) => t.y += p.h * 0.015); });
  $('#pnMvL').addEventListener('click', () => { pushHistory(); updatePgNums((t,p) => t.x -= p.w * 0.015); });
  $('#pnMvR').addEventListener('click', () => { pushHistory(); updatePgNums((t,p) => t.x += p.w * 0.015); });
  $('#pnColor').addEventListener('input', e => updatePgNums(t => t.color = e.target.value));
  $('#pnShadow').addEventListener('input', e => updatePgNums(t => t.shadowColor = e.target.value));
  $('#pnShadowClear').addEventListener('click', () => { $('#pnShadow').value='#ffffff'; updatePgNums(t => t.shadowColor = null); });

  $('#pnMode').addEventListener('change',e=>{ $('#pnFormatRow').hidden = e.target.value === 'auto'; });
  $('#pnMargin').addEventListener('input',e=>{ $('#pnMarginVal').textContent=e.target.value+'%'; });
  const applyPgNum = (onlySel) => {
    const targets = onlySel && state.selection.size ? [...state.selection].map(id=>state.pages.find(p=>p.id===id)) : state.pages;
    if(!targets.length) return toast('No target pages','info');
    const mode = $('#pnMode').value;
    const format = mode === 'auto' ? 'Page {n}' : $('#pnFormat').value;
    const alignId = $('#secPgNum .seg-mini .on').id;
    const align = alignId === 'pnAl' ? 'l' : alignId === 'pnAr' ? 'r' : 'c';
    const pos = $('#pnPos').value;
    const margin = +$('#pnMargin').value / 100;
    const color = $('#pnColor').value;
    const shadowColor = $('#pnShadow').value === '#ffffff' ? null : $('#pnShadow').value;
    pushHistory();
    targets.forEach((p, i) => {
      p.texts = p.texts.filter(t => !t.isPgNum);
      let txt = format.replace('{n}', i+1).replace('{t}', targets.length).replace('{f}', p.fileName.replace(/\.[^/.]+$/, ""));
      const crop = cropOf(p);
      const w = Math.min(crop.w * 0.8, 600);
      let x = crop.x + (crop.w - w) / 2;
      if(align === 'l') x = crop.x + crop.w * 0.05;
      if(align === 'r') x = crop.x + crop.w * 0.95 - w;
      let y = pos === 'bottom' ? crop.y + crop.h * (1 - margin) : crop.y + crop.h * margin;
      p.texts.push({ id: uid(), isPgNum: true, x, y, w, text: txt, font: 'Helvetica', size: Math.max(16, crop.w*0.035), bold: false, italic: false, underline: false, color, shadowColor, align: align==='l'?'left':align==='r'?'right':'center', opacity: 1, spacing: 0 });
    });
    markDirty(targets);
    if(!$('#editor').hidden) refreshEditor();
    toast(`Page numbers added to ${targets.length} page(s)`);
  };
  $('#pnApplyAll').addEventListener('click',()=>applyPgNum(false));
  $('#pnApplySel').addEventListener('click',()=>applyPgNum(true));
  $$('.tool-btn').forEach(b=>b.addEventListener('click',()=>setTool(state.tool===b.dataset.tool?'':b.dataset.tool)));
  /* adjust/text/erase panels */
  buildAdjust(); buildTextControls($('#textContent')); buildEraseControls($('#eraseContent'));
  /* editor chrome */
  $('#edBack').addEventListener('click',()=>closeEditor());
  $('#edDone').addEventListener('click',()=>closeEditor());
  $('#edPrev').addEventListener('click',()=>{ const i=idxOf(state.editingId); if(i>0){state.editingId=state.pages[i-1].id; setTool(''); refreshEditor(); renderRail();} });
  $('#edNext').addEventListener('click',()=>{ const i=idxOf(state.editingId); if(i<state.pages.length-1){state.editingId=state.pages[i+1].id; setTool(''); refreshEditor(); renderRail();} });
  $('#ordLeft').addEventListener('click',()=>movePage(state.editingId,-1));
  $('#ordRight').addEventListener('click',()=>movePage(state.editingId,1));
  $('#btnEdReplace').addEventListener('click',()=>pageAction(state.editingId,'replace'));
  $('#btnEdDup').addEventListener('click',()=>duplicatePage(state.editingId));
  $('#btnEdRemove').addEventListener('click',()=>removePages([state.editingId]));
  /* undo/redo */
  [['#btnUndo'],['#edUndo']].forEach(([s])=>$(s)?.addEventListener('click',undo));
  [['#btnRedo'],['#edRedo']].forEach(([s])=>$(s)?.addEventListener('click',redo));
  /* view toggle */
  $('#viewGrid').addEventListener('click',()=>{ state.view='grid'; $('#viewGrid').classList.add('on'); $('#viewList').classList.remove('on'); updateZoom(); renderWorkspace(); });
  $('#viewList').addEventListener('click',()=>{ state.view='list'; $('#viewList').classList.add('on'); $('#viewGrid').classList.remove('on'); updateZoom(); renderWorkspace(); });
  if(state.view==='list'){ $('#viewList').classList.add('on'); $('#viewGrid').classList.remove('on'); }
  
  let gridZoom = 215;
  function updateZoom() {
    $('#zoomControls').style.display = state.view === 'grid' ? '' : 'none';
    $('#zoomIn').disabled = gridZoom >= 400;
    $('#zoomOut').disabled = gridZoom <= 100;
    document.body.style.setProperty('--cw', gridZoom + 'px');
    document.body.style.setProperty('--ps', Math.max(0.65, Math.min(1.2, gridZoom / 215)));
    $('#pageArea').classList.toggle('zoom-mini', gridZoom <= 135 && state.view === 'grid');
  }
  $('#zoomIn').addEventListener('click', () => { gridZoom += 40; updateZoom(); });
  $('#zoomOut').addEventListener('click', () => { gridZoom -= 40; updateZoom(); });
  updateZoom();
  /* import */
  const openImport=()=>$('#fileImport').click();
  $('#btnImportMain').addEventListener('click',openImport);
  $('#trayDrop').addEventListener('click',openImport);
  $('#trayDrop').addEventListener('keydown',e=>{ if(e.key==='Enter'||e.key===' '){e.preventDefault();openImport();} });
  $('#btnSample').addEventListener('click',loadSample);
  $('#btnAdd').addEventListener('click',openAddSheet);
  $('#mbAdd').addEventListener('click',openAddSheet);
  $('#fileImport').addEventListener('change',e=>{ importFiles(e.target.files); e.target.value=''; });
  $('#fileReplace').addEventListener('change',e=>{ if(replaceTargetId) handleReplaceFiles(e.target.files,replaceTargetId);
    replaceTargetId=null; e.target.value=''; });
  $('#fileCamera').addEventListener('change',e=>{ importFiles(e.target.files); e.target.value=''; });
  /* export */
  $('#btnExport').addEventListener('click',()=>openExport());
  $('#mbExport').addEventListener('click',()=>openExport());
  $('#bulkExport').addEventListener('click',()=>openExport('sel'));
  /* selection */
  $('#selAll').addEventListener('change',e=>{ state.selection.clear();
    if(e.target.checked) state.pages.forEach(p=>state.selection.add(p.id));
    renderWorkspace(); });
  $('#bulkRemove').addEventListener('click',()=>removePages([...state.selection]));
  $('#bulkLeft').addEventListener('click',()=>moveSelected(-1));
  $('#bulkRight').addEventListener('click',()=>moveSelected(1));
  $('#bulkClear').addEventListener('click',()=>{ state.selection.clear(); renderWorkspace(); });
  /* mobile bar */
  $('#mbPages').addEventListener('click',()=>{ if(!$('#editor').hidden) closeEditor(); else window.scrollTo({top:0,behavior:'smooth'}); });
  // ensureEditor: opens editor if not open; returns true if already open, false + toast if no pages
  // returns 'opened' if editor was just opened (caller should defer sheet opening)
  const ensureEditor = () => {
    if($('#editor').hidden){
      const id=[...state.selection][0]||state.pages[0]?.id;
      if(id){ openEditor(id); return 'opened'; }
      else{ toast('Import some pages first','info'); return false; }
    }
    return true;
  };
  const withEditor = (fn) => {
    const r = ensureEditor();
    if(!r) return;
    if(r==='opened') requestAnimationFrame(fn); else fn();
  };
  $('#mbTools').addEventListener('click', () => withEditor(() => {
    openSheet({title:'Tools',body:sheetList([
      {label:'Crop',icon:'crop',fn:()=>{ setTool('crop'); openSheet({title:'Crop',body:$('#secCrop')}); }},
      {label:'Page Numbers',icon:'hash',fn:()=>{ setTool('pgnum'); openSheet({title:'Page Numbers',body:$('#secPgNum')}); }},
      {label:'Replace page',icon:'replace',fn:()=>{ pageAction(state.editingId,'replace'); }},
      {label:'Undo',icon:'undo',fn:undo},
      {label:'Redo',icon:'redo',fn:redo}
    ])});
  }));
  $('#mbAdjust').addEventListener('click', () => withEditor(() => {
    setTool(''); openSheet({title:'Adjust',body:$('#secAdjust')});
  }));
  $('#mbText').addEventListener('click', () => withEditor(() => {
    openSheet({title:'Text & Erase',body:sheetList([
      {label:'Add Text',icon:'type',fn:()=>{ setTool('text'); openSheet({title:'Add text',body:$('#secText')}); }},
      {label:'Erase',icon:'eraser',fn:()=>{ setTool('erase'); openSheet({title:'Erase',body:$('#secErase')}); }}
    ])});
  }));
  // Highlight active mobile tab when tool changes
  const updateMbActive = () => {
    if(!isMobile()) return;
    const t = state.tool;
    $('#mbTools').classList.toggle('on', ['crop','pgnum'].includes(t));
    $('#mbText').classList.toggle('on', ['text','erase'].includes(t));
    $('#mbAdjust').classList.remove('on');
  };
  // Patch setTool to keep mobile bar in sync
  const _origSetTool = setTool;
  setTool = (t) => { _origSetTool(t); updateMbActive(); };
  /* file drag & drop (desktop) */
  let dragDepth=0;
  document.addEventListener('dragenter',e=>{ if([...e.dataTransfer.types].includes('Files')){ dragDepth++;
    if($('#editor').hidden) $('#dropVeil').hidden=false; } });
  document.addEventListener('dragleave',()=>{ dragDepth=Math.max(0,dragDepth-1); if(!dragDepth) hideVeil(); });
  document.addEventListener('dragover',e=>{ if([...e.dataTransfer.types].includes('Files')) e.preventDefault(); });
  document.addEventListener('drop',e=>{ if(![...e.dataTransfer.types].includes('Files')) return;
    e.preventDefault(); dragDepth=0; hideVeil();
    if(e.target.closest?.('.pcard')) return; /* handled by card */
    if(e.dataTransfer.files.length) importFiles(e.dataTransfer.files); });
  /* keyboard */
  document.addEventListener('keydown',e=>{
    const typing=e.target.closest('input,textarea,select')||e.target.isContentEditable;
    if(e.key==='Escape'){
      if(popoverEl) return closePopover();
      if(!$('#sheetHost').hidden) return closeSheet();
      if(!$('#pickerModal').hidden) return hideModal('#pickerModal');
      if(!$('#exportModal').hidden) return hideModal('#exportModal');
      if(!$('#editor').hidden) return closeEditor();
      if(state.selection.size){ state.selection.clear(); renderWorkspace(); }
      return;
    }
    if(typing) return;
    if((e.metaKey||e.ctrlKey)&&e.key.toLowerCase()==='z'){ e.preventDefault(); e.shiftKey?redo():undo(); return; }
    if((e.metaKey||e.ctrlKey)&&e.key.toLowerCase()==='y'){ e.preventDefault(); redo(); return; }
    if((e.key==='Delete'||e.key==='Backspace')&&state.selection.size&&!$('#editor').hidden===false){
      if($('#editor').hidden){ e.preventDefault(); removePages([...state.selection]); } }
    if(!$('#editor').hidden&&state.tool==='text'&&selectedTextId&&e.key==='Delete') deleteTextBox(selectedTextId);
  });
  let rsT; addEventListener('resize',()=>{ clearTimeout(rsT); rsT=setTimeout(()=>{
    closePopover(); if(!$('#editor').hidden&&state.tool!=='crop'){ layoutEditor(); renderEditorCanvas(); } },160); });
  addEventListener('beforeunload',e=>{ if(state.pages.length){ e.preventDefault(); e.returnValue=''; } });
}
function hideVeil(){ $('#dropVeil').hidden=true; }
function openAddSheet(){
  const body=document.createElement('div'); body.className='sheet-list';
  const mk=(icon,label,fn)=>{ const b=document.createElement('button'); b.className='sheet-item';
    b.innerHTML=ic(icon)+`<span>${label}</span>`; b.addEventListener('click',()=>{closeSheet();fn();}); body.appendChild(b); };
  mk('upload','Import files (PDF, JPG, PNG, …)',()=>$('#fileImport').click());
  mk('camera','Take a photo',()=>$('#fileCamera').click());
  mk('blank','Add blank page — A4 portrait',()=>addBlank(1240,1754,'Blank A4'));
  mk('blank','Add blank page — A4 landscape',()=>addBlank(1754,1240,'Blank A4 · landscape'));
  mk('blank','Add blank page — Letter',()=>addBlank(1275,1650,'Blank Letter'));
  mk('blank','Add blank page — Square',()=>addBlank(1400,1400,'Blank square'));
  openSheet({title:'Add pages',body});
}
function addBlank(w,h,label){
  const srcId=regSrc({kind:'blank',w,h,color:'#ffffff'});
  state.pages.push(makePage(srcId,w,h,{ptype:'blank',fileName:label,tag:'Blank page'}));
  pushHistory(); renderWorkspace(); toast('Blank page added','ok');
}

/* ================= INIT ================= */
if(!window.pdfjsLib||!window.PDFLib||!window.JSZip){
  addEventListener('load',()=>toast('Some libraries failed to load. Check your connection and reload.','err',null,9000));
} else {
  pdfjsLib.GlobalWorkerOptions.workerSrc='https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
}
wireStatic(); renderWorkspace(); updateHistUI();
})();