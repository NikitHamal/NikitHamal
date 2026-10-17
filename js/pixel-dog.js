/* <pixel-dog> v2 (+sleep/sniff patch) - site copy extracted from dogggg.html. No deps, no audio. */
/*!
 * <pixel-dog> v2 — interactive, customizable 2D pixel-art dog for nikit.is-a.dev
 * Anatomical rig (ribcage/loin/rump torso, stifle+hock hind legs), coat patterns,
 * palette-indexed renderer with silhouette shading + auto 1px outline. No deps.
 */
(() => {
'use strict';
if (customElements.get('pixel-dog')) return;

const G=76, DW=72, X0=36, M=40, GRAV=420, BDX=9.5, BDY=5.5, REACH=28.5;
let H=84;
const rand=(a,b)=>a+Math.random()*(b-a), clamp=(v,a,b)=>v<a?a:v>b?b:v, above=(y,k)=>Math.max(1,y-k);

/* ---------- colour ---------- */
const FIX={8:'15100e',9:'ffffff',10:'f28d97',11:'7a2a3a',14:'f7c948',15:'f6a28c',16:'2b2420',17:'e8505f',18:'4a4442',19:'7cbcf4',20:'d4ea5c',21:'95b02c',22:'9a7a63',23:'ddd0c0',24:'ffffff'};
const ALPHA={16:0.16,23:0.85};
const hexOk=h=>typeof h==='string'&&/^#?[0-9a-f]{6}$/i.test(h);
const toN=h=>parseInt(String(h).replace('#',''),16);
function mix(a,b,t){ const A=toN(a),B=toN(b),c=s=>Math.round(((A>>s)&255)*(1-t)+((B>>s)&255)*t); return ((c(16)<<16)|(c(8)<<8)|c(0)).toString(16).padStart(6,'0'); }
function rgba(h,a=1){ const n=toN(h); return ((Math.round(a*255)<<24)|((n&255)<<16)|(((n>>8)&255)<<8)|((n>>16)&255))>>>0; }
function buildPal(V){
  const P=new Uint32Array(40), set=(i,h,a=1)=>{ P[i]=rgba(h,a); };
  for(const k in FIX) set(k,FIX[k],ALPHA[k]??1);
  const f=V.fur,w=V.fur2,t=V.tan;
  set(1,V.outline); set(2,f); set(3,mix(f,'000000',0.28)); set(4,mix(f,'ffffff',0.2)); set(7,mix(f,'000000',0.4));
  set(5,w); set(6,mix(w,'5a6070',0.22)); set(28,mix(w,'3a4050',0.38)); set(30,mix(w,'ffffff',0.5));
  set(25,t); set(26,mix(t,'000000',0.3)); set(29,mix(t,'000000',0.42)); set(31,mix(t,'ffffff',0.2));
  set(27,V.eyes); set(12,V.collar); set(13,mix(V.collar,'000000',0.35));
  const n=toN(f), lum=(((n>>16)&255)*0.3+((n>>8)&255)*0.59+(n&255)*0.11)/255;
  set(32,lum<0.38?mix(f,'ffffff',0.55):V.outline);   // eyelid/face lines stay readable on dark coats
  set(33,'cfeaff',0.92); set(34,'ffffff');           // snot bubble + glint
  set(35,'8a6a50'); set(36,'8fa36a');                // dirt, scent specks
  return P;
}
// coat tokens: 'w' = white/cream, 't' = tan, else base fur
const tk=(m,far)=>m==='w'?(far?28:5):m==='t'?(far?29:25):(far?7:2);
const LIGHT={2:4,5:30,25:31}, SHADE={2:3,5:6,25:26};

const PATTERNS={
  tri:{muzzle:'w',blaze:'w',brows:'t',cheeks:'t',throat:'w',bib:'w',bibSide:'t',legs:'t',paws:'w',tailTip:'w'},
  urajiro:{muzzle:'w',brows:'w',cheeks:'w',throat:'w',bib:'w',belly:'w',paws:'w',tailTip:'w',inEar:'w'},
  mask:{muzzle:'w',blaze:'w',brows:'w',cheeks:'w',throat:'w',bib:'w',belly:'w',legs:'w',paws:'w',tailTip:'w',inEar:'w'},
  tuxedo:{muzzle:'w',blaze:'w',throat:'w',bib:'w',belly:'w',legs:'w',paws:'w',tailTip:'w'},
  blacktan:{muzzle:'t',brows:'t',cheeks:'t',bib:'t',legs:'t',paws:'t',inEar:'t'},
  feather:{muzzle:'w',throat:'w',bib:'w',belly:'w',tailTip:'w'},
  solid:{}
};
const BREEDS={
  bernese:{fur:'2b3445',fur2:'f3f2ee',tan:'b05a2c',eyes:'7a4a2a',collar:'d94740',outline:'0f1218',pattern:'tri',ears:'floppy',tail:'plume'},
  shiba:{fur:'d98a3d',fur2:'fbefd8',tan:'d98a3d',eyes:'3a2210',collar:'3f7fd8',outline:'3b2318',pattern:'urajiro',ears:'pointy',tail:'curl'},
  husky:{fur:'5f6a78',fur2:'f4f6f8',tan:'5f6a78',eyes:'5fb2ff',collar:'e85a6b',outline:'1c2128',pattern:'mask',ears:'pointy',tail:'saber'},
  golden:{fur:'d9a24f',fur2:'f3dba8',tan:'d9a24f',eyes:'4a2a12',collar:'2f8f6a',outline:'3d2610',pattern:'feather',ears:'floppy',tail:'plume'},
  collie:{fur:'24272e',fur2:'f4f4f2',tan:'8a5a33',eyes:'7a4a26',collar:'d94740',outline:'0e1014',pattern:'tuxedo',ears:'floppy',tail:'plume'},
  rottie:{fur:'25211f',fur2:'e8e2da',tan:'a3542a',eyes:'5a3218',collar:'d9a441',outline:'0e0c0b',pattern:'blacktan',ears:'floppy',tail:'saber'},
  lab:{fur:'6b4429',fur2:'8a5a3a',tan:'6b4429',eyes:'c08a30',collar:'3f7fd8',outline:'24150c',pattern:'solid',ears:'floppy',tail:'saber'}
};

/* ---------- raster ---------- */
const mk=(w,h)=>({w,h,b:new Uint8Array(w*h)});
let TMP=new Uint8Array(0);
function ps(L,x,y,c){ x=Math.floor(x); y=Math.floor(y); if(x<0||y<0||x>=L.w||y>=L.h) return; L.b[y*L.w+x]=c; }
function pg(L,x,y){ return (x<0||y<0||x>=L.w||y>=L.h)?0:L.b[y*L.w+x]; }
function ell(L,cx,cy,rx,ry,a,sh){
  const R=Math.max(rx,ry)+1, ca=Math.cos(a), sa=Math.sin(a), fn=typeof sh==='function';
  for(let y=Math.floor(cy-R);y<=Math.ceil(cy+R);y++) for(let x=Math.floor(cx-R);x<=Math.ceil(cx+R);x++){
    const dx=x+.5-cx, dy=y+.5-cy, u=(dx*ca+dy*sa)/rx, v=(-dx*sa+dy*ca)/ry;
    if(u*u+v*v<=1){ const c=fn?sh(u,v):sh; if(c) ps(L,x,y,c); }
  }
}
function disc(L,cx,cy,r,c){
  const fn=typeof c==='function', r2=r*r;
  for(let y=Math.floor(cy-r);y<=Math.ceil(cy+r);y++) for(let x=Math.floor(cx-r);x<=Math.ceil(cx+r);x++){
    const dx=x+.5-cx, dy=y+.5-cy; if(dx*dx+dy*dy<=r2) ps(L,x,y,fn?c(dx/r,dy/r):c);
  }
}
function tri(L,ax,ay,bx,by,cx,cy,c){
  for(let y=Math.floor(Math.min(ay,by,cy));y<=Math.ceil(Math.max(ay,by,cy));y++)
  for(let x=Math.floor(Math.min(ax,bx,cx));x<=Math.ceil(Math.max(ax,bx,cx));x++){
    const px=x+.5, py=y+.5;
    const e1=(bx-ax)*(py-ay)-(by-ay)*(px-ax), e2=(cx-bx)*(py-by)-(cy-by)*(px-bx), e3=(ax-cx)*(py-cy)-(ay-cy)*(px-cx);
    if((e1>=0&&e2>=0&&e3>=0)||(e1<=0&&e2<=0&&e3<=0)) ps(L,x,y,c);
  }
}
function limbT(L,x1,y1,x2,y2,w1,w2,cf,rear){
  const f=typeof cf==='function'?cf:()=>cf, dx=x2-x1, dy=y2-y1;
  if(Math.abs(dy)>=Math.abs(dx)){
    const n=Math.max(1,Math.round(Math.abs(dy)));
    for(let i=0;i<=n;i++){ const t=i/n, w=Math.max(1,Math.round(w1+(w2-w1)*t)), y=Math.round(y1+dy*t), xs=Math.round(x1+dx*t-w/2), c=f(t);
      for(let k=0;k<w;k++) ps(L,xs+k,y,(rear&&k===0&&SHADE[c])?SHADE[c]:c); }
  } else {
    const n=Math.max(1,Math.round(Math.abs(dx)));
    for(let i=0;i<=n;i++){ const t=i/n, w=Math.max(1,Math.round(w1+(w2-w1)*t)), x=Math.round(x1+dx*t), ys=Math.round(y1+dy*t-w/2), c=f(t);
      for(let k=0;k<w;k++) ps(L,x,ys+k,(rear&&k===w-1&&SHADE[c])?SHADE[c]:c); }
  }
}
function outline(L,tmp){
  const {w,h,b}=L; tmp.set(b);
  for(let y=0;y<h;y++) for(let x=0;x<w;x++){ const i=y*w+x; if(b[i]) continue;
    if((x>0&&b[i-1])||(x<w-1&&b[i+1])||(y>0&&b[i-w])||(y<h-1&&b[i+w])) tmp[i]=1; }
  b.set(tmp);
}
function shadePass(L){ // silhouette lighting: rim-light on top edges, shade on bottom edges
  const {w,h,b}=L; TMP.set(b);
  for(let i=0;i<b.length;i++){ const c=b[i], li=LIGHT[c]; if(li===undefined) continue; const y=(i/w)|0;
    if(y>0&&b[i-w]===0) TMP[i]=li; else if(y<h-1&&b[i+w]===0) TMP[i]=SHADE[c]; }
  b.set(TMP);
}

/* ---------- sprites & font ---------- */
const SMAP={r:17,w:9,y:14,b:19};
const HEART=['rr.rr','rwrrr','.rrr.','..r..'], PLUS=['.y.','yyy','.y.'], DOT=['y'], DROP=['.b.','bwb','bbb','.b.'];
const ZS=['XXXX','..X.','.X..','XXXX'], ZB=['XXXXX','...X.','..X..','.X...','XXXXX'];
const BANG=['XX','XX','XX','XX','..','XX'], QM=['.XX.','X..X','...X','..X.','....','..X.'];
const FONT={A:['.X.','X.X','XXX','X.X','X.X'],B:['XX.','X.X','XX.','X.X','XX.'],C:['.XX','X..','X..','X..','.XX'],
  D:['XX.','X.X','X.X','X.X','XX.'],E:['XXX','X..','XX.','X..','XXX'],F:['XXX','X..','XX.','X..','X..'],
  H:['X.X','X.X','XXX','X.X','X.X'],I:['XXX','.X.','.X.','.X.','XXX'],K:['X.X','X.X','XX.','X.X','X.X'],
  M:['X...X','XX.XX','X.X.X','X...X','X...X'],N:['X..X','XX.X','X.XX','X..X','X..X'],O:['.X.','X.X','X.X','X.X','.X.'],
  P:['XX.','X.X','XX.','X..','X..'],R:['XX.','X.X','XX.','X.X','X.X'],S:['.XX','X..','.X.','..X','XX.'],
  U:['X.X','X.X','X.X','X.X','XXX'],W:['X...X','X...X','X.X.X','X.X.X','.X.X.'],Y:['X.X','X.X','.X.','.X.','.X.'],
  '!':['X','X','X','.','X'],'?':['XX.','..X','.X.','...','.X.']};
function spr(L,rows,x,y){ rows.forEach((r,j)=>{ for(let i=0;i<r.length;i++){ const c=SMAP[r[i]]; if(c) ps(L,x+i,y+j,c); } }); }
function glyph(L,rows,x,y,c){ rows.forEach((r,j)=>{ for(let i=0;i<r.length;i++) if(r[i]!=='.') ps(L,x+i,y+j,c); }); }
function textW(s){ let w=0; for(const ch of s) w+=(FONT[ch]?FONT[ch][0].length:2)+1; return w-1; }
function text(L,s,x,y,c){ for(const ch of s){ const g=FONT[ch]; if(!g){ x+=3; continue; } glyph(L,g,x,y,c); x+=g[0].length+1; } }
function bubble(L,s,cx,by){
  const w=textW(s)+4, h=9, x0=clamp(Math.round(cx-w/2),0,L.w-w), y0=Math.max(0,by-h);
  for(let y=0;y<h;y++) for(let x=0;x<w;x++){
    if((x===0||x===w-1)&&(y===0||y===h-1)) continue;
    ps(L,x0+x,y0+y,(x===0||y===0||x===w-1||y===h-1)?1:24);
  }
  const tx=clamp(Math.round(cx),x0+2,x0+w-3), yb=y0+h;
  ps(L,tx,yb-1,24); ps(L,tx-1,yb,1); ps(L,tx,yb,24); ps(L,tx+1,yb,1); ps(L,tx,yb+1,1);
  text(L,s,x0+2,y0+2,1);
}
function ballAt(L,x,y){ disc(L,x,y,2.4,(u,v)=>(u<-0.15&&v<-0.15&&u>-0.75&&v>-0.75)?9:(v>0.35||u>0.5)?21:20); }

/* ---------- anatomy ---------- */
const TAILS={
  curl:{p:[[0,0],[-5,-6],[0,-12.5],[6,-8.5]],r:[3,1.9],bulge:0,lay:-0.5,up:0,wrap:1.6},
  plume:{p:[[0,0],[-4,3],[-6,10],[-4,16]],r:[3.1,2.3],bulge:0.9,lay:1.1,up:1.9,wrap:-1.6},
  saber:{p:[[0,0],[-5,-1],[-10,-4],[-13,-9]],r:[2.6,1.4],bulge:0,lay:-1.0,up:-0.25,wrap:2.6}
};
function torso(L,P,V){
  const [cx,cy,len,dep,a]=P.b, ca=Math.cos(a), sa=Math.sin(a), s=len/10, d=dep/6, up=P.belly>0.5, bel=tk(V.m.belly);
  const R=(x,y)=>[X0+cx+x*ca-y*sa, G+cy+x*sa+y*ca];
  const under=th=>(u,v)=>(up?v<-th:v>th)?bel:2;
  let p=R(-10*s,0);   ell(L,p[0],p[1],6*s+0.5,6*d,a,up?under(0.5):2);      // rump
  p=R(-3*s,-0.5*d);   ell(L,p[0],p[1],7*s+0.5,5*d,a,under(0.5));           // loin (tuck-up)
  p=R(6*s,1*d);       ell(L,p[0],p[1],8.5*s,7*d,a,under(0.68));            // deep ribcage
}
function tail(L,P,V){
  const T=TAILS[V.tail]||TAILS.plume, tl=P.tl, a=tl[2]+(tl[3]||0)*T.lay+(tl[4]||0)*T.up+(tl[5]||0)*T.wrap;
  const ca=Math.cos(a), sa=Math.sin(a), bx=X0+tl[0], by=G+tl[1], q=T.p.map(([x,y])=>[bx+x*ca-y*sa, by+x*sa+y*ca]);
  const tip=V.m.tailTip?tk(V.m.tailTip):2;
  for(let i=0;i<=20;i++){ const t=i/20, m=1-t, k0=m*m*m, k1=3*m*m*t, k2=3*m*t*t, k3=t*t*t;
    disc(L,k0*q[0][0]+k1*q[1][0]+k2*q[2][0]+k3*q[3][0], k0*q[0][1]+k1*q[1][1]+k2*q[2][1]+k3*q[3][1],
      T.r[0]+(T.r[1]-T.r[0])*t+Math.sin(Math.PI*t)*T.bulge, t>0.74?tip:2); }
}
function leg(L,l,far,back,V){
  const m=V.m, base=far?7:2, lt=m.legs?tk(m.legs,far):base, pt=m.paws?tk(m.paws,far):lt;
  const hx=X0+l[0], hy=G+l[1], kx=X0+l[2], ky=G+l[3], fx=X0+l[4], fy=G+l[5];
  let pts;
  if(back){ // hip → stifle → hock (auto) → paw ; l[7] scales the hock bend (0 = straight, for sploot)
    const dx=fx-kx, dy=fy-ky, len=Math.hypot(dx,dy)||1, hk=(l[7]==null?1:l[7])*2.4;
    pts=[[hx,hy,5.5],[kx,ky,4.2],[kx+dx*0.58-dy/len*hk, ky+dy*0.58+dx/len*hk,3.2],[fx,fy,3]];
  } else pts=[[hx,hy,4.6],[kx,ky,3.4],[fx,fy,3]]; // elbow → wrist → paw
  const mark=(s,t)=>back?(s===2||(s===1&&t>0.45)):(s===1||(s===0&&t>0.55));
  if(l[6]) for(let s=1;s<pts.length-1;s++){ const A=pts[s],B=pts[s+1]; limbT(L,A[0],A[1],B[0],B[1],A[2]+2,B[2]+2,1,0); }
  for(let s=0;s<pts.length-1;s++){ const A=pts[s],B=pts[s+1]; limbT(L,A[0],A[1],B[0],B[1],A[2],B[2],t=>mark(s,t)?lt:base,!far); }
  const A=pts[pts.length-2], dx=fx-A[0], dy=fy-A[1];
  if(Math.abs(dy)>=Math.abs(dx)){
    const xs=Math.round(fx-1.5), yb=Math.round(fy), d=dy>=0?-1:1;
    for(let k=0;k<3;k++){ ps(L,xs+k,yb,pt); ps(L,xs+k,yb+d,pt); }
    if(dy>=0) ps(L,xs+3,yb,pt);
  } else {
    const ys=Math.round(fy-1.5), xe=Math.round(fx), s=Math.sign(dx);
    for(let k=0;k<3;k++){ ps(L,xe,ys+k,pt); ps(L,xe-s,ys+k,pt); }
  }
}
function bib(L,P,V){
  const m=V.m, x=X0+P.ch[0], y=G+P.ch[1], a=P.b[4]*0.4;
  if(m.bibSide) ell(L,x-0.5,y,4.6,6.6,a,tk(m.bibSide));
  if(m.bib) ell(L,x+0.3,y-0.5,3.3,5.8,a,tk(m.bib));
}
function neck(L,P,V){
  const ax=X0+P.ne[0], ay=G+P.ne[1], dx=X0+P.hd[0]-2-ax, dy=G+P.hd[1]+2-ay, len=Math.hypot(dx,dy)||1;
  let nx=-dy/len, ny=dx/len; if(nx<0){ nx=-nx; ny=-ny; }
  const th=V.m.throat?tk(V.m.throat):2;
  for(let i=0;i<=12;i++){ const t=i/12; disc(L,ax+dx*t,ay+dy*t,5-t*1.2,(u,v)=>(u*nx+v*ny>0.3)?th:2); }
  return {ax,ay,dx,dy,len,nx,ny};
}
function collar(L,N){
  const {ax,ay,dx,dy,len,nx,ny}=N, ux=dx/len, uy=dy/len, tc=len*0.3;
  for(let y=Math.floor(Math.min(ay,ay+dy)-7);y<=Math.max(ay,ay+dy)+7;y++)
  for(let x=Math.floor(Math.min(ax,ax+dx)-7);x<=Math.max(ax,ax+dx)+7;x++){
    const px=x+.5-ax, py=y+.5-ay, al=px*ux+py*uy, pe=px*nx+py*ny, r=5.5-(al/len)*1.2;
    if(Math.abs(pe)>r) continue; const d=al-tc;
    if(d>-1.3&&d<=0) ps(L,x,y,13); else if(d>0&&d<1.3) ps(L,x,y,12);
  }
  const r=5.3, tx=ax+ux*(tc-0.5)+nx*r, ty=ay+uy*(tc-0.5)+ny*r; ps(L,tx,ty,14); ps(L,tx,ty+1,14);
}
function eye(L,x,y,t){
  const ln=32;
  switch(t){
    case 'blink': ps(L,x,y+1,ln); ps(L,x+1,y+1,ln); break;
    case 'half': ps(L,x,y,ln); ps(L,x+1,y,ln); ps(L,x,y+1,27); ps(L,x+1,y+1,8); break;
    case 'happy': ps(L,x-1,y+1,ln); ps(L,x,y,ln); ps(L,x+1,y,ln); ps(L,x+2,y+1,ln); break;
    case 'closed': ps(L,x-1,y,ln); ps(L,x,y+1,ln); ps(L,x+1,y+1,ln); ps(L,x+2,y,ln); break;
    case 'squeeze': ps(L,x-1,y-1,ln); ps(L,x,y,ln); ps(L,x+1,y,ln); ps(L,x-1,y+1,ln); break;
    case 'wide': ps(L,x,y-1,8); ps(L,x+1,y-1,9); ps(L,x,y,27); ps(L,x+1,y,8); ps(L,x,y+1,8); ps(L,x+1,y+1,8); break;
    case 'x': ps(L,x-1,y-1,ln); ps(L,x+1,y-1,ln); ps(L,x,y,ln); ps(L,x-1,y+1,ln); ps(L,x+1,y+1,ln); break;
    case 'love': ps(L,x-1,y-1,17); ps(L,x+1,y-1,17); ps(L,x-1,y,17); ps(L,x,y,17); ps(L,x+1,y,17); ps(L,x,y+1,17); break;
    default: ps(L,x,y,8); ps(L,x+1,y,9); ps(L,x,y+1,27); ps(L,x+1,y+1,8);
  }
}
function mouth(L,hx,hy,t,jc){
  if(t==='blep'){ ps(L,hx+7,hy+4,1); ps(L,hx+6,hy+3,1); ps(L,hx+8,hy+5,10); ps(L,hx+9,hy+5,10); ps(L,hx+8,hy+6,10); ps(L,hx+9,hy+6,10); return; }
  if(t==='closed'){ ps(L,hx+9,hy+4,1); ps(L,hx+8,hy+4,1); ps(L,hx+7,hy+4,1); ps(L,hx+6,hy+3,1); return; }
  if(t==='pant'){ ell(L,hx+7,hy+5.6,3.6,1.5,0,jc); for(let x=hx+5;x<=hx+9;x++) ps(L,x,hy+4,11);
    for(let y=5;y<=7;y++){ ps(L,hx+7,hy+y,10); ps(L,hx+8,hy+y,10); } return; }
  if(t==='bark'){ ell(L,hx+7,hy+6.6,3.8,1.5,0,jc); for(let x=hx+4;x<=hx+10;x++) ps(L,x,hy+4,11);
    for(let x=hx+5;x<=hx+10;x++) ps(L,x,hy+5,11); ps(L,hx+6,hy+5,10); ps(L,hx+7,hy+5,10); return; }
  if(t==='yawn'){ ell(L,hx+6.5,hy+7.8,3.8,1.6,0,jc); for(let x=hx+4;x<=hx+10;x++){ ps(L,x,hy+4,11); ps(L,x,hy+5,11); }
    for(let x=hx+5;x<=hx+9;x++) ps(L,x,hy+6,11); for(let x=hx+5;x<=hx+8;x++) ps(L,x,hy+6,10); }
}
function head(L,hx,hy,P,V){
  const m=Math.round(P.muz||0), E=P.ears, K=V.m, mz=K.muzzle?tk(K.muzzle):2, pointy=V.ears==='pointy';
  if(pointy) tri(L,hx-7,hy-3,hx-2,hy-4.5,hx-5.5+E[2],hy-12+E[3],7);
  else ell(L,hx-5.5+E[2]*0.3,hy-0.5+E[3]*0.2,2.4,4.2,0.3,7);
  ell(L,hx,hy,6.5,5.5,0,(u,v)=>(K.blaze&&u>0.42&&u<0.95&&v<0.3)?tk(K.blaze):2);       // skull + blaze
  ell(L,hx+2.5,hy+3.2,4.6,2.5,0,K.cheeks?tk(K.cheeks):2);                             // cheek / jaw
  ell(L,hx+6.3,hy+2.5+m,4.4,3,0,mz);                                                   // muzzle
  mouth(L,hx,hy+m,P.mouth,mz);
  if(pointy){
    tri(L,hx-3.5,hy-4,hx+2,hy-5,hx-0.5+E[0],hy-12.5+E[1],2);
    tri(L,hx-2,hy-5,hx+0.8,hy-5.4,hx-0.6+E[0]*0.8,hy-10+E[1]*0.8,K.inEar?SHADE[tk(K.inEar)]:3);
  } else {
    const ex=hx-2.5+E[0]*0.5, ey=hy+0.5+E[1]*0.3, ea=0.25-E[0]*0.12;
    ell(L,ex,ey,3.6,6,ea,1); ell(L,ex,ey,2.7,5.1,ea,(u,v)=>v>0.75?3:2);                // drop ear
  }
  if(K.brows){ const c=tk(K.brows); ps(L,hx+3,hy-4,c); ps(L,hx+4,hy-4,c); }
  eye(L,hx+3,hy-2+Math.round(P.eyeDy||0),P.eye);
  ps(L,hx+9,hy+1+m,18); ps(L,hx+10,hy+1+m,8); ps(L,hx+9,hy+2+m,8); ps(L,hx+10,hy+2+m,8);
  if(P.blush>0.5){ ps(L,hx+2,hy+1,15); ps(L,hx+3,hy+1,15); }
  if(P.mouth==='ball') ballAt(L,hx+BDX,hy+BDY+m);
}
function drawDog(L,P,V){
  L.b.fill(0); const lg=P.legs, wrap=(P.tl[5]||0)>0.5;
  leg(L,lg[0],1,1,V); leg(L,lg[1],1,0,V);
  torso(L,P,V); if(!wrap) tail(L,P,V);
  ell(L,X0+P.th[0],G+P.th[1],P.th[2],P.th[2]*1.1,0,(u,v)=>(u*u+v*v>0.6&&u>0.2&&v>-0.3)?3:2);
  bib(L,P,V);
  leg(L,lg[2],0,1,V); leg(L,lg[3],0,0,V);
  if(wrap) tail(L,P,V);                       // curled-up: tail wraps in front of the body
  collar(L,neck(L,P,V));
  head(L,Math.round(X0+P.hd[0]),Math.round(G+P.hd[1]),P,V);
  shadePass(L);
}

/* ---------- pose rig ---------- */
function lp(a,b,k){
  if(typeof b==='number') return typeof a==='number'?a+(b-a)*k:b*k;
  if(Array.isArray(b)) return b.map((v,i)=>lp(Array.isArray(a)?a[i]:undefined,v,k));
  return b;
}
function lerpPose(a,b,k){ const o={}; for(const key in b) o[key]=lp(a?a[key]:undefined,b[key],k); return o; }
function cp(p){ return lerpPose(p,p,0); }
const mkPose=o=>Object.assign(cp({ears:[0,0,0,0],muz:0,eyeDy:0,belly:0,blush:0,eye:'open',mouth:'closed'}),o);
// b:[cx,cy,length,depth,angle]  legs:[farBack,farFront,nearBack,nearFront] each [hipX,hipY,kneeX,kneeY,footX,footY,(ink)]
// tl:[x,y,angle,lay,up]
const STAND=mkPose({b:[-2,-21,10,6,0],th:[-11,-18,5],ne:[11,-27],ch:[10,-18],hd:[16,-34],tl:[-17,-24,0,0,0],
  legs:[[-15,-19,-12,-11,-16,0],[2,-16,2,-5,3,0],[-11,-19,-8,-11,-12,0],[7,-16,7,-5,8,0]]});
const SIT=mkPose({b:[-4,-14,11,6,-0.9],th:[-8,-6,5.5],ne:[6,-29],ch:[5,-19],hd:[11,-38],tl:[-13,-5,0,1,0],
  legs:[[-12,-8,-6,-4,-3,0],[0.5,-14,0.5,-5,1.5,0],[-9,-8,-3,-4,0,0],[4.5,-14,4.5,-5,5.5,0]]});
const LIE=mkPose({b:[-2,-8,10,5.5,0],th:[-10,-5.5,5],ne:[12,-15],ch:[10,-7],hd:[17,-21],tl:[-17,-10,0,1,0],
  legs:[[-14,-9,-8,-4,-6,-2],[5,-5,10,-3,16,-2],[-11,-8,-5,-3,-3,-1],[8,-4,13,-2,19,-1]]});
const BOW=mkPose({b:[-2,-17,10,6,0.35],th:[-11,-18,5],ne:[12,-15],ch:[10,-10],hd:[17,-19],tl:[-17,-25,0,0,1],
  legs:[[-15,-19,-12,-11,-16,0],[3,-8,8,-3,14,-2],[-11,-19,-8,-11,-12,0],[6,-8,11,-2,17,-1]]});
const ROLL=mkPose({b:[-1,-9,10,5.5,0],th:[-10,-10,4.5],ne:[11,-9],ch:[9,-12],hd:[17,-9],tl:[-17,-7,0,1,0],
  legs:[[-14,-13,-12,-18,-14,-22],[2,-13,3,-18,4,-21],[-10,-13,-7,-18,-9,-22],[6,-13,8,-18,9,-22]],
  belly:1,eye:'happy',mouth:'pant',ears:[-3,3,-3,3]});
const JUMP=Object.assign(cp(STAND),{tl:[-17,-24,0,0,0.6],
  legs:[[-15,-19,-18,-13,-24,-9],[2,-16,6,-10,9,-9],[-11,-19,-14,-13,-20,-9],[7,-16,11,-10,14,-9]]});
const PICK=Object.assign(cp(STAND),{ne:[13,-17],hd:[19,-8],ears:[1,0,0,0]});
const SLEEP=mkPose({b:[-3,-9,7.5,6.8,0],th:[-8,-6.5,5.5],ne:[7,-10],ch:[7,-6],hd:[13,-8.5],tl:[-12,-10,0,0,0,1],
  legs:[[-10,-6,-5,-3,-1,-1],[1,-5,6,-3,11,-2],[-8,-6,-2,-3,2,-1],[3,-4,8,-2,13,-1]],
  eye:'closed',ears:[-1,1.5,-1,1.5]});                                   // curled "loaf"
const SLEEP_BELLY=Object.assign(cp(ROLL),{hd:[17,-8],eye:'closed',mouth:'pant',ears:[-3,4,-3,4],
  legs:[[-14,-13,-16,-19,-15,-23],[2,-13,5,-19,8,-18],[-10,-13,-7,-20,-6,-24],[6,-13,9,-19,12,-18]]}); // belly-up, limp paws
const SLEEP_SPLOOT=mkPose({b:[-3,-5.5,10.5,4.6,0],th:[-11,-4,4.5],ne:[12,-6],ch:[8,-4],hd:[18,-6],tl:[-15,-8,0,0,1],
  legs:[[-11,-4,-16,-3,-22,-2,0,0],[3,-3,7,-2,10,-2],[-12,-3,-17,-1.5,-24,-1,0,0],[5,-3,8,-1,12,-1]],
  eye:'closed',mouth:'blep',ears:[0.5,1,0,1]});   // belly flat, back legs straight out, chin on the floor
const SNIFF=Object.assign(cp(STAND),{b:[-2,-20,10,6,0.07],ne:[14,-15],hd:[20,-7],ch:[10,-16],muz:1,
  ears:[1,0.5,0.5,0.5],tl:[-17,-25,0,0,0.85]});                          // nose on the ground, tail up
const DIG=Object.assign(cp(BOW),{hd:[18,-14],ne:[12,-13],muz:1,ears:[1,0,1,0],tl:[-17,-25,0,0,1],
  legs:[[-15,-19,-12,-11,-16,0],[4,-9,8,-5,12,-1],[-11,-19,-8,-11,-12,0],[7,-9,11,-5,15,-1]]});
const WALK_PH=[Math.PI,Math.PI*1.5,0,Math.PI*0.5], RUN_PH=[0.5,Math.PI+0.5,0,Math.PI];
function gait(P,ph,amp,lift,phs){
  P.legs.forEach((l,i)=>{ const p=ph+phs[i], dx=Math.sin(p)*amp, up=Math.max(0,Math.cos(p))*lift;
    l[4]+=dx; l[5]-=up; l[2]+=dx*0.5; l[3]-=up*0.6; });
}
const PETTABLE=new Set(['idle','sit','lie','walk','look','sniff','scratch','stretch','shake','bow','bark']);
const SLEEPABLE=new Set(['idle','sit']);
const WORDS=['WOOF!','ARF!','BORK!','WOOF!','YIP!'];
const fading=p=>p.life>p.max*0.72&&Math.floor(p.life*18)%2===0;

/* ---------- component ---------- */
class PixelDog extends HTMLElement{
  static get observedAttributes(){ return ['breed','fur','fur2','tan','eyes','collar','outline','ears','tail','pattern']; }
  attributeChangedCallback(){ if(this._on) this.applyLook(); }
  applyLook(){
    const a=n=>this.getAttribute(n), B=BREEDS[(a('breed')||'').toLowerCase()]||BREEDS.bernese, V=Object.assign({},B);
    for(const k of ['fur','fur2','tan','eyes','collar','outline']) if(hexOk(a(k))) V[k]=a(k).replace('#','');
    if(hexOk(a('fur'))&&!hexOk(a('outline'))) V.outline=mix(V.fur,'000000',0.72);
    if(a('ears')==='pointy'||a('ears')==='floppy') V.ears=a('ears');
    if(TAILS[a('tail')]) V.tail=a('tail');
    if(PATTERNS[a('pattern')]) V.pattern=a('pattern');
    V.m=PATTERNS[V.pattern]||{}; this.V=V; this.pal=buildPal(V);
  }
  setLook(o={}){ for(const k in o){ if(o[k]==null) this.removeAttribute(k); else this.setAttribute(k,o[k]); } }
  connectedCallback(){
    if(this._on) return; this._on=true;
    this.free=this.hasAttribute('fixed');
    const sc=this.sc=Math.max(1,parseFloat(this.getAttribute('scale'))||2);
    let W=this.free?Math.max(160,Math.ceil(innerWidth/sc)):Math.max(120,parseInt(this.getAttribute('width'))||180);
    if(this.free){ H=Math.max(120,Math.ceil(innerHeight/sc)); }
    else { H=84; const fw=this.measureRow(); if(fw) W=fw; }
    this.W=W;
    this.applyLook();
    const root=this.shadowRoot||this.attachShadow({mode:'open'});
    root.innerHTML=`<style>
:host{display:inline-block;line-height:0;vertical-align:bottom;max-width:100%;user-select:none;-webkit-user-select:none;-webkit-tap-highlight-color:transparent}
:host([fixed]){position:fixed;left:0;top:var(--dog-top,0px);z-index:30;pointer-events:none;max-width:none}
:host([fixed]) canvas{pointer-events:none}
:host([fixed]) canvas:focus-visible{outline:none}
canvas{width:${W*sc}px;max-width:100%;height:auto;image-rendering:pixelated;image-rendering:crisp-edges;touch-action:pan-y;cursor:pointer;outline:none;border-radius:4px}
canvas:focus-visible{outline:none}</style>
<canvas width="${W}" height="${H}" tabindex="0" role="img" aria-label="Interactive pixel dog. Click him to boop, hold or rub to pet, drag to carry, double-click to send home to sleep, click open space to throw a ball from there."></canvas>`;
    const cv=this.cv=root.querySelector('canvas');
    this.ctx=cv.getContext('2d'); this.alloc();
    Object.assign(this,{time:0,lastAct:0,parts:[],rub:0,lastRub:-9,clicks:[],turnT:0,blinkT:2,blinkOn:0,twT:5,twOn:0,
      excite:0,exT:-99,landed:0,down:null,ct:0,last:null,lastPick:''});
    this.ptr={x:0,y:0,t:-99,ok:false,sp:0}; this.hov={x:-99,y:-99}; this.dv={x:0,z:0};
    this.ball={on:false,held:false,x:0,y:0,vx:0,vy:0};
    this.home=clamp(parseFloat(this.getAttribute('home'))||M+6,M,W-M);
    this.minX=M; // left fence: raised to the name's last letter in free mode
    if(this.free){ this.placeFixed(); this.syncHome(); }
    this.reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
    const hr=new Date().getHours(), sa=parseFloat(this.getAttribute('sleep-after'));
    this.sleepAfter=(sa>0)?sa:((hr>=22||hr<6)?16:38);
    this.d={x:this.home,z:0,vz:0,vx:0,f:1,st:'sit',t:0,data:{},sq:0,sqv:0};
    const st=this.getAttribute('start'), s0=st==='sleep'?'sleep':st==='lie'?'lie':'sit';
    this.pose=cp(s0==='sleep'?SLEEP:s0==='lie'?LIE:SIT);
    this.go(s0,{dur:rand(3,6)});
    this.bind();
    this.visible=true;
    if('IntersectionObserver' in window){ this.io=new IntersectionObserver(es=>{ this.visible=es[0].isIntersecting; }); this.io.observe(cv); }
    if(this.free){
      let rto=0;
      this._rz=()=>{ clearTimeout(rto); rto=setTimeout(()=>{
        const oW=this.W;
        this.W=Math.max(160,Math.ceil(innerWidth/this.sc));
        H=Math.max(120,Math.ceil(innerHeight/this.sc));
        this.home=clamp(this.home*this.W/Math.max(1,oW),M,this.W-M);
        this.minX=clamp(this.minX,M,this.W-M);
        this.d.x=this.clampX(this.d.x);
        this.ball.x=clamp(this.ball.x,4,this.W-4);
        this.placeFixed(); this.reHome();
        this.alloc();
      },250); };
      window.addEventListener('resize',this._rz);
      let sto=0;
      this._sc=()=>{ if(sto) return; sto=setTimeout(()=>{ sto=0; this.syncHome(); },300); };
      window.addEventListener('scroll',this._sc,{passive:true});
      // Webfonts can widen the name after first paint (text grows under a
      // placed dog) — re-pin ground+home once type settles.
      if(document.fonts&&document.fonts.ready) document.fonts.ready.then(()=>{ if(this._on) this.reHome(); });
    }
    else{
      let fto=0;
      this._fr=()=>{ clearTimeout(fto); fto=setTimeout(()=>{ if(this._on) this.fitRow(); },200); };
      window.addEventListener('resize',this._fr);
      if(document.fonts&&document.fonts.ready) document.fonts.ready.then(()=>{ if(this._on) this.fitRow(); });
    }
    requestAnimationFrame(()=>{ if(this._on) this.fitRow(); });
    this._loop=this.loop.bind(this); this.raf=requestAnimationFrame(this._loop);
  }
  disconnectedCallback(){ cancelAnimationFrame(this.raf); window.removeEventListener('pointermove',this._wm); document.removeEventListener('click',this._docClick); if(this._docDown){ document.removeEventListener('pointerdown',this._docDown); document.removeEventListener('pointermove',this._docMove); document.removeEventListener('pointerup',this._docUp); document.removeEventListener('pointercancel',this._docUp); } if(this._rz) window.removeEventListener('resize',this._rz); if(this._sc) window.removeEventListener('scroll',this._sc); if(this._fr) window.removeEventListener('resize',this._fr); if(this.io) this.io.disconnect(); clearTimeout(this.ct); this._on=false; }

  /* ----- input ----- */
  bind(){
    const cv=this.cv;
    const toL=e=>{ const r=cv.getBoundingClientRect(); return {x:(e.clientX-r.left)/r.width*this.W, y:(e.clientY-r.top)/r.height*H}; };
    this._wm=e=>{
      const p=toL(e), pt=this.ptr, dt=Math.max(0.016,this.time-pt.t);
      pt.sp=Math.hypot(p.x-pt.x,p.y-pt.y)/dt; pt.x=p.x; pt.y=p.y; pt.t=this.time; pt.ok=true;
      if(Math.abs(p.x-this.d.x)<55&&p.y>-30&&p.y<H+20){ this.act(); if(pt.sp>260) this.excite+=1; }
    };
    window.addEventListener('pointermove',this._wm,{passive:true});
    // Throw zone (free mode: no box, canvas IS the viewport):
    //   left  = 8px right of the name's last letter (name itself excluded),
    //           or the canvas edge when tapping below the name (wrapped
    //           mobile line: the full band throws, even left of the name),
    //   right = the line exactly below the theme toggle,
    //   bottom = his feet (above-feet clicks only, like before).
    // Clicks outside are ignored completely: no wake, no timer reset, no
    // throw. Only a press on his own body (press/up) wakes him.
    this._docClick=e=>{
      if(e.button>0||e.defaultPrevented||!this.pageTargetOk(e)) return;
      const p=toL(e);
      if(this.hit(p.x,p.y)) return; // presses on the dog itself are handled via press/up, not here
      if(this.time<(this.noThrowUntil||0)) return;
      const s=this.d.st;
      if(s==='sleep'||s==='drag'||s==='fall'||s==='dizzy') return; // a ball never wakes him — only his body does
      const c=this.cv.getBoundingClientRect();
      let L=c.left+(this.d.x-70)*this.sc, R=innerWidth; // fallbacks when anchors off-screen
      const nEl=document.querySelector('.profile-name');
      if(nEl){ const n=nEl.getBoundingClientRect(); if(n.bottom>-50&&n.top<innerHeight+50) L=e.clientY>n.bottom?c.left+8:n.right+8; }
      const tEl=document.querySelector('.theme-toggle');
      if(tEl){ const t=tEl.getBoundingClientRect(); R=t.left+t.width/2; }
      if(e.clientX<L||e.clientX>R) return;
      if(p.y>G-2) return; // below his feet: don't bother him
      Object.assign(this.ptr,{x:clamp(p.x,0,this.W),y:clamp(p.y,0,H),t:this.time,ok:true});
      this.act();
      this.throwBall(p.x,Math.min(p.y,G-3));
    };
    document.addEventListener('click',this._docClick);
    cv.addEventListener('pointerdown',e=>{
      if(e.button>0) return;
      this.press(toL(e),e.pointerId);
    });
    cv.addEventListener('pointermove',e=>this.moveAt(toL(e)));
    cv.addEventListener('pointerup',e=>this.upAt(e,false));
    cv.addEventListener('pointercancel',e=>this.upAt(e,true));
    cv.addEventListener('contextmenu',e=>e.preventDefault());
    // Forward presses on the dog's own pixels from the document. (The canvas
    // is pointer-events:none, so all interaction arrives via these.)
    this._docDown=e=>{
        if(e.button>0||e.defaultPrevented||!this.pageTargetOk(e)) return;
        const p=toL(e);
        if(this.hit(p.x,p.y)){ if(e.cancelable) e.preventDefault(); this.press(p,e.pointerId); }
      };
      this._docMove=e=>{
        if(this.down){ this.moveAt(toL(e)); return; }
        if(e.buttons) return; // dragging/selecting elsewhere: ignore
        const p=toL(e);
        if(this.hit(p.x,p.y)) this.rubMove(p);
        this.hov.x=p.x; this.hov.y=p.y;
      };
      this._docUp=e=>{ if(this.down) this.upAt(e,e.type==='pointercancel'); };
      document.addEventListener('pointerdown',this._docDown);
      document.addEventListener('pointermove',this._docMove);
      document.addEventListener('pointerup',this._docUp);
      document.addEventListener('pointercancel',this._docUp);
    cv.addEventListener('keydown',e=>{
      const k=e.key.toLowerCase(), d=this.d; this.act(); if(d.st==='drag') return;
      if(k==='arrowleft'||k==='arrowright'){ const dir=k==='arrowleft'?-1:1; this.go('walk',{tx:clamp(d.x+dir*30,M,this.W-M),sp:24}); e.preventDefault(); return; }
      const map={' ':'jump',b:'bark',s:'sit',d:'lie',r:'roll',z:'sleep',f:'fetch',p:'pet'};
      if(map[k]){ this.trigger(map[k]); e.preventDefault(); }
    });
  }
  pageTargetOk(e){
    const t=e.target; if(!(t&&t.closest)) return false;
    if(t.closest('pixel-dog')) return false;
    if(t.closest('a,button,input,select,textarea,label,dialog,.minimal-modal,[data-close]')) return false;
    if(t.closest('.minimal-footer')) return false;
    if(t.closest('#pond')) return false;
    if(t.closest('#avatarContainer')) return false;
    return true;
  }
  press(p,pid){
    this.act(); Object.assign(this.ptr,{x:p.x,y:p.y,t:this.time,ok:true});
    if(this.hit(p.x,p.y)){
      if(this.d.st==='fall') return;
      this.down={x:p.x,y:p.y,t:this.time,x0:this.d.x,z0:this.d.z,drag:false,pet:false};
      if(pid!=null){ try{ this.cv.setPointerCapture(pid); }catch(_){} }
      this.cv.style.cursor='grabbing';
    } else {
      const b=this.ball;
      if(this.d.st==='sleep') this.go('wake');
      else if(b.on&&!b.held&&Math.hypot(p.x-b.x,p.y-b.y)<5) this.kickBall(p.x); else this.throwBall(p.x,p.y);
    }
  }
  moveAt(p){
    const cv=this.cv, dn=this.down;
    if(dn){ if(!dn.drag&&!dn.pet&&Math.hypot(p.x-dn.x,p.y-dn.y)>2.5){ dn.drag=true; this.go('drag'); } else if(dn.pet) this.rubMove(p); }
    else if(!this.free){ const h=this.hit(p.x,p.y); cv.style.cursor=h?'grab':'pointer'; if(h) this.rubMove(p); }
    this.hov.x=p.x; this.hov.y=p.y;
  }
  upAt(e,cancel){
    const dn=this.down; if(!dn) return; this.down=null;
    try{ this.cv.releasePointerCapture(e.pointerId); }catch(_){}
    this.cv.style.cursor='grab';
    if(dn.drag){ this.noThrowUntil=this.time+0.35; this.release(); }
    else if(!dn.pet&&!cancel) this.click();
  }
  rubMove(p){ const dd=Math.hypot(p.x-this.hov.x,p.y-this.hov.y); if(dd<6) this.rub+=dd; if(this.rub>14) this.lastRub=this.time; this.act(); }
  hit(px,py){
    const d=this.d, lx=X0+d.f*(Math.floor(px)-Math.round(d.x)), ly=Math.floor(py)+Math.round(d.z);
    for(let j=-1;j<=1;j++) for(let i=-1;i<=1;i++) if(pg(this.D,lx+i,ly+j)) return true;
    return false;
  }
  click(){
    if(this.ct){ clearTimeout(this.ct); this.ct=0; if(this.d.st==='drag') return; this.goHomeToSleep(); return; }
    this.ct=setTimeout(()=>{ this.ct=0; this.boop(); },240);
  }
  goHomeToSleep(){
    this.syncHome();
    if(Math.abs(this.d.x-this.home)>6) this.go('walk',{tx:this.home,sp:20,then:'sleep'});
    else this.go('sleep');
  }
  boop(){
    const d=this.d, s=d.st, now=this.time;
    this.clicks=this.clicks.filter(t=>now-t<2.5); this.clicks.push(now);
    if(this.clicks.length>=5){ this.clicks=[]; return this.go('dizzy'); }
    if(s==='sleep') return this.go('wake');
    if(s==='roll'){ d.data.dur=Math.max(d.data.dur,d.t+1.5); this.heart(); return; }
    if(s==='drag'||s==='fall'||s==='dizzy') return;
    this.heart();
    const r=Math.random();
    if(r<0.38) this.go('bark',{n:1+(Math.random()*2|0)}); else if(r<0.72) this.go('jump'); else this.go('spin');
  }
  release(){ const d=this.d; d.vx=clamp(this.dv.x,-110,110); d.vz=clamp(this.dv.z,-40,110); this.go('fall'); }
  throwBall(x,y){
    // Spawn at the click point, straight drop to the ground line — the ball
    // is free of any box, anywhere in the open zone.
    const b=this.ball; if(this.d.st==='drag') return;
    const sx=clamp(x==null?this.d.x+this.d.f*10:x,4,this.W-4);
    const sy=clamp(y==null?4:y,4,G-3);
    Object.assign(b,{on:true,held:false,x:sx,y:sy,vx:0,vy:10});
    this.spawn('spark',sx,Math.max(4,sy),{max:0.4}); this.go('fetch',{ph:'see'});
  }
  kickBall(px){ const b=this.ball; b.vx=(b.x>=px?1:-1)*rand(70,110); b.vy=-rand(90,130); this.go('fetch',{ph:'see'}); }
  trigger(n){
    const W=this.W, m={
      bark:()=>this.go('bark',{n:2}), sit:()=>this.go('sit',{dur:8}), lie:()=>this.go('lie',{dur:8}),
      sleep:()=>this.go('sleep'), roll:()=>this.go('roll',{dur:4.5}), jump:()=>this.go('jump'), spin:()=>this.go('spin'),
      zoomies:()=>this.go('zoomies'), fetch:()=>this.throwBall(clamp(this.d.x+this.d.f*60,6,W-6),8),
      pet:()=>{ this.lastRub=this.time; this.go('pet'); }, dizzy:()=>this.go('dizzy'), scratch:()=>this.go('scratch'),
      stretch:()=>this.go('stretch'), shake:()=>this.go('shake'), chase:()=>this.go('chase'), sniff:()=>this.go('sniff',{tx:this.randX()}), nap:()=>this.go('sleep',{kind:'belly'}),
sploot:()=>this.go('sleep',{kind:'sploot'}),
    };
    if(m[n]){ m[n](); if(n!=='sleep') this.act(); }
  }

  /* ----- helpers ----- */
  alloc(){
    const cv=this.cv, W=this.W, sc=this.sc;
    cv.width=W; cv.height=H;
    cv.style.width=Math.ceil(W*sc)+'px'; cv.style.height=Math.ceil(H*sc)+'px';
    this.img=this.ctx.createImageData(W,H); this.px=new Uint32Array(this.img.data.buffer);
    this.S=mk(W,H); this.D=mk(DW,H); this.T=new Uint8Array(DW*H); this.F=mk(W,H); this.TF=new Uint8Array(W*H);
    TMP=new Uint8Array(DW*H);
  }
  act(){ this.lastAct=this.time; }
  sleepy(){ return this.time-this.lastAct>this.sleepAfter; }
  headW(){ const P=this.pose, d=this.d; return [d.x+d.f*P.hd[0], G+P.hd[1]-d.z]; }
  noseW(){ const P=this.pose, d=this.d; return [d.x+d.f*(Math.round(P.hd[0])+10.5), G+Math.round(P.hd[1])+1.5+Math.round(P.muz||0)-d.z]; }
  spawn(k,x,y,o={}){ this.parts.push(Object.assign({k,x,y,vx:0,vy:0,life:0,max:1},o)); if(this.parts.length>70) this.parts.shift(); }
  heart(){ const [hx,hy]=this.headW(); this.spawn('heart',hx+rand(-3,3),above(hy,13),{vx:rand(-4,4),vy:-10,max:1.3,ph:rand(0,6)}); }
  bang(k='bang',max=0.8){ const [hx,hy]=this.headW(); this.spawn(k,hx,above(hy,20),{max}); }
  puff(x,y,m=0.45){ this.spawn('puff',x,y,{vx:rand(-6,6),vy:-4,max:m}); }
  say(){ const [hx,hy]=this.headW(); this.spawn('say',hx+this.d.f*15,clamp(hy-5,10,H),{txt:WORDS[Math.random()*WORDS.length|0],max:0.55,vy:-4}); }
  moveTo(tx,sp,dt){ tx=this.clampX(tx); const d=this.d, dx=tx-d.x; if(Math.abs(dx)<=sp*dt+0.01){ d.x=tx; return true; } d.f=Math.sign(dx); d.x+=d.f*sp*dt; return false; }
  clampX(x){ return clamp(x,this.minX==null?M:this.minX,this.W-M); }
  measureRow(){ // in-flow canvas fills the host's flex-resolved width (name end → content edge, or full line when wrapped)
    if(this.free||!this.sc) return 0;
    const wCss=this.clientWidth; // exact post-layout width (shrink/wrap aware)
    if(wCss>10) return clamp(Math.round(wCss/this.sc),120,2000);
    // pre-layout fallback: row minus name, with slack so the basis can
    // never exceed the leftover (an overshoot wraps/shrinks the row)
    const row=this.parentElement; if(!row) return 0;
    const nm=row.querySelector('.profile-name');
    const nw=nm?nm.getBoundingClientRect().width:0;
    return clamp(Math.floor((row.clientWidth-nw-14)/this.sc),120,2000);
  }
  fitRow(){
    if(this.free) return;
    const w=this.measureRow(); if(!w||Math.abs(w-this.W)<2) return;
    this.W=w; this.d.x=this.clampX(this.d.x); this.ball.x=clamp(this.ball.x,4,this.W-4);
    this.alloc();
  }
  randX(){ let x=this.d.x; for(let i=0;i<8;i++){ x=rand(this.minX,this.W-M); if(Math.abs(x-this.d.x)>20) break; } return x; }
  farX(){ return this.d.x<this.W/2?rand(this.W-M-15,this.W-M):rand(this.minX,this.minX+15); }
  returnX(){
    const p=this.ptr, d=this.d;
    if(p.ok&&this.time-p.t<4&&p.x>0&&p.x<this.W){ const dir=Math.sign(p.x-d.x)||d.f; return this.clampX(p.x-dir*20); }
    return this.home;
  }
  // Free mode: no box — the canvas is the viewport. Ground line stays glued
  // to the name's baseline (measured at load/resize); home-x tracks the name
  // while it's on screen, else the dog keeps his last home.
  placeFixed(){
    if(!this.free) return;
    const n=document.querySelector('.profile-name'); if(!n) return;
    // Exact text baseline via a zero-size inline-block probe (its bottom
    // margin edge IS the baseline) — no font-metric guessing, so paws sit
    // pixel-true on the glyph bottoms whatever webfont loads.
    let base=null;
    try{
      const s=document.createElement('span');
      s.style.cssText='display:inline-block;width:0;height:0;vertical-align:baseline;';
      n.appendChild(s);
      base=s.getBoundingClientRect().bottom;
      s.remove();
    }catch(_){ base=null; }
    if(base==null){ const r=n.getBoundingClientRect(); base=r.bottom-11; }
    const T=clamp(base-G*this.sc,-1200,innerHeight-120);
    if(this.style&&this.style.setProperty) this.style.setProperty('--dog-top',T+'px');
  }
  syncHome(){
    if(!this.free) return;
    const n=document.querySelector('.profile-name'); if(!n) return;
    const r=n.getBoundingClientRect(), c=this.cv.getBoundingClientRect();
    if(r.bottom<-50||r.top>innerHeight+50) return; // name off-screen: keep last home
    // Dog center 64px right of the name end — exactly the old inline slot
    // (8px flex gap + 40×1.4 home), so his rear clears the last letter.
    // Same line fences him in: he never roams left of the name's end.
    this.home=clamp((r.right+64-c.left)/this.sc,M,this.W-M);
    this.minX=clamp((r.right+8-c.left)/this.sc,M,this.W-M);
  }
  reHome(){
    if(!this.free) return;
    const wasHome=Math.abs(this.d.x-this.home)<8, resting=SLEEPABLE.has(this.d.st);
    this.placeFixed(); this.syncHome();
    if(wasHome&&resting) this.d.x=this.home; // asleep at home: ride along, never left overlapping
  }
  shift(P,dx,dy){
    for(const k of ['b','th','ne','ch','hd','tl']){ P[k][0]+=dx; P[k][1]+=dy; }
    for(const l of P.legs){ l[0]+=dx; l[1]+=dy; l[2]+=dx*0.5; l[3]+=dy*0.5; }
  }
  headMove(P,dx,dy){ P.hd[0]+=dx; P.hd[1]+=dy; P.ne[0]+=dx*0.4; P.ne[1]+=dy*0.4; }
  breathe(P,sp=2.2,a=0.25){ const s=Math.sin(this.time*sp); P.b[3]+=s*a; P.ch[1]+=s*0.25; }
  wag(P,amp,f){ P.tl[2]+=Math.sin(this.time*f)*amp; }
  look(P,dt,turn=true){
    const p=this.ptr, d=this.d; if(!p.ok||this.time-p.t>5) return;
    if(turn){
      if(Math.sign(p.x-d.x)!==d.f&&Math.abs(p.x-d.x)>12){ if((this.turnT+=dt)>0.5){ d.f*=-1; this.turnT=0; } }
      else this.turnT=0;
    }
    const hy=G+P.hd[1]-d.z, hx=d.x+d.f*P.hd[0], dy=p.y-hy;
    if(dy<-14){ P.muz=-1; P.hd[1]-=1; P.eyeDy=-1; } else if(dy>16&&Math.abs(p.x-hx)<60) P.muz=1;
  }
  walkPose(ph,base,amp=3.4){
    const P=cp(base); gait(P,ph,amp,2.6,WALK_PH);
    if(Math.sin(ph*2)>0.3) this.shift(P,0,-1);
    this.wag(P,0.2,8); P.tau=0.035; return P;
  }
  runPose(ph){
    const P=cp(STAND); gait(P,ph,6,4,RUN_PH); this.shift(P,0,-(Math.sin(ph)+1)*1.2);
    P.b[4]=Math.sin(ph+0.6)*0.08; P.ears=[-2.5,2,-2,2]; P.mouth='pant';
    P.tl[4]=0.6; P.tl[2]+=Math.sin(ph*2)*0.15; P.tau=0.025; P.noTw=1; return P;
  }

  /* ----- state machine ----- */
  go(st,data={}){
    const d=this.d, b=this.ball;
    if(b.held&&st!=='fetch'){ b.held=false; b.vx=d.f*10; b.vy=-10; }
    d.st=st; d.t=0; d.data=data;
    const [hx,hy]=this.headW();
    switch(st){
      case 'idle': if(data.dur==null) data.dur=rand(2.5,6); break;
      case 'sit': case 'lie': if(data.dur==null) data.dur=rand(4,8); break;
      case 'bark': data.n=data.n||1; data.last=-1; break;
      case 'jump': d.vz=95; d.sq=-0.2; d.sqv=0; this.spawn('spark',hx,above(hy,10),{max:0.5}); break;
      case 'spin': d.vz=70; data.ft=0.11; break;
      case 'wake': d.vz=70; this.bang('bang',0.9); break;
      case 'drag': this.dv.x=0; this.dv.z=0; this.spawn('drop',hx-d.f*6,above(hy,6),{vx:-d.f*10,vy:-14,g:1,max:0.9}); break;
      case 'fetch': data.ph=data.ph||'see'; if(data.ph==='see') this.bang('bang',0.7); break;
      case 'look': this.bang('q',1.3); break;
      case 'sleep': data.zt=0.6; data.dream=rand(6,14); data.pop=rand(8,14); data.drool=0;
        data.kind=data.kind||'sploot'; break;
      case 'sniff': data.ph='trail'; data.dur=rand(2.5,4.5); if(data.tx==null) data.tx=this.randX(); break;
      case 'roll': if(data.dur==null) data.dur=4.5; break;
      case 'zoomies': data.n=3+(Math.random()*3|0); data.tx=this.farX(); break;
      case 'chase': data.ft=0.17; break;
      case 'bow': if(data.dur==null) data.dur=1.4; break;
    }
  }
  next(){
    const b=this.ball, r=this.reduced;
    if(this.sleepy()){
      if(Math.abs(this.d.x-this.home)>6) return this.go('walk',{tx:this.home,sp:20,then:'sleepy'});
      return this.go('lie',{dur:rand(2,4)});
    }
    const o=[['walk',4],['sit',3],['lie',1.3],['scratch',1],['yawn',0.7],['sniff',1.5],['look',1.3],['stretch',0.8],
      ['shake',0.6],['zoomies',r?0:0.35],['chase',r?0:0.3],['bark',0.3],['ball',b.on&&!b.held?1.2:0]];
    let tot=0; for(const [k,w] of o) if(k!==this.lastPick) tot+=w;
    let x=Math.random()*tot, pick='sit';
    for(const [k,w] of o){ if(k===this.lastPick||!w) continue; x-=w; if(x<=0){ pick=k; break; } }
    this.lastPick=pick;
    switch(pick){
      case 'walk': return this.go('walk',{tx:this.randX(),sp:16});
      case 'sniff': return this.go('sniff',{tx:this.randX()});
      case 'sit': return this.go('sit',{dur:rand(4,9)});
      case 'lie': return this.go('lie',{dur:rand(5,10)});
      case 'yawn': return this.go('yawn',{base:'sit'});
      case 'bark': return this.go('bark',{n:1+(Math.random()*2|0)});
      case 'ball': return this.go('fetch',{ph:'go'});
      default: return this.go(pick,{});
    }
  }
  think(dt){
    const d=this.d, D=d.data, t=d.t, now=this.time, W=this.W, b=this.ball; let P;
    switch(d.st){
      case 'idle': {
        const hp=D.happy&&t<2.5;
        P=cp(STAND); this.breathe(P); this.wag(P,hp?0.35:0.1,hp?17:3);
        if(hp){ P.mouth='pant'; P.eye='happy'; P.tl[4]=0.5; }
        this.look(P,dt); if(t>D.dur) this.next(); break;
      }
      case 'sit':
        P=cp(SIT); this.breathe(P); this.wag(P,0.1,3); if(D.pant&&t<3.5) P.mouth='pant';
        this.look(P,dt); if(t>D.dur) this.next(); break;
      case 'lie':
        P=cp(LIE); this.breathe(P,1.6,0.3); this.wag(P,0.06,2); this.look(P,dt);
        if(t>D.dur){ if(this.sleepy()) this.go('yawn',{base:'lie',then:'sleep'}); else this.next(); } break;
      case 'sleep': {
        const kind=D.kind, belly=kind==='belly', sploot=kind==='sploot', br=Math.sin(now*1.5);
        P=cp(belly?SLEEP_BELLY:sploot?SLEEP_SPLOOT:SLEEP); P.b[3]+=br*0.45; P.tau=0.15; P.noTw=1;
        if(belly) P.legs.forEach((l,i)=>{ l[4]+=Math.sin(now*1.5+i)*0.4; });
        if(sploot){                                   // melty breathing, swaying tail, blep in & out
          P.b[2]+=br*0.35; P.tl[2]+=Math.sin(now*2.2)*0.15;
          P.mouth=Math.sin(now*0.8)>-0.55?'blep':'closed';
          D.drool=Math.min(3.2,D.drool+dt*0.12);
        }
        if((D.zt-=dt)<=0){ D.zt=belly?1.1:1.6; const [hx,hy]=this.headW();
          this.spawn('z',hx+d.f*(belly?2:4),above(hy,belly?7:9),{vx:d.f*3.5,vy:-5,max:2.8,ph:rand(0,6)}); }
        // dreams
        if((D.dream-=dt)<=0){
          if(D.dream<-2){ D.dream=rand(8,16); D.talked=0; }
          else {
            if(belly) P.legs.forEach((l,i)=>{ l[4]+=Math.sin(now*14+i*1.6)*1.3; });
            else if(sploot){ P.legs[0][4]+=Math.sin(now*14)*1.3; P.legs[2][4]+=Math.sin(now*14+1.5)*1.3; P.tl[2]+=Math.sin(now*12)*0.3; }
            else { P.legs[1][4]+=Math.sin(now*15)*1.4; P.legs[3][4]+=Math.sin(now*15+2)*1.4; P.tl[2]+=Math.sin(now*10)*0.12; }
            P.tau=0.03;
          }
        }
        // snot bubble (curled only)
        if(kind==='curl'){
          const [nx,ny]=this.noseW(); D.pop-=dt;
          let r=0.6+Math.max(0,br)*2.2; if(D.pop<1.6) r+=(1.6-D.pop)*1.4;
          if(D.pop<=0){ this.spawn('spark',nx+d.f*3,ny,{max:0.35}); this.spawn('spark',nx+d.f*6,ny-3,{max:0.3});
            D.pop=rand(10,18); D.startle=1.1; r=0; this.bang('q',1); }
          this.snot={x:nx+d.f*(r+0.4),y:ny+0.5,r};
        } else this.snot=null;
        // drool puddle (sploot only)
        if(sploot){ const [nx]=this.noseW(); this.drool={x:nx-d.f*2,r:D.drool}; } else this.drool=null;
        if(D.startle>0){ D.startle-=dt; P.eye='half'; P.ears=[0.5,-0.5,0,0]; this.headMove(P,0,-1); }
        const p=this.ptr, [hx,hy]=this.headW();
        if(p.ok&&now-p.t<1.5&&Math.hypot(p.x-hx,p.y-hy)<30) P.eye='half';
        break;
      }
      case 'wake':
        P=d.z>0.5?cp(JUMP):cp(STAND); P.eye='wide'; P.ears=[0.5,-1.5,0.5,-1.5]; P.noTw=1;
        if(t>0.9){ if(Math.random()<0.5) this.go('bark',{n:1}); else this.go('idle',{dur:3}); } break;
      case 'walk': {
        const sp=D.sp||16, arrived=this.moveTo(D.tx,sp,dt);
        D.ph=(D.ph||0)+dt*sp/3.4; P=this.walkPose(D.ph,STAND);
        if(arrived){
          if(D.then==='sleep') this.go('sleep');
          else if(D.then==='sleepy') this.go('lie',{dur:1.2});
          else this.go('idle',{dur:rand(2,5)});
        }
        break;
      }
      case 'sniff': {
        const [nx,ny]=this.noseW(), f=d.f;
        if(D.ph==='trail'){                                   // nose-to-ground tracking
          const arrived=this.moveTo(D.tx,7,dt); D.wp=(D.wp||0)+dt*7/2.4;
          P=cp(SNIFF); gait(P,D.wp,2.4,1.6,WALK_PH);
          const sw=Math.sin(now*2.4); this.headMove(P,sw*1.6,-Math.max(0,sw)*1.2);
          if(Math.sin(now*32)>0) P.hd[0]+=0.6;
          this.wag(P,0.12,5); P.noTw=1; P.tau=0.04;
          if((D.st2=(D.st2||0)-dt)<=0){ D.st2=0.14; const sx=nx+f*rand(4,14), sy=G-rand(0.5,3);
            this.spawn('scent',sx,sy,{vx:(nx-sx)/0.45,vy:(ny-sy)/0.45,max:0.45}); }
          if((D.pt=(D.pt||0)-dt)<=0){ D.pt=0.32; this.puff(nx+f*1.5,ny+2,0.28); }
          if(arrived||t>D.dur){ D.ph='snuffle'; D.t0=t; }
        } else if(D.ph==='snuffle'){                          // stop & snuffle hard
          const k=t-D.t0; P=cp(SNIFF); P.hd[1]+=1; P.hd[0]+=Math.sin(now*45)>0?0.7:0;
          P.ears=[1.5,-0.5,1,-0.5]; P.tl[2]+=Math.sin(now*3)*0.06; P.noTw=1; P.tau=0.02;
          if((D.pt=(D.pt||0)-dt)<=0){ D.pt=0.12; this.puff(nx+f*rand(0.5,2.5),ny+2,0.25); }
          if((D.st2=(D.st2||0)-dt)<=0){ D.st2=0.08; const sx=nx+f*rand(2,8), sy=G-rand(0.5,2);
            this.spawn('scent',sx,sy,{vx:(nx-sx)/0.3,vy:(ny-sy)/0.3,max:0.3}); }
          if(k>1.2){ const r=Math.random(); D.ph=r<0.4?'dig':r<0.72?'sneeze':'huh'; D.t0=t;
            if(D.ph==='dig') this.bang('bang',0.8); if(D.ph==='huh') this.bang('q',1.3); }
        } else if(D.ph==='dig'){                              // found something!
          const k=t-D.t0; P=cp(DIG); P.tau=0.02; P.noTw=1; this.wag(P,0.45,18); P.mouth=k>0.6?'pant':'closed';
          [1,3].forEach((i,j)=>{ const l=P.legs[i], p=now*20+j*Math.PI; l[4]+=Math.sin(p)*3; l[5]-=Math.max(0,Math.cos(p))*3; l[2]+=Math.sin(p)*1.5; });
          if((D.pt=(D.pt||0)-dt)<=0){ D.pt=0.05;
            this.spawn('bit',d.x+f*rand(8,14),G-1,{vx:-f*rand(40,80),vy:-rand(35,75),g:1,max:0.7,c:Math.random()<0.7?35:23}); }
          if(k>1.8) this.go('idle',{dur:2.5,happy:true});
        } else if(D.ph==='sneeze'){                           // ah... ah... ACHOO!
          const k=t-D.t0; P=cp(STAND); P.noTw=1;
          if(k<0.7){ this.headMove(P,0,-1-k*2); P.muz=-1; P.eye=k>0.3?'squeeze':'half'; P.ears=[-1,1,-1,1];
            P.mouth=k>0.45?'bark':'closed'; P.tau=0.12; }
          else if(k<1.0){
            if(!D.boom){ D.boom=1; d.vz=55; d.sq=0.25;
              for(let i=0;i<5;i++) this.puff(nx+f*rand(2,7),ny+rand(-2,3),0.5); }
            this.headMove(P,1,3); P.muz=1; P.eye='closed'; P.ears=[-3,3,-3,3]; P.tau=0.02;
          } else {
            const j=(Math.floor(k*24)%2)?1:-1; if(k<1.5) this.headMove(P,j,0);
            P.eye=k<1.5?'happy':'blink'; P.ears=k<1.5?(j>0?[-2,1,-2,1]:[1,-1,1,-1]):[0,0,0,0]; P.tau=0.02;
          }
          if(k>2) this.go('idle',{dur:rand(2,4)});
        } else {                                              // huh? head tilt
          const k=t-D.t0; P=cp(STAND); P.ears=[1.5,-1.5,-1.5,1.5]; this.headMove(P,0,-1); P.noTw=1; P.eyeDy=-1;
          if(k>1.4) this.go('idle',{dur:rand(2,4)});
        }
        break;
      }
      case 'zoomies': {
        const arrived=this.moveTo(D.tx,80,dt); D.ph=(D.ph||0)+dt*80/6; P=this.runPose(D.ph);
        if((D.pt=(D.pt||0)-dt)<=0){ D.pt=0.12; this.puff(d.x-d.f*16,G); }
        if(arrived){ this.puff(d.x+d.f*12,G); this.puff(d.x+d.f*8,G);
          if(--D.n<=0) this.go('sit',{dur:rand(4,6),pant:true}); else D.tx=this.farX(); }
        break;
      }
      case 'chase':
        D.ph=(D.ph||0)+dt*14; P=this.runPose(D.ph); P.tl[2]+=Math.sin(now*25)*0.3;
        if((D.ft-=dt)<=0){ d.f*=-1; D.ft=0.17; this.puff(d.x,G); }
        if(t>2.4) this.go('dizzy'); break;
      case 'dizzy':
        P=cp(SIT); P.eye='x'; P.mouth='pant'; this.headMove(P,Math.round(Math.sin(t*5)*1.5),0);
        P.ears=[-1,2,1,1]; P.tl[3]=1; P.noTw=1;
        if(t>2.8) this.go('idle',{dur:3}); break;
      case 'bark': {
        P=cp(STAND); this.headMove(P,0,-1); P.muz=-1; P.ears=[0.5,-1,0.5,-1]; this.wag(P,0.3,16); P.tl[4]=0.5;
        const i=Math.floor(t/0.5);
        if(i<D.n&&i!==D.last){ D.last=i; d.vz=Math.max(d.vz,45); }
        if(i<D.n&&t-i*0.5<0.2) P.mouth='bark';
        if(t>D.n*0.5+0.35) this.go('idle',{dur:rand(2,4)});
        break;
      }
      case 'jump':
        P=d.z>0.5?cp(JUMP):cp(STAND); P.eye='happy'; P.mouth='pant'; P.ears=[-1,1,-1,1]; P.tau=0.03;
        if(t>0.1&&d.z<=0) this.go('idle',{dur:2.5,happy:true}); break;
      case 'spin':
        P=d.z>0.5?cp(JUMP):cp(STAND); P.eye='happy'; P.mouth='pant'; P.tau=0.03;
        if((D.ft-=dt)<=0){ d.f*=-1; D.ft=0.11; }
        if(t>0.15&&d.z<=0){ this.heart(); this.go('idle',{dur:2.5,happy:true}); } break;
      case 'pet':
        P=cp(SIT); P.eye=t>2.6?'love':'happy'; P.blush=1; P.ears=[-2.5,2.5,-2,2.5];
        this.headMove(P,0,-1); P.muz=-1; this.wag(P,0.35,18); P.noTw=1;
        if(t>1) P.mouth='pant';
        if(t>1.6){ const l=P.legs[2], up=Math.sin(now*26)>0?2:0; l[5]-=up; l[3]-=up*0.5; P.tau=0.02; }
        if((D.ht=(D.ht||0)-dt)<=0){ D.ht=0.4; this.heart(); }
        if(now-this.lastRub>0.9) this.go('idle',{dur:2.5,happy:true});
        break;
      case 'roll':
        if(t<0.25){ P=cp(LIE); P.eye='happy'; }
        else {
          if(!D.hop){ D.hop=1; d.vz=35; }
          P=cp(ROLL);
          P.legs.forEach((l,i)=>{ l[4]+=Math.sin(now*9+i*1.7)*1.4; l[5]+=Math.cos(now*9+i*1.7)*0.9; });
          P.tl[2]+=Math.sin(now*12)*0.2; P.tau=0.06;
          if(now-this.lastRub<0.3){ P.blush=1; P.eye=t>3?'love':'happy'; }
        }
        P.noTw=1; if(t>D.dur) this.go('idle',{dur:2.5,happy:true}); break;
      case 'scratch': {
        P=cp(SIT); const k=Math.sin(now*36), l=P.legs[2];
        l[0]=-9; l[1]=-8; l[2]=-2; l[3]=-16; l[4]=4+k*0.9; l[5]=-29+k*1.3; l[6]=1;
        P.eye='happy'; this.headMove(P,-1,1); P.muz=1; P.ears=[-1,1,0,0]; P.tau=0.03; P.noTw=1;
        if(t>2) this.go('sit',{dur:rand(3,6)}); break;
      }
      case 'yawn':
        P=cp(D.base==='lie'?LIE:SIT); this.breathe(P);
        if(t<0.3) P.mouth='pant';
        else if(t<1.35){ P.mouth='yawn'; P.eye='closed'; this.headMove(P,0,-1); P.muz=-1; P.ears=[-2,2,-2,2]; P.noTw=1; }
        else P.eye=t<1.6?'half':'open';
        if(t>1.9) this.go(D.then||(this.sleepy()?'lie':'sit'),{dur:rand(4,8)});
        break;
      case 'stretch':
        P=cp(BOW); P.tau=0.14; P.eye=(t>0.3&&t<1.3)?'closed':'open'; if(t>0.4&&t<1.2) P.mouth='yawn';
        P.noTw=1; P.tl[4]=0.3; this.wag(P,0.1,3); if(t>1.9) this.go('idle',{dur:rand(2,4)}); break;
      case 'shake': {
        P=cp(STAND); const j=(Math.floor(t*26)%2)?1:-1; this.shift(P,j,0);
        P.ears=j>0?[-2,1,-2,1]:[1,-1,1,-1]; P.eye='happy'; P.tau=0.01; P.noTw=1;
        if((D.bt=(D.bt||0)-dt)<=0){ D.bt=0.05;
          this.spawn('bit',d.x+rand(-14,10),G-24+rand(-2,2),{vx:rand(-35,35),vy:-rand(20,45),g:1,max:0.55,c:Math.random()<0.5?4:30}); }
        if(t>0.85) this.go('idle',{dur:rand(2,4)}); break;
      }
      case 'look':
        P=cp(STAND); this.breathe(P); P.ears=[1,-1,-1,1];
        if(t>0.8&&!D.a){ D.a=1; d.f*=-1; } if(t>1.7&&!D.b){ D.b=1; d.f*=-1; }
        if(t>2.6) this.go('idle',{dur:rand(2,4)}); break;
      case 'bow':
        P=cp(BOW); P.mouth='pant'; this.wag(P,0.4,20); if(Math.sin(t*9)>0.3) this.shift(P,0,1); this.look(P,dt,false);
        if(t>D.dur) this.go(D.then||'idle',{dur:rand(3,6)}); break;
      case 'drag': {
        const dn=this.down, p=this.ptr;
        if(!dn){ this.release(); P=cp(STAND); break; }
        const nx=this.clampX(dn.x0+(p.x-dn.x)), nz=clamp(dn.z0+(dn.y-p.y),0,14);
        this.dv.x+=((nx-d.x)/dt-this.dv.x)*0.35; this.dv.z+=((nz-d.z)/dt-this.dv.z)*0.35;
        d.x=nx; d.z=nz; d.vz=0;
        P=cp(STAND); const sw=clamp(-this.dv.x*0.03,-3,3);
        P.legs.forEach((l,i)=>{ l[5]+=2; l[4]+=sw+Math.sin(now*6+i)*0.7; l[2]+=sw*0.5; });
        P.eye=(t<0.8||Math.abs(this.dv.x)>20)?'wide':'open'; P.ears=[-2,2,-2,2]; P.tl[3]=0.7; P.noTw=1; P.tau=0.03;
        break;
      }
      case 'fall':
        d.x+=d.vx*dt;
        if(d.x<this.minX){ d.x=this.minX; d.vx=Math.abs(d.vx)*0.5; }
        if(d.x>W-M){ d.x=W-M; d.vx=-Math.abs(d.vx)*0.5; }
        P=d.z>0.5?cp(JUMP):cp(STAND); P.eye='wide'; P.ears=[-2,2,-2,2]; P.noTw=1; P.tau=0.04;
        if(this.landed||(d.z<=0&&d.vz<=0)){
          d.vx=0; if(this.landed>90) this.bang('bang',0.6);
          if(Math.random()<0.6) this.go('shake'); else this.go('idle',{dur:2});
        }
        break;
      case 'fetch': {
        if(!b.on){ this.go('idle'); P=cp(STAND); break; }
        const ph=D.ph;
        if(ph==='see'){
          P=cp(STAND); P.eye='wide'; P.ears=[0.5,-1.5,0.5,-1.5]; this.wag(P,0.3,14); P.tl[4]=0.5;
          if(!b.held) d.f=Math.sign(b.x-d.x)||d.f;
          if(t>0.35) D.ph='go';
        } else if(ph==='go'){
          let side=b.x>=d.x?1:-1, tx=b.x-side*REACH;
          if(tx<M||tx>W-M){ side=-side; tx=b.x-side*REACH; }
          tx=clamp(tx,M,W-M);
          const dist=Math.abs(tx-d.x), settled=b.y>=G-2.2&&b.vy===0&&Math.abs(b.vx)<14;
          if(dist>1.2){
            const sp=clamp(dist*4,18,70); this.moveTo(tx,sp,dt);
            D.ph2=(D.ph2||0)+dt*sp/(sp>34?6:3.4);
            P=sp>34?this.runPose(D.ph2):this.walkPose(D.ph2,STAND);
          } else {
            d.f=side; P=cp(STAND); P.eye='wide'; this.wag(P,0.3,16);
            if(settled){ D.ph='pick'; D.pt=0; }
          }
        } else if(ph==='pick'){
          P=cp(PICK); D.pt+=dt;
          if(D.pt>0.32){ b.held=true; D.ph='back'; D.rx=this.returnX(); }
        } else if(ph==='back'){
          const arrived=Math.abs(D.rx-d.x)<1||this.moveTo(D.rx,28,dt);
          D.ph2=(D.ph2||0)+dt*28/3.6;
          P=arrived?cp(STAND):this.walkPose(D.ph2,STAND,3.6);
          P.mouth='ball'; P.ears=[0.5,-1,0.5,-1]; this.wag(P,0.3,14); P.tl[4]=0.6;
          if(arrived){ D.ph='drop'; D.pt=0; if(this.ptr.ok&&now-this.ptr.t<3) d.f=Math.sign(this.ptr.x-d.x)||d.f; }
        } else if(ph==='drop'){
          P=cp(PICK); P.mouth='ball'; D.pt+=dt;
          if(D.pt>0.28){ b.held=false; b.vx=d.f*16; b.vy=-25; this.go('bow',{dur:1.6,then:'sit'}); }
        }
        if(!P) P=cp(STAND);
        break;
      }
      default: P=cp(STAND);
    }
    return P;
  }

  step(dt){
    const d=this.d, b=this.ball, W=this.W; this.time+=dt; const now=this.time; d.t+=dt;
    if((this.blinkT-=dt)<=0){ this.blinkT=rand(1.8,5); this.blinkOn=0.13; } this.blinkOn-=dt;
    if((this.twT-=dt)<=0){ this.twT=rand(3,8); this.twOn=0.16; } this.twOn-=dt;
    this.rub*=Math.exp(-dt*2.5); this.excite*=Math.exp(-dt*2);
    const dn=this.down;
    if(dn&&!dn.drag&&!dn.pet&&now-dn.t>0.4) dn.pet=true;
    if(dn&&dn.pet) this.lastRub=now;
    const rubbing=now-this.lastRub<0.15;
    // dog physics + jelly squash spring
    this.landed=0;
    if(d.st!=='drag'&&(d.z>0||d.vz>0)){
      d.vz-=GRAV*dt; d.z+=d.vz*dt;
      if(d.z<=0){ this.landed=Math.max(1,-d.vz); d.z=0; d.vz=0;
        if(this.landed>60){ d.sq=clamp(this.landed/420,0.08,0.3); this.puff(d.x-9,G); this.puff(d.x+9,G); } }
    }
    d.sqv+=(-650*d.sq-24*d.sqv)*dt; d.sq=clamp(d.sq+d.sqv*dt,-0.35,0.35);
    // ball
    if(b.on&&!b.held){
      b.vy+=380*dt; b.x+=b.vx*dt; b.y+=b.vy*dt; const gy=G-1.9;
      if(b.y>=gy){ b.y=gy; if(b.vy>28){ b.vy=-b.vy*0.55; b.vx*=0.85; } else b.vy=0; }
      if(b.y>=gy&&b.vy===0) b.vx*=Math.exp(-dt*2.5);
      const bL=this.free?this.minX+2:3;
      if(b.x<bL){ b.x=bL; b.vx=Math.abs(b.vx)*0.6; }
      if(b.x>W-3){ b.x=W-3; b.vx=-Math.abs(b.vx)*0.6; }
    }
    for(const p of this.parts){ p.life+=dt; if(p.g) p.vy+=150*dt; p.x+=p.vx*dt; p.y+=p.vy*dt; if(p.k==='bit'&&p.y>G){ p.y=G; p.vx*=0.5; p.vy=0; } }
    this.parts=this.parts.filter(p=>p.life<p.max);
    // global reactions
    const s=d.st, D=d.data;
      if(rubbing&&s!=='sleep'){
        if(s==='roll'){ D.dur=Math.max(D.dur,d.t+1.2); if((D.ht=(D.ht||0)-dt)<=0){ D.ht=0.35; this.heart(); } }
        else if(PETTABLE.has(s)) this.go('pet');
      }
    if(this.excite>25&&(d.st==='idle'||d.st==='sit')&&now-this.exT>12&&!this.reduced){ this.exT=now; this.excite=0; this.go('bow',{dur:1.1,then:'zoomies'}); }
    if(SLEEPABLE.has(d.st)&&this.sleepy()&&d.t>2.5){
      this.syncHome();
      if(Math.abs(d.x-this.home)>6) this.go('walk',{tx:this.home,sp:20,then:'sleepy'});
      else this.go('lie',{dur:rand(2,4)});
    }
    const P=this.think(dt)||cp(STAND);
    d.x=this.clampX(d.x); // safety net: no state escapes the left fence
    if(P.eye==='open'&&this.blinkOn>0) P.eye='blink';
    if(this.twOn>0&&!P.noTw) P.ears=[P.ears[0]+0.8,P.ears[1]-1.2,P.ears[2],P.ears[3]];
    this.pose=lerpPose(this.pose,P,1-Math.exp(-dt/(P.tau||0.05)));
    if(b.held){ const Q=this.pose; b.x=d.x+d.f*(Math.round(Q.hd[0])+BDX); b.y=G+Math.round(Q.hd[1])+BDY+Math.round(Q.muz||0)-d.z; }
  }

  /* ----- render ----- */
  blit(){
    const D=this.D.b, S=this.S, d=this.d, sy=1-d.sq, sx=1+d.sq*0.5, bx=Math.round(d.x), bz=Math.round(d.z), f=d.f;
    for(let y=0;y<H;y++){
      const ly=Math.round(G+(y-G)/sy), ty=y-bz; if(ly<0||ly>=H||ty<0||ty>=H) continue;
      for(let x=0;x<DW;x++){
        const lx=Math.round(X0+(x-X0)/sx); if(lx<0||lx>=DW) continue;
        const c=D[ly*DW+lx]; if(!c) continue;
        const tx=bx+f*(x-X0); if(tx<0||tx>=S.w) continue;
        S.b[ty*S.w+tx]=c;
      }
    }
  }
  render(){
    const S=this.S, F=this.F, d=this.d, P=this.pose, b=this.ball;
    S.b.fill(0);
    ell(S,Math.round(d.x)-d.f*2,G+0.5,Math.max(5,17-d.z*0.5),1.3,0,16);
    if(b.on&&!b.held) ell(S,Math.round(b.x),G+0.5,Math.max(1.2,2.8-(G-1.9-b.y)*0.06),1,0,16);
    for(const p of this.parts) if(p.k==='puff') disc(S,p.x,p.y,0.8+p.life/p.max*2,23);
    drawDog(this.D,P,this.V); outline(this.D,this.T); this.blit();
    if(d.st==='sleep'&&this.drool&&this.drool.r>0.6) ell(S,this.drool.x,G+0.6,this.drool.r,0.7,0,33);
    F.b.fill(0);
    if(b.on&&!b.held) ballAt(F,b.x,b.y);
    for(const p of this.parts){
      if(fading(p)) continue; const x=Math.round(p.x), y=Math.round(p.y);
      if(p.k==='heart') spr(F,HEART,Math.round(p.x+Math.sin(p.life*5+p.ph)*1.5)-2,y-2);
      else if(p.k==='spark') spr(F,p.life<p.max*0.55?PLUS:DOT,x-1,y-1);
      else if(p.k==='drop') spr(F,DROP,x-1,y-2);
    }
    if(d.st==='dizzy'){ const [hx,hy]=this.headW();
      for(let i=0;i<3;i++){ const a=this.time*5+i*2.094; spr(F,PLUS,Math.round(hx+Math.cos(a)*9)-1,Math.round(above(hy,11)+Math.sin(a)*2)-1); } }
    if(d.st==='sleep'&&this.snot&&this.snot.r>0.7){ const s=this.snot;
      disc(F,s.x,s.y,s.r,(u,v)=>(u<-0.15&&v<-0.15&&u>-0.85&&v>-0.85)?34:33); }
    outline(F,this.TF);
    const sb=S.b, fb=F.b; for(let i=0;i<fb.length;i++) if(fb[i]) sb[i]=fb[i];
    for(const p of this.parts){
      if(fading(p)) continue; const x=Math.round(p.x), y=Math.round(p.y);
      switch(p.k){
        case 'z': glyph(S,p.life<1.1?ZS:ZB,Math.round(p.x+Math.sin(p.life*2.5+p.ph)*1.5),y,22); break;
        case 'scent': ps(S,x,y,36); if(p.life<p.max*0.5) ps(S,x-Math.sign(p.vx),y+1,36); break;
        case 'bang': glyph(S,BANG,x-1,y-(p.life<0.08?1:0),1); break;
        case 'q': glyph(S,QM,x-2,y,1); break;
        case 'say': bubble(S,p.txt,x,y); break;
        case 'bit': ps(S,x,y,p.c); break;
      }
    }
    const px=this.px, pal=this.pal; for(let i=0;i<sb.length;i++) px[i]=pal[sb[i]];
    this.ctx.putImageData(this.img,0,0);
  }
  loop(ts){
    this.raf=requestAnimationFrame(this._loop);
    if(this.last==null) this.last=ts;
    let dt=(ts-this.last)/1000; this.last=ts;
    if(!this.visible||document.hidden||dt<=0) return;
    this.step(Math.min(dt,0.05)); this.render();
  }
}
PixelDog.BREEDS=BREEDS; PixelDog.PATTERNS=PATTERNS; PixelDog.TAILS=Object.keys(TAILS);
// Rig access for other renderers (e.g. /hanomi bakes in-game dog sprites from this exact rig).
PixelDog.rig={G,X0,DW,H:84,mk,
  drawDog(L,P,V){ const keep=TMP; if(TMP.length!==L.b.length) TMP=new Uint8Array(L.b.length); drawDog(L,P,V); TMP=keep; },
  outline,buildPal,cp,lerpPose,gait,WALK_PH,RUN_PH,BREEDS,PATTERNS,TAILS,
  poses:{STAND,SIT,LIE,BOW,ROLL,JUMP,PICK,SLEEP,SLEEP_BELLY,SLEEP_SPLOOT,SNIFF,DIG}};
customElements.define('pixel-dog',PixelDog);
})();
