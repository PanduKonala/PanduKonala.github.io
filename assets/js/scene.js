
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
/* Gentle camera-side fill, only in dim hours. A broad falloff lifts nearby
   banks and foliage without a visible spotlight circle or glowing horizon. */
const LAMPF=`
  uniform vec3 uCamF;
  float cameraFill(vec3 W,vec3 n,float elevation){
    vec3 offset=W-cameraPosition;float distance=length(offset);
    vec3 direction=offset/max(distance,1.0);
    float cone=smoothstep(-0.20,0.75,dot(direction,uCamF));
    float fall=(1.0-smoothstep(420.0,950.0,distance))/(1.0+distance*distance/90000.0);
    float facing=0.55+0.45*max(dot(n,-direction),0.0);
    float dim=1.0-smoothstep(0.08,0.50,elevation);
    return cone*fall*facing*dim*0.30;}`;
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
      /* Keep a compact aureole around the disc, with a faint warm horizon
         haze. Broad additive bloom used to bleach a large circle of sky. */
       c+=uSun*(pow(s,3200.0)*0.40+pow(s,180.0)*0.065+pow(s,12.0)*(0.025+0.07*nearH))*vis;
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
const sunDisc=L(K.sun,C('#fff9ea'),0.85*hiSun);
sunGrp.add(new THREE.Mesh(new THREE.CircleGeometry(56,48),new THREE.MeshBasicMaterial({color:sunDisc,transparent:true,opacity:1,depthWrite:false})));
sunGrp.add(new THREE.Mesh(new THREE.CircleGeometry(120,48),new THREE.ShaderMaterial({uniforms:U,transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,
  vertexShader:`varying vec2 vU;void main(){vU=uv*2.0-1.0;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}`,
  fragmentShader:`uniform vec3 uSun;uniform float uEl;varying vec2 vU;void main(){float r=length(vU);float hi=smoothstep(0.35,0.9,uEl);gl_FragColor=vec4(uSun,pow(max(0.0,1.0-r),2.8)*(0.22+0.06*hi));}`})));
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

/* ---- terrain: shared world-space height field keeps the ground, water and trees
        aligned while the sampling window travels along the river. ---- */
const HFN=`
  float riverC(float z){return sin(z*0.0019)*85.0+sin(z*0.0047+1.3)*30.0;}
  float ridged(vec2 p){float s=0.0,a=0.5,w=1.0;for(int i=0;i<5;i++){float n=1.0-abs(2.0*vn2(p)-1.0);n=n*n*w;w=clamp(n*1.8,0.0,1.0);s+=n*a;p=p*2.07+vec2(1.7,9.2);a*=0.5;}return s;}
  float height(vec2 q){float rc=riverC(q.y),bank=abs(q.x-rc);
    float base=fbm6(q*0.0028+vec2(3.1,7.7));
    float h=pow(base,1.9)*300.0;
    /* Bend ridge coordinates at a broad scale, rather than wrinkle every slope
       equally. The river corridor retains its original low, open profile. */
    vec2 warp=vec2(vn2(q*0.0021+13.0),vn2(q*0.0021-7.0))-0.5;
    vec2 rockQ=q+warp*100.0;
    float rg=ridged(rockQ*0.0055+vec2(5.0,1.0));
    float upland=smoothstep(65.0,260.0,bank);
    h+=(rg-0.30)*195.0*smoothstep(38.0,160.0,h)*upland;
    /* Long descending spurs and intervening gullies. This is an erosion-like
       shape model, not a hydraulic simulation. Detail tapers out at the banks. */
    float drainage=vn2(vec2(q.y*0.018+warp.x*1.8,bank*0.0035+warp.y));
    float gully=1.0-abs(drainage*2.0-1.0);
    h-=pow(gully,5.0)*26.0*smoothstep(40.0,130.0,h)*upland;
    h+=(fbm2(rockQ*0.015+vec2(9.0,2.0))-0.5)*20.0*smoothstep(40.0,160.0,h);
    h+=(fbm2(q*0.045)-0.35)*8.0;
    h*=1.0-0.85*exp(-pow((q.x-rc*0.7)/150.0,2.0));
    float dx=bank+(fbm2(q*0.02)-0.5)*16.0;
    h=mix(h,-7.0-fbm2(q*0.08)*2.0,1.0-smoothstep(20.0,60.0,dx));
    return h;}`;
const grp=new THREE.Group();scene.add(grp);
const TW=2000,TD=3200;
{const geo=new THREE.PlaneGeometry(TW,TD,GRID[0],GRID[1]);geo.rotateX(-Math.PI/2);
 const HVS=`uniform float uS,uScroll,uEl;uniform vec3 uSunDir;varying float vH,vF,vSh,vShelter;varying vec3 vN,vW;varying vec2 vQ;${FOG}${GNOISE}${HFN}
   float shade(vec2 q,float h){
     vec3 L=uEl<-0.15?normalize(vec3(-uSunDir.x*0.9,0.45,-0.6)):normalize(vec3(uSunDir.x,max(uSunDir.y,0.06),uSunDir.z));
     float s=1.0;
     for(int i=1;i<=${LITE?4:6};i++){float t=float(i*i)*9.0;float hh=height(q+L.xz*t);
       s=min(s,clamp((h+L.y*t-hh)/(t*0.20)+0.65,0.0,1.0));}
     return mix(0.24,1.0,s);}
   void main(){vec2 q=vec2(position.x,position.z+uScroll);float h=height(q);
     /* Symmetric differences avoid biasing highlights toward one grid axis.
        Local concavity only dims ambient fill, never paints black stripes. */
     float e=3.0;
     float xp=height(q+vec2(e,0.0)),xm=height(q-vec2(e,0.0));
     float zp=height(q+vec2(0.0,e)),zm=height(q-vec2(0.0,e));
     vN=normalize(vec3(xm-xp,2.0*e,zm-zp));vQ=q;vSh=shade(q,h);
     vShelter=1.0-smoothstep(0.0,2.8,(xp+xm+zp+zm)*0.25-h)*0.32;
     vec3 P=vec3(position.x,h,position.z);vH=h;vW=(modelMatrix*vec4(P,1.0)).xyz;
     vec4 mv=modelViewMatrix*vec4(P,1.0);vF=fogOf(-mv.z,${FOGK});gl_Position=projectionMatrix*mv;}`;
 grp.add(new THREE.Mesh(geo,new THREE.ShaderMaterial({uniforms:U,vertexShader:HVS,
   fragmentShader:`uniform vec3 uZen,uHor,uValley,uRidge,uSun,uSunDir;uniform float uEl,uNight;varying float vH,vF,vSh,vShelter;varying vec3 vN,vW;varying vec2 vQ;${GNOISE}${LAMPF}
     /* Surface variation is evaluated in world space on all three axes, so
        cliffs do not stretch a top-down pattern into parallel rubbery bands. */
     float stone(vec3 p,vec3 weights){
       return vn2(p.yz)*weights.x+vn2(p.xz+17.3)*weights.y+vn2(p.xy-9.1)*weights.z;}
     void main(){vec3 baseN=normalize(vN),n=baseN;
       float dayK=smoothstep(-0.20,0.05,uEl);
       float camD=length(cameraPosition-vW);
       float lod=1.0-smoothstep(250.0,1450.0,camD);
       vec3 weights=pow(abs(baseN),vec3(4.0));weights/=max(dot(weights,vec3(1.0)),0.001);
       vec3 p=vec3(vQ.x,vH,vQ.y);
       float mineral=stone(p*0.033,weights),grain=stone(p*0.65,weights);
       float fine=stone(p*1.15,weights);
       /* Fine grains disappear before their projected footprint becomes smaller
          than a pixel; they must not sparkle when the camera travels. */
       float micro=1.0-smoothstep(0.35,1.2,length(fwidth(p*1.15)));
       float detail=stone(p*0.12,weights);
       vec3 g=vec3(stone(p*0.12+vec3(0.15,0.0,0.0),weights),
                   stone(p*0.12+vec3(0.0,0.15,0.0),weights),
                   stone(p*0.12+vec3(0.0,0.0,0.15),weights))-detail;
       g/=0.15;
       /* Project the perturbation onto the actual rock face. */
       float slope=1.0-clamp(baseN.y,0.0,1.0);
       /* An irregular alpine snowline, with drifts below the main cap and
          exposed rock on near-vertical faces. Summit snow remains continuous. */
       float snowLine=118.0+(fbm2(vQ*0.007+vec2(8.0,3.0))-0.48)*48.0;
       float drift=(mineral-0.5)*22.0+(detail-0.5)*9.0;
       float snowHeight=smoothstep(snowLine-12.0,snowLine+30.0,vH+drift);
       float summit=smoothstep(snowLine+28.0,snowLine+70.0,vH);
       float holding=1.0-smoothstep(0.52,0.86,slope)*(0.92-0.30*summit);
       float snow=clamp(snowHeight*holding,0.0,1.0);
       n=normalize(baseN-(g-baseN*dot(g,baseN))*(0.28+0.65*slope)*lod*mix(1.0,0.16,snow));
       float cav=mix(1.0,0.83+0.17*smoothstep(0.22,0.70,detail),lod*(1.0-snow*0.8));
       vec3 L=normalize(vec3(uSunDir.x,max(uSunDir.y,0.12),uSunDir.z));
       vec3 Lm=normalize(vec3(-uSunDir.x*0.9,0.45,-0.6));
       float diff=(max(dot(n,L),0.0)*dayK+max(dot(n,Lm),0.0)*(1.0-dayK))*vSh;
       vec3 keyC=mix(vec3(0.66,0.74,0.92),uSun,dayK);
       float up=baseN.y*0.5+0.5;
       vec3 amb=mix(uValley*1.1,mix(uHor,uZen,0.5)*1.3,up);
       amb=mix(amb,vec3(dot(amb,vec3(0.299,0.587,0.114))),dayK*0.80);
       /* Broad, non-periodic mineral mottling replaces the height-based seams
          and stretched bedding that read as horizontal lines on the slopes. */
       float mottling=stone(p*0.018+vec3(4.1,9.3,2.7),weights);
       vec3 rock=mix(vec3(0.19,0.195,0.20),vec3(0.49,0.46,0.41),smoothstep(0.22,0.78,mineral));
       rock*=0.88+0.16*mottling+0.38*(grain-0.5)*lod+0.24*(fine-0.5)*micro;
       rock+=vec3(0.07,0.065,0.055)*smoothstep(0.62,0.79,fine)*micro;
       vec3 grass=mix(vec3(0.19,0.23,0.14),vec3(0.35,0.32,0.20),smoothstep(0.28,0.73,mineral));
       grass*=0.80+0.36*grain*lod+0.18*(fine-0.5)*micro;
       vec3 scree=mix(vec3(0.29,0.28,0.26),vec3(0.43,0.41,0.37),mineral);
       float rk=smoothstep(0.12,0.34,slope+(mineral-0.5)*0.25);
       float debris=smoothstep(0.10,0.28,slope)*(1.0-smoothstep(0.36,0.56,slope));
       float bank=abs(vQ.x-(sin(vQ.y*0.0019)*85.0+sin(vQ.y*0.0047+1.3)*30.0));
       float shore=(1.0-smoothstep(48.0,88.0,bank))*(1.0-smoothstep(4.0,20.0,vH));
       vec3 alb=mix(grass,rock,rk);alb=mix(alb,scree,max(debris*0.48,shore*0.8));
       vec3 snowColor=mix(vec3(0.78,0.84,0.91),vec3(0.94,0.96,0.98),0.60+0.30*mineral);
       alb=mix(alb,snowColor,snow);
       keyC=mix(keyC,mix(keyC,vec3(0.94,0.97,1.0),dayK*0.60),snow);
       /* Damp rock at the waterline is darker, not a glowing valley floor. */
       float damp=1.0-smoothstep(1.0,7.0,vH);alb*=1.0-damp*0.26;
       alb=mix(alb*vec3(0.83,0.88,1.0),alb,dayK);
       vec3 col=alb*cav*(amb*(0.62+0.25*dayK)*vShelter+keyC*diff*(1.08+1.05*dayK))*mix(1.25,1.62,dayK);
       col+=uRidge*0.12*snow*diff;
       col+=vec3(0.045,0.085,0.08)*uNight*up*(0.45+0.55*snow);
       col+=alb*vec3(1.0,0.94,0.86)*cameraFill(vW,n,uEl);
       /* Haze separates distant ridges while keeping foreground rock crisp. */
       vec3 fogc=mix(uHor,uZen,mix(0.35,0.18,dayK))*mix(1.0,1.22,dayK);
       gl_FragColor=vec4(mix(fogc,col,vF),1.0);}`})));}

/* ---- river: fine filtered ripples, muted sky/valley reflections and a soft
   directional sun path. The original channel and water level are unchanged. ---- */
{const wg=new THREE.PlaneGeometry(TW,TD,1,1);wg.rotateX(-Math.PI/2);
 grp.add(new THREE.Mesh(wg,new THREE.ShaderMaterial({uniforms:Object.assign({},U,{uMoonDir:{value:moonDir}}),transparent:true,depthWrite:false,
   vertexShader:`uniform float uScroll;varying vec2 vQ;varying vec3 vW;
     void main(){vQ=vec2(position.x,position.z+uScroll);vec4 w=modelMatrix*vec4(position,1.0);vW=w.xyz;gl_Position=projectionMatrix*viewMatrix*w;}`,
   fragmentShader:`uniform vec3 uZen,uHor,uSun,uSunDir,uMoonDir,uValley;uniform float uT,uEl,uNight;varying vec2 vQ;varying vec3 vW;${FOG}${GNOISE}${HFN}${LAMPF}
     /* Analytic wave slopes have no hard noise thresholds. Screen-space
        filtering removes waves smaller than a pixel instead of sparkling. */
     vec2 wave(vec2 q,vec2 dir,float frequency,float amplitude,float phase){
       float a=dot(q,dir)*frequency+phase;
       float waveFade=1.0-smoothstep(0.6,2.6,fwidth(a));
       return dir*cos(a)*amplitude*waveFade;}
     void main(){
       float dx=vQ.x-riverC(vQ.y);if(abs(dx)>80.0)discard;
       float depth=-height(vQ);if(depth<0.0)discard;
       float dayK=smoothstep(-0.20,0.05,uEl);
       vec3 V=normalize(cameraPosition-vW);float camD=length(cameraPosition-vW);
       float bw=1.0-clamp(abs(dx)/62.0,0.0,1.0);
       /* Backtrace the surface pattern downstream (+world Z). The source
          point keeps its lateral distance from the meandering centreline, so
          the current follows bends rather than sliding through a bank. */
       float flowTime=uT;
       float sourceZ=vQ.y-flowTime*7.0;
       vec2 q=vec2(dx+riverC(sourceZ),sourceZ);
       vec2 g=wave(q,vec2(0.94,0.342),0.44,0.024,0.4);
       g+=wave(q,vec2(-0.78,0.626),0.73,0.016,2.1);
       g+=wave(q,vec2(0.35,0.937),1.27,0.010,4.3);
       g+=wave(q,vec2(-0.22,0.976),2.05,0.005,1.7);
       float swell=vn2(q*0.026);
       g*=0.72+0.40*swell;
       /* Irregular cross-ripples travel with the same current as the waves. */
       vec2 nq=q*0.38;
       float ns=vn2(nq);
       vec2 ng=vec2(vn2(nq+vec2(0.12,0.0)),vn2(nq+vec2(0.0,0.12)))-ns;
       float rippleFade=1.0-smoothstep(0.25,1.2,length(fwidth(nq)));
       g+=ng*0.24*rippleFade;
       /* Broken, low-contrast surface streaks reveal the direction of flow.
          No time wrapping, hard reset or independently flashing glitter. */
       vec2 currentUV=vec2(dx*0.24,sourceZ*0.11);
       float current=vn2(currentUV)*0.65+vn2(currentUV*2.13+3.7)*0.35;
       float currentFade=1.0-smoothstep(0.35,1.2,length(fwidth(currentUV)));
       float streak=smoothstep(0.48,0.76,current)*currentFade;
       vec3 n=normalize(vec3(-g.x,1.0,-g.y));
       vec3 R=reflect(-V,n);
       float fres=0.02+0.98*pow(1.0-max(dot(n,V),0.0),5.0);
       vec3 skyRef=mix(uHor,uZen,pow(clamp(R.y,0.0,1.0),0.65));
       skyRef*=mix(0.50,0.70,dayK);
       /* A soft valley-wall approximation darkens water under the banks.
          No extra reflection render pass or screen-space tracing is needed. */
       vec3 wallRef=mix(uValley*0.60,vec3(0.075,0.095,0.08),dayK);
       float openSky=smoothstep(0.03,0.72,bw+g.x*sign(dx)*2.2);
       vec3 refl=mix(wallRef,skyRef,openSky);
       float deep=1.0-exp(-depth*0.32);
       vec3 shallow=mix(vec3(0.025,0.065,0.075),vec3(0.075,0.18,0.15),dayK);
       vec3 deepC=mix(vec3(0.008,0.021,0.038),vec3(0.022,0.072,0.092),dayK);
       vec3 body=mix(shallow,deepC,deep);
       float bed=vn2(vQ*0.48+g*1.6)*0.65+vn2(vQ*1.2)*0.35;
       body+=vec3(0.12,0.105,0.075)*bed*(1.0-deep)*dayK;
       vec3 col=mix(body,refl,fres*0.86);
       /* Broad, low-energy highlights instead of independently thresholded
          glitter. Reflection directions match the visible sun and moon. */
       vec3 H=normalize(uSunDir+V),Hm=normalize(uMoonDir+V);
       float sunVisible=smoothstep(-0.03,0.07,uEl);
       float spec=pow(max(dot(n,H),0.0),1350.0)*0.48*sunVisible;
       float moonSpec=pow(max(dot(n,Hm),0.0),720.0)*0.26*uNight;
       float reflectionSpace=0.28+0.72*openSky;
       col+=mix(vec3(0.92,0.94,0.96),uSun,0.35)*spec*reflectionSpace;
       col+=vec3(0.50,0.61,0.78)*moonSpec*reflectionSpace;
       col+=vec3(0.032,0.070,0.064)*uNight*openSky*(0.35+0.65*fres);
       col+=vec3(0.045,0.065,0.095)*uNight*(0.45+0.55*fres)*(0.78+0.22*ns);
       col+=mix(vec3(0.012,0.020,0.025),vec3(0.025,0.035,0.038),dayK)*(ns-0.35)*rippleFade;
       col+=mix(vec3(0.022,0.034,0.043),vec3(0.065,0.085,0.088),dayK)*streak*(0.35+0.65*bw);
       col+=vec3(0.055,0.070,0.080)*cameraFill(vW,n,uEl);
       /* Foam is sparse and confined to shallow shoreline water, not painted
          as bright flakes over the entire river. */
       float shore=(1.0-smoothstep(0.35,1.9,depth))*smoothstep(0.0,0.25,depth);
       float foam=shore*smoothstep(0.57,0.77,vn2(q*0.32))*0.20;
       col=mix(col,mix(vec3(0.09,0.12,0.15),vec3(0.42,0.46,0.43),dayK),foam);
       float a=smoothstep(0.0,1.6,depth);
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

/* ---- flora: branching cherry crowns and layered evergreen sprays.
   Foliage uses intersecting, world-oriented cards rather than billboards. Each
   species remains one instanced draw call; height() anchors every tree to land. */
const rnd=(i,k)=>hash(i*1.31+k*7.7,k*0.37+2.1);
function treeBuilder(){const pos=[],nor=[],part=[],corner=[],cprop=[],seed=[];
  const push=(g,pt,center,r,sd)=>{const ng=g.index?g.toNonIndexed():g;const P=ng.attributes.position.array,N=ng.attributes.normal.array;
    for(let i=0;i<P.length;i+=3){pos.push(P[i],P[i+1],P[i+2]);nor.push(N[i],N[i+1],N[i+2]);part.push(pt);corner.push(0,0);
      cprop.push(center[0],center[1],center[2],r);seed.push(sd);}
    if(ng!==g)ng.dispose();g.dispose();};
  const spray=(c,r,sd,pt)=>{
    /* Crossed planes intersect through a real branch tip. Their orientation is
       fixed in the tree, so foliage does not rotate toward a moving camera. */
    const planes=pt===3?3:2;
    for(let plane=0;plane<planes;plane++){
      const a=sd*2.399+plane*Math.PI/planes,tilt=pt===3?0.32:0.65;
      const right=new THREE.Vector3(Math.cos(a),0,Math.sin(a));
      const up=new THREE.Vector3(-Math.sin(a)*tilt,1,Math.cos(a)*tilt).normalize();
      const normal=new THREE.Vector3().crossVectors(right,up).normalize();
      const asp=pt===3?0.54:0.83;
      for(const [x,y] of [[-1,-1],[1,-1],[1,1],[-1,-1],[1,1],[-1,1]]){
        const p=new THREE.Vector3(...c).addScaledVector(right,x*r).addScaledVector(up,y*r*asp);
        pos.push(p.x,p.y,p.z);nor.push(normal.x,normal.y,normal.z);part.push(pt);corner.push(x,y);
        cprop.push(c[0],c[1],c[2],r);seed.push(sd+plane*0.37);
      }
    }
  };
  const done=()=>{const geo=new THREE.InstancedBufferGeometry();
    geo.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));geo.setAttribute('normal',new THREE.Float32BufferAttribute(nor,3));
    geo.setAttribute('part',new THREE.Float32BufferAttribute(part,1));geo.setAttribute('corner',new THREE.Float32BufferAttribute(corner,2));
    geo.setAttribute('cprop',new THREE.Float32BufferAttribute(cprop,4));geo.setAttribute('cseed',new THREE.Float32BufferAttribute(seed,1));return geo;};
  return {push,spray,done};}
/* Limb endpoints share their exact positions with the next branch segment. */
function branch(B,a,b,r0,r1){const delta=new THREE.Vector3().subVectors(b,a);
  const g=new THREE.CylinderGeometry(r1,r0,delta.length(),5,1,true);
  g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0),delta.clone().normalize()));
  g.translate((a.x+b.x)/2,(a.y+b.y)/2,(a.z+b.z)/2);B.push(g,0,[0,0,0],0,0);}
function cherryTree(){const B=treeBuilder();let k=0;
  const root=new THREE.Vector3(0,0,0),fork=new THREE.Vector3(0.28,4.0,-0.15);
  branch(B,root,new THREE.Vector3(0.10,2.0,0.12),0.72,0.56);
  branch(B,new THREE.Vector3(0.10,2.0,0.12),fork,0.56,0.38);
  for(let i=0;i<6;i++){
    const a=i*2.399+0.28*rnd(i,2),reach=3.4+rnd(i,4)*2.0;
    const elbow=new THREE.Vector3(Math.cos(a)*reach,5.5+rnd(i,5)*2.0,Math.sin(a)*reach);
    branch(B,fork,elbow,0.25+rnd(i,1)*0.07,0.12);
    for(let j=0;j<3;j++){
      const az=a+(j-1)*0.78,dist=2.0+rnd(i,j+10)*1.6;
      const tip=elbow.clone().add(new THREE.Vector3(Math.cos(az)*dist,0.5+rnd(i,j+20)*4.4,Math.sin(az)*dist));
      branch(B,elbow,tip,0.105,0.032);
      const inner=elbow.clone().lerp(tip,0.55);B.spray([inner.x,inner.y,inner.z],1.8,k++,2);
      for(let q=0;q<3;q++){
        const ang=az+(q-1)*1.0,len=1.1+rnd(i,j*3+q+30)*1.2;
        const twig=tip.clone().add(new THREE.Vector3(Math.cos(ang)*len,0.4+rnd(i,q+j+40)*1.1,Math.sin(ang)*len));
        branch(B,tip,twig,0.035,0.008);
        const size=1.8+rnd(i,j*3+q+60)*1.05;
        B.spray([twig.x,twig.y,twig.z],size,k++,2);
        const mid=tip.clone().lerp(twig,0.35);
        B.spray([mid.x,mid.y,mid.z],size*0.82,k++,2);
      }
    }
  }
  /* A few higher shoots break the umbrella outline without filling every gap. */
  for(let i=0;i<3;i++){
    const tip=new THREE.Vector3((rnd(i,91)-0.5)*4,10.6+rnd(i,92)*2,(rnd(i,93)-0.5)*4);
    branch(B,fork,tip,0.12,0.02);B.spray([tip.x,tip.y,tip.z],2.1,k++,2);
  }
  return B.done();}
function pineTree(){const B=treeBuilder();let k=0;
  branch(B,new THREE.Vector3(0,0,0),new THREE.Vector3(0.22,25,0.12),0.55,0.045);
  for(let level=0;level<9;level++){
    const f=level/8,y=3.6+level*2.35,rad=(1-f)*5.0+0.6;
    const count=level>6?4:5;
    for(let i=0;i<count;i++){
      const a=i/count*Math.PI*2+level*2.399+rnd(level,i)*0.5;
      const len=rad*(0.78+rnd(level,i+7)*0.38);
      const base=new THREE.Vector3(0.22*y/25,y+(rnd(level,i+12)-0.5)*0.7,0.12*y/25);
      const tip=base.clone().add(new THREE.Vector3(Math.cos(a)*len,-0.25-len*0.12,Math.sin(a)*len));
      branch(B,base,tip,0.11*(1-f)+0.025,0.01);
      for(let q=0;q<3;q++){
        const at=base.clone().lerp(tip,0.35+q*0.28);
        const r=(len*(0.57-q*0.09)+0.35)*(0.88+rnd(level,q+i+20)*0.22);
        B.spray([at.x,at.y,at.z],r,k++,3);
      }
    }
  }
  for(const [y,r] of [[23.2,1.1],[24.2,0.8],[25.0,0.4]])B.spray([0.22,y,0.12],r,k++,3);
  return B.done();}
const cherryGeo=cherryTree(),pineGeo=pineTree();
/* Keep grove positions unchanged; per-instance proportions vary the silhouettes. */
function plant(geo,n,seed,dxMin,dxMax,thr){const off=[],sc=[],rot=[],tint=[];
  for(let i=0;i<n*4&&off.length<n*2;i++){const zn=hash(i,seed)*TD,side=hash(i,seed+7)<0.5?-1:1;
    if(vnoise(zn*0.0035+seed,side*3.3)<thr)continue;
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
  varying vec3 vN,vL,vW,vCrown,vCluster;varying vec2 vC;varying float vF,vPart,vTint,vSeed,vCavity;${FOG}${GNOISE}${HFN}
  void main(){float TDc=${TD}.0;
    float lz=mod(aOff.y-uScroll+TDc*0.5,TDc)-TDc*0.5,qz=lz+uScroll;
    float x=riverC(qz)+aOff.x,h=height(vec2(x,qz));
    float e=6.0,slope=abs(height(vec2(x+e,qz))-h)+abs(height(vec2(x,qz+e))-h);
    float hi=uKind<0.5?70.0:140.0,lo=uKind<0.5?1.5:30.0;
    float ok=step(lo,h)*(1.0-smoothstep(hi-20.0,hi,h))*(1.0-smoothstep(9.0,14.0,slope));
    float s=aScale*ok,c=cos(aRot),sn=sin(aRot);
    vec3 proportions=vec3(0.80+aTint*0.38,0.90+fract(aTint*7.3)*0.20,0.90+fract(aTint*3.1)*0.23);
    vec3 p=position*proportions;
    /* The same crown lean affects wood and leaves, so branches stay connected. */
    p.x+=(aTint-0.5)*max(p.y-3.0,0.0)*0.14;
    float gust=0.65+0.35*sin(uT*0.23+aOff.y*0.0017);
    float wind=sin(uT*0.85+aOff.y*0.011)*gust;
    vec3 r=vec3(c*p.x-sn*p.z,p.y,sn*p.x+c*p.z)*s;
    r.x+=wind*0.016*max(r.y,0.0);r.z+=wind*0.006*max(r.y,0.0);
    if(part>1.5)r+=normal*sin(uT*1.6+cseed*1.8)*0.045*s;
    vec3 nn=normalize(normal/proportions);vN=vec3(c*nn.x-sn*nn.z,nn.y,sn*nn.x+c*nn.z);
    vec3 cn=uKind<0.5?vec3(cprop.x/7.5,(cprop.y-7.0)/4.0,cprop.z/7.5):vec3(cprop.x/5.0,0.45,cprop.z/5.0);
    vCavity=uKind<0.5?clamp(length(cn)*0.65,0.30,1.0):clamp(length(cn.xz)*0.65+0.3,0.3,1.0);
    cn=normalize(cn+vec3(0.0,0.10,0.0));vCrown=vec3(c*cn.x-sn*cn.z,cn.y,sn*cn.x+c*cn.z);
    vec3 cluster=(position-cprop.xyz)/max(cprop.w,0.1);
    vCluster=vec3(c*cluster.x-sn*cluster.z,cluster.y,sn*cluster.x+c*cluster.z);
    vPart=part;vTint=aTint;vSeed=cseed;vL=position;vC=corner;
    vec4 wp=modelMatrix*vec4(x+r.x,h-0.35*s+r.y,lz+r.z,1.0);vec4 mv=viewMatrix*wp;vW=wp.xyz;
    vF=fogOf(-mv.z,${FOGK});gl_Position=projectionMatrix*mv;}`;
const TREE_FS=`uniform vec3 uZen,uHor,uValley,uSun,uSunDir;uniform float uEl,uNight,uKind;
  varying vec3 vN,vL,vW,vCrown,vCluster;varying vec2 vC;varying float vF,vPart,vTint,vSeed,vCavity;${GNOISE}${LAMPF}
  void main(){
    vec3 L=normalize(vec3(uSunDir.x,max(uSunDir.y,0.12),uSunDir.z)),Lm=normalize(vec3(-uSunDir.x*0.9,0.45,-0.6));
    float dayK=smoothstep(-0.20,0.05,uEl);vec3 keyC=mix(vec3(0.66,0.74,0.92),mix(vec3(0.95,0.97,1.0),uSun,0.22),dayK);
    vec3 n=normalize(vN)*(gl_FrontFacing?1.0:-1.0),alb;float ao=1.0,trans=0.0;
    vec3 V=normalize(cameraPosition-vW);
    if(vPart>1.5){
      float rr=length(vC);if(rr>1.12)discard;
      float lobes=vn2(vC*3.4+vSeed*5.1);
      float edge=rr+(lobes-0.5)*0.36;
      float cover=1.0-smoothstep(0.55,1.0,edge);
      float leaf=vn2(vC*18.0+vSeed*7.3);
      /* Dense interiors and broken edges, rather than uniform screen-door noise.
         Small leaves merge with distance to avoid glittering pinholes. */
      float fine=1.0-smoothstep(0.18,0.65,length(fwidth(vC*18.0)));
      float holes=mix(0.70,0.35+0.65*smoothstep(0.22,0.62,leaf),fine);
      if(cover*holes<0.30)discard;
      vec3 crown=normalize(vCrown);
      n=normalize(crown*0.50+normalize(vCluster+n*0.7)*0.50);
      if(vPart>2.5){
        float needles=vn2(vec2(vC.x*31.0+vC.y*12.0,vC.y*7.0)+vSeed);
        alb=mix(vec3(0.065,0.13,0.08),vec3(0.19,0.285,0.135),clamp(lobes*0.55+vTint*0.25+needles*0.20,0.0,1.0));
        ao=(0.48+0.38*vCavity)*(0.82+0.18*lobes);
        trans=pow(max(dot(-V,L),0.0),2.0)*0.12*dayK;
      }else{
        vec3 blush=mix(vec3(0.68,0.40,0.45),vec3(0.89,0.67,0.68),vTint);
        alb=mix(blush,vec3(0.94,0.85,0.80),smoothstep(0.20,0.88,leaf*0.6+lobes*0.4));
        /* Occasional young leaves break up a single solid pink canopy. */
        float green=smoothstep(0.77,0.88,vn2(vC*8.0+vSeed*2.0))*0.55;
        alb=mix(alb,vec3(0.25,0.31,0.16),green);
        ao=(0.48+0.40*vCavity)*(0.76+0.24*lobes);
        trans=pow(max(dot(-V,L),0.0),2.0)*0.24*dayK;
      }
    }else{
      float bark=vn2(vec2(atan(vL.z,vL.x)*9.0,vL.y*0.65));
      float grain=vn2(vL.xz*15.0+vL.y*0.2);
      alb=mix(vec3(0.14,0.12,0.105),vec3(0.32,0.275,0.225),bark)*(0.85+grain*0.2);
      ao=0.78+0.22*smoothstep(0.0,4.0,vL.y);
    }
    float wrap=vPart>1.5?0.45:0.0;
    float diff=max((dot(n,L)+wrap)/(1.0+wrap),0.0)*dayK+max((dot(n,Lm)+wrap)/(1.0+wrap),0.0)*(1.0-dayK);
    vec3 amb=mix(uValley*1.1,mix(uHor,uZen,0.5)*1.3,n.y*0.5+0.5);
    amb=mix(amb,vec3(dot(amb,vec3(0.299,0.587,0.114))),dayK*0.80);
    vec3 col=alb*(amb*(0.65+0.20*dayK)*ao+keyC*diff*(0.65+0.26*dayK)*mix(0.7,1.0,ao))*mix(1.20,1.28,dayK);
    col+=alb*keyC*trans;
    col+=alb*vec3(1.0,0.94,0.86)*cameraFill(vW,n,uEl)*0.70;
    col+=alb*vec3(0.045,0.085,0.08)*uNight*(0.4+0.6*max(n.y,0.0));
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
