import * as T from 'three';

const vertexShader = `
out vec2 ndc;
void main() {
  ndc = position.xy;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}`;

const atmosphereShader = `
precision highp float;
precision mediump sampler3D;
in vec2 ndc;
out vec4 color;
uniform mat4 invProjection, cameraTransform;
uniform sampler3D noiseTex;
uniform sampler2D stormAtlas;
const vec3 boxMin=vec3(-16.,-14.,0.);
const vec3 boxMax=vec3(40.,27.,18.);
const vec2 atlasTile=vec2(128.,96.);
const vec2 atlasGrid=vec2(8.,6.);
const float atlasDepth=48.;
uniform vec4 phase, tornado, appearance, evolution;
uniform vec3 options, sun, sunlight, skyZenith, skyHorizon, shade;
uniform vec4 flanks;
uniform vec2 clipPlane;
uniform float atlasAge;
uniform int environment, morphology, shadowSteps;
uniform sampler2D overlayColor, overlayDepth;
uniform bool overlayEnabled;

vec3 displayRGB(vec3 linear) {
  return mix(linear*12.92,1.055*pow(max(linear,0.),vec3(1./2.4))-.055,step(vec3(.0031308),linear));
}
void compositeLayer(vec4 layer,inout vec3 accum,inout float trans) {
  accum+=trans*layer.a*displayRGB(layer.rgb/max(.0001,layer.a));
  trans*=1.-layer.a;
}

// ENU coordinates and all distances in this shader are in kilometers.
vec3 enu(vec3 p) { return vec3(p.x, -p.z, p.y); }
float tex(vec3 q) {
  vec3 cell=floor(q), f=fract(q);
  return texture(noiseTex,(cell+f*f*(3.-2.*f)+.5)/32.).r;
}
float lobe(vec3 p, vec3 c, vec3 r) {
  return (1.-length((p-c)/r))*min(r.x,min(r.y,r.z));
}
float blend(float a,float b,float k) {
  return max(a,b)+pow(max(k-abs(a-b),0.)/k,2.)*k*.25;
}
vec2 interval(vec3 o, vec3 d, vec3 lower, vec3 upper) {
  vec3 safe=mix(d,vec3(1.e-6),lessThan(abs(d),vec3(1.e-6)));
  vec3 a=(lower-o)/safe,b=(upper-o)/safe;
  vec3 lo=min(a,b),hi=max(a,b);
  return vec2(max(max(lo.x,lo.y),lo.z),min(min(hi.x,hi.y),hi.z));
}

float cloudShape(vec3 p) {
  float top=phase.y, growth=phase.x;
  float cycle=evolution.x*.0091;
  float feederPulse=.5+.5*sin(cycle+.54);
  float risingPulse=.5+.5*sin(cycle-1.83);
  float upperPulse=.5+.5*sin(cycle-3.53);
  float base=1.24+.16*clamp(p.x*.17,-1.,1.)+.10*sin(p.y*.72);
  float h=max(0.,p.z-base);
  vec2 axis=h*vec2(.27,.22)+vec2(.36*sin(h*.63),.42*sin(h*.48));
  vec3 q=vec3(p.xy-axis,p.z);
  float main=lobe(q,vec3(-.15,.0,(base+top)*.5),vec3(1.1+2.55*growth,.92+2.82*growth,max(.22,(top-base)*.56)));
  float front=lobe(q,vec3(1.00,1.55,top*.61),vec3(2.85,2.20,max(.25,top*.33)))-2.3*(1.-growth);
  float feeder=lobe(q,vec3(.58+.32*feederPulse,-1.55-.31*feederPulse,base+top*(.145+.052*feederPulse)),vec3(2.35,2.15,max(.22,top*.23)))-1.18*(1.-growth);
  float rising=lobe(q,vec3(-.75-.42*risingPulse,-.54-.36*risingPulse,top*(.726+.091*risingPulse)),vec3(2.35,2.05,max(.24,top*.246)))-1.75*(1.-growth);
  float lowerTurret=lobe(q,vec3(-1.94,.42,base+top*.23),vec3(2.51,2.33,max(.25,top*.227)))-1.93*(1.-growth);
  float tallTurret=lobe(q,vec3(1.07+.38*upperPulse,-.67-.31*upperPulse,top*(.795+.075*upperPulse)),vec3(2.44,1.99,max(.25,top*.202)))-2.19*(1.-growth);
  float tower=blend(blend(main,front,.8),blend(feeder,rising,.80),.67);
  tower=min(blend(tower,max(lowerTurret,tallTurret),.66),(p.z-base)*1.75);
  vec2 shear=vec2(.855,.519), across=vec2(-shear.y,shear.x);
  vec3 a=vec3(dot(p.xy,shear),dot(p.xy,across),p.z);
  float stream=clamp((a.x-3.)/28.,0.,1.);
  float shield=top-.94-.88*stream+.060*a.y;
  float anvil=lobe(a,vec3(14.0,1.18,shield),vec3(17.8,7.75,.79+1.13*(1.-stream)))-3.05*(1.-growth);
  anvil-=.92*smoothstep(26.,36.,a.x);
  float back=lobe(a,vec3(-.80,-.35,top-.58),vec3(5.45,4.1,1.23))-3.05*(1.-growth);
  float dome=lobe(q,vec3(-.65,-.33,top+.48),vec3(2.00,2.03,1.98))-3.1*(1.-growth);
  float skirt=lobe(p,vec3(flanks.xy+vec2(-2.65,-.95),5.93),vec3(7.55,4.49,3.61))-3.3*(1.-phase.w);
  skirt=min(skirt,p.z-(2.85+.32*sin(p.x*.71)));
  float shoulder=lobe(p,vec3(6.85,3.9,top*.65),vec3(5.4,3.39,3.73))-3.6*(1.-growth);
  skirt=blend(skirt,shoulder,.94);
  float outflowShelf=lobe(p,vec3(7.3,5.2,2.85),vec3(7.75,3.2,.82))-1.37*(1.-phase.w);
  skirt=blend(skirt,outflowShelf,.49);
  vec2 wallShift=vec2(sin(cycle*1.93),cos(cycle*1.93))*.16*appearance.w;
  float wall=lobe(p,vec3(tornado.xy+vec2(.20,.26)+wallShift,1.12-.20*appearance.w),
    vec3(1.50+.16*feederPulse,1.24,.51+.05*risingPulse))-.69*(1.-appearance.w);
  float band=lobe(p,vec3(3.45,-2.0,1.26),vec3(3.82,.85,.27))-.82*(1.-appearance.w);
  float fragments=lobe(p,vec3(3.18,-1.68,.88),vec3(1.78,.69,.16))-.50*(1.-appearance.w);
  band=max(band,fragments-.10);
  float storm=blend(blend(tower,skirt,1.22),blend(blend(anvil,back,.75),dome,.70),1.12);
  vec2 cut=(p.xy-flanks.zw-vec2(.65,-1.35))/vec2(2.70,1.45);
  float slot=exp(-dot(cut,cut))*phase.w*(1.-smoothstep(1.4,3.35,p.z));
  return blend(storm-slot*(.28+.92*tornado.w),max(wall,band),.34);
}

float cloudDensity(vec3 p,float shape) {
  float top=phase.y;
  if(shape < -1.45 || p.z<.55) return 0.;
  float height=clamp(p.z/top,0.,1.);
  vec3 advected=p-evolution.x*vec3(mix(-.021,.044,height),.027,mix(.012,.062,height));
  // Bound advection vertically at the tropopause where ascent turns into outflow.
  advected.z+=evolution.x*.052*smoothstep(.70,1.04,height);
  vec3 warp=vec3(tex(advected*.49),tex(advected*.49+vec3(7.3,1.2,12.)),
    tex(advected*.54+vec3(1.8,13.,5.1)))-.50;
  vec3 q=advected+warp*1.65;
  float coarse=tex(q*1.12);
  float billows=.57*tex(q*2.38+vec3(5.2,9.1,.41))+.43*coarse;
  float edge=shape+(coarse-.48)*1.20+(billows-.51)*.64+.05;
  if(edge>-.51 && edge<1.5) {
    edge+=(tex(q*5.6)-.52)*.31+(tex(q*13.2)-.54)*.15;
  }
  // Leave the underside of the tower at the lifting condensation level.
  edge=min(edge,(p.z-.58)*1.65);
  return phase.z*2.08*smoothstep(-.25,.63,edge);
}
float sunTransmission(vec3 p,float cloud) {
  float tau=.22*cloud;
  for(int k=0;k<4;k++){
    if(k>=shadowSteps) break;
    float distanceToSun=.47+.76*float(k)+.34*float(k*k);
    vec3 samplePoint=p+sun*distanceToSun;
    float envelope=cloudShape(samplePoint);
    float cover=smoothstep(-.30,.87,envelope+(tex(samplePoint*.94-evolution.x*.027)-.5)*.92);
    tau+=cover*phase.z*(1.25+1.10*float(k));
    if(tau>5.20) break;
  }
  return exp(-tau);
}

`;

const atlasShader = atmosphereShader + `
void main() {
  vec2 tile=floor(gl_FragCoord.xy/atlasTile);
  float layer=tile.y*atlasGrid.x+tile.x;
  vec2 xy=(mod(gl_FragCoord.xy,atlasTile)-.5)/(atlasTile-1.);
  vec3 p=mix(boxMin,boxMax,vec3(xy,layer/(atlasDepth-1.)));
  float shape=cloudShape(p);
  float density=cloudDensity(p,shape);
  float shadow=density>.003 ? sunTransmission(p,density) : 0.;
  color=vec4(density*.40,shadow,clamp(-shape*.18,0.,1.),1.);
}
`;

const fragmentShader = atmosphereShader + `
vec3 atlasLayer(vec2 xy,float layer) {
  vec2 tile=vec2(mod(layer,atlasGrid.x),floor(layer/atlasGrid.x));
  vec2 texel=tile*atlasTile+xy*(atlasTile-1.)+.5;
  return texture(stormAtlas,texel/(atlasTile*atlasGrid)).rgb;
}
vec3 lookupCloud(vec3 p) {
  float h=clamp(p.z/phase.y,0.,1.);
  vec3 drift=vec3(mix(-.021,.044,h),.027,mix(.012,.062,h)-.052*smoothstep(.70,1.04,h));
  vec3 q=(p-drift*atlasAge-boxMin)/(boxMax-boxMin);
  if(any(lessThan(q,vec3(0.))) || any(greaterThan(q,vec3(1.)))) return vec3(0.,0.,1.);
  float layer=q.z*(atlasDepth-1.);
  return mix(atlasLayer(q.xy,floor(layer)),atlasLayer(q.xy,min(atlasDepth-1.,floor(layer)+1.)),fract(layer));
}

vec2 vortexCenter(float z) {
  float rope=evolution.z;
  return tornado.xy+vec2(.075,.05)*z
    +rope*z*vec2(.16*sin(2.1*z+.60),.13*sin(2.8*z+.28));
}
vec2 vortexDensity(vec3 p) {
  float z=p.z;
  vec2 q=p.xy-vortexCenter(z);
  float r=length(q);
  float angle=atan(q.y,q.x);
  float spin=tornado.z/(1.+1.6*r);
  float a=angle-spin;
  float rz=clamp(z/1.36,0.,1.);
  float rope=evolution.z;
  float radius=(.067+.068*clamp(evolution.w,.10,.30)+.29*pow(rz,2.45))*mix(1.,.40,rope);
  if(morphology==1) radius=mix(.082,.39,rz);
  if(morphology==2) radius=.123+.24*pow(rz,4.7);
  if(morphology==3) radius=.205+.27*pow(rz,1.65);
  if(morphology==4) radius=.036+.28*pow(rz,4.6);
  vec3 wrapped=vec3(cos(a)*r,sin(a)*r,z);
  float layers=tex(wrapped*vec3(25.,25.,13.)+vec3(0.,0.,-evolution.x*.87));
  float filaments=tex(wrapped*vec3(85.,85.,49.)+vec3(6.,0.,-evolution.x*1.9));
  float helix=sin(a*3.+23.*z+3.8*layers);
  radius*=.94+.30*(layers-.4)+.095*helix+.13*(filaments-.5);
  float bottom=(1.-smoothstep(.03,.94,appearance.x))*1.18;
  float topMask=1.-smoothstep(1.45,1.76,z);
  float funnel=appearance.x*27.*(1.-smoothstep(radius*.52,radius*1.21,r))
    *smoothstep(bottom-.023,bottom+.12,z)*topMask*(.60+.57*layers+.33*filaments);
  float spread=.19+.48*z+.19*(1.-evolution.y);
  float dustBand=.54+.39*sin(a*2.+22.*z+6.*layers-r*11.);
  float rim=1.-smoothstep(.13, .49, abs(r/spread-(.7+.22*layers)));
  float dust=appearance.y*9.9*(1.-smoothstep(spread*.40,spread*1.78,r))*(.47+.53*rim)
    *(1.-smoothstep(.012,.27+.13*layers,z))*dustBand*(.33+layers+.62*filaments);
  return vec2(funnel,dust);
}
bool visibleAt(float z) {
  return clipPlane.y==0. || (clipPlane.y>0. ? z<=clipPlane.x : z>=clipPlane.x);
}
vec3 terrain(vec2 p,float distanceToEye) {
  vec2 q=vec2(dot(p,vec2(.92,.392)),dot(p,vec2(-.392,.92)));
  vec2 parcel=q*vec2(1.1,1.4);
  vec2 cell=floor(parcel), f=fract(parcel);
  float parcelTone=tex(vec3(cell*.79,9.14));
  float regional=tex(vec3(p*.17,1.31));
  float farming=smoothstep(.30,.54,regional);
  vec3 grass=mix(vec3(.225,.274,.155),vec3(.355,.404,.214),tex(vec3(p*3.2,1.52)));
  vec3 crop=mix(vec3(.288,.355,.170),vec3(.528,.479,.239),smoothstep(.24,.85,parcelTone));
  float rows=sin((parcelTone>.46?q.x:q.y)*510.);
  crop*=1.+.085*rows*exp(-distanceToEye*1.4);
  vec3 soil=mix(grass,crop,farming*.83);
  float road=1.-smoothstep(.007,.010+distanceToEye*.00018,abs(q.y-1.75-.038*sin(q.x*.72)));
  float minor=1.-smoothstep(.003,.007+distanceToEye*.00012,abs(q.x-3.05));
  float margin=1.-smoothstep(.008,.033,min(min(f.x,1.-f.x),min(f.y,1.-f.y)));
  float trees=smoothstep(.50,.74,tex(vec3(p*71.,7.)))*margin*exp(-distanceToEye*.12);
  soil=mix(soil,vec3(.16,.234,.116),trees*.80);
  soil=mix(soil,vec3(.39,.374,.313),max(road,minor)*exp(-distanceToEye*.023));
  soil*=.82+.36*tex(vec3(p*138.,8.76))*exp(-distanceToEye*.65);
  if(appearance.z>0. && phase.z>.01) {
    float cover=0.;
    for(int i=0;i<4;i++){
      float h=2.35+float(i)*3.27;
      vec3 shadowPoint=vec3(p+sun.xy*h/max(sun.z,.26),h);
      cover+=smoothstep(.04,.65,lookupCloud(shadowPoint).r);
    }
    soil*=mix(1.,.48,clamp(cover*.49*appearance.z*phase.z,0.,1.));
  }
  vec2 grid=abs(fract(p/5.+.5)-.5)*5.;
  if(options.y>.5) soil=mix(soil,vec3(.45,.68,.67),
    (1.-smoothstep(.01,.036+distanceToEye*.0012,min(grid.x,grid.y)))*.55/(1.+distanceToEye*.034));
  return soil;
}

void main() {
  vec3 o=enu(cameraTransform[3].xyz);
  vec4 view=invProjection*vec4(ndc,1.,1.);
  vec3 d=normalize(enu((cameraTransform*vec4(view.xyz/view.w,0.)).xyz));
  float groundT=d.z<-.00001 ? -o.z/d.z : 1000.;
  float glare=max(0.,dot(d,sun));
  vec3 horizon=skyHorizon+sunlight*.072*pow(glare,6.);
  vec3 bg=mix(horizon,skyZenith,pow(max(d.z,0.),.45));
  bg+=sunlight*(.11*pow(glare,32.)+.25*pow(glare,160.));
  if(groundT<525. && visibleAt(0.)) {
    vec3 land=terrain(o.xy+d.xy*groundT,groundT);
    bg=mix(land,horizon,1.-exp(-groundT*(.013+.006*exp(-o.z*.41))));
  }
  vec2 range=interval(o,d,boxMin,boxMax);
  vec2 funnelBox=interval(o,d,vec3(tornado.xy-vec2(.87),0.),vec3(tornado.xy+vec2(.87),1.80));
  bool cloudOn=appearance.z>.001 && phase.z>.001;
  bool vortexOn=(appearance.x>.002 || appearance.y>.002) && funnelBox.x<funnelBox.y;
  bool rainOn=options.z>0. && phase.w>.01;
  float end=cloudOn || rainOn || vortexOn ? min(range.y,groundT) : 0.;
  float t=max(range.x,0.);
  float trans=1.;
  vec3 accum=vec3(0.);
  vec4 layer=vec4(0.);
  float layerT=1.e5;
  if(overlayEnabled) {
    vec2 uv=ndc*.5+.5;
    layer=texture(overlayColor,uv);
    if(layer.a>.001){
      float depth=texture(overlayDepth,uv).r;
      vec4 pos=invProjection*vec4(ndc,depth*2.-1.,1.);
      layerT=length(pos.xyz/pos.w);
      if(layerT>groundT+.003) layerT=1.e5;
    }
  }
  float mu=dot(d,sun);
  float forward=.77+.27*pow(max(mu,0.),4.);
  float jitter=fract(52.9829189*fract(dot(gl_FragCoord.xy,vec2(.06711056,.00583715))));
  // The 72 km box diagonal needs at most 300 Ultra steps. The 3.05 km
  // vortex box needs at most another 436, even if every step is 7 m.
  for(int i=0;i<768;i++){
    if(t>=end || trans<.014) break;
    if(layerT<=t+.0001){
      compositeLayer(layer,accum,trans);
      layerT=1.e5;
    }
    vec3 start=o+d*t;
    float gapToCloud=cloudOn ? lookupCloud(start).b*5.55 : 3.;
    float dt=clamp(gapToCloud*.64,options.x,rainOn && start.z<9. ? 1.65 : 2.8);
    // Subdivide the compact vortex separately. At 30 m the step is about 7 m.
    if(vortexOn && t<funnelBox.y && t+dt>funnelBox.x) {
      if(t<funnelBox.x-.0001) dt=funnelBox.x-t;
      else {
        float gap=length(start.xy-vortexCenter(start.z))-(.19+.31*pow(clamp(start.z/1.46,0.,1.),1.9));
        if(appearance.y>.002 && start.z<.42) gap=min(gap,length(start.xy-tornado.xy)-.65);
        dt=min(max(clamp(.007+t*.013,.007,.047),gap*.65),funnelBox.y-t);
      }
    }
    dt=min(min(end-t,layerT-t),max(dt,.001));
    float jitterAmount=smoothstep(.015,.23,dt)*.65;
    vec3 p=start+d*dt*mix(.50,jitter,jitterAmount);
    float distanceToEye=t+dt*.5;
    t+=dt;
    if(!visibleAt(p.z)) continue;
    float cloud=0.,rain=0.;
    vec3 light=shade;
    if(cloudOn && gapToCloud<2.4) {
      vec3 vapor=lookupCloud(p);
      cloud=appearance.z*vapor.r*2.5;
      float edge=smoothstep(.01,.35,cloud)*(1.-smoothstep(.64,1.8,cloud));
      float fine=0.;
      if(edge>.02 && distanceToEye<20.) {
        fine=(tex(p*vec3(6.,6.,8.)-evolution.x*vec3(-.084,.117,.21))-.50)
          *edge*(1.-smoothstep(6.,20.,distanceToEye));
        cloud*=1.+fine*.92;
      }
      if(cloud>.001) {
        float sunT=pow(clamp(vapor.g+.30*fine,.012,1.),appearance.z);
        float upper=smoothstep(1.05,9.7,p.z);
        float scatter=.15*(1.-exp(-cloud*1.7))*mix(.58,1.08,upper);
        light=shade*(.72+.52*upper)+sunlight*(forward*(.77+.10*upper)*sunT+scatter);
        light=mix(light,max(light,vec3(.29,.36,.42)),float(environment==3)*.34);
      }
    }
    if(rainOn && p.z<8.2){
      float flank=lobe(p,vec3(flanks.xy+vec2(.14,.15)*p.z,2.95),vec3(6.5,4.2,5.27));
      vec2 q=p.xy-flanks.zw-vec2(-.12,.08)*p.z;
      float rear=lobe(p,vec3(flanks.zw+vec2(-.12,.08)*p.z,1.62),vec3(2.57,1.64,3.60));
      vec2 hook=p.xy-tornado.xy;
      float wrap=.65-abs(length(hook*vec2(.83,1.))-2.15);
      wrap=min(wrap,min(-hook.y+.32,4.2-p.z))-.95*(1.-tornado.w);
      float slot=exp(-dot(q-vec2(.87,-1.0),q-vec2(.87,-1.0))*.85);
      float mask=max(flank,max(rear-slot*.92,wrap));
      if(mask>-.40) {
        vec2 shaft=p.xy-p.z*vec2(.21,.14)-evolution.x*vec2(.021,.016);
        float bands=.58*tex(vec3(shaft*vec2(3.1,2.2),p.z*.12))+.42*tex(vec3(shaft*8.1,p.z*.22));
        rain=.64*options.z*phase.w*smoothstep(-.27,1.25,mask)*(.36+1.20*bands*bands)
          *(1.-smoothstep(6.6,8.2,p.z));
      }
    }
    vec2 vortex=vec2(0.);
    vec3 funnelLight=shade;
    if(vortexOn && p.z<1.80 && length(p.xy-tornado.xy)<.87){
      vortex=vortexDensity(p);
      if(vortex.x>.001) {
        float direct=exp(-.052*vortexDensity(p+sun*.045).x-.048*vortexDensity(p+sun*.115).x);
        vec3 q=vec3(p.xy-vortexCenter(p.z),0.);
        float side=.52+.48*clamp(dot(normalize(q+vec3(.00001)),sun)+.32,0.,1.);
        float underWall=appearance.z*appearance.w*smoothstep(.64,1.48,p.z);
        funnelLight=shade*1.04+sunlight*(.10+.49*direct)*side*(1.-.70*underWall);
      }
    }
    float den=cloud+rain+vortex.x+vortex.y;
    if(den>.0001) {
      vec3 rainLight=mix(shade,skyHorizon,.49)*mix(.77,1.10,smoothstep(0.,7.,p.z));
      vec3 dustLight=mix(vec3(.209,.158,.111),vec3(.51,.395,.276),sun.z);
      dustLight*=.74+.38*smoothstep(.0,.30,p.z);
      vec3 lit=(cloud*light+rain*rainLight+vortex.x*funnelLight+vortex.y*dustLight)/den;
      lit=mix(lit,horizon,1.-exp(-distanceToEye*(.005+.003*exp(-p.z*.41))));
      float alpha=1.-exp(-den*dt);
      accum+=trans*alpha*lit;
      trans*=1.-alpha;
    }
  }
  if(layerT<1.e5 && trans>.014) compositeLayer(layer,accum,trans);
  color=vec4(accum+bg*trans,1.);
}`;

export const lighting = {
  afternoon: [[-.40,-.69,.62],[1.00,.96,.87],[.20,.40,.64],[.58,.69,.75],[.195,.233,.281],0],
  evening: [[-.82,-.54,.18],[1.0,.72,.47],[.28,.42,.64],[.76,.65,.54],[.235,.251,.34],1],
  overcast: [[-.39,-.54,.75],[.50,.57,.63],[.35,.44,.54],[.60,.66,.70],[.248,.29,.35],2],
  scientific: [[-.49,-.51,.70],[.81,.88,.97],[.20,.29,.40],[.40,.47,.53],[.26,.32,.38],3],
};
export const morphologies = ['Lifecycle shape', 'Cone', 'Stovepipe', 'Wedge', 'Rope'];

export function createVolume(renderer) {
  const size = 32;
  const data = new Uint8Array(size ** 3);
  let seed = 129031;
  for (let i = 0; i < data.length; i++) {
    seed = (Math.imul(1664525, seed) + 1013904223) >>> 0;
    data[i] = seed >>> 24;
  }
  const noiseTex = new T.Data3DTexture(data, size, size, size);
  noiseTex.format = T.RedFormat;
  noiseTex.minFilter = noiseTex.magFilter = T.LinearFilter;
  noiseTex.wrapS = noiseTex.wrapT = noiseTex.wrapR = T.RepeatWrapping;
  noiseTex.needsUpdate = true;
  const uniforms = {
    invProjection: { value: new T.Matrix4() }, cameraTransform: { value: new T.Matrix4() },
    noiseTex: { value: noiseTex }, phase: { value: new T.Vector4() },
    tornado: { value: new T.Vector4() }, appearance: { value: new T.Vector4() },
    evolution: { value: new T.Vector4() }, flanks: { value: new T.Vector4() },
    sun: { value: new T.Vector3() }, sunlight: { value: new T.Vector3() },
    skyZenith: { value: new T.Vector3() }, skyHorizon: { value: new T.Vector3() },
    shade: { value: new T.Vector3() }, environment: { value: 0 },
    morphology: { value: 0 }, shadowSteps: { value: 2 },
    stormAtlas: { value: null }, atlasAge: { value: 0 },
    overlayColor: { value: null }, overlayDepth: { value: null }, overlayEnabled: { value: false },
    options: { value: new T.Vector3() }, clipPlane: { value: new T.Vector2() },
  };
  const material = new T.ShaderMaterial({
    vertexShader, fragmentShader, uniforms, glslVersion: T.GLSL3, depthTest: false, depthWrite: false,
  });
  const atlas = new T.WebGLRenderTarget(1024, 576, {
    minFilter: T.LinearFilter, magFilter: T.LinearFilter, depthBuffer: false,
  });
  uniforms.stormAtlas.value = atlas.texture;
  const atlasMaterial = new T.ShaderMaterial({
    vertexShader, fragmentShader: atlasShader, uniforms, glslVersion: T.GLSL3, depthTest: false, depthWrite: false,
  });
  const atlasScene = new T.Scene();
  const atlasQuad = new T.Mesh(new T.PlaneGeometry(2, 2), atlasMaterial);
  atlasQuad.frustumCulled = false;
  atlasScene.add(atlasQuad);
  const scene = new T.Scene();
  const quad = new T.Mesh(new T.PlaneGeometry(2, 2), material);
  quad.frustumCulled = false;
  scene.add(quad);
  let atlasTime = -Infinity, atlasLighting, atlasSamples;
  return {
    scene,
    update(camera, state, config, overlay, exactFrame) {
      uniforms.overlayColor.value = overlay?.texture ?? null;
      uniforms.overlayDepth.value = overlay?.depthTexture ?? null;
      uniforms.overlayEnabled.value = Boolean(overlay);
      uniforms.invProjection.value.copy(camera.projectionMatrixInverse);
      uniforms.cameraTransform.value.copy(camera.matrixWorld);
      uniforms.phase.value.set(state.convection, state.top, state.cloud, state.outflow);
      uniforms.tornado.value.set(state.x / 1000, state.y / 1000, state.vortexPhase, state.occlusion);
      uniforms.appearance.value.set(config.funnel ? state.funnel : 0, config.dust ? state.dust : 0,
        config.clouds ? config.cloudOpacity : 0, state.low);
      const [forward, rear] = state.drafts.slice(1, 3);
      uniforms.flanks.value.set(forward[0] / 1000, forward[1] / 1000, rear[0] / 1000, rear[1] / 1000);
      uniforms.evolution.value.set(state.seconds, state.vortex,
        state.occlusion * Math.min(1, (1 - state.vortex) * 1.65), state.radius / 1000);
      const [sun, direct, zenith, horizon, shade, environment] = lighting[config.lighting];
      uniforms.sun.value.set(...sun).normalize();
      uniforms.sunlight.value.set(...direct);
      uniforms.skyZenith.value.set(...zenith);
      uniforms.skyHorizon.value.set(...horizon);
      uniforms.shade.value.set(...shade);
      uniforms.environment.value = environment;
      uniforms.morphology.value = config.morphology;
      uniforms.shadowSteps.value = config.shadowSteps;
      uniforms.options.value.set(config.marchStep, Number(config.grid), config.rain ? config.rainOpacity : 0);
      uniforms.clipPlane.value.set(config.altitude / 1000, config.clip);
      if (uniforms.appearance.value.z > 0 && state.cloud > .001 &&
          (atlasLighting !== config.lighting || atlasSamples !== config.shadowSteps
          || Math.abs(state.seconds - atlasTime) >= 5 || (exactFrame && state.seconds !== atlasTime))) {
        atlasTime = state.seconds;
        atlasLighting = config.lighting;
        atlasSamples = config.shadowSteps;
        renderer.setRenderTarget(atlas);
        renderer.render(atlasScene, camera);
        renderer.setRenderTarget(null);
      }
      uniforms.atlasAge.value = Number.isFinite(atlasTime) ? state.seconds - atlasTime : 0;
    },
  };
}
