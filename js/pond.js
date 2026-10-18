/* Koi pond — embedded from koiiiiiii.html, adapted to a page section. */
'use strict';
(()=>{
const cv=document.getElementById('pond-c'),ctx=cv.getContext('2d',{alpha:false});
const holder=document.getElementById('pond');
let QBUMP=0;
const pondW=()=>Math.max(320,holder.clientWidth||innerWidth);
const pondH=()=>Math.max(360,holder.clientHeight||innerHeight);
const bar=document.getElementById('pond-bar'),bctx=bar.getContext('2d');

/* ================= utilities ================= */
function mulberry32(a){return function(){a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};}
const rnd=mulberry32((Math.random()*4294967296)>>>0);
const R=(a,b)=>b===undefined?rnd()*a:a+rnd()*(b-a);
const RI=(a,b)=>Math.floor(R(a,b+1));
const pick=a=>a[Math.floor(rnd()*a.length)];
const clamp=(v,a,b)=>v<a?a:v>b?b:v;
const lerp=(a,b,t)=>a+(b-a)*t;
const lerpC=(a,b,t)=>[a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t,a[2]+(b[2]-a[2])*t];
const TAU=Math.PI*2;
const wrapA=a=>{while(a>Math.PI)a-=TAU;while(a<-Math.PI)a+=TAU;return a;};
let NOFF=0;
function hash2(x,y){let h=(Math.imul(x|0,374761393)+Math.imul(y|0,668265263))|0;h=Math.imul(h^(h>>>13),1274126177);h^=h>>>16;return(h>>>0)/4294967296;}
function vnoise(x,y){x+=NOFF;const ix=Math.floor(x),iy=Math.floor(y),fx=x-ix,fy=y-iy,ux=fx*fx*(3-2*fx),uy=fy*fy*(3-2*fy);
  const a=hash2(ix,iy),b=hash2(ix+1,iy),c=hash2(ix,iy+1),d=hash2(ix+1,iy+1);return a+(b-a)*ux+(c-a)*uy+(a-b-c+d)*ux*uy;}
function fbm(x,y,o){o=o||4;let s=0,a=0.5,f=1,n=0;for(let i=0;i<o;i++){s+=a*vnoise(x*f,y*f);n+=a;a*=0.5;f*=2.03;}return s/n;}
const BAY=[0,8,2,10,12,4,14,6,3,11,1,9,15,7,13,5].map(v=>(v+0.5)/16);
const bay=(x,y)=>BAY[((y&3)<<2)|(x&3)];
const pack=(r,g,b)=>0xff000000|(b<<16)|(g<<8)|r;
const packC=(r,g,b)=>0xff000000|((b<0?0:b>255?255:b|0)<<16)|((g<0?0:g>255?255:g|0)<<8)|(r<0?0:r>255?255:r|0);
function scale(buf,i,f){const c=buf[i];buf[i]=packC((c&255)*f,(c>>8&255)*f,(c>>16&255)*f);}
function blend(buf,i,r,g,b,a){const c=buf[i],cr=c&255,cg=c>>8&255,cb=c>>16&255;buf[i]=packC(cr+(r-cr)*a,cg+(g-cg)*a,cb+(b-cb)*a);}

/* ================= textures ================= */
const CT=new Float32Array(64*64);
(()=>{const r=mulberry32(1337),G=5,pts=[];for(let gy=0;gy<G;gy++)for(let gx=0;gx<G;gx++)pts.push([(gx+r())*64/G,(gy+r())*64/G]);
 for(let y=0;y<64;y++)for(let x=0;x<64;x++){let f1=1e9,f2=1e9;for(const p of pts)for(let ox=-64;ox<=64;ox+=64)for(let oy=-64;oy<=64;oy+=64){
  const dx=x-p[0]-ox,dy=y-p[1]-oy,d=Math.sqrt(dx*dx+dy*dy);if(d<f1){f2=f1;f1=d;}else if(d<f2)f2=d;}
  CT[y*64+x]=Math.pow(Math.max(0,1-(f2-f1)/3.2),1.5);}})();
const FL=new Uint8Array(64*64);
(()=>{const r=mulberry32(77);for(let k=0;k<16;k++){const cx=r()*64,cy=r()*64,rad=1.2+r()*2.2;
  for(let y=-4;y<=4;y++)for(let x=-4;x<=4;x++)if(x*x+y*y<=rad*rad)FL[(((cy+y)|0)&63)*64+(((cx+x)|0)&63)]=1;}})();
const MT=new Float32Array(128*128);
(()=>{const r=mulberry32(4242),M=128;let a=new Float32Array(M*M);for(let i=0;i<M*M;i++)a[i]=r();
  for(let p=0;p<3;p++){const t=new Float32Array(M*M),b=new Float32Array(M*M),rad=7,k=1/(2*rad+1);
    for(let y=0;y<M;y++)for(let x=0;x<M;x++){let s=0;for(let d=-rad;d<=rad;d++)s+=a[y*M+((x+d)&127)];t[y*M+x]=s*k;}
    for(let y=0;y<M;y++)for(let x=0;x<M;x++){let s=0;for(let d=-rad;d<=rad;d++)s+=t[((y+d)&127)*M+x];b[y*M+x]=s*k;}a=b;}
  let mn=1e9,mx=-1e9;for(let i=0;i<M*M;i++){if(a[i]<mn)mn=a[i];if(a[i]>mx)mx=a[i];}for(let i=0;i<M*M;i++)MT[i]=(a[i]-mn)/(mx-mn||1);})();

/* ================= state ================= */
let W,H,N,S,SCALE,img,out,bed,under,uD,depth,wm,distIn,distOut,w0,w1,mark,LR,LG,LB,emis,shadowMap,canA,canB,deckBuf,vig,wshade,stoneCol,wtint,wXa,wYa;
let fish=[],pads=[],pellets=[],leaves=[],dflies=[],striders=[],bubbles=[],drops=[],sinkers=[],scares=[],fireflies=[],plants=[],reeds=[],vents=[],canPix=[],frogs=[],flies=[];
let lantern=null,moon={x:0,y:0},deck=null,pondC={x:0,y:0},waterCount=1,island=null,spout=null,zen=null;
let T=0,frame=0,markId=1,fishId=0,lastPlop=0,hoverFish=null,flash2=0,introDone=false;
let todCur=1,todTarget=1,rainOn=false,tool='feed',snapReq=false,uiHidden=false;
const mouse={x:-99,y:-99,px:0,py:0,down:false,over:false,still:0,grab:null};
const SC=()=>clamp(S/260,0.9,1.9);
const PRESETS=[
 {amb:[0.88,0.84,0.94],sky:[214,176,196],caus:0.35,night:0.22,spec:0.9,sh:-5,mist:0.8, lo:[44,30,74],hi:[255,216,206],gk:0.2},
 {amb:[1.02,1.0,0.97], sky:[160,202,216],caus:1.0, night:0,   spec:1.0,sh:0, mist:0.05,lo:[10,34,46],hi:[255,250,228],gk:0.1},
 {amb:[1.12,0.9,0.68], sky:[255,182,112],caus:0.7, night:0.06,spec:1.3,sh:6, mist:0.12,lo:[70,24,46],hi:[255,206,130],gk:0.22},
 {amb:[0.62,0.5,0.74], sky:[136,86,156], caus:0.2, night:0.6, spec:0.8,sh:9, mist:0.4, lo:[34,14,64],hi:[255,156,146],gk:0.26},
 {amb:[0.2,0.26,0.46], sky:[26,38,80],   caus:0,   night:1,   spec:0.6,sh:0, mist:0.28,lo:[4,10,32], hi:[196,220,255],gk:0.2}];
const env={amb:[1,1,1],sky:[150,192,206],caus:1,night:0,spec:1,shadow:1,shShift:0,rain:0,wind:0.5,windX:0.3,mist:0,gLo:[0,0,0],gHi:[255,255,255],gK:0,flash:0};

const FONT={'1':'26227','2':'61247','3':'61216','4':'55711',R:'65655',T:'72222',F:'74644',M:'57755',P:'65644',H:'55755'};
function plot(x,y,r,g,b){x=Math.floor(x);y=Math.floor(y);if(x<0||y<0||x>=W||y>=H)return;out[y*W+x]=packC(r,g,b);}
function plotA(x,y,r,g,b,a){x=Math.floor(x);y=Math.floor(y);if(x<0||y<0||x>=W||y>=H)return;blend(out,y*W+x,r,g,b,a);}
function darkAt(x,y,f,id){x=Math.floor(x);y=Math.floor(y);if(x<0||y<0||x>=W||y>=H)return;const i=y*W+x;if(id){if(mark[i]===id)return;mark[i]=id;}scale(out,i,f);}

/* ================= world generation ================= */
function build(){
  SCALE=innerWidth<760?2:clamp(Math.round(innerWidth/640),2,6);
  W=Math.ceil(innerWidth/SCALE);H=Math.ceil(innerHeight/SCALE);N=W*H;S=Math.min(W,H);
  cv.width=W;cv.height=H;cv.style.width=W*SCALE+'px';cv.style.height=H*SCALE+'px';
  img=ctx.createImageData(W,H);out=new Uint32Array(img.data.buffer);
  bed=new Uint32Array(N);under=new Uint32Array(N);uD=new Float32Array(N);depth=new Float32Array(N);
  wm=new Uint8Array(N);w0=new Float32Array(N);w1=new Float32Array(N);mark=new Uint32Array(N);
  LR=new Float32Array(N);LG=new Float32Array(N);LB=new Float32Array(N);emis=new Float32Array(N);
  shadowMap=new Float32Array(N);canA=new Uint32Array(N);canB=new Uint32Array(N);deckBuf=new Uint32Array(N);
  vig=new Float32Array(N);wshade=new Float32Array(N);stoneCol=new Uint32Array(N);wtint=new Uint32Array(N);
  wXa=new Float32Array(W);wYa=new Float32Array(H);
  NOFF=RI(0,9000);
  genMask();genIsland();genStones();
  distIn=chamfer(1);distOut=chamfer(0);
  genDepth();paintBed();genZen();genPath();genDeck();genLantern();genSpout();genCanopy();genEntities();genVignette();genTint();
  layoutBar();
}
function genMask(){
  const cx=W*R(0.46,0.54),cy=H*R(0.46,0.5);pondC={x:cx,y:cy};
  const bl=[{x:cx,y:cy,rx:W*0.28,ry:H*0.28},
    {x:cx-W*R(0.15,0.2),y:cy+H*R(-0.12,0.06),rx:W*R(0.14,0.19),ry:H*R(0.17,0.23)},
    {x:cx+W*R(0.15,0.2),y:cy+H*R(-0.06,0.12),rx:W*R(0.14,0.19),ry:H*R(0.17,0.23)}];
  const tmp=new Uint8Array(N);
  for(let y=0;y<H;y++)for(let x=0;x<W;x++){let f=0;for(const b of bl){const dx=(x-b.x)/b.rx,dy=(y-b.y)/b.ry;f+=Math.exp(-2*(dx*dx+dy*dy));}
    f+=(fbm(x*0.03,y*0.03)-0.5)*0.34;tmp[y*W+x]=(f>0.24&&x>3&&y>3&&x<W-4&&y<H-4)?1:0;}
  const st=[(cy|0)*W+(cx|0)];
  while(st.length){const i=st.pop();if(i<0||i>=N||wm[i]||!tmp[i])continue;wm[i]=1;st.push(i+1,i-1,i+W,i-W);}
}
function genIsland(){
  island=null;if(rnd()<0.4)return;
  const d=chamfer(1);let best=0,bi=-1;
  for(let k=0;k<900;k++){const i=RI(0,N-1);if(wm[i]&&d[i]>best){best=d[i];bi=i;}}
  if(bi<0||best<S*0.15)return;
  const cx=bi%W+0.5,cy=(bi/W|0)+0.5,r=S*R(0.04,0.055);
  for(let y=Math.floor(cy-r*1.6);y<=cy+r*1.6;y++)for(let x=Math.floor(cx-r*1.8);x<=cx+r*1.8;x++){if(x<1||y<1||x>=W-1||y>=H-1)continue;
    const e=((x+0.5-cx)/(r*1.3))**2+((y+0.5-cy)/r)**2+(fbm(x*0.12,y*0.12+77,3)-0.5)*0.6;if(e<1)wm[y*W+x]=0;}
  island={x:cx,y:cy,r};
}
function stoneBase(){const g=R(100,170),t=rnd();return t<0.33?[g+10,g+2,g-10]:t<0.66?[g-6,g,g+6]:[g,g,g-2];}
function makeStone(buf,cx,cy,rx,ry,c,moss,setLand,shadow){
  const x0=Math.floor(cx-rx-1),x1=Math.ceil(cx+rx+1),y0=Math.floor(cy-ry-1),y1=Math.ceil(cy+ry+1),ol=rx>1.8&&ry>1.6;
  if(shadow){const ox=rx*0.4+1,oy=ry*0.45+1;for(let y=y0;y<=y1+4;y++)for(let x=x0;x<=x1+4;x++){if(x<1||y<1||x>=W-1||y>=H-1)continue;
    const lx=(x+0.5-cx-ox)/(rx*1.05),ly=(y+0.5-cy-oy)/(ry*1.05);if(lx*lx+ly*ly<=1)scale(buf,y*W+x,0.6);}}
  const ins=(x,y)=>{const lx=(x+0.5-cx)/rx,ly=(y+0.5-cy)/ry;return lx*lx+ly*ly<=1;};
  for(let y=y0;y<=y1;y++)for(let x=x0;x<=x1;x++){if(x<1||y<1||x>=W-1||y>=H-1)continue;
    const lx=(x+0.5-cx)/rx,ly=(y+0.5-cy)/ry,d2=lx*lx+ly*ly;if(d2>1)continue;
    const sh=0.84+(-lx-ly)*0.22+(1-d2)*0.2+(bay(x,y)-0.5)*0.12+(hash2(x*3+11,y*7+5)-0.5)*0.08;
    let f=sh>1.04?1.22:sh>0.9?1:sh>0.76?0.82:0.66;
    const edge=ol&&(!ins(x+1,y)||!ins(x,y+1)||!ins(x-1,y)||!ins(x,y-1));
    if(edge)f=(lx+ly)>-0.3?0.5:(f>1?1.12:0.82);
    let r=c[0]*f,g=c[1]*f,b=c[2]*f;
    if(moss&&ly<0.15&&!edge&&fbm(x*0.4,y*0.4)>0.5){const m=f>1?1.15:0.9;r=(r*0.3+44)*m;g=(g*0.35+76)*m;b=(b*0.3+22)*m;}
    const i=y*W+x;buf[i]=packC(r,g,b);if(setLand)wm[i]=0;}
}
function genStones(){
  const bnd=[];for(let y=1;y<H-1;y++)for(let x=1;x<W-1;x++){const i=y*W+x;if(wm[i]&&(!wm[i-1]||!wm[i+1]||!wm[i-W]||!wm[i+W]))bnd.push(i);}
  if(!bnd.length)return;
  const sc=SC(),n=Math.floor(bnd.length/4.2);
  for(let k=0;k<n;k++){const i=pick(bnd),r=(rnd()<0.06?R(3.5,5.5):R(1.3,3.2))*sc;
    makeStone(stoneCol,i%W+R(-0.5,0.5),(i/W|0)+R(-0.5,0.5),r*R(0.9,1.35),r,stoneBase(),rnd()<0.45,true);}
}
function chamfer(v){
  const d=new Float32Array(N);for(let i=0;i<N;i++)d[i]=wm[i]===v?1e6:0;
  for(let y=1;y<H-1;y++)for(let x=1;x<W-1;x++){const i=y*W+x;if(d[i]===0)continue;
    d[i]=Math.min(d[i],d[i-1]+1,d[i-W]+1,d[i-W-1]+1.414,d[i-W+1]+1.414);}
  for(let y=H-2;y>0;y--)for(let x=W-2;x>0;x--){const i=y*W+x;if(d[i]===0)continue;
    d[i]=Math.min(d[i],d[i+1]+1,d[i+W]+1,d[i+W+1]+1.414,d[i+W-1]+1.414);}
  return d;
}
function genDepth(){
  const md=S*0.17;
  for(let i=0;i<N;i++){if(!wm[i]){depth[i]=0;continue;}const x=i%W,y=i/W|0;
    let d=Math.pow(Math.min(1,distIn[i]/md),0.75);d*=0.78+fbm(x*0.05+40,y*0.05)*0.44;depth[i]=clamp(d,0.03,1);}
  for(let y=4;y<H-4;y++)for(let x=4;x<W-4;x++){const i=y*W+x;if(!wm[i]){wshade[i]=1;continue;}
    let c=0;for(let k=1;k<=3;k++)if(!wm[i-k*W-k])c++;wshade[i]=1-c*0.09;}
}
function randWater(dmin,dmax){for(let k=0;k<500;k++){const x=RI(2,W-3),y=RI(2,H-3),i=y*W+x;if(wm[i]&&depth[i]>=dmin&&depth[i]<=dmax)return{x:x+0.5,y:y+0.5};}return null;}
function randLand(dmin,dmax,cond){for(let k=0;k<4000;k++){const x=RI(6,W-7),y=RI(6,H-7),i=y*W+x;
  if(!wm[i]&&!stoneCol[i]&&distOut[i]>=dmin&&distOut[i]<=dmax&&(!cond||cond(x,y)))return{x,y};}return null;}
const GRASS=[[30,58,34],[44,80,40],[62,104,46],[86,126,54],[120,142,62]];
const BEDC=[[208,190,142],[178,158,112],[142,126,90],[104,100,72],[72,78,58],[50,60,48]];
function paintBed(){
  for(let y=0;y<H;y++)for(let x=0;x<W;x++){
    const i=y*W+x,b=bay(x,y),h=hash2(x*3+7,y*5+11);let r,g,bl;
    if(wm[i]){
      const d=depth[i],n=fbm(x*0.09,y*0.09+90),t=d+(n-0.5)*0.36+(b-0.5)*0.12;
      const c=BEDC[clamp(Math.floor(t*6),0,5)];r=c[0];g=c[1];bl=c[2];
      if(h>0.9){r*=1.14;g*=1.12;bl*=1.08;}else if(h<0.1){r*=0.84;g*=0.84;bl*=0.86;}
      const m=fbm(x*0.06+20,y*0.06);
      if(m>0.57&&d>0.15){const k=Math.min(1,(m-0.57)*7)*0.85;r=lerp(r,r*0.45+24,k);g=lerp(g,g*0.55+60,k);bl=lerp(bl,bl*0.45+24,k);}
    }else if(stoneCol[i]){bed[i]=stoneCol[i];continue;}
    else{
      const dO=distOut[i],n=fbm(x*0.05,y*0.05+300),n2=fbm(x*0.2+50,y*0.2,2);
      let idx=clamp(Math.floor(n*4.6-0.5+(n2-0.5)*1.2+(b-0.5)*0.9),0,4);
      if(h>0.94)idx=Math.max(0,idx-1);else if(h<0.04)idx=Math.min(4,idx+1);
      const c=GRASS[idx];r=c[0];g=c[1];bl=c[2];
      if(dO<6){const k=(1-dO/6)*0.55;r=lerp(r,34,k);g=lerp(g,64,k);bl=lerp(bl,36,k);}
      if(dO<2.2){r=56;g=48;bl=34;if(h>0.6){r=70;g=60;bl=42;}}
      if(y<H-1&&x<W-1&&wm[i+W+1]){r*=0.72;g*=0.72;bl*=0.72;}
      if(y>0&&x>0&&wm[i-W-1]){r*=1.16;g*=1.14;bl*=1.1;}
    }
    bed[i]=packC(r,g,bl);
  }
  let wc=0;for(let i=0;i<N;i++)if(wm[i])wc++;waterCount=Math.max(1,wc);
  const sc=SC(),isG=i=>i>=0&&i<N&&!wm[i]&&!stoneCol[i]&&distOut[i]>=3;
  for(let k=0,nt=N/26|0;k<nt;k++){const x=RI(2,W-3),y=RI(3,H-3),i=y*W+x;if(!isG(i)||!isG(i-W-1)||!isG(i-W+1))continue;
    scale(bed,i,0.74);scale(bed,i-W-1,1.18);scale(bed,i-W+1,1.18);if(rnd()<0.4&&isG(i-2*W))scale(bed,i-2*W,1.1);}
  for(let k=0,nl=N/900|0;k<nl;k++){const x=RI(2,W-3),y=RI(2,H-3),i=y*W+x;if(!isG(i))continue;
    const lc=pick([[196,84,40],[226,150,50],[170,58,36],[236,190,70]]);bed[i]=pack(lc[0],lc[1],lc[2]);if(isG(i+1))bed[i+1]=packC(lc[0]*0.8,lc[1]*0.8,lc[2]*0.8);}
  for(let k=0,nf=Math.max(4,N/5000|0);k<nf;k++){const p=randLand(5,9999);if(!p)continue;
    const fc=pick([[244,240,226],[250,214,90],[196,140,226],[240,130,150],[150,180,250]]);
    for(let j=0,m=RI(3,7);j<m;j++){const x=p.x+RI(-4,4),y=p.y+RI(-3,3);if(x<2||y<2||x>=W-2||y>=H-2)continue;const i=y*W+x;
      if(!isG(i)||!isG(i-1)||!isG(i+1)||!isG(i-W)||!isG(i+W))continue;
      bed[i]=pack(250,220,96);bed[i-1]=bed[i+1]=bed[i-W]=pack(fc[0],fc[1],fc[2]);bed[i+W]=packC(fc[0]*0.75,fc[1]*0.75,fc[2]*0.75);}}
  for(let k=0,np=Math.floor(wc/45);k<np;k++){const p=randWater(0.02,0.75);if(!p)continue;const r=R(0.6,1.7)*sc,t=rnd();
    makeStone(bed,p.x,p.y,r*R(0.9,1.3),r,t<0.15?[220,214,200]:t<0.3?[150,90,60]:stoneBase(),false,false);}
  for(let k=0,nr=RI(3,6);k<nr;k++){const p=randWater(0.3,0.9);if(!p)continue;const r=R(3,6)*sc,rx=r*R(1,1.4);
    makeStone(bed,p.x,p.y,rx,r,stoneBase(),rnd()<0.6,false);
    for(let y=Math.floor(p.y-r);y<=p.y+r;y++)for(let x=Math.floor(p.x-rx);x<=p.x+rx;x++){const i=y*W+x;
      if(i>=0&&i<N&&wm[i]&&((x-p.x)/rx)**2+((y-p.y)/r)**2<=1)depth[i]=Math.min(depth[i],depth[i]*0.5+0.06);}}
  for(let k=0,nb=RI(2,4);k<nb;k++){const p=randLand(8,40);if(!p)continue;const r=R(4,7)*sc;makeStone(bed,p.x,p.y,r*R(1,1.4),r,stoneBase(),rnd()<0.7,false,true);}
}
function genZen(){
  zen=null;if(rnd()<0.2)return;
  const cx=W*R(0.04,0.14),cy=H*R(0.84,0.96),rx=W*R(0.2,0.27),ry=H*R(0.22,0.3),sc=SC(),rocks=[];
  for(let k=0,n=RI(1,3);k<n;k++){for(let t=0;t<40;t++){const x=cx+R(-0.2,0.7)*rx,y=cy+R(-0.7,0.1)*ry,xi=x|0,yi=y|0;
    if(xi<4||yi<4||xi>=W-4||yi>=H-4)continue;const i=yi*W+xi;if(wm[i]||distOut[i]<16)continue;
    if(((x-cx)/rx)**2+((y-cy)/ry)**2>0.6)continue;if(rocks.some(r=>Math.hypot(r.x-x,r.y-y)<r.r*4.5))continue;
    rocks.push({x,y,r:R(3.5,6)*sc});break;}}
  let any=0;
  const y0=Math.max(1,Math.floor(cy-ry-2)),y1=Math.min(H-2,Math.ceil(cy+ry+2)),x0=Math.max(1,Math.floor(cx-rx-2)),x1=Math.min(W-2,Math.ceil(cx+rx+2));
  for(let y=y0;y<=y1;y++)for(let x=x0;x<=x1;x++){const i=y*W+x;if(wm[i]||stoneCol[i])continue;
    const e=((x-cx)/rx)**2+((y-cy)/ry)**2+(fbm(x*0.08,y*0.08+700,3)-0.5)*0.35;if(e>1)continue;
    if(distOut[i]<9+bay(x,y)*3)continue;any++;
    if(e>0.92){bed[i]=hash2(x*5,y*3)>0.5?pack(108,104,94):pack(84,80,72);continue;}
    let ph=-1;for(const r of rocks){const d=Math.hypot((x+0.5-r.x)/1.15,y+0.5-r.y);if(d<r.r*3.4){ph=d;break;}}
    if(ph<0)ph=y+Math.sin(x*0.055)*2.2+Math.sin(x*0.013+1)*3;
    const m=((ph%3)+3)%3,hh=hash2(x*7+1,y*3+9);
    let c=m<1?[154,148,130]:m<2?[226,220,200]:[198,192,172];
    if(hh>0.93)c=[c[0]*0.86,c[1]*0.86,c[2]*0.86];else if(hh<0.05)c=[c[0]*1.08,c[1]*1.08,c[2]*1.06];
    bed[i]=packC(c[0],c[1],c[2]);}
  if(!any)return;
  for(const r of rocks){
    for(let y=Math.floor(r.y-r.r*1.9);y<=r.y+r.r*1.9;y++)for(let x=Math.floor(r.x-r.r*2.2);x<=r.x+r.r*2.2;x++){if(x<1||y<1||x>=W-1||y>=H-1)continue;
      if(wm[y*W+x])continue;const d=Math.hypot((x+0.5-r.x)/1.15,y+0.5-r.y)+(hash2(x,y)-0.5)*1.2;if(d>r.r*1.7)continue;
      const n=fbm(x*0.3,y*0.3+33,2),c=n>0.55?[96,140,54]:n>0.42?[70,116,44]:[50,90,38];bed[y*W+x]=pack(c[0],c[1],c[2]);}
    makeStone(bed,r.x,r.y,r.r*1.25,r.r,stoneBase(),true,false,true);}
  zen={cx,cy,rx,ry};
}
function genPath(){
  const sy=H*R(0.42,0.66);let end=null,bd=1e9;
  for(let k=0;k<4000;k++){const x=RI(4,Math.floor(W*0.5)),y=RI(4,H-5),i=y*W+x;if(wm[i]||stoneCol[i])continue;const dO=distOut[i];if(dO<3||dO>6)continue;
    const d=x*x+(y-sy)**2;if(d<bd){bd=d;end={x,y};}}
  if(!end||end.x<S*0.12)return;
  const sx=-2,dx=end.x-sx,dy=end.y-sy,L=Math.hypot(dx,dy),n=Math.floor(L/(S*0.05)),px=-dy/L,py=dx/L,bend=R(-0.2,0.2)*L;
  for(let k=1;k<=n;k++){const t=k/n,b=4*t*(1-t)*bend,alt=(k%2?1:-1)*S*0.008,x=sx+dx*t+px*(b+alt),y=sy+dy*t+py*(b+alt);
    const xi=x|0,yi=y|0;if(xi<2||yi<2||xi>=W-2||yi>=H-2)continue;const i=yi*W+xi;if(wm[i]||stoneCol[i]||distOut[i]<2.5)continue;
    const r=S*R(0.014,0.019),g=R(150,178);makeStone(bed,x,y,r*R(1.15,1.4),r,[g,g-3,g-10],rnd()<0.3,false,true);}
}
function genDeck(){
  deck=null;deckBuf.fill(0);
  const dw=Math.max(11,Math.round(S*0.075)),cx=Math.round(W*R(0.6,0.68));
  let ys=-1;for(let y=H-3;y>H*0.45;y--){if(wm[y*W+cx]){ys=y;break;}}
  if(ys<0)return;
  const y0=Math.max(Math.round(H*0.5),ys-Math.round(S*0.15)),x0=cx-(dw>>1),x1=x0+dw-1;
  deck={x0:x0-2,x1:x1+2,y0:y0-2};
  const woods=[[160,112,68],[146,100,60],[172,124,76],[138,94,56]];let pk=0;
  for(let y=y0;y<H;y++){const py=(y-y0)%3;if(py===0)pk=(hash2(y,91)*4)|0;
    for(let x=x0;x<=x1;x++){let c;
      if(py===2)c=[62,40,26];
      else{const w=woods[pk];let s=0.9+vnoise(x*0.5+pk*13,y*2.3)*0.2;if(py===0)s*=1.08;if(hash2(x*7,y*3)>0.97)s*=0.75;
        c=[w[0]*s,w[1]*s,w[2]*s];if(py===0&&(x===x0+1||x===x1-1))c=[64,60,58];}
      deckBuf[y*W+x]=packC(c[0],c[1],c[2]);}}
  const RL=[226,92,58],RM=[190,56,36],RD=[120,32,22],GOLD=[240,196,96];
  const put=(x,y,c)=>{if(x>=0&&y>=0&&x<W&&y<H)deckBuf[y*W+x]=packC(c[0],c[1],c[2]);};
  for(let y=y0-2;y<H;y++){put(x0-2,y,RL);put(x0-1,y,RD);put(x1+1,y,RL);put(x1+2,y,RD);}
  for(let x=x0-2;x<=x1+2;x++){put(x,y0-2,RL);put(x,y0-1,RD);}
  const post=(px,py)=>{for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++)put(px+dx,py+dy,(dx<0||dy<0)?RM:RD);put(px-1,py-1,RL);put(px,py,GOLD);};
  const step=Math.max(9,Math.round(S*0.06));
  for(let y=y0-2;y<H+1;y+=step){post(x0-2,y);post(x1+2,y);}
}
function genLantern(){
  lantern=null;const s=Math.max(5,Math.round(S*0.03));
  const inZen=(x,y)=>zen&&((x-zen.cx)/zen.rx)**2+((y-zen.cy)/zen.ry)**2<1.15;
  const p=randLand(s+3,s+9,(x,y)=>x<W*0.45&&y>H*0.38&&!inZen(x,y))||randLand(s+3,s+14,(x,y)=>(!deck||x<deck.x0-s-6||x>deck.x1+s+6)&&!inZen(x,y));
  if(!p)return;lantern={x:p.x,y:p.y,s};
  const put=(x,y,c)=>{if(x>0&&y>0&&x<W-1&&y<H-1)bed[y*W+x]=packC(c[0],c[1],c[2]);};
  for(let v=-s;v<=s*2.4;v++)for(let u=-s;u<=s*2.4;u++){const d=Math.hypot(u-s*0.75,(v-s*0.9)*1.1);if(d<s*1.05){const x=p.x+u,y=p.y+v;if(x>0&&y>0&&x<W&&y<H)scale(bed,y*W+x,0.55);}}
  for(let v=-s;v<=s*1.5;v++)for(let u=-s;u<=s*1.5;u++){const d=Math.hypot(u-s*0.3,v-s*0.42);if(d<s*0.78){const f=d>s*0.66?0.55:0.78;put(p.x+u,p.y+v,[128*f,126*f,118*f]);}}
  for(let v=-s-1;v<=s+1;v++)for(let u=-s-1;u<=s+1;u++){
    const d=Math.hypot(u,v);if(d>s+0.5)continue;
    const ang=Math.atan2(v,u),sec=Math.floor((ang+Math.PI)/(Math.PI/3))%6,secA=-Math.PI+sec*Math.PI/3+Math.PI/6,loc=wrapA(ang-secA),hr=s*0.866/Math.cos(loc);
    if(d>hr)continue;
    let f=0.86+0.26*Math.cos(secA+2.356)+(bay(p.x+u,p.y+v)-0.5)*0.1;f=f>1.02?1.12:f>0.86?0.94:0.76;
    if(d>s*0.24&&Math.abs(Math.abs(loc)-Math.PI/6)*d<0.75)f=1.2;
    if(d>hr-1.1)f*=0.68;
    let c=[156,154,144];
    if(d<s*0.26){const q=d/(s*0.26);c=[176,172,160];f=(q<0.45&&u<=0&&v<=0)?1.3:q>0.78?0.66:1.04;}
    else if(fbm((p.x+u)*0.45,(p.y+v)*0.45+900,3)>0.56)c=[84,118,58];
    const n=0.94+hash2(u+50,v+50)*0.12;put(p.x+u,p.y+v,[c[0]*f*n,c[1]*f*n,c[2]*f*n]);}
  for(let k=0;k<6;k++){const a=-Math.PI+k*Math.PI/3;put(Math.round(p.x+Math.cos(a)*(s+0.6)),Math.round(p.y+Math.sin(a)*(s+0.6)),[200,198,186]);}
}
function genSpout(){
  spout=null;const sc=SC();
  for(let tries=0;tries<700;tries++){
    const x=RI(Math.floor(W*0.28),Math.floor(W*0.72)),y=RI(6,Math.max(7,Math.floor(pondC.y-S*0.05))),i=y*W+x;
    if(wm[i]||stoneCol[i])continue;const dO=distOut[i];if(dO<2.5||dO>5)continue;
    const gx=distOut[i+1]-distOut[i-1],gy=distOut[i+W]-distOut[i-W],l=Math.hypot(gx,gy);if(l<0.1)continue;
    const dx=-gx/l,dy=-gy/l;if(dy<0.35)continue;
    const L=S*0.06,tx=x+dx*L,ty=y+dy*L;if(depthAt(tx,ty)<0.08||dIn(tx,ty)<3)continue;
    if(lantern&&Math.hypot(x-lantern.x,y-lantern.y)<lantern.s*3)continue;
    const sx=-dy,sy=dx,side=rnd()<0.5?1:-1;
    spout={px:x,py:y,dx,dy,sx,sy,L,ax:clamp(x-dx*S*0.035+sx*side*S*0.06,1,W-2),ay:clamp(y-dy*S*0.035+sy*side*S*0.06,1,H-2),
      bx:tx-dx*1.6,by:ty-dy*1.6,fill:R(0.2,0.8),st:0,tilt:0,t:0,knock:0};
    makeStone(bed,x-dx*(L*0.35+2.5),y-dy*(L*0.35+2.5),2.6*sc,2.2*sc,[150,148,140],true,false,true);
    break;}
}
const LEAFP={maple:[[96,22,26],[150,38,32],[204,72,42],[242,130,66]],ginkgo:[[140,92,24],[198,144,36],[234,190,62],[254,228,128]],
  sakura:[[160,84,112],[214,128,160],[242,174,198],[255,220,232]],pine:[[18,44,34],[30,70,46],[50,100,56],[86,134,70]],
  momiji:[[40,70,30],[70,110,40],[110,150,54],[166,190,80]]};
function boxBlur(src,r){const tmp=new Float32Array(N),dst=new Float32Array(N),k=1/(2*r+1);
  for(let y=0;y<H;y++)for(let x=0;x<W;x++){let s=0;for(let d=-r;d<=r;d++)s+=src[y*W+clamp(x+d,0,W-1)];tmp[y*W+x]=s*k;}
  for(let y=0;y<H;y++)for(let x=0;x<W;x++){let s=0;for(let d=-r;d<=r;d++)s+=tmp[clamp(y+d,0,H-1)*W+x];dst[y*W+x]=s*k;}return dst;}
function genCanopy(){
  canA.fill(0);canB.fill(0);canPix=[];
  const corners=[[-0.04,-0.08],[1.04,-0.08],[1.05,1.08]],use=[0,1];if(rnd()<0.7)use.push(2);
  const pool=[LEAFP.maple,LEAFP.sakura,LEAFP.ginkgo,LEAFP.pine,LEAFP.momiji].sort(()=>rnd()-0.5);
  const pals=pool.slice(0,use.length);if(!pals.includes(LEAFP.maple))pals[0]=LEAFP.maple;
  const trees=use.map((ci,k)=>({x:corners[ci][0]*W,y:corners[ci][1]*H,r:S*R(0.3,0.38),pal:pals[k],isl:false}));
  if(island)trees.push({x:island.x+0.5,y:island.y-1,r:island.r*1.25,pal:LEAFP.pine,isl:true});
  const cl=[];
  for(const t of trees){const n=t.isl?16:Math.floor(t.r*1.1);
    for(let j=0;j<n;j++){const a=R(TAU),d=Math.sqrt(rnd())*t.r;
      cl.push({x:t.x+Math.cos(a)*d,y:t.y+Math.sin(a)*d,r:t.isl?t.r*R(0.32,0.5):S*R(0.045,0.085),h:rnd()*0.6+0.4*(1-d/t.r),pal:t.pal,layer:t.isl?1:(rnd()<0.5?0:1)});}}
  cl.sort((a,b)=>a.h-b.h);
  for(const c of cl){const buf=c.layer?canB:canA,rr=c.r,p=c.pal,leafy=p!==LEAFP.pine;
    for(let y=Math.max(0,Math.floor(c.y-rr-1));y<=Math.min(H-1,c.y+rr+1);y++)for(let x=Math.max(0,Math.floor(c.x-rr-1));x<=Math.min(W-1,c.x+rr+1);x++){
      const dx=(x+0.5-c.x)/rr,dy=(y+0.5-c.y)/rr,d=Math.sqrt(dx*dx+dy*dy)+(hash2(x*5+1,y*3+2)-0.5)*0.3;if(d>1)continue;
      const lt=CT[((((y*2.3)|0)&63)<<6)|(((x*2.3)|0)&63)];
      const sh=0.34+c.h*0.46+(-dx-dy)*0.24-d*d*0.2+(fbm(x*0.3,y*0.3+500,3)-0.5)*0.3+(bay(x,y)-0.5)*0.14-lt*0.16;
      let col;if(d>0.9&&dx+dy>0.1)col=[p[0][0]*0.7,p[0][1]*0.7,p[0][2]*0.75];else col=sh>0.84?p[3]:sh>0.64?p[2]:sh>0.44?p[1]:p[0];
      const i=y*W+x;buf[i]=packC(col[0],col[1],col[2]);if(leafy&&rnd()<0.08)canPix.push(i);}}
  const ox=Math.round(S*0.07),oy=Math.round(S*0.055),a=new Float32Array(N);
  for(let y=0;y<H;y++)for(let x=0;x<W;x++){const j=clamp(y-oy,0,H-1)*W+clamp(x-ox,0,W-1);a[y*W+x]=(canA[j]||canB[j])?1:0;}
  shadowMap=boxBlur(boxBlur(a,2),2);
}
const PADC=[[54,122,50],[66,134,54],[80,142,58],[94,136,54],[104,118,48]];
const FLOWERC=[{o:[232,108,152],i:[252,214,228]},{o:[240,232,232],i:[255,252,248]},{o:[236,146,178],i:[255,228,238]}];
function genPads(){
  pads=[];const sc=SC(),count=clamp(Math.round(waterCount/2000),6,20),centers=[];
  for(let k=0,nc=RI(2,3);k<nc;k++){const p=randWater(0.15,1);if(p)centers.push(p);}
  if(!centers.length)return;
  const tip=spout?{x:spout.px+spout.dx*spout.L,y:spout.py+spout.dy*spout.L}:null;
  let tries=0;
  while(pads.length<count&&tries++<1200){const c=pick(centers),a=R(TAU),d=R(0,S*0.17),x=c.x+Math.cos(a)*d,y=c.y+Math.sin(a)*d,r=R(3.2,6.5)*sc;
    if(dIn(x,y)<r+2)continue;
    if(deck&&x>deck.x0-r-3&&x<deck.x1+r+3&&y>deck.y0-r-3)continue;
    if(tip&&Math.hypot(x-tip.x,y-tip.y)<r+10)continue;
    if(pads.some(p=>Math.hypot(p.x-x,p.y-y)<p.r+r+0.5))continue;
    const holes=[],dr=[];
    if(rnd()<0.3)for(let k=0,nh=RI(1,2);k<nh;k++)holes.push({a:R(0.8,TAU-0.8),d:R(0.35,0.8),s:R(0.5,1.2)});
    for(let k=0,nd=RI(0,2);k<nd;k++)dr.push({a:R(0.8,TAU-0.8),d:R(0.25,0.7)});
    pads.push({x,y,r,vx:0,vy:0,rot:R(TAU),av:0,notch:R(0.25,0.42),col:pick(PADC),flower:rnd()<0.3,fc:pick(FLOWERC),fo:R(0.8,TAU-0.8),
      yel:rnd()<0.22,seed:R(100),holes,dr,frog:null});}
}
const BFC=[[[248,246,236],[40,40,44]],[[250,222,90],[170,116,30]],[[160,196,250],[60,80,150]]];
function genEntities(){
  fish=[];pellets=[];leaves=[];bubbles=[];drops=[];sinkers=[];scares=[];hoverFish=null;mouse.grab=null;
  const sc=SC(), small=innerWidth<760;
  for(let k=0,nf=clamp(Math.round(waterCount/1500),small?5:8,small?12:22);k<nf;k++){const p=randWater(0.35,1)||randWater(0.1,1);if(p)fish.push(new Fish(p.x,p.y));}
  genPads();
  plants=[];
  for(let k=0,np=clamp(Math.round(waterCount/700),small?5:8,small?18:40);k<np;k++){const p=randWater(0.18,0.85);if(!p)continue;const blades=[];
    for(let j=0,nb=RI(3,6);j<nb;j++)blades.push({a:R(TAU),len:R(5,13)*sc,o:R(TAU),c:pick([[54,96,44],[70,116,48],[44,84,52],[88,120,52]])});
    plants.push({x:p.x,y:p.y,ph:R(TAU),blades});}
  reeds=[];const rb=[];
  const nearSpout=(x,y)=>spout&&Math.hypot(x-spout.px,y-spout.py)<S*0.09;
  for(let y=2;y<H-2;y++)for(let x=2;x<W-2;x++){const i=y*W+x;
    if(!wm[i]&&distOut[i]<=1.5&&!(deck&&x>=deck.x0-5&&x<=deck.x1+5&&y>=deck.y0-5)&&
      !(lantern&&Math.abs(x-lantern.x)<lantern.s+7&&Math.abs(y-lantern.y)<lantern.s+7)&&!nearSpout(x,y))rb.push([x,y]);}
  if(rb.length)for(let k=0,nr=RI(9,14);k<nr;k++){const b=pick(rb),st=[],iris=rnd()<0.4;
    for(let j=0,ns=RI(5,10);j<ns;j++)st.push({x:b[0]+R(-2.5,2.5),y:b[1]+R(-2.5,2.5),a:R(TAU),l:R(3,7)*sc,cat:!iris&&rnd()<0.35,iris:iris&&j<2,ph:R(TAU),
      c:pick([[88,122,50],[104,134,56],[120,140,60],[74,110,46]])});
    reeds.push(st);}
  striders=[];for(let k=0,n=RI(3,6);k<n;k++){const p=randWater(0.1,1);if(p)striders.push({x:p.x,y:p.y,vx:0,vy:0,a:R(TAU),t:R(60),fa:0});}
  dflies=[];for(let k=0;k<2;k++)dflies.push({x:R(W),y:R(H),z:12,zt:12,tx:R(W),ty:R(H),h:0,t:0,ph:R(TAU),dip:0,vis:true,
    c:k?[[210,60,36],[150,36,26],[250,130,90]]:[[40,170,210],[28,104,150],[150,230,245]]});
  fireflies=[];for(let k=0;k<36;k++)fireflies.push({x:R(W),y:R(H),vx:0,vy:0,ph:R(TAU),sp:R(1.5,3.5),g:0,on:false});
  vents=[];for(let k=0;k<2;k++){const p=randWater(0.6,1);if(p)vents.push(p);}
  let best=null,bd=1e9;for(let k=0;k<400;k++){const p=randWater(0.3,1);if(!p)continue;const d=(p.x-W*0.36)**2+(p.y-H*0.4)**2;if(d<bd){bd=d;best=p;}}
  moon=best||{x:W/2,y:H/2};
  frogs=[];const cand=pads.filter(p=>!p.flower&&p.r>=3.8*sc);
  for(let k=0,nf=Math.min(cand.length,RI(1,2));k<nf;k++){const p=cand.splice(RI(0,cand.length-1),1)[0];frogs.push(newFrog(p));}
  flies=[];for(let k=0;k<3;k++)flies.push({x:R(W),y:R(H),tx:R(W),ty:R(H),t:0,ph:R(TAU),c:pick(BFC),z:10,rest:0,h:R(TAU),vis:true,s:sc*0.8});
}
function genVignette(){for(let y=0;y<H;y++)for(let x=0;x<W;x++){const dx=(x/W-0.5)*2,dy=(y/H-0.5)*2;vig[y*W+x]=1-0.32*Math.pow(Math.sqrt(dx*dx+dy*dy)/1.4142,2.4);}}
const WR=[[126,188,162],[94,162,142],[66,134,126],[46,106,110],[32,82,94],[22,60,76],[14,40,58]];
function genTint(){for(let i=0;i<N;i++){if(!wm[i])continue;const x=i%W,y=i/W|0;
  const q=clamp(Math.round(depth[i]*6.3+(bay(x,y)-0.5)*1.0-0.2),0,6),c=WR[q];wtint[i]=pack(c[0],c[1],c[2]);}}

/* ================= field queries ================= */
function depthAt(x,y){if(x<0||y<0||x>=W||y>=H)return -1;const i=(y|0)*W+(x|0);return wm[i]?depth[i]:-1;}
function dIn(x,y){if(x<0||y<0||x>=W||y>=H)return 0;const i=(y|0)*W+(x|0);return wm[i]?distIn[i]:0;}
function waveAt(x,y){if(x<0||y<0||x>=W||y>=H)return 0;const i=(y|0)*W+(x|0);return wm[i]?w0[i]:0;}
function shoreGrad(x,y){let gx=dIn(x+2,y)-dIn(x-2,y),gy=dIn(x,y+2)-dIn(x,y-2),l=Math.sqrt(gx*gx+gy*gy);
  if(l<0.01){gx=pondC.x-x;gy=pondC.y-y;l=Math.sqrt(gx*gx+gy*gy)||1;}return[gx/l,gy/l];}
function padAt(x,y){for(const p of pads){const dx=x-p.x,dy=y-p.y;if(dx*dx+dy*dy<p.r*p.r)return p;}return null;}

/* ================= water simulation ================= */
function waveStep(){const a=w0,b=w1,D=0.988;
  for(let y=1;y<H-1;y++){let i=y*W+1;for(let x=1;x<W-1;x++,i++){if(!wm[i]){b[i]=0;continue;}b[i]=((a[i-1]+a[i+1]+a[i-W]+a[i+W])*0.5-b[i])*D;}}
  w0=b;w1=a;}
function disturb(x,y,r,s){const rr=Math.ceil(r),cx=Math.floor(x),cy=Math.floor(y);
  for(let dy=-rr;dy<=rr;dy++)for(let dx=-rr;dx<=rr;dx++){const d=Math.sqrt(dx*dx+dy*dy);if(d>r)continue;const xx=cx+dx,yy=cy+dy;
    if(xx<1||yy<1||xx>=W-1||yy>=H-1)continue;const i=yy*W+xx;if(wm[i])w0[i]+=s*(0.5+0.5*Math.cos(Math.PI*d/r));}}
function scare(x,y,r,k){scares.push({x,y,r,k,life:1});}

/* ================= koi ================= */
const KOI=[
 {b:[248,244,234],p1:[226,56,36],w:3},
 {b:[248,244,234],p1:[226,56,36],p2:[24,22,28],w:2},
 {b:[28,26,32],p1:[224,60,36],p2:[246,242,232],w:2,showa:1},
 {b:[250,248,242],p1:[230,34,34],tancho:1,w:1},
 {b:[246,192,62],met:1,w:1.4},
 {b:[232,236,236],met:1,w:1},
 {b:[108,140,176],p1:[226,100,52],asagi:1,w:1.2},
 {b:[150,100,58],w:0.8},
 {b:[246,212,72],met:1,w:0.8},
 {b:[238,234,226],p1:[236,118,40],asagi:1,met:1,w:0.8},
 {b:[248,244,234],p2:[24,22,28],w:1},
 {b:[24,22,28],p2:[246,242,232],showa:1,w:1},
 {b:[24,22,28],p2:[246,210,70],showa:1,w:0.7},
 {b:[60,64,70],met:1,w:0.6},
 {b:[246,118,30],p2:[250,240,228],small:1,w:1.2}];
const PU=32,PV=9;
function pickType(){const tot=KOI.reduce((a,k)=>a+k.w,0);let r=rnd()*tot;for(const k of KOI){r-=k.w;if(r<=0)return k;}return KOI[0];}
function makePattern(k){
  const p=new Uint8Array(PU*PV);
  const blob=(idx,cu,cv,ru,rv)=>{for(let u=0;u<PU;u++)for(let v=0;v<PV;v++){const uu=(u+0.5)/PU,vv=v/(PV-1)*2-1,dx=(uu-cu)/ru,dy=(vv-cv)/rv;if(dx*dx+dy*dy+(rnd()-0.5)*0.35<1)p[u*PV+v]=idx;}};
  if(k.tancho)blob(1,0.08,0,0.065,0.75);
  else if(k.asagi){for(let u=0;u<PU;u++)for(let v=0;v<PV;v++){const vv=v/(PV-1)*2-1;p[u*PV+v]=(Math.abs(vv)>0.62&&u>4)?1:((u+v)%2===0?3:0);}}
  else{
    if(k.p1){if(rnd()<0.7)blob(1,R(0.05,0.12),R(-0.2,0.2),R(0.07,0.12),R(0.6,1.1));for(let j=0,nb=RI(2,4);j<nb;j++)blob(1,R(0.18,0.85),R(-0.7,0.7),R(0.07,0.17),R(0.5,1.3));}
    if(k.p2){const sh=k.showa||k.small;for(let j=0,ns=sh?RI(2,4):RI(3,7);j<ns;j++)blob(2,R(sh?0.05:0.18,0.9),R(-0.9,0.9),sh?R(0.06,0.14):R(0.03,0.06),sh?R(0.5,1.1):R(0.3,0.6));}
  }
  return p;
}
class Fish{
  constructor(x,y){
    const k=this.k=pickType();this.pat=makePattern(k);
    const b=k.b;this.pal=[b,k.p1||b,k.p2||b,[b[0]*0.78,b[1]*0.78,b[2]*0.84],[38,34,40]];
    const lum=b[0]*0.3+b[1]*0.59+b[2]*0.11;
    this.long=!k.small&&rnd()<0.25;
    if(!k.small&&rnd()<0.18)for(let u=4;u<PU-5;u+=3){this.pat[u*PV+2]=4;this.pat[u*PV+6]=4;}
    if(k.showa){this.fin0=[30,28,34];this.fin1=[240,236,226];}
    else if(lum<90){this.fin0=[50,50,58];this.fin1=[110,112,124];}
    else if(k.small){this.fin0=[250,140,60];this.fin1=[255,214,170];}
    else{this.fin0=lerpC(b,[255,255,255],0.35);this.fin1=[250,248,244];}
    if(k.met&&!k.showa){this.fin0=lerpC(b,[255,255,255],0.2);this.fin1=lerpC(b,[255,255,255],0.6);}
    this.sc=SC();this.len=(k.small?R(9,13):R(14,25))*this.sc;
    this.n=10;this.a=R(TAU);this.pts=[];const seg=this.len/(this.n-1);
    for(let j=0;j<this.n;j++)this.pts.push({x:x-Math.cos(this.a)*seg*j,y:y-Math.sin(this.a)*seg*j});
    this.speed=0.3;this.cruise=R(0.22,0.38)*this.sc;this.wa=0;this.z=R(0.2,0.6);this.tz=this.z;this.phase=R(TAU);this.fed=0;this.id=fishId++;this.mouth=0;
  }
}
function updateFish(f,dt){
  const h=f.pts[0],ca=Math.cos(f.a),sa=Math.sin(f.a);
  if(f.mouth>0)f.mouth-=dt;
  f.wa+=(rnd()-0.5)*0.12*dt;f.wa*=Math.pow(0.985,dt);f.wa=clamp(f.wa,-1.2,1.2);
  let tx=Math.cos(f.a+f.wa),ty=Math.sin(f.a+f.wa),spd=f.cruise,turn=0.03;
  const need=0.06+f.len*0.002,look=5+f.len*0.6;
  const dA=depthAt(h.x+ca*look,h.y+sa*look),dL=depthAt(h.x+Math.cos(f.a-0.6)*look*0.7,h.y+Math.sin(f.a-0.6)*look*0.7),dR=depthAt(h.x+Math.cos(f.a+0.6)*look*0.7,h.y+Math.sin(f.a+0.6)*look*0.7);
  if(dA<need||dL<need||dR<need){const g=shoreGrad(h.x,h.y);tx+=g[0]*3;ty+=g[1]*3;turn=0.08;const s=dR>dL?0.9:-0.9;tx+=Math.cos(f.a+s)*1.5;ty+=Math.sin(f.a+s)*1.5;}
  let cx=0,cy=0,ax=0,ay=0,cn=0;
  for(const o of fish){if(o===f)continue;const dx=o.pts[0].x-h.x,dy=o.pts[0].y-h.y,d2=dx*dx+dy*dy,sep=(f.len+o.len)*0.45;
    if(d2<sep*sep&&d2>0.01){const d=Math.sqrt(d2),k=1.4*(1-d/sep);tx-=dx/d*k;ty-=dy/d*k;}
    else if(d2<2500){cx+=dx;cy+=dy;ax+=Math.cos(o.a);ay+=Math.sin(o.a);cn++;}}
  if(cn){tx+=cx/cn*0.004+ax/cn*0.15;ty+=cy/cn*0.004+ay/cn*0.15;}
  let best=null,bd=(110*f.sc)**2;
  for(const p of pellets){if(p.air>0||p.dead||p.sink>0)continue;const dx=p.x-h.x,dy=p.y-h.y,d2=dx*dx+dy*dy;if(d2<bd){bd=d2;best=p;}}
  if(best){const d=Math.sqrt(bd)+0.001;tx+=(best.x-h.x)/d*3.5;ty+=(best.y-h.y)/d*3.5;spd=f.cruise*2.6;turn=0.1;f.tz=0.02;
    if(d<Math.max(2.2,f.len*0.14)&&f.z<0.14)eat(f,best);}
  else if(tool==='feed'&&mouse.over&&mouse.still>40&&!mouse.down){const dx=mouse.x-h.x,dy=mouse.y-h.y,d2=dx*dx+dy*dy;
    if(d2<(80*f.sc)**2&&d2>25){const d=Math.sqrt(d2);tx+=dx/d*0.9;ty+=dy/d*0.9;f.tz=Math.min(f.tz,0.06);spd=f.cruise*(d<12?0.4:1.3);
      if(d<12&&f.z<0.1&&(frame+f.id*7)%50===0){disturb(h.x+ca*1.5,h.y+sa*1.5,1.3,0.9);f.mouth=14;if(rnd()<0.5)Snd.plop(0.8,h.x/W*2-1,0.12);}}}
  for(const s of scares){const dx=h.x-s.x,dy=h.y-s.y,d2=dx*dx+dy*dy;if(d2<s.r*s.r){const d=Math.sqrt(d2)+0.01,k=(1-d/s.r)*s.k*s.life;
    tx+=dx/d*6*k;ty+=dy/d*6*k;spd=Math.max(spd,f.cruise*(1+4*k));turn=0.16;f.tz=Math.min(0.9,f.z+0.4);}}
  if(!best&&rnd()<0.003*dt)f.tz=R(0.12,0.65);
  const diff=wrapA(Math.atan2(ty,tx)-f.a),mt=turn*dt*(1+f.speed);f.a+=clamp(diff,-mt,mt);
  f.speed+=(spd-f.speed)*0.04*dt;
  const nx=h.x+Math.cos(f.a)*f.speed*dt,ny=h.y+Math.sin(f.a)*f.speed*dt;
  if(depthAt(nx,ny)<0.025){f.a+=0.25*dt*(f.wa>=0?1:-1);f.speed*=0.8;}else{h.x=nx;h.y=ny;}
  const seg=f.len/(f.n-1);
  for(let k=1;k<f.n;k++){const p=f.pts[k],q=f.pts[k-1],dx=p.x-q.x,dy=p.y-q.y,d=Math.sqrt(dx*dx+dy*dy)||1;p.x=q.x+dx/d*seg;p.y=q.y+dy/d*seg;}
  const mz=Math.max(0.02,depthAt(h.x,h.y)-0.05);
  f.z+=(clamp(f.tz,0.02,mz)-f.z)*0.025*dt;if(f.z>mz)f.z=mz;
  f.phase+=(0.06+f.speed*0.4/f.sc)*dt;
  if(f.z<0.1&&f.speed>0.25&&(frame+f.id)%5===0)disturb(h.x,h.y,1.5,0.35*f.sc);
  if(rnd()<0.0006*dt)bubbles.push({x:h.x,y:h.y,z:f.z,r:R(0.5,1.2),id:R(99)});
}
function eat(f,p){
  p.dead=1;f.fed++;f.mouth=16;f.len=Math.min(f.len+0.3*f.sc,(f.k.small?16:34)*f.sc);
  disturb(p.x,p.y,2,1.3);Snd.gulp(p.x/W*2-1);
  for(let k=0;k<3;k++){const a=R(TAU);drops.push({x:p.x,y:p.y,z:0.3,vx:Math.cos(a)*0.4,vy:Math.sin(a)*0.4,vz:R(0.5,1)});}
  f.tz=R(0.05,0.3);
}
const RX=new Float32Array(16),RY=new Float32Array(16),TXa=new Float32Array(16),TYa=new Float32Array(16);
let SX=0,SY=0,STX=0,STY=0;
function prepSpine(f){
  const n=f.n,P=f.pts,amp=f.len*0.06*(0.55+Math.min(1.6,f.speed/f.sc)*0.7);
  for(let k=0;k<n;k++){const a=P[Math.max(0,k-1)],b=P[Math.min(n-1,k+1)];let tx=a.x-b.x,ty=a.y-b.y;const l=Math.sqrt(tx*tx+ty*ty)||1;tx/=l;ty/=l;
    const s=k/(n-1),off=Math.sin(f.phase-s*4.2)*amp*(0.12+s*s*1.15);RX[k]=P[k].x-ty*off;RY[k]=P[k].y+tx*off;}
  for(let k=0;k<n;k++){const a=Math.max(0,k-1),b=Math.min(n-1,k+1);const tx=RX[a]-RX[b],ty=RY[a]-RY[b],l=Math.sqrt(tx*tx+ty*ty)||1;TXa[k]=tx/l;TYa[k]=ty/l;}
}
function spineAt(f,s){const fk=s*(f.n-1);let k0=fk|0;if(k0>=f.n-1)k0=f.n-2;const fr=fk-k0;
  SX=RX[k0]+(RX[k0+1]-RX[k0])*fr;SY=RY[k0]+(RY[k0+1]-RY[k0])*fr;
  const tx=TXa[k0]+(TXa[k0+1]-TXa[k0])*fr,ty=TYa[k0]+(TYa[k0+1]-TYa[k0])*fr,l=Math.sqrt(tx*tx+ty*ty)||1;STX=tx/l;STY=ty/l;}
const widthAt=s=>Math.pow(Math.sin(Math.PI*Math.min(1,s*0.85+0.12)),0.8)*(1-0.6*s);
function drawFishShadow(f){
  prepSpine(f);
  const bd=Math.max(f.z,depthAt(RX[0],RY[0])),dz=Math.max(0,bd-f.z),off=1.5+dz*S*0.07,ox=off,oy=off*0.8,dark=0.62+dz*0.3,id=++markId,W0=f.len*0.18;
  const steps=Math.ceil(f.len*1.2);
  for(let st=0;st<=steps;st++){const s=st/steps;spineAt(f,s);const w=W0*widthAt(s)*0.95+0.3,cx=SX+ox,cy=SY+oy,w2=w*w;
    for(let py=Math.floor(cy-w);py<=cy+w;py++)for(let px=Math.floor(cx-w);px<=cx+w;px++){if(px<0||py<0||px>=W||py>=H)continue;
      const dx=px+0.5-cx,dy=py+0.5-cy;if(dx*dx+dy*dy>w2)continue;const i=py*W+px;
      if(!wm[i]||mark[i]===id||uD[i]<depth[i]-0.001)continue;mark[i]=id;scale(under,i,dark);}}
}
function fan(bx,by,a0,spread,len,c0,c1,alpha,id,z,fork,ph){
  const RR=len*1.12+1,RR2=RR*RR,rk=len*1.2,x0=Math.max(0,Math.floor(bx-RR)),x1=Math.min(W-1,Math.ceil(bx+RR)),y0=Math.max(0,Math.floor(by-RR)),y1=Math.min(H-1,Math.ceil(by+RR));
  for(let py=y0;py<=y1;py++)for(let px=x0;px<=x1;px++){
    const i=py*W+px;if(!wm[i]||mark[i]===id||z>uD[i]+0.001)continue;
    const dx=px+0.5-bx,dy=py+0.5-by,d2=dx*dx+dy*dy;if(d2>RR2||d2<0.09)continue;
    const da=wrapA(Math.atan2(dy,dx)-a0);if(da>spread||da<-spread)continue;
    const t=da/spread,at=t<0?-t:t;
    let rl=fork?len*(0.6+0.4*Math.pow(at,0.7)):len*(1-0.4*t*t);
    if(ph!==undefined)rl*=1+0.09*Math.sin(t*5+ph*1.3);
    const d=Math.sqrt(d2);if(d>rl)continue;
    const q=d/rl;let a=alpha*(1-q*0.35)*(Math.cos(da*rk)>0.2?1.2:0.8);if(q>0.84)a*=1.3;if(a>1)a=1;
    mark[i]=id;blend(under,i,c0[0]+(c1[0]-c0[0])*q,c0[1]+(c1[1]-c0[1])*q,c0[2]+(c1[2]-c0[2])*q,a);uD[i]=z;}
}
function stampBody(f,cx,cy,nx,ny,w,s,bid){
  const w2=w*w,ui=Math.min(PU-1,(s*PU)|0)*PV,pal=f.pal,pat=f.pat,met=f.k.met,z=f.z,hd=s<0.13?0.03:0,mph=s*9-T*2.2+f.id;
  const x0=Math.max(0,Math.floor(cx-w)),x1=Math.min(W-1,Math.floor(cx+w)),y0=Math.max(0,Math.floor(cy-w)),y1=Math.min(H-1,Math.floor(cy+w));
  for(let py=y0;py<=y1;py++)for(let px=x0;px<=x1;px++){
    const dx=px+0.5-cx,dy=py+0.5-cy;if(dx*dx+dy*dy>w2)continue;
    const i=py*W+px;if(!wm[i]||z>uD[i]+0.001)continue;
    const v=(dx*nx+dy*ny)/w;let vi=Math.round((v+1)*0.5*(PV-1));vi=vi<0?0:vi>PV-1?PV-1:vi;
    const c=pal[pat[ui+vi]];
    let sh=1.05-v*v*0.34+(-dx-dy)/w*0.13+hd+(BAY[((py&3)<<2)|(px&3)]-0.5)*0.1;
    if(met)sh+=Math.sin(mph+v*2)>0.8?0.2:0.04;
    sh=sh>1.12?1.2:sh>0.97?1.05:sh>0.82?0.9:0.76;
    under[i]=packC(c[0]*sh,c[1]*sh,c[2]*sh);uD[i]=z;mark[i]=bid;}
}
function drawFish(f){
  prepSpine(f);
  const L=f.len,W0=L*0.18,n=f.n,z=f.z,f0=f.fin0,f1=f.fin1;
  const ta=Math.atan2(-TYa[n-1],-TXa[n-1])+Math.sin(f.phase-4.6)*0.35;
  fan(RX[n-1]+TXa[n-1]*0.8,RY[n-1]+TYa[n-1]*0.8,ta,f.long?0.78:0.62,L*(f.long?0.44:0.28),f0,f1,0.72,++markId,z,true,f.long?f.phase:undefined);
  const fb=Math.sin(f.phase*0.55)*0.3;
  for(const [sp,th,fl,spr] of [[0.24,1.05,f.long?0.25:0.16,0.45],[0.52,0.8,f.long?0.15:0.095,0.38]]){
    spineAt(f,sp);const ww=W0*widthAt(sp)*0.72,id=++markId,sx=SX,sy=SY,tx=STX,ty=STY;
    for(const side of [-1,1]){const nx=-ty*side,ny=tx*side,t=th+fb*side*(sp<0.4?1:0.5);
      const dx=-tx*Math.cos(t)+nx*Math.sin(t),dy=-ty*Math.cos(t)+ny*Math.sin(t);
      fan(sx+nx*ww,sy+ny*ww,Math.atan2(dy,dx),spr,L*fl,f0,f1,0.62,id,z,false,f.long?f.phase+side:undefined);}}
  const bid=++markId;let mnx=1e9,mxx=-1e9,mny=1e9,mxy=-1e9;
  const steps=Math.ceil(L*1.8);
  for(let st=0;st<=steps;st++){const s=st/steps;spineAt(f,s);const w=W0*widthAt(s)+0.35;stampBody(f,SX,SY,-STY,STX,w,s,bid);
    if(SX-w<mnx)mnx=SX-w;if(SX+w>mxx)mxx=SX+w;if(SY-w<mny)mny=SY-w;if(SY+w>mxy)mxy=SY+w;}
  const X0=Math.max(1,Math.floor(mnx)),X1=Math.min(W-2,Math.ceil(mxx)),Y0=Math.max(1,Math.floor(mny)),Y1=Math.min(H-2,Math.ceil(mxy));
  for(let y=Y0;y<=Y1;y++)for(let x=X0;x<=X1;x++){const i=y*W+x;if(mark[i]!==bid)continue;
    if(mark[i-1]!==bid||mark[i+1]!==bid||mark[i-W]!==bid||mark[i+W]!==bid)scale(under,i,0.7);}
  for(let s=0.28;s<=0.62;s+=0.6/L){spineAt(f,s);const sw=Math.sin(f.phase*0.9-s*4)*W0*0.15,px=Math.floor(SX-STY*sw),py=Math.floor(SY+STX*sw);
    if(px<0||py<0||px>=W||py>=H)continue;const i=py*W+px;if(mark[i]===bid)blend(under,i,f0[0],f0[1],f0[2],0.4);}
  spineAt(f,0.075);const we=W0*widthAt(0.075)*0.6;
  for(const side of [-1,1]){const ex=Math.floor(SX-STY*side*we),ey=Math.floor(SY+STX*side*we);if(ex<0||ey<0||ex>=W||ey>=H)continue;
    const i=ey*W+ex;if(mark[i]===bid)under[i]=pack(16,16,22);}
  spineAt(f,0);const hx=SX+STX*0.6,hy=SY+STY*0.6;
  if(f.mouth>0&&hx>=0&&hy>=0&&hx<W&&hy<H){const i=(hy|0)*W+(hx|0);if(mark[i]===bid)under[i]=pack(70,30,36);}
  if(!f.k.small)for(const side of [-1,1]){const bx=hx-STY*side*W0*0.35+STX*0.9,by=hy+STX*side*W0*0.35+STY*0.9,xi=bx|0,yi=by|0;
    if(xi<0||yi<0||xi>=W||yi>=H)continue;const i=yi*W+xi;if(wm[i]&&mark[i]!==bid&&z<=uD[i]+0.001)blend(under,i,f1[0],f1[1],f1[2],0.45);}
}

/* ================= other life ================= */
function updatePads(dt){
  for(const p of pads){
    const hL=waveAt(p.x-p.r,p.y),hR=waveAt(p.x+p.r,p.y),hU=waveAt(p.x,p.y-p.r),hD=waveAt(p.x,p.y+p.r);
    p.vx+=(hL-hR)*0.012*dt+env.windX*0.0006*dt;p.vy+=(hU-hD)*0.012*dt;
    p.av+=(waveAt(p.x+p.r*0.7,p.y-p.r*0.7)-waveAt(p.x-p.r*0.7,p.y+p.r*0.7))*0.0015*dt;
    const di=dIn(p.x,p.y);if(di<p.r+1.5){const g=shoreGrad(p.x,p.y),k=(p.r+1.5-di)*0.02;p.vx+=g[0]*k*dt;p.vy+=g[1]*k*dt;}
    for(const f of fish){if(f.z>0.18)continue;const dx=f.pts[0].x-p.x,dy=f.pts[0].y-p.y;if(dx*dx+dy*dy<p.r*p.r){p.vx+=Math.cos(f.a)*0.004*f.speed*dt;p.vy+=Math.sin(f.a)*0.004*f.speed*dt;p.av+=(rnd()-0.5)*0.0008;}}
    if(mouse.grab===p){p.vx+=(mouse.x-p.x)*0.05*dt;p.vy+=(mouse.y-p.y)*0.05*dt;p.vx*=0.85;p.vy*=0.85;
      if(p.vx*p.vx+p.vy*p.vy>0.2&&frame%3===0)disturb(p.x-p.vx*p.r,p.y-p.vy*p.r,1.5,0.5);}
    const dr=Math.pow(0.975,dt);p.vx*=dr;p.vy*=dr;p.av*=Math.pow(0.97,dt);
    const ox=p.x,oy=p.y;p.x+=p.vx*dt;p.y+=p.vy*dt;p.rot+=p.av*dt;
    if(depthAt(p.x,p.y)<0){p.x=ox;p.y=oy;p.vx*=-0.5;p.vy*=-0.5;}
    if(deck){const l=deck.x0-1-p.r,r=deck.x1+2+p.r,t=deck.y0-1-p.r;if(p.x>l&&p.x<r&&p.y>t){const a=p.x-l,b=r-p.x,c=p.y-t,m=Math.min(a,b,c);
      if(m===a){p.x=l;p.vx=-Math.abs(p.vx)*0.3;}else if(m===b){p.x=r;p.vx=Math.abs(p.vx)*0.3;}else{p.y=t;p.vy=-Math.abs(p.vy)*0.3;}}}
  }
  for(let a=0;a<pads.length;a++)for(let b=a+1;b<pads.length;b++){const p=pads[a],q=pads[b],dx=q.x-p.x,dy=q.y-p.y,d2=dx*dx+dy*dy,m=p.r+q.r+0.3;
    if(d2<m*m&&d2>1e-4){const d=Math.sqrt(d2),o=(m-d)*0.5,nx=dx/d,ny=dy/d;p.x-=nx*o;p.y-=ny*o;q.x+=nx*o;q.y+=ny*o;
      const rv=(q.vx-p.vx)*nx+(q.vy-p.vy)*ny;if(rv<0){p.vx+=rv*nx*0.5;p.vy+=rv*ny*0.5;q.vx-=rv*nx*0.5;q.vy-=rv*ny*0.5;}p.av+=0.0004;q.av-=0.0004;}}
}
function updatePellets(dt){
  for(const p of pellets){if(p.dead)continue;
    if(p.air>0){p.air-=dt;if(p.air<=0){if(depthAt(p.x,p.y)<0){p.dead=1;continue;}disturb(p.x,p.y,1.2,0.8);
      if(frame-lastPlop>3){Snd.plop(1.7,p.x/W*2-1,0.45);lastPlop=frame;}}continue;}
    const hL=waveAt(p.x-1,p.y),hR=waveAt(p.x+1,p.y),hU=waveAt(p.x,p.y-1),hD=waveAt(p.x,p.y+1);
    p.vx+=(hL-hR)*0.04*dt+env.windX*0.0008*dt;p.vy+=(hU-hD)*0.04*dt;const dr=Math.pow(0.94,dt);p.vx*=dr;p.vy*=dr;
    const nx=p.x+p.vx*dt,ny=p.y+p.vy*dt;if(depthAt(nx,ny)>=0&&dIn(nx,ny)>1){p.x=nx;p.y=ny;}else{p.vx*=-0.5;p.vy*=-0.5;}
    const pd=padAt(p.x,p.y);if(pd){const dx=p.x-pd.x,dy=p.y-pd.y,d=Math.sqrt(dx*dx+dy*dy)||1;p.x=pd.x+dx/d*(pd.r+0.6);p.y=pd.y+dy/d*(pd.r+0.6);}
    p.life+=dt/60;if(p.life>45)p.sink+=dt/60;if(p.sink>4)p.dead=1;}
}
function spawnLeaf(){if(leaves.length>50||!canPix.length)return;const i=pick(canPix),c=canA[i]||canB[i];if(!c)return;
  const r=c&255,g=c>>8&255,b=c>>16&255,petal=r>190&&b>130&&g<215&&r>g,sc=SC();
  leaves.push({x:i%W,y:i/W|0,z:R(18,30),rot:R(TAU),vr:R(-0.08,0.08)*(petal?2:1),c:[r,g,b],st:0,life:0,ph:R(TAU),sz:petal?R(0.9,1.3)*sc:R(1.4,2.0)*sc,vx:0,vy:0,petal});}
function updateLeaves(dt){
  for(const l of leaves){
    if(l.st===0){l.z-=(l.petal?0.045:0.06)*dt;l.x+=(Math.sin(T*2+l.ph)*(l.petal?0.6:0.35)+env.windX*0.25)*dt;l.y+=(Math.cos(T*1.7+l.ph)*0.15+0.05)*dt;l.rot+=l.vr*dt*3;
      if(l.x<-5||l.x>W+5||l.y>H+5){l.dead=1;continue;}
      if(l.z<=0){l.z=0;if(depthAt(l.x,l.y)>=0){l.st=1;disturb(l.x,l.y,1.2,0.5);}else l.st=2;}}
    else if(l.st===1){const hL=waveAt(l.x-1,l.y),hR=waveAt(l.x+1,l.y),hU=waveAt(l.x,l.y-1),hD=waveAt(l.x,l.y+1);
      l.vx+=(hL-hR)*0.03*dt+env.windX*0.001*dt;l.vy+=(hU-hD)*0.03*dt;const dr=Math.pow(0.95,dt);l.vx*=dr;l.vy*=dr;l.rot+=l.vr*0.2*dt;
      const nx=l.x+l.vx*dt,ny=l.y+l.vy*dt;if(depthAt(nx,ny)>=0&&dIn(nx,ny)>1){l.x=nx;l.y=ny;}else{l.vx*=-0.5;l.vy*=-0.5;}
      l.life+=dt/60;if(l.life>70)l.dead=1;}
    else{l.life+=dt/60;if(l.life>12)l.dead=1;}
  }
}
function updateDF(dt){
  const vis=env.night<0.45&&env.rain<0.5;
  for(const d of dflies){d.vis=vis;if(!vis)continue;
    d.t-=dt;
    if(d.t<=0){d.t=R(40,180);const p=rnd()<0.75?randWater(0,1):{x:R(W),y:R(H)};if(p){d.tx=p.x;d.ty=p.y;}d.zt=R(8,16);d.dip=rnd()<0.2?1:0;}
    if(mouse.over){const mx=d.x-mouse.x,my=d.y-mouse.y;if(mx*mx+my*my<324){d.tx=clamp(d.x+mx*5,5,W-5);d.ty=clamp(d.y+my*5,5,H-5);d.t=R(30,80);d.dip=0;d.zt=12;}}
    const dx=d.tx-d.x,dy=d.ty-d.y,dd=Math.sqrt(dx*dx+dy*dy);
    if(dd>1.2){const sp=Math.min(dd*0.09,2.4)*dt;d.x+=dx/dd*sp;d.y+=dy/dd*sp;d.h+=wrapA(Math.atan2(dy,dx)-d.h)*Math.min(1,0.25*dt);}
    else{d.x+=Math.sin(T*17+d.ph)*0.06;d.y+=Math.cos(T*13+d.ph)*0.06;
      if(d.dip){d.zt=0.5;if(d.z<1.2){disturb(d.x,d.y,1,0.6);d.dip=0;d.zt=R(8,14);d.t=R(10,40);}}}
    d.z+=(d.zt-d.z)*0.06*dt;}
}
const LEGS=[[0.6,2.6],[1.6,3.4],[2.5,3]];
function updateStriders(dt){
  for(const s of striders){s.t-=dt;let flee=false;
    if(mouse.over){const mx=s.x-mouse.x,my=s.y-mouse.y;if(mx*mx+my*my<200){flee=true;if(s.t>5)s.t=0;s.fa=Math.atan2(my,mx);}}
    if(s.t<=0){const a=flee?s.fa+R(-0.5,0.5):R(TAU),sp=R(0.6,1.4)*(flee?1.8:1);s.vx=Math.cos(a)*sp;s.vy=Math.sin(a)*sp;s.a=a;s.t=R(40,170);disturb(s.x,s.y,1,-0.35);}
    const dr=Math.pow(0.93,dt);s.vx*=dr;s.vy*=dr;
    const nx=s.x+s.vx*dt,ny=s.y+s.vy*dt;
    if(dIn(nx,ny)<2.5||padAt(nx,ny)){s.vx*=-0.6;s.vy*=-0.6;s.a+=Math.PI;}else{s.x=nx;s.y=ny;}
    if(s.vx*s.vx+s.vy*s.vy>0.09&&frame%3===0)disturb(s.x,s.y,1,-0.12);}
}
function updateMisc(dt){
  for(const b of bubbles){b.z-=0.005*dt;b.x+=Math.sin(T*4+b.id)*0.04*dt;if(b.z<=0.01){b.dead=1;disturb(b.x,b.y,1,0.5);}}
  for(const v of vents)if(rnd()<0.02*dt)bubbles.push({x:v.x+R(-1,1),y:v.y+R(-1,1),z:Math.max(0.05,depthAt(v.x,v.y)-0.02),r:R(0.4,1.3),id:R(99)});
  for(const d of drops){d.x+=d.vx*dt;d.y+=d.vy*dt;d.z+=d.vz*dt;d.vz-=0.12*dt;if(d.z<=0){d.dead=1;if(depthAt(d.x,d.y)>=0)disturb(d.x,d.y,1,0.3);}}
  for(const s of scares){s.life-=dt/45;if(s.life<=0)s.dead=1;}
  for(const s of sinkers){
    if(s.st===0){s.h-=0.05*dt;if(s.h<=0){const pan=s.x/W*2-1;
      if(depthAt(s.x,s.y)>=0){s.st=1;s.z=0.02;disturb(s.x,s.y,s.r+2,5);scare(s.x,s.y,70*SC(),1.2);
        for(let k=0;k<14;k++){const a=R(TAU),v=R(0.3,1.1);drops.push({x:s.x,y:s.y,z:0.5,vx:Math.cos(a)*v,vy:Math.sin(a)*v,vz:R(0.8,1.8)});}Snd.splash(1,pan);}
      else{makeStone(bed,s.x,s.y,s.r*1.15,s.r,s.c,false,false,true);s.dead=1;Snd.thud(pan);}}}
    else{s.z+=0.008*dt;s.x+=Math.sin(T*3+s.r)*0.03;const bd=depthAt(s.x,s.y);
      if(bd<0||s.z>=bd){makeStone(bed,s.x,s.y,s.r*1.15,s.r,s.c,false,false);s.dead=1;
        for(let k=0;k<3;k++)bubbles.push({x:s.x+R(-1,1),y:s.y+R(-1,1),z:Math.max(0.05,bd),r:R(0.5,1.2),id:R(99)});}}}
  const fon=clamp((env.night-0.3)/0.7,0,1);
  for(let k=0;k<fireflies.length;k++){const f=fireflies[k];f.on=k<fireflies.length*fon;
    f.vx+=(rnd()-0.5)*0.03*dt;f.vy+=(rnd()-0.5)*0.03*dt;f.vx*=0.98;f.vy*=0.98;f.x+=f.vx*dt;f.y+=f.vy*dt;
    if(f.x<0)f.x+=W;if(f.x>=W)f.x-=W;if(f.y<0)f.y+=H;if(f.y>=H)f.y-=H;
    const s=Math.max(0,Math.sin(T*f.sp+f.ph));f.g=f.on?s*s*s*s*env.night:0;}
}
function updateSpout(dt){
  const s=spout;if(!s)return;
  const tipX=s.px+s.dx*s.L,tipY=s.py+s.dy*s.L,pan=tipX/W*2-1;
  if(s.st===0){s.fill+=dt/60/8;s.tilt=s.fill*0.22;if(s.fill>=1)s.st=1;}
  else if(s.st===1){s.tilt+=0.07*dt;if(s.tilt>=1){s.tilt=1;s.st=2;s.t=24;disturb(tipX+s.dx*2,tipY+s.dy*2,3*SC(),4);
      for(let k=0;k<10;k++){const a=R(TAU),v=R(0.2,0.8);drops.push({x:tipX+s.dx*2,y:tipY+s.dy*2,z:0.4,vx:Math.cos(a)*v+s.dx*0.4,vy:Math.sin(a)*v+s.dy*0.4,vz:R(0.5,1.2)});}
      Snd.pour(pan);scare(tipX,tipY,30*SC(),0.5);}}
  else if(s.st===2){s.t-=dt;if(frame%2===0)disturb(tipX+s.dx*2,tipY+s.dy*2,2,1.2);if(s.t<=0)s.st=3;}
  else{s.tilt-=0.09*dt;if(s.tilt<=0){s.tilt=0;s.st=0;s.fill=0;Snd.tok(s.px/W*2-1);s.knock=8;}}
  if(s.knock>0)s.knock-=dt;
  if(s.st!==0&&frame%3===0)disturb(s.bx+s.dx*1.5,s.by+s.dy*1.5,1.2,0.5);
  if(rnd()<0.012*dt)Snd.plop(0.45,pan,0.06);
}
function newFrog(p){const f={pad:p,x:p.x,y:p.y,a:R(TAU),st:0,h:0,t:R(600,2400),cro:0,ct:R(100,600),sc:SC(),jx0:0,jy0:0,jx1:0,jy1:0,jt:0,jd:40,tp:null,uw:0};p.frog=f;return f;}
function frogJump(fr,threat){
  const p=fr.pad;if(p)p.frog=null;
  const cand=pads.filter(q=>q!==p&&!q.frog&&!q.flower&&q.r>=3.5*fr.sc&&Math.hypot(q.x-fr.x,q.y-fr.y)<60*fr.sc);
  const best=(cand.length&&rnd()<(threat?0.55:0.9))?pick(cand):null;
  fr.jx0=fr.x;fr.jy0=fr.y;fr.tp=best;
  if(best){fr.jx1=best.x;fr.jy1=best.y;}
  else{const a=R(TAU),d=R(12,24)*fr.sc;let tx=fr.x+Math.cos(a)*d,ty=fr.y+Math.sin(a)*d;
    if(depthAt(tx,ty)<0.05||padAt(tx,ty)){tx=lerp(fr.x,pondC.x,0.25);ty=lerp(fr.y,pondC.y,0.25);}fr.jx1=tx;fr.jy1=ty;}
  fr.a=Math.atan2(fr.jy1-fr.y,fr.jx1-fr.x);fr.jt=0;fr.jd=R(32,44);fr.st=1;fr.cro=0;
  if(p){p.vx-=Math.cos(fr.a)*0.12;p.vy-=Math.sin(fr.a)*0.12;disturb(fr.x,fr.y,p.r,0.6);}
}
function updateFrogs(dt){
  for(const fr of frogs){
    if(fr.st===0){const p=fr.pad;fr.x=p.x+Math.cos(p.rot)*p.r*0.12;fr.y=p.y+Math.sin(p.rot)*p.r*0.12;fr.a+=p.av*dt;fr.t-=dt;
      let threat=false;
      if(mouse.over){const dx=mouse.x-fr.x,dy=mouse.y-fr.y;if(dx*dx+dy*dy<(10*fr.sc)**2&&(mouse.down||mouse.still<10))threat=true;}
      for(const s of scares)if(s.life>0.8&&Math.hypot(s.x-fr.x,s.y-fr.y)<s.r*0.6)threat=true;
      if(mouse.grab===p&&rnd()<0.02)threat=true;
      if(threat||fr.t<=0){frogJump(fr,threat);continue;}
      if(env.night>0.45){fr.ct-=dt;if(fr.ct<=0){fr.cro=1;fr.ct=R(240,900);Snd.frog(fr.x/W*2-1);disturb(fr.x,fr.y,p.r+1,0.4);}}
      fr.cro=Math.max(0,fr.cro-dt/50);}
    else if(fr.st===1){fr.jt+=dt/fr.jd;const t=Math.min(1,fr.jt);
      if(fr.tp){fr.jx1=fr.tp.x;fr.jy1=fr.tp.y;}
      fr.x=lerp(fr.jx0,fr.jx1,t);fr.y=lerp(fr.jy0,fr.jy1,t);fr.h=Math.sin(Math.PI*t)*14*fr.sc;
      if(t>=1){fr.h=0;const pan=fr.x/W*2-1;
        if(fr.tp&&!fr.tp.frog){const q=fr.tp;fr.st=0;fr.pad=q;q.frog=fr;q.vx+=Math.cos(fr.a)*0.15;q.vy+=Math.sin(fr.a)*0.15;disturb(fr.x,fr.y,q.r+1,0.8);Snd.plop(2.4,pan,0.25);fr.t=R(600,2400);}
        else{fr.st=2;fr.uw=R(180,420);disturb(fr.x,fr.y,3,3);Snd.plop(1.2,pan,0.6);scare(fr.x,fr.y,25*SC(),0.5);
          for(let k=0;k<8;k++){const a=R(TAU),v=R(0.2,0.7);drops.push({x:fr.x,y:fr.y,z:0.4,vx:Math.cos(a)*v,vy:Math.sin(a)*v,vz:R(0.5,1.1)});}}
        fr.tp=null;}}
    else{fr.uw-=dt;
      if(fr.uw<=0){const cand=pads.filter(p=>!p.frog&&!p.flower&&p.r>=3.5*fr.sc);
        if(cand.length){const p=pick(cand);fr.st=0;fr.pad=p;p.frog=fr;fr.x=p.x;fr.y=p.y;disturb(p.x,p.y,p.r+2,1.2);fr.t=R(600,2000);}else fr.uw=120;}}
  }
}
function updateFlies(dt){
  const vis=env.night<0.35&&env.rain<0.4;
  for(const b of flies){b.vis=vis;if(!vis)continue;
    if(b.rest>0){b.rest-=dt;b.z+=(0.6-b.z)*0.1*dt;b.ph+=0.05*dt;
      if(mouse.over&&Math.hypot(mouse.x-b.x,mouse.y-b.y)<14)b.rest=0;continue;}
    b.t-=dt;
    if(b.t<=0){const p=randLand(4,9999);if(p){b.tx=p.x;b.ty=p.y;}b.t=R(120,320);}
    const dx=b.tx-b.x,dy=b.ty-b.y,dd=Math.hypot(dx,dy);
    if(dd<2){b.rest=R(120,400);b.t=0;continue;}
    b.h=Math.atan2(dy,dx)+Math.sin(T*3+b.ph)*0.6;const sp=0.45*dt;b.x+=Math.cos(b.h)*sp;b.y+=Math.sin(b.h)*sp;
    b.z=8+Math.sin(T*5+b.ph)*3;b.ph+=0.5*dt;}
}
function feed(x,y,n){if(depthAt(x,y)<0)return;const sc=SC();for(let k=0;k<n;k++){if(pellets.length>150)break;
  pellets.push({x:x+R(-3,3)*sc,y:y+R(-3,3)*sc,vx:0,vy:0,air:R(4,16),life:0,sink:0});}}
function dropPebble(x,y){sinkers.push({x,y,h:1,z:0,r:R(1.4,2.6)*SC(),c:stoneBase(),st:0});}
function addFish(){if(fish.length>=(innerWidth<760?24:40))return;const p=randWater(0.3,1);if(!p)return;const f=new Fish(p.x,p.y);f.z=0.05;f.tz=0.4;fish.push(f);
  disturb(p.x,p.y,3,3);for(let k=0;k<10;k++){const a=R(TAU),v=R(0.3,0.9);drops.push({x:p.x,y:p.y,z:0.5,vx:Math.cos(a)*v,vy:Math.sin(a)*v,vz:R(0.6,1.4)});}
  Snd.splash(0.6,p.x/W*2-1);}

/* ================= environment ================= */
function updateEnv(dt){
  const NP=PRESETS.length;
  if(todCur!==todTarget){let d=todTarget-todCur;if(d<0)d+=NP;const step=dt/60*0.4;if(d<=step)todCur=todTarget;else{todCur+=step;if(todCur>=NP)todCur-=NP;}}
  const a=Math.floor(todCur)%NP,b=(a+1)%NP,f=todCur-Math.floor(todCur),A=PRESETS[a],B=PRESETS[b];
  env.rain=lerp(env.rain,rainOn?1:0,Math.min(1,0.01*dt));const rain=env.rain;
  for(let k=0;k<3;k++){env.amb[k]=lerp(A.amb[k],B.amb[k],f)*(1-rain*0.3);env.sky[k]=lerp(lerp(A.sky[k],B.sky[k],f),118,rain*0.6);
    env.gLo[k]=lerp(lerp(A.lo[k],B.lo[k],f),30,rain*0.4);env.gHi[k]=lerp(A.hi[k],B.hi[k],f);}
  env.gK=lerp(A.gk,B.gk,f);
  env.caus=lerp(A.caus,B.caus,f)*(1-rain*0.85);env.night=lerp(A.night,B.night,f);env.spec=lerp(A.spec,B.spec,f);
  env.shadow=(1-env.night)*(1-rain*0.75);env.shShift=lerp(A.sh,B.sh,f);
  env.mist=Math.min(1,lerp(A.mist,B.mist,f)+rain*0.25);
  env.wind=0.5+0.5*Math.sin(T*0.13)**2+rain*1.2;env.windX=0.3+0.4*Math.sin(T*0.07)+rain*0.6;
  env.flash*=Math.pow(0.82,dt);
}

/* ================= main update ================= */
function update(dt){
  T+=dt/60;frame++;
  updateEnv(dt);mouse.still+=dt;
  const sc=SC();
  if(mouse.down&&mouse.over){const mv=Math.hypot(mouse.x-mouse.px,mouse.y-mouse.py);
    if(tool==='touch'){if(depthAt(mouse.x,mouse.y)>=0){disturb(mouse.x,mouse.y,2,Math.min(2.2,0.35+mv*0.5));if(frame%10===0)scare(mouse.x,mouse.y,40*sc,0.8);}}
    else if(tool==='feed'&&mv>0.4&&frame%7===0)feed(mouse.x,mouse.y,1);}
  mouse.px=mouse.x;mouse.py=mouse.y;
  if(!introDone&&T>0.6){introDone=true;disturb(pondC.x,pondC.y,4,4);}
  if(rnd()<0.35*env.wind){const x=R(1,W-1),y=R(1,H-1);if(depthAt(x,y)>=0)disturb(x,y,1,0.2);}
  const nd=env.rain*N/9000,cnt=Math.floor(nd)+(rnd()<nd%1?1:0);
  for(let k=0;k<cnt;k++){const x=R(1,W-1),y=R(1,H-1);if(depthAt(x,y)>=0)disturb(x,y,1,R(0.5,1.3));
    else if(rnd()<0.25)drops.push({x,y,z:0.3,vx:R(-0.2,0.2),vy:R(-0.2,0.2),vz:R(0.4,0.8)});}
  if(env.rain>0.85&&rnd()<0.0006*dt){env.flash=0.9;flash2=R(5,9);Snd.thunder(R(0.3,1.6));}
  if(flash2>0){flash2-=dt;if(flash2<=0)env.flash=Math.max(env.flash,0.6);}
  waveStep();if(dt>1.6)waveStep();
  for(const f of fish)updateFish(f,dt);
  updatePads(dt);updatePellets(dt);
  if(rnd()<0.006*dt*(0.6+env.wind))spawnLeaf();
  updateLeaves(dt);updateDF(dt);updateStriders(dt);updateMisc(dt);updateSpout(dt);updateFrogs(dt);updateFlies(dt);
  pellets=pellets.filter(o=>!o.dead);leaves=leaves.filter(o=>!o.dead);bubbles=bubbles.filter(o=>!o.dead);
  drops=drops.filter(o=>!o.dead);sinkers=sinkers.filter(o=>!o.dead);scares=scares.filter(o=>!o.dead);
  hoverFish=null;
  if(mouse.over){let bd=1e9;for(const f of fish){for(const k of [0,3,6]){const p=f.pts[k],dx=p.x-mouse.x,dy=p.y-mouse.y,d=dx*dx+dy*dy,lim=Math.max(4,f.len*0.35);
    if(d<lim*lim&&d<bd){bd=d;hoverFish=f;}}}}
  if(Snd.c){
    if(env.night<0.3&&env.rain<0.3&&rnd()<0.004*dt)Snd.chirp();
    if(env.night>0.5&&rnd()<0.03*dt*env.night)Snd.cricket();
    if(env.night>0.4&&rnd()<0.0012*dt)Snd.frog(Math.random()*1.4-0.7);
    if(env.wind>0.85&&env.night<0.6&&rnd()<0.0015*dt)Snd.chime();
    Snd.setRain(env.rain);}
}

/* ================= rendering ================= */
function addLight(cx,cy,rad,r,g,b,band){
  const x0=Math.max(0,Math.floor(cx-rad)),x1=Math.min(W-1,Math.ceil(cx+rad)),y0=Math.max(0,Math.floor(cy-rad)),y1=Math.min(H-1,Math.ceil(cy+rad));
  for(let y=y0;y<=y1;y++)for(let x=x0;x<=x1;x++){const dx=x-cx,dy=y-cy,d=Math.sqrt(dx*dx+dy*dy)/rad;if(d>=1)continue;
    let f=(1-d)*(1-d);if(band)f=Math.floor(f*7+bay(x,y))/7;const i=y*W+x;LR[i]+=f*r;LG[i]+=f*g;LB[i]+=f*b;}
}
function buildLights(){
  if(env.night<=0.02)return;
  LR.fill(0);LG.fill(0);LB.fill(0);emis.fill(0);
  if(lantern){const fl=0.85+0.15*vnoise(T*6,3.3)+0.05*Math.sin(T*23),I=env.night*fl*1.1;addLight(lantern.x+1,lantern.y+1,S*0.28,I*1.25,I*0.82,I*0.42,true);}
  for(const f of fireflies)if(f.on&&f.g>0.05)addLight(f.x,f.y,7,f.g*0.45,f.g*0.55,f.g*0.18,false);
}
function drawPlants(){
  const wx=env.windX*0.004;
  for(const p of plants)for(const b of p.blades){let x=p.x,y=p.y,a=b.a;const n=b.len|0;
    for(let k=0;k<n;k++){const s=k/n;a+=Math.sin(T*1.3+p.ph+b.o+s*2.5)*0.05+wx;x+=Math.cos(a)*0.9;y+=Math.sin(a)*0.9;
      const xi=x|0,yi=y|0;if(xi<1||yi<1||xi>=W-1||yi>=H-1)break;const i=yi*W+xi;if(!wm[i])break;
      const z=depth[i]*(1-s*0.6);if(z>uD[i]+0.001)continue;const t=0.75+s*0.5;under[i]=packC(b.c[0]*t,b.c[1]*t,b.c[2]*t);uD[i]=z;}}
}
function drawStriderDimples(){
  for(const s of striders)for(const [da,l] of LEGS)for(const sd of [-1,1]){const a=s.a+da*sd,x=Math.floor(s.x+Math.cos(a)*l+2),y=Math.floor(s.y+Math.sin(a)*l+2);
    if(x<1||y<1||x>=W-2||y>=H-1)continue;const i=y*W+x;if(!wm[i])continue;scale(under,i,0.5);if(wm[i+1])scale(under,i+1,1.25);}
}
function discStone(buf,cx,cy,r,c,z,setD){
  for(let y=Math.floor(cy-r);y<=cy+r;y++)for(let x=Math.floor(cx-r);x<=cx+r;x++){if(x<0||y<0||x>=W||y>=H)continue;
    const dx=(x+0.5-cx)/r,dy=(y+0.5-cy)/r,d2=dx*dx+dy*dy;if(d2>1)continue;const i=y*W+x;
    if(setD){if(!wm[i]||z>uD[i])continue;uD[i]=z;}
    const f=(-dx-dy)>0.3?1.2:(d2>0.6&&(dx+dy)>0.2)?0.65:0.95;buf[i]=packC(c[0]*f,c[1]*f,c[2]*f);}
}
function drawBubbles(){
  for(const b of bubbles){const x=b.x|0,y=b.y|0;if(x<1||y<1||x>=W-1||y>=H-1)continue;const i=y*W+x;if(!wm[i]||b.z>uD[i]+0.001)continue;
    const r=b.r*(1.4-b.z*0.7);
    if(r>1.1){for(const o of [1,-1,W,-W]){const j=i+o;if(wm[j]){blend(under,j,225,245,245,0.75);uD[j]=b.z;}}blend(under,i,200,230,235,0.3);uD[i]=b.z;}
    else{blend(under,i,230,248,248,0.8);uD[i]=b.z;}}
}
function composite(){
  const t=T;
  for(let x=0;x<W;x++)wXa[x]=Math.sin(x*0.085+t*1.25)*2.4;
  for(let y=0;y<H;y++)wYa[y]=Math.sin(y*0.1-t*1.05)*2.4;
  const o1x=t*3.4,o1y=t*1.9,o2x=-t*2.6+17,o2y=t*3.1+31,caus=env.caus*0.14,spec=env.spec,sky=env.sky;
  const spR=lerp(255,sky[0],0.3),spG=lerp(255,sky[1],0.3),spB=lerp(255,sky[2],0.3),rfR=sky[0]*0.06,rfG=sky[1]*0.06,rfB=sky[2]*0.06;
  const mX=moon.x,mY=moon.y,mR=Math.max(3,S*0.022),mR2=mR*mR,moonK=env.night>0.05?env.night*0.9*(1-env.rain*0.8):0;
  const starK=env.night>0.3?(env.night-0.3)/0.7*(1-env.rain):0,wv=w0;
  const reflK=0.3*(1-env.night*0.5)*(1-env.rain*0.5),rOX=Math.round(S*0.02),rOY=Math.round(S*0.07);
  const glit=env.night<0.5&&env.rain<0.6,gT=(t*7)|0;
  for(let x=0;x<W;x++){out[x]=under[x];out[(H-1)*W+x]=under[(H-1)*W+x];}
  for(let y=0;y<H;y++){out[y*W]=under[y*W];out[y*W+W-1]=under[y*W+W-1];}
  for(let y=1;y<H-1;y++){let i=y*W+1;
    for(let x=1;x<W-1;x++,i++){
      if(!wm[i]){out[i]=under[i];continue;}
      const gx=wv[i+1]-wv[i-1],gy=wv[i+W]-wv[i-W];
      let sx=x+((gx*3.2)|0),sy=y+((gy*3.2)|0);
      if(sx<0)sx=0;else if(sx>=W)sx=W-1;if(sy<0)sy=0;else if(sy>=H)sy=H-1;
      let si=sy*W+sx;if(!wm[si])si=i;
      const c=under[si];let r=c&255,g=c>>8&255,b=c>>16&255;const d=uD[si];
      if(caus>0){const cx=sx*0.9,cy=sy*0.9;
        const c1=CT[((((cy+wXa[sx]+o1y)|0)&63)<<6)|(((cx+wYa[sy]+o1x)|0)&63)];
        const c2=CT[((((cy-wXa[sx]*0.7+o2y)|0)&63)<<6)|(((cx*1.13+wYa[sy]+o2x)|0)&63)];
        const q=c1+c2,lv=q>1.15?2:q>0.6?1:0;
        if(lv){const k=1+lv*caus*(1-d)*(1.2-d);r*=k;g*=k;b*=k*0.97;}}
      const tc=wtint[i],k=0.12+d*0.8;r+=((tc&255)-r)*k;g+=((tc>>8&255)-g)*k;b+=((tc>>16&255)-b)*k;
      const ws=wshade[i];r=r*ws+rfR;g=g*ws+rfG;b=b*ws+rfB;
      if(reflK>0){const rx=x+((gx*5)|0)-rOX,ry=y+((gy*5)|0)-rOY;if(rx>=0&&ry>=0&&rx<W&&ry<H){const j=ry*W+rx,cc=canB[j]||canA[j];
        if(cc){r+=((cc&255)*0.5-r)*reflK;g+=((cc>>8&255)*0.5-g)*reflK;b+=((cc>>16&255)*0.55-b)*reflK;}}}
      const sp=(-gx-gy)*spec;
      if(sp>0.55){const a=sp>1.1?0.55:0.25;r+=(spR-r)*a;g+=(spG-g)*a;b+=(spB-b)*a;}
      else if(sp<-0.6){r*=0.86;g*=0.86;b*=0.88;}
      if(glit&&sp>0.3&&hash2(x*3+gT,y*7-gT)>0.93){r=spR+30;g=spG+30;b=spB+30;}
      if(distIn[i]<1.6&&Math.sin(t*2.2+(x+y)*0.3+Math.sin(x*0.1)*2)>0.2){r+=22;g+=26;b+=24;}
      if(moonK>0){const ddx=x+gx*7-mX,ddy=(y+gy*7-mY)*1.4,dd=ddx*ddx+ddy*ddy;
        if(dd<mR2)emis[i]=moonK;else if(dd<mR2*4&&bay(x,y)<0.5*(1-dd/(mR2*4)))emis[i]=moonK*0.35;}
      if(starK>0){const hv=hash2(((x+gx*4)|0)*7+3,((y+gy*4)|0)*13+1);
        if(hv>0.9965){const e=starK*(0.35+0.25*(1+Math.sin(t*(2+hv*40)+hv*1000)));if(e>emis[i])emis[i]=e;}}
      out[i]=packC(r,g,b);}}
}
function drawPads(){
  const bloom=1-env.night*0.85;
  for(const p of pads){const r=p.r,id=++markId;
    for(let y=Math.floor(p.y-r+1.3);y<=p.y+r+2.3;y++)for(let x=Math.floor(p.x-r+1.5);x<=p.x+r+2.5;x++){if(x<0||y<0||x>=W||y>=H)continue;
      const dx=x+0.5-p.x-1.5,dy=y+0.5-p.y-1.3;if(dx*dx+dy*dy>r*r)continue;const i=y*W+x;if(!wm[i]||mark[i]===id)continue;mark[i]=id;scale(out,i,0.6);}
    const cr=Math.cos(p.rot),sr=Math.sin(p.rot),c=p.col,ri=1.15/r;
    for(let y=Math.floor(p.y-r-1);y<=p.y+r+1;y++)for(let x=Math.floor(p.x-r-1);x<=p.x+r+1;x++){if(x<0||y<0||x>=W||y>=H)continue;
      const dx=x+0.5-p.x,dy=y+0.5-p.y,d2=dx*dx+dy*dy;if(d2>r*r)continue;
      const lx=dx*cr+dy*sr,ly=-dx*sr+dy*cr,ang=Math.atan2(ly,lx),d=Math.sqrt(d2)/r,nl=p.notch*(1-d*0.3);
      if(Math.abs(ang)<nl&&d>0.06)continue;
      let hole=false;for(const h of p.holes){const hx=Math.cos(h.a)*h.d*r-lx,hy=Math.sin(h.a)*h.d*r-ly;if(hx*hx+hy*hy<h.s)hole=true;}if(hole)continue;
      const lit=(-dx-dy)/r;let sh=1+lit*0.1+(bay(x,y)-0.5)*0.1;
      const rim=d>1-ri||Math.abs(Math.abs(ang)-nl)*d*r<0.9;
      if(rim)sh=lit>-0.1?1.22:0.66;
      else{if(Math.abs(Math.sin(ang*4.5))<0.12&&d>0.18&&d<0.9)sh*=1.1;else if(d<0.1)sh*=1.14;
        sh=sh>1.08?1.12:sh>0.96?1:0.88;}
      let R_=c[0],G_=c[1],B_=c[2];
      if(p.yel&&!rim){const nn=vnoise(lx*0.6+p.seed,ly*0.6);if(nn>0.64||(d>0.78&&nn>0.46)){R_=168;G_=142;B_=62;}}
      out[y*W+x]=packC(R_*sh,G_*sh,B_*sh);}
    for(const dd of p.dr){const a=p.rot+dd.a,x=p.x+Math.cos(a)*dd.d*r,y=p.y+Math.sin(a)*dd.d*r;darkAt(x+1,y+1,0.75,0);plot(x,y,236,250,244);}
    if(p.flower)drawLotus(p,bloom);}
}
function drawLotus(p,bloom){
  const fx=p.x+Math.cos(p.rot+p.fo)*p.r*0.28,fy=p.y+Math.sin(p.rot+p.fo)*p.r*0.28,open=bloom>0.45,fr=p.r*(open?0.62+0.18*bloom:0.4),o=p.fc.o,inn=p.fc.i,id=++markId,rot=p.rot*0.5+p.fo;
  for(let y=Math.floor(fy-fr);y<=fy+fr+2;y++)for(let x=Math.floor(fx-fr);x<=fx+fr+2;x++){const dx=x+0.5-fx-1.4,dy=y+0.5-fy-1.2;if(dx*dx+dy*dy<fr*fr*0.7)darkAt(x,y,0.7,id);}
  const oD=[o[0]*0.78,o[1]*0.72,o[2]*0.76],cr=Math.cos(rot),sr=Math.sin(rot);
  for(let y=Math.floor(fy-fr-1);y<=fy+fr+1;y++)for(let x=Math.floor(fx-fr-1);x<=fx+fr+1;x++){if(x<0||y<0||x>=W||y>=H)continue;
    const dx=x+0.5-fx,dy=y+0.5-fy,d=Math.sqrt(dx*dx+dy*dy);let col,sh=1;
    if(open){const ang=Math.atan2(dy,dx)+rot,c1=Math.abs(Math.cos(ang*4)),c2=Math.abs(Math.cos(ang*4+Math.PI/2));
      const lim1=fr*(0.5+0.5*Math.pow(c1,0.6)),lim2=fr*0.7*(0.55+0.45*Math.pow(c2,0.6));
      if(d<fr*0.2){col=d<fr*0.1?[216,190,80]:(hash2(x,y)>0.7?[190,140,30]:[246,206,70]);}
      else if(d<lim2){const q=d/lim2;col=q<0.5?inn:lerpC(inn,o,(q-0.5)*1.6);sh=q>0.85?0.94:1.06;if(c2>0.92)sh*=1.08;}
      else if(d<lim1){const q=d/lim1;col=q>0.8?lerpC(o,oD,0.5):o;sh=d>lim1-0.9?0.76:0.92;if(c1>0.92)sh*=1.06;}
      else continue;}
    else{const bx=dx*cr+dy*sr,by=-dx*sr+dy*cr,e=(bx/(fr*1.1))**2+(by/(fr*0.75*(1-bx/(fr*2.4))))**2;if(e>1)continue;
      col=e>0.75?oD:bx>fr*0.4?o:inn;}
    sh*=1+(-dx-dy)/fr*0.12;
    out[y*W+x]=packC(col[0]*sh,col[1]*sh,col[2]*sh);}
}
const FROGC=[null,[98,154,58],[184,210,104],[50,90,36],[20,22,16],[206,230,140],[72,120,44],[236,232,190]];
function frogPix(f,l,jump,cro){
  const al=l<0?-l:l,ed=(f-2.3)*(f-2.3)+(al-1.45)*(al-1.45);
  if(ed<0.9)return ed<0.35?4:5;
  if(cro>0.05){const sd=(f-1.4)*(f-1.4)+(al-2.5)*(al-2.5);if(sd<1.6*cro)return 7;}
  const be=(f/3.4)*(f/3.4)+(l/2.4)*(l/2.4);
  if(be<1){if(al<0.4&&f<2&&f>-2.6)return 2;if(be<0.7&&hash2(Math.floor(f*1.4+40),Math.floor(l*1.4+40))>0.8)return 3;return 1;}
  if(!jump){
    if(((f+1.5)/1.9)**2+((al-2.5)/1.0)**2<1)return 6;
    if(((f-0.2)/1.3)**2+((al-3.2)/0.6)**2<1)return 6;
    if(((f-1.8)/0.9)**2+((al-2.4)/0.5)**2<1)return 6;
  }else{
    if(((f+4.3)/2.3)**2+((al-1.5)/0.6)**2<1)return 6;
    if(((f-3.6)/1.1)**2+((al-1.6)/0.45)**2<1)return 6;
  }
  return 0;
}
function drawFrog(fr){
  const s=fr.sc*(1+fr.h*0.02),ca=Math.cos(fr.a),sa=Math.sin(fr.a),jump=fr.st===1,cro=fr.cro,RR=Math.ceil(6.5*s)+1;
  const cx=fr.x-fr.h*0.12,cy=fr.y-fr.h*0.3,shx=fr.x+1+fr.h*0.55,shy=fr.y+1+fr.h*0.65,sid=++markId,sr=3*fr.sc;
  for(let y=Math.floor(shy-sr);y<=shy+sr;y++)for(let x=Math.floor(shx-sr);x<=shx+sr;x++){const dx=x+0.5-shx,dy=y+0.5-shy;if(dx*dx+dy*dy<sr*sr)darkAt(x,y,0.65,sid);}
  const e=1/s;
  for(let y=Math.floor(cy-RR);y<=cy+RR;y++)for(let x=Math.floor(cx-RR);x<=cx+RR;x++){if(x<0||y<0||x>=W||y>=H)continue;
    const dx=x+0.5-cx,dy=y+0.5-cy,lf=(dx*ca+dy*sa)/s,ll=(-dx*sa+dy*ca)/s,k=frogPix(lf,ll,jump,cro);
    if(!k){if(frogPix(lf+e,ll,jump,cro)||frogPix(lf-e,ll,jump,cro)||frogPix(lf,ll+e,jump,cro)||frogPix(lf,ll-e,jump,cro))out[y*W+x]=pack(22,34,18);continue;}
    const c=FROGC[k];let sh=(-dx-dy)/(4*s);sh=sh>0.35?1.14:sh<-0.35?0.84:1;
    out[y*W+x]=packC(c[0]*sh,c[1]*sh,c[2]*sh);}
}
function drawPellets(){
  for(const p of pellets){
    if(p.air>0){const h=p.air/16;darkAt(p.x+h*4+1,p.y+h*5+1,0.7,0);plot(p.x,p.y-h*2,150,96,50);plot(p.x+1,p.y-h*2,110,70,36);continue;}
    const a=p.sink>0?Math.max(0,1-p.sink/4):1,id=++markId;
    darkAt(p.x+2,p.y+2,0.75,id);darkAt(p.x+1,p.y+2,0.75,id);darkAt(p.x+2,p.y+1,0.75,id);
    plotA(p.x,p.y,196,140,78,a);plotA(p.x+1,p.y,128,80,40,a);plotA(p.x,p.y+1,116,72,36,a);plotA(p.x+1,p.y+1,86,54,28,a);}
}
function drawLeaf(l){
  const zs=1+l.z*0.035,L=l.sz*zs,Wd=L*(l.petal?0.75:0.5),ca=Math.cos(l.rot),sa=Math.sin(l.rot);
  const off=l.st===0?l.z*0.55+0.8:0.8,id=++markId;
  const fade=l.st===2&&l.life>8?(12-l.life)/4:(l.st===1&&l.life>60?(70-l.life)/10:1);
  const inside=(u,v)=>{const w=Wd*(1-0.35*Math.abs(u)/L);return u*u/(L*L)+v*v/(w*w)<=1;};
  for(let u=-L;u<=L;u+=0.5)for(let v=-Wd;v<=Wd;v+=0.5){if(!inside(u,v))continue;darkAt(l.x+ca*u-sa*v+off,l.y+sa*u+ca*v+off*0.85,0.72,id);}
  const id2=++markId;
  for(let u=-L;u<=L;u+=0.5)for(let v=-Wd;v<=Wd;v+=0.5){if(!inside(u,v))continue;
    const xi=Math.floor(l.x+ca*u-sa*v),yi=Math.floor(l.y+sa*u+ca*v);if(xi<0||yi<0||xi>=W||yi>=H)continue;
    if(fade<1&&bay(xi,yi)>fade)continue;const i=yi*W+xi;if(mark[i]===id2)continue;mark[i]=id2;
    const s=l.petal?(Math.abs(u)<L*0.4&&Math.abs(v)<Wd*0.4?1.08:0.94):(Math.abs(v)<0.35?0.78:(v<0?1.12:0.94));
    out[i]=packC(l.c[0]*s,l.c[1]*s,l.c[2]*s);}
  if(!l.petal)plot(l.x-ca*(L+0.6),l.y-sa*(L+0.6),l.c[0]*0.55,l.c[1]*0.45,l.c[2]*0.35);
}
function drawStriders(){
  for(const s of striders){for(const [da,l] of LEGS)for(const sd of [-1,1]){const a=s.a+da*sd;
      for(let t=0.5;t<=l;t+=0.5)plotA(s.x+Math.cos(a)*t,s.y+Math.sin(a)*t,34,30,26,0.55);}
    plot(s.x,s.y,36,30,24);plot(s.x-Math.cos(s.a),s.y-Math.sin(s.a),28,24,20);plot(s.x+Math.cos(s.a)*0.9,s.y+Math.sin(s.a)*0.9,70,60,48);}
}
function drawReeds(){
  for(const rd of reeds)for(const s of rd){
    const a=s.a+Math.sin(T*1.6+s.ph)*0.12*env.wind+env.windX*0.03,ca=Math.cos(a),sa=Math.sin(a),id=++markId;
    for(let t=0;t<=s.l;t+=0.5)darkAt(s.x+ca*t+1,s.y+sa*t+1,0.7,id);
    for(let t=0;t<=s.l;t+=0.5){const k=t/s.l,x=s.x+ca*t,y=s.y+sa*t;
      if(s.cat&&k>0.62){plot(x,y,116,72,40);plot(x+1,y,84,50,28);}
      else plot(x,y,s.c[0]*(0.8+k*0.4),s.c[1]*(0.8+k*0.4),s.c[2]*(0.8+k*0.3));}
    if(s.iris){const tx=s.x+ca*s.l,ty=s.y+sa*s.l;plot(tx+1,ty,150,96,214);plot(tx-1,ty,150,96,214);plot(tx,ty-1,196,160,246);plot(tx,ty+1,112,70,180);plot(tx,ty,250,214,90);}}
}
function drawTube(ax,ay,bx,by,rad,ha,hb,base,openA,openB){
  const dx=bx-ax,dy=by-ay,L=Math.hypot(dx,dy)||1,ux=dx/L,uy=dy/L,nx=-uy,ny=ux,sg=(nx+ny)>0?1:-1;
  let id=++markId;
  for(let t=0;t<=L;t+=0.5){const h=lerp(ha,hb,t/L),cx=ax+ux*t+h*0.6+1,cy=ay+uy*t+h*0.75+1;
    for(let o=-rad;o<=rad;o+=0.5)darkAt(cx+nx*o,cy+ny*o,0.58,id);}
  id=++markId;const node=Math.max(6,rad*4.5);
  for(let t=0;t<=L;t+=0.4){const h=lerp(ha,hb,t/L),cx=ax+ux*t-h*0.1,cy=ay+uy*t-h*0.22,nd=t%node,ring=nd<0.9?0.6:nd<1.6?1.25:1;
    for(let o=-rad;o<=rad;o+=0.4){const q=o/rad*sg;let f=q<-0.45?1.28:q<0.15?1.04:q<0.7?0.84:0.6;f*=ring;
      const px=Math.floor(cx+nx*o),py=Math.floor(cy+ny*o);if(px<0||py<0||px>=W||py>=H)continue;const i=py*W+px;if(mark[i]===id)continue;mark[i]=id;
      out[i]=packC(base[0]*f,base[1]*f,base[2]*f);}}
  const cap=(x,y,h)=>{const cx=x-h*0.1,cy=y-h*0.22;for(let yy=Math.floor(cy-rad-1);yy<=cy+rad+1;yy++)for(let xx=Math.floor(cx-rad-1);xx<=cx+rad+1;xx++){
    const ex=xx+0.5-cx,ey=yy+0.5-cy,d=Math.sqrt(ex*ex+ey*ey);if(d<=rad*0.6)plot(xx,yy,26,32,18);else if(d<=rad+0.3)plot(xx,yy,base[0]*1.2,base[1]*1.2,base[2]*1.1);}};
  if(openA)cap(ax,ay,ha);if(openB)cap(bx,by,hb);
}
function drawSpout(){
  const s=spout;if(!s)return;const sc=SC(),rad=1.3*sc;
  const bx=s.px-s.dx*s.L*0.35,by=s.py-s.dy*s.L*0.35,tx=s.px+s.dx*s.L,ty=s.py+s.dy*s.L;
  const hT=(0.6+(1-s.tilt)*5)*sc,hB=(1.2+s.tilt*3-(s.knock>0?0.6:0))*sc;
  drawTube(bx,by,tx,ty,rad*1.1,hB,hT,[176,168,82],false,true);
  for(const sd of [-1,1]){const x=s.px+s.sx*sd*rad*2.4,y=s.py+s.sy*sd*rad*2.4;plot(x,y-1,120,84,50);plot(x,y,96,64,38);plot(x+1,y+1,60,40,24);}
  drawTube(s.ax,s.ay,s.bx,s.by,rad*0.9,6*sc,6*sc,[104,148,60],false,true);
  const wx=s.bx+s.dx*0.8,wy=s.by+s.dy*0.8;
  for(let k=0;k<4;k++){if(((frame>>1)+k)%3===0)continue;plotA(wx+s.dx*k*0.6,wy+s.dy*k*0.6+k*0.3,220,240,250,0.85);}
}
function drawDeck(){
  if(!deck)return;
  for(let y=deck.y0-1;y<H;y++)for(let x=deck.x0-2;x<=deck.x1+4;x++){if(x<0||x>=W||y<0)continue;const i=y*W+x;if(deckBuf[i])continue;
    const sx=x-3,sy=y-2;if(sx>=0&&sy>=0&&deckBuf[sy*W+sx])scale(out,i,0.55);}
  for(let y=deck.y0-1;y<H;y++)for(let x=deck.x0-1;x<=deck.x1+1;x++){if(x<0||x>=W||y<0)continue;const i=y*W+x;if(deckBuf[i])out[i]=deckBuf[i];}
}
function drawLanternGlow(){
  if(!lantern||env.night<0.08)return;const s=lantern.s,a=env.night,fl=0.8+0.2*vnoise(T*5,7.7);
  for(let v=-s-3;v<=s+3;v++)for(let u=-s-3;u<=s+3;u++){const d=Math.hypot(u,v);if(d<s*0.8||d>s+3)continue;
    const ang=Math.atan2(v,u),sec=Math.floor((ang+Math.PI)/(Math.PI/3))%6,secA=-Math.PI+sec*Math.PI/3+Math.PI/6,hr=s*0.866/Math.cos(wrapA(ang-secA));
    const e=d-hr;if(e<=0||e>2.6)continue;const k=(1-e/2.6)*a*fl;if(bay(lantern.x+u,lantern.y+v)>k*1.3)continue;
    plotA(lantern.x+u,lantern.y+v,255,200,120,Math.min(1,k*1.1));}
}
function drawDrops(){for(const d of drops){if(d.z>0.5)darkAt(d.x,d.y,0.8,0);plotA(d.x,d.y-d.z*0.5,225,240,245,0.85);}}
function drawSinkersAir(){
  for(const s of sinkers){if(s.st!==0)continue;const h=Math.max(0,s.h),r=s.r*(1+h*1.3),id=++markId,ox=h*10+1,oy=h*12+1;
    for(let y=Math.floor(s.y+oy-r);y<=s.y+oy+r;y++)for(let x=Math.floor(s.x+ox-r);x<=s.x+ox+r;x++){const dx=x+0.5-s.x-ox,dy=y+0.5-s.y-oy;if(dx*dx+dy*dy<r*r*0.81)darkAt(x,y,0.6,id);}
    discStone(out,s.x,s.y,r,s.c,0,false);}
}
function dfPass(d,sh){
  const ca=Math.cos(d.h),sa=Math.sin(d.h),bx=d.x+(sh?d.z*0.6+1:0),by=d.y+(sh?d.z*0.72+1:0),id=++markId,fl=Math.sin(frame*2.3+d.ph)*0.28;
  for(const w of [[0.9,1.4+fl,4.6],[0.9,-1.4-fl,4.6],[-0.5,1.8-fl,4.1],[-0.5,-1.8+fl,4.1]]){
    const wx=bx+ca*w[0],wy=by+sa*w[0],a=d.h+w[1],c=Math.cos(a),s=Math.sin(a);
    for(let t=0.8;t<=w[2];t+=0.6){const px=Math.floor(wx+c*t),py=Math.floor(wy+s*t);if(px<0||py<0||px>=W||py>=H)continue;const i=py*W+px;
      if(mark[i]===id)continue;mark[i]=id;if(sh)scale(out,i,0.82);else blend(out,i,236,244,250,t>w[2]-1?0.65:0.4);}}
  for(let t=-6;t<=2.2;t+=0.5){const px=Math.floor(bx+ca*t),py=Math.floor(by+sa*t);if(px<0||py<0||px>=W||py>=H)continue;const i=py*W+px;
    if(sh){if(mark[i]!==id){mark[i]=id;scale(out,i,0.7);}continue;}
    const c=t>1.2?d.c[2]:t>-0.6?d.c[0]:((((-t*2)|0)&1)?d.c[1]:d.c[0]);out[i]=pack(c[0],c[1],c[2]);}
  if(!sh)for(const sd of [-1,1])plot(bx+ca*1.9-sa*0.9*sd,by+sa*1.9+ca*0.9*sd,d.c[2][0],d.c[2][1],d.c[2][2]);
}
function drawDF(){for(const d of dflies)if(d.vis)dfPass(d,true);for(const d of dflies)if(d.vis)dfPass(d,false);}
function drawFly(b){
  const open=Math.abs(Math.sin(b.ph)),span=0.6+open*2.6*b.s,ca=Math.cos(b.h),sa=Math.sin(b.h),nx=-sa,ny=ca;
  for(const pass of [0,1]){const ox=pass?0:b.z*0.6+1,oy=pass?0:b.z*0.72+1,id=++markId;
    for(const sd of [-1,1])for(const [fu,wl,isF] of [[0.5,1.3,1],[-0.8,1.0,0]]){
      for(let u=-wl;u<=wl;u+=0.5)for(let v=0;v<=span;v+=0.5){const vv=(v-span/2)/(span/2+0.35);if((u/wl)**2+vv*vv>1)continue;
        const x=b.x+ox+ca*(fu*b.s+u)+nx*sd*(v+0.5),y=b.y+oy+sa*(fu*b.s+u)+ny*sd*(v+0.5);
        if(!pass){darkAt(x,y,0.8,id);continue;}
        const c=isF&&v>span*0.7?b.c[1]:b.c[0];plot(x,y,c[0],c[1],c[2]);}}
    if(pass)for(let t=-1.2;t<=1.2;t+=0.5)plot(b.x+ca*t*b.s,b.y+sa*t*b.s,40,34,30);}
}
function finalPass(){
  const sw=env.wind,aX=Math.round(Math.sin(T*0.7)*1.2*sw),aY=Math.round(Math.cos(T*0.53)*0.8*sw);
  const bX=Math.round(Math.sin(T*0.93+1.3)*1.8*sw),bY=Math.round(Math.cos(T*0.61+2)*1.2*sw);
  const shX=aX+Math.round(env.shShift),shY=aY+Math.round(env.shShift*0.8),shK=0.42*env.shadow;
  const ar=env.amb[0],ag=env.amb[1],ab=env.amb[2],useL=env.night>0.02;
  const mist=env.mist,m1x=(T*2.4)|0,m1y=(T*0.8)|0,m2x=(T*1.2)|0,m2y=(-T*0.6)|0;
  const sky=env.sky,mcR=lerp(sky[0],236,0.5),mcG=lerp(sky[1],238,0.5),mcB=lerp(sky[2],242,0.5);
  const gLo=env.gLo,gHi=env.gHi,gK=env.gK,fl=env.flash,kX=aX*3,kY=aY*3;
  let fade=T<2.6?T/2.6:1;fade=fade*fade*(3-2*fade);
  for(let y=0;y<H;y++){
    let syy=y-shY;syy=(syy<0?0:syy>=H?H-1:syy)*W;
    const ay=y-aY,by=y-bY,ayOK=ay>=0&&ay<H,byOK=by>=0&&by<H,by2=by-2,by2OK=by2>=0&&by2<H;let i=y*W;
    for(let x=0;x<W;x++,i++){
      const c=out[i];let r=c&255,g=c>>8&255,b=c>>16&255;const bd=BAY[((y&3)<<2)|(x&3)];
      let cc=0;const bx=x-bX;if(byOK&&bx>=0&&bx<W)cc=canB[by*W+bx];
      if(cc){r=cc&255;g=cc>>8&255;b=cc>>16&255;}
      else{const ax=x-aX;if(ayOK&&ax>=0&&ax<W){cc=canA[ay*W+ax];if(cc){r=cc&255;g=cc>>8&255;b=cc>>16&255;const bx2=bx-2;
        if(by2OK&&bx2>=0&&bx2<W&&canB[by2*W+bx2]){r*=0.74;g*=0.74;b*=0.8;}}}}
      if(!cc){
        if(shK>0.01){let sx=x-shX;sx=sx<0?0:sx>=W?W-1:sx;const s=shadowMap[syy+sx];
          if(s>0.03){let q=Math.floor(s*2.2+bd)*0.5;if(q>1)q=1;if(q>0){if(s<0.92&&FL[(((y+kY)&63)<<6)|((x+kX)&63)])q*=0.3;const f=1-shK*q;r*=f;g*=f;b*=f;}}}
        if(mist>0.02){const m=(MT[((y+m1y)&127)*128+((x+m1x)&127)]+MT[(((y>>1)+m2y)&127)*128+(((x>>1)+m2x)&127)])*0.5;let a=(m-0.42)*3;
          if(a>0){if(a>1)a=1;a*=mist*(wm[i]?1:0.45);a=Math.floor(a*4+bd)*0.15;if(a>0){r+=(mcR-r)*a;g+=(mcG-g)*a;b+=(mcB-b)*a;}}}}
      const v=vig[i];let lr=ar,lg=ag,lb=ab;if(useL){lr+=LR[i];lg+=LG[i];lb+=LB[i];}
      r*=lr*v;g*=lg*v;b*=lb*v;
      if(useL&&!cc){const e=emis[i];if(e>0){r+=e*210;g+=e*220;b+=e*235;}}
      if(gK>0){let L=(r*0.299+g*0.587+b*0.114)/255;if(L>1)L=1;const lo=(1-L)*(1-L)*gK,hi=L*L*gK*0.6;
        r+=(gLo[0]-r)*lo+(gHi[0]-r)*hi;g+=(gLo[1]-g)*lo+(gHi[1]-g)*hi;b+=(gLo[2]-b)*lo+(gHi[2]-b)*hi;}
      if(fl>0.01){r+=fl*150;g+=fl*160;b+=fl*190;}
      if(fade<1){r*=fade;g*=fade;b*=fade;}
      out[i]=packC(r,g,b);}}
}
function drawFireflies(){
  for(const f of fireflies){if(f.g<0.08)continue;const x=Math.floor(f.x),y=Math.floor(f.y);if(x<1||y<1||x>=W-1||y>=H-1)continue;const i=y*W+x,a=f.g*0.35;
    blend(out,i,250,255,170,Math.min(1,f.g*1.2));for(const o of [1,-1,W,-W])blend(out,i+o,210,255,120,a);}
}
function drawRain(){
  const n=Math.floor(env.rain*N/300);if(!n)return;const a=env.amb,cr=150*a[0]+50,cg=170*a[1]+50,cb=195*a[2]+55,dx=-env.windX*0.6;
  for(let k=0;k<n;k++){const x=rnd()*W,y=rnd()*H;for(let t=0;t<4;t++)plotA(x+dx*t,y+t*1.5,cr,cg,cb,t===3?0.4:0.2);}
}
function drawHover(){
  const f=hoverFish;if(!f||tool==='pebble')return;
  const m=f.pts[2],hx=Math.round(m.x),hy=Math.round(m.y),q=Math.round(f.len*0.55)+1;
  for(const [sx,sy] of [[-1,-1],[1,-1],[-1,1],[1,1]]){plotA(hx+sx*q,hy+sy*q,250,238,206,0.8);plotA(hx+sx*(q-1),hy+sy*q,250,238,206,0.8);plotA(hx+sx*q,hy+sy*(q-1),250,238,206,0.8);}
}
const TOOLC={feed:[250,214,120],touch:[200,236,255],pebble:[210,210,200],move:[255,180,200]};
function drawCursor(){
  if(!mouse.over)return;const x=Math.round(mouse.x),y=Math.round(mouse.y),c=TOOLC[tool],rr=mouse.down?2:3;
  const ring=[[rr,0],[-rr,0],[0,rr],[0,-rr],[rr-1,rr-1],[rr-1,1-rr],[1-rr,rr-1],[1-rr,1-rr]];
  for(const [dx,dy] of ring)plotA(x+dx+1,y+dy+1,0,0,0,0.5);
  for(const [dx,dy] of ring)plot(x+dx,y+dy,c[0],c[1],c[2]);
  if(tool==='feed')plot(x,y,170,110,56);
  else if(tool==='pebble'){plot(x,y,180,180,170);plot(x+1,y,120,120,114);plot(x,y+1,120,120,114);plot(x+1,y+1,90,90,86);}
  else if(tool==='move'){const on=padAt(mouse.x,mouse.y);for(const [dx,dy] of [[5,0],[-5,0],[0,5],[0,-5]])plot(x+dx,y+dy,on?255:c[0],on?240:c[1],on?160:c[2]);}
  else plot(x,y,c[0],c[1],c[2]);
}
function render(){
  buildLights();
  under.set(bed);uD.set(depth);
  drawPlants();drawStriderDimples();
  for(const s of sinkers)if(s.st===1)discStone(under,s.x,s.y,s.r,s.c,s.z,true);
  for(const f of fish)drawFishShadow(f);
  fish.sort((a,b)=>b.z-a.z);
  for(const f of fish)drawFish(f);
  drawBubbles();
  composite();
  drawPads();
  for(const fr of frogs)if(fr.st===0)drawFrog(fr);
  drawPellets();
  for(const l of leaves)if(l.st!==0)drawLeaf(l);
  drawStriders();drawReeds();drawSpout();drawDeck();drawLanternGlow();drawDrops();drawSinkersAir();
  for(const fr of frogs)if(fr.st===1)drawFrog(fr);
  for(const l of leaves)if(l.st===0)drawLeaf(l);
  for(const b of flies)if(b.vis)drawFly(b);
  drawDF();
  finalPass();
  drawFireflies();drawRain();
  if(snapReq){ctx.putImageData(img,0,0);doSnap();snapReq=false;}
  drawHover();drawCursor();
  ctx.putImageData(img,0,0);
}

/* ================= procedural audio ================= */
const Snd={c:null,m:null,on:true,rainG:null,white:null,brown:null,
  init(){const C=window.AudioContext||window.webkitAudioContext;if(!C)return;
    if(this.c){if(this.c.state==='suspended')this.c.resume();return;}
    const c=this.c=new C();this.m=c.createGain();this.m.gain.value=this.on?0.6:0;this.m.connect(c.destination);
    const len=c.sampleRate*2|0,wb=c.createBuffer(1,len,c.sampleRate),bb=c.createBuffer(1,len,c.sampleRate),wd=wb.getChannelData(0),bd=bb.getChannelData(0);let l=0;
    for(let i=0;i<len;i++){const w=Math.random()*2-1;wd[i]=w;l=(l+0.02*w)/1.02;bd[i]=l*3.5;}
    this.white=wb;this.brown=bb;
    const s1=c.createBufferSource();s1.buffer=bb;s1.loop=true;const f1=c.createBiquadFilter();f1.type='lowpass';f1.frequency.value=420;
    const g1=c.createGain();g1.gain.value=0.22;s1.connect(f1);f1.connect(g1);g1.connect(this.m);s1.start();
    const s2=c.createBufferSource();s2.buffer=wb;s2.loop=true;const f2=c.createBiquadFilter();f2.type='bandpass';f2.frequency.value=2200;f2.Q.value=0.5;
    const g2=c.createGain();g2.gain.value=0;s2.connect(f2);f2.connect(g2);g2.connect(this.m);s2.start();this.rainG=g2;},
  dest(pan){const c=this.c;if(c.createStereoPanner){const p=c.createStereoPanner();p.pan.value=clamp(pan,-1,1);p.connect(this.m);return p;}return this.m;},
  env(g,t,a,peak,dec){g.gain.setValueAtTime(0.0001,t);g.gain.exponentialRampToValueAtTime(peak,t+a);g.gain.exponentialRampToValueAtTime(0.0001,t+a+dec);},
  tone(type,f0,f1,dur,vol,pan,delay){if(!this.c||!this.on)return;const c=this.c,t=c.currentTime+(delay||0),o=c.createOscillator(),g=c.createGain();
    o.type=type;o.frequency.setValueAtTime(f0,t);o.frequency.exponentialRampToValueAtTime(f1,t+dur);this.env(g,t,0.005,vol,dur);
    o.connect(g);g.connect(this.dest(pan||0));o.start(t);o.stop(t+dur+0.05);},
  plop(size,pan,vol){const f0=(380+Math.random()*260)/(size||1);this.tone('sine',f0,f0*2.6,0.08,0.28*(vol||1),pan);},
  gulp(pan){this.tone('sine',300,110,0.08,0.18,pan);},
  thud(pan){this.tone('sine',140,50,0.12,0.3,pan);},
  splash(vol,pan){if(!this.c||!this.on)return;const c=this.c,t=c.currentTime,s=c.createBufferSource();s.buffer=this.white;
    const f=c.createBiquadFilter();f.type='lowpass';f.frequency.setValueAtTime(3000,t);f.frequency.exponentialRampToValueAtTime(400,t+0.5);
    const g=c.createGain();this.env(g,t,0.01,0.35*vol,0.5);s.connect(f);f.connect(g);g.connect(this.dest(pan));s.start(t,Math.random());s.stop(t+0.7);
    this.plop(2.2,pan,vol*1.2);this.tone('sine',500,1300,0.07,0.12,pan,0.12);},
  chirp(){if(!this.c||!this.on)return;const base=2400+Math.random()*1800,n=2+(Math.random()*4|0),pan=Math.random()*1.6-0.8;
    for(let k=0;k<n;k++){const f=base*(0.9+Math.random()*0.25);this.tone('sine',f,f*(Math.random()<0.5?1.35:0.7),0.07,0.05,pan,k*0.11+Math.random()*0.03);}},
  cricket(){if(!this.c||!this.on)return;const c=this.c,t=c.currentTime,o=c.createOscillator(),g=c.createGain();o.type='triangle';o.frequency.value=4300+Math.random()*500;
    g.gain.value=0;for(let k=0;k<3;k++){const s=t+k*0.045;g.gain.setValueAtTime(0,s);g.gain.linearRampToValueAtTime(0.025,s+0.008);g.gain.linearRampToValueAtTime(0,s+0.03);}
    o.connect(g);g.connect(this.dest(Math.random()*2-1));o.start(t);o.stop(t+0.16);},
  frog(pan){if(!this.c||!this.on)return;const c=this.c,t=c.currentTime,o=c.createOscillator(),f=c.createBiquadFilter(),g=c.createGain();
    o.type='sawtooth';o.frequency.value=95+Math.random()*30;f.type='lowpass';f.frequency.value=600;g.gain.value=0;
    for(let k=0;k<5;k++){const s=t+k*0.07;g.gain.setValueAtTime(0,s);g.gain.linearRampToValueAtTime(0.1,s+0.02);g.gain.linearRampToValueAtTime(0,s+0.06);}
    o.connect(f);f.connect(g);g.connect(this.dest(pan||0));o.start(t);o.stop(t+0.4);},
  tok(pan){this.tone('triangle',760,620,0.14,0.34,pan);this.tone('sine',1520,1380,0.07,0.1,pan);this.tone('triangle',760,620,0.12,0.06,pan,0.2);},
  pour(pan){this.splash(0.45,pan);},
  chime(){if(!this.c||!this.on)return;const f=pick([1568,1760,2093,2349,2637]),pan=Math.random()*1.2-0.6;
    this.tone('sine',f,f*0.998,2.4,0.05,pan);this.tone('sine',f*2.76,f*2.75,1.1,0.018,pan);this.tone('sine',f*5.4,f*5.39,0.5,0.008,pan);},
  click(){this.tone('square',1600,900,0.03,0.025,0);},
  thunder(delay){if(!this.c||!this.on)return;const c=this.c,t=c.currentTime+delay,s=c.createBufferSource();s.buffer=this.brown;s.loop=true;
    const f=c.createBiquadFilter();f.type='lowpass';f.frequency.setValueAtTime(380,t);f.frequency.exponentialRampToValueAtTime(70,t+3.5);
    const g=c.createGain();g.gain.setValueAtTime(0.0001,t);g.gain.exponentialRampToValueAtTime(0.9,t+0.12);g.gain.exponentialRampToValueAtTime(0.25,t+0.8);g.gain.exponentialRampToValueAtTime(0.0001,t+4);
    s.connect(f);f.connect(g);g.connect(this.m);s.start(t);s.stop(t+4.2);},
  setRain(v){if(this.rainG)this.rainG.gain.setTargetAtTime(v*0.16,this.c.currentTime,0.6);},
  toggle(){this.on=!this.on;if(this.m)this.m.gain.setTargetAtTime(this.on?0.6:0,this.c.currentTime,0.05);},
  quiet(m){ if(!this.c)return; const c=this.c;
    if(m){ if(c.state==='running')c.suspend(); }
    else if(this.on&&c.state==='suspended')c.resume(); },
};

/* ================= pixel toolbar ================= */
const IP={k:[16,18,14],w:[246,238,214],l:[196,198,188],g:[150,150,140],s:[96,98,92],r:[214,70,46],o:[240,140,58],y:[250,206,96],
  b:[150,98,54],d:[92,58,32],G:[104,170,74],D:[50,104,48],c:[150,214,236],C:[60,120,170],p:[244,160,190]};
const ICONS={
 feed:["....b.......","........b...","..b.........","......b.....","...b....b...","............","..bdbbdbdb..",".kdbbdbbdbk.","kyrrrrrrrryk",".kroorrrrrk.","..krrrrrrk..","...kkkkkk..."],
 touch:["....kk......","...kwwk.....","...kwwk.....","...kwwkkkk..","...kwwkwwkk.",".kkkwwwwwwwk","kwwkwwwwwwwk","kwwwwwwwwwwk",".kwwwwwwwwk.","..kwwwwwwwk.","...kwwwwwk..","....kkkkk..."],
 pebble:["............","............","....kkkkk...","..kkllggskk.",".klllgggggsk",".kllggggggsk","kgggggggggsk","kggggggggssk",".kgggggsssk.","..kkssssskk.","....kkkkk...","............"],
 move:[".....kk.....","....kwwk....","...kwwwwk...","....kGGk....",".k..GGGG..k.","kwkGGDGGGkwk","kwkGGGDGGkwk",".k..GGGG..k.","....kGGk....","...kwwwwk...","....kwwk....",".....kk....."],
 rain:["............","....kkkk....","...kwwwwk...",".kkwwwwwwkk.","kwwwwwwwwwwk","kllwwwwwwllk",".kkkkkkkkkk.","..c...c...c.",".c...c...c..","............","...c...c....","..c...c....."],
 fish:[".y..........","yyy.........",".y..........","............","......kkkk..","kk..kkwrrwk.","kwkkwwrrrwwk",".kwwwrwwwkwk","kwkkwwwrrwwk","kk..kkwwwwk.","......kkkk..","............"],
 soundOn:["............",".....k......","....kk...c..","...kwk.c..c.","kkkwwk..c.c.","kwwwwk..c..c","kwwwwk..c..c","kkkwwk..c.c.","...kwk.c..c.","....kk...c..",".....k......","............"],
 soundOff:["............",".....k......","....kk......","...kwk......","kkkwwk.r..r.","kwwwwk..rr..","kwwwwk..rr..","kkkwwk.r..r.","...kwk......","....kk......",".....k......","............"],
 snap:["............","............","...kkkk.....",".kklllkkkkk.","kgggkkkkgyyk","kggkCcCCkggk","kggkcCCCkggk","kggkCCCCkggk","kgggkkkkgggk",".kkkkkkkkkk.","............","............"],
 hide:["............","............","............","....kkkk....","..kkwwwwkk..",".kwwwkkwwwk.","kwwwkCwkwwwk",".kwwwkkwwwk.","..kkwwwwkk..","....kkkk....","............","............"]};
function timeIcon(k){
  const rows=[];
  for(let y=0;y<12;y++){let s='';
    for(let x=0;x<12;x++){const px=x+0.5,py=y+0.5;let ch='.';
      if(k===1){const d=Math.hypot(px-6,py-6);
        if(d<3.1)ch=(px+py<10.6)?'w':(px+py>13.4)?'o':'y';else if(d<4)ch='k';
        else if(d>4.6&&d<6.1){const a=Math.atan2(py-6,px-6)/(Math.PI/4),q=Math.abs(a-Math.round(a));if(q<0.14)ch='y';}}
      else if(k===4){const d1=Math.hypot(px-6,py-6.3),d2=Math.hypot(px-8.4,py-4.4);
        if(d1<4.3&&d2>3.3)ch=(d1>3.5||d2<4.1)?'k':(px+py<10?'w':'l');
        else if((x===2&&y===2)||(x===10&&y===9)||(x===10&&y===1)||(x===1&&y===8))ch='y';}
      else{const hz=k===2?9:8,cy=k===0?8:k===2?6.2:9,r=k===2?3.9:3.6,d=Math.hypot(px-6,py-cy),sun=k===0?'p':k===2?'o':'r',hi=k===0?'w':'y';
        if(y<hz){if(d<r-0.8)ch=(px-6+py-cy<-1.2)?hi:sun;else if(d<r+0.1)ch='k';
          else if(k===3&&((x===2&&y===2)||(x===9&&y===1)||(x===10&&y===4)))ch='w';
          else if(k===0&&y===2&&x>1&&x<10&&x%3===0)ch='p';}
        else if(y===hz)ch='C';
        else{const w=r-(y-hz)*0.9;if(y%2===(hz+1)%2&&Math.abs(px-6)<w)ch=sun;}}
      s+=ch;}
    rows.push(s);}
  return rows;
}
const TIMEI=[0,1,2,3,4].map(timeIcon);
const BTN=[{id:'feed',key:'1'},{id:'touch',key:'2'},{id:'pebble',key:'3'},{id:'move',key:'4'},{sep:1},
  {id:'rain',key:'R'},{id:'time',key:'T'},{id:'fish',key:'F'},{id:'sound',key:'M'},{id:'snap',key:'P'},{id:'hide',key:'H'}];
let BZ=2,barRects=[],barHover=-1,barPress=-1,barW=0,barH=0,keyFx=-1,keyFxT=0,lastMove=performance.now();
function layoutBar(){
  const B=22,G=2,P=4,SEP=6,items=BTN.filter(b=>!b.sep);
  const singleW=P*2+items.length*B+(items.length-1)*G+SEP;
  barRects=[];
  if(pondW()*0.94>=singleW*2){let x=P;for(const b of BTN){if(b.sep){x+=SEP;continue;}barRects.push({b,x,y:P});x+=B+G;}barW=x-G+P;barH=P*2+B;}
  else{items.forEach((b,k)=>{const row=k<5?0:1,col=k%5;barRects.push({b,x:P+col*(B+G),y:P+row*(B+G)});});barW=P*2+5*B+4*G;barH=P*2+2*B+G;}
  BZ=clamp(Math.floor(pondW()*0.94/barW),1,pondW()>2400?3:2);
  bar.width=barW;bar.height=barH;bar.style.width=barW*BZ+'px';bar.style.height=barH*BZ+'px';
  drawBar();
}
function isOn(b){const id=b.id;if(id==='feed'||id==='touch'||id==='pebble'||id==='move')return tool===id;if(id==='rain')return rainOn;if(id==='sound')return Snd.on;if(id==='hide')return uiHidden;return false;}
function iconFor(b){if(b.id==='time')return TIMEI[todTarget];if(b.id==='sound')return Snd.on?ICONS.soundOn:ICONS.soundOff;return ICONS[b.id];}
function drawBar(){
  if(!barW)return;
  const im=bctx.createImageData(barW,barH),o=new Uint32Array(im.data.buffer);
  const P=(x,y,c)=>{if(x>=0&&y>=0&&x<barW&&y<barH)o[y*barW+x]=packC(c[0],c[1],c[2]);};
  for(let y=0;y<barH;y++)for(let x=0;x<barW;x++){
    const ex=x===0||x===barW-1,ey=y===0||y===barH-1;if(ex&&ey)continue;let c;
    if(ex||ey)c=[10,12,10];
    else if(x===1||y===1)c=[136,92,54];
    else if(x===barW-2||y===barH-2)c=[72,46,28];
    else if(x===2||y===2||x===barW-3||y===barH-3)c=[14,18,16];
    else c=((y*7+(x*3>>2))%11===0)?[30,38,33]:[23,30,26];
    P(x,y,c);}
  barRects.forEach((r,k)=>{
    const b=r.b,on=isOn(b),hov=k===barHover,pr=k===barPress||k===keyFx,ox=r.x,oy=r.y+(pr?1:0);
    const face=on?[184,60,40]:hov?[62,80,64]:[42,54,45],lt=on?[238,124,86]:hov?[94,116,96]:[70,88,72],dk=on?[112,30,20]:[24,31,26];
    for(let y=0;y<22;y++)for(let x=0;x<22;x++){const ex=x===0||x===21,ey=y===0||y===21;if(ex&&ey)continue;
      P(ox+x,oy+y,ex||ey?[8,10,8]:(x===1||y===1)?(pr?dk:lt):(x===20||y===20)?(pr?lt:dk):face);}
    if(on)for(const [x,y] of [[2,2],[19,2],[2,19],[19,19]])P(ox+x,oy+y,[250,206,110]);
    const ic=iconFor(b),shc=[face[0]*0.45,face[1]*0.45,face[2]*0.45];
    for(let y=0;y<12;y++){const row=ic[y]||'';for(let x=0;x<12;x++){const ch=row[x];if(ch&&ch!=='.'&&IP[ch])P(ox+5+x,oy+4+y,shc);}}
    for(let y=0;y<12;y++){const row=ic[y]||'';for(let x=0;x<12;x++){const ch=row[x];if(ch&&ch!=='.'&&IP[ch])P(ox+4+x,oy+3+y,IP[ch]);}}
    for(let y=0;y<7;y++)for(let x=0;x<5;x++)if(!(x===0&&y===0))P(ox+16+x,oy+14+y,[14,16,14]);
    const g=FONT[b.key];
    if(g)for(let rr=0;rr<5;rr++){const bits=g.charCodeAt(rr)-48;for(let cc=0;cc<3;cc++)if(bits&(4>>cc))P(ox+17+cc,oy+15+rr,on?[255,226,160]:hov?[250,238,206]:[200,190,160]);}
  });
  bctx.putImageData(im,0,0);
}
function barHit(e){const r=bar.getBoundingClientRect(),x=(e.clientX-r.left)/BZ,y=(e.clientY-r.top)/BZ;
  for(let k=0;k<barRects.length;k++){const b=barRects[k];if(x>=b.x&&x<b.x+22&&y>=b.y&&y<b.y+22)return k;}return -1;}
function setTool(t){tool=t;}
function toggleRain(){rainOn=!rainOn;}
function nextTime(){todTarget=(todTarget+1)%PRESETS.length;}
function toggleSound(){Snd.toggle();}
function toggleUI(){uiHidden=!uiHidden;bar.classList.toggle('hid',uiHidden);}
function doSnap(){const c=document.createElement('canvas'),s=Math.max(4,SCALE);c.width=W*s;c.height=H*s;const x=c.getContext('2d');x.imageSmoothingEnabled=false;
  x.drawImage(cv,0,0,c.width,c.height);const a=document.createElement('a');a.download='koi-pond.png';a.href=c.toDataURL('image/png');a.click();env.flash=0.55;Snd.click();}
function doAction(id){
  if(id==='feed'||id==='touch'||id==='pebble'||id==='move')setTool(id);
  else if(id==='rain')toggleRain();else if(id==='time')nextTime();else if(id==='fish')addFish();
  else if(id==='sound')toggleSound();else if(id==='snap')snapReq=true;else if(id==='hide')toggleUI();
  if(id!=='snap')Snd.click();drawBar();
}
function act(id){Snd.init();if(uiHidden&&id!=='hide'){toggleUI();drawBar();return;}doAction(id);}
bar.addEventListener('pointermove',e=>{lastMove=performance.now();const k=barHit(e);if(k!==barHover){barHover=k;drawBar();}});
bar.addEventListener('pointerleave',()=>{barHover=-1;barPress=-1;drawBar();});
bar.addEventListener('pointerdown',e=>{e.preventDefault();barPress=barHit(e);drawBar();});
bar.addEventListener('pointerup',e=>{const k=barHit(e);if(k>=0&&k===barPress)act(barRects[k].b.id);barPress=-1;drawBar();});
bar.addEventListener('contextmenu',e=>e.preventDefault());

/* ================= input ================= */
function setMouse(e){const r=cv.getBoundingClientRect(),nx=(e.clientX-r.left)/SCALE,ny=(e.clientY-r.top)/SCALE;if(Math.abs(nx-mouse.x)+Math.abs(ny-mouse.y)>0.4)mouse.still=0;mouse.x=nx;mouse.y=ny;mouse.over=true;}
cv.addEventListener('pointerdown',e=>{
  Snd.init();try{cv.setPointerCapture(e.pointerId);}catch(_){}setMouse(e);mouse.down=true;mouse.still=0;
  const pan=mouse.x/W*2-1;
  if(e.button===2){dropPebble(mouse.x,mouse.y);return;}
  if(tool==='feed')feed(mouse.x,mouse.y,RI(4,7));
  else if(tool==='pebble')dropPebble(mouse.x,mouse.y);
  else if(tool==='move')mouse.grab=padAt(mouse.x,mouse.y);
  else if(tool==='touch'&&depthAt(mouse.x,mouse.y)>=0){disturb(mouse.x,mouse.y,2.5,3);scare(mouse.x,mouse.y,45*SC(),1);Snd.plop(1.3,pan,0.6);}
});
cv.addEventListener('pointermove',setMouse);
const up=()=>{mouse.down=false;mouse.grab=null;};
cv.addEventListener('pointerup',up);cv.addEventListener('pointercancel',up);
cv.addEventListener('pointerleave',()=>{mouse.over=false;up();});
cv.addEventListener('contextmenu',e=>e.preventDefault());
addEventListener('pointermove',()=>{lastMove=performance.now();},{passive:true});
const KEYMAP={'1':'feed','2':'touch','3':'pebble','4':'move',r:'rain',t:'time',f:'fish',m:'sound',p:'snap',h:'hide'};
addEventListener('keydown',e=>{
  if(!mouse.over)return;
  if(e.repeat||e.ctrlKey||e.metaKey||e.altKey)return;const id=KEYMAP[e.key.toLowerCase()];if(!id)return;
  lastMove=performance.now();Snd.init();doAction(id);
  keyFx=barRects.findIndex(r=>r.b.id===id);keyFxT=8;drawBar();});
let rt=0;const rebuild=()=>{clearTimeout(rt);rt=setTimeout(build,300);};
addEventListener('resize',rebuild);
if('ResizeObserver' in window&&holder){new ResizeObserver(()=>rebuild()).observe(holder);}

/* ================= ✦ EXTRAORDINARY UPGRADE ✦ — paste above the "loop" section ================= */
let cbuf=new Uint32Array(1),puddle=new Float32Array(1),rainP=[],rings=[],splats=[],motes=[],birds=[],glints=[],meteor=null,
    moonTex=new Float32Array(1),moonR=4,birdT=600,gOx=0,gOy=0,gAx=0,gAy=0,AIR=false,lastTick=0;
env.wet=0;env.cloud=0;env.sun=0;
const CLOUDK=[0.16,0.3,0.22,0.08,0],SUNK=[0.5,0,0.9,0.35,0];

function build(){
  const IW=pondW(),IH=pondH();
  SCALE=Math.min(6,(IW<760?2:clamp(Math.round(IW/640),2,6))+QBUMP);
  W=Math.ceil(IW/SCALE);H=Math.ceil(IH/SCALE);N=W*H;S=Math.min(W,H);
  cv.width=W;cv.height=H;cv.style.width=W*SCALE+'px';cv.style.height=H*SCALE+'px';
  img=ctx.createImageData(W,H);out=new Uint32Array(img.data.buffer);
  bed=new Uint32Array(N);under=new Uint32Array(N);uD=new Float32Array(N);depth=new Float32Array(N);
  wm=new Uint8Array(N);w0=new Float32Array(N);w1=new Float32Array(N);mark=new Uint32Array(N);
  LR=new Float32Array(N);LG=new Float32Array(N);LB=new Float32Array(N);emis=new Float32Array(N);
  shadowMap=new Float32Array(N);canA=new Uint32Array(N);canB=new Uint32Array(N);deckBuf=new Uint32Array(N);
  vig=new Float32Array(N);wshade=new Float32Array(N);stoneCol=new Uint32Array(N);wtint=new Uint32Array(N);
  cbuf=new Uint32Array(N);puddle=new Float32Array(N);
  wXa=new Float32Array(W);wYa=new Float32Array(H);
  NOFF=RI(0,9000);
  genMask();genIsland();genStones();
  distIn=chamfer(1);distOut=chamfer(0);
  genDepth();paintBed();genZen();genPath();genDeck();genLantern();genSpout();genCanopy();genEntities();genVignette();genTint();
  genPuddles();genMoon();genExtras();
  layoutBar();
}
function genPuddles(){
  for(let y=2;y<H-2;y++)for(let x=2;x<W-2;x++){const i=y*W+x;if(wm[i]||stoneCol[i]||deckBuf[i]||distOut[i]<4)continue;
    if(lantern&&Math.abs(x-lantern.x)<lantern.s*2&&Math.abs(y-lantern.y)<lantern.s*2)continue;
    const n=fbm(x*0.045+170,y*0.07+90,3);if(n>0.66)puddle[i]=Math.min(1,(n-0.66)*9);}
}
function genMoon(){
  moonR=Math.max(3,Math.round(S*0.024));const r=moonR,D=r*2+1;moonTex=new Float32Array(D*D);
  const ph=pick([1,1,0.85,0.7,0.5]),sx=-r*2*ph,ox=R(50),oy=R(50);
  for(let v=-r;v<=r;v++)for(let u=-r;u<=r;u++){const d=Math.hypot(u,v);if(d>r+0.2)continue;
    let b=1-0.24*(d/r)*(d/r);
    const n=fbm(u*2.2/r+ox,v*2.2/r+oy,3);if(n>0.56)b*=0.72;else if(n>0.5)b*=0.86;
    if(hash2(u+77,v+33)>0.95)b*=0.85;
    if(ph<1&&Math.hypot(u-sx,v)<r*1.02)b*=0.08;
    moonTex[(v+r)*D+(u+r)]=b>0.9?1:b>0.75?0.82:b>0.5?0.64:b;}
}
function genExtras(){
  rainP=[];rings=[];splats=[];birds=[];glints=[];meteor=null;birdT=R(500,900);
  motes=[];for(let k=0,n=clamp(Math.round(waterCount/1400),20,90);k<n;k++){const p=randWater(0.15,1);if(p)motes.push({x:p.x,y:p.y,z:R(0.05,0.9)*depthAt(p.x,p.y),ph:R(TAU)});}
}
function gustAt(x,y){return MT[((((y|0)>>1)-gOy)&127)*128+((((x|0)>>1)-gOx)&127)];}
function updateWeather(dt){
  env.wet=clamp(env.wet+(env.rain>0.4?dt/700:-dt/2600),0,1);
  const NP=PRESETS.length,a=Math.floor(todCur)%NP,b=(a+1)%NP,f=todCur-Math.floor(todCur);
  env.cloud=lerp(CLOUDK[a],CLOUDK[b],f)*(1-env.rain);env.sun=lerp(SUNK[a],SUNK[b],f)*(1-env.rain);
  gAx+=dt/60*8*(0.4+Math.max(0,env.windX));gAy+=dt/60*2.5;gOx=gAx|0;gOy=gAy|0;
}

/* ---------- rain ---------- */
function spawnDrop(z){const x=R(-10,W+10),y=R(-10,H+30),xi=x|0,yi=y|0,inb=xi>=0&&yi>=0&&xi<W&&yi<H;
  rainP.push({x,y,z,vz:R(2.4,3.4),w:R(0.5,1),big:0,leaf:inb&&!!(canA[yi*W+xi]||canB[yi*W+xi])});}
function rainImpact(x,y,big){
  const xi=x|0,yi=y|0;if(xi<1||yi<1||xi>=W-1||yi>=H-1)return;const i=yi*W+xi,sc=SC();
  if(deckBuf[i]){if(splats.length<500)splats.push({x,y,t:0});return;}
  if(wm[i]){const pd=padAt(x,y);
    if(pd){if(splats.length<500)splats.push({x,y,t:0});pd.vx+=R(-0.006,0.006);pd.vy+=R(-0.006,0.006);
      if(rnd()<0.25){const a=R(TAU);drops.push({x,y,z:0.2,vx:Math.cos(a)*0.4,vy:Math.sin(a)*0.4,vz:R(0.4,0.8)});}return;}
    disturb(x,y,big?1.6:1,big?1.6:R(0.5,1.2));
    if(rings.length<420&&rnd()<0.75)rings.push({x,y,t:0,life:R(22,38),max:(big?R(4,6):R(2.4,4.4))*sc,a:R(0.55,0.95),big:big?1:0});
    if(rnd()<(big?0.6:0.07))for(let k=0;k<2;k++){const a=R(TAU);drops.push({x,y,z:0.2,vx:Math.cos(a)*0.35,vy:Math.sin(a)*0.35,vz:R(0.5,1)});}
    if(Snd.c&&frame-lastTick>2&&rnd()<0.12){lastTick=frame;Snd.tick(x/W*2-1);}
    return;}
  if(puddle[i]*env.wet>0.3&&rings.length<420){rings.push({x,y,t:0,life:R(16,26),max:R(1.8,3)*sc,a:0.75,pud:1});return;}
  if(splats.length<500)splats.push({x,y,t:0});
}
function updateRain(dt){
  const target=Math.floor(env.rain*N/380);let need=target-rainP.length;
  if(need>0){need=Math.min(need,60);for(let k=0;k<need;k++)spawnDrop(R(10,70));}
  if(env.wet>0.25&&env.rain<0.5&&canPix.length&&rnd()<0.12*env.wet*dt){const i=pick(canPix);rainP.push({x:i%W+R(-1,1),y:(i/W|0)+R(-1,1),z:16,vz:1.3,w:1,big:1,leaf:false});}
  const wx=env.windX*0.35;
  for(const p of rainP){p.z-=p.vz*dt;
    if(p.leaf&&p.z<=18){p.leaf=false;if(splats.length<500)splats.push({x:p.x+18*wx,y:p.y-9,t:0});if(rnd()<0.25){p.vz=1.3;p.big=1;}else{p.dead=1;continue;}}
    if(p.z<=0){rainImpact(p.x,p.y,p.big);p.dead=1;}}
  rainP=rainP.filter(p=>!p.dead);
  for(const g of rings)g.t+=dt;rings=rings.filter(g=>g.t<g.life);
  for(const s of splats)s.t+=dt;splats=splats.filter(s=>s.t<10);
}

/* ---------- koi leaps ---------- */
function splashAt(x,y,s){const sc=SC();disturb(x,y,3*s*sc,4.5*s);
  for(let k=0,n=Math.round(16*s);k<n;k++){const a=R(TAU),v=R(0.3,1.2)*s;drops.push({x,y,z:0.5,vx:Math.cos(a)*v,vy:Math.sin(a)*v,vz:R(0.8,2)*s});}
  for(let k=0;k<3;k++)rings.push({x,y,t:-k*6,life:40,max:(5+k*3)*sc*s,a:0.9,big:1});
  Snd.splash(0.8*s,x/W*2-1);}
function tryLeap(f){
  if(f.leap||f.k.small)return false;const h=f.pts[0],dist=f.len*R(1.8,2.6),ca=Math.cos(f.a),sa=Math.sin(f.a);
  for(const q of [0.33,0.66,1]){const x=h.x+ca*dist*q,y=h.y+sa*dist*q;
    if(depthAt(x,y)<0.2||padAt(x,y)||(deck&&x>deck.x0-3&&x<deck.x1+3&&y>deck.y0-3))return false;}
  f.leap={t:0,dur:R(46,60),dist,h:0};f.z=0.02;splashAt(h.x,h.y,0.7);return true;
}
function leapStep(f,dt){
  const L=f.leap,h=f.pts[0];L.t+=dt;const p=Math.min(1,L.t/L.dur);
  L.h=Math.sin(Math.PI*p)*f.len*0.85;
  const sp=L.dist/L.dur;h.x+=Math.cos(f.a)*sp*dt;h.y+=Math.sin(f.a)*sp*dt;
  const seg=f.len/(f.n-1);
  for(let k=1;k<f.n;k++){const a=f.pts[k],q=f.pts[k-1],dx=a.x-q.x,dy=a.y-q.y,dd=Math.sqrt(dx*dx+dy*dy)||1;a.x=q.x+dx/dd*seg;a.y=q.y+dy/dd*seg;}
  f.phase+=0.3*dt;f.speed=1;f.z=0.02;
  if(rnd()<0.35*dt){const t=f.pts[f.n-1];drops.push({x:t.x,y:t.y,z:L.h*0.6,vx:R(-0.2,0.2),vy:R(-0.2,0.2),vz:0});}
  if(p>=1){f.leap=null;f.tz=R(0.4,0.7);splashAt(h.x,h.y,1.1);scare(h.x,h.y,45*SC(),0.7);}
}
function updateFish(f,dt){
  if(f.leap){leapStep(f,dt);return;}
  const h=f.pts[0],ca=Math.cos(f.a),sa=Math.sin(f.a);
  if(f.mouth>0)f.mouth-=dt;
  f.wa+=(rnd()-0.5)*0.12*dt;f.wa*=Math.pow(0.985,dt);f.wa=clamp(f.wa,-1.2,1.2);
  let tx=Math.cos(f.a+f.wa),ty=Math.sin(f.a+f.wa),spd=f.cruise,turn=0.03;
  const need=0.06+f.len*0.002,look=5+f.len*0.6;
  const dA=depthAt(h.x+ca*look,h.y+sa*look),dL=depthAt(h.x+Math.cos(f.a-0.6)*look*0.7,h.y+Math.sin(f.a-0.6)*look*0.7),dR=depthAt(h.x+Math.cos(f.a+0.6)*look*0.7,h.y+Math.sin(f.a+0.6)*look*0.7);
  if(dA<need||dL<need||dR<need){const g=shoreGrad(h.x,h.y);tx+=g[0]*3;ty+=g[1]*3;turn=0.08;const s=dR>dL?0.9:-0.9;tx+=Math.cos(f.a+s)*1.5;ty+=Math.sin(f.a+s)*1.5;}
  let cx=0,cy=0,ax=0,ay=0,cn=0;
  for(const o of fish){if(o===f)continue;const dx=o.pts[0].x-h.x,dy=o.pts[0].y-h.y,d2=dx*dx+dy*dy,sep=(f.len+o.len)*0.45;
    if(d2<sep*sep&&d2>0.01){const d=Math.sqrt(d2),k=1.4*(1-d/sep);tx-=dx/d*k;ty-=dy/d*k;}
    else if(d2<2500){cx+=dx;cy+=dy;ax+=Math.cos(o.a);ay+=Math.sin(o.a);cn++;}}
  if(cn){tx+=cx/cn*0.004+ax/cn*0.15;ty+=cy/cn*0.004+ay/cn*0.15;}
  let best=null,bd=(110*f.sc)**2;
  for(const p of pellets){if(p.air>0||p.dead||p.sink>0)continue;const dx=p.x-h.x,dy=p.y-h.y,d2=dx*dx+dy*dy;if(d2<bd){bd=d2;best=p;}}
  if(best){const d=Math.sqrt(bd)+0.001;tx+=(best.x-h.x)/d*3.5;ty+=(best.y-h.y)/d*3.5;spd=f.cruise*2.6;turn=0.1;f.tz=0.02;
    if(d<Math.max(2.2,f.len*0.14)&&f.z<0.14)eat(f,best);}
  else if(tool==='feed'&&mouse.over&&mouse.still>40&&!mouse.down){const dx=mouse.x-h.x,dy=mouse.y-h.y,d2=dx*dx+dy*dy;
    if(d2<(80*f.sc)**2&&d2>25){const d=Math.sqrt(d2);tx+=dx/d*0.9;ty+=dy/d*0.9;f.tz=Math.min(f.tz,0.06);spd=f.cruise*(d<12?0.4:1.3);
      if(d<12&&f.z<0.1&&(frame+f.id*7)%50===0){disturb(h.x+ca*1.5,h.y+sa*1.5,1.3,0.9);f.mouth=14;if(rnd()<0.5)Snd.plop(0.8,h.x/W*2-1,0.12);}}}
  for(const s of scares){const dx=h.x-s.x,dy=h.y-s.y,d2=dx*dx+dy*dy;if(d2<s.r*s.r){const d=Math.sqrt(d2)+0.01,k=(1-d/s.r)*s.k*s.life;
    tx+=dx/d*6*k;ty+=dy/d*6*k;spd=Math.max(spd,f.cruise*(1+4*k));turn=0.16;f.tz=Math.min(0.9,f.z+0.4);}}
  if(!best&&rnd()<0.003*dt)f.tz=R(0.12,0.65);
  const diff=wrapA(Math.atan2(ty,tx)-f.a),mt=turn*dt*(1+f.speed);f.a+=clamp(diff,-mt,mt);
  f.speed+=(spd-f.speed)*0.04*dt;
  const nx=h.x+Math.cos(f.a)*f.speed*dt,ny=h.y+Math.sin(f.a)*f.speed*dt;
  if(depthAt(nx,ny)<0.025){f.a+=0.25*dt*(f.wa>=0?1:-1);f.speed*=0.8;}else{h.x=nx;h.y=ny;}
  const seg=f.len/(f.n-1);
  for(let k=1;k<f.n;k++){const p=f.pts[k],q=f.pts[k-1],dx=p.x-q.x,dy=p.y-q.y,d=Math.sqrt(dx*dx+dy*dy)||1;p.x=q.x+dx/d*seg;p.y=q.y+dy/d*seg;}
  const mz=Math.max(0.02,depthAt(h.x,h.y)-0.05);
  f.z+=(clamp(f.tz,0.02,mz)-f.z)*0.025*dt;if(f.z>mz)f.z=mz;
  f.phase+=(0.06+f.speed*0.4/f.sc)*dt;
  if(f.z<0.1&&f.speed>0.25&&(frame+f.id)%5===0)disturb(h.x,h.y,1.5,0.35*f.sc);
  if(rnd()<0.0006*dt)bubbles.push({x:h.x,y:h.y,z:f.z,r:R(0.5,1.2),id:R(99)});
}

/* ---------- ambient life ---------- */
function updateMotes(dt){
  for(const m of motes){m.x+=(Math.sin(T*0.3+m.ph)*0.04+env.windX*0.01)*dt;m.y+=Math.cos(T*0.27+m.ph*1.3)*0.03*dt;
    if(depthAt(m.x,m.y)<m.z+0.02){const p=randWater(0.15,1);if(p){m.x=p.x;m.y=p.y;m.z=R(0.05,0.9)*depthAt(p.x,p.y);}}}
}
function updateBirds(dt){
  birdT-=dt;
  if(birdT<=0){birdT=R(1800,4200);
    if(env.night<0.3&&env.rain<0.3){const sc=SC(),n=RI(3,6),fromL=rnd()<0.5,y=R(H*0.1,H*0.9),sp=R(1.1,1.6)*sc,ang=(fromL?0:Math.PI)+R(-0.35,0.35);
      const vx=Math.cos(ang)*sp,vy=Math.sin(ang)*sp,x=fromL?-30:W+30,ca=Math.cos(ang),sa=Math.sin(ang);
      for(let k=0;k<n;k++){const row=Math.ceil(k/2),side=k%2?1:-1;
        birds.push({x:x-ca*row*9*sc-sa*side*row*7*sc,y:y-sa*row*9*sc+ca*side*row*7*sc,vx,vy,ph:R(TAU),a:ang});}
      if(Snd.c)Snd.chirp();}}
  for(const b of birds){b.x+=b.vx*dt;b.y+=b.vy*dt;b.ph+=0.22*dt;if(b.x<-80||b.x>W+80||b.y<-80||b.y>H+80)b.dead=1;}
  birds=birds.filter(b=>!b.dead);
}
function updateMeteor(dt){
  if(!meteor){if(env.night>0.75&&env.rain<0.2&&rnd()<0.0003*dt){const dir=rnd()<0.5?1:-1,sc=SC();
      meteor={x:R(W*0.15,W*0.85),y:R(H*0.08,H*0.5),vx:R(2.2,3.6)*dir*sc,vy:R(0.7,1.6)*sc,t:0,life:R(26,42)};if(Snd.c)Snd.shimmer();}return;}
  meteor.t+=dt;meteor.x+=meteor.vx*dt;meteor.y+=meteor.vy*dt;if(meteor.t>meteor.life)meteor=null;
}

/* ---------- main update ---------- */
function update(dt){
  T+=dt/60;frame++;
  updateEnv(dt);updateWeather(dt);mouse.still+=dt;
  const sc=SC();
  if(mouse.down&&mouse.over){const mv=Math.hypot(mouse.x-mouse.px,mouse.y-mouse.py);
    if(tool==='touch'){if(depthAt(mouse.x,mouse.y)>=0){disturb(mouse.x,mouse.y,2,Math.min(2.2,0.35+mv*0.5));if(frame%10===0)scare(mouse.x,mouse.y,40*sc,0.8);}}
    else if(tool==='feed'&&mv>0.4&&frame%7===0)feed(mouse.x,mouse.y,1);}
  mouse.px=mouse.x;mouse.py=mouse.y;
  if(!introDone&&T>0.6){introDone=true;disturb(pondC.x,pondC.y,4,4);}
  if(rnd()<0.35*env.wind){const x=R(1,W-1),y=R(1,H-1);if(depthAt(x,y)>=0)disturb(x,y,1,0.2);}
  if(env.wind>0.6)for(let k=0;k<6;k++){const x=R(1,W-1),y=R(1,H-1);if(gustAt(x,y)>0.64&&depthAt(x,y)>=0)disturb(x,y,1,0.3*Math.min(1.4,env.wind));}
  updateRain(dt);
  if(env.rain>0.85&&rnd()<0.0006*dt){env.flash=0.95;flash2=R(5,9);const d=R(0.15,1.8);Snd.thunder(d);if(d<0.55)Snd.crack();}
  if(flash2>0){flash2-=dt;if(flash2<=0)env.flash=Math.max(env.flash,0.6);}
  waveStep();if(dt>1.6)waveStep();
  if(fish.length&&rnd()<0.00045*dt){const f=pick(fish);if(!f.leap&&f.z<0.45)tryLeap(f);}
  for(const f of fish)updateFish(f,dt);
  updatePads(dt);updatePellets(dt);
  if(rnd()<0.006*dt*(0.6+env.wind))spawnLeaf();
  updateLeaves(dt);updateDF(dt);updateStriders(dt);updateMisc(dt);updateSpout(dt);updateFrogs(dt);updateFlies(dt);
  updateMotes(dt);updateBirds(dt);updateMeteor(dt);
  pellets=pellets.filter(o=>!o.dead);leaves=leaves.filter(o=>!o.dead);bubbles=bubbles.filter(o=>!o.dead);
  drops=drops.filter(o=>!o.dead);sinkers=sinkers.filter(o=>!o.dead);scares=scares.filter(o=>!o.dead);
  hoverFish=null;
  if(mouse.over){let bd=1e9;for(const f of fish){for(const k of [0,3,6]){const p=f.pts[k],dx=p.x-mouse.x,dy=p.y-mouse.y,d=dx*dx+dy*dy,lim=Math.max(4,f.len*0.35);
    if(d<lim*lim&&d<bd){bd=d;hoverFish=f;}}}}
  if(Snd.c){
    if(env.night<0.3&&env.rain<0.3&&rnd()<0.004*dt)Snd.chirp();
    if(env.night>0.5&&rnd()<0.03*dt*env.night*(1-env.rain))Snd.cricket();
    if(env.night>0.4&&rnd()<0.0012*dt)Snd.frog(Math.random()*1.4-0.7);
    if(env.wind>0.85&&env.night<0.6&&rnd()<0.0015*dt)Snd.chime();
    Snd.setRain(env.rain);if(frame%10===0)Snd.setWind(env.wind);}
}

/* ---------- koi rendering (water + air) ---------- */
function drawFishShadow(f){
  prepSpine(f);
  const bd=Math.max(f.z,depthAt(RX[0],RY[0])),dz=Math.max(0,bd-f.z),off=1.5+dz*S*0.07,ox=off,oy=off*0.8,
    dark=1-(1-(0.62+dz*0.3))*(0.3+0.7*env.shadow),id=++markId,W0=f.len*0.18,steps=Math.ceil(f.len*1.2);
  for(let st=0;st<=steps;st++){const s=st/steps;spineAt(f,s);const w=W0*widthAt(s)*0.95+0.3,cx=SX+ox,cy=SY+oy,w2=w*w;
    for(let py=Math.floor(cy-w);py<=cy+w;py++)for(let px=Math.floor(cx-w);px<=cx+w;px++){if(px<0||py<0||px>=W||py>=H)continue;
      const dx=px+0.5-cx,dy=py+0.5-cy;if(dx*dx+dy*dy>w2)continue;const i=py*W+px;
      if(!wm[i]||mark[i]===id||uD[i]<depth[i]-0.001)continue;mark[i]=id;scale(under,i,dark);}}
}
function fan(bx,by,a0,spread,len,c0,c1,alpha,id,z,fork,ph){
  const B=AIR?out:under,RR=len*1.12+1,RR2=RR*RR,rk=len*1.2,x0=Math.max(0,Math.floor(bx-RR)),x1=Math.min(W-1,Math.ceil(bx+RR)),y0=Math.max(0,Math.floor(by-RR)),y1=Math.min(H-1,Math.ceil(by+RR));
  for(let py=y0;py<=y1;py++)for(let px=x0;px<=x1;px++){
    const i=py*W+px;if(mark[i]===id)continue;if(!AIR&&(!wm[i]||z>uD[i]+0.001))continue;
    const dx=px+0.5-bx,dy=py+0.5-by,d2=dx*dx+dy*dy;if(d2>RR2||d2<0.09)continue;
    const da=wrapA(Math.atan2(dy,dx)-a0);if(da>spread||da<-spread)continue;
    const t=da/spread,at=t<0?-t:t;
    let rl=fork?len*(0.6+0.4*Math.pow(at,0.7)):len*(1-0.4*t*t);
    if(ph!==undefined)rl*=1+0.09*Math.sin(t*5+ph*1.3);
    const d=Math.sqrt(d2);if(d>rl)continue;
    const q=d/rl;let a=alpha*(1-q*0.35)*(Math.cos(da*rk)>0.2?1.2:0.8);if(q>0.84)a*=1.3;if(a>1)a=1;
    mark[i]=id;blend(B,i,c0[0]+(c1[0]-c0[0])*q,c0[1]+(c1[1]-c0[1])*q,c0[2]+(c1[2]-c0[2])*q,a);if(!AIR)uD[i]=z;}
}
function stampBody(f,cx,cy,nx,ny,w,s,bid){
  const B=AIR?out:under,w2=w*w,ui=Math.min(PU-1,(s*PU)|0)*PV,pal=f.pal,pat=f.pat,met=f.k.met,z=f.z,hd=s<0.13?0.03:0,mph=s*9-T*2.2+f.id;
  const x0=Math.max(0,Math.floor(cx-w)),x1=Math.min(W-1,Math.floor(cx+w)),y0=Math.max(0,Math.floor(cy-w)),y1=Math.min(H-1,Math.floor(cy+w));
  for(let py=y0;py<=y1;py++)for(let px=x0;px<=x1;px++){
    const dx=px+0.5-cx,dy=py+0.5-cy;if(dx*dx+dy*dy>w2)continue;
    const i=py*W+px;if(!AIR&&(!wm[i]||z>uD[i]+0.001))continue;
    const v=(dx*nx+dy*ny)/w;let vi=Math.round((v+1)*0.5*(PV-1));vi=vi<0?0:vi>PV-1?PV-1:vi;
    const c=pal[pat[ui+vi]];
    let sh=1.05-v*v*0.34+(-dx-dy)/w*0.13+hd+(BAY[((py&3)<<2)|(px&3)]-0.5)*0.1;
    if(met)sh+=Math.sin(mph+v*2)>0.8?0.2:0.04;
    sh=sh>1.12?1.2:sh>0.97?1.05:sh>0.82?0.9:0.76;
    if(AIR&&(-dx-dy)/w>0.45&&v*v<0.5)sh=1.4;
    B[i]=packC(c[0]*sh,c[1]*sh,c[2]*sh);if(!AIR)uD[i]=z;mark[i]=bid;}
}
function drawFish(f){
  prepSpine(f);
  const n=f.n,z=f.z,f0=f.fin0,f1=f.fin1,B=AIR?out:under;let sA=1;
  if(AIR&&f.leap){const hh=f.leap.h,cx=RX[4],cy=RY[4],ox=-hh*0.12,oy=-hh*0.3;sA=1+hh*0.012;
    for(let k=0;k<n;k++){RX[k]=cx+(RX[k]-cx)*sA+ox;RY[k]=cy+(RY[k]-cy)*sA+oy;}}
  const L=f.len*sA,W0=L*0.18;
  const ta=Math.atan2(-TYa[n-1],-TXa[n-1])+Math.sin(f.phase-4.6)*0.35;
  fan(RX[n-1]+TXa[n-1]*0.8,RY[n-1]+TYa[n-1]*0.8,ta,f.long?0.78:0.62,L*(f.long?0.44:0.28),f0,f1,0.72,++markId,z,true,f.long?f.phase:undefined);
  const fb=Math.sin(f.phase*0.55)*0.3;
  for(const [sp,th,fl,spr] of [[0.24,1.05,f.long?0.25:0.16,0.45],[0.52,0.8,f.long?0.15:0.095,0.38]]){
    spineAt(f,sp);const ww=W0*widthAt(sp)*0.72,id=++markId,sx=SX,sy=SY,tx=STX,ty=STY;
    for(const side of [-1,1]){const nx=-ty*side,ny=tx*side,t=th+fb*side*(sp<0.4?1:0.5);
      const dx=-tx*Math.cos(t)+nx*Math.sin(t),dy=-ty*Math.cos(t)+ny*Math.sin(t);
      fan(sx+nx*ww,sy+ny*ww,Math.atan2(dy,dx),spr,L*fl,f0,f1,0.62,id,z,false,f.long?f.phase+side:undefined);}}
  const bid=++markId;let mnx=1e9,mxx=-1e9,mny=1e9,mxy=-1e9;
  const steps=Math.ceil(L*1.8);
  for(let st=0;st<=steps;st++){const s=st/steps;spineAt(f,s);const w=W0*widthAt(s)+0.35;stampBody(f,SX,SY,-STY,STX,w,s,bid);
    if(SX-w<mnx)mnx=SX-w;if(SX+w>mxx)mxx=SX+w;if(SY-w<mny)mny=SY-w;if(SY+w>mxy)mxy=SY+w;}
  const X0=Math.max(1,Math.floor(mnx)),X1=Math.min(W-2,Math.ceil(mxx)),Y0=Math.max(1,Math.floor(mny)),Y1=Math.min(H-2,Math.ceil(mxy));
  for(let y=Y0;y<=Y1;y++)for(let x=X0;x<=X1;x++){const i=y*W+x;if(mark[i]!==bid)continue;
    if(mark[i-1]!==bid||mark[i+1]!==bid||mark[i-W]!==bid||mark[i+W]!==bid)scale(B,i,0.7);}
  for(let s=0.28;s<=0.62;s+=0.6/L){spineAt(f,s);const sw=Math.sin(f.phase*0.9-s*4)*W0*0.15,px=Math.floor(SX-STY*sw),py=Math.floor(SY+STX*sw);
    if(px<0||py<0||px>=W||py>=H)continue;const i=py*W+px;if(mark[i]===bid)blend(B,i,f0[0],f0[1],f0[2],0.4);}
  spineAt(f,0.075);const we=W0*widthAt(0.075)*0.6;
  for(const side of [-1,1]){const ex=Math.floor(SX-STY*side*we),ey=Math.floor(SY+STX*side*we);if(ex<0||ey<0||ex>=W||ey>=H)continue;
    const i=ey*W+ex;if(mark[i]===bid)B[i]=pack(16,16,22);}
  spineAt(f,0);const hx=SX+STX*0.6,hy=SY+STY*0.6;
  if(f.mouth>0&&hx>=0&&hy>=0&&hx<W&&hy<H){const i=(hy|0)*W+(hx|0);if(mark[i]===bid)B[i]=pack(70,30,36);}
  if(!f.k.small)for(const side of [-1,1]){const bx=hx-STY*side*W0*0.35+STX*0.9,by=hy+STX*side*W0*0.35+STY*0.9,xi=bx|0,yi=by|0;
    if(xi<0||yi<0||xi>=W||yi>=H)continue;const i=yi*W+xi;if(mark[i]!==bid&&(AIR||(wm[i]&&z<=uD[i]+0.001)))blend(B,i,f1[0],f1[1],f1[2],0.45);}
}
function drawLeapShadow(f){
  prepSpine(f);const hh=f.leap.h,ox=hh*0.55+1.5,oy=hh*0.65+1.2,W0=f.len*0.18,id=++markId,steps=Math.ceil(f.len*1.2),k=1-0.45*(0.4+0.6*env.shadow);
  for(let st=0;st<=steps;st++){const s=st/steps;spineAt(f,s);const w=W0*widthAt(s)+0.3,cx=SX+ox,cy=SY+oy,w2=w*w;
    for(let py=Math.floor(cy-w);py<=cy+w;py++)for(let px=Math.floor(cx-w);px<=cx+w;px++){const dx=px+0.5-cx,dy=py+0.5-cy;if(dx*dx+dy*dy<=w2)darkAt(px,py,k,id);}}
}

/* ---------- new render passes ---------- */
function drawMotes(){for(const m of motes){const x=m.x|0,y=m.y|0;if(x<0||y<0||x>=W||y>=H)continue;const i=y*W+x;if(!wm[i]||m.z>uD[i]+0.001)continue;
  blend(under,i,226,232,200,0.28*(1-m.z*0.6)*(0.6+0.4*Math.sin(T*3+m.ph)));}}
function drawRings(){
  for(const g of rings){if(g.t<0)continue;const p=g.t/g.life;if(p>=1)continue;
    const a=g.a*(1-p)*(1-p*0.4),e=Math.pow(p,0.55),radii=g.big?[g.max*e+0.4,g.max*0.6*e]:[g.max*e+0.4];
    for(let ri=0;ri<radii.length;ri++){const r=radii[ri],n=Math.max(8,Math.ceil(r*6.6)),id=++markId,aa=ri?a*0.6:a;
      for(let k=0;k<n;k++){const ang=k/n*TAU,x=Math.floor(g.x+Math.cos(ang)*r),y=Math.floor(g.y+Math.sin(ang)*r*0.92);
        if(x<0||y<0||x>=W||y>=H)continue;const i=y*W+x;if(mark[i]===id)continue;mark[i]=id;
        if(g.pud?puddle[i]<0.15:!wm[i])continue;
        const lit=Math.cos(ang+2.356);
        if(lit>0.25)blend(out,i,236,246,250,aa*0.8);else if(lit<-0.35)scale(out,i,1-aa*0.32);else blend(out,i,200,222,228,aa*0.32);}}
    if(p<0.18){const x=g.x|0,y=g.y|0;if(x>=0&&y>=0&&x<W&&y<H&&(g.pud||wm[y*W+x]))blend(out,y*W+x,240,250,255,a*0.9);}}
}
function drawSplats(){
  if(!splats.length)return;const a=env.amb,fl=env.flash,cr=Math.min(255,170*a[0]+60+fl*100),cg=Math.min(255,182*a[1]+60+fl*100),cb=Math.min(255,198*a[2]+64+fl*100);
  for(const s of splats){const x=Math.floor(s.x),y=Math.floor(s.y),f=1-s.t/10;
    if(s.t<3){plotA(x,y,cr,cg,cb,0.75);plotA(x,y-1,cr,cg,cb,0.45);}
    else{const d=s.t<6?1:2;for(const [dx,dy] of [[-d,-1],[d,-1],[-d-1,0],[d+1,0]])plotA(x+dx,y+dy,cr,cg,cb,0.5*f);}}
}
function drawRain(){
  if(!rainP.length)return;const a=env.amb,fl=env.flash,cr=Math.min(255,150*a[0]+70+fl*120),cg=Math.min(255,166*a[1]+72+fl*120),cb=Math.min(255,190*a[2]+78+fl*120),wx=env.windX*0.35;
  for(const p of rainP){if(p.z<=0)continue;const par=1+p.z/50,L=p.vz*2.4*par,x0=p.x+p.z*wx,y0=p.y-p.z*0.5,ex=L*wx,ey=L*0.5,n=Math.max(2,Math.ceil(Math.hypot(ex,ey))),k0=(p.big?1.3:1)*p.w;
    for(let k=0;k<=n;k++){const q=k/n;plotA(x0+ex*q,y0-ey*q,cr,cg,cb,(0.38-0.28*q)*k0);}}
}
function drawMeteor(){
  const m=meteor;if(!m||env.night<0.3)return;const p=m.t/m.life,fade=Math.sin(Math.PI*Math.min(1,p))*env.night,len=18*SC(),sp=Math.hypot(m.vx,m.vy)||1,ux=m.vx/sp,uy=m.vy/sp;
  for(let k=0;k<len;k+=0.5){const xi=(m.x-ux*k)|0,yi=(m.y-uy*k)|0;if(xi<1||yi<1||xi>=W-1||yi>=H-1)continue;const i=yi*W+xi;if(!wm[i])continue;
    const gx=w0[i+1]-w0[i-1],gy=w0[i+W]-w0[i-W],j=clamp(yi+((gy*4)|0),1,H-2)*W+clamp(xi+((gx*4)|0),1,W-2);
    if(!wm[j])continue;const e=fade*(1-k/len)*1.1;if(e>emis[j])emis[j]=e;}
}
function drawGlints(){
  if(!glints.length)return;const a=0.45*Math.min(1,env.amb[0]);
  for(const i of glints){const x=i%W,y=(i/W)|0;if(x<2||y<2||x>=W-2||y>=H-2)continue;
    blend(out,i,255,255,248,0.9);for(const o of [1,-1,W,-W])blend(out,i+o,255,252,236,a);
    if(hash2(x,y+(frame>>3))>0.6)for(const o of [2,-2,2*W,-2*W])blend(out,i+o,255,250,230,a*0.45);}
}
function drawFireflies(){
  for(const f of fireflies){if(f.g<0.08)continue;const x=Math.floor(f.x),y=Math.floor(f.y);if(x<1||y<1||x>=W-2||y>=H-5)continue;const i=y*W+x,a=f.g*0.35;
    const ry=y+4,rx=x+(Math.sin(T*6+f.ph)>0?1:0),j=ry*W+rx;if(wm[j]&&!padAt(rx,ry))blend(out,j,220,255,150,Math.min(1,f.g*0.55));
    blend(out,i,250,255,170,Math.min(1,f.g*1.2));for(const o of [1,-1,W,-W])blend(out,i+o,210,255,120,a);}
}
function drawBirds(){
  const sc=SC(),f=1-0.32*Math.max(0.25,env.shadow);
  for(const b of birds){const ca=Math.cos(b.a),sa=Math.sin(b.a),nx=-sa,ny=ca,flap=Math.sin(b.ph),span=(3.2+flap*0.8)*sc,sw=flap*1.2,id=++markId;
    for(let t=-1.5;t<=1.5;t+=0.5)darkAt(b.x+ca*t*sc,b.y+sa*t*sc,f,id);
    for(const s of [-1,1])for(let t=0;t<=span;t+=0.5){const back=-(t/span)*(1.2+sw*0.5)*sc;darkAt(b.x+nx*s*t+ca*back,b.y+ny*s*t+sa*back,f,id);}}
}
function drawPadBeads(){
  const wet=env.wet;if(wet<0.05)return;
  for(const p of pads){const r=p.r,cr=Math.cos(p.rot),sr=Math.sin(p.rot),fx=p.x+Math.cos(p.rot+p.fo)*p.r*0.28,fy=p.y+Math.sin(p.rot+p.fo)*p.r*0.28;
    for(let y=Math.floor(p.y-r);y<=p.y+r;y++)for(let x=Math.floor(p.x-r);x<=p.x+r;x++){if(x<1||y<1||x>=W-2||y>=H-1)continue;
      const dx=x+0.5-p.x,dy=y+0.5-p.y;if(dx*dx+dy*dy>(r-1)*(r-1))continue;
      if(p.flower&&Math.hypot(x+0.5-fx,y+0.5-fy)<p.r*0.7)continue;
      const lx=Math.round(dx*cr+dy*sr),ly=Math.round(-dx*sr+dy*cr);if(Math.abs(Math.atan2(ly,lx))<p.notch+0.12)continue;
      if(hash2(lx*13+(p.seed*7|0),ly*7+3)>1-0.05*wet){out[y*W+x]=pack(226,244,240);scale(out,y*W+x+1,0.75);}}}
}

/* ---------- water optics ---------- */
function composite(){
  const t=T,nt=env.night,useL=nt>0.02,rain=env.rain;
  for(let x=0;x<W;x++)wXa[x]=Math.sin(x*0.085+t*1.25)*2.4;
  for(let y=0;y<H;y++)wYa[y]=Math.sin(y*0.1-t*1.05)*2.4;
  const o1x=t*3.4,o1y=t*1.9,o2x=-t*2.6+17,o2y=t*3.1+31,caus=env.caus*0.14,spec=env.spec,sky=env.sky;
  const spR=lerp(lerp(255,sky[0],0.3),200,nt),spG=lerp(lerp(255,sky[1],0.3),214,nt),spB=lerp(lerp(255,sky[2],0.3),238,nt);
  const rfR=sky[0]*0.06,rfG=sky[1]*0.06,rfB=sky[2]*0.06;
  const mX=moon.x,mY=moon.y,mR=moonR,MD=mR*2+1,mR2=(mR+0.5)*(mR+0.5),mH2=(mR*3.2)*(mR*3.2),moonK=nt>0.05?nt*0.95*(1-rain*0.85):0,glL=S*0.45,mw=0.5+env.wind*0.8;
  const starK=nt>0.3?(nt-0.3)/0.7*(1-rain):0,wv=w0;
  const reflK=0.3*(1-nt*0.5)*(1-rain*0.5),rOX=Math.round(S*0.02),rOY=Math.round(S*0.07);
  const glit=nt<0.5&&rain<0.6,gTh=0.93-0.05*env.sun,gT=(t*7)|0,gT2=(t*6)|0;
  const cloudR=(1-nt)*(1-rain*0.7)*0.2,cRx=(t*1.6)|0,cRy=(t*0.5)|0,skR=lerp(sky[0],255,0.65),skG=lerp(sky[1],255,0.65),skB=lerp(sky[2],255,0.65);
  const gk=Math.min(1,Math.max(0,env.wind-0.55)*1.6),gx0=gOx,gy0=gOy,wnd=Math.min(1,env.wind);
  glints.length=0;
  for(let x=0;x<W;x++){out[x]=under[x];out[(H-1)*W+x]=under[(H-1)*W+x];}
  for(let y=0;y<H;y++){out[y*W]=under[y*W];out[y*W+W-1]=under[y*W+W-1];}
  for(let y=1;y<H-1;y++){let i=y*W+1;const by4=(y&3)<<2,rw=Math.sin(y*0.8+t*2.2)*mw,dyv=y-mY;
    for(let x=1;x<W-1;x++,i++){
      if(!wm[i]){out[i]=under[i];continue;}
      const bd=BAY[by4|(x&3)],gx=wv[i+1]-wv[i-1],gy=wv[i+W]-wv[i-W];
      let sx=x+((gx*3.2)|0),sy=y+((gy*3.2)|0);
      if(sx<0)sx=0;else if(sx>=W)sx=W-1;if(sy<0)sy=0;else if(sy>=H)sy=H-1;
      let si=sy*W+sx;if(!wm[si])si=i;
      const c=under[si];let r=c&255,g=c>>8&255,b=c>>16&255;const d=uD[si];
      if(caus>0){const cx=sx*0.9,cy=sy*0.9;
        const c1=CT[((((cy+wXa[sx]+o1y)|0)&63)<<6)|(((cx+wYa[sy]+o1x)|0)&63)];
        const c2=CT[((((cy-wXa[sx]*0.7+o2y)|0)&63)<<6)|(((cx*1.13+wYa[sy]+o2x)|0)&63)];
        const q=c1+c2,lv=q>1.15?2:q>0.6?1:0;
        if(lv){const k=1+lv*caus*(1-d)*(1.2-d);r*=k;g*=k;b*=k*0.97;}}
      const tc=wtint[i],k=0.12+d*0.8;r+=((tc&255)-r)*k;g+=((tc>>8&255)-g)*k;b+=((tc>>16&255)-b)*k;
      const ws=wshade[i];r=r*ws+rfR;g=g*ws+rfG;b=b*ws+rfB;
      if(reflK>0){const rx=x+((gx*5)|0)-rOX,ry=y+((gy*5)|0)-rOY;if(rx>=0&&ry>=0&&rx<W&&ry<H){const j=ry*W+rx,cc=canB[j]||canA[j];
        if(cc){r+=((cc&255)*0.5-r)*reflK;g+=((cc>>8&255)*0.5-g)*reflK;b+=((cc>>16&255)*0.55-b)*reflK;}}}
      if(cloudR>0){const cv=MT[((((y*0.5)|0)+cRy)&127)*128+((((x*0.5)|0)+cRx)&127)];
        if(cv>0.5){const a=Math.floor((cv-0.5)*6+bd)/3*cloudR;if(a>0){r+=(skR-r)*a;g+=(skG-g)*a;b+=(skB-b)*a;}}}
      if(gk>0){const gu=MT[(((y>>1)-gy0)&127)*128+(((x>>1)-gx0)&127)];
        if(gu>0.62){const q=Math.min(1,(gu-0.62)*3)*gk;r*=1-0.1*q;g*=1-0.08*q;b*=1-0.05*q;
          if(q>0.25&&hash2(x*5+(frame>>2)*31,y*3)>0.9){r+=20*q;g+=24*q;b+=26*q;}}}
      const sp=(-gx-gy)*spec;
      if(sp>0.55){const a=sp>1.1?0.55:0.25;r+=(spR-r)*a;g+=(spG-g)*a;b+=(spB-b)*a;}
      else if(sp<-0.6){r*=0.86;g*=0.86;b*=0.88;}
      if(glit&&sp>0.3){const hv=hash2(x*3+gT,y*7-gT);if(hv>gTh){r=spR+30;g=spG+30;b=spB+30;if(hv>0.992&&glints.length<220)glints.push(i);}}
      if(useL){const lr=LR[i];if(lr>0.05&&sp>0.18){const q=sp>1.4?1.4:sp;r+=lr*q*240;g+=LG[i]*q*190;b+=LB[i]*q*120;}}
      if(distIn[i]<1.6&&Math.sin(t*2.2+(x+y)*0.3+Math.sin(x*0.1)*2)>0.2){r+=22;g+=26;b+=24;}
      if(moonK>0){
        const mx=x+gx*6+rw-mX,my=(y+gy*6-mY)*0.92,md2=mx*mx+my*my;
        if(md2<mR2){const mu=Math.round(mx),mv=Math.round(my);if(mu>=-mR&&mu<=mR&&mv>=-mR&&mv<=mR){const mb=moonTex[(mv+mR)*MD+mu+mR];if(mb>0)emis[i]=moonK*(0.2+mb*0.9);}}
        else if(md2<mH2){const q=1-(Math.sqrt(md2)-mR)/(mR*2.2);if(q>0){const a=q*q*0.3;if(bd<a*2.6)emis[i]=moonK*(0.1+a);}}
        if(dyv>mR*0.5&&dyv<glL){const hw=mR*(0.8+dyv*0.03),dxv=x-mX+rw*1.6;
          if(dxv>-hw&&dxv<hw){const fall=1-dyv/glL,edge=1-Math.abs(dxv)/hw,gq=(-gx-gy)*2.2+(hash2((x+gT2)*7,y*3+gT2)-0.5)*0.9*wnd;
            if(gq>0.7-0.35*edge){const e=moonK*(0.22+0.45*edge)*fall;if(e>emis[i])emis[i]=e;}}}
        if(sp>0.7){const e=moonK*0.16*(sp>1.2?1.6:1);if(e>emis[i])emis[i]=e;}}
      if(starK>0){const hv=hash2(((x+gx*4)|0)*7+3,((y+gy*4)|0)*13+1);
        if(hv>0.9965){const e=starK*(0.35+0.25*(1+Math.sin(t*(2+hv*40)+hv*1000)));if(e>emis[i])emis[i]=e;}}
      const pv=packC(r,g,b);out[i]=pv;cbuf[i]=pv;}}
}
function finalPass(){
  const sw=env.wind,aX=Math.round(Math.sin(T*0.7)*1.2*sw),aY=Math.round(Math.cos(T*0.53)*0.8*sw);
  const bX=Math.round(Math.sin(T*0.93+1.3)*1.8*sw),bY=Math.round(Math.cos(T*0.61+2)*1.2*sw);
  const shX=aX+Math.round(env.shShift),shY=aY+Math.round(env.shShift*0.8),shK=0.42*env.shadow;
  const ar=env.amb[0],ag=env.amb[1],ab=env.amb[2],useL=env.night>0.02;
  const mist=env.mist,m1x=(T*2.4)|0,m1y=(T*0.8)|0,m2x=(T*1.2)|0,m2y=(-T*0.6)|0;
  const sky=env.sky,mcR=lerp(sky[0],236,0.5),mcG=lerp(sky[1],238,0.5),mcB=lerp(sky[2],242,0.5);
  const gLo=env.gLo,gHi=env.gHi,gK=env.gK,fl=env.flash,kX=aX*3,kY=aY*3;
  const cK=env.cloud,cOx=(T*1.6)|0,cOy=(T*0.5)|0,wet=env.wet,pR=lerp(sky[0],96,0.45),pG=lerp(sky[1],116,0.45),pB=lerp(sky[2],128,0.45);
  let fade=T<2.6?T/2.6:1;fade=fade*fade*(3-2*fade);
  for(let y=0;y<H;y++){
    let syy=y-shY;syy=(syy<0?0:syy>=H?H-1:syy)*W;
    const ay=y-aY,by=y-bY,ayOK=ay>=0&&ay<H,byOK=by>=0&&by<H,by2=by-2,by2OK=by2>=0&&by2<H,cyy=((((y*0.35)|0)-cOy)&127)*128;let i=y*W;
    for(let x=0;x<W;x++,i++){
      const c=out[i];let r=c&255,g=c>>8&255,b=c>>16&255;const bd=BAY[((y&3)<<2)|(x&3)];
      let cc=0;const bx=x-bX;if(byOK&&bx>=0&&bx<W)cc=canB[by*W+bx];
      if(cc){r=cc&255;g=cc>>8&255;b=cc>>16&255;}
      else{const ax=x-aX;if(ayOK&&ax>=0&&ax<W){cc=canA[ay*W+ax];if(cc){r=cc&255;g=cc>>8&255;b=cc>>16&255;const bx2=bx-2;
        if(by2OK&&bx2>=0&&bx2<W&&canB[by2*W+bx2]){r*=0.74;g*=0.74;b*=0.8;}}}}
      if(cK>0.01){const cd=MT[cyy+((((x*0.35)|0)-cOx)&127)];if(cd>0.52){const q=Math.floor(Math.min(1,(cd-0.52)*3.2)*3+bd)/3;if(q>0){const f=1-cK*q;r*=f;g*=f;b*=f;}}}
      if(!cc){
        if(shK>0.01){let sx=x-shX;sx=sx<0?0:sx>=W?W-1:sx;const s=shadowMap[syy+sx];
          if(s>0.03){let q=Math.floor(s*2.2+bd)*0.5;if(q>1)q=1;if(q>0){if(s<0.92&&FL[(((y+kY)&63)<<6)|((x+kX)&63)])q*=0.3;const f=1-shK*q;r*=f;g*=f;b*=f;}}}
        if(wet>0.02&&!wm[i]){r*=1-0.2*wet;g*=1-0.15*wet;b*=1-0.06*wet;const pu=puddle[i];
          if(pu>0){const a=Math.floor(Math.min(1,pu*wet*1.5)*3+bd)/3*0.7;if(a>0){r+=(pR-r)*a;g+=(pG-g)*a;b+=(pB-b)*a;}}}
        if(mist>0.02){const m=(MT[((y+m1y)&127)*128+((x+m1x)&127)]+MT[(((y>>1)+m2y)&127)*128+(((x>>1)+m2x)&127)])*0.5;let a=(m-0.42)*3;
          if(a>0){if(a>1)a=1;a*=mist*(wm[i]?1:0.45);a=Math.floor(a*4+bd)*0.15;if(a>0){r+=(mcR-r)*a;g+=(mcG-g)*a;b+=(mcB-b)*a;}}}}
      const v=vig[i];let lr=ar,lg=ag,lb=ab;if(useL){lr+=LR[i];lg+=LG[i];lb+=LB[i];}
      r*=lr*v;g*=lg*v;b*=lb*v;
      if(useL&&!cc){const e=emis[i];if(e>0&&c===cbuf[i]){r+=e*210;g+=e*220;b+=e*235;}}
      if(gK>0){let L=(r*0.299+g*0.587+b*0.114)/255;if(L>1)L=1;const lo=(1-L)*(1-L)*gK,hi=L*L*gK*0.6;
        r+=(gLo[0]-r)*lo+(gHi[0]-r)*hi;g+=(gLo[1]-g)*lo+(gHi[1]-g)*hi;b+=(gLo[2]-b)*lo+(gHi[2]-b)*hi;}
      if(fl>0.01){r+=fl*150;g+=fl*160;b+=fl*190;}
      if(fade<1){r*=fade;g*=fade;b*=fade;}
      out[i]=packC(r,g,b);}}
}
function render(){
  buildLights();
  under.set(bed);uD.set(depth);
  drawPlants();drawMotes();drawStriderDimples();
  for(const s of sinkers)if(s.st===1)discStone(under,s.x,s.y,s.r,s.c,s.z,true);
  for(const f of fish)if(!f.leap)drawFishShadow(f);
  fish.sort((a,b)=>b.z-a.z);
  for(const f of fish)if(!f.leap)drawFish(f);
  drawBubbles();
  composite();
  drawMeteor();drawRings();
  drawPads();drawPadBeads();
  for(const fr of frogs)if(fr.st===0)drawFrog(fr);
  drawPellets();
  for(const l of leaves)if(l.st!==0)drawLeaf(l);
  drawStriders();drawReeds();drawSpout();drawDeck();drawLanternGlow();drawDrops();drawSinkersAir();
  for(const fr of frogs)if(fr.st===1)drawFrog(fr);
  for(const f of fish)if(f.leap){drawLeapShadow(f);AIR=true;drawFish(f);AIR=false;}
  for(const l of leaves)if(l.st===0)drawLeaf(l);
  for(const b of flies)if(b.vis)drawFly(b);
  drawDF();
  let gn=0;for(let k=0;k<glints.length;k++){const i=glints[k];if(out[i]===cbuf[i])glints[gn++]=i;}glints.length=gn;
  finalPass();
  drawGlints();drawFireflies();drawBirds();drawRain();drawSplats();
  if(snapReq){ctx.putImageData(img,0,0);doSnap();snapReq=false;}
  drawHover();drawCursor();
  ctx.putImageData(img,0,0);
}

/* ---------- sound extras ---------- */
Object.assign(Snd,{
  tick(pan){this.tone('sine',2600+Math.random()*2400,1700,0.016,0.016,pan);},
  crack(){if(!this.c||!this.on)return;const c=this.c,t=c.currentTime,s=c.createBufferSource();s.buffer=this.white;
    const f=c.createBiquadFilter();f.type='highpass';f.frequency.value=900;const g=c.createGain();this.env(g,t,0.004,0.42,0.4);
    s.connect(f);f.connect(g);g.connect(this.m);s.start(t,Math.random());s.stop(t+0.5);},
  setWind(w){if(!this.c||!this.white)return;const c=this.c;
    if(!this.windG){const s=c.createBufferSource();s.buffer=this.white;s.loop=true;const f=c.createBiquadFilter();f.type='bandpass';f.frequency.value=520;f.Q.value=0.7;
      const g=c.createGain();g.gain.value=0;s.connect(f);f.connect(g);g.connect(this.m);s.start();this.windG=g;this.windF=f;}
    this.windG.gain.setTargetAtTime(Math.max(0,w-0.55)*0.09,c.currentTime,0.9);this.windF.frequency.setTargetAtTime(360+w*320,c.currentTime,0.9);},
  shimmer(){this.tone('sine',3400,2300,0.7,0.012,Math.random()*1.2-0.6);this.tone('sine',4600,3100,0.5,0.006,0,0.08);}
});
/* ================= end of upgrade ================= */


/* ================= loop ================= */
build();
let last=performance.now(),idleOn=false,pondVis=true,slowTick=0,audioQuiet=false;
// Adaptive quality: the pond is a per-pixel software renderer, so slower phones get 30 fps first and, if that is
// still too heavy, one step chunkier pixels. Fast machines never notice. (QBUMP is declared up top for build().)
let pCost=0,pSkip=false,pFrames=0,pOdd=false;
const reducedMotion=window.matchMedia&&window.matchMedia('(prefers-reduced-motion: reduce)').matches;
// Use the LATEST entry: a fast scroll (or content loading above) can deliver "left" and "entered" in one batch,
// and reading es[0] left the pond paused and black on phones. A cheap rect re-check while paused is a safety net.
if('IntersectionObserver' in window){new IntersectionObserver(es=>{pondVis=es[es.length-1].isIntersecting;},{threshold:0.02}).observe(holder);}
let visChk=0;const recheckVis=()=>{const r=holder.getBoundingClientRect();pondVis=r.bottom>0&&r.top<innerHeight;};
function loop(now){
  if(pSkip&&pondVis&&!document.hidden){pOdd=!pOdd;if(pOdd){requestAnimationFrame(loop);return;}}   // 30 fps: skip without advancing `last`, so dt covers both frames
  let dt=(now-last)/16.667;last=now;if(dt>3)dt=3;if(dt<0.1)dt=0.1;
  if(!pondVis&&!document.hidden&&++visChk%20===0)recheckVis();
  if(!pondVis||document.hidden){ if(!audioQuiet){ audioQuiet=true; Snd.quiet(true); } requestAnimationFrame(loop);return;}
  if(audioQuiet){ audioQuiet=false; Snd.quiet(false); }
  slowTick++;
  if(reducedMotion&&slowTick%3!==0){requestAnimationFrame(loop);return;}
  const t0=performance.now();
  update(dt*(reducedMotion?3:1));render();
  const c=performance.now()-t0;pCost=pCost*0.9+c*0.1;
  if(++pFrames>45){
    if(!pSkip&&pCost>11){pSkip=true;pFrames=0;}
    else if(pSkip&&pCost>22&&QBUMP<2){QBUMP++;pFrames=0;pCost=0;build();}
  }
  const idle=now-lastMove>6000&&barHover<0;if(idle!==idleOn){idleOn=idle;bar.classList.toggle('idle',idle);}
  if(keyFxT>0){keyFxT-=dt;if(keyFxT<=0){keyFx=-1;drawBar();}}
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);
})();
