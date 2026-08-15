"use strict";
/* ============ helpers ============ */
const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
const clamp=(v,a,b)=>Math.min(b,Math.max(a,v));
const frame=()=>new Promise(r=>requestAnimationFrame(()=>setTimeout(r,0)));
const pad2=n=>String(n).padStart(2,"0");
function fmtBytes(b){ if(!b)return "0 B"; const u=["B","KB","MB","GB"]; let i=0,n=b;
  while(n>=1024 && i < u.length-1){n/=1024;i++;} return (i? n.toFixed(1):n)+" "+u[i]; }
function dimsLabel(p){
  const W=p.baseW,H=p.baseH;
  if(p.kind==="pdf"){
    const near=(a,b)=>Math.abs(a-b) < 3;
    if((near(W,595)&&near(H,842))||(near(W,842)&&near(H,595)))return "A4";
    if((near(W,420)&&near(H,595))||(near(W,595)&&near(H,420)))return "A5";
    if((near(W,612)&&near(H,792))||(near(W,792)&&near(H,612)))return "Letter";
    if((near(W,612)&&near(H,1008))||(near(W,1008)&&near(H,612)))return "Legal";
    return Math.round(W)+" × "+Math.round(H)+" pt";
  }
  return Math.round(W)+" × "+Math.round(H);
}
if(!window.pdfjsLib||!window.PDFLib) $("#libWarn").hidden=false;
if(window.pdfjsLib) pdfjsLib.GlobalWorkerOptions.workerSrc="https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.worker.min.js";

/* ============ state ============ */
const state={pages:[],files:new Map(),images:new Map(),nextId:1,lastSelected:null,editingId:null};
let undoStack=[],redoStack=[],adjDirty=false,textPropDirty=false,exportCancelled=false;
const DEFAULT_ADJ=()=>({brightness:0,contrast:0,darkness:0,sharpness:0,hue:0,saturation:0,exposure:0,opacity:100});
function newPage(o){return Object.assign({id:state.nextId++,kind:"image",fileId:null,pageIndex:0,imgId:null,
  name:"page",sizeBytes:0,baseW:100,baseH:100,rotation:0,pts:null,selected:true,
  edits:{crop:null,adj:DEFAULT_ADJ(),filter:"original",texts:[],erases:[]}},o);}
const curPage=()=>state.pages.find(p=>p.id===state.editingId)||null;
const idxOf=id=>state.pages.findIndex(p=>p.id===id);

/* ============ filters ============ */
const FILTERS={
  original:{name:"Original",css:""},
  enhance:{name:"Auto Enhance",css:"brightness(1.07) contrast(1.12) saturate(1.18)"},
  document:{name:"Document",css:"contrast(1.28) brightness(1.04) saturate(0.8)"},
  clean:{name:"Clean Document",css:"brightness(1.14) contrast(1.2) saturate(0.5)"},
  bw:{name:"Black & White",css:"grayscale(1) contrast(1.2)"},
  gray:{name:"Grayscale",css:"grayscale(1)"},
  hicon:{name:"High Contrast",css:"contrast(1.6) brightness(1.03)"},
  light:{name:"Light Document",css:"brightness(1.24) contrast(1.06)"},
  dark:{name:"Dark Document",css:"brightness(0.8) contrast(1.22)"},
  scan:{name:"Scan",css:"contrast(1.4) brightness(1.08) saturate(0.55)"},
  sharpen:{name:"Sharpen",css:"contrast(1.06)",sharp:45},
  vintage:{name:"Vintage",css:"sepia(0.5) contrast(1.06) brightness(1.04)"},
  cool:{name:"Cool",css:"hue-rotate(-14deg) saturate(1.12) brightness(1.02)"},
  warm:{name:"Warm",css:"sepia(0.28) saturate(1.2) brightness(1.05)"}
};
function cssFilterOf(p){
  const a=p.edits.adj,parts=[],preset=FILTERS[p.edits.filter]||FILTERS.original;
  if(preset.css)parts.push(preset.css);
  const bri=(1+a.brightness/100)*(1-(a.darkness/100)*0.72)*(1+a.exposure/130);
  if(Math.abs(bri-1)>0.004)parts.push("brightness("+bri.toFixed(3)+")");
  const con=1+a.contrast/100; if(Math.abs(con-1)>0.004)parts.push("contrast("+con.toFixed(3)+")");
  const sat=Math.max(0,1+a.saturation/100); if(Math.abs(sat-1)>0.004)parts.push("saturate("+sat.toFixed(3)+")");
  if(a.hue)parts.push("hue-rotate("+a.hue+"deg)");
  return parts.join(" ");
}
const opacityOf=p=>clamp((p.edits.adj.opacity??100)/100,0,1);
const sharpOf=p=>Math.min(100,(p.edits.adj.sharpness||0)+((FILTERS[p.edits.filter]||{}).sharp||0));

/* ============ toasts / confirm / progress ============ */
function toast(msg,type,ms){
  type=type||"info"; ms=ms||3600;
  const t=document.createElement("div"); t.className="toast "+(type==="error"?"error":type==="ok"?"ok":"");
  const ic=type==="error"?"i-alert":type==="ok"?"i-check":"i-spark";
  t.innerHTML='<svg><use href="#'+ic+'"/></svg><span></span>'; t.lastChild.textContent=msg;
  $("#toasts").appendChild(t);
  setTimeout(()=>{t.classList.add("out"); setTimeout(()=>t.remove(),320);},ms);
}
function confirmDialog(o){
  return new Promise(res=>{
    $("#cfTitle").textContent=o.title; $("#cfMsg").textContent=o.msg;
    const yes=$("#cfYes"); yes.textContent=o.okLabel||"Delete";
    yes.className="btn "+(o.danger===false?"primary":"danger");
    $("#confirmBd").hidden=false;
    const done=v=>{$("#confirmBd").hidden=true; yes.onclick=$("#cfNo").onclick=null; res(v);};
    yes.onclick=()=>done(true); $("#cfNo").onclick=()=>done(false);
  });
}
function showProgress(title,cancellable){
  $("#progTitle").textContent=title; $("#progFill").style.width="0%"; $("#progDetail").textContent="—";
  $("#progCancel").hidden=!cancellable; $("#progCancel").disabled=false;
  $("#progOverlay").hidden=false;
}
function setProgress(f,txt){ $("#progFill").style.width=clamp(f*100,0,100)+"%"; if(txt)$("#progDetail").textContent=txt; }
function hideProgress(){ $("#progOverlay").hidden=true; }
$("#progCancel").onclick=()=>{exportCancelled=true; $("#progCancel").disabled=true;};

/* ============ history ============ */
function pushHistory(){ undoStack.push(JSON.stringify(state.pages));
  if(undoStack.length>80)undoStack.shift(); redoStack.length=0; updateHistoryBtns(); }
function applySnapshot(json){
  state.pages=JSON.parse(json); clearThumbCache();
  if(state.editingId!=null&&!curPage()) closeEditor();
  renderGrid(); updateStats(); buildStrip();
  if(curPage()) loadEditorPage();
}
function undo(){ if(!undoStack.length)return; redoStack.push(JSON.stringify(state.pages));
  applySnapshot(undoStack.pop()); updateHistoryBtns(); toast("Undo","info",1200); }
function redo(){ if(!redoStack.length)return; undoStack.push(JSON.stringify(state.pages));
  applySnapshot(redoStack.pop()); updateHistoryBtns(); toast("Redo","info",1200); }
function updateHistoryBtns(){ $("#btnUndo").disabled=!undoStack.length; $("#btnRedo").disabled=!redoStack.length; }

/* ============ theme ============ */
function setTheme(t){ document.documentElement.dataset.theme=t;
  $("#btnTheme").innerHTML='<svg><use href="#'+(t==="dark"?"i-sun":"i-moon")+'"/></svg>';
  try{localStorage.setItem("pdfc-theme",t);}catch(e){} }
$("#btnTheme").onclick=()=>setTheme(document.documentElement.dataset.theme==="dark"?"light":"dark");
(function(){ let t=null; try{t=localStorage.getItem("pdfc-theme");}catch(e){}
  setTheme(t||(matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light")); })();

/* ============ base rendering ============ */
const MAX_AREA=12000000;
async function renderBase(page,opts){
  opts=opts||{}; const maxEdge=opts.maxEdge||1200, targetW=opts.targetW||0;
  const applyCrop=opts.applyCrop!==false;
  const crop=applyCrop?page.edits.crop:null;
  let full;
  if(page.kind==="pdf"){
    const f=state.files.get(page.fileId);
    if(!f||!f.doc) throw new Error("PDF source missing");
    const p=await f.doc.getPage(page.pageIndex);
    const vp1=p.getViewport({scale:1,rotation:page.rotation});
    let s=targetW?(targetW/(crop?crop.w:1))/vp1.width:maxEdge/Math.max(vp1.width,vp1.height);
    s=Math.min(s,6);
    if(vp1.width*s*vp1.height*s>MAX_AREA) s=Math.sqrt(MAX_AREA/(vp1.width*vp1.height));
    const vp=p.getViewport({scale:s,rotation:page.rotation});
    full=document.createElement("canvas");
    full.width=Math.max(1,Math.round(vp.width)); full.height=Math.max(1,Math.round(vp.height));
    const ctx=full.getContext("2d"); ctx.fillStyle="#fff"; ctx.fillRect(0,0,full.width,full.height);
    await p.render({canvasContext:ctx,viewport:vp}).promise;
    try{p.cleanup();}catch(e){}
  } else {
    const ent=state.images.get(page.imgId);
    if(!ent) throw new Error("Image source missing");
    let rw=page.baseW,rh=page.baseH; if(page.rotation%180){const t2=rw;rw=rh;rh=t2;}
    let s=targetW?(targetW/(crop?crop.w:1))/rw:maxEdge/Math.max(rw,rh);
    s=Math.min(s,6);
    if(rw*s*rh*s>MAX_AREA) s=Math.sqrt(MAX_AREA/(rw*rh));
    full=document.createElement("canvas");
    full.width=Math.max(1,Math.round(rw*s)); full.height=Math.max(1,Math.round(rh*s));
    const ctx=full.getContext("2d"); ctx.fillStyle="#fff"; ctx.fillRect(0,0,full.width,full.height);
    ctx.save();
    const r=((page.rotation%360)+360)%360;
    if(r===90){ctx.translate(full.width,0);ctx.rotate(Math.PI/2);}
    else if(r===180){ctx.translate(full.width,full.height);ctx.rotate(Math.PI);}
    else if(r===270){ctx.translate(0,full.height);ctx.rotate(-Math.PI/2);}
    ctx.drawImage(ent.src,0,0,page.baseW*s,page.baseH*s);
    ctx.restore();
  }
  if(crop){
    const sx=crop.x*full.width,sy=crop.y*full.height,sw=Math.max(1,crop.w*full.width),sh=Math.max(1,crop.h*full.height);
    const c2=document.createElement("canvas"); c2.width=Math.round(sw); c2.height=Math.round(sh);
    c2.getContext("2d").drawImage(full,sx,sy,sw,sh,0,0,c2.width,c2.height);
    full.width=full.height=0; return c2;
  }
  return full;
}
function applySharpen(canvas,amount){
  const a=Math.min(1.5,(amount/100)*1.4); if(a<=0.02)return;
  const w=canvas.width,h=canvas.height; if(w < 3 || h < 3)return;
  try{
    const ctx=canvas.getContext("2d");
    const src=ctx.getImageData(0,0,w,h),dst=ctx.createImageData(w,h);
    const s=src.data,d=dst.data;
    for(let y=0; y < h; y++){
      const y0=Math.max(0,y-1)*w,y1=y*w,y2=Math.min(h-1,y+1)*w;
      for(let x=0; x < w; x++){
        const xm=Math.max(0,x-1),xp=Math.min(w-1,x+1),i=(y1+x)*4;
        for(let c=0; c < 3; c++){
          const ctr=s[i+c];
          const blur=(s[(y0+xm)*4+c]+s[(y0+x)*4+c]+s[(y0+xp)*4+c]+s[(y1+xm)*4+c]+ctr+s[(y1+xp)*4+c]+s[(y2+xm)*4+c]+s[(y2+x)*4+c]+s[(y2+xp)*4+c])/9;
          let v=ctr+a*(ctr-blur); d[i+c]=v < 0?0:v>255?255:v;
        }
        d[i+3]=s[i+3];
      }
    }
    ctx.putImageData(dst,0,0);
  }catch(e){console.warn("sharpen failed",e);}
}
function wrapText(ctx,text,maxW){
  const out=[];
  String(text).split("\n").forEach(raw=>{
    const words=raw.split(" "); let line="";
    words.forEach(wd=>{
      const test=line?line+" "+wd:wd;
      if(ctx.measureText(test).width<=maxW||!line)line=test;
      else{out.push(line);line=wd;}
    });
    out.push(line);
  });
  return out;
}
function drawErases(ctx,page,W,H){
  if(!page||!page.edits||!page.edits.erases||!page.edits.erases.length)return;
  page.edits.erases.forEach(stroke=>{
    if(!stroke.pts||!stroke.pts.length)return;
    ctx.save();
    ctx.strokeStyle=stroke.color||"#ffffff";
    ctx.fillStyle=stroke.color||"#ffffff";
    const minDim=Math.min(W,H);
    ctx.lineWidth=Math.max(1,(stroke.size||0.03)*minDim);
    ctx.lineCap="round"; ctx.lineJoin="round";
    if(stroke.pts.length===1){
      const p=stroke.pts[0];
      ctx.beginPath(); ctx.arc(p.x*W,p.y*H,ctx.lineWidth/2,0,Math.PI*2); ctx.fill();
    } else {
      ctx.beginPath(); ctx.moveTo(stroke.pts[0].x*W,stroke.pts[0].y*H);
      for(let i=1; i < stroke.pts.length; i++){
        ctx.lineTo(stroke.pts[i].x*W,stroke.pts[i].y*H);
      }
      ctx.stroke();
    }
    ctx.restore();
  });
}
function drawTexts(ctx,page,W,H){
  page.edits.texts.forEach(t=>{
    ctx.save();
    const fs=Math.max(4,t.size*H),bw=t.w*W,lh=fs*1.3;
    ctx.font=(t.italic?"italic ":"")+(t.bold?"700 ":"400 ")+fs+'px "'+t.font+'", sans-serif';
    const lines=wrapText(ctx,t.text||"",Math.max(10,bw-fs*0.7));
    const blockH=lines.length*lh,x=t.x*W,y=t.y*H,padX=fs*0.35,padY=fs*0.25;
    const cx=x+bw/2,cy=y+blockH/2;
    ctx.translate(cx,cy); ctx.rotate((t.rot||0)*Math.PI/180); ctx.translate(-cx,-cy);
    ctx.globalAlpha=clamp(t.opacity==null?1:t.opacity,0,1);
    if(t.bg){ ctx.fillStyle=t.bg;
      const rx=x-padX,ry=y-padY,rw2=bw+padX*2,rh2=blockH+padY*2,rr=Math.min(fs*0.2,8);
      ctx.beginPath();
      if(ctx.roundRect)ctx.roundRect(rx,ry,rw2,rh2,rr); else ctx.rect(rx,ry,rw2,rh2);
      ctx.fill(); }
    if(t.shadow){ctx.shadowColor=t.shadowColor||"rgba(0,0,0,.5)";ctx.shadowBlur=fs*0.18;ctx.shadowOffsetY=fs*0.07;}
    ctx.fillStyle=t.color; ctx.textBaseline="top";
    lines.forEach((ln,i)=>{
      let lx=x; ctx.textAlign="left";
      if(t.align==="center"){ctx.textAlign="center";lx=x+bw/2;}
      if(t.align==="right"){ctx.textAlign="right";lx=x+bw;}
      ctx.fillText(ln,lx,y+i*lh);
      if(t.underline){
        const wL=ctx.measureText(ln).width; let x0=x;
        if(t.align==="center")x0=x+bw/2-wL/2;
        if(t.align==="right")x0=x+bw-wL;
        ctx.fillRect(x0,y+i*lh+fs*1.04,wL,Math.max(1,fs*0.06));
      }
    });
    ctx.restore();
  });
}
function pagePhysical(page){
  const c=page.edits.crop; let w,h;
  if(page.kind==="pdf"){w=page.baseW;h=page.baseH;}
  else if(page.pts){w=page.pts[0];h=page.pts[1];}
  else{w=page.baseW*0.75;h=page.baseH*0.75;}
  if(page.rotation%180){const t2=w;w=h;h=t2;}
  if(c){w*=c.w;h*=c.h;}
  return [Math.max(20,w),Math.max(20,h)];
}

/* ============ thumbnails ============ */
const thumbCache=new Map();
const thumbKey=p=>p.rotation+"|"+JSON.stringify(p.edits.crop);
function clearThumbCache(){ thumbCache.forEach(e=>{try{URL.revokeObjectURL(e.url);}catch(x){}}); thumbCache.clear(); }
async function ensureThumb(p,w){
  w=w||320; const k=thumbKey(p),c=thumbCache.get(p.id);
  if(c&&c.key===k)return c.url;
  if(c){try{URL.revokeObjectURL(c.url);}catch(x){} thumbCache.delete(p.id);}
  const cv=await renderBase(p,{maxEdge:w});
  const blob=await new Promise(r=>cv.toBlob(r,"image/jpeg",0.82));
  cv.width=cv.height=0;
  const url=URL.createObjectURL(blob);
  thumbCache.set(p.id,{url:url,key:k});
  if(thumbCache.size>280){
    const first=thumbCache.keys().next().value,e=thumbCache.get(first);
    try{URL.revokeObjectURL(e.url);}catch(x){} thumbCache.delete(first);
  }
  return url;
}
function refreshThumbFor(p){
  const c=thumbCache.get(p.id);
  if(c){try{URL.revokeObjectURL(c.url);}catch(x){} thumbCache.delete(p.id);}
  const card=grid.querySelector('.pcard[data-id="'+p.id+'"]');
  if(card){card.dataset.thumbKey=""; paintCardThumb(card,p);}
  refreshStripItem(p);
}

/* ============ import ============ */
const isImageFile=f=>/^image\//.test(f.type)||/\.(png|jpe?g|gif|webp|bmp|svg|tiff?|avif|ico)$/i.test(f.name);
const isPdfFile=f=>f.type==="application/pdf"||/\.pdf$/i.test(f.name);
async function loadDrawable(file){
  const buf=await file.arrayBuffer();
  const blob=new Blob([buf],{type:file.type||"image/*"});
  try{const bmp=await createImageBitmap(blob); if(bmp.width)return bmp;}catch(e){}
  return await new Promise((res,rej)=>{
    const url=URL.createObjectURL(blob),img=new Image();
    img.onload=()=>{URL.revokeObjectURL(url); img.width?res(img):rej(new Error("empty image"));};
    img.onerror=()=>{URL.revokeObjectURL(url);rej(new Error("decode failed"));};
    img.src=url;
  });
}
async function importImageFile(file,insertAt){
  const src=await loadDrawable(file);
  const imgId=state.nextId++;
  state.images.set(imgId,{src:src,w:src.width||src.naturalWidth,h:src.height||src.naturalHeight});
  const fileId=state.nextId++;
  state.files.set(fileId,{kind:"image",name:file.name,size:file.size});
  const pg=newPage({kind:"image",imgId:imgId,fileId:fileId,name:file.name,sizeBytes:file.size,
    baseW:src.width||src.naturalWidth,baseH:src.height||src.naturalHeight});
  if(insertAt==null||insertAt < 0)state.pages.push(pg); else state.pages.splice(insertAt,0,pg);
  return pg;
}
async function importPdfFile(file, insertAt, isQuickMode = false) {
  const bytes = new Uint8Array(await file.arrayBuffer());
  const task = pdfjsLib.getDocument({ data: bytes.slice() });
  task.onProgress = pr => { if (pr.total) setProgress(pr.loaded / pr.total, "Reading " + file.name + " · " + fmtBytes(pr.loaded) + " / " + fmtBytes(pr.total)); };
  const doc = await task.promise;
  const isHeavy = doc.numPages > 50 || file.size > 15 * 1024 * 1024;
  const useQuick = isQuickMode || isHeavy;

  const fileId = state.nextId++;
  state.files.set(fileId, { kind: "pdf", name: file.name, size: file.size, doc: doc, numPages: doc.numPages });
  const made = [];

  if (useQuick) {
    setProgress(0.4, `⚡ Quick Importing ${file.name} (${doc.numPages} pages)…`);
    await frame();
    let defW = 595, defH = 842;
    try {
      const p1 = await doc.getPage(1);
      const vp1 = p1.getViewport({ scale: 1 });
      defW = vp1.width; defH = vp1.height;
      try { p1.cleanup(); } catch (e) {}
    } catch (e) {}

    for (let i = 1; i <= doc.numPages; i++) {
      made.push(newPage({
        kind: "pdf",
        fileId: fileId,
        pageIndex: i,
        name: file.name,
        sizeBytes: file.size,
        baseW: defW,
        baseH: defH
      }));
    }

    setTimeout(async () => {
      for (let i = 2; i <= doc.numPages; i++) {
        try {
          const p = await doc.getPage(i);
          const vp = p.getViewport({ scale: 1 });
          const pgItem = made[i - 1];
          if (pgItem && (pgItem.baseW !== vp.width || pgItem.baseH !== vp.height)) {
            pgItem.baseW = vp.width; pgItem.baseH = vp.height;
          }
          try { p.cleanup(); } catch (e) {}
        } catch (e) {}
        if (i % 60 === 0) await frame();
      }
    }, 150);
  } else {
    for (let i = 1; i <= doc.numPages; i++) {
      const p = await doc.getPage(i); const vp = p.getViewport({ scale: 1 });
      made.push(newPage({ kind: "pdf", fileId: fileId, pageIndex: i, name: file.name, sizeBytes: file.size, baseW: vp.width, baseH: vp.height }));
      try { p.cleanup(); } catch (e) {}
      if (i % 25 === 0) { setProgress(i / doc.numPages, "Parsing " + file.name + " · page " + i + "/" + doc.numPages); await frame(); }
    }
  }

  if (insertAt == null || insertAt < 0) state.pages.push.apply(state.pages, made);
  else state.pages.splice.apply(state.pages, [insertAt, 0].concat(made));
  return made.length;
}

function loadError(e, name) {
  if (e && e.name === "PasswordException") toast('"' + name + '" is password-protected and can\'t be opened.', "error");
  else if (e && e.name === "InvalidPDFException") toast('"' + name + '" is corrupted or not a valid PDF.', "error");
  else toast('Could not load "' + name + '" — ' + (e.message || "unsupported format") + ".", "error");
}

async function importFiles(list, opts = {}) {
  const files = [...list]; if (!files.length) return;
  const isQuickMode = !!opts.isQuickMode;
  const total = files.reduce((s, f) => s + f.size, 0);
  if (total > 350 * 1024 * 1024 && !isQuickMode) {
    const ok = await confirmDialog({ title: "Very large import", msg: "You are importing " + fmtBytes(total) + ". Continue with Quick Import?", okLabel: "⚡ Quick Import", danger: false });
    if (!ok) return;
  }
  showProgress(isQuickMode ? "⚡ Quick Importing heavy PDF…" : "Importing files…"); pushHistory();
  let okC = 0, failC = 0, pageC = 0;
  for (let i = 0; i < files.length; i++) {
    const f = files[i];
    setProgress(i / files.length, (isQuickMode ? "⚡ Quick Processing " : "File ") + (i + 1) + " / " + files.length + " · " + f.name);
    await frame();
    try {
      if (isPdfFile(f)) pageC += await importPdfFile(f, null, isQuickMode);
      else if (isImageFile(f)) { await importImageFile(f); pageC++; }
      else { failC++; toast("Unsupported file type: " + f.name, "error"); continue; }
      okC++;
    } catch (e) { failC++; loadError(e, f.name); }
  }
  hideProgress(); renderGrid(); updateStats(); switchView();
  if (okC) toast((isQuickMode ? "⚡ Quick imported " : "Imported ") + pageC + " page" + (pageC !== 1 ? "s" : "") + " from " + okC + " file" + (okC !== 1 ? "s" : "") + (failC ? " · " + failC + " failed" : ""), "ok");
}

$("#importInput").addEventListener("change", e => { importFiles(e.target.files); e.target.value = ""; });
if ($("#quickImportInput")) $("#quickImportInput").addEventListener("change", e => { importFiles(e.target.files, { isQuickMode: true }); e.target.value = ""; });
if ($("#btnImport")) $("#btnImport").onclick = () => $("#importInput").click();
if ($("#heroImport")) $("#heroImport").onclick = () => $("#importInput").click();
if ($("#btnQuickImport")) $("#btnQuickImport").onclick = () => $("#quickImportInput").click();
if ($("#heroQuickImport")) $("#heroQuickImport").onclick = () => $("#quickImportInput").click();
let dragDepth=0;
let isInternalCardDrag=false;
addEventListener("dragenter",e=>{if(!isInternalCardDrag&&e.dataTransfer&&[...e.dataTransfer.types].includes("Files")){dragDepth++;document.body.classList.add("dragging-file");}});
addEventListener("dragleave",()=>{if(!isInternalCardDrag&&--dragDepth<=0){dragDepth=0;document.body.classList.remove("dragging-file");}});
addEventListener("dragover",e=>{e.preventDefault();if(isInternalCardDrag)e.dataTransfer.dropEffect="move";});
addEventListener("drop",e=>{e.preventDefault();dragDepth=0;document.body.classList.remove("dragging-file");
  if(!isInternalCardDrag&&e.dataTransfer.files&&e.dataTransfer.files.length)importFiles(e.dataTransfer.files);});

/* ============ grid ============ */
const grid=$("#grid");
const io=new IntersectionObserver(entries=>{
  entries.forEach(en=>{
    if(!en.isIntersecting)return;
    const card=en.target,id=+card.dataset.id,p=state.pages.find(x=>x.id===id);
    if(p&&card.dataset.thumbKey!==thumbKey(p)&&!card.dataset.loading)paintCardThumb(card,p);
  });
},{rootMargin:"700px"});
function pcMetaHTML(p){
  const sz = p.sizeBytes ? fmtBytes(p.sizeBytes) : "—";
  const type = p.kind === "pdf" ? "PDF" : "IMAGE";
  return '<span>' + sz + ' | ' + dimsLabel(p) + ' • ' + type + '</span>';
}
function makeCard(p,i){
  const card=document.createElement("article");
  card.className="pcard"+(p.selected!==false?" selected":""); card.dataset.id=p.id; card.style.setProperty("--i",Math.min(i,24));
  const kind=p.kind==="pdf"?"PDF":"IMG";
  card.innerHTML=
    '<div class="pc-thumb" data-act="edit" title="Open in editor">'+
      '<div class="thumb-load"></div>'+
      '<label class="pg-chk" title="Select page for PDF export" onclick="event.stopPropagation()">'+
        '<input type="checkbox" class="pg-select-chk" data-id="'+p.id+'" '+(p.selected!==false?'checked':'')+' />'+
        '<span class="pg-chk-mark"><svg viewBox="0 0 24 24"><path d="M20 6L9 17l-5-5" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg></span>'+
      '</label>'+
      '<span class="p-num">Page '+pad2(i+1)+'</span>'+
      '<span class="p-kind '+(p.kind==="pdf"?"pdf":"img")+'">'+kind+'</span>'+
    '</div>'+
    '<div class="pc-info">'+
      '<div class="pc-info-main">'+
        '<div class="pc-name" title="'+p.name+'">'+p.name+'</div>'+
        '<div class="pc-meta">'+pcMetaHTML(p)+'</div>'+
      '</div>'+
      '<button class="ib sm pc-del-btn" data-act="del" title="Delete page"><svg><use href="#i-trash"/></svg></button>'+
    '</div>'+
    '<div class="pc-actions">'+
      '<button class="ib sm" data-act="moveL" title="Move left"><svg><use href="#i-left"/></svg></button>'+
      '<button class="ib sm" data-act="moveR" title="Move right"><svg><use href="#i-right"/></svg></button>'+
      '<button class="ib sm" data-act="dup" title="Duplicate"><svg><use href="#i-copy"/></svg></button>'+
      '<button class="ib sm" data-act="preview" title="Preview"><svg><use href="#i-eye"/></svg></button>'+
      '<button class="ib sm" data-act="edit" title="Edit page"><svg><use href="#i-edit"/></svg></button>'+
    '</div>';
  attachCardDragEvents(card);
  io.observe(card);
  return card;
}
async function paintCardThumb(card,p){
  card.dataset.loading="1";
  const thumb=card.querySelector(".pc-thumb");
  try{
    const url=await ensureThumb(p);
    delete card.dataset.loading;
    if(!card.isConnected||+card.dataset.id!==p.id)return;
    const old=thumb.querySelector("img"); if(old)old.remove();
    const errEl=thumb.querySelector(".thumb-err"); if(errEl)errEl.remove();
    const img=document.createElement("img"); img.alt=p.name; img.src=url;
    img.style.filter=cssFilterOf(p); img.style.opacity=opacityOf(p);
    thumb.insertBefore(img,thumb.firstChild);
    const ld=thumb.querySelector(".thumb-load"); if(ld)ld.remove();
    card.dataset.thumbKey=thumbKey(p);
  }catch(e){
    delete card.dataset.loading;
    if(!card.isConnected)return;
    const ld=thumb.querySelector(".thumb-load"); if(ld)ld.remove();
    if(!thumb.querySelector(".thumb-err")){
      const d=document.createElement("div"); d.className="thumb-err";
      d.innerHTML='<svg><use href="#i-alert"/></svg><span>render failed</span>';
      thumb.insertBefore(d,thumb.firstChild);
    }
  }
}

function getDragInsertPosition(card, clientX, clientY) {
  const rect = card.getBoundingClientRect();
  const dx = (clientX - rect.left) / rect.width;
  const dy = (clientY - rect.top) / rect.height;
  let side = "left", isBefore = true;
  if (dy < 0.35) {
    side = "top"; isBefore = true;
  } else if (dy > 0.65) {
    side = "bottom"; isBefore = false;
  } else if (dx < 0.5) {
    side = "left"; isBefore = true;
  } else {
    side = "right"; isBefore = false;
  }
  return { side, isBefore };
}

function clearCardDragClasses() {
  grid.querySelectorAll(".pcard").forEach(c => {
    c.classList.remove("drag-over-left", "drag-over-right", "drag-over-top", "drag-over-bottom");
  });
}

let draggedCardIndex = null;
let touchDragCard = null;
let touchDragIndex = null;

function attachCardDragEvents(card){
  card.draggable = true;
  card.addEventListener("dragstart", e => {
    if(e.target.closest("button") || e.target.closest("input") || e.target.closest("label")){
      e.preventDefault(); return;
    }
    isInternalCardDrag = true;
    draggedCardIndex = state.pages.findIndex(p => p.id === +card.dataset.id);
    card.classList.add("dragging");
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", card.dataset.id);
    e.stopPropagation();
  });

  card.addEventListener("dragend", () => {
    card.classList.remove("dragging");
    clearCardDragClasses();
    draggedCardIndex = null;
    isInternalCardDrag = false;
  });

  card.addEventListener("dragover", e => {
    e.preventDefault();
    e.stopPropagation();
    if(draggedCardIndex === null) return;
    const targetIndex = state.pages.findIndex(p => p.id === +card.dataset.id);
    if(targetIndex === -1 || targetIndex === draggedCardIndex) return;

    e.dataTransfer.dropEffect = "move";
    clearCardDragClasses();
    const { side } = getDragInsertPosition(card, e.clientX, e.clientY);
    card.classList.add("drag-over-" + side);
  });

  card.addEventListener("dragleave", () => {
    clearCardDragClasses();
  });

  card.addEventListener("drop", e => {
    e.preventDefault();
    e.stopPropagation();
    isInternalCardDrag = false;
    clearCardDragClasses();
    if(draggedCardIndex === null) return;

    const targetIndex = state.pages.findIndex(p => p.id === +card.dataset.id);
    if(targetIndex === -1 || targetIndex === draggedCardIndex) return;

    const { isBefore } = getDragInsertPosition(card, e.clientX, e.clientY);
    let insertIndex = isBefore ? targetIndex : targetIndex + 1;
    if(draggedCardIndex < insertIndex) insertIndex--;

    pushHistory();
    const [movedPage] = state.pages.splice(draggedCardIndex, 1);
    state.pages.splice(insertIndex, 0, movedPage);

    renderGrid();
    buildStrip();
    renumber();
    toast(`Moved page to position ${insertIndex + 1}`, "ok", 1200);
  });

  card.addEventListener("touchstart", e => {
    if(e.touches.length !== 1) return;
    if(e.target.closest("button") || e.target.closest("input") || e.target.closest("label")) return;
    touchDragCard = card;
    touchDragIndex = state.pages.findIndex(p => p.id === +card.dataset.id);
  }, { passive: true });

  card.addEventListener("touchmove", e => {
    if(!touchDragCard || e.touches.length !== 1) return;
    const touch = e.touches[0];
    const targetEl = document.elementFromPoint(touch.clientX, touch.clientY);
    clearCardDragClasses();
    if(targetEl){
      const targetCard = targetEl.closest(".pcard");
      if(targetCard && targetCard !== touchDragCard){
        const { side } = getDragInsertPosition(targetCard, touch.clientX, touch.clientY);
        targetCard.classList.add("drag-over-" + side);
      }
    }
  }, { passive: true });

  card.addEventListener("touchend", e => {
    if(!touchDragCard) return;
    const touch = e.changedTouches[0];
    clearCardDragClasses();
    const targetEl = document.elementFromPoint(touch.clientX, touch.clientY);
    if(targetEl){
      const targetCard = targetEl.closest(".pcard");
      if(targetCard && targetCard !== touchDragCard){
        const targetIndex = state.pages.findIndex(p => p.id === +targetCard.dataset.id);
        if(targetIndex !== -1 && touchDragIndex !== null && targetIndex !== touchDragIndex){
          const { isBefore } = getDragInsertPosition(targetCard, touch.clientX, touch.clientY);
          let insertIndex = isBefore ? targetIndex : targetIndex + 1;
          if(touchDragIndex < insertIndex) insertIndex--;

          pushHistory();
          const [movedPage] = state.pages.splice(touchDragIndex, 1);
          state.pages.splice(insertIndex, 0, movedPage);

          renderGrid();
          buildStrip();
          renumber();
          toast(`Moved page to position ${insertIndex + 1}`, "ok", 1200);
        }
      }
    }
    touchDragCard = null;
    touchDragIndex = null;
  });
}

let draggedStripIndex = null;
let touchStripBtn = null;
let touchStripIndex = null;
let isStripDragging = false;

function attachStripDragEvents(btn){
  btn.draggable = true;
  btn.addEventListener("dragstart", e => {
    isInternalCardDrag = true;
    isStripDragging = true;
    draggedStripIndex = state.pages.findIndex(p => p.id === +btn.dataset.id);
    btn.classList.add("dragging");
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", btn.dataset.id);
    e.stopPropagation();
  });

  btn.addEventListener("dragend", () => {
    btn.classList.remove("dragging");
    $$("#edStrip .strip-item").forEach(b => b.classList.remove("drag-over"));
    draggedStripIndex = null;
    isInternalCardDrag = false;
    setTimeout(() => { isStripDragging = false; }, 100);
  });

  btn.addEventListener("dragover", e => {
    e.preventDefault();
    e.stopPropagation();
    if(draggedStripIndex === null) return;
    const targetIndex = state.pages.findIndex(p => p.id === +btn.dataset.id);
    if(targetIndex === -1 || targetIndex === draggedStripIndex) return;
    e.dataTransfer.dropEffect = "move";
    btn.classList.add("drag-over");
  });

  btn.addEventListener("dragleave", () => {
    btn.classList.remove("drag-over");
  });

  btn.addEventListener("drop", e => {
    e.preventDefault();
    e.stopPropagation();
    isInternalCardDrag = false;
    btn.classList.remove("drag-over");
    setTimeout(() => { isStripDragging = false; }, 100);
    if(draggedStripIndex === null) return;

    const targetIndex = state.pages.findIndex(p => p.id === +btn.dataset.id);
    if(targetIndex === -1 || targetIndex === draggedStripIndex) return;

    pushHistory();
    const [movedPage] = state.pages.splice(draggedStripIndex, 1);
    state.pages.splice(targetIndex, 0, movedPage);

    renderGrid();
    buildStrip();
    renumber();
    if(state.editingId != null) loadEditorPage();
    toast(`Moved page to position ${targetIndex + 1}`, "ok", 1200);
  });

  btn.addEventListener("touchstart", e => {
    if(e.touches.length !== 1) return;
    touchStripBtn = btn;
    touchStripIndex = state.pages.findIndex(p => p.id === +btn.dataset.id);
  }, { passive: true });

  btn.addEventListener("touchmove", e => {
    if(!touchStripBtn || e.touches.length !== 1) return;
    const touch = e.touches[0];
    const targetEl = document.elementFromPoint(touch.clientX, touch.clientY);
    $$("#edStrip .strip-item").forEach(b => b.classList.remove("drag-over"));
    if(targetEl){
      const targetBtn = targetEl.closest("#edStrip .strip-item");
      if(targetBtn && targetBtn !== touchStripBtn){
        targetBtn.classList.add("drag-over");
      }
    }
  }, { passive: true });

  btn.addEventListener("touchend", e => {
    if(!touchStripBtn) return;
    $$("#edStrip .strip-item").forEach(b => b.classList.remove("drag-over"));
    const targetEl = document.elementFromPoint(touch.clientX, touch.clientY);
    if(targetEl){
      const targetBtn = targetEl.closest("#edStrip .strip-item");
      if(targetBtn && targetBtn !== touchStripBtn){
        const targetIndex = state.pages.findIndex(p => p.id === +targetBtn.dataset.id);
        if(targetIndex !== -1 && touchStripIndex !== null && targetIndex !== touchStripIndex){
          isStripDragging = true;
          setTimeout(() => { isStripDragging = false; }, 100);
          pushHistory();
          const [movedPage] = state.pages.splice(touchStripIndex, 1);
          state.pages.splice(targetIndex, 0, movedPage);

          renderGrid();
          buildStrip();
          renumber();
          if(state.editingId != null) loadEditorPage();
          toast(`Moved page to position ${targetIndex + 1}`, "ok", 1200);
        }
      }
    }
    touchStripBtn = null;
    touchStripIndex = null;
  });
}
function renderGrid(){
  grid.innerHTML="";
  const frag=document.createDocumentFragment();
  state.pages.forEach((p,i)=>frag.appendChild(makeCard(p,i)));
  grid.appendChild(frag);
  renumber();
}
function renumber(){
  const cards=[...grid.children];
  cards.forEach((c,i)=>{
    const num=c.querySelector(".p-num"); if(num)num.textContent="Page "+pad2(i+1);
    c.querySelector('[data-act="moveL"]').disabled=i===0;
    c.querySelector('[data-act="moveR"]').disabled=i===cards.length-1;
  });
}
function refreshCardFx(p){
  const card=grid.querySelector('.pcard[data-id="'+p.id+'"]'); if(!card)return;
  const img=card.querySelector(".pc-thumb img");
  if(img){img.style.filter=cssFilterOf(p);img.style.opacity=opacityOf(p);}
  const si=$("#edStrip").querySelector('.strip-item[data-id="'+p.id+'"] img');
  if(si){si.style.filter=cssFilterOf(p);si.style.opacity=opacityOf(p);}
}
function updateStats(){
  const bytes=[...state.files.values()].reduce((s,f)=>s+f.size,0);
  $("#chipPages").textContent=state.pages.length+" pages";
  $("#chipFiles").textContent=state.files.size+" files";
  $("#chipSize").textContent=fmtBytes(bytes);
  const has=state.pages.length>0;
  ["btnAddPage","btnEdit","btnFitReset","btnClear","btnPreview"].forEach(id=>{
    const el=$("#"+id); if(el) el.disabled=!has;
  });
  updateSelectedStats();
}
function updateSelectedStats(){
  const sel=state.pages.filter(p=>p.selected!==false);
  const count=sel.length;
  if($("#selCount")) $("#selCount").textContent=count;
  if($("#btnExportSelected")) $("#btnExportSelected").disabled=(count===0);
  const chkAll=$("#chkSelectAll");
  if(chkAll){
    const total=state.pages.length;
    chkAll.checked=total>0 && count===total;
    chkAll.indeterminate=count>0 && count<total;
  }
}
function switchView(){
  const has=state.pages.length>0;
  $("#heroView").hidden=has; $("#workspaceView").hidden=!has;
}
grid.addEventListener("change",e=>{
  if(e.target.classList.contains("pg-select-chk")){
    const id=+e.target.dataset.id;
    const p=state.pages.find(x=>x.id===id);
    if(p){
      p.selected=e.target.checked;
      const card=grid.querySelector('.pcard[data-id="'+id+'"]');
      if(card) card.classList.toggle("selected",p.selected);
      updateSelectedStats();
    }
  }
});
grid.addEventListener("click",async e=>{
  const card=e.target.closest(".pcard"); if(!card)return;
  const id=+card.dataset.id,i=idxOf(id),p=state.pages[i]; if(!p)return;
  state.lastSelected=id;
  const btn=e.target.closest("[data-act]"); const act=btn?btn.dataset.act:null; if(!act)return;
  if(act==="edit"){openEditor(id);return;}
  if(act==="preview"){openPreview(i);return;}
  if(act==="moveL"&&i>0){
    pushHistory();
    const t2=state.pages[i-1];state.pages[i-1]=state.pages[i];state.pages[i]=t2;
    grid.insertBefore(card,card.previousElementSibling); renumber(); buildStrip(); return;
  }
  if(act==="moveR" && i < state.pages.length-1){
    pushHistory();
    const t2=state.pages[i+1];state.pages[i+1]=state.pages[i];state.pages[i]=t2;
    grid.insertBefore(card,card.nextElementSibling?card.nextElementSibling.nextElementSibling:null);
    renumber(); buildStrip(); return;
  }
  if(act==="add"){openAddPageModal(id);return;}
  if(act==="replace"){pendingReplace=id;$("#replaceInput").click();return;}
  if(act==="dup"){
    pushHistory();
    const clone=JSON.parse(JSON.stringify(p)); clone.id=state.nextId++;
    clone.edits.texts.forEach(t=>t.id=state.nextId++);
    state.pages.splice(i+1,0,clone);
    const nc=makeCard(clone,i+1); card.after(nc); paintCardThumb(nc,clone);
    renumber(); updateStats(); buildStrip(); toast("Page duplicated","ok",1600); return;
  }
  if(act==="rotL"||act==="rotR"){
    pushHistory();
    p.rotation=(((p.rotation+(act==="rotR"?90:-90))%360)+360)%360;
    card.querySelector(".pc-meta").innerHTML=pcMetaHTML(p);
    refreshThumbFor(p);
    if(state.editingId===id)repaintEditor();
    return;
  }
  if(act==="del"){
    const ok=await confirmDialog({title:"Delete Page "+pad2(i+1)+"?",msg:'"'+p.name+'" will be removed from the document. You can press Undo to bring it back.',okLabel:"Delete"});
    if(!ok)return;
    pushHistory();
    state.pages.splice(i,1);
    card.style.transition="all .22s"; card.style.opacity="0"; card.style.transform="scale(.9)";
    setTimeout(()=>{card.remove();renumber();},210);
    updateStats(); buildStrip();
    if(state.editingId===id)closeEditor();
    if(!state.pages.length)switchView();
    toast("Page "+pad2(i+1)+" deleted","info",2000);
  }
});
/* replace flow */
let pendingReplace=null;
$("#replaceInput").addEventListener("change",async e=>{
  const f=e.target.files[0]; e.target.value="";
  if(!f||pendingReplace==null)return;
  const i=idxOf(pendingReplace); pendingReplace=null; if(i < 0)return;
  const old=state.pages[i];
  const ok=await confirmDialog({title:"Replace page?",msg:"Page "+pad2(i+1)+' ("'+old.name+'") will be replaced by the new file. Its edits will be reset; its position is kept.',okLabel:"Replace",danger:false});
  if(!ok)return;
  showProgress("Replacing page…");
  try{
    let np;
    if(isPdfFile(f)){
      const bytes=new Uint8Array(await f.arrayBuffer());
      const doc=await pdfjsLib.getDocument({data:bytes.slice()}).promise;
      const fileId=state.nextId++;
      state.files.set(fileId,{kind:"pdf",name:f.name,size:f.size,doc:doc,numPages:doc.numPages});
      const p=await doc.getPage(1); const vp=p.getViewport({scale:1});
      np=newPage({kind:"pdf",fileId:fileId,pageIndex:1,name:f.name,sizeBytes:f.size,baseW:vp.width,baseH:vp.height});
      if(doc.numPages>1)toast("Multi-page PDF: only page 1 was used","info");
    } else if(isImageFile(f)){
      np=await importImageFilePop(f);
    } else throw new Error("unsupported file type");
    np.id=old.id;
    pushHistory();
    state.pages[i]=np;
    hideProgress();
    refreshThumbFor(np);
    const card=grid.querySelector('.pcard[data-id="'+np.id+'"]');
    if(card){const fresh=makeCard(np,i);card.replaceWith(fresh);paintCardThumb(fresh,np);renumber();}
    if(state.editingId===np.id){loadEditorPage();}
    if(!$("#previewView").hidden && pvIdx===i){showPvPage(i);}
    toast("Page "+pad2(i+1)+" replaced","ok");
  }catch(err){hideProgress();loadError(err,f.name);}
});
async function importImageFilePop(file){
  const src=await loadDrawable(file);
  const imgId=state.nextId++;
  state.images.set(imgId,{src:src,w:src.width||src.naturalWidth,h:src.height||src.naturalHeight});
  const fileId=state.nextId++; state.files.set(fileId,{kind:"image",name:file.name,size:file.size});
  return newPage({kind:"image",imgId:imgId,fileId:fileId,name:file.name,sizeBytes:file.size,
    baseW:src.width||src.naturalWidth,baseH:src.height||src.naturalHeight});
}
$("#btnClear").onclick=async()=>{
  const ok=await confirmDialog({title:"Clear document?",msg:"All pages will be removed. This cannot be undone.",okLabel:"Clear all"});
  if(!ok)return;
  state.pages=[]; state.files.clear(); state.images.clear();
  undoStack=[];redoStack=[];updateHistoryBtns();
  clearThumbCache(); renderGrid(); updateStats(); switchView(); closeEditor();
  toast("Document cleared","info");
};

/* ============ add page modal ============ */
let apAnchor=null,apKind="blank",pendingAddAt=-1;
const PAGE_PT={a4:[595.28,841.89],a5:[419.53,595.28],letter:[612,792],legal:[612,1008]};
function openAddPageModal(anchorId){
  apAnchor=anchorId==null?null:anchorId;
  const pos=$("#apPos");
  if(apAnchor!=null&&idxOf(apAnchor)>=0){
    pos.options[1].textContent="After Page "+pad2(idxOf(apAnchor)+1);
    pos.options[2].textContent="Before Page "+pad2(idxOf(apAnchor)+1);
    pos.value="after";
  } else {
    pos.options[1].textContent="After selected page";
    pos.options[2].textContent="Before selected page";
    pos.value="end";
  }
  $("#addPageModal").hidden=false;
}
$("#btnAddPage").onclick=()=>openAddPageModal(state.lastSelected);
$$("#apType button").forEach(b=>b.onclick=()=>{
  $$("#apType button").forEach(x=>x.classList.remove("on")); b.classList.add("on");
  apKind=b.dataset.ap; $("#apBlankOpts").hidden=apKind!=="blank";
});
$("#apSize").onchange=e=>{$("#apCustom").hidden=e.target.value!=="custom";};
$$("[data-close]").forEach(b=>b.onclick=()=>b.closest(".modal-bd").hidden=true);
$$(".modal-bd").forEach(m=>m.addEventListener("pointerdown",e=>{if(e.target===m)m.hidden=true;}));
$("#apConfirm").onclick=async()=>{
  const posVal=$("#apPos").value;
  let at=state.pages.length;
  if(apAnchor!=null&&posVal==="after")at=idxOf(apAnchor)+1;
  if(apAnchor!=null&&posVal==="before")at=idxOf(apAnchor);
  $("#addPageModal").hidden=true;
  if(apKind==="image"){pendingAddAt=at;$("#apImageInput").value="";$("#apImageInput").click();return;}
  if(apKind==="pdf"){pendingAddAt=at;$("#apPdfInput").value="";$("#apPdfInput").click();return;}
  let wPt,hPt; const sz=$("#apSize").value;
  if(sz==="custom"){
    const mmW=clamp(+$("#apW").value||210,20,2000),mmH=clamp(+$("#apH").value||297,20,2000);
    wPt=mmW*2.8346; hPt=mmH*2.8346;
  } else {wPt=PAGE_PT[sz][0];hPt=PAGE_PT[sz][1];}
  pushHistory();
  const c=document.createElement("canvas");
  c.width=Math.round(wPt*2); c.height=Math.round(hPt*2);
  const ctx=c.getContext("2d"); ctx.fillStyle="#fff"; ctx.fillRect(0,0,c.width,c.height);
  const imgId=state.nextId++; state.images.set(imgId,{src:c,w:c.width,h:c.height});
  const pg=newPage({kind:"image",imgId:imgId,name:"Blank page",sizeBytes:0,baseW:c.width,baseH:c.height,pts:[wPt,hPt]});
  state.pages.splice(at,0,pg);
  renderGrid(); updateStats(); buildStrip(); switchView();
  toast("Blank "+sz.toUpperCase()+" page added","ok",1800);
};
$("#apImageInput").addEventListener("change",async e=>{
  const fl=[...e.target.files]; e.target.value=""; if(!fl.length)return;
  showProgress("Adding image…");
  try{
    pushHistory();
    let at=pendingAddAt < 0?state.pages.length:pendingAddAt;
    for(const f of fl){await importImageFile(f,at);at++;}
    hideProgress(); renderGrid(); updateStats(); buildStrip(); switchView();
    toast(fl.length+" image page(s) added","ok");
  }catch(err){hideProgress();loadError(err,err.message||"image");}
});
$("#apPdfInput").addEventListener("change",async e=>{
  const fl=[...e.target.files]; e.target.value=""; if(!fl.length)return;
  showProgress("Adding PDF…");
  try{
    pushHistory();
    let at=pendingAddAt < 0?state.pages.length:pendingAddAt,total=0;
    for(const f of fl){const n=await importPdfFile(f,at);at+=n;total+=n;}
    hideProgress(); renderGrid(); updateStats(); buildStrip(); switchView();
    if(total)toast(total+" PDF page(s) added","ok");
  }catch(err){hideProgress();loadError(err,err.message||"pdf");}
});

/* ============ editor core ============ */
const stageWrap=$("#stageWrap"),stage=$("#stage"),pageBox=$("#pageBox"),
      editCanvas=$("#editCanvas"),textsLayer=$("#textsLayer"),
      cropLayer=$("#cropLayer"),cropBoxEl=$("#cropBox");
let editorBase=null,view={scale:1,x:0,y:0},selTextId=null,curTool="adjust";
function openEditor(id){
  state.editingId=id; state.lastSelected=id;
  $("#editorView").hidden=false; document.body.style.overflow="hidden";
  selTextId=null; adjDirty=false;
  buildStrip(); setTool("adjust"); loadEditorPage();
}
function closeEditor(){
  state.editingId=null; editorBase=null;
  $("#editorView").hidden=true; document.body.style.overflow="";
  state.pages.forEach(p=>refreshCardFx(p));
}
$("#edBack").onclick=closeEditor;
function updateEditorHeader(){
  const p=curPage(); if(!p)return;
  const i=idxOf(p.id);
  $("#edPageName").textContent="Page "+pad2(i+1)+" — "+p.name;
  $("#edPageMeta").textContent=dimsLabel(p)+" · "+(p.kind==="pdf"?"PDF":"IMAGE")+(p.edits.crop?" · CROPPED":"");
  $("#edPageInfo").textContent="PAGE "+pad2(i+1)+" / "+pad2(state.pages.length);
}
async function loadEditorPage(){
  const p=curPage(); if(!p)return;
  updateEditorHeader(); adjDirty=false; selTextId=null; textPropDirty=false;
  await repaintEditor();
  syncSlidersFromPage(); renderTextList(); refreshTextProps(); highlightStrip();
  if(curTool==="crop")initCropBox();
  if(curTool==="filters")buildFilterGrid();
}
async function repaintEditor(){
  const p=curPage(); if(!p)return;
  $("#stageLoad").hidden=false; await frame();
  try{
    const maxE=clamp(Math.max(stageWrap.clientWidth,stageWrap.clientHeight)*1.15,800,1700);
    editorBase=await renderBase(p,{maxEdge:maxE});
    editCanvas.width=editorBase.width; editCanvas.height=editorBase.height;
    redrawDisplay(); layoutPageBox(); fitView(); syncTexts();
    if(curTool==="crop")initCropBox();
  }catch(e){toast("Could not render this page: "+e.message,"error");}
  $("#stageLoad").hidden=true;
}
function redrawDisplay(){
  const p=curPage(); if(!p||!editorBase)return;
  const ctx=editCanvas.getContext("2d");
  ctx.drawImage(editorBase,0,0);
  drawErases(ctx,p,editCanvas.width,editCanvas.height);
  const sh=sharpOf(p); if(sh > 0)applySharpen(editCanvas,sh);
  liveFx(false);
}
function liveFx(markThumb){
  const p=curPage(); if(!p)return;
  editCanvas.style.filter=cssFilterOf(p);
  editCanvas.style.opacity=opacityOf(p);
  if(markThumb!==false)refreshCardFx(p);
}
function layoutPageBox(){
  const W=editCanvas.width,H=editCanvas.height; if(!W||!H)return;
  const availW=stageWrap.clientWidth-28,availH=stageWrap.clientHeight-28;
  let bw=Math.min(availW,availH*(W/H),1100),bh=bw*(H/W);
  if(bh>availH){bh=availH;bw=bh*(W/H);}
  pageBox.style.width=Math.max(60,bw)+"px"; pageBox.style.height=Math.max(60,bh)+"px";
}
function fitView(){
  view.scale=1;
  view.x=(stageWrap.clientWidth-pageBox.offsetWidth)/2;
  view.y=(stageWrap.clientHeight-pageBox.offsetHeight)/2;
  applyView();
}
function applyView(){
  if(view.scale <= 1.05){
    view.x=(stageWrap.clientWidth-pageBox.offsetWidth)/2;
    view.y=(stageWrap.clientHeight-pageBox.offsetHeight)/2;
  }
  stage.style.transform="translate("+view.x+"px,"+view.y+"px) scale("+view.scale+")";
  $("#zoomLbl").textContent=Math.round(view.scale*100)+"%";
}
function zoomAt(cx,cy,f){
  const r=stageWrap.getBoundingClientRect(),px=cx-r.left,py=cy-r.top;
  const ns=clamp(view.scale*f,0.3,6),k=ns/view.scale;
  view.x=px-(px-view.x)*k; view.y=py-(py-view.y)*k; view.scale=ns; applyView();
}
function toggleAppFullscreen(){
  if(!document.fullscreenElement){
    if(document.documentElement.requestFullscreen){
      document.documentElement.requestFullscreen().catch(()=>{});
    }else if(document.documentElement.webkitRequestFullscreen){
      document.documentElement.webkitRequestFullscreen();
    }
  }else{
    if(document.exitFullscreen){
      document.exitFullscreen().catch(()=>{});
    }else if(document.webkitExitFullscreen){
      document.webkitExitFullscreen();
    }
  }
}
document.addEventListener("fullscreenchange",()=>{
  const isFS=!!document.fullscreenElement;
  if($("#btnFitReset")) $("#btnFitReset").classList.toggle("on",isFS);
  if($("#zoomFit")) $("#zoomFit").classList.toggle("on",isFS);
  setTimeout(()=>{
    if(state.editingId!=null){
      layoutPageBox();
      fitView();
      if(typeof curTool!=="undefined"&&curTool==="crop"&&typeof initCropBox==="function")initCropBox();
    }
  },150);
});

$("#zoomIn").onclick=()=>zoomAt(stageWrap.getBoundingClientRect().left+stageWrap.clientWidth/2,stageWrap.getBoundingClientRect().top+stageWrap.clientHeight/2,1.25);
$("#zoomOut").onclick=()=>zoomAt(stageWrap.getBoundingClientRect().left+stageWrap.clientWidth/2,stageWrap.getBoundingClientRect().top+stageWrap.clientHeight/2,0.8);
$("#zoomFit").onclick=()=>{
  toggleAppFullscreen();
  fitView();
};
if($("#btnFitReset")){
  $("#btnFitReset").onclick=async()=>{
    toggleAppFullscreen();
    if(state.editingId!=null){
      fitView();
    }
  };
}
stageWrap.addEventListener("wheel",e=>{e.preventDefault();zoomAt(e.clientX,e.clientY,Math.exp(-e.deltaY*0.0016));},{passive:false});
/* pan + pinch */
const activePts=new Map(); let pinch=null,panLast=null;
stageWrap.addEventListener("pointerdown",e=>{
  if(e.target.closest(".txt")||e.target.closest(".ch")||e.target===cropBoxEl||e.target.closest("#cropLayer"))return;
  stageWrap.setPointerCapture(e.pointerId);
  activePts.set(e.pointerId,{x:e.clientX,y:e.clientY});
  if(activePts.size===2){
    const arr=[...activePts.values()],a=arr[0],b=arr[1];
    pinch={d0:Math.hypot(a.x-b.x,a.y-b.y),mid0:{x:(a.x+b.x)/2,y:(a.y+b.y)/2},s0:view.scale,x0:view.x,y0:view.y};
    panLast=null;
  } else if(activePts.size===1){panLast={x:e.clientX,y:e.clientY}; deselectText();}
});
stageWrap.addEventListener("pointermove",e=>{
  if(!activePts.has(e.pointerId))return;
  activePts.set(e.pointerId,{x:e.clientX,y:e.clientY});
  if(activePts.size===2&&pinch){
    const arr=[...activePts.values()],a=arr[0],b=arr[1];
    const d=Math.hypot(a.x-b.x,a.y-b.y),mid={x:(a.x+b.x)/2,y:(a.y+b.y)/2};
    const r=stageWrap.getBoundingClientRect();
    const ns=clamp(pinch.s0*(d/Math.max(20,pinch.d0)),0.3,6),k=ns/pinch.s0;
    view.scale=ns;
    view.x=(mid.x-r.left)-((pinch.mid0.x-r.left)-pinch.x0)*k;
    view.y=(mid.y-r.top)-((pinch.mid0.y-r.top)-pinch.y0)*k;
    applyView();
  } else if(activePts.size===1&&panLast){
    if(view.scale > 1.05){
      view.x+=e.clientX-panLast.x; view.y+=e.clientY-panLast.y;
      applyView();
    }
    panLast={x:e.clientX,y:e.clientY};
  }
});
function endPt(e){activePts.delete(e.pointerId); if(activePts.size < 2)pinch=null; if(!activePts.size)panLast=null;}
stageWrap.addEventListener("pointerup",endPt);
stageWrap.addEventListener("pointercancel",endPt);

/* ============ tools ============ */
function setTool(tool){
  curTool=tool;
  $$("#edTools .tool-btn").forEach(b=>b.classList.toggle("on",b.dataset.tool===tool));
  $$("#edPanel section").forEach(s=>s.classList.toggle("on",s.dataset.panel===tool));
  cropLayer.hidden=tool!=="crop";
  const el=$("#eraseLayer"); if(el)el.hidden=tool!=="erase";
  if(tool==="crop")initCropBox();
  if(tool==="filters")buildFilterGrid();
  if(tool==="text")renderTextList();
}
$$("#edTools .tool-btn").forEach(b=>b.onclick=()=>setTool(b.dataset.tool));

/* ---- adjust ---- */
const ADJ_CONFIG = {
  brightness: { name: 'Brightness', icon: 'i-sun', min: -100, max: 100, def: 0, unit: '' },
  contrast:   { name: 'Contrast',   icon: 'i-contrast', min: -100, max: 100, def: 0, unit: '' },
  darkness:   { name: 'Darkness',   icon: 'i-moon', min: 0, max: 100, def: 0, unit: '' },
  sharpness:  { name: 'Sharpness',  icon: 'i-sharpness', min: 0, max: 100, def: 0, unit: '' },
  hue:        { name: 'Hue',        icon: 'i-hue', min: -180, max: 180, def: 0, unit: '°' },
  saturation: { name: 'Saturation', icon: 'i-saturation', min: -100, max: 100, def: 0, unit: '' },
  exposure:   { name: 'Exposure',   icon: 'i-exposure', min: -100, max: 100, def: 0, unit: '' },
  opacity:    { name: 'Opacity',    icon: 'i-opacity', min: 0, max: 100, def: 100, unit: '%' }
};
let activeAdj = 'brightness';

function valToAngle(key, val) {
  const cfg = ADJ_CONFIG[key] || ADJ_CONFIG.brightness;
  const norm = clamp((val - cfg.min) / (cfg.max - cfg.min), 0, 1);
  return (norm * 270) - 135;
}

function angleToVal(key, angle) {
  const cfg = ADJ_CONFIG[key] || ADJ_CONFIG.brightness;
  const norm = clamp((angle + 135) / 270, 0, 1);
  return Math.round(cfg.min + norm * (cfg.max - cfg.min));
}

function generateArcTicks() {
  const ticks = [];
  const R1 = 75, R2 = 82, cx = 90, cy = 90;
  for (let i = 0; i <= 20; i++) {
    const aDeg = -135 + (i * 270 / 20);
    const rad = (aDeg - 90) * Math.PI / 180;
    const x1 = (cx + R1 * Math.cos(rad)).toFixed(1);
    const y1 = (cy + R1 * Math.sin(rad)).toFixed(1);
    const x2 = (cx + R2 * Math.cos(rad)).toFixed(1);
    const y2 = (cy + R2 * Math.sin(rad)).toFixed(1);
    const isMajor = i % 5 === 0;
    ticks.push(`<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" class="vol-tick ${isMajor ? 'major' : ''}" />`);
  }
  return ticks.join('');
}

function buildAdjustUI() {
  const keys = Object.keys(ADJ_CONFIG);
  const container = $("#adjRows");
  if (!container) return;
  container.innerHTML =
    `<div class="adj-options-grid">` +
      keys.map(k => {
        const c = ADJ_CONFIG[k];
        return `<button class="adj-opt-btn" id="adj-opt-${k}" data-mode="${k}" title="${c.name}">
          <span class="adj-opt-dot"></span>
          <svg><use href="#${c.icon}"/></svg>
          <span class="adj-opt-label">${c.name}</span>
        </button>`;
      }).join('') +
    `</div>` +
    `<div class="vol-controller">
      <div class="vol-slider-fallback">
        <input type="range" id="volRangeFallback" />
      </div>
    </div>`;

  $$('#adjRows .adj-opt-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      activeAdj = btn.dataset.mode;
      syncSlidersFromPage();
    });
  });

  const rangeFB = $('#volRangeFallback');
  rangeFB.addEventListener('input', () => {
    const p = curPage(); if (!p) return;
    const newVal = +rangeFB.value;
    if (!adjDirty) { pushHistory(); adjDirty = true; }
    p.edits.adj[activeAdj] = newVal;
    syncSlidersFromPage();
    liveFx();
    if (activeAdj === 'sharpness') {
      clearTimeout(sharpTimer);
      sharpTimer = setTimeout(() => { if (editorBase) redrawDisplay(); }, 260);
    }
  });
}

let sharpTimer = null;

function syncSlidersFromPage() {
  const p = curPage(); if (!p) return;
  const keys = Object.keys(ADJ_CONFIG);
  keys.forEach(k => {
    const cfg = ADJ_CONFIG[k];
    const val = p.edits.adj[k] ?? cfg.def;
    const btn = $('#adj-opt-' + k);
    if (btn) {
      btn.classList.toggle('on', k === activeAdj);
      btn.classList.toggle('modified', val !== cfg.def);
    }
  });

  const curCfg = ADJ_CONFIG[activeAdj];
  const curVal = p.edits.adj[activeAdj] ?? curCfg.def;

  const rangeFB = $('#volRangeFallback');
  if (rangeFB) {
    rangeFB.min = curCfg.min;
    rangeFB.max = curCfg.max;
    rangeFB.value = curVal;
  }
}

buildAdjustUI();

$("#adjReset").onclick=()=>{
  const p=curPage(); if(!p)return;
  pushHistory(); p.edits.adj=DEFAULT_ADJ(); adjDirty=false;
  syncSlidersFromPage(); redrawDisplay(); liveFx(); refreshThumbFor(p);
  toast("Adjustments reset","info",1500);
};
$("#adjApply").onclick=()=>{adjDirty=false;refreshThumbFor(curPage());toast("Adjustments applied to page","ok",1800);};
let compareOn=false;
function compareStart(){
  if(compareOn||!editorBase)return; compareOn=true;
  editCanvas.getContext("2d").drawImage(editorBase,0,0);
  editCanvas.style.filter="none"; editCanvas.style.opacity="1";
  textsLayer.style.display="none";
}
function compareEnd(){
  if(!compareOn)return; compareOn=false;
  textsLayer.style.display=""; redrawDisplay();
}
const cmpBtn=$("#adjCompare");
cmpBtn.addEventListener("pointerdown",compareStart);
cmpBtn.addEventListener("pointerup",compareEnd);
cmpBtn.addEventListener("pointerleave",compareEnd);

/* ---- crop ---- */
let cropBoxPx=null,cropRatio=null,cropDrag=null;
function initCropBox(){
  const p=curPage(); if(!p)return;
  const W=pageBox.clientWidth,H=pageBox.clientHeight; if(!W||!H)return;
  const isFull = !p.edits.crop;
  cropBoxPx=p.edits.crop
    ?{x:p.edits.crop.x*W,y:p.edits.crop.y*H,w:p.edits.crop.w*W,h:p.edits.crop.h*H}
    :{x:0,y:0,w:W,h:H};
  cropRatio=null;
  $$("#ratioChips .chip").forEach(x=>x.classList.toggle("on",x.dataset.ratio===(isFull?"full":"free")));
  positionCropDom();
}
function positionCropDom(){
  if(!cropBoxPx)return;
  cropBoxEl.style.left=cropBoxPx.x+"px"; cropBoxEl.style.top=cropBoxPx.y+"px";
  cropBoxEl.style.width=cropBoxPx.w+"px"; cropBoxEl.style.height=cropBoxPx.h+"px";
}
function enforceRatio(mode,b,r,W,H){
  const cx=b.x+b.w/2,cy=b.y+b.h/2,MIN=26;
  if(mode==="e"||mode==="w"){
    let nh=b.w/r; if(b.y+nh>H)nh=H-b.y; if(nh < MIN)nh=MIN;
    b.y=clamp(cy-nh/2,0,Math.max(0,H-nh)); b.h=nh; return b;
  }
  if(mode==="n"||mode==="s"){
    let nw=b.h*r; if(b.x+nw>W)nw=W-b.x; if(nw < MIN)nw=MIN;
    b.x=clamp(cx-nw/2,0,Math.max(0,W-nw)); b.w=nw; return b;
  }
  const ax=mode.indexOf("w")>=0?b.x+b.w:b.x;
  const ay=mode.indexOf("n")>=0?b.y+b.h:b.y;
  let nw=b.w,nh=nw/r;
  if(nh>H){nh=H;nw=nh*r;}
  if(nw>W){nw=W;nh=nw/r;}
  nw=Math.max(nw,MIN); nh=Math.max(nh,MIN);
  b.w=nw; b.h=nh;
  b.x=mode.indexOf("w")>=0?ax-nw:ax;
  b.y=mode.indexOf("n")>=0?ay-nh:ay;
  b.x=clamp(b.x,0,W-b.w); b.y=clamp(b.y,0,H-b.h);
  return b;
}
cropLayer.addEventListener("pointerdown",e=>{
  e.stopPropagation(); e.preventDefault();
  cropLayer.setPointerCapture(e.pointerId);
  const hEl=e.target.closest(".ch");
  cropDrag={handle:hEl?hEl.dataset.h:null,start:{x:e.clientX,y:e.clientY},orig:Object.assign({},cropBoxPx)};
});
cropLayer.addEventListener("pointermove",e=>{
  if(!cropDrag||!cropBoxPx)return;
  const k=1/view.scale;
  const dx=(e.clientX-cropDrag.start.x)*k,dy=(e.clientY-cropDrag.start.y)*k;
  const W=pageBox.clientWidth,H=pageBox.clientHeight,MIN=26,o=cropDrag.orig,mode=cropDrag.handle;
  let b;
  if(!mode){
    b={x:clamp(o.x+dx,0,W-o.w),y:clamp(o.y+dy,0,H-o.h),w:o.w,h:o.h};
  } else {
    let l=o.x,t=o.y,r=o.x+o.w,bt=o.y+o.h;
    if(mode.indexOf("e")>=0)r=clamp(o.x+o.w+dx,l+MIN,W);
    if(mode.indexOf("s")>=0)bt=clamp(o.y+o.h+dy,t+MIN,H);
    if(mode.indexOf("w")>=0)l=clamp(o.x+dx,0,r-MIN);
    if(mode.indexOf("n")>=0)t=clamp(o.y+dy,0,bt-MIN);
    b={x:l,y:t,w:r-l,h:bt-t};
    if(cropRatio)b=enforceRatio(mode,b,cropRatio,W,H);
  }
  cropBoxPx=b; positionCropDom();
});
cropLayer.addEventListener("pointerup",()=>{cropDrag=null;});
cropLayer.addEventListener("pointercancel",()=>{cropDrag=null;});
$$("#ratioChips .chip").forEach(ch=>ch.onclick=()=>{
  $$("#ratioChips .chip").forEach(x=>x.classList.remove("on")); ch.classList.add("on");
  const kind=ch.dataset.ratio;
  $("#customRatio").hidden=kind!=="custom";
  const p=curPage(); if(!p)return;
  const W=pageBox.clientWidth,H=pageBox.clientHeight; if(!W||!H)return;
  if(kind==="full"){
    cropRatio=null;
    cropBoxPx={x:0,y:0,w:W,h:H};
    positionCropDom();
    return;
  }
  if(kind==="free"){cropRatio=null;return;}
  if(kind==="custom")return;
  let r;
  if(kind==="orig"){
    r=p.baseW/p.baseH; if(p.rotation%180)r=1/r;
    if(p.edits.crop)r*=p.edits.crop.w/p.edits.crop.h;
  } else if(kind==="a4"){
    r=(cropBoxPx?cropBoxPx.w:W)>=(cropBoxPx?cropBoxPx.h:H)?1.4142:1/1.4142;
  } else r=1;
  cropRatio=r;
  const curB = cropBoxPx || {x:0,y:0,w:W,h:H};
  cropBoxPx=enforceRatio("se",Object.assign({},curB),r,W,H);
  positionCropDom();
});
$("#crSet").onclick=()=>{
  const w=clamp(+$("#crW").value||1,0.1,99),h=clamp(+$("#crH").value||1,0.1,99);
  cropRatio=w/h;
  if(cropBoxPx){cropBoxPx=enforceRatio("se",cropBoxPx,cropRatio,pageBox.clientWidth,pageBox.clientHeight);positionCropDom();}
};
$("#cropApply").onclick=async()=>{
  const p=curPage(); if(!p||!cropBoxPx)return;
  const W=pageBox.clientWidth,H=pageBox.clientHeight;
  const n={x:clamp(cropBoxPx.x/W,0,1),y:clamp(cropBoxPx.y/H,0,1),w:clamp(cropBoxPx.w/W,0.01,1),h:clamp(cropBoxPx.h/H,0.01,1)};
  let abs=null;
  if(!(n.w > 0.985 && n.h > 0.985 && n.x < 0.01 && n.y < 0.01)){
    const c=p.edits.crop;
    abs=c?{x:c.x+n.x*c.w,y:c.y+n.y*c.h,w:n.w*c.w,h:n.h*c.h}:n;
  }
  pushHistory();
  p.edits.crop=abs;
  await repaintEditor();
  refreshThumbFor(p); updateEditorHeader(); setTool("adjust");
  toast(abs?"Crop applied":"Crop removed (frame covered whole page)","ok",2000);
};
$("#cropReset").onclick=async()=>{
  const p=curPage(); if(!p)return;
  pushHistory(); p.edits.crop=null;
  await repaintEditor(); refreshThumbFor(p); updateEditorHeader();
  initCropBox();
  toast("Crop reset to full page","info",1500);
};

/* ---- erase ---- */
let isPickingColor=false,isDrawingErase=false,currentEraseStroke=null;
const eraseLayer=$("#eraseLayer");
$("#eraseSize").oninput=e=>{$("#vEraseSize").textContent=e.target.value+"px";};
$("#erasePickColor").onclick=()=>{
  isPickingColor=true;
  eraseLayer.style.cursor="crosshair";
  $("#erasePickColor").classList.add("on");
  toast("Tap anywhere on the page to pick color","info",2500);
};
eraseLayer.addEventListener("pointerdown",e=>{
  const p=curPage(); if(!p)return;
  const rect=pageBox.getBoundingClientRect();
  const rx=clamp((e.clientX-rect.left)/rect.width,0,1);
  const ry=clamp((e.clientY-rect.top)/rect.height,0,1);

  if(isPickingColor){
    e.stopPropagation(); e.preventDefault();
    const cx=Math.round(rx*editCanvas.width);
    const cy=Math.round(ry*editCanvas.height);
    try{
      const pixel=editCanvas.getContext("2d").getImageData(cx,cy,1,1).data;
      const hex="#"+[pixel[0],pixel[1],pixel[2]].map(x=>x.toString(16).padStart(2,"0")).join("");
      $("#eraseColor").value=hex;
      toast("Color picked: "+hex,"ok",1800);
    }catch(err){toast("Picked color from page","ok",1500);}
    isPickingColor=false;
    eraseLayer.style.cursor="crosshair";
    $("#erasePickColor").classList.remove("on");
    return;
  }

  e.stopPropagation(); e.preventDefault();
  eraseLayer.setPointerCapture(e.pointerId);
  isDrawingErase=true;
  if(!p.edits.erases)p.edits.erases=[];
  const color=$("#eraseColor").value;
  const sz=+$("#eraseSize").value;
  const minDim=Math.min(pageBox.clientWidth,pageBox.clientHeight);
  currentEraseStroke={color:color,size:sz/minDim,pts:[{x:rx,y:ry}]};
  p.edits.erases.push(currentEraseStroke);
  redrawDisplay();
});
eraseLayer.addEventListener("pointermove",e=>{
  if(!isDrawingErase||!currentEraseStroke)return;
  const rect=pageBox.getBoundingClientRect();
  const rx=clamp((e.clientX-rect.left)/rect.width,0,1);
  const ry=clamp((e.clientY-rect.top)/rect.height,0,1);
  currentEraseStroke.pts.push({x:rx,y:ry});
  redrawDisplay();
});
function endErase(e){
  if(isDrawingErase){
    isDrawingErase=false;
    currentEraseStroke=null;
    try{eraseLayer.releasePointerCapture(e.pointerId);}catch(err){}
    pushHistory();
    const p=curPage(); if(p)refreshThumbFor(p);
  }
}
eraseLayer.addEventListener("pointerup",endErase);
eraseLayer.addEventListener("pointercancel",endErase);

$("#eraseUndo").onclick=()=>{
  const p=curPage(); if(!p||!p.edits.erases||!p.edits.erases.length)return;
  pushHistory(); p.edits.erases.pop();
  redrawDisplay(); refreshThumbFor(p);
  toast("Last erase stroke undone","info",1400);
};
$("#eraseClear").onclick=()=>{
  const p=curPage(); if(!p||!p.edits.erases||!p.edits.erases.length)return;
  pushHistory(); p.edits.erases=[];
  redrawDisplay(); refreshThumbFor(p);
  toast("All erases cleared","info",1400);
};
$("#eraseApply").onclick=()=>{
  refreshThumbFor(curPage());
  setTool("adjust");
  toast("Erase applied to page","ok",1800);
};

/* ---- filters ---- */
async function buildFilterGrid(){
  const p=curPage(); if(!p)return;
  const gridF=$("#filterGrid"); gridF.innerHTML="";
  let url=null;
  try{url=await ensureThumb(p,220);}catch(e){}
  Object.entries(FILTERS).forEach(entry=>{
    const key=entry[0],f=entry[1];
    const b=document.createElement("button");
    b.className="fcard"+(p.edits.filter===key?" on":""); b.dataset.f=key; b.type="button";
    b.innerHTML=(url?'<img src="'+url+'" style="filter:'+f.css+'" alt="">':'<div class="ph"></div>')+'<span>'+f.name+'</span>';
    b.onclick=()=>{
      pushHistory();
      p.edits.filter=key; liveFx();
      $$(".fcard").forEach(x=>x.classList.toggle("on",x.dataset.f===key));
      refreshThumbFor(p);
    };
    gridF.appendChild(b);
  });
}

/* ---- text ---- */
const FONTS=["Arial","Helvetica","Times New Roman","Georgia","Verdana","Courier New","Trebuchet MS","Roboto","Open Sans","Poppins","Montserrat"];
$("#tFont").innerHTML=FONTS.map(f=>'<option value="'+f+'">'+f+'</option>').join("");
const selText=()=>{const p=curPage();return p?p.edits.texts.find(t=>t.id===selTextId)||null:null;};
$("#addTextBtn").onclick=()=>{
  const p=curPage(); if(!p)return;
  pushHistory();
  const t={id:state.nextId++,text:"Double-tap to edit",x:0.24,y:0.42,w:0.52,size:0.055,
    font:"Arial",color:"#111111",shadowColor:"#000000",bg:"",align:"center",bold:false,italic:false,underline:false,
    opacity:1,rot:0,shadow:false};
  p.edits.texts.push(t); selTextId=t.id;
  syncTexts(); renderTextList(); refreshTextProps();
  toast("Text added — drag to move, double-tap to type","ok",2600);
};
function syncTexts(){
  const p=curPage(); textsLayer.innerHTML="";
  if(!p)return;
  const H=pageBox.clientHeight;
  p.edits.texts.forEach(t=>{
    const el=document.createElement("div");
    el.className="txt"+(t.id===selTextId?" sel":""); el.dataset.tid=t.id;
    el.style.left=(t.x*100)+"%"; el.style.top=(t.y*100)+"%"; el.style.width=(t.w*100)+"%";
    el.style.fontSize=Math.max(6,t.size*H)+"px";
    el.style.fontFamily='"'+t.font+'", sans-serif';
    el.style.fontWeight=t.bold?"700":"400";
    el.style.fontStyle=t.italic?"italic":"normal";
    el.style.textDecoration=t.underline?"underline":"none";
    el.style.color=t.color; el.style.background=t.bg||"transparent";
    el.style.textAlign=t.align; el.style.opacity=clamp(t.opacity,0,1);
    el.style.transform="rotate("+(t.rot||0)+"deg)";
    el.style.textShadow=t.shadow?("0 .08em .25em "+(t.shadowColor||"#000000")):"none";
    el.textContent=t.text;
    if(t.id===selTextId){
      ["tl","tr","bl","br"].forEach(pos=>{
        const h=document.createElement("span"); h.className="txt-rs "+pos; el.appendChild(h);
      });
    }
    textsLayer.appendChild(el);
  });
}
function selectText(id){selTextId=id;syncTexts();renderTextList();refreshTextProps();}
function deselectText(){if(selTextId!=null){selTextId=null;syncTexts();renderTextList();refreshTextProps();}}
function renderTextList(){
  const p=curPage(),list=$("#textList"); list.innerHTML="";
  if(!p)return;
  if(!p.edits.texts.length){list.innerHTML='<p class="p-hint" style="margin:0">No text on this page yet.</p>';return;}
  p.edits.texts.forEach((t,i)=>{
    const d=document.createElement("div");
    d.className="text-item"+(t.id===selTextId?" on":"");
    d.innerHTML='<svg style="width:14px;height:14px;flex:none"><use href="#i-type"/></svg><span></span>'+
      '<button class="ib sm" title="Delete text"><svg><use href="#i-trash"/></svg></button>';
    d.querySelector("span").textContent=(t.text||"").slice(0,40)||"(empty)";
    d.onclick=()=>selectText(t.id);
    d.querySelector("button").onclick=e=>{
      e.stopPropagation(); pushHistory();
      p.edits.texts=p.edits.texts.filter(x=>x.id!==t.id);
      if(selTextId===t.id)selTextId=null;
      syncTexts(); renderTextList(); refreshTextProps();
    };
    list.appendChild(d);
  });
}
function refreshTextProps(){
  const t=selText(); $("#textProps").hidden=!t;
  if(!t)return; textPropDirty=false;
  const input=$("#tInput"); if(input) input.value=t.text||"";
  $("#tFont").value=t.font; $("#tSize").value=t.size;
  $("#vTSize").textContent=Math.round(t.size*pageBox.clientHeight)+" px";
  $("#tBold").classList.toggle("on",t.bold); $("#tItalic").classList.toggle("on",t.italic);
  $("#tUnder").classList.toggle("on",t.underline); $("#tShadow").classList.toggle("on",t.shadow);
  $("#tColor").value=t.color||"#111111";
  if($("#tShadowColor")) $("#tShadowColor").value=t.shadowColor||"#000000";
  $("#tBg").value=t.bg||"#ffffff";
  if($("#tBgTrans")) $("#tBgTrans").checked=!t.bg;
  $$("[data-bg]").forEach(chip=>chip.classList.toggle("on",chip.dataset.bg===(t.bg||"")));
  $$("[data-talign]").forEach(b=>b.classList.toggle("on",b.dataset.talign===t.align));
  $("#tOpacity").value=t.opacity; $("#vTOp").textContent=Math.round(t.opacity*100)+"%";
  $("#tRot").value=t.rot||0; $("#vTRot").textContent=(t.rot||0)+"°";
}
function textChanged(fn){
  const t=selText(); if(!t)return;
  if(!textPropDirty){pushHistory();textPropDirty=true;}
  fn(t); syncTexts();
}
$("#tInput").oninput=e=>textChanged(t=>{t.text=e.target.value; renderTextList();});
$("#tFont").onchange=e=>textChanged(t=>{t.font=e.target.value;});
$("#tSize").oninput=e=>textChanged(t=>{t.size=+e.target.value;$("#vTSize").textContent=Math.round(t.size*pageBox.clientHeight)+" px";});
$("#tBold").onclick=()=>textChanged(t=>{t.bold=!t.bold;$("#tBold").classList.toggle("on",t.bold);});
$("#tItalic").onclick=()=>textChanged(t=>{t.italic=!t.italic;$("#tItalic").classList.toggle("on",t.italic);});
$("#tUnder").onclick=()=>textChanged(t=>{t.underline=!t.underline;$("#tUnder").classList.toggle("on",t.underline);});
$("#tShadow").onclick=()=>textChanged(t=>{t.shadow=!t.shadow;$("#tShadow").classList.toggle("on",t.shadow);});
$("#tColor").oninput=e=>textChanged(t=>{t.color=e.target.value;});
if($("#tShadowColor")){
  $("#tShadowColor").oninput=e=>textChanged(t=>{
    t.shadowColor=e.target.value;
    t.shadow=true;
    $("#tShadow").classList.add("on");
    syncTexts();
  });
}
$("#tBg").oninput=e=>textChanged(t=>{
  t.bg=e.target.value;
  if($("#tBgTrans")) $("#tBgTrans").checked=false;
  refreshTextProps();
});
if($("#tBgTrans")){
  $("#tBgTrans").onchange=e=>textChanged(t=>{
    if(e.target.checked) t.bg="";
    else t.bg=$("#tBg").value||"#ffffff";
    refreshTextProps();
  });
}
$$("[data-bg]").forEach(chip=>chip.onclick=()=>textChanged(t=>{
  t.bg=chip.dataset.bg;
  if($("#tBgTrans")) $("#tBgTrans").checked=false;
  refreshTextProps();
}));
$$("[data-talign]").forEach(b=>b.onclick=()=>textChanged(t=>{
  t.align=b.dataset.talign;
  $$("[data-talign]").forEach(x=>x.classList.toggle("on",x===b));
}));
$("#tOpacity").oninput=e=>textChanged(t=>{t.opacity=+e.target.value;$("#vTOp").textContent=Math.round(t.opacity*100)+"%";});
$("#tRot").oninput=e=>textChanged(t=>{t.rot=+e.target.value;$("#vTRot").textContent=t.rot+"°";});
$("#tDelete").onclick=()=>{
  const p=curPage(),t=selText(); if(!p||!t)return;
  pushHistory();
  p.edits.texts=p.edits.texts.filter(x=>x.id!==t.id);
  selTextId=null; syncTexts(); renderTextList(); refreshTextProps();
};
/* text drag / resize / edit */
function startEditingText(el, t){
  if(!el||!t)return;
  el.contentEditable="true";
  el.classList.add("editing");
  el.focus();
  try{
    const sel=window.getSelection(), r=document.createRange();
    r.selectNodeContents(el); sel.removeAllRanges(); sel.addRange(r);
  }catch(err){}
  pushHistory();
  let done=false;
  const finish=()=>{
    if(done)return; done=true;
    el.contentEditable="false"; el.classList.remove("editing");
    t.text=(el.innerText||el.textContent||"").replace(/\u00a0/g," ").trim()||"Text";
    syncTexts(); renderTextList(); refreshTextProps();
  };
  el.onblur=finish;
  el.onkeydown=e=>{ if(e.key==="Escape") el.blur(); };
}

let txtDrag=null,lastTap={id:null,t:0};
textsLayer.addEventListener("pointerdown",e=>{
  const el=e.target.closest(".txt"); if(!el)return;
  if(el.isContentEditable || el.classList.contains("editing")) return;
  e.stopPropagation(); e.preventDefault();
  const tid=+el.dataset.tid;
  selectText(tid);
  const p=curPage(),t=p ? p.edits.texts.find(x=>x.id===tid) : null; if(!t)return;
  const now=Date.now();
  if(lastTap.id===tid && now-lastTap.t < 350){
    startEditingText(el, t);
    return;
  }
  lastTap={id:tid,t:now};
  if(e.target.classList.contains("txt-rs")){
    const r=el.getBoundingClientRect();
    const cx=r.left + r.width / 2;
    const cy=r.top + r.height / 2;
    const d0=Math.max(15, Math.hypot(e.clientX - cx, e.clientY - cy));
    txtDrag={mode:"resize",t:t,el:el,cx:cx,cy:cy,size0:t.size,d0:d0,moved:false};
  } else {
    txtDrag={mode:"move",t:t,el:el,lx:e.clientX,ly:e.clientY,moved:false};
  }
  el.setPointerCapture(e.pointerId);
});

textsLayer.addEventListener("dblclick",e=>{
  const el=e.target.closest(".txt"); if(!el)return;
  const tid=+el.dataset.tid;
  selectText(tid);
  const p=curPage(),t=p ? p.edits.texts.find(x=>x.id===tid) : null;
  if(t) startEditingText(el, t);
});

textsLayer.addEventListener("pointermove",e=>{
  if(!txtDrag)return;
  const p=curPage(); if(!p)return;
  if(txtDrag.mode==="move"){
    const dx=e.clientX-txtDrag.lx,dy=e.clientY-txtDrag.ly;
    if(Math.abs(dx)+Math.abs(dy)>2&&!txtDrag.moved){pushHistory();txtDrag.moved=true;}
    const kN=1/(pageBox.clientWidth*view.scale);
    txtDrag.t.x=clamp(txtDrag.t.x+dx*kN,-0.5,1.5);
    txtDrag.t.y=clamp(txtDrag.t.y+dy/(pageBox.clientHeight*view.scale),-0.5,1.5);
    txtDrag.lx=e.clientX; txtDrag.ly=e.clientY;
    txtDrag.el.style.left=(txtDrag.t.x*100)+"%"; txtDrag.el.style.top=(txtDrag.t.y*100)+"%";
  } else if(txtDrag.mode==="resize") {
    const d=Math.max(10, Math.hypot(e.clientX - txtDrag.cx, e.clientY - txtDrag.cy));
    if(!txtDrag.moved){pushHistory();txtDrag.moved=true;}
    const newSize=clamp(txtDrag.size0 * (d / txtDrag.d0), 0.008, 0.5);
    txtDrag.t.size=newSize;
    const H=pageBox.clientHeight;
    txtDrag.el.style.fontSize=Math.max(6, newSize * H) + "px";
    const vSize=$("#vTSize"); if(vSize) vSize.textContent=Math.round(newSize * H) + " px";
    const tSize=$("#tSize"); if(tSize) tSize.value=newSize;
  }
});
function endTxt(e){
  if(txtDrag){
    if(txtDrag.moved){
      syncTexts();
      refreshTextProps();
    }
    txtDrag=null;
  }
}
textsLayer.addEventListener("pointerup",endTxt);
textsLayer.addEventListener("pointercancel",endTxt);

/* ---- arrange ---- */
if($("#arMoveL")){
  $("#arMoveL").onclick=()=>{
    const p=curPage();if(!p)return;
    const i=idxOf(p.id); if(i<=0)return;
    pushHistory();
    const [moved]=state.pages.splice(i,1);
    state.pages.splice(i-1,0,moved);
    renderGrid();buildStrip();renumber();loadEditorPage();
    toast(`Moved page to position ${i}`, "ok", 1200);
  };
}
if($("#arMoveR")){
  $("#arMoveR").onclick=()=>{
    const p=curPage();if(!p)return;
    const i=idxOf(p.id); if(i<0 || i>=state.pages.length-1)return;
    pushHistory();
    const [moved]=state.pages.splice(i,1);
    state.pages.splice(i+1,0,moved);
    renderGrid();buildStrip();renumber();loadEditorPage();
    toast(`Moved page to position ${i+2}`, "ok", 1200);
  };
}
$("#arRotL").onclick=()=>{const p=curPage();if(!p)return;pushHistory();
  p.rotation=(((p.rotation-90)%360)+360)%360;repaintEditor();refreshThumbFor(p);updateEditorHeader();};
$("#arRotR").onclick=()=>{const p=curPage();if(!p)return;pushHistory();
  p.rotation=(((p.rotation+90)%360)+360)%360;repaintEditor();refreshThumbFor(p);updateEditorHeader();};
$("#arDup").onclick=()=>{const p=curPage();if(!p)return;const i=idxOf(p.id);
  pushHistory();
  const clone=JSON.parse(JSON.stringify(p));clone.id=state.nextId++;
  clone.edits.texts.forEach(t=>t.id=state.nextId++);
  state.pages.splice(i+1,0,clone);
  renderGrid();updateStats();buildStrip();toast("Page duplicated","ok",1600);};
$("#arReplace").onclick=()=>{pendingReplace=curPage().id;$("#replaceInput").click();};
$("#arDelete").onclick=async()=>{
  const p=curPage();if(!p)return;const i=idxOf(p.id);
  const ok=await confirmDialog({title:"Delete Page "+pad2(i+1)+"?",msg:'"'+p.name+'" will be removed. Press Undo to restore.',okLabel:"Delete"});
  if(!ok)return;
  pushHistory();
  state.pages.splice(i,1);
  renderGrid();updateStats();buildStrip();
  if(!state.pages.length){closeEditor();switchView();return;}
  state.editingId=state.pages[Math.min(i,state.pages.length-1)].id;
  loadEditorPage();
};

/* ---- strip ---- */
function buildStrip(){
  const s=$("#edStrip"); s.innerHTML="";
  state.pages.forEach((p,i)=>{
    const b=document.createElement("button");
    b.className="strip-item"+(p.id===state.editingId?" on":""); b.dataset.id=p.id; b.type="button";
    b.innerHTML='<div class="ph"></div><b>'+pad2(i+1)+'</b>';
    b.onclick=()=>{
      if(isStripDragging) return;
      if(state.editingId===p.id)return;
      state.editingId=p.id; selTextId=null; adjDirty=false;
      loadEditorPage(); highlightStrip();
    };
    attachStripDragEvents(b);
    s.appendChild(b);
    ensureThumb(p,160).then(url=>{
      if(!b.isConnected)return;
      const ph=b.querySelector(".ph"); if(!ph)return;
      const img=document.createElement("img"); img.src=url; img.alt="";
      img.style.filter=cssFilterOf(p); img.style.opacity=opacityOf(p);
      ph.replaceWith(img);
    }).catch(()=>{});
  });
}
function highlightStrip(){
  $$("#edStrip .strip-item").forEach(b=>b.classList.toggle("on",+b.dataset.id===state.editingId));
}
function refreshStripItem(p){
  const b=$("#edStrip").querySelector('.strip-item[data-id="'+p.id+'"]'); if(!b)return;
  ensureThumb(p,160).then(url=>{
    const img=b.querySelector("img");
    if(img){img.src=url;img.style.filter=cssFilterOf(p);img.style.opacity=opacityOf(p);}
  }).catch(()=>{});
}

/* resize/orientation */
let rzT=null;
addEventListener("resize",()=>{
  if($("#editorView").hidden)return;
  clearTimeout(rzT);
  rzT=setTimeout(()=>{layoutPageBox();fitView();syncTexts();if(curTool==="crop")initCropBox();},200);
});

/* ============ preview ============ */
let pvIdx=0,pvToken=0;
async function showPvPage(i){
  if(!state.pages.length)return;
  pvIdx=(i+state.pages.length)%state.pages.length;
  const p=state.pages[pvIdx];
  const countStr=(pvIdx+1)+" / "+state.pages.length;
  if($("#pvCount")) $("#pvCount").textContent="PAGE "+countStr;
  if($("#pvCountNav")) $("#pvCountNav").textContent=countStr;
  $("#pvName").textContent=p.name;
  const token=++pvToken;
  const stageEl=$("#pvStage");
  stageEl.innerHTML='<div class="thumb-load"></div>';
  await frame();
  try{
    const base=await renderBase(p,{maxEdge:clamp(Math.min(innerWidth,innerHeight)*0.92,600,2000)});
    const out=document.createElement("canvas"); out.width=base.width; out.height=base.height;
    const ctx=out.getContext("2d");
    ctx.fillStyle="#fff"; ctx.fillRect(0,0,out.width,out.height);
    ctx.filter=cssFilterOf(p); ctx.globalAlpha=opacityOf(p);
    ctx.drawImage(base,0,0); ctx.filter="none"; ctx.globalAlpha=1;
    const sh=sharpOf(p); if(sh>0)applySharpen(out,sh);
    drawErases(ctx,p,out.width,out.height);
    drawTexts(ctx,p,out.width,out.height);
    if(token!==pvToken)return;
    stageEl.innerHTML="";
    out.id="pvCanvas"; stageEl.appendChild(out);
  }catch(e){ if(token===pvToken){stageEl.innerHTML="";toast("Preview failed: "+e.message,"error");} }
}
function openPreview(startIdx){
  if(!state.pages.length)return;
  $("#previewView").hidden=false;
  showPvPage(startIdx==null?0:startIdx);
}
$("#pvClose").onclick=()=>$("#previewView").hidden=true;
$("#pvPrev").onclick=()=>showPvPage(pvIdx-1);
$("#pvNext").onclick=()=>showPvPage(pvIdx+1);
if($("#pvAdd")) $("#pvAdd").onclick=()=>{const p=state.pages[pvIdx];if(p)openAddPageModal(p.id);};
if($("#pvReplace")) $("#pvReplace").onclick=()=>{const p=state.pages[pvIdx];if(p){pendingReplace=p.id;$("#replaceInput").click();}};
function rotatePvPage(dir){
  const p=state.pages[pvIdx];if(!p)return;
  pushHistory();
  p.rotation=(((p.rotation+dir)%360)+360)%360;
  refreshThumbFor(p);
  const card=grid.querySelector('.pcard[data-id="'+p.id+'"]');
  if(card)card.querySelector(".pc-meta").innerHTML=pcMetaHTML(p);
  if(state.editingId===p.id)repaintEditor();
  showPvPage(pvIdx);
}
if($("#pvRotL")) $("#pvRotL").onclick=()=>rotatePvPage(-90);
if($("#pvRotR")) $("#pvRotR").onclick=()=>rotatePvPage(90);
if($("#pvDelete")){
  $("#pvDelete").onclick=async()=>{
    const p=state.pages[pvIdx];if(!p)return;
    const i=pvIdx;
    const ok=await confirmDialog({title:"Delete Page "+pad2(i+1)+"?",msg:'"'+p.name+'" will be removed. You can press Undo to restore.',okLabel:"Delete"});
    if(!ok)return;
    pushHistory();
    state.pages.splice(i,1);
    renderGrid();updateStats();buildStrip();
    if(state.editingId===p.id)closeEditor();
    if(!state.pages.length){
      $("#previewView").hidden=true; switchView(); toast("Document is now empty","info"); return;
    }
    toast("Page "+pad2(i+1)+" deleted","info",1800);
    showPvPage(Math.min(i,state.pages.length-1));
  };
}
if($("#pvEdit")){
  $("#pvEdit").onclick=()=>{
    const p=state.pages[pvIdx];if(!p)return;
    $("#previewView").hidden=true;
    openEditor(p.id);
  };
}
let pvSwipeX=null;
$("#pvStage").addEventListener("pointerdown",e=>{pvSwipeX=e.clientX;});
$("#pvStage").addEventListener("pointerup",e=>{
  if(pvSwipeX==null)return;
  const d=e.clientX-pvSwipeX; pvSwipeX=null;
  if(Math.abs(d)>60)showPvPage(pvIdx+(d < 0?1:-1));
});
$("#btnPreview").onclick=()=>openPreview(Math.max(0,idxOf(state.lastSelected)));

/* ============ save / export ============ */
const QUAL={small:{dpi:100,q:0.6,bpp:0.09},standard:{dpi:150,q:0.75,bpp:0.13},high:{dpi:220,q:0.86,bpp:0.18},max:{dpi:300,q:0.93,bpp:0.24}};
let curQuality="standard";
let curExpTargetPages=null;

function estimateSize(qk, pagesList=null){
  const pages = (pagesList && pagesList.length) ? pagesList : (curExpTargetPages || state.pages);
  const Q=QUAL[qk]; let bytes=0;
  pages.forEach(p=>{
    const dim=pagePhysical(p);
    const wpx=dim[0]*Q.dpi/72,hpx=dim[1]*Q.dpi/72;
    bytes+=wpx*hpx*Q.bpp+700;
  });
  return bytes;
}
let curExpMode = "pdf";
let curZipFmt = "jpg";

function openSaveModal(mode, customPages=null) {
  if (!state.pages.length) return;
  curExpMode = mode || "pdf";
  curExpTargetPages = customPages;

  const pagesToUse = (curExpTargetPages && curExpTargetPages.length) ? curExpTargetPages : state.pages;
  const count = pagesToUse.length;

  const base = (pagesToUse[0].name || "document").replace(/\.[^.]+$/, "").replace(/[\\/:*?"<>|]/g, "_").slice(0, 60) || "My_Document";
  $("#saveName").value = base + (curExpTargetPages ? "_selected" : "") + ".pdf";
  if ($("#zipSaveName")) $("#zipSaveName").value = base + (curExpTargetPages ? "_selected_images.zip" : "_images.zip");

  $$("#expModeSeg button").forEach(b => b.classList.toggle("on", b.dataset.exp === curExpMode));
  if ($("#pdfExportOpts")) $("#pdfExportOpts").hidden = curExpMode !== "pdf";
  if ($("#zipExportOpts")) $("#zipExportOpts").hidden = curExpMode !== "zip";

  $$(".qopt").forEach(o => {
    o.classList.toggle("sel", o.dataset.q === curQuality);
    o.querySelector("input").checked = o.dataset.q === curQuality;
  });
  $("#estLine").textContent = "Estimated size (" + count + " page" + (count > 1 ? "s" : "") + "): ≈ " + fmtBytes(estimateSize(curQuality, pagesToUse));
  $("#saveModal").hidden = false;
}

$$("#expModeSeg button").forEach(b => b.onclick = () => {
  curExpMode = b.dataset.exp;
  $$("#expModeSeg button").forEach(x => x.classList.toggle("on", x === b));
  if ($("#pdfExportOpts")) $("#pdfExportOpts").hidden = curExpMode !== "pdf";
  if ($("#zipExportOpts")) $("#zipExportOpts").hidden = curExpMode !== "zip";
});

$$("#zipFmtSeg button").forEach(b => b.onclick = () => {
  curZipFmt = b.dataset.fmt;
  $$("#zipFmtSeg button").forEach(x => x.classList.toggle("on", x === b));
});

$$(".qopt").forEach(o => o.onclick = () => {
  curQuality = o.dataset.q;
  $$(".qopt").forEach(x => { x.classList.toggle("sel", x === o); x.querySelector("input").checked = x === o; });
  $("#estLine").textContent = "Estimated size: ≈ " + fmtBytes(estimateSize(curQuality));
});

if ($("#btnSave")) $("#btnSave").onclick = () => openSaveModal("pdf");

if ($("#btnExportSelected")) $("#btnExportSelected").onclick = () => {
  const sel = state.pages.filter(p => p.selected !== false);
  if (!sel.length) { toast("Please select at least 1 page to export", "warn"); return; }
  openSaveModal("pdf", sel);
};
if ($("#chkSelectAll")) $("#chkSelectAll").onchange = (e) => {
  const isChecked = e.target.checked;
  state.pages.forEach(p => p.selected = isChecked);
  grid.querySelectorAll(".pg-select-chk").forEach(c => c.checked = isChecked);
  grid.querySelectorAll(".pcard").forEach(c => c.classList.toggle("selected", isChecked));
  updateSelectedStats();
  toast(isChecked ? "All pages selected" : "All pages deselected", "info", 1400);
};

$("#saveConfirm").onclick = async () => {
  const pagesToExport = (curExpTargetPages && curExpTargetPages.length) ? curExpTargetPages : state.pages;
  if (curExpMode === "pdf") {
    let name = $("#saveName").value.trim().replace(/[\\/:*?"<>|]/g, "-") || "My_Document.pdf";
    if (!/\.pdf$/i.test(name)) name += ".pdf";
    $("#saveModal").hidden = true;
    await exportPdf(name, curQuality, pagesToExport);
  } else {
    let zipName = $("#zipSaveName").value.trim().replace(/[\\/:*?"<>|]/g, "-") || "My_Images.zip";
    if (!/\.zip$/i.test(zipName)) zipName += ".zip";
    const dpi = +$("#zipDpi").value || 150;
    $("#saveModal").hidden = true;
    await exportZip(zipName, curZipFmt, dpi, pagesToExport);
  }
};
async function exportPdf(name,qKey,targetPages=null){
  const pages = (targetPages && targetPages.length) ? targetPages : state.pages;
  const Q=QUAL[qKey];
  showProgress("Saving PDF…",true);
  exportCancelled=false;
  try{
    try{await Promise.race([document.fonts.ready,new Promise(r=>setTimeout(r,1500))]);}catch(e){}
    const doc=await PDFLib.PDFDocument.create();
    doc.setTitle(name.replace(/\.pdf$/i,""));
    let bytesSum=0,failed=0;
    const total=pages.length;
    for(let i=0; i < total; i++){
      if(exportCancelled)throw new Error("cancelled");
      const est=bytesSum?(bytesSum/i*total):estimateSize(qKey, pages);
      setProgress(i/total,"Page "+(i+1)+" / "+total+" · ≈ "+fmtBytes(est));
      await frame();
      const p=pages[i];
      try{
        const dim=pagePhysical(p),wPt=dim[0],hPt=dim[1];
        let targetW=wPt*Q.dpi/72;
        const area=targetW*(hPt*Q.dpi/72);
        if(area>10000000)targetW*=Math.sqrt(10000000/area);
        const cv=await renderBase(p,{targetW:targetW});
        const out=document.createElement("canvas"); out.width=cv.width; out.height=cv.height;
        const ctx=out.getContext("2d");
        ctx.fillStyle="#fff"; ctx.fillRect(0,0,out.width,out.height);
        ctx.filter=cssFilterOf(p); ctx.globalAlpha=opacityOf(p);
        ctx.drawImage(cv,0,0);
        ctx.filter="none"; ctx.globalAlpha=1;
        const sh=sharpOf(p);
        if(sh>0&&out.width*out.height<=16000000)applySharpen(out,sh);
        drawErases(ctx,p,out.width,out.height);
        drawTexts(ctx,p,out.width,out.height);
        const blob=await new Promise(r=>out.toBlob(r,"image/jpeg",Q.q));
        if(!blob)throw new Error("encode failed");
        bytesSum+=blob.size;
        const img=await doc.embedJpg(await blob.arrayBuffer());
        const pg=doc.addPage([wPt,hPt]);
        pg.drawImage(img,{x:0,y:0,width:wPt,height:hPt});
        out.width=out.height=0; cv.width=cv.height=0;
      }catch(err){
        if(err.message==="cancelled")throw err;
        failed++; console.error(err);
      }
    }
    if(failed)toast(failed+" page(s) had errors and were skipped","error",5000);
    setProgress(0.97,"Finalizing PDF…"); await frame();
    const outBytes=await doc.save();
    setProgress(1,"Done");
    const blob=new Blob([outBytes],{type:"application/pdf"});
    const a=document.createElement("a");
    a.href=URL.createObjectURL(blob); a.download=name;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(()=>URL.revokeObjectURL(a.href),9000);
    toast(name+" saved — "+fmtBytes(blob.size)+" · "+total+" pages","ok",6000);
  }catch(err){
    if(err.message==="cancelled")toast("Export cancelled","warn");
    else toast("Export failed: "+(err.message||"unknown error"),"error",6000);
  }
  hideProgress();
}

async function exportZip(zipName, fmt, dpi, targetPages=null) {
  const pages = (targetPages && targetPages.length) ? targetPages : state.pages;
  if (!window.JSZip) {
    toast("JSZip library loading. Please check internet connection.", "error");
    return;
  }
  showProgress("Exporting Images Archive (ZIP)…", true);
  exportCancelled = false;
  try {
    const zip = new JSZip();
    const total = pages.length;
    const padLen = total > 99 ? 3 : 2;

    let mimeType = "image/jpeg";
    let ext = ".jpg";
    let quality = 0.88;

    if (fmt === "png") {
      mimeType = "image/png";
      ext = ".png";
      quality = 1.0;
    } else if (fmt === "gif") {
      mimeType = "image/gif";
      ext = ".gif";
      quality = 0.9;
    }

    for (let i = 0; i < total; i++) {
      if (exportCancelled) throw new Error("cancelled");
      setProgress(i / total, `Encoding Page ${i + 1} / ${total} (${fmt.toUpperCase()})`);
      await frame();

      const p = pages[i];
      const dim = pagePhysical(p);
      const targetW = dim[0] * (dpi / 72);
      const cv = await renderBase(p, { targetW: targetW });

      const out = document.createElement("canvas");
      out.width = cv.width;
      out.height = cv.height;
      const ctx = out.getContext("2d");
      ctx.fillStyle = "#fff";
      ctx.fillRect(0, 0, out.width, out.height);
      ctx.filter = cssFilterOf(p);
      ctx.globalAlpha = opacityOf(p);
      ctx.drawImage(cv, 0, 0);
      ctx.filter = "none";
      ctx.globalAlpha = 1;

      const sh = sharpOf(p);
      if (sh > 0 && out.width * out.height <= 16000000) applySharpen(out, sh);
      drawErases(ctx, p, out.width, out.height);
      drawTexts(ctx, p, out.width, out.height);

      let blob = await new Promise(r => out.toBlob(r, mimeType, quality));
      if (!blob) {
        blob = await new Promise(r => out.toBlob(r, "image/png", 1.0));
      }

      const fileName = `Page_${String(i + 1).padStart(padLen, "0")}${ext}`;
      zip.file(fileName, blob);

      out.width = out.height = 0;
      cv.width = cv.height = 0;
    }

    setProgress(0.94, "Compressing ZIP archive…");
    await frame();

    const zipBlob = await zip.generateAsync({ type: "blob", compression: "DEFLATE", compressionOptions: { level: 6 } }, pr => {
      setProgress(0.94 + (pr.percent * 0.06 / 100), `Compressing ZIP… ${Math.round(pr.percent)}%`);
    });

    const a = document.createElement("a");
    a.href = URL.createObjectURL(zipBlob);
    a.download = zipName;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 9000);

    toast(`${zipName} exported — ${fmtBytes(zipBlob.size)} · ${total} ${fmt.toUpperCase()} images`, "ok", 6000);
  } catch (err) {
    if (err.message === "cancelled") toast("Export cancelled", "warn");
    else toast("Export failed: " + (err.message || "unknown error"), "error", 6000);
  }
  hideProgress();
}

/* ============ global wiring ============ */
$("#btnEdit").onclick=()=>{
  const id=state.lastSelected!=null&&idxOf(state.lastSelected)>=0?state.lastSelected:state.pages[0].id;
  openEditor(id);
};
document.addEventListener("keydown",e=>{
  if((e.ctrlKey||e.metaKey)&&!e.shiftKey&&e.key.toLowerCase()==="z"){e.preventDefault();undo();}
  else if((e.ctrlKey||e.metaKey)&&(e.key.toLowerCase()==="y"||(e.shiftKey&&e.key.toLowerCase()==="z"))){e.preventDefault();redo();}
  else if(e.key==="Escape"){
    if(!$("#confirmBd").hidden)return;
    if(!$("#saveModal").hidden)$("#saveModal").hidden=true;
    else if(!$("#addPageModal").hidden)$("#addPageModal").hidden=true;
    else if(!$("#previewView").hidden)$("#previewView").hidden=true;
    else if(!$("#editorView").hidden)closeEditor();
  }
  else if(!$("#previewView").hidden){
    if(e.key==="ArrowRight")showPvPage(pvIdx+1);
    if(e.key==="ArrowLeft")showPvPage(pvIdx-1);
  }
});
addEventListener("beforeunload",e=>{
  if(state.pages.length){e.preventDefault();e.returnValue="";}
});
updateStats(); updateHistoryBtns();