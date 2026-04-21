'use strict';
const state={pages:[],stream:null,
  currentImage:null,   // display-res dataURL (for renderEdit)
  hdImage:null,        // FULL resolution dataURL (for crop warp + PDF)
  rotation:0,cropActive:false,
  corners:{tl:{x:0,y:0},tr:{x:0,y:0},br:{x:0,y:0},bl:{x:0,y:0}},
  adj:{brightness:0,contrast:0,darkness:0,sharpness:0},
  detectInterval:null,flashOn:false,activeDrag:null};

const $=id=>document.getElementById(id);
const splash=$('splash'),app=$('app');
const screens={home:$('screenHome'),camera:$('screenCamera'),edit:$('screenEdit'),pages:$('screenPages')};
const cameraVideo=$('cameraVideo'),editCanvas=$('editCanvas'),canvasWrapper=$('canvasWrapper');
const cropOverlay=$('cropOverlay'),textLayer=$('textLayer');
const detectRing=$('detectRing'),detectLabel=$('detectLabel');
const modalPerm=$('modalPermission'),modalProgress=$('modalProgress');
const progressCircle=$('progressCircle'),progressPct=$('progressPct'),progressLabel=$('progressLabel');
const pagesGrid=$('pagesGrid'),pageBadge=$('pageBadge'),pageCount=$('pageCount'),pdfReadyBanner=$('pdfReadyBanner');

// SVG elements for crop
const cropSVG=$('cropSVG'),maskPoly=$('maskPoly'),cropBorder=$('cropBorder');
const maskBg=$('maskBg'),darkRect=$('darkRect');
const chEls={tl:$('chTL'),tr:$('chTR'),br:$('chBR'),bl:$('chBL')};

// Splash
setTimeout(()=>{splash.classList.add('fade-out');setTimeout(()=>{splash.classList.add('hidden');app.classList.remove('hidden');},500);},2200);

function showScreen(n){Object.values(screens).forEach(s=>s.classList.remove('active'));screens[n].classList.add('active');}

function toast(msg,type=''){const el=document.createElement('div');el.className=`toast ${type}`;el.textContent=msg;$('toastContainer').appendChild(el);setTimeout(()=>el.remove(),2800);}

// HOME
$('btnCamera').addEventListener('click',()=>modalPerm.classList.remove('hidden'));
$('btnGallery').addEventListener('click',()=>$('galleryInput').click());
$('galleryInput').addEventListener('change',e=>{
  const files=[...e.target.files];if(!files.length)return;
  Promise.all(files.map(f=>new Promise(res=>{const r=new FileReader();r.onload=ev=>res(ev.target.result);r.readAsDataURL(f);}))).then(results=>{
    toast(`${results.length} image(s) loaded`,'success');
    if(results.length===1){loadIntoEditor(results[0]);showScreen('edit');}
    else{results.forEach(d=>state.pages.push({dataURL:d,origURL:d}));updatePageBadge();renderPagesGrid();showScreen('pages');}
  });
  e.target.value='';
});

// PERMISSION
$('btnPermAllow').addEventListener('click',async()=>{modalPerm.classList.add('hidden');await startCamera();});
$('btnPermDeny').addEventListener('click',()=>{modalPerm.classList.add('hidden');toast('Camera access denied','error');});

// CAMERA
async function startCamera(){
  try{state.stream=await navigator.mediaDevices.getUserMedia({video:{facingMode:'environment',width:{ideal:1920},height:{ideal:1080}}});
    cameraVideo.srcObject=state.stream;await cameraVideo.play();showScreen('camera');startDetection();}
  catch(err){toast('Camera: '+err.message,'error');}
}
function stopCamera(){if(state.stream){state.stream.getTracks().forEach(t=>t.stop());state.stream=null;}clearInterval(state.detectInterval);detectRing.classList.remove('found');}
function startDetection(){let t=0;state.detectInterval=setInterval(()=>{t++;if(t>10){detectRing.classList.add('found');detectLabel.textContent='✓ Document detected – tap to capture';}else detectLabel.textContent='Searching for document…';},400);}
$('btnCapture').addEventListener('click',()=>{
  const v=cameraVideo;if(!v.videoWidth){toast('Camera not ready','error');return;}
  const c=document.createElement('canvas');c.width=v.videoWidth;c.height=v.videoHeight;c.getContext('2d').drawImage(v,0,0);
  stopCamera();loadIntoEditor(c.toDataURL('image/jpeg',0.98));showScreen('edit');
});
$('btnCamClose').addEventListener('click',()=>{stopCamera();showScreen('home');});
$('btnFlash').addEventListener('click',()=>{state.flashOn=!state.flashOn;const tr=state.stream?.getVideoTracks()[0];if(tr?.getCapabilities?.()?.torch)tr.applyConstraints({advanced:[{torch:state.flashOn}]});toast(state.flashOn?'Flash ON':'Flash OFF');});

// EDITOR
function loadIntoEditor(dataURL){
  // store BOTH: hdImage = full-res master, currentImage = same until crop reduces it
  state.currentImage=dataURL;
  state.hdImage=dataURL;
  state.rotation=0;
  state.adj={brightness:0,contrast:0,darkness:0,sharpness:0};
  state.cropActive=false;textLayer.innerHTML='';
  ['slBrightness','slContrast','slDarkness','slSharpness'].forEach(id=>$(id).value=0);
  ['valBrightness','valContrast','valDarkness','valSharpness'].forEach(id=>$(id).textContent='0');
  hideCrop();renderEdit();
}

function renderEdit(){
  const img=new Image();
  img.onload=()=>{
    let iw=img.naturalWidth,ih=img.naturalHeight;
    if(state.rotation%180!==0)[iw,ih]=[ih,iw];
    const ww=canvasWrapper.clientWidth||360,wh=canvasWrapper.clientHeight||400;
    const sc=Math.min(ww/iw,wh/ih,1);
    editCanvas.width=Math.round(iw*sc);editCanvas.height=Math.round(ih*sc);
    const ctx=editCanvas.getContext('2d');
    ctx.save();ctx.translate(editCanvas.width/2,editCanvas.height/2);ctx.rotate(state.rotation*Math.PI/180);ctx.scale(sc,sc);ctx.drawImage(img,-img.naturalWidth/2,-img.naturalHeight/2);ctx.restore();
    applyFilters(ctx,editCanvas.width,editCanvas.height);
    if(state.cropActive)positionOverlay();
  };img.src=state.currentImage;
}

function applyFilters(ctx,w,h){
  const{brightness:bf,contrast:cf,darkness:dk,sharpness:sp}=state.adj;
  const id=ctx.getImageData(0,0,w,h);const d=id.data;
  const b=bf/100*255,c=(cf/100+1)**2,dk2=dk/100;
  for(let i=0;i<d.length;i+=4){let r=d[i]+b,g=d[i+1]+b,bl2=d[i+2]+b;r=c*(r-128)+128;g=c*(g-128)+128;bl2=c*(bl2-128)+128;r*=(1-dk2);g*=(1-dk2);bl2*=(1-dk2);d[i]=Math.max(0,Math.min(255,r));d[i+1]=Math.max(0,Math.min(255,g));d[i+2]=Math.max(0,Math.min(255,bl2));}
  if(sp>0)applySharpen(d,w,h,sp/10);ctx.putImageData(id,0,0);
}
function applySharpen(d,w,h,amt){const k=[0,-1,0,-1,5,-1,0,-1,0],cp=new Uint8ClampedArray(d);for(let y=1;y<h-1;y++)for(let x=1;x<w-1;x++)for(let c=0;c<3;c++){let v=0;for(let ky=-1;ky<=1;ky++)for(let kx=-1;kx<=1;kx++)v+=cp[((y+ky)*w+(x+kx))*4+c]*k[(ky+1)*3+(kx+1)];const i=(y*w+x)*4+c;d[i]=Math.max(0,Math.min(255,d[i]+(v-d[i])*amt));}}

function bindSlider(id,key,vid){$(id).addEventListener('input',e=>{state.adj[key]=+e.target.value;$(vid).textContent=e.target.value;renderEdit();});}
bindSlider('slBrightness','brightness','valBrightness');bindSlider('slContrast','contrast','valContrast');bindSlider('slDarkness','darkness','valDarkness');bindSlider('slSharpness','sharpness','valSharpness');

window.applyPreset=function(name){
  const map={original:{brightness:0,contrast:0,darkness:0,sharpness:0},magic:{brightness:15,contrast:30,darkness:0,sharpness:3},grayscale:{brightness:0,contrast:20,darkness:0,sharpness:2},bw:{brightness:-10,contrast:80,darkness:20,sharpness:5},enhance:{brightness:10,contrast:15,darkness:0,sharpness:4}};
  state.adj={...map[name]};
  ['Brightness','Contrast','Darkness','Sharpness'].forEach(k=>{$('sl'+k).value=state.adj[k.toLowerCase()];$('val'+k).textContent=state.adj[k.toLowerCase()];});
  if(name==='grayscale'||name==='bw'){const ctx=editCanvas.getContext('2d');const id=ctx.getImageData(0,0,editCanvas.width,editCanvas.height);for(let i=0;i<id.data.length;i+=4){const a=0.299*id.data[i]+0.587*id.data[i+1]+0.114*id.data[i+2];id.data[i]=id.data[i+1]=id.data[i+2]=a;}ctx.putImageData(id,0,0);return;}
  renderEdit();
};

document.querySelectorAll('.tab-btn').forEach(btn=>btn.addEventListener('click',()=>{document.querySelectorAll('.tab-btn').forEach(b=>b.classList.remove('active'));document.querySelectorAll('.tool-panel').forEach(p=>p.classList.remove('active'));btn.classList.add('active');$('panel'+btn.dataset.tab[0].toUpperCase()+btn.dataset.tab.slice(1)).classList.add('active');}));
$('btnRotate').addEventListener('click',()=>{state.rotation=(state.rotation+90)%360;renderEdit();});

// ═══ 4-CORNER PERSPECTIVE CROP ═══
function canvasRectInWrapper(){const wr=canvasWrapper.getBoundingClientRect(),cr=editCanvas.getBoundingClientRect();return{left:cr.left-wr.left,top:cr.top-wr.top,width:cr.width,height:cr.height};}

function positionOverlay(){
  const r=canvasRectInWrapper();
  cropOverlay.style.left=r.left+'px';cropOverlay.style.top=r.top+'px';cropOverlay.style.width=r.width+'px';cropOverlay.style.height=r.height+'px';
  cropOverlay.classList.remove('hidden');
  const W=r.width,H=r.height;
  cropSVG.setAttribute('viewBox',`0 0 ${W} ${H}`);cropSVG.setAttribute('width',W);cropSVG.setAttribute('height',H);
  maskBg.setAttribute('width',W);maskBg.setAttribute('height',H);
  darkRect.setAttribute('width',W);darkRect.setAttribute('height',H);
  refreshCropSVG();
}

function refreshCropSVG(){
  const{tl,tr,br,bl}=state.corners;
  const pts=`${tl.x},${tl.y} ${tr.x},${tr.y} ${br.x},${br.y} ${bl.x},${bl.y}`;
  maskPoly.setAttribute('points',pts);cropBorder.setAttribute('points',pts);
  // Rule-of-thirds guide lines
  const mixT=(a,b,t)=>({x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t});
  const tl1=mixT(tl,tr,1/3),tl2=mixT(tl,tr,2/3);
  const bl1=mixT(bl,br,1/3),bl2=mixT(bl,br,2/3);
  const lt1=mixT(tl,bl,1/3),lt2=mixT(tl,bl,2/3);
  const rt1=mixT(tr,br,1/3),rt2=mixT(tr,br,2/3);
  const setLine=(id,x1,y1,x2,y2)=>{const l=$(id);l.setAttribute('x1',x1);l.setAttribute('y1',y1);l.setAttribute('x2',x2);l.setAttribute('y2',y2);};
  setLine('g1',tl1.x,tl1.y,bl1.x,bl1.y);setLine('g2',tl2.x,tl2.y,bl2.x,bl2.y);
  setLine('g3',lt1.x,lt1.y,rt1.x,rt1.y);setLine('g4',lt2.x,lt2.y,rt2.x,rt2.y);
  // Position corner handles
  const setHandle=(el,p)=>el.setAttribute('transform',`translate(${p.x},${p.y})`);
  setHandle(chEls.tl,tl);setHandle(chEls.tr,tr);setHandle(chEls.br,br);setHandle(chEls.bl,bl);
}

function hideCrop(){cropOverlay.classList.add('hidden');state.cropActive=false;}

function initDefaultCorners(){
  const W=cropOverlay.clientWidth,H=cropOverlay.clientHeight;
  const pad=0.08;
  state.corners={tl:{x:W*pad,y:H*pad},tr:{x:W*(1-pad),y:H*pad},br:{x:W*(1-pad),y:H*(1-pad)},bl:{x:W*pad,y:H*(1-pad)}};
}

$('btnCropToggle').addEventListener('click',()=>{
  if(state.cropActive){hideCrop();$('btnCropToggle').innerHTML='<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 2 6 8 2 8"/><polyline points="18 22 18 16 22 16"/><path d="M2 8h14a2 2 0 0 1 2 2v10"/><path d="M22 16H8a2 2 0 0 1-2-2V2"/></svg> Manual Crop';return;}
  state.cropActive=true;positionOverlay();initDefaultCorners();refreshCropSVG();
  $('btnCropToggle').textContent='Cancel Crop';toast('Drag each corner (1–4) to adjust');
});

$('btnAutoCrop').addEventListener('click',()=>{
  state.cropActive=true;positionOverlay();
  const W=cropOverlay.clientWidth,H=cropOverlay.clientHeight,p=0.04;
  state.corners={tl:{x:W*p,y:H*p},tr:{x:W*(1-p),y:H*p},br:{x:W*(1-p),y:H*(1-p)},bl:{x:W*p,y:H*(1-p)}};
  refreshCropSVG();toast('Auto crop – drag corners to refine','success');
});

// Corner dragging
Object.values(chEls).forEach(el=>{
  const cKey=el.dataset.c;
  el.addEventListener('pointerdown',e=>{
    e.stopPropagation();el.setPointerCapture(e.pointerId);
    el.classList.add('active');state.activeDrag=cKey;
  });
  el.addEventListener('pointermove',e=>{
    if(state.activeDrag!==cKey)return;
    const wr=cropOverlay.getBoundingClientRect();
    const x=Math.max(0,Math.min(cropOverlay.clientWidth, e.clientX-wr.left));
    const y=Math.max(0,Math.min(cropOverlay.clientHeight,e.clientY-wr.top));
    state.corners[cKey]={x,y};refreshCropSVG();
  });
  el.addEventListener('pointerup',()=>{el.classList.remove('active');state.activeDrag=null;});
  el.addEventListener('pointercancel',()=>{el.classList.remove('active');state.activeDrag=null;});
});

// Perspective warp helpers
function gaussSolve(M,b){const n=b.length;const A=M.map((r,i)=>[...r,b[i]]);for(let c=0;c<n;c++){let mx=c;for(let r=c+1;r<n;r++)if(Math.abs(A[r][c])>Math.abs(A[mx][c]))mx=r;[A[c],A[mx]]=[A[mx],A[c]];if(Math.abs(A[c][c])<1e-12)return null;for(let r=c+1;r<n;r++){const f=A[r][c]/A[c][c];for(let j=c;j<=n;j++)A[r][j]-=f*A[c][j];}}const x=new Array(n).fill(0);for(let i=n-1;i>=0;i--){x[i]=A[i][n]/A[i][i];for(let j=i+1;j<n;j++)x[i]-=A[i][j]*x[j]/A[i][i];}return x;}

function computeH(dst,src){const A=[],b=[];for(let i=0;i<4;i++){const[xs,ys]=[src[i].x,src[i].y];const[xd,yd]=[dst[i].x,dst[i].y];A.push([xd,yd,1,0,0,0,-xd*xs,-yd*xs]);b.push(xs);A.push([0,0,0,xd,yd,1,-xd*ys,-yd*ys]);b.push(ys);}const h=gaussSolve(A,b);return h?[[h[0],h[1],h[2]],[h[3],h[4],h[5]],[h[6],h[7],1]]:null;}

function dist(a,b){return Math.hypot(b.x-a.x,b.y-a.y);}

/* Bilinear sample – smooth HD quality (no pixel staircase) */
function bilinear(data,w,h,fx,fy){
  const x0=Math.floor(fx),y0=Math.floor(fy);
  const x1=Math.min(x0+1,w-1),y1=Math.min(y0+1,h-1);
  const dx=fx-x0,dy=fy-y0;
  const out=[0,0,0,255];
  for(let c=0;c<3;c++){
    const tl=data[(y0*w+x0)*4+c],tr=data[(y0*w+x1)*4+c];
    const bl=data[(y1*w+x0)*4+c],br=data[(y1*w+x1)*4+c];
    out[c]=Math.round(tl*(1-dx)*(1-dy)+tr*dx*(1-dy)+bl*(1-dx)*dy+br*dx*dy);
  }
  return out;
}

function warpPerspective(srcCanvas,corners,scaleX,scaleY){
  // Scale display corners → full-resolution image corners
  const sc={
    tl:{x:corners.tl.x*scaleX,y:corners.tl.y*scaleY},
    tr:{x:corners.tr.x*scaleX,y:corners.tr.y*scaleY},
    br:{x:corners.br.x*scaleX,y:corners.br.y*scaleY},
    bl:{x:corners.bl.x*scaleX,y:corners.bl.y*scaleY}
  };
  const outW=Math.round(Math.max(dist(sc.tl,sc.tr),dist(sc.bl,sc.br)));
  const outH=Math.round(Math.max(dist(sc.tl,sc.bl),dist(sc.tr,sc.br)));
  const dst=[{x:0,y:0},{x:outW,y:0},{x:outW,y:outH},{x:0,y:outH}];
  const H=computeH(dst,[sc.tl,sc.tr,sc.br,sc.bl]);if(!H)return null;
  const sData=srcCanvas.getContext('2d').getImageData(0,0,srcCanvas.width,srcCanvas.height).data;
  const sw=srcCanvas.width,sh=srcCanvas.height;
  const out=document.createElement('canvas');out.width=outW;out.height=outH;
  const oCtx=out.getContext('2d');const oImg=oCtx.createImageData(outW,outH);const od=oImg.data;
  for(let dy=0;dy<outH;dy++){
    for(let dx=0;dx<outW;dx++){
      const ww=H[2][0]*dx+H[2][1]*dy+H[2][2];
      // Use sub-pixel float coords for bilinear sampling
      const fx=(H[0][0]*dx+H[0][1]*dy+H[0][2])/ww;
      const fy=(H[1][0]*dx+H[1][1]*dy+H[1][2])/ww;
      if(fx>=0&&fx<sw&&fy>=0&&fy<sh){
        const px=bilinear(sData,sw,sh,fx,fy);
        const di=(dy*outW+dx)*4;
        od[di]=px[0];od[di+1]=px[1];od[di+2]=px[2];od[di+3]=255;
      }
    }
  }
  oCtx.putImageData(oImg,0,0);return out;
}

$('btnApplyCrop').addEventListener('click',async()=>{
  if(!state.cropActive){toast('Enable crop first');return;}
  toast('Applying HD perspective correction…');
  await tick();
  // Always warp the FULL-RESOLUTION master (state.hdImage)
  const fullImg=await loadImg(state.hdImage);
  const fc=document.createElement('canvas');
  fc.width=fullImg.naturalWidth;fc.height=fullImg.naturalHeight;
  fc.getContext('2d').drawImage(fullImg,0,0);
  // Scale: display canvas coords → full-res image coords
  const sx=fullImg.naturalWidth/editCanvas.width;
  const sy=fullImg.naturalHeight/editCanvas.height;
  const warped=warpPerspective(fc,state.corners,sx,sy);
  if(!warped){toast('Crop failed','error');return;}
  // Store warped result as new HD master
  const hdURL=warped.toDataURL('image/png');
  state.hdImage=hdURL;
  state.currentImage=hdURL;
  hideCrop();renderEdit();toast('Perspective crop applied!','success');
});

// TEXT
$('btnAddText').addEventListener('click',()=>{
  const txt=$('textInput').value.trim();if(!txt){toast('Enter text first');return;}
  addTextItem(txt,$('colorText').value,$('chkTransparent').checked?'transparent':$('colorTextBg').value,$('fontSize').value,$('fontFamily').value);
  $('textInput').value='';toast('Text placed – drag to move, double-tap removes');
});
function addTextItem(txt,color,bg,size,font){
  const el=document.createElement('div');el.className='draggable-text';el.textContent=txt;
  Object.assign(el.style,{position:'absolute',left:'10%',top:'10%',color,background:bg,fontSize:size+'px',fontFamily:font,padding:bg==='transparent'?'0':'4px 10px',borderRadius:'6px',cursor:'move',userSelect:'none',pointerEvents:'all',maxWidth:'80%',wordBreak:'break-word',border:'1px dashed rgba(255,255,255,.5)',zIndex:10});
  textLayer.style.pointerEvents='all';textLayer.appendChild(el);makeDraggable(el);
  el.addEventListener('dblclick',()=>el.remove());
}
function makeDraggable(el){let sx=0,sy=0,ox=0,oy=0;el.addEventListener('pointerdown',e=>{e.stopPropagation();el.setPointerCapture(e.pointerId);sx=e.clientX;sy=e.clientY;const r=el.getBoundingClientRect(),wr=textLayer.getBoundingClientRect();ox=r.left-wr.left;oy=r.top-wr.top;});el.addEventListener('pointermove',e=>{el.style.left=(ox+(e.clientX-sx))+'px';el.style.top=(oy+(e.clientY-sy))+'px';});}

// DONE – add page (always saves from the HD master)
$('btnAddToDoc').addEventListener('click',async()=>{
  // 1. If text overlays exist, bake them onto a full-res canvas
  let pageURL=state.hdImage;
  if(textLayer.children.length>0){
    const hdImg=await loadImg(state.hdImage);
    const fc=document.createElement('canvas');
    fc.width=hdImg.naturalWidth;fc.height=hdImg.naturalHeight;
    const fctx=fc.getContext('2d');
    fctx.drawImage(hdImg,0,0);
    // Scale text positions from display canvas to full-res
    const scX=hdImg.naturalWidth/editCanvas.width;
    const scY=hdImg.naturalHeight/editCanvas.height;
    const wr=editCanvas.getBoundingClientRect();
    [...textLayer.children].forEach(el=>{
      const er=el.getBoundingClientRect();
      const x=(er.left-wr.left)*scX,y=(er.top-wr.top)*scY;
      const fs=parseFloat(el.style.fontSize)*scX;
      fctx.font=`bold ${fs}px ${el.style.fontFamily}`;
      if(el.style.background&&el.style.background!=='transparent'){
        fctx.fillStyle=el.style.background;
        fctx.fillRect(x,y-fs*1.2,el.offsetWidth*scX,el.offsetHeight*scY);
      }
      fctx.fillStyle=el.style.color;
      fctx.fillText(el.textContent,x,y);
    });
    pageURL=fc.toDataURL('image/png');
  }
  state.pages.push({dataURL:pageURL});
  updatePageBadge();renderPagesGrid();
  pdfReadyBanner.classList.remove('hidden');toast('Page added in HD!','success');showScreen('home');
});
$('btnEditBack').addEventListener('click',()=>{hideCrop();showScreen('home');});

// PAGES
function updatePageBadge(){pageBadge.textContent=state.pages.length;pageCount.textContent=state.pages.length;}
function renderPagesGrid(){
  pagesGrid.innerHTML='';
  state.pages.forEach((pg,i)=>{
    const card=document.createElement('div');card.className='page-card';
    card.innerHTML=`<img src="${pg.dataURL}" alt="Page ${i+1}"/><span class="page-num">Page ${i+1}</span><button class="del-page" title="Delete">✕</button>`;
    card.querySelector('.del-page').addEventListener('click',()=>{state.pages.splice(i,1);updatePageBadge();renderPagesGrid();if(!state.pages.length)pdfReadyBanner.classList.add('hidden');});
    pagesGrid.appendChild(card);
  });
}
$('btnPages').addEventListener('click',()=>{renderPagesGrid();showScreen('pages');});
$('btnPagesBack').addEventListener('click',()=>showScreen('home'));
$('btnAddMorePages').addEventListener('click',()=>showScreen('home'));

// HD PDF
$('btnDownloadPDF').addEventListener('click',generatePDF);
async function generatePDF(){
  if(!state.pages.length){toast('No pages to export','error');return;}
  modalProgress.classList.remove('hidden');await tick();
  try{
    const{jsPDF}=window.jspdf;const total=state.pages.length;let pdf;
    for(let i=0;i<total;i++){
      updateProgress(Math.round(((i+0.5)/total)*100),`Page ${i+1} of ${total}…`);await tick();
      const img=await loadImg(state.pages[i].dataURL);
      // 300 PPI: 1 px = 72/300 pt  → real print-quality sizing
      const pxToPt=px=>px*72/300;
      const pw=pxToPt(img.width),ph=pxToPt(img.height);
      const land=img.width>img.height;
      if(i===0)pdf=new jsPDF({orientation:land?'l':'p',unit:'pt',format:[pw,ph]});
      else pdf.addPage([pw,ph],land?'l':'p');
      // JPEG quality:1.0 gives best size/quality ratio; PNG is too large for jsPDF
      pdf.addImage(state.pages[i].dataURL,'JPEG',0,0,pw,ph,undefined,'NONE',0,1.0);
    }
    updateProgress(100,'Saving HD PDF…');await tick();
    pdf.save('DocScan_HD.pdf');
    modalProgress.classList.add('hidden');toast('HD PDF downloaded!','success');
    setTimeout(()=>{state.pages=[];updatePageBadge();renderPagesGrid();pdfReadyBanner.classList.add('hidden');showScreen('home');toast('Ready for next scan!','success');},1200);
  }catch(err){modalProgress.classList.add('hidden');toast('PDF error: '+err.message,'error');}
}

function updateProgress(pct,label){const c=2*Math.PI*26;progressCircle.style.strokeDashoffset=c-(c*pct/100);progressPct.textContent=pct+'%';progressLabel.textContent=label;}
function loadImg(src){return new Promise((r,j)=>{const i=new Image();i.onload=()=>r(i);i.onerror=j;i.src=src;});}
function tick(){return new Promise(r=>setTimeout(r,30));}
