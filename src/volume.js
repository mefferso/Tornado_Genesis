import * as T from 'three';

const vertexShader = `
out vec2 ndc;
void main() {
  ndc = position.xy;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}`;

const fragmentShader = `
precision highp float;
precision mediump sampler3D;
in vec2 ndc;
out vec4 color;
uniform mat4 invProjection, cameraTransform;
uniform sampler3D noiseTex;
uniform vec4 phase, tornado, appearance;
uniform vec3 options;
uniform vec2 clipPlane;

vec3 enu(vec3 p) { return vec3(p.x, -p.z, p.y); }
float n3(vec3 p) { return texture(noiseTex, p).r; }
float noise(vec3 p) {
  return .57*n3(p*.082)+.29*n3(p*.173+vec3(.29,.17,.62))+.14*n3(p*.397);
}
float ell(vec3 p, vec3 c, vec3 r) {
  return 1.-length((p-c)/r);
}
vec2 interval(vec3 o, vec3 d, vec3 lower, vec3 upper) {
  vec3 safe = mix(d, vec3(1.e-6), lessThan(abs(d), vec3(1.e-6)));
  vec3 a=(lower-o)/safe, b=(upper-o)/safe;
  vec3 lo=min(a,b), hi=max(a,b);
  return vec2(max(max(lo.x,lo.y),lo.z), min(min(hi.x,hi.y),hi.z));
}
float cloudShape(vec3 p) {
  float top=phase.y, vigor=phase.x;
  float base=1.18;
  vec3 center=vec3(.28*(p.z-base),.22*(p.z-base), (base+top)*.5);
  float tower=ell(p, center, vec3(1.0+3.0*vigor,1.1+2.6*vigor,max(.19,(top-base)*.53)));
  float shelf=ell(p, vec3(-.85,.26,1.76), vec3(4.7,3.15,1.07))*1.12-1.00*(1.-vigor);
  vec3 a=p-vec3(9.1,5.0,top-.85);
  vec3 downshear=vec3(dot(a.xy,vec2(.882,.471)),dot(a.xy,vec2(-.471,.882)),a.z);
  float anvil=ell(downshear,vec3(0),vec3(14.8,7.1,1.24))-1.6*(1.-vigor);
  float upperTower=ell(p,vec3(3.0,2.42,top-1.73),vec3(2.45,2.15,2.36))-1.43*(1.-vigor);
  float overshoot=ell(p,vec3(3.6,2.84,top-.07),vec3(1.7,1.45,1.17))-1.14*(1.-vigor);
  float wall=ell(p,vec3(tornado.xy+vec2(.18,.18),1.17),vec3(1.24,.97,.56))-(1.-appearance.w)*1.16;
  float forwardCloud=ell(p,vec3(7.8,5.9,5.6),vec3(7.3,5.25,4.3))-(1.-phase.w);
  return max(max(max(max(tower,shelf),upperTower),max(anvil,overshoot)), max(wall,forwardCloud));
}
bool visibleAt(float z) {
  return clipPlane.y == 0. || (clipPlane.y > 0. ? z <= clipPlane.x : z >= clipPlane.x);
}
void main(){
  vec3 o=enu(cameraTransform[3].xyz);
  vec4 view=invProjection*vec4(ndc,1.,1.);
  vec3 d=normalize(enu((cameraTransform*vec4(view.xyz/view.w,0.)).xyz));
  float groundT=d.z<-.00001 ? -o.z/d.z : 1000.;
  vec3 sun=normalize(vec3(-.48,-.55,.58));
  float glow=pow(max(0.,dot(d,sun)),10.);
  vec3 horizon=mix(vec3(.47,.58,.61),vec3(.60,.57,.50),glow);
  vec3 bg=mix(horizon,vec3(.070,.17,.255),pow(max(d.z,0.),.61))+.09*glow;
  if(groundT<500. && visibleAt(0.)){
    vec2 p=o.xy+d.xy*groundT;
    float fields=n3(vec3(p*.04,.56));
    float plot=n3(vec3(floor(p*.8)*.089,.58));
    vec3 soil=mix(vec3(.077,.115,.106),vec3(.225,.285,.224),.63*fields+.37*plot);
    float under=exp(-dot((p-vec2(4.,3.))/vec2(13.,9.),(p-vec2(4.,3.))/vec2(13.,9.)));
    soil*=1.-.53*under*phase.x;
    vec2 cell=abs(fract(p/5.+.5)-.5)*5.;
    float line=1.-smoothstep(.012,.045+groundT*.0012,min(cell.x,cell.y));
    if(options.y>.5) soil=mix(soil,vec3(.36,.62,.62),line*.40/(1.+groundT*.075));
    bg=mix(soil,horizon,1.-exp(-groundT*.024));
  }
  vec2 range=interval(o,d,vec3(-14.,-11.,0.),vec3(34.,24.,16.5));
  vec2 funnelBox=interval(o,d,vec3(tornado.xy-vec2(.85),0.),vec3(tornado.xy+vec2(.85),1.55));
  float end=min(range.y,groundT);
  float t=max(range.x,0.);
  float trans=1.;
  vec3 accum=vec3(0);
  for(int i=0;i<144;i++){
    if(t>=end || trans<.023) break;
    float dt=options.x;
    if ((appearance.x>0. || appearance.y>0.) && funnelBox.x < funnelBox.y && t<funnelBox.y && t+dt>funnelBox.x) {
      if(t<funnelBox.x-.001) dt=min(dt,funnelBox.x-t);
      else dt=.041;
    }
    vec3 p=o+d*(t+dt*.5);
    t+=dt;
    if(!visibleAt(p.z)) continue;
    float shape=appearance.z > 0. && phase.z > .001 ? cloudShape(p) : -1.;
    float cloud=0., rain=0., funnel=0., dust=0.;
    vec3 light=vec3(.62,.69,.75);
    vec3 funnelLight=vec3(.42,.47,.51);
    if(shape>-.27 && appearance.z>0. && phase.z>.001) {
      float turbulence=noise(p+vec3(-phase.w*.8,appearance.w*.9,0.));
      float edge=shape+(turbulence-.55)*.76;
      cloud=appearance.z*phase.z*2.55*smoothstep(-.17,.26,edge);
      float rim=clamp(.58+(shape-cloudShape(p+sun*.63))*1.9 + .22*turbulence, .16, .94);
      float skyLight=smoothstep(1.0,9.7,p.z);
      light=mix(vec3(.20,.25,.302),vec3(1.0,.955,.862),rim*(.58+.42*skyLight));
    }
    if(options.z>0. && phase.w>.01 && p.z<8.){
      float flank=ell(p,vec3(11.2+.20*p.z,6.35+.22*p.z,3.65),vec3(6.7,4.6,5.7));
      float rear=ell(p,vec3(-3.7+tornado.w*4.8,.8-tornado.w*3.8,2.),vec3(2.6,1.8,3.4));
      float mask=max(flank,rear-.08);
      if(mask>-.1) {
        float waves=n3(vec3((p.xy-p.z*vec2(.19,.16))*.61,p.z*.009));
        float curtain=.70*n3(vec3(p.xy*.29,p.z*.011))+.30*waves;
        rain=.55*options.z*phase.w*smoothstep(-.08,.42,mask+(.5-curtain)*.22);
      }
    }
    if(p.z<1.54 && length(p.xy-tornado.xy)<.92) {
      float z=p.z;
      vec2 q=p.xy-tornado.xy-vec2(.075,.05)*z;
      float twist=atan(q.y,q.x)+z*8.0-tornado.z;
      float radius=mix(.080,.42,pow(clamp(z/1.42,0.,1.),2.1))*(1.+.14*sin(twist*3.));
      float bottom=clamp((1.-appearance.x)*1.62-.26,0.,1.5);
      float r=length(q);
      funnel=appearance.x*20.*(1.-smoothstep(radius*.57,radius*1.12,r))*smoothstep(bottom,bottom+.13,z);
      float side=clamp(.57+dot(q,normalize(sun.xy))*.50/radius,0.,1.);
      funnelLight=mix(vec3(.28,.34,.39),vec3(.74,.76,.75),side)*(.86+.25*n3(p*1.7));
      float dustR=.22+.30*z;
      dust=appearance.y*5.8*(1.-smoothstep(dustR*.45,dustR*1.6,r))*(1.-smoothstep(.02,.30,z))*(.5+n3(p*1.4));
    }
    float den=cloud+rain+funnel+dust;
    if(den>.0001) {
      vec3 lit=(cloud*light+rain*vec3(.28,.34,.37)+funnel*funnelLight+dust*vec3(.37,.30,.23))/den;
      lit=mix(lit,horizon,1.-exp(-t*.010));
      float alpha=1.-exp(-den*dt);
      accum+=trans*alpha*lit;
      trans*=1.-alpha;
    }
  }
  color=vec4(accum+bg*trans,1.);
}`;

export function createVolume() {
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
    options: { value: new T.Vector3() }, clipPlane: { value: new T.Vector2() },
  };
  const material = new T.ShaderMaterial({
    vertexShader, fragmentShader, uniforms, glslVersion: T.GLSL3, depthTest: false, depthWrite: false,
  });
  const scene = new T.Scene();
  const quad = new T.Mesh(new T.PlaneGeometry(2, 2), material);
  quad.frustumCulled = false;
  scene.add(quad);
  return {
    scene,
    update(camera, state, config) {
      uniforms.invProjection.value.copy(camera.projectionMatrixInverse);
      uniforms.cameraTransform.value.copy(camera.matrixWorld);
      uniforms.phase.value.set(state.convection, state.top, state.cloud, state.outflow);
      uniforms.tornado.value.set(state.x / 1000, state.y / 1000, state.seconds * .094, state.occlusion);
      uniforms.appearance.value.set(config.funnel ? state.funnel : 0, config.dust ? state.dust : 0,
        config.clouds ? config.cloudOpacity : 0, state.low);
      uniforms.options.value.set(config.marchStep, Number(config.grid), config.rain ? config.rainOpacity : 0);
      uniforms.clipPlane.value.set(config.altitude / 1000, config.clip);
    },
  };
}
