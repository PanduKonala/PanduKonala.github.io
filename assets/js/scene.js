
import * as THREE from './three.module.min.js';
const reduce=matchMedia('(prefers-reduced-motion:reduce)').matches;
/* light mode: one static frame, coarser mesh. Reduced motion, few cores, or a phone. */
const coarse=matchMedia('(pointer:coarse)').matches;
/* a blocklisted / software GPU: the context with the performance-caveat check fails while a plain one works */
const slowGPU=(()=>{try{const c=document.createElement('canvas');const o={failIfMajorPerformanceCaveat:true};
  return !(c.getContext('webgl2',o)||c.getContext('webgl',o));}catch(e){return true;}})();
const LITE=reduce||slowGPU||(navigator.hardwareConcurrency||8)<4||(navigator.deviceMemory||8)<4
  ||innerWidth<700||(coarse&&Math.min(innerWidth,innerHeight)<700);
const GRID=LITE?[300,480]:[400,640];

/* hero name: letter by letter, forced two lines */
const nm=document.getElementById('nm');
if(nm){const raw=nm.textContent;nm.textContent='';let k=0;
  raw.split('|').forEach((word,wi)=>{ if(wi){const b=document.createElement('span');b.className='br';nm.appendChild(b);}
    [...word].forEach(ch=>{const s=document.createElement('span');s.textContent=ch;s.style.animationDelay=(0.9+k*0.06)+'s';nm.appendChild(s);k++;});});}

/* reveals */
const io=new IntersectionObserver(es=>es.forEach(e=>{if(e.isIntersecting){e.target.classList.add('in');io.unobserve(e.target);}}),{threshold:.1});
document.querySelectorAll('.rv').forEach(el=>io.observe(el));

/* ================= Mountain at the viewer's hour: sky, sun, moon, stars, birds, lit terrain ================= */
const params=new URLSearchParams(location.search);
/* hour of day, 0-24. Order: ?t= override -> viewer's clock -> DUSK (18.3) if the clock is unusable
   (blocked Date, privacy shims returning NaN, or a broken query value). */
const DUSK_FALLBACK=18.3;
const okHour=h=>Number.isFinite(h)&&h>=0&&h<24;
let HOUR=DUSK_FALLBACK, hourSrc='fallback';
if(params.has('t')){const v=parseFloat(params.get('t'));if(okHour(v)){HOUR=v;hourSrc='param';}}
const forced=parseFloat(document.documentElement.dataset.hour);   // page can pin an hour (404 = night)
if(hourSrc==='fallback'&&okHour(forced)){HOUR=forced;hourSrc='param';}
if(hourSrc==='fallback'&&!params.has('t')){try{const now=new Date();const h=now.getHours()+now.getMinutes()/60;if(okHour(h)){HOUR=h;hourSrc='clock';}}catch(e){}}
document.querySelectorAll('#bgsw a').forEach(a=>{const v=a.dataset.t;
  a.href=(v==='now'?location.pathname:'?t='+v)+location.hash;
  a.classList.toggle('on',(v==='now'&&!params.has('t'))||params.get('t')===v);});


/* ---- sun geometry from the hour: rises left at 06:00, sets right at 18:00 ---- */
const ang=(HOUR-6)/12*Math.PI, sunEl=Math.sin(ang), sunX=-Math.cos(ang);
/* compress azimuth/elevation into the 46 degree frustum so the disc is always on screen */
const cl=(v,a,b)=>Math.max(a,Math.min(b,v));
const dirOf=(ax,el)=>{const A=cl(ax*0.42,-0.42,0.42),E=cl(el*0.30,-0.10,0.26);
  return new THREE.Vector3(Math.sin(A)*Math.cos(E),Math.sin(E),-Math.cos(A)*Math.cos(E)).normalize();};
const sunDir=dirOf(sunX,Math.max(sunEl,-0.30));
const moonDir=dirOf(-sunX*0.9,0.48);
const sm=(a,b,x)=>{const t=Math.min(1,Math.max(0,(x-a)/(b-a)));return t*t*(3-2*t);};
const C=h=>new THREE.Color(h), L=(a,b,t)=>a.clone().lerp(b,t);
const P={ night:{zen:C('#04070e'),hor:C('#0c1830'),sun:C('#a8b8d8'),ridge:C('#8595bb'),valley:C('#1c2c4e')},
          dawn :{zen:C('#1c1638'),hor:C('#c8641f'),sun:C('#ffc078'),ridge:C('#f4b264'),valley:C('#3c3358')},
          dusk :{zen:C('#160f2b'),hor:C('#b8563a'),sun:C('#ff9a5e'),ridge:C('#ef9161'),valley:C('#2e2748')},
          day  :{zen:C('#2c73b8'),hor:C('#a6cfe6'),sun:C('#ffe6a1'),ridge:C('#f6f8fb'),valley:C('#8fb6c4')}};
const LOW = HOUR>12.5 ? P.dusk : P.dawn;
let K;{ if(sunEl<0.06){const t=sm(-0.34,0.06,sunEl);K=Object.fromEntries(Object.keys(P.night).map(k=>[k,L(P.night[k],LOW[k],t)]));}
        else{const t=sm(0.06,0.52,sunEl);K=Object.fromEntries(Object.keys(P.day).map(k=>[k,L(LOW[k],P.day[k],t)]));} }
const nightF=1-sm(-0.30,0.08,sunEl), dayF=sm(-0.12,0.15,sunEl);
/* distance fog: clear at midday, a touch thicker at dawn, dusk and night (density in the shaders' exp(-d*d*k)) */
const FOGK=(0.62e-6*(1+1.1*(1-dayF))).toExponential(3);
{const vg=document.querySelector('.vig');if(vg)vg.style.setProperty('--vk',(1-sm(-0.02,0.08,sunEl)).toFixed(3));}
/* day-aware ink: the stylesheet ramps text colour from white to near-black with this */
document.documentElement.style.setProperty('--dayK',dayF.toFixed(3));
/* --highK: 0 until the sun is well clear of the horizon; used for text that sits on the bright day sky */
document.documentElement.style.setProperty('--highK',sm(0.22,0.45,sunEl).toFixed(3));

/* if WebGL is unavailable or refused, the canvas shows a flat gradient in the hour's colours instead of black */
const cssC=c=>'#'+c.getHexString();
function skyFallback(err){const cv=document.getElementById('sky');if(cv)cv.style.background=`linear-gradient(180deg,${cssC(K.zen)} 0%,${cssC(K.hor)} 58%,${cssC(K.valley)} 100%)`;
  if(err)console.warn('sky: WebGL unavailable, using gradient fallback',err);}
try{
const canvas=document.getElementById('sky');
const renderer=new THREE.WebGLRenderer({canvas,antialias:true,alpha:false,powerPreference:LITE?'low-power':'high-performance'});
/* LITE draws one frame, so it can afford a sharper buffer */
renderer.setPixelRatio(Math.min(devicePixelRatio,LITE?2:1.75));renderer.setClearColor(K.zen,1);
const scene=new THREE.Scene();
const camera=new THREE.PerspectiveCamera(46,innerWidth/innerHeight,.1,6000);
const U={uT:{value:0},uS:{value:1},uZen:{value:K.zen},uHor:{value:K.hor},uSun:{value:K.sun},uSunDir:{value:sunDir},uEl:{value:sunEl},
  uRidge:{value:K.ridge},uValley:{value:K.valley}};

function hash(x,y){let h=Math.sin(x*127.1+y*311.7)*43758.5453;return h-Math.floor(h);}
function vnoise(x,y){const xi=Math.floor(x),yi=Math.floor(y),xf=x-xi,yf=y-yi,u=xf*xf*(3-2*xf),v=yf*yf*(3-2*yf);
  const a=hash(xi,yi),b=hash(xi+1,yi),c=hash(xi,yi+1),d=hash(xi+1,yi+1);return a+(b-a)*u+(c-a)*v+(a-b-c+d)*u*v;}
function fbm(x,y,oct=6){let s=0,a=.5,f=1;for(let i=0;i<oct;i++){s+=a*vnoise(x*f,y*f);f*=2.03;a*=.5;}return s;}
const FOG=`float fogOf(float d,float k){return exp(-d*d*k);}`;
const LAMPF=`
  uniform vec3 uCamF;
  float lamp(vec3 W,vec3 n,float dayK){vec3 d=W-cameraPosition;float dist=length(d);d/=max(dist,1.0);
    float cone=smoothstep(0.30,0.85,dot(d,uCamF));
    /* soft torch: flat and dim up close (no blow-out as trees pass the camera), fading out by ~900 units */
    float fall=smoothstep(0.0,260.0,dist)*(1.0-smoothstep(380.0,950.0,dist))*0.55;
    float lam=max(dot(n,-d),0.0)*0.55+0.45;return cone*fall*lam*(1.0-dayK);}`;
const DISC=`vec2 q=gl_PointCoord-0.5; float m=1.0-smoothstep(0.0,0.5,length(q));`;

/* ---- sky dome: gradient + sun glow + procedural stars + clouds (stars sit UNDER the clouds) ---- */
U.uScroll={value:0};U.uNight={value:nightF};U.uCamM={value:new THREE.Matrix3()};U.uCamF={value:new THREE.Vector3(0,0,-1)};
const GNOISE=`
  float h21(vec2 p){p=fract(p*vec2(123.34,456.21));p+=dot(p,p+45.32);return fract(p.x*p.y);}
  float h31(vec3 p){p=fract(p*vec3(123.34,456.21,789.13));p+=dot(p,p.yzx+45.32);return fract(p.x*p.y*p.z);}
  float vn2(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.0-2.0*f);
    float a=h21(i),b=h21(i+vec2(1.0,0.0)),c=h21(i+vec2(0.0,1.0)),d=h21(i+vec2(1.0,1.0));
    return mix(mix(a,b,f.x),mix(c,d,f.x),f.y);}
  float fbm2(vec2 p){float s=0.0,a=0.5;for(int i=0;i<5;i++){s+=a*vn2(p);p*=2.04;a*=0.5;}return s;}
  float fbm6(vec2 p){float s=0.0,a=0.5;for(int i=0;i<6;i++){s+=a*vn2(p);p*=2.03;a*=0.5;}return s;}`;
const sky=new THREE.Mesh(new THREE.SphereGeometry(4000,64,32),new THREE.ShaderMaterial({uniforms:U,side:THREE.BackSide,depthWrite:false,
  vertexShader:`varying vec3 vD;void main(){vD=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}`,
  fragmentShader:`uniform vec3 uZen,uHor,uSun,uSunDir;uniform float uEl,uT,uNight;varying vec3 vD;${GNOISE}
    /* random stars: voxel hash on the direction vector, varied size + brightness, slow twinkle */
    float stars(vec3 d){float acc=0.0;
      for(int k=0;k<2;k++){float sc=k==0?260.0:140.0;vec3 p=d*sc;vec3 c=floor(p);
        float r=h31(c);if(r<(k==0?0.92:0.965))continue;
        vec3 o=vec3(h31(c+1.7),h31(c+9.1),h31(c+3.3));
        float dist=length(p-(c+o));float sz=0.10+0.22*h31(c+5.5)*(k==0?1.0:1.8);
        float tw=0.75+0.25*sin(uT*(1.0+2.0*h31(c+7.7))+r*40.0);
        acc+=smoothstep(sz,0.0,dist)*tw*(0.55+0.45*h31(c+2.2));}
      return acc;}
    void main(){vec3 d=normalize(vD);float y=d.y;float up=clamp(y,0.0,1.0);
      vec2 hd=normalize(vec2(d.x,d.z)), hs=normalize(vec2(uSunDir.x,uSunDir.z));
      float azw=pow(clamp(dot(hd,hs)*0.5+0.5,0.0,1.0),2.2);
      vec3 hor=mix(uZen*1.02,uHor,0.10+0.90*azw);
      vec3 c=mix(hor,uZen,pow(up,0.62));
      c=mix(c,uZen*0.30,smoothstep(0.0,-0.22,y));
      float s=max(dot(d,uSunDir),0.0);
      float nearH=1.0-smoothstep(-0.10,0.55,uEl);
      float vis=smoothstep(-0.26,0.04,uEl);
      float hi=smoothstep(0.35,0.9,uEl);
      c+=uSun*(pow(s,260.0)*1.2+pow(s,18.0)*(0.14+0.42*nearH)+pow(s,4.0)*0.22*hi)*vis;
      /* stars, fading toward the horizon haze and with daylight */
      c+=vec3(0.86,0.90,1.0)*stars(d)*uNight*smoothstep(0.0,0.18,y)*1.15;
      /* aurora: night only. The frustum only spans ~50 degrees, so the curtain noise runs at a high
         azimuth frequency or it reads as a flat wash. Bright lower edge, fading upward, green -> violet. */
      float aur=uNight*smoothstep(0.035,0.09,y)*exp(-max(y-0.09,0.0)*5.5);
      if(aur>0.001){
        float az=atan(d.x,-d.z);
        float band=fbm2(vec2(az*6.0+uT*0.03,y*2.6-uT*0.012));
        float band2=fbm2(vec2(az*11.0-uT*0.02+5.0,y*3.2));
        float ray=vn2(vec2(az*60.0+uT*0.10,y*1.2))*0.6+vn2(vec2(az*130.0-uT*0.06,0.0))*0.4;
        float curt=smoothstep(0.34,0.78,band)*(0.62+0.38*ray)+smoothstep(0.52,0.88,band2)*0.45*(0.5+0.5*ray);
        vec3 ac=mix(vec3(0.22,1.00,0.62),vec3(0.66,0.42,1.00),smoothstep(0.09,0.26,y));
        c+=ac*curt*aur*1.6;}
      /* clouds drawn LAST so they cover the stars; night keeps thinner cover */
      vec2 uv=d.xz/max(y,0.055);
      float f=fbm2(uv*0.34+vec2(uT*0.0055,uT*0.0018));
      f=mix(f,fbm2(uv*0.85+vec2(uT*0.011,0.0)),0.35);
      float cover=mix(0.50,0.58,uNight);
      float cl=smoothstep(cover,cover+0.30,f)*smoothstep(0.015,0.30,y)*(1.0-smoothstep(0.75,1.0,up));
      vec3 lit=mix(uZen*1.35+vec3(0.015),mix(uSun,vec3(0.97,0.98,1.0),0.6*smoothstep(0.35,0.9,uEl)),(0.20+0.62*pow(s,3.0))*vis+0.35*smoothstep(0.35,0.9,uEl));
      lit=mix(lit,vec3(0.16,0.19,0.27),uNight*0.55);        // moonlit grey at night
      c=mix(c,lit,cl*0.78);
      gl_FragColor=vec4(c,1.0);}`}));
scene.add(sky);

/* ---- sun disc (depth-tested, so ridges hide it) + FULL moon with a wide halo ---- */
const sunGrp=new THREE.Group();scene.add(sunGrp);
const hiSun=sm(0.35,0.9,sunEl);
const sunDisc=L(K.sun,C('#fff3c4'),0.55*hiSun);
sunGrp.add(new THREE.Mesh(new THREE.CircleGeometry(56,48),new THREE.MeshBasicMaterial({color:sunDisc,transparent:true,opacity:1,depthWrite:false})));
sunGrp.add(new THREE.Mesh(new THREE.CircleGeometry(150,48),new THREE.ShaderMaterial({uniforms:U,transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,
  vertexShader:`varying vec2 vU;void main(){vU=uv*2.0-1.0;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}`,
  fragmentShader:`uniform vec3 uSun;uniform float uEl;varying vec2 vU;void main(){float r=length(vU);float hi=smoothstep(0.35,0.9,uEl);gl_FragColor=vec4(uSun,pow(max(0.0,1.0-r),2.2)*(0.55+0.15*hi));}`})));
sunGrp.visible=sunEl>-0.12;
const moon=new THREE.Mesh(new THREE.CircleGeometry(66,64),new THREE.ShaderMaterial({transparent:true,depthWrite:false,uniforms:{uA:{value:nightF}},
  vertexShader:`varying vec2 vU;void main(){vU=uv*2.0-1.0;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}`,
  fragmentShader:`uniform float uA;varying vec2 vU;${GNOISE}
    void main(){float r=length(vU);if(r>1.0)discard;
      float mare=fbm2(vU*2.6+3.0);                         // faint seas on the face
      vec3 col=mix(vec3(0.80,0.84,0.92),vec3(0.96,0.97,1.0),smoothstep(0.35,0.7,mare));
      float edge=1.0-smoothstep(0.90,1.0,r);
      gl_FragColor=vec4(col,edge*uA);}`}));
const halo=new THREE.Mesh(new THREE.CircleGeometry(430,64),new THREE.ShaderMaterial({transparent:true,depthWrite:false,
  blending:THREE.AdditiveBlending,uniforms:{uA:{value:nightF}},
  vertexShader:`varying vec2 vU;void main(){vU=uv*2.0-1.0;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}`,
  fragmentShader:`uniform float uA;varying vec2 vU;void main(){float r=length(vU);
    float g=pow(max(0.0,1.0-r),2.2)*0.34+pow(max(0.0,1.0-r*3.2),1.5)*0.55;
    gl_FragColor=vec4(vec3(0.70,0.78,0.95),g*uA);}`}));
scene.add(moon);scene.add(halo);moon.visible=halo.visible=nightF>0.02;

/* ---- terrain: heights from fBm of WORLD coordinates in the vertex shader -> endless forward travel.
        Solid, lit surface: normal from finite differences of the height field, sun/moon key light,
        sky ambient, hemisphere fill in the valley, distance fog. ---- */
/* height field shared by terrain and water: valley + meandering river channel (water level y=0) */
const HFN=`
  float riverC(float z){return sin(z*0.0019)*85.0+sin(z*0.0047+1.3)*30.0;}
  /* ridged multifractal: 1-|n| folds the noise into sharp crests; each octave is gated by the last so detail
     piles up on the ridges and the basins stay smooth, which is what eroded rock actually does */
  float ridged(vec2 p){float s=0.0,a=0.5,w=1.0;for(int i=0;i<5;i++){float n=1.0-abs(2.0*vn2(p)-1.0);n=n*n*w;w=clamp(n*1.8,0.0,1.0);s+=n*a;p=p*2.07+vec2(1.7,9.2);a*=0.5;}return s;}
  float height(vec2 q){float rc=riverC(q.y);
    float base=fbm6(q*0.0028+vec2(3.1,7.7));                       // broad massing (valley layout unchanged)
    float h=pow(base,1.9)*300.0;
    float rg=ridged(q*0.0055+vec2(5.0,1.0));                       // crests and spurs, only where there is already a mountain
    h+=(rg-0.30)*150.0*smoothstep(50.0,190.0,h);
    h+=(fbm2(q*0.017+vec2(9.0,2.0))-0.5)*30.0*smoothstep(40.0,160.0,h);   // gully / spur relief on the flanks
    h+=fbm2(q*0.045)*9.0;
    h*=1.0-0.85*exp(-pow((q.x-rc*0.7)/150.0,2.0));            // valley follows the river loosely
    float dx=abs(q.x-rc)+(fbm2(q*0.02)-0.5)*16.0;               // ragged banks
    h=mix(h,-7.0-fbm2(q*0.08)*2.0,smoothstep(60.0,20.0,dx));    // river bed below water level
    return h;}`;
const grp=new THREE.Group();scene.add(grp);
const TW=2000,TD=3200;
{const geo=new THREE.PlaneGeometry(TW,TD,GRID[0],GRID[1]);geo.rotateX(-Math.PI/2);
 const HVS=`uniform float uS,uScroll,uEl;uniform vec3 uSunDir;varying float vH,vF,vSh;varying vec3 vN,vW;varying vec2 vQ;${FOG}${GNOISE}${HFN}
   /* terrain self-shadow: march toward the key light and see if the ground gets in the way. Six samples on
      a widening stride; soft by comparing clearance to distance. Skipped at night (moonlight stays flat). */
   float shade(vec2 q,float h){vec3 L=normalize(vec3(uSunDir.x,max(uSunDir.y,0.06),uSunDir.z));
     if(uEl<-0.15)return 1.0;float s=1.0;
     for(int i=1;i<=${LITE?4:6};i++){float t=float(i*i)*9.0;vec2 p=q+L.xz*t;float hh=height(p);
       s=min(s,clamp((h+L.y*t-hh)/(t*0.22)+0.6,0.0,1.0));}
     return mix(1.0,s,smoothstep(-0.15,0.05,uEl));}
   void main(){vec2 q=vec2(position.x,position.z+uScroll);float h=height(q);
     float e=3.0;float hx=height(q+vec2(e,0.0)),hz=height(q+vec2(0.0,e));
     vN=normalize(vec3(h-hx,e,h-hz));vQ=q;vSh=shade(q,h);
     vec3 P=vec3(position.x,h,position.z);vH=h;vW=(modelMatrix*vec4(P,1.0)).xyz;
     vec4 mv=modelViewMatrix*vec4(P,1.0);float d=-mv.z;vF=fogOf(d,${FOGK});gl_Position=projectionMatrix*mv;}`;
 grp.add(new THREE.Mesh(geo,new THREE.ShaderMaterial({uniforms:U,vertexShader:HVS,
   fragmentShader:`uniform vec3 uZen,uHor,uValley,uRidge,uSun,uSunDir;uniform float uEl,uNight;varying float vH,vF,vSh;varying vec3 vN,vW;varying vec2 vQ;${GNOISE}${LAMPF}
     void main(){vec3 n=normalize(vN);
       float dayK=smoothstep(-0.20,0.05,uEl);
       float lod=1.0-smoothstep(400.0,1600.0,length(cameraPosition-vW));       // detail fades with distance
       /* surface detail: a rock-scale noise gradient bumps the normal (more on steep faces), and its value
          doubles as cavity occlusion. Stratified rock gets bands that follow height, tilted by the noise. */
       vec2 dq=vQ*0.19;float e=0.25;
       float d0=fbm2(dq),d1=fbm2(dq+vec2(e,0.0)),d2=fbm2(dq+vec2(0.0,e));
       float slope0=1.0-n.y;
       vec2 gdet=vec2(d0-d1,d0-d2)/e;
       n=normalize(n+vec3(gdet.x,0.0,gdet.y)*(0.05+0.30*slope0)*lod);
       float slope=1.0-n.y;
       float cav=0.72+0.28*smoothstep(0.25,0.75,d0);
       /* key light: the sun by day, the moon (opposite side, cool) by night */
       vec3 L=normalize(vec3(uSunDir.x,max(uSunDir.y,0.12),uSunDir.z));
       vec3 Lm=normalize(vec3(-uSunDir.x*0.9,0.45,-0.6));
       float diff=max(dot(n,L),0.0)*vSh*dayK+max(dot(n,Lm),0.0)*(1.0-dayK)*1.05;
       vec3 keyC=mix(vec3(0.72,0.80,1.05),uSun,dayK);
       /* ambient: sky from above, valley colour from below (hemisphere) */
       float up=n.y*0.5+0.5;
       vec3 amb=mix(uValley*1.4,mix(uHor,uZen,0.5)*1.3,up);
       amb=mix(amb,vec3(dot(amb,vec3(0.299,0.587,0.114)))*1.04,dayK*0.80);
       /* materials by slope and altitude: tussock on gentle low ground, bare rock on anything steep,
          scree at the foot of cliffs, snow above a noisy snowline where it can lie */
       float strata=0.5+0.5*sin(vH*0.42+fbm2(vQ*0.012)*9.0+d0*2.0);
       vec3 rock=mix(vec3(0.27,0.25,0.24),vec3(0.46,0.43,0.40),strata*0.7+d0*0.3);
       rock=mix(rock,vec3(0.34,0.36,0.40),smoothstep(0.55,0.85,slope)*0.5);         // colder, bluer cliff faces
       vec3 tuss=mix(vec3(0.30,0.34,0.42),mix(vec3(0.33,0.39,0.26),vec3(0.46,0.47,0.30),smoothstep(0.35,0.7,d0)),dayK*0.9);
       vec3 scree=vec3(0.42,0.41,0.39);
       vec3 snow=vec3(0.90,0.92,0.95);
       float rk=smoothstep(0.28,0.50,slope+(d0-0.5)*0.12);
       float sc=smoothstep(0.18,0.32,slope)*(1.0-rk)*smoothstep(60.0,140.0,vH);
       vec3 alb=mix(tuss,rock,rk);alb=mix(alb,scree,sc*0.6);
       float snowL=150.0+(fbm2(vQ*0.006)-0.5)*70.0;
       float sn=smoothstep(snowL-30.0,snowL+40.0,vH+(fbm2(vQ*0.05)-0.5)*40.0)*(1.0-smoothstep(0.30,0.62,slope));
       alb=mix(alb,snow,sn);
       /* by night everything cools toward blue rock */
       alb=mix(alb*vec3(0.75,0.82,1.0),alb,dayK);
       float ex=mix(1.35,1.72,dayK);
       vec3 col=alb*cav*(amb*(0.55+0.30*dayK)+keyC*diff*(0.95+1.15*dayK))*ex;
       col+=uRidge*(0.12+0.16*dayK)*sn*diff;                       // warm rim on lit snow
       col+=uSun*pow(max(dot(normalize(L+normalize(cameraPosition-vW)),n),0.0),24.0)*sn*0.25*dayK*vSh;  // snow sheen
       col+=uValley*0.35*(1.0-smoothstep(0.0,110.0,vH));          // glow in the valley floor
       col+=vec3(0.07,0.13,0.12)*uNight*up*(0.45+0.55*sn);       // aurora/sky glow on upward faces at night
       col+=alb*vec3(1.0,0.90,0.76)*lamp(vW,n,dayK)*0.8;          // camera head-light
       vec3 fogc=mix(uHor,uZen,mix(0.35,0.18,dayK))*mix(1.0,1.22,dayK);          // aerial perspective by day
       gl_FragColor=vec4(mix(fogc,col,vF),1.0);}`})));}

/* ---- the river: a flat sheet at y=0 riding in the terrain group. Depth-tested against the carved
        channel, so only the bed shows water. Flowing fBm normals, Fresnel sky reflection, sun/moon
        glint, aurora spill at night, soft shoreline + foam. ---- */
{const wg=new THREE.PlaneGeometry(TW,TD,1,1);wg.rotateX(-Math.PI/2);
 grp.add(new THREE.Mesh(wg,new THREE.ShaderMaterial({uniforms:U,transparent:true,depthWrite:false,
  vertexShader:`uniform float uScroll;varying vec2 vQ;varying vec3 vW;
    void main(){vQ=vec2(position.x,position.z+uScroll);vec4 w=modelMatrix*vec4(position,1.0);vW=w.xyz;gl_Position=projectionMatrix*viewMatrix*w;}`,
  fragmentShader:`uniform vec3 uZen,uHor,uSun,uSunDir,uValley;uniform float uT,uEl,uNight;varying vec2 vQ;varying vec3 vW;${FOG}${GNOISE}${HFN}
    float fbm3(vec2 p){float s=0.0,a=0.5;for(int i=0;i<3;i++){s+=a*vn2(p);p*=2.1;a*=0.5;}return s;}
    void main(){
      float dx=vQ.x-riverC(vQ.y);if(abs(dx)>80.0)discard;
      float depth=-height(vQ);if(depth<0.0)discard;             // water surface is y=0
      float dayK=smoothstep(-0.20,0.05,uEl);
      vec3 V=normalize(cameraPosition-vW);float camD=length(cameraPosition-vW);
      /* flow field: fastest mid-channel, dragging at the banks. Noise is stretched along the flow so the
         surface reads as a current, not a pond; a second, finer layer runs at ~2x for shear texture. */
      float bw=1.0-clamp(abs(dx)/62.0,0.0,1.0);
      /* the ripples are STILL in noise space (the camera's travel already reads as motion; advecting the
         noise along a meandering axis produced converging chevrons). Isotropic scales, so no streak direction. */
      vec2 wq=vec2(vQ.x,vQ.y);
      vec2 p1=wq*0.055;
      vec2 p2=wq*0.14+vec2(3.0,7.0);
      float e=0.05;
      float hA=fbm3(p1),hAx=fbm3(p1+vec2(e,0.0)),hAy=fbm3(p1+vec2(0.0,e));
      float hB=fbm3(p2),hBx=fbm3(p2+vec2(e,0.0)),hBy=fbm3(p2+vec2(0.0,e));
      vec2 g=(vec2(hAx-hA,hAy-hA)*1.0+vec2(hBx-hB,hBy-hB)*0.55)/e;
      /* bank chop: short, fast, isotropic ripples where the current tears along the shore */
      float chop=(1.0-bw)*smoothstep(0.0,4.0,depth);
      vec2 p3=wq*0.45;
      float hC=vn2(p3),hCx=vn2(p3+vec2(e,0.0)),hCy=vn2(p3+vec2(0.0,e));
      g+=vec2(hCx-hC,hCy-hC)/e*0.45*chop;
      /* far away the ripples must flatten or they alias into noise */
      float lod=1.0-smoothstep(300.0,1500.0,camD);
      vec3 n=normalize(vec3(-g.x*0.075*lod,1.0,-g.y*0.075*lod));
      /* what the surface reflects: sky mid-river, the dark valley walls toward the banks, the boundary
         wobbling with the waves. That mirrored shore is the biggest single cue that this is water. */
      float fres=0.04+0.96*pow(1.0-max(dot(n,V),0.0),4.5);
      vec3 skyRef=mix(uHor,uZen,0.45)*mix(0.55,1.0,dayK);
      vec3 wallRef=mix(uValley*1.15,vec3(0.26,0.31,0.24),dayK*0.85);
      float toSky=smoothstep(0.10,0.80,bw+n.x*sign(dx)*2.5+n.z*0.6);
      vec3 refl=mix(wallRef,skyRef,toSky);
      /* the water body: shallow teal showing the bed, dark blue in the channel, seen through the waves */
      float dk=1.0-exp(-depth*0.30);
      vec3 shallow=mix(vec3(0.07,0.17,0.17),vec3(0.20,0.46,0.42),dayK);
      vec3 deepC=mix(vec3(0.02,0.045,0.09),vec3(0.05,0.15,0.25),dayK);
      vec3 body=mix(shallow,deepC,dk);
      vec2 rq=vec2(dx,vQ.y)*0.22+g*0.9;                                            // refracted bed lookup
      float bed=fbm2(rq)*0.7+vn2(rq*3.1)*0.3;
      body+=vec3(0.34,0.30,0.22)*(0.35+0.65*smoothstep(0.45,0.75,bed))*(1.0-dk)*0.55*mix(0.25,1.0,dayK);
      float caus=smoothstep(0.55,0.85,fbm3(wq*0.12+g*0.3+vec2(0.0,uT*0.15)));
      body+=vec3(0.30,0.36,0.34)*caus*(1.0-dk)*0.35*dayK;                            // light dancing on the bed
      vec3 col=mix(body,refl,fres);
      /* sun / moon: a tight highlight plus a broad glitter of sparkles riding the small waves */
      vec3 L=normalize(vec3(uSunDir.x,max(uSunDir.y,0.08),uSunDir.z));
      vec3 Lm=normalize(vec3(-uSunDir.x*0.9,0.45,-0.6));
      vec3 H=normalize(L+V),Hm=normalize(Lm+V);
      float spark=smoothstep(0.55,0.85,vn2(wq*0.7+vec2(uT*0.9,uT*0.6)))*lod;          // glints twinkle, no drift
      float spec=(pow(max(dot(n,H),0.0),180.0)*0.5+pow(max(dot(n,H),0.0),700.0)*1.6*spark)*dayK
                +(pow(max(dot(n,Hm),0.0),60.0)*1.2+pow(max(dot(n,Hm),0.0),400.0)*1.5*spark)*(1.0-dayK);
      col+=mix(vec3(0.75,0.82,1.0),uSun,dayK)*spec;
      col+=vec3(0.10,0.26,0.20)*uNight*(0.45+0.55*hA)*(0.25+0.75*fres);     // aurora on the water
      col+=vec3(0.12,0.16,0.28)*uNight*(0.30+0.70*fres);                   // moonlit sheen so the river reads at night
      /* foam: streaks torn along the current on wave crests, and a churned lace along the banks */
      float crest=smoothstep(0.60,0.78,hA*0.62+hB*0.38);
      float streak=smoothstep(0.55,0.80,fbm2(wq*0.09+7.0));
      float foam=crest*streak*(0.25+0.75*bw)*0.55;
      foam+=smoothstep(0.7,0.0,abs(depth-1.4))*smoothstep(0.48,0.78,fbm2(wq*0.16));
      foam+=chop*smoothstep(0.62,0.85,hC)*0.6;
      foam*=lod*0.85;
      col=mix(col,vec3(0.88,0.92,0.96)*mix(0.35,1.0,dayK)+vec3(0.15,0.18,0.26)*uNight,clamp(foam,0.0,1.0));
      /* shoreline: shallow water thins to nothing over the last couple of units */
      float a=smoothstep(0.0,2.2,depth);
      float f=fogOf(camD,${FOGK});
      vec3 fogc=mix(uHor,uZen,mix(0.35,0.18,dayK))*mix(1.0,1.22,dayK);
      gl_FragColor=vec4(mix(fogc,col,f),a*0.97);}`})));}

/* ---- river mist: a thin drifting sheet just above the water, only over the channel. Thicker in the cool
        hours, nearly gone at midday. Additive so it lifts the water rather than greying it. ---- */
{const mg=new THREE.PlaneGeometry(TW,TD,1,1);mg.rotateX(-Math.PI/2);mg.translate(0,3.2,0);
 grp.add(new THREE.Mesh(mg,new THREE.ShaderMaterial({uniforms:U,transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,
  vertexShader:`uniform float uScroll;varying vec2 vQ;varying vec3 vW;
    void main(){vQ=vec2(position.x,position.z+uScroll);vec4 w=modelMatrix*vec4(position,1.0);vW=w.xyz;gl_Position=projectionMatrix*viewMatrix*w;}`,
  fragmentShader:`uniform vec3 uZen,uHor,uSun,uValley;uniform float uT,uEl,uNight;varying vec2 vQ;varying vec3 vW;${FOG}${GNOISE}${HFN}
    void main(){float dx=vQ.x-riverC(vQ.y);if(abs(dx)>110.0)discard;
      float dayK=smoothstep(-0.20,0.05,uEl);
      float cool=1.0-smoothstep(0.10,0.45,uEl);                       // dawn/dusk/night
      vec2 q=vec2(dx*0.012,vQ.y*0.009);
      float m=fbm2(q+vec2(uT*0.05,-uT*0.03))*0.65+fbm2(q*2.6+vec2(-uT*0.04,uT*0.02)+3.0)*0.35;
      float band=1.0-smoothstep(45.0,105.0,abs(dx));                  // hugs the channel, feathers onto the banks
      float a=smoothstep(0.38,0.80,m)*band*(0.06+0.22*cool);
      float near=smoothstep(60.0,220.0,length(cameraPosition-vW));    // never a flat wash right under the lens
      a*=near*fogOf(length(cameraPosition-vW),${FOGK}*0.5);
      vec3 c=mix(uValley*1.5,mix(uHor,uZen,0.4),0.55)*(0.75+0.35*dayK)+vec3(0.22,0.26,0.36)*uNight;
      gl_FragColor=vec4(c,a);}`})));}

/* ---- flora: cherry trees on the river banks, pines a band above them.
        One instanced draw call per species. Each tree keeps a fixed spot in NOISE space (the terrain's own
        coordinates) so it rides the ground exactly and wraps with the terrain window; the vertex shader
        re-evaluates height() at the foot and collapses trees that land in water, too high or on a cliff.
        Cherry = branching trunk (tapered cylinders) + ~40 blossom clusters drawn as camera-facing discs
        with a noisy fluffy edge and sphere-shaded so they read as volume. Pine = trunk + stacked whorls
        of open cones whose rims are eaten away by noise into ragged needle layers. ---- */
const rnd=(i,k)=>hash(i*1.31+k*7.7,k*0.37+2.1);
function treeBuilder(){const pos=[],nor=[],part=[],corner=[],cprop=[],seed=[];
  const push=(g,pt,center,r,sd)=>{const ng=g.index?g.toNonIndexed():g;const P=ng.attributes.position.array,N=ng.attributes.normal.array;
    for(let i=0;i<P.length;i+=3){pos.push(P[i],P[i+1],P[i+2]);nor.push(N[i],N[i+1],N[i+2]);part.push(pt);corner.push(0,0);
      cprop.push(center[0],center[1],center[2],r);seed.push(sd);}};
  const quad=(c,r,sd,pt)=>{for(const [x,y] of [[-1,-1],[1,-1],[1,1],[-1,-1],[1,1],[-1,1]]){
    pos.push(c[0],c[1],c[2]);nor.push(0,1,0);part.push(pt===undefined?2:pt);corner.push(x,y);cprop.push(c[0],c[1],c[2],r);seed.push(sd);}};
  const done=()=>{const geo=new THREE.InstancedBufferGeometry();
    geo.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));geo.setAttribute('normal',new THREE.Float32BufferAttribute(nor,3));
    geo.setAttribute('part',new THREE.Float32BufferAttribute(part,1));geo.setAttribute('corner',new THREE.Float32BufferAttribute(corner,2));
    geo.setAttribute('cprop',new THREE.Float32BufferAttribute(cprop,4));geo.setAttribute('cseed',new THREE.Float32BufferAttribute(seed,1));return geo;};
  return {push,quad,done};}
/* tapered limb along +Y of a matrix */
function limb(B,r0,r1,len,m,center){const g=new THREE.CylinderGeometry(r1,r0,len,6,1,true);g.translate(0,len/2,0);g.applyMatrix4(m);B.push(g,0,center||[0,0,0],0,0);}
const tipOf=(m,len)=>new THREE.Vector3(0,len,0).applyMatrix4(m);
function cherryTree(){const B=treeBuilder();const I=new THREE.Matrix4();
  const M=(...ms)=>ms.reduce((acc,m)=>acc.multiply(m),new THREE.Matrix4());
  const T=(x,y,z)=>new THREE.Matrix4().makeTranslation(x,y,z),RY=a=>new THREE.Matrix4().makeRotationY(a),RZ=a=>new THREE.Matrix4().makeRotationZ(a);
  limb(B,1.35,0.95,4.8,M(RZ(0.06)));
  const tips=[];let k=0;
  for(let i=0;i<5;i++){const ang=i*1.2566+rnd(i,1)*0.7,tilt=0.55+rnd(i,2)*0.35,len=4.6+rnd(i,3)*2.0;
    const m=M(T(0,4.6,0),RY(ang),RZ(tilt));limb(B,0.62,0.30,len,m);
    for(let j=0;j<2;j++){const m2=M(m,T(0,len,0),RY((j?1:-1)*(0.8+rnd(i,10+j)*0.7)),RZ(0.40+rnd(i,20+j)*0.45));
      const l2=3.0+rnd(i,30+j)*1.6;limb(B,0.30,0.14,l2,m2);
      for(let q=0;q<3;q++){const m3=M(m2,T(0,l2*(0.55+q*0.22),0),RY(q*2.1+rnd(i,40+q+j*3)*1.5),RZ(0.5+rnd(i,50+q)*0.5));
        const l3=1.6+rnd(i,60+q+j)*1.2;limb(B,0.12,0.05,l3,m3);
        tips.push([tipOf(m3,l3),1.5+rnd(i,70+q+j)*0.6]);tips.push([tipOf(m3,l3*0.45),1.2+rnd(i,80+q+j)*0.5]);}
      tips.push([tipOf(m2,l2),1.6]);tips.push([tipOf(m2,l2*0.5),1.3]);}
    tips.push([tipOf(m,len),1.5]);}
  for(const [c,r0] of tips){const r=r0*1.15;B.quad([c.x,c.y,c.z],r,k++);
    for(let q=0;q<3;q++){const o=new THREE.Vector3(rnd(k,q)-0.5,rnd(k,q+3)-0.35,rnd(k,q+6)-0.5).multiplyScalar(r*1.6);
      B.quad([c.x+o.x,c.y+o.y,c.z+o.z],r*(0.5+rnd(k,q+9)*0.4),k*3+q+1);}}
  return B.done();}
function pineTree(){const B=treeBuilder();
  const M=(...ms)=>ms.reduce((acc,m)=>acc.multiply(m),new THREE.Matrix4());
  const T=(x,y,z)=>new THREE.Matrix4().makeTranslation(x,y,z),RY=a=>new THREE.Matrix4().makeRotationY(a),RZ=a=>new THREE.Matrix4().makeRotationZ(a);
  limb(B,1.15,0.16,25,new THREE.Matrix4());                                  // trunk, tapering to the leader
  const NW=8;let k=0;
  for(let w=0;w<NW;w++){const f=w/(NW-1),y=3.6+f*19.0;
    const rad=(6.3*Math.pow(1.0-f,1.15)+0.75)*(0.9+rnd(w,4)*0.2);
    const nb=6;
    for(let i=0;i<nb;i++){const ang=(i/nb)*6.283+w*0.79+rnd(w,i)*0.5;
      const droop=1.15+(1.0-f)*0.78+rnd(w,i+9)*0.12;                         // upper branches lift, lower ones droop
      const len=rad*(0.85+rnd(w,i+3)*0.3);
      const m=M(T(0,y,0),RY(ang),RZ(droop));
      limb(B,0.26*(1.0-f)+0.09,0.05,len,m);
      /* overlapping needle sprays clothe the whole branch, biggest near the middle */
      for(let q=0;q<3;q++){const t=0.34+q*0.31,c=tipOf(m,len*t);
        B.quad([c.x,c.y,c.z],len*(0.62-q*0.11),k*1.7+q+0.3,3);k++;}
      const tp=tipOf(m,len);B.quad([tp.x,tp.y,tp.z],len*0.34,k*2.3+0.7,3);k++;}}
  const lead=[[0,23.2,0,2.4],[0,24.8,0,1.7],[0,26.0,0,1.1]];                 // leader tuft
  for(const [x,y,z,r] of lead){B.quad([x,y,z],r,k++*1.3,3);}
  return B.done();}
const cherryGeo=cherryTree(),pineGeo=pineTree();
/* scatter along the river in groves: dx = signed distance from the river centre line */
function plant(geo,n,seed,dxMin,dxMax,thr){const off=[],sc=[],rot=[],tint=[];
  for(let i=0;i<n*4&&off.length<n*2;i++){const zn=hash(i,seed)*TD,side=hash(i,seed+7)<0.5?-1:1;
    if(vnoise(zn*0.0035+seed,side*3.3)<thr)continue;                      // grove mask
    off.push(side*(dxMin+hash(i,seed+3)*(dxMax-dxMin)),zn);
    sc.push(0.7+hash(i,seed+5)*0.6);rot.push(hash(i,seed+9)*6.283);tint.push(hash(i,seed+11));}
  geo.setAttribute('aOff',new THREE.InstancedBufferAttribute(new Float32Array(off),2));
  geo.setAttribute('aScale',new THREE.InstancedBufferAttribute(new Float32Array(sc),1));
  geo.setAttribute('aRot',new THREE.InstancedBufferAttribute(new Float32Array(rot),1));
  geo.setAttribute('aTint',new THREE.InstancedBufferAttribute(new Float32Array(tint),1));
  geo.instanceCount=off.length/2;return geo;}
plant(cherryGeo,LITE?140:220,2.0,58,120,0.44);
plant(pineGeo,LITE?150:240,5.0,90,260,0.42);
const TREE_VS=`uniform float uScroll,uT,uKind;attribute vec2 aOff,corner;attribute float aScale,aRot,aTint,part,cseed;attribute vec4 cprop;
  varying vec3 vN,vL,vW;varying vec2 vC;varying float vF,vPart,vTint,vSeed,vR;${FOG}${GNOISE}${HFN}
  void main(){float TDc=${TD}.0;
    float lz=mod(aOff.y-uScroll+TDc*0.5,TDc)-TDc*0.5;float qz=lz+uScroll;
    float x=riverC(qz)+aOff.x;float h=height(vec2(x,qz));
    float e=6.0;float slope=abs(height(vec2(x+e,qz))-h)+abs(height(vec2(x,qz+e))-h);
    float hi=uKind<0.5?70.0:140.0,lo=uKind<0.5?1.5:30.0;
    float ok=step(lo,h)*(1.0-smoothstep(hi-20.0,hi,h))*(1.0-smoothstep(9.0,14.0,slope));
    float s=aScale*ok;float c=cos(aRot),sn=sin(aRot);
    vec3 p=position;
    /* wind: a slow gust envelope times a faster flutter. Applied AFTER the tree's own rotation so every
       tree bends the same way in world space, and scaled by height so trunks barely move. */
    float gust=0.60+0.40*sin(uT*0.23+aOff.y*0.0017);
    float wv=(sin(uT*1.05+aOff.y*0.011+cseed*0.7)+0.42*sin(uT*2.15+cseed*1.9))*gust;
    vec3 r=vec3(c*p.x-sn*p.z,p.y,sn*p.x+c*p.z)*s;
    float stiff=part<0.5?0.008:0.021;
    float bend=wv*stiff*max(r.y,0.0);r.x+=bend*0.94;r.z+=bend*0.34;
    vN=vec3(c*normal.x-sn*normal.z,normal.y,sn*normal.x+c*normal.z);vPart=part;vTint=aTint;vSeed=cseed;vR=cprop.w;
    vL=position-cprop.xyz;vC=corner;
    vec4 wp=modelMatrix*vec4(x+r.x,h-0.6*s+r.y,lz+r.z,1.0);vec4 mv=viewMatrix*wp;vW=wp.xyz;
    if(part>1.5){                                                           // foliage: camera-facing sprite
      float asp=part>2.5?0.58:1.0;                                          // needle sprays are flatter than blossom balls
      mv.xy+=corner*vec2(1.0,asp)*cprop.w*s;
      mv.x+=wv*0.30*s;mv.y+=sin(uT*1.7+cseed*3.1)*0.16*s;}                  // foliage flutters in the gust
    vF=fogOf(-mv.z,${FOGK});gl_Position=projectionMatrix*mv;}`;
const TREE_FS=`uniform vec3 uZen,uHor,uValley,uSun,uSunDir;uniform float uEl,uNight,uKind;uniform mat3 uCamM;
  varying vec3 vN,vL,vW;varying vec2 vC;varying float vF,vPart,vTint,vSeed,vR;${GNOISE}${LAMPF}
  void main(){
    vec3 L=normalize(vec3(uSunDir.x,max(uSunDir.y,0.12),uSunDir.z));vec3 Lm=normalize(vec3(-uSunDir.x*0.9,0.45,-0.6));
    float dayK=smoothstep(-0.20,0.05,uEl);
    vec3 keyC=mix(vec3(0.72,0.80,1.05),uSun,dayK);
    vec3 n;vec3 alb;float ao=1.0,trans=0.0;
    if(vPart>2.5){                                                      /* pine needle spray */
      float rr=length(vec2(vC.x,vC.y*1.45));if(rr>1.15)discard;
      float fl=fbm2(vC*2.1+vSeed*5.0);
      float body=smoothstep(1.06,0.52,rr-(fl-0.5)*0.5);
      float nd=vn2(vec2(vC.x*3.2,vC.y*26.0+vSeed*3.0));                      /* fine needle streaks */
      float a=body*(0.28+0.72*smoothstep(0.34,0.66,nd));if(a<0.45)discard;
      vec3 nv=normalize(vec3(vC.x*0.75,vC.y*0.75,0.85));n=normalize(uCamM*nv+vec3(0.0,0.35,0.0));
      vec3 dark=vec3(0.055,0.135,0.095),mid=vec3(0.13,0.28,0.16),tip=mix(vec3(0.22,0.40,0.20),vec3(0.31,0.47,0.23),vTint);
      alb=mix(dark,mix(mid,tip,smoothstep(0.35,1.0,rr)),smoothstep(0.05,0.8,rr));
      alb*=0.80+0.20*nd;
      ao=0.52+0.48*smoothstep(-0.9,0.9,vC.y)*0.6+0.25*rr;                    /* undersides darker */
      vec3 Vd=normalize(cameraPosition-vW);float back=max(dot(-Vd,L),0.0)*dayK;
      trans=back*0.35*smoothstep(0.2,1.0,rr);}
    else if(vPart>1.5){                                                           /* blossom cluster */
      float rr=length(vC);if(rr>1.0)discard;
      /* many small round blossoms packed into a fluffy silhouette */
      float fl=fbm2(vC*2.4+vSeed*7.1);
      float body=smoothstep(0.86,0.50,rr-(fl-0.5)*0.55);
      float fl2=vn2(vC*7.0+vSeed*3.3);float petals=smoothstep(0.32,0.62,fl2);
      float a=body*(0.35+0.65*petals);if(a<0.42)discard;
      float rrc=min(rr,0.999);
      vec3 nv=vec3(vC.x,vC.y,sqrt(1.0-rrc*rrc));n=normalize(uCamM*nv);       /* sphere-shaded in view space */
      vec3 pale=vec3(0.99,0.84,0.89),mid=vec3(0.97,0.66,0.76),deep=vec3(0.88,0.40,0.58);
      float tone=clamp(vTint*0.5+fract(vSeed*0.37)*0.5,0.0,1.0);
      alb=mix(mix(mid,pale,tone),deep,smoothstep(0.55,0.25,fl2)*0.55);      /* darker flower centres */
      alb=mix(alb,vec3(1.0,0.97,0.98),smoothstep(0.78,0.95,fl2)*0.5);       /* white petal edges */
      ao=0.62+0.38*nv.z;
      /* sun coming through the petals: rim light when the sun is behind the tree */
      vec3 Vd=normalize(cameraPosition-vW);float back=max(dot(-Vd,L),0.0)*dayK;
      trans=back*(1.0-nv.z*0.7)*0.9;}
    else{                                                                    /* bark */
      n=normalize(vN);float bk=vn2(vec2(atan(vN.z,vN.x)*6.0,vL.y*1.6));
      alb=mix(vec3(0.20,0.15,0.13),vec3(0.36,0.30,0.27),bk)*(uKind<0.5?0.85:1.0);}
    float diff=max(dot(n,L),0.0)*dayK+max(dot(n,Lm),0.0)*(1.0-dayK)*1.05;
    float up=n.y*0.5+0.5;vec3 amb=mix(uValley*1.4,mix(uHor,uZen,0.5)*1.3,up);
    amb=mix(amb,vec3(dot(amb,vec3(0.299,0.587,0.114)))*1.04,dayK*0.80);
    float ex=mix(1.30,1.45,dayK);
    vec3 col=alb*ao*(amb*(0.55+0.25*dayK)+keyC*diff*(0.80+0.75*dayK))*ex;
    col+=uSun*alb*trans*0.9+uSun*0.05*dayK*step(1.5,vPart);              /* translucent petals + sun catch */
    col+=vec3(0.07,0.13,0.12)*uNight*up*0.6;
    col+=alb*vec3(1.0,0.90,0.78)*lamp(vW,n,dayK)*(vPart>1.5?1.0:0.9);       /* camera head-light: blossoms glow */
    vec3 fogc=mix(uHor,uZen,mix(0.35,0.18,dayK))*mix(1.0,1.22,dayK);
    gl_FragColor=vec4(mix(fogc,col,vF),1.0);}`;
for(const [geo,kind] of [[cherryGeo,0],[pineGeo,1]]){
  const m=new THREE.Mesh(geo,new THREE.ShaderMaterial({uniforms:Object.assign({},U,{uKind:{value:kind}}),vertexShader:TREE_VS,fragmentShader:TREE_FS,side:THREE.DoubleSide}));
  m.frustumCulled=false;grp.add(m);}

const SPEED=26;   // world units per second of forward travel
const riverC=z=>Math.sin(z*0.0019)*85+Math.sin(z*0.0047+1.3)*30;   // JS twin of the shader's riverC

/* ---- valley mist ---- */
const mist=new THREE.Mesh(new THREE.PlaneGeometry(4200,4200,1,1),new THREE.ShaderMaterial({uniforms:U,transparent:true,depthWrite:false,
  blending:THREE.AdditiveBlending,
  vertexShader:`varying vec2 vP;void main(){vP=position.xy;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}`,
  fragmentShader:`uniform vec3 uValley,uSun;uniform float uT,uEl,uScroll;varying vec2 vP;${GNOISE}
    void main(){vec2 p=vec2(vP.x,-vP.y+uScroll)*0.0016;
      float f=fbm2(p*1.6+vec2(uT*0.014,0.0));
      float a=smoothstep(0.48,0.92,f)*0.16;a*=1.0-smoothstep(700.0,1300.0,length(vP));
      vec3 c=mix(uValley*1.15,uSun*0.30,0.18*smoothstep(-0.1,0.4,uEl));gl_FragColor=vec4(c,a);}`}));
mist.rotation.x=-Math.PI/2;scene.add(mist);

/* ---- birds: three small distant clusters, loose formation ---- */
const FLOCKS=[{n:9,off:0,sp:9,h:260,z:-1500,side:-1},{n:12,off:700,sp:7,h:300,z:-1900,side:1},{n:7,off:1300,sp:11,h:230,z:-1300,side:-1}];
const NB=FLOCKS.reduce((a,f)=>a+f.n,0),bgeo=new THREE.BufferGeometry(),bpos=new Float32Array(NB*4*3);
bgeo.setAttribute('position',new THREE.BufferAttribute(bpos,3));
const birdCol=new THREE.Color('#080a10').lerp(new THREE.Color('#dfe6f2'),Math.max(0,1-dayF*1.25));
const birds=new THREE.LineSegments(bgeo,new THREE.LineBasicMaterial({color:birdCol,transparent:true,opacity:0.7}));
scene.add(birds);birds.visible=sunEl>-0.20;
const BR=(i)=>hash(i*1.7,3.3);
function flock(t,camZ){let o=0,id=0;
  for(const F of FLOCKS){const span=2400,lx=F.side*(-1200+((t*F.sp+F.off)%span)),ly=F.h+18*Math.sin(t*0.15+F.off),lz=camZ+F.z;
    for(let i=0;i<F.n;i++,id++){const k=Math.ceil(i/2),side=i%2?1:-1;
      const x=lx+F.side*side*k*14+Math.sin(t*0.7+id)*6,y=ly-k*3.5+Math.sin(t*0.5+id*1.3)*4+BR(id)*10,z=lz+k*9+BR(id)*40;
      const w=5+BR(id)*2,fl=Math.sin(t*(6+BR(id)*2)+id*1.3)*0.7;
      bpos[o++]=x;bpos[o++]=y;bpos[o++]=z;bpos[o++]=x-w;bpos[o++]=y+fl*w*0.8;bpos[o++]=z+2;
      bpos[o++]=x;bpos[o++]=y;bpos[o++]=z;bpos[o++]=x+w;bpos[o++]=y+fl*w*0.8;bpos[o++]=z+2;}}
  bgeo.attributes.position.needsUpdate=true;}

/* ---- cherry petals: a camera-attached volume of tumbling petals drifting toward the lens ----
        Positions are computed straight in VIEW space from a per-petal seed, so the swarm rides with the camera
        as it flies; each petal advances toward z=0, falls slowly, drifts with the same +x wind the trees bend to,
        and wraps back to the far end. Near the lens they swell, soften and fade instead of popping. ---- */
const NP=LITE?70:200;
{const pp=[],pc=[],ps=[];
 for(let i=0;i<NP;i++){const sd=[hash(i,21.3),hash(i,22.7),hash(i,23.9),hash(i,25.1)];
   for(const [x,y] of [[-1,-1],[1,-1],[1,1],[-1,-1],[1,1],[-1,1]]){pp.push(0,0,0);pc.push(x,y);ps.push(...sd);}}
 const pgeo=new THREE.BufferGeometry();
 pgeo.setAttribute('position',new THREE.Float32BufferAttribute(pp,3));pgeo.setAttribute('corner',new THREE.Float32BufferAttribute(pc,2));
 pgeo.setAttribute('aSeed',new THREE.Float32BufferAttribute(ps,4));
 U.uAsp={value:1};
 const petals=new THREE.Mesh(pgeo,new THREE.ShaderMaterial({uniforms:U,transparent:true,depthWrite:false,side:THREE.DoubleSide,
   vertexShader:`uniform float uT,uAsp;attribute vec2 corner;attribute vec4 aSeed;varying vec2 vC;varying float vZ,vSd,vFace;
     void main(){float sp=0.55+aSeed.w*0.9;
       float zr=fract(aSeed.z+uT*sp*0.030);float z=-mix(560.0,14.0,zr);          // far -> just short of the lens, then wrap
       float nx=fract(aSeed.x+uT*0.0045*sp)*2.7-1.35+sin(uT*0.8+aSeed.y*31.0)*0.05;    // wind drift (+x) + sway
       float ny=1.3-fract(aSeed.y+uT*0.010*sp)*2.6+sin(uT*1.3+aSeed.x*27.0)*0.04;      // slow fall + bob
       float d=-z;vec3 v=vec3(nx*d*0.4245*uAsp,ny*d*0.4245,z);
       float ang=uT*(1.4+aSeed.w*2.2)+aSeed.x*6.283;float ca=cos(ang),sa=sin(ang);
       float flip=cos(uT*(1.9+aSeed.y*1.5)+aSeed.z*9.0);vFace=flip;                    // 3D tumble: width squashes as it turns
       float r=(0.16+aSeed.w*0.14);                  // swells as it nears the lens
       vec2 c=corner*vec2(0.62*mix(0.25,1.0,abs(flip)),1.0)*r;
       v.xy+=vec2(ca*c.x-sa*c.y,sa*c.x+ca*c.y);
       vC=corner;vZ=d;vSd=aSeed.w;gl_Position=projectionMatrix*vec4(v,1.0);}`,
   fragmentShader:`uniform vec3 uZen,uHor,uSun;uniform float uEl;varying vec2 vC;varying float vZ,vSd,vFace;${FOG}
     void main(){vec2 p=vC;float dayK=smoothstep(-0.20,0.05,uEl);
       float sh=1.0-p.x*p.x-p.y*p.y;
       sh-=smoothstep(0.32,0.0,abs(p.x))*smoothstep(0.45,1.0,p.y)*0.55;                 // sakura notch at the tip
       float soft=0.07;
       float a=smoothstep(-soft,soft*0.6,sh);
       a*=smoothstep(14.0,30.0,vZ)*(1.0-smoothstep(380.0,560.0,vZ));                    // fade in from far, gone before the lens
       vec3 base=mix(vec3(1.0,0.90,0.94),vec3(0.99,0.74,0.83),vSd);
       base=mix(base,vec3(0.95,0.55,0.68),smoothstep(-0.2,-1.0,p.y)*0.5);               // deeper pink at the stem
       float face=0.72+0.28*abs(vFace);                                                 // edge-on petals catch less light
       vec3 day=base*(0.62+0.42*face)*mix(vec3(0.92,0.94,1.0),uSun,0.35);
       vec3 night=base*(0.22+0.12*face)*vec3(0.78,0.84,1.0);                                 // moonlit, so far ones read pale not as dark specks
       float torch=(1.0-smoothstep(40.0,260.0,vZ))*(1.0-dayK);                          // camera lamp catches the near ones
       night+=base*vec3(1.0,0.90,0.80)*torch*0.85;
       vec3 col=mix(night,day,dayK);
       vec3 fogc=mix(uHor,uZen,mix(0.35,0.18,dayK))*mix(1.0,1.22,dayK);
       col=mix(fogc,col,fogOf(vZ,${FOGK}));
       gl_FragColor=vec4(col,a*0.85);}`}));
 petals.frustumCulled=false;petals.renderOrder=5;camera.add(petals);scene.add(camera);}

/* ---- camera + loop ---- */
let mx=0,my=0,tx=0,ty=0;
/* parallax follows the mouse only: a finger dragging to scroll must not steer the camera */
addEventListener('pointermove',e=>{if(e.pointerType&&e.pointerType!=='mouse')return;tx=e.clientX/innerWidth-.5;ty=e.clientY/innerHeight-.5;},{passive:true});
function resize(){const w=canvas.clientWidth||innerWidth,h=canvas.clientHeight||innerHeight;
  camera.aspect=w/h;U.uAsp.value=camera.aspect;camera.updateProjectionMatrix();renderer.setSize(w,h,false);U.uS.value=h*devicePixelRatio/900;}
addEventListener('resize',()=>{resize();if(LITE)frame();});resize();
const clock=new THREE.Clock();
let running=true,rafId=0,lost=false;
function start(){if(!rafId&&!lost)loop();}
document.addEventListener('visibilitychange',()=>{running=!document.hidden;if(running){clock.getDelta();start();}});
/* iOS Safari drops WebGL contexts when the tab is backgrounded or memory is tight; preventDefault lets it come back */
canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();lost=true;},false);
canvas.addEventListener('webglcontextrestored',()=>{lost=false;resize();start();},false);
function frame(){
  const t=LITE?0:clock.getElapsedTime();U.uT.value=t;
  mx+=(tx-mx)*.03;my+=(ty-my)*.03;const p=Math.min(scrollY/(document.body.scrollHeight-innerHeight||1),1);
  /* fly along the river: the camera and its aim point track the meander (same riverC as the shaders,
     evaluated in noise space = world z minus the scroll distance), so it never clips a valley wall */
  const S=t*SPEED,camZ=260-p*420;
  const rx=riverC(camZ-S),ax=riverC(camZ-420-S);
  camera.position.set(rx+mx*18+Math.sin(t*0.11)*10,40-p*10-my*6,camZ);
  camera.up.set(Math.sin(t*0.07)*0.03,1,0);
  camera.lookAt(ax+mx*40,70-p*8,camZ-420);camera.updateMatrixWorld();
  U.uCamM.value.setFromMatrix4(camera.matrixWorld);camera.getWorldDirection(U.uCamF.value);
  /* the ground stays glued to the camera; the noise field slides underneath it */
  /* snap noise sampling to the vertex lattice: no per-frame re-sampling, so no wobble */
  {const step=TD/GRID[1],base=camera.position.z-TD/2+120;
   const q=Math.floor((base-S)/step)*step;grp.position.z=S+q;U.uScroll.value=q;}
  sky.position.copy(camera.position);
  sunGrp.position.copy(camera.position).addScaledVector(sunDir,3800);sunGrp.lookAt(camera.position);
  moon.position.copy(camera.position).addScaledVector(moonDir,3800);moon.lookAt(camera.position);
  halo.position.copy(moon.position);halo.lookAt(camera.position);
  mist.position.set(camera.position.x,22,camera.position.z-1100);
  if(birds.visible)flock(t,camera.position.z);
  renderer.render(scene,camera);}

function loop(){rafId=0;if(lost)return;frame();if(running&&!LITE)rafId=requestAnimationFrame(loop);}
loop();
}catch(err){skyFallback(err);}


/* header turns to glass once content moves under it */
{const hd=document.querySelector('header.top');
 const upd=()=>hd&&hd.classList.toggle('scrolled',scrollY>8);
 addEventListener('scroll',upd,{passive:true});upd();}
