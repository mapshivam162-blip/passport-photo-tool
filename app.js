'use strict';
/* Passport Photo Maker — 100% client-side.
   Photo kabhi device se bahar nahi jati. Offline PWA. */
const $=id=>document.getElementById(id);
const viewUpload=$('viewUpload'),viewEditor=$('viewEditor'),viewResult=$('viewResult');
const viewport=$('viewport'),cropImg=$('cropImg'),zoomRange=$('zoomRange');
const processBtn=$('processBtn');

const BG_COLORS={none:null,white:'#ffffff',blue:'#e9f2fc',gray:'#eef2f7'};
const state={
  img:null, iw:0, ih:0, vw:0, vh:0,
  aspectMode:'passport', aspect:3.5/4.5, zoom:1, ox:0, oy:0,
  mode:'passport', targetKB:50, bg:'none', maxDim:600, copies:8,
  fileName:'photo', fileSize:0, srcURL:null,
  filters:{bright:100,contrast:100}, whiten:'off', paper:'4x6',
  last:{blobURL:null,blob:null,name:'photo.jpg',kb:0,w:0,h:0,q:0},
  sheetURL:null, history:[]
};

/* ---------- helpers ---------- */
function toast(msg){
  const t=$('toast'); t.textContent=msg; t.classList.add('show');
  clearTimeout(toast._h); toast._h=setTimeout(()=>t.classList.remove('show'),2600);
}
function showView(v){
  [viewUpload,viewEditor,viewResult].forEach(x=>x.hidden=x!==v);
  window.scrollTo({top:0,behavior:'smooth'});
}
function hexRGB(h){return{r:parseInt(h.slice(1,3),16),g:parseInt(h.slice(3,5),16),b:parseInt(h.slice(5,7),16)};}
function canvasToBlob(c,type,q){return new Promise(r=>c.toBlob(r,type,q));}
function kb(b){return (b.size/1024).toFixed(1)+' KB';}

/* ---------- theme ---------- */
function applyTheme(t){
  document.body.dataset.theme = t==='dark' ? 'dark' : 'light';
  $('themeBtn').textContent = t==='dark' ? '☀️' : '🌙';
  try{localStorage.setItem('pm_theme',t);}catch(e){}
}
try{ applyTheme(localStorage.getItem('pm_theme')||'light'); }catch(e){ applyTheme('light'); }
$('themeBtn').onclick=()=>applyTheme(document.body.dataset.theme==='dark'?'light':'dark');

/* ---------- upload ---------- */
function loadFile(file){
  if(!file) return;
  if(!file.type.startsWith('image/')){toast('Kripya image file chunein (JPG/PNG)');return;}
  if(file.size>25*1024*1024){toast('File bahut badi hai (25MB se kam rakhein)');return;}
  if(state.srcURL) URL.revokeObjectURL(state.srcURL);
  const url=URL.createObjectURL(file);
  state.srcURL=url; state.fileSize=file.size;
  state.fileName=(file.name||'photo').replace(/\.[^.]+$/,'').replace(/[^\w\-]+/g,'_')||'photo';
  const img=new Image();
  img.onload=()=>{
    state.img=img; state.iw=img.naturalWidth; state.ih=img.naturalHeight;
    cropImg.src=url;
    state.zoom=1;
    setAspect('passport');          // viewport size set ho jayega
    center(); clampPos(); render();
    showView(viewEditor);
    toast('Photo load ho gayi ✅ ab crop & size set karein');
  };
  img.onerror=()=>toast('Photo load nahi hui — dusri file try karein');
  img.src=url;
}
$('pickBtn').onclick=()=>$('pickInput').click();
$('camBtn').onclick=()=>$('camInput').click();
$('pickInput').onchange=e=>{loadFile(e.target.files[0]); e.target.value='';};
$('camInput').onchange=e=>{loadFile(e.target.files[0]); e.target.value='';};
const dz=$('dropZone');
dz.addEventListener('click',()=>$('pickInput').click());
dz.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();$('pickInput').click();}});
['dragenter','dragover'].forEach(ev=>dz.addEventListener(ev,e=>{e.preventDefault();dz.classList.add('over');}));
['dragleave','drop'].forEach(ev=>dz.addEventListener(ev,e=>{e.preventDefault();dz.classList.remove('over');}));
dz.addEventListener('drop',e=>loadFile(e.dataTransfer.files[0]));
window.addEventListener('paste',e=>{
  const it=[...(e.clipboardData?.items||[])].find(i=>i.type.startsWith('image/'));
  if(it) loadFile(it.getAsFile());
});

/* ---------- viewport / crop math ---------- */
function refreshViewport(){
  state.vw=viewport.clientWidth;
  if(state.aspectMode==='original') state.vh=state.vw*(state.ih/state.iw);
  else state.vh=state.vw/state.aspect;
  viewport.style.height=state.vh+'px';
}
function coverScale(){return Math.max(state.vw/state.iw, state.vh/state.ih);}
function curScale(){return coverScale()*state.zoom;}

function clampPos(){
  const s=curScale();
  const maxOx=state.vw-state.iw*s, maxOy=state.vh-state.ih*s;
  state.ox=Math.min(0,Math.max(maxOx,state.ox));
  state.oy=Math.min(0,Math.max(maxOy,state.oy));
}
function center(){
  const s=curScale();
  state.ox=(state.vw-state.iw*s)/2;
  state.oy=(state.vh-state.ih*s)/2;
}
function render(){
  const s=curScale();
  cropImg.style.width=(state.iw*s)+'px';
  cropImg.style.height=(state.ih*s)+'px';
  cropImg.style.left=state.ox+'px';
  cropImg.style.top=state.oy+'px';
  zoomRange.value=state.zoom;
}
function setZoom(nz,anchorCx=true,anchorCy=true){
  const oldS=curScale();
  state.zoom=Math.min(4,Math.max(1,nz));
  const newS=curScale();
  if(anchorCx) state.ox=state.vw/2-(state.vw/2-state.ox)*(newS/oldS);
  if(anchorCy) state.oy=state.vh/2-(state.vh/2-state.oy)*(newS/oldS);
  clampPos(); render();
}
function getCropRect(){
  const s=curScale();
  return {x:-state.ox/s, y:-state.oy/s, w:state.vw/s, h:state.vh/s};
}

/* pointer: drag + pinch */
const pointers=new Map(); let pinchDist=0;
viewport.addEventListener('pointerdown',e=>{
  viewport.setPointerCapture(e.pointerId);
  pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});
  if(pointers.size===2){
    const p=[...pointers.values()];
    pinchDist=Math.hypot(p[0].x-p[1].x,p[0].y-p[1].y);
  }
});
viewport.addEventListener('pointermove',e=>{
  if(!pointers.has(e.pointerId))return;
  const prev=pointers.get(e.pointerId);
  const dx=e.clientX-prev.x, dy=e.clientY-prev.y;
  pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});
  if(pointers.size===1){
    state.ox+=dx; state.oy+=dy; clampPos(); render();
  }else if(pointers.size===2){
    const p=[...pointers.values()];
    const d=Math.hypot(p[0].x-p[1].x,p[0].y-p[1].y);
    if(pinchDist>0) setZoom(state.zoom*(d/pinchDist));
    pinchDist=d;
  }
});
const endPtr=e=>{pointers.delete(e.pointerId); if(pointers.size<2)pinchDist=0;};
viewport.addEventListener('pointerup',endPtr);
viewport.addEventListener('pointercancel',endPtr);
viewport.addEventListener('wheel',e=>{
  e.preventDefault();
  setZoom(state.zoom*(e.deltaY<0?1.12:0.89));
},{passive:false});

zoomRange.addEventListener('input',()=>setZoom(+zoomRange.value));
$('zoomIn').onclick=()=>setZoom(state.zoom*1.25);
$('zoomOut').onclick=()=>setZoom(state.zoom/1.25);
$('resetBtn').onclick=()=>{state.zoom=1;center();clampPos();render();toast('Reset ho gaya');};
$('rotateBtn').onclick=()=>{
  if(!state.img)return;
  const c=document.createElement('canvas');
  c.width=state.ih; c.height=state.iw;
  const ctx=c.getContext('2d');
  ctx.translate(c.width,0); ctx.rotate(Math.PI/2);
  ctx.drawImage(state.img,0,0);
  state.img=c; state.iw=c.width; state.ih=c.height;
  cropImg.src=c.toDataURL('image/png');
  refreshViewport(); center(); clampPos(); render();
  toast('Photo rotate ho gayi ⟳');
};

/* ---------- aspect ---------- */
function setAspect(mode){
  state.aspectMode=mode;
  state.aspect = mode==='square' ? 1 : (3.5/4.5);
  document.querySelectorAll('#aspectChips .chip').forEach(c=>c.classList.toggle('active',c.dataset.v===mode));
  if(!state.img)return;
  refreshViewport(); center(); clampPos(); render();
}
$('aspectChips').addEventListener('click',e=>{
  const b=e.target.closest('.chip'); if(b) setAspect(b.dataset.v);
});

/* window resize par viewport theek rakhein */
let rzT;
window.addEventListener('resize',()=>{
  if(viewEditor.hidden||!state.img)return;
  clearTimeout(rzT); rzT=setTimeout(()=>{refreshViewport();clampPos();render();},120);
});

/* ---------- mode / chips ---------- */
function setMode(m){
  state.mode=m;
  $('modePassport').classList.toggle('active',m==='passport');
  $('modeCompress').classList.toggle('active',m==='compress');
  $('aspectCtrl').style.display = m==='passport' ? '' : 'none';
  $('sigCtrl').style.display = m==='compress' ? '' : 'none';
  $('dimLabel').textContent = m==='passport' ? 'Output Width (px)' : 'Max Width (px)';
  if(m==='compress' && state.maxDim<800) setDim(1200);
  if(!state.img)return;
  refreshViewport(); center(); clampPos(); render();
}
$('modePassport').onclick=()=>setMode('passport');
$('modeCompress').onclick=()=>setMode('compress');

function setDim(v){
  state.maxDim=v;
  document.querySelectorAll('#dimChips .chip').forEach(c=>c.classList.toggle('active',+c.dataset.v===v));
}
$('dimChips').addEventListener('click',e=>{const b=e.target.closest('.chip'); if(b)setDim(+b.dataset.v);});

function setTargetKB(v){
  state.targetKB=v;
  $('targetRange').value=v;
  $('targetVal').textContent = v===0 ? 'No limit (best quality)' : v+' KB';
  document.querySelectorAll('#sizeChips .chip').forEach(c=>c.classList.toggle('active',+c.dataset.v===v));
}
$('targetRange').addEventListener('input',e=>setTargetKB(+e.target.value));
$('sizeChips').addEventListener('click',e=>{const b=e.target.closest('.chip'); if(b)setTargetKB(+b.dataset.v);});

$('bgChips').addEventListener('click',e=>{
  const b=e.target.closest('.chip'); if(!b)return;
  state.bg=b.dataset.v;
  document.querySelectorAll('#bgChips .chip').forEach(c=>c.classList.toggle('active',c===b));
});
$('whitenChips').addEventListener('click',e=>{
  const b=e.target.closest('.chip'); if(!b)return;
  state.whiten=b.dataset.v;
  document.querySelectorAll('#whitenChips .chip').forEach(c=>c.classList.toggle('active',c===b));
});
$('adjBright').addEventListener('input',e=>{state.filters.bright=+e.target.value;});
$('adjContrast').addEventListener('input',e=>{state.filters.contrast=+e.target.value;});
$('adjReset').onclick=()=>{
  state.filters={bright:100,contrast:100};
  $('adjBright').value=100; $('adjContrast').value=100;
  toast('Fine-tune reset');
};
$('copyChips').addEventListener('click',e=>{
  const b=e.target.closest('.chip'); if(!b)return;
  state.copies=+b.dataset.v;
  document.querySelectorAll('#copyChips .chip').forEach(c=>c.classList.toggle('active',c===b));
  if(state.last.blobURL && !viewResult.hidden) rebuildSheet();
});
$('paperChips').addEventListener('click',e=>{
  const b=e.target.closest('.chip'); if(!b)return;
  state.paper=b.dataset.v;
  document.querySelectorAll('#paperChips .chip').forEach(c=>c.classList.toggle('active',c===b));
  if(state.last.blobURL && !viewResult.hidden) rebuildSheet();
});
$('presetChips').addEventListener('click',e=>{
  const b=e.target.closest('.chip'); if(!b)return;
  let p; try{p=JSON.parse(b.dataset.p);}catch{return;}
  setMode(p.mode);
  if(p.mode==='passport') setAspect('passport');
  setDim(p.dim); setTargetKB(p.kb);
  toast('Preset apply ho gaya 🎯 ab "Photo Banayein" dabayein');
});

/* ---------- drawing ---------- */
function drawCropped(maxDim){
  const r=getCropRect();
  const outW=Math.min(maxDim, Math.round(r.w));
  const outH=Math.max(1,Math.round(outW*r.h/r.w));
  const c=document.createElement('canvas'); c.width=outW; c.height=outH;
  c.getContext('2d').drawImage(state.img,r.x,r.y,r.w,r.h,0,0,outW,outH);
  return c;
}
function drawFull(capDim){
  const s=Math.min(1, capDim/Math.max(state.iw,state.ih));
  const c=document.createElement('canvas');
  c.width=Math.round(state.iw*s); c.height=Math.round(state.ih*s);
  c.getContext('2d').drawImage(state.img,0,0,c.width,c.height);
  return c;
}

/* corner-colour chroma key — plain background ke liye */
function changeBackground(srcCanvas,hex){
  const t=hexRGB(hex);
  const w=srcCanvas.width,h=srcCanvas.height;
  const ctx=srcCanvas.getContext('2d',{willReadFrequently:true});
  const img=ctx.getImageData(0,0,w,h);
  const d=img.data;
  // corners ka average = background reference
  const N=Math.max(2,Math.min(12,Math.round(w/80)));
  let rSum=0,gSum=0,bSum=0,n=0;
  const corners=[[0,0],[w-N-1,0],[0,h-N-1],[w-N-1,h-N-1]];
  for(const[cx,cy]of corners)for(let y=0;y<N;y++)for(let x=0;x<N;x++){
    const i=((cy+y)*w+(cx+x))*4; rSum+=d[i];gSum+=d[i+1];bSum+=d[i+2];n++;
  }
  const ref={r:rSum/n,g:gSum/n,b:bSum/n};
  const TH=52; // distance threshold
  for(let i=0;i<d.length;i+=4){
    const dr=d[i]-ref.r, dg=d[i+1]-ref.g, db=d[i+2]-ref.b;
    const dist=Math.sqrt(dr*dr+dg*dg+db*db);
    if(dist<TH*1.6){
      let a = dist<TH*0.7 ? 1 : 1-(dist-TH*0.7)/(TH*0.9); // 1 = pura bg
      a=Math.max(0,Math.min(1,a));
      d[i]  =d[i]  *(1-a)+t.r*a;
      d[i+1]=d[i+1]*(1-a)+t.g*a;
      d[i+2]=d[i+2]*(1-a)+t.b*a;
    }
  }
  ctx.putImageData(img,0,0);
  return srcCanvas;
}

/* fine-tune: brightness/contrast via ctx.filter */
function applyAdjust(src){
  const f=state.filters;
  if(f.bright===100 && f.contrast===100) return src;
  const c=document.createElement('canvas'); c.width=src.width; c.height=src.height;
  const ctx=c.getContext('2d');
  try{ ctx.filter=`brightness(${f.bright}%) contrast(${f.contrast}%)`; }catch(e){}
  ctx.drawImage(src,0,0);
  ctx.filter='none';
  return c;
}
/* signature whiten: light bg -> pure white, ink stays dark */
function whitenScan(c){
  const ctx=c.getContext('2d',{willReadFrequently:true});
  const w=c.width,h=c.height;
  const img=ctx.getImageData(0,0,w,h), d=img.data;
  for(let i=0;i<d.length;i+=4){
    const lum=0.299*d[i]+0.587*d[i+1]+0.114*d[i+2];
    let v;
    if(lum>175) v=255;
    else v=Math.max(0,Math.min(255,(lum-28)*(235/147)));
    d[i]=d[i+1]=d[i+2]=v;
  }
  ctx.putImageData(img,0,0);
  return c;
}

/* target KB tak auto compress (quality + size dono adjust) */
async function compressTo(srcCanvas,targetKB){
  let c=document.createElement('canvas');
  c.width=srcCanvas.width; c.height=srcCanvas.height;
  c.getContext('2d').drawImage(srcCanvas,0,0);
  if(targetKB===0){
    const blob=await canvasToBlob(c,'image/jpeg',0.95);
    return {blob,quality:95,canvas:c};
  }
  let q=0.95;
  for(let i=0;i<46;i++){
    const blob=await canvasToBlob(c,'image/jpeg',q);
    if(blob.size<=targetKB*1024) return {blob,quality:Math.round(q*100),canvas:c};
    if(q>0.42){ q=Math.max(0.3,q*0.82); }
    else{
      const nw=Math.max(60,Math.round(c.width*0.88));
      const nh=Math.max(60,Math.round(c.height*0.88));
      const nc=document.createElement('canvas'); nc.width=nw; nc.height=nh;
      nc.getContext('2d').drawImage(c,0,0,nw,nh);
      c=nc; q=0.85;
    }
  }
  return {blob:await canvasToBlob(c,'image/jpeg',0.3),quality:30,canvas:c};
}

/* 4x6 / A4 print sheet */
function buildSheet(base){
  const A4 = state.paper==='a4';
  const W=A4?2480:1200, H=A4?3508:1800, margin=A4?96:44, gap=A4?48:22;
  const copies=state.copies;
  const cols = A4 ? 4 : (copies<=8 ? 2 : 3);
  const rows = Math.ceil(copies/cols);
  const cellW=(W-2*margin-(cols-1)*gap)/cols;
  const cellH=(H-2*margin-(rows-1)*gap)/rows;
  const s=Math.min(cellW/base.width, cellH/base.height);
  const pw=base.width*s, ph=base.height*s;
  const c=document.createElement('canvas'); c.width=W; c.height=H;
  const ctx=c.getContext('2d');
  ctx.fillStyle='#ffffff'; ctx.fillRect(0,0,W,H);
  for(let i=0;i<copies;i++){
    const col=i%cols, row=Math.floor(i/cols);
    const x=margin+col*(cellW+gap)+(cellW-pw)/2;
    const y=margin+row*(cellH+gap)+(cellH-ph)/2;
    ctx.strokeStyle='#d5dee9'; ctx.lineWidth=A4?5:2;
    ctx.strokeRect(x,y,pw,ph);
    ctx.drawImage(base,x,y,pw,ph);
  }
  return c;
}
async function rebuildSheet(){
  if(!state.last.baseCanvas)return;
  const sc=buildSheet(state.last.baseCanvas);
  const blob=await canvasToBlob(sc,'image/png');
  if(state.sheetURL)URL.revokeObjectURL(state.sheetURL);
  state.sheetURL=URL.createObjectURL(blob);
  $('sheetPreview').src=state.sheetURL;
  $('sheetDownload').onclick=()=>{
    const a=document.createElement('a');
    a.href=state.sheetURL; a.download=state.fileName+'-print-sheet-4x6.png'; a.click();
  };
}

/* ---------- process ---------- */
processBtn.onclick=async()=>{
  if(!state.img)return;
  processBtn.disabled=true;
  const oldText=processBtn.textContent;
  processBtn.textContent='⏳ Ban raha hai…';
  try{
    let base = state.mode==='passport' ? drawCropped(state.maxDim) : drawFull(state.maxDim);
    base = applyAdjust(base);
    if(state.mode==='compress' && state.whiten==='on') whitenScan(base);
    else if(state.bg!=='none') changeBackground(base,BG_COLORS[state.bg]);
    const res=await compressTo(base,state.targetKB);

    const suffix = state.mode==='passport' ? 'passport-photo' : 'compressed';
    const name=`${state.fileName}-${suffix}${state.targetKB?'-'+state.targetKB+'kb':''}.jpg`;
    if(state.last.blobURL)URL.revokeObjectURL(state.last.blobURL);
    const blobURL=URL.createObjectURL(res.blob);
    state.last={blobURL,blob:res.blob,name,kb:res.blob.size/1024,w:res.canvas.width,h:res.canvas.height,q:res.quality,baseCanvas:base};

    /* result UI */
    $('mainCardTitle').textContent = state.mode==='passport' ? '🪪 Passport Photo' : '🗜️ Compressed Photo';
    $('mainPreview').src=blobURL;
    const dl=$('mainDownload'); dl.href=blobURL; dl.download=name;
    $('mainMeta').textContent=`${res.canvas.width}×${res.canvas.height}px • ${(res.blob.size/1024).toFixed(1)} KB • Quality ${res.quality}%`;

    const origKB=(state.fileSize/1024).toFixed(1);
    const finalKB=(res.blob.size/1024).toFixed(1);
    $('statTable').innerHTML=`
      <tr><td>Original Photo</td><td>${state.iw}×${state.ih}px • ${origKB} KB</td></tr>
      <tr><td>Final Photo</td><td>${res.canvas.width}×${res.canvas.height}px • ${finalKB} KB</td></tr>
      <tr><td>Target</td><td>${state.targetKB===0?'No limit (best quality)':state.targetKB+' KB'}</td></tr>
      <tr><td>Mode</td><td>${state.mode==='passport'?'Passport Photo':'Sirf Compress'}</td></tr>
      <tr><td>Background</td><td>${state.bg==='none'?'Original':'Changed → '+state.bg}</td></tr>
      <tr><td>Privacy</td><td>🔒 Photo device se bahar nahi gayi</td></tr>`;

    const isPassport=state.mode==='passport';
    $('sheetCard').style.display=isPassport?'':'none';
    if(isPassport) await rebuildSheet();

    pushHistory();
    showView(viewResult);
    toast('✅ Ready! Photo download karein');
  }catch(err){
    console.error(err);
    toast('Kuch error hua — dobara try karein');
  }finally{
    processBtn.disabled=false;
    processBtn.textContent=oldText;
  }
};

/* ---------- history (localStorage me save hoti hai) ---------- */
const HKEY='pm_history_v1';
function renderHistory(){
  const ul=$('historyList');
  ul.innerHTML='';
  state.history.forEach(e=>{
    const li=document.createElement('li');
    const dl = e.data ? `<a href="${e.data}" download="${e.name}">⬇ Download</a>` : `<span class="hmut">thumb</span>`;
    li.innerHTML=`<img src="${e.thumb}" alt="thumb"><div class="hinfo"><b>${e.name}</b><span>${e.w}×${e.h}px • ${e.kb.toFixed(1)} KB</span></div>${dl}`;
    ul.appendChild(li);
  });
  $('histEmpty').hidden=state.history.length>0;
}
function saveHistory(){
  try{ localStorage.setItem(HKEY, JSON.stringify(state.history)); }catch(e){ /* quota full — ignore */ }
}
function loadHistory(){
  try{
    const raw=localStorage.getItem(HKEY);
    if(raw) state.history=JSON.parse(raw)||[];
  }catch(e){ state.history=[]; }
  renderHistory();
}
function pushHistory(){
  const L=state.last;
  const entry={
    name:L.name, kb:L.kb, w:L.w, h:L.h, ts:Date.now(),
    thumb:null, data:null
  };
  const readAs=f=>new Promise(res=>{const r=new FileReader();r.onload=()=>res(r.result);r.readAsDataURL(f);});
  readAs(L.blob).then(full=>{
    entry.thumb=full;                            // chhoti file: poora data hi thumb
    if(full.length<1.2*1024*1024) entry.data=full;
    state.history.unshift(entry);
    state.history=state.history.slice(0,8);
    renderHistory(); saveHistory();
  }).catch(()=>{});
}
loadHistory();

/* ---------- actions ---------- */
$('newBtn').onclick=()=>{showView(viewUpload);};
$('backBtn').onclick=()=>{showView(viewUpload);};
$('shareBtn').onclick=async()=>{
  const L=state.last;
  try{
    const f=new File([L.blob],L.name,{type:'image/jpeg'});
    if(navigator.canShare && navigator.canShare({files:[f]})){
      await navigator.share({files:[f],title:'Passport Photo',text:'Maine apni passport photo banayi — free tool se!'});
    }else{
      const a=document.createElement('a'); a.href=L.blobURL; a.download=L.name; a.click();
      toast('Share supported nahi — download ho gaya ⬇');
    }
  }catch(e){ /* user ne cancel kiya */ }
};

/* ---------- PWA ---------- */
if('serviceWorker' in navigator && /^https?:/.test(location.protocol)){
  window.addEventListener('load',()=>navigator.serviceWorker.register('sw.js').catch(()=>{}));
}
