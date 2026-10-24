import * as THREE from 'three';
import { bendPaper } from './paper-geometry';
import { printNotebookPage } from './paper-print';
import type { RenderBounds, SharedSceneView } from './shared-scene';

type PrintSpec = { pixels:number; ratio:number; form:string };
type Print = { front: THREE.CanvasTexture; reverse: THREE.CanvasTexture; used: number; spec:PrintSpec };
type Surface = {
  id: string; root: HTMLElement; element: HTMLElement; scene: THREE.Scene; camera: THREE.PerspectiveCamera;
  geometry: THREE.PlaneGeometry; mesh: THREE.Mesh; edge: THREE.Mesh; under: THREE.Mesh; floor: THREE.Mesh; light:THREE.DirectionalLight;
  material: THREE.MeshBasicMaterial; uniforms: { reverse: {value:THREE.Texture} };
  prints: Map<number,Print>; loading: Map<number,Promise<Print>>; index: number; pending: number|null;
  fold: number; target: number; velocity: number; direction: number; corner: number; dragging: boolean;
  width: number; height: number; visible: boolean; renderVisible:boolean; dirty:boolean; priority:number; worldBounds:THREE.Box3; ready: boolean; request: number; localTime: number;
  underIndex:number|null; previewRequest:number; measuredWidth:number; measuredRatio:number; turnStarted: number; turnFrom: number; turnDuration: number; peeling: boolean; pulses:{line:THREE.LineLoop;age:number}[];
};
export type PaperController = {
  setEnabled(value:boolean):void; setHeroMode(mode:'paper'|'field'):void; dispose():void;
  hasSurface(id:string):boolean; selectPage(id:string,index:number,direction?:number):void;
  bend(id:string,progress:number,direction:number,corner:number):void; cancel(id:string):void;
  preview(id:string,direction:number,amount:number,corner?:number):void; invalidate(id:string):void;
};
const clamp=(n:number,a:number,b:number)=>Math.max(a,Math.min(b,n));
const ease=(n:number)=>1-Math.pow(1-n,3);

/** One transparent renderer; every notebook owns a separate, bounded leaf state. */
export async function createLivingPaper(initialEnabled:boolean, commit:(id:string,index:number)=>void):Promise<PaperController> {
  const canvas=document.createElement('canvas'); canvas.className='paper-layer-canvas'; canvas.setAttribute('aria-hidden','true');
  const gl=canvas.getContext('webgl2',{alpha:true,antialias:true,powerPreference:'low-power'});
  if(!gl) throw new Error('WebGL unavailable');
  const renderer=new THREE.WebGLRenderer({canvas,context:gl,alpha:true,antialias:true,powerPreference:'low-power'});
  renderer.setClearColor(0x000000,0); renderer.autoClear=false; renderer.outputColorSpace=THREE.SRGBColorSpace;
  // Printed colors are color managed without photographic tone mapping or a tinted lighting floor.
  renderer.toneMapping=THREE.NoToneMapping; renderer.shadowMap.enabled=true; renderer.shadowMap.type=THREE.PCFShadowMap;
  document.body.append(canvas);
  const aborter=new AbortController(),viewLifetime=new AbortController(),{signal}=aborter;
  const surfaces=new Map<string,Surface>(),views:SharedSceneView[]=[];const projected=new THREE.Vector3();let interactionSerial=0,renderSerial=0; const mobile=matchMedia('(max-width:600px)');
  let enabled=initialEnabled,disposed=false,lost=false,frame=0,previous=0,slow=0,detail=1,width=0,height=0;
  let heroMode:'paper'|'field'='paper',navigationTimer:ReturnType<typeof setTimeout>|undefined,resizeTimer:ReturnType<typeof setTimeout>|undefined;
  const root=document.documentElement;
  const blank=new THREE.DataTexture(new Uint8Array([244,240,231,255]),1,1);blank.needsUpdate=true;
  function resize(){width=innerWidth;height=innerHeight;renderer.setPixelRatio(Math.max(Math.min(devicePixelRatio,1.5),Math.min(devicePixelRatio,mobile.matches?2:2.25)*detail));renderer.setSize(width,height,false);root.dataset.paperPixelRatio=renderer.getPixelRatio().toFixed(2);}
  resize();
  const nativeAtRest=(s:Surface)=>!s.turnStarted&&!s.dragging&&s.target<.001&&s.fold<.001&&s.pulses.length===0;
  const paperCandidate=(s:Surface)=>s.ready&&!(s.id==='hero'&&heroMode==='field')&&!nativeAtRest(s);
  const active=(s:Surface)=>paperCandidate(s)&&(s.visible||s.renderVisible||s.dirty);
  function retireView(view:SharedSceneView){view.element.dataset.robotPainted='false';const i=views.indexOf(view);if(i>=0)views.splice(i,1);try{view.dispose();}catch{/* A failed enhancement leaves its poster. */}}
  function applyViews(action:(view:SharedSceneView)=>void){for(const view of [...views])try{action(view);}catch{retireView(view);}}
  function viewAnimating(view:SharedSceneView){try{return view.isAnimating()&&Boolean(view.measure({width,height}));}catch{retireView(view);return false;}}
  const canRun=()=>enabled&&!document.hidden&&!disposed&&!lost&&([...surfaces.values()].some(active)||[...views].some(viewAnimating));
  function wake(){if(!frame&&canRun()){previous=0;frame=requestAnimationFrame(tick);}}
  function trim(){
    const all=[...surfaces.values()].flatMap(s=>[...s.prints.entries()].map(([i,p])=>({s,i,p})));
    const limit=mobile.matches?5:8;const pixelLimit=mobile.matches?8_000_000:16_000_000;
    all.sort((a,b)=>a.p.used-b.p.used);
    let count=all.length,pixels=all.reduce((n,{p})=>n+p.front.image.width*p.front.image.height,0);
    for(const {s,i,p} of all){if(count<=limit&&pixels<=pixelLimit)break;if(((s.visible||s.renderVisible||s.dragging)&&(i===s.index||i===s.pending||i===s.underIndex))||s.loading.has(i))continue;if(s.material.map===p.front)s.material.map=blank;if(s.uniforms.reverse.value===p.reverse)s.uniforms.reverse.value=blank;if((s.under.material as THREE.MeshBasicMaterial).map===p.front)(s.under.material as THREE.MeshBasicMaterial).map=blank;p.front.dispose();p.reverse.dispose();s.prints.delete(i);count--;pixels-=p.front.image.width*p.front.image.height;}
    root.dataset.paperTextures=String(count);root.dataset.paperTexturePixels=String(pixels);
  }
  function printSpec(s:Surface,index:number):PrintSpec {
    const rect=s.element.getBoundingClientRect();
    if(rect.width>0&&rect.height>0){s.measuredWidth=rect.width;s.measuredRatio=rect.height/rect.width;}
    return {pixels:Math.min(2560,Math.max(1000,Math.ceil(s.measuredWidth*Math.min(devicePixelRatio,2.25)*1.15))),ratio:s.measuredRatio,form:index===0?s.root.closest<HTMLElement>('[data-hero-art]')?.dataset.formState||'':''};
  }
  const sameSpec=(a:PrintSpec,b:PrintSpec)=>a.form===b.form&&Math.abs(a.pixels-b.pixels)/b.pixels<.08&&Math.abs(a.ratio-b.ratio)/b.ratio<.01;
  function discardPrint(s:Surface,index:number,p:Print){
    if(s.material.map===p.front){s.material.map=blank;s.uniforms.reverse.value=blank;s.ready=false;s.root.dataset.paperPainted='false';}
    if((s.under.material as THREE.MeshBasicMaterial).map===p.front)(s.under.material as THREE.MeshBasicMaterial).map=blank;
    if(s.prints.get(index)===p)s.prints.delete(index);p.front.dispose();p.reverse.dispose();
  }
  async function print(s:Surface,index:number):Promise<Print>{
    const existing=s.prints.get(index);
    if(existing&&sameSpec(existing.spec,printSpec(s,index))){existing.used=performance.now();return existing;}
    if(existing)discardPrint(s,index,existing);
    const loading=s.loading.get(index);if(loading)return loading;
    // One job per leaf. If form or layout changes while it prints, prepare the latest
    // version before resolving any callers; obsolete jobs never enter the GPU cache.
    const task=(async()=>{
      while(!disposed&&!lost){
        const spec=printSpec(s,index),result=await printNotebookPage(s.root,index);
        if(disposed||lost)throw new Error('Paper renderer unavailable');
        if(!sameSpec(spec,printSpec(s,index)))continue;
        const front=new THREE.CanvasTexture(result.front),reverse=new THREE.CanvasTexture(result.reverse);
        front.colorSpace=reverse.colorSpace=THREE.SRGBColorSpace;front.anisotropy=reverse.anisotropy=Math.min(4,renderer.capabilities.getMaxAnisotropy());
        const value={front,reverse,used:performance.now(),spec};s.prints.set(index,value);return value;
      }
      throw new Error('Paper renderer unavailable');
    })();
    s.loading.set(index,task);
    try{return await task;}finally{if(s.loading.get(index)===task)s.loading.delete(index);}
  }
  function usePrint(s:Surface,index:number){const p=s.prints.get(index);if(!p)return;s.index=index;s.material.map=p.front;s.uniforms.reverse.value=p.reverse;p.used=performance.now();s.root.dataset.paperTextureWidth=String(p.front.image.width);s.root.dataset.paperTextureAspect=p.spec.ratio.toFixed(4);if(s.id==='hero')s.root.dataset.paperTextureForm=p.spec.form;}
  function showUnder(s:Surface,index:number,p:Print){(s.under.material as THREE.MeshBasicMaterial).map=p.front;s.root.dataset.paperUnderPage=String(index);}
  function prepareUnder(s:Surface,index:number|null){
    if(s.underIndex===index)return;
    s.underIndex=index;const ticket=++s.previewRequest;
    if(index===null)return;
    // Keep the current print underneath until the intended neighbor is ready.
    (s.under.material as THREE.MeshBasicMaterial).map=s.material.map;
    void print(s,index).then(p=>{if(!disposed&&!lost&&ticket===s.previewRequest&&s.underIndex===index&&!s.turnStarted&&s.pending===null){showUnder(s,index,p);trim();wake();}}).catch(()=>{});
  }
  async function refresh(s:Surface){
    const index=s.index;
    try{const p=await print(s,index);if(disposed||lost)return;
      if(Number(s.root.dataset.page)!==s.index){void reconcile(s);return;}
      if(s.index===index){usePrint(s,index);s.ready=true;if(s.pending===null&&s.underIndex===null)showUnder(s,index,p);trim();wake();}
    }catch{if(!disposed){s.ready=false;s.root.dataset.paperPainted='false';s.root.dataset.paperReady='unavailable';}}
  }
  function finish(s:Surface){
    if(s.pending!==null){const index=s.pending;s.pending=null;usePrint(s,index);commit(s.id,index);}
    s.underIndex=null;s.previewRequest++;s.turnStarted=0;s.fold=0;s.target=0;s.velocity=0;s.dragging=false;s.root.dataset.paperTurning='false';trim();
  }
  function cancel(s:Surface){s.dirty=true;s.dragging=false;s.target=0;s.root.removeAttribute('data-paper-dragging');wake();}
  async function selectPage(id:string,index:number,direction=1){
    const s=surfaces.get(id);if(!s?.ready){commit(id,index);return;}
    const count=Number(s.root.dataset.pageCount);index=clamp(index,0,count-1);
    if(index===s.pending||(s.pending===null&&index===s.index))return;
    const ticket=++s.request;s.previewRequest++;s.dirty=true;s.priority=++interactionSerial;
    if(s.pending!==null)finish(s);
    try{
      const p=await print(s,index);if(disposed||lost||ticket!==s.request)return;
      s.pending=index;s.underIndex=index;s.direction=direction;s.corner=-.55;s.dragging=false;
      showUnder(s,index,p);
      if(!enabled||(!s.visible&&!s.renderVisible)||document.hidden){finish(s);drawOnce();return;}
      s.turnFrom=s.fold;s.turnDuration=580*(1-Math.min(.65,s.fold));s.turnStarted=performance.now();s.root.dataset.paperTurning='true';wake();
    }catch{if(!disposed&&ticket===s.request){s.ready=false;s.root.dataset.paperReady='unavailable';s.root.dataset.paperPainted='false';commit(id,index);}}
  }
  function point(s:Surface,u:number,v:number){return bendPaper((u-.5)*s.width,(v-.5)*s.height,s.width,s.height,s.fold,s.direction,s.corner,s.localTime,enabled? .65:0);}
  function deform(s:Surface){
    const p=s.geometry.attributes.position as THREE.BufferAttribute,uv=s.geometry.attributes.uv as THREE.BufferAttribute;s.worldBounds.makeEmpty();
    for(let i=0;i<p.count;i++){const q=point(s,uv.getX(i),uv.getY(i));p.setXYZ(i,...q);s.worldBounds.expandByPoint(projected.set(...q));}
    p.needsUpdate=true;s.geometry.computeVertexNormals();
    const edge=s.edge.geometry.attributes.position as THREE.BufferAttribute,segments=40;
    for(let i=0;i<segments*4;i++){const side=Math.floor(i/segments),t=(i%segments)/(segments-1),u=side===0?t:side===1?1:side===2?1-t:0,v=side===0?1:side===1?1-t:side===2?0:t;const q=point(s,u,v);edge.setXYZ(i*2,...q);edge.setXYZ(i*2+1,q[0],q[1],q[2]-.004);}
    edge.needsUpdate=true;s.root.dataset.paperProgress=s.fold.toFixed(3);
  }
  function layout(s:Surface):DOMRect|null {
    const r=s.element.getBoundingClientRect();if(r.width<1||r.height<1)return null;
    s.width=4;s.height=4*r.height/r.width;s.camera.aspect=r.width/r.height;
    s.camera.position.z=s.height/(2*Math.tan(THREE.MathUtils.degToRad(33/2)));
    s.camera.clearViewOffset();s.camera.updateMatrixWorld(true);s.under.scale.set(s.width,s.height,1);
    return r;
  }
  const rectText=(r:RenderBounds)=>[r.left,r.top,r.width,r.height].map(n=>n.toFixed(2)).join(' ');
  function prepare(s:Surface,r:DOMRect):boolean {
    let left=Infinity,top=Infinity,right=-Infinity,bottom=-Infinity;
    const include=(x:number,y:number,z:number)=>{
      projected.set(x,y,z).project(s.camera);const px=r.left+(projected.x+1)*r.width/2,py=r.top+(1-projected.y)*r.height/2;
      if(Number.isFinite(px)&&Number.isFinite(py)){left=Math.min(left,px);top=Math.min(top,py);right=Math.max(right,px);bottom=Math.max(bottom,py);}
    };
    // Project the actual deformed leaf and fibre edge through the original stage
    // camera. The later crop changes the frustum, never the printed sheet scale.
    if(s.mesh.visible){const p=s.geometry.attributes.position as THREE.BufferAttribute;for(let i=0;i<p.count;i++)include(p.getX(i),p.getY(i),p.getZ(i));const edge=s.edge.geometry.attributes.position as THREE.BufferAttribute;for(let i=0;i<edge.count;i++)include(edge.getX(i),edge.getY(i),edge.getZ(i));}
    const geometryBounds={left,top,width:right-left,height:bottom-top};
    if(Number.isFinite(left)){s.root.dataset.paperProjectedBounds=rectText(geometryBounds);s.root.dataset.paperOverhang=String(left<r.left-.5||top<r.top-.5||right>r.right+.5||bottom>r.bottom+.5);}
    else{s.root.removeAttribute('data-paper-projected-bounds');s.root.dataset.paperOverhang='false';}
    // The under-page remains exactly on the mounting rectangle.
    for(const x of[-s.width/2,s.width/2])for(const y of[-s.height/2,s.height/2])include(x,y,s.under.position.z);
    // A transparent receiver follows only the cast-shadow footprint. It never
    // paints an opaque rectangular backing or enlarges the document layout.
    const bounds=s.worldBounds,z=s.floor.position.z,shadow=new THREE.Box3();
    const p=s.geometry.attributes.position as THREE.BufferAttribute;
    for(let i=0;i<p.count;i++){const x=p.getX(i),y=p.getY(i),heightAbove=p.getZ(i)-z;shadow.expandByPoint(projected.set(x-s.light.position.x/s.light.position.z*heightAbove,y-s.light.position.y/s.light.position.z*heightAbove,z));}
    const margin=.07;shadow.expandByScalar(margin);
    s.floor.position.x=(shadow.min.x+shadow.max.x)/2;s.floor.position.y=(shadow.min.y+shadow.max.y)/2;s.floor.scale.set(shadow.max.x-shadow.min.x,shadow.max.y-shadow.min.y,1);
    if(s.mesh.visible)for(const x of[shadow.min.x,shadow.max.x])for(const y of[shadow.min.y,shadow.max.y])include(x,y,z);
    const span=Math.max(3,Math.hypot(Math.max(Math.abs(bounds.min.x),Math.abs(bounds.max.x)),Math.max(Math.abs(bounds.min.y),Math.abs(bounds.max.y)))+Math.max(Math.abs(bounds.min.z),Math.abs(bounds.max.z))+.4);
    Object.assign(s.light.shadow.camera,{left:-span,right:span,top:span,bottom:-span,far:Math.max(20,s.light.position.length()+span*2)});s.light.shadow.camera.updateProjectionMatrix();
    for(const pulse of s.pulses){const p=pulse.line.geometry.attributes.position as THREE.BufferAttribute;for(let i=0;i<p.count;i++)include(p.getX(i),p.getY(i),p.getZ(i));}
    // Only the physical viewport clips an extended fold. Round outward so AA and
    // the small soft shadow cannot expose the old stage-shaped hard boundary.
    const edgePad=4,crop={left:clamp(Math.floor(left-edgePad),0,width),top:clamp(Math.floor(top-edgePad),0,height),width:0,height:0};
    crop.width=Math.max(0,clamp(Math.ceil(right+edgePad),0,width)-crop.left);crop.height=Math.max(0,clamp(Math.ceil(bottom+edgePad),0,height)-crop.top);
    s.root.dataset.paperLayoutBounds=rectText(r);s.root.dataset.paperRenderBounds=rectText(crop);
    s.renderVisible=crop.width>0&&crop.height>0;s.dirty=false;if(!s.renderVisible)return false;
    s.camera.setViewOffset(r.width,r.height,crop.left-r.left,crop.top-r.top,crop.width,crop.height);
    renderer.setViewport(crop.left,height-crop.top-crop.height,crop.width,crop.height);renderer.setScissor(crop.left,height-crop.top-crop.height,crop.width,crop.height);return true;
  }
  function paint(advance:boolean,now:number,dt=0){
    renderer.setScissorTest(false);renderer.clear();renderer.setScissorTest(true);
    for(const view of [...views]){
      try{
        const rect=view.measure({width,height});view.element.dataset.robotPainted='false';if(!rect||rect.width<=0||rect.height<=0)continue;
        if(advance)view.update(now,dt);
        const left=Math.max(0,rect.left),top=Math.max(0,rect.top),right=Math.min(width,rect.left+rect.width),bottom=Math.min(height,rect.top+rect.height);if(right<=left||bottom<=top)continue;
        renderer.toneMapping=view.toneMapping??THREE.NoToneMapping;renderer.toneMappingExposure=view.toneMappingExposure??1;
        renderer.setViewport(rect.left,height-rect.top-rect.height,rect.width,rect.height);renderer.setScissor(left,height-bottom,right-left,bottom-top);renderer.clearDepth();renderer.render(view.scene,view.camera);view.presented?.();
      }catch{retireView(view);}
    }
    renderer.toneMapping=THREE.NoToneMapping;renderer.toneMappingExposure=1;
    const ordered=[...surfaces.values()].sort((a,b)=>Number(a.dragging||Boolean(a.turnStarted))-Number(b.dragging||Boolean(b.turnStarted))||a.priority-b.priority);
    for(const s of ordered){
      s.root.dataset.paperPainted='false';if(!active(s)){if(!paperCandidate(s))s.renderVisible=false;s.dirty=false;continue;}
      const r=layout(s);if(!r){s.renderVisible=false;s.dirty=false;if(s.pending!==null)finish(s);continue;}
      if(advance){
        s.localTime+=dt;
        if(s.turnStarted){const p=clamp((now-s.turnStarted)/s.turnDuration,0,1);s.fold=s.turnFrom+(1.06-s.turnFrom)*ease(p);if(p>=1&&!s.peeling)finish(s);}
        else if(!s.dragging){s.velocity+=(s.target-s.fold)*65*dt;s.velocity*=Math.exp(-11*dt);s.fold=clamp(s.fold+s.velocity*dt,0,1.08);}
      }
      if(nativeAtRest(s)){s.renderVisible=false;s.dirty=false;continue;}
      deform(s);
      for(let i=s.pulses.length-1;i>=0;i--){const pulse=s.pulses[i];if(advance)pulse.age+=dt;const points=pulse.line.geometry.attributes.position as THREE.BufferAttribute;for(let j=0;j<points.count;j++){const angle=j/points.count*Math.PI*2,radius=.04+pulse.age*.3;const q=point(s,.5+Math.cos(angle)*radius,.5+Math.sin(angle)*radius);points.setXYZ(j,q[0],q[1],q[2]+.018);}points.needsUpdate=true;(pulse.line.material as THREE.LineBasicMaterial).opacity=Math.max(0,.5*(1-pulse.age/1.6));if(pulse.age>1.6){s.scene.remove(pulse.line);pulse.line.geometry.dispose();(pulse.line.material as THREE.Material).dispose();s.pulses.splice(i,1);}}
      s.mesh.visible=s.fold<1.04;s.edge.visible=s.mesh.visible;s.floor.visible=s.mesh.visible;
      if(!prepare(s,r)){
        if(!s.visible&&!s.dragging){if(s.pending!==null)finish(s);else{s.fold=s.target=s.velocity=0;s.pulses.forEach(p=>{s.scene.remove(p.line);p.line.geometry.dispose();(p.line.material as THREE.Material).dispose();});s.pulses=[];}}
        continue;
      }
      // Scenes have independent cameras and depth spaces, even when folds overlap.
      renderer.clearDepth();renderer.render(s.scene,s.camera);s.root.dataset.paperPainted=String(enabled);s.root.dataset.paperRenderSerial=String(++renderSerial);
    }
  }
  function drawOnce(){if(enabled&&!document.hidden&&!disposed&&!lost)paint(false,performance.now());}
  function tick(now:number){frame=0;if(!canRun()){drawOnce();return;}if(previous&&now-previous<32){frame=requestAnimationFrame(tick);return;}const dt=previous?clamp((now-previous)/1000,0,.05):1/30;previous=now;const start=performance.now();paint(true,now,dt);const cost=performance.now()-start;slow=cost>25?slow+1:Math.max(0,slow-1);if(slow>60&&detail>.7){detail=.7;resize();applyViews(v=>v.setQuality?.(detail));root.dataset.paperQuality='adaptive';slow=0;}root.dataset.paperFrames=String(Number(root.dataset.paperFrames||0)+1);frame=requestAnimationFrame(tick);}
  async function reconcile(s:Surface){
    const wanted=Number(s.root.dataset.page),ticket=++s.request;s.previewRequest++;s.ready=false;
    try{const p=await print(s,wanted);if(disposed||lost||ticket!==s.request)return;if(Number(s.root.dataset.page)!==wanted){void reconcile(s);return;}usePrint(s,wanted);showUnder(s,wanted,p);s.ready=true;trim();wake();}
    catch{if(!disposed){s.root.dataset.paperPainted='false';s.root.dataset.paperReady='unavailable';}}
  }
  const visibility=new IntersectionObserver(entries=>{for(const entry of entries){const s=[...surfaces.values()].find(s=>s.element===entry.target);if(s){s.visible=entry.isIntersecting;if(s.visible){const current=s.prints.get(s.index);if(Number(s.root.dataset.page)!==s.index)void reconcile(s);else if(!current||!sameSpec(current.spec,printSpec(s,s.index)))void refresh(s);}s.dirty=true;}}trim();if(!canRun()){cancelAnimationFrame(frame);frame=0;drawOnce();}else wake();},{threshold:.01});
  async function add(element:HTMLElement){
    const owner=element.closest<HTMLElement>('[data-notebook]');if(!owner)return;
    const id=owner.dataset.notebookId!;if(surfaces.has(id))return;
    const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(33,1,.1,35);
    const geometry=new THREE.PlaneGeometry(2,2,mobile.matches?32:48,mobile.matches?36:52);
    const material=new THREE.MeshBasicMaterial({side:THREE.DoubleSide});
    const uniforms={reverse:{value:new THREE.Texture()}};
    material.onBeforeCompile=shader=>{
      shader.uniforms.uPaperReverse=uniforms.reverse;
      shader.vertexShader='varying vec3 vPaperNormal;\n'+shader.vertexShader;
      shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvPaperNormal = normalize(normalMatrix * normal);');
      shader.fragmentShader='uniform sampler2D uPaperReverse;\nvarying vec3 vPaperNormal;\n'+shader.fragmentShader;
      shader.fragmentShader=shader.fragmentShader.replace('#include <map_fragment>',`vec4 printed = gl_FrontFacing ? texture2D(map, vMapUv) : texture2D(uPaperReverse, vec2(1.0-vMapUv.x,vMapUv.y));
        float shade = mix(.965,1.0,pow(abs(normalize(vPaperNormal).z),.7));
        diffuseColor *= vec4(printed.rgb * shade,printed.a);`);
    };
    material.customProgramCacheKey=()=> 'mr-natural-paper-v2';
    const mesh=new THREE.Mesh(geometry,material);mesh.castShadow=true;mesh.frustumCulled=false;scene.add(mesh);
    const edgeGeo=new THREE.BufferGeometry(),points=new Float32Array(40*4*2*3),indices:number[]=[];
    for(let i=0;i<40*4-1;i++){const n=i*2;indices.push(n,n+1,n+2,n+1,n+3,n+2);}edgeGeo.setAttribute('position',new THREE.BufferAttribute(points,3));edgeGeo.setIndex(indices);
    const edge=new THREE.Mesh(edgeGeo,new THREE.MeshBasicMaterial({color:0xe6e1d5,side:THREE.DoubleSide}));edge.frustumCulled=false;scene.add(edge);
    const floor=new THREE.Mesh(new THREE.PlaneGeometry(1,1),new THREE.ShadowMaterial({opacity:.055,depthWrite:false}));floor.position.z=-.022;floor.receiveShadow=true;scene.add(floor);
    const under=new THREE.Mesh(new THREE.PlaneGeometry(1,1),new THREE.MeshBasicMaterial({color:0xffffff}));under.position.z=-.025;scene.add(under);
    const light=new THREE.DirectionalLight(0xffffff,1);light.position.set(-2,3,8);light.castShadow=true;light.shadow.mapSize.set(512,512);Object.assign(light.shadow.camera,{left:-5,right:5,top:5,bottom:-5,near:.1,far:20});light.shadow.radius=3;light.shadow.bias=-.001;light.shadow.normalBias=.025;scene.add(light);
    const s:Surface={id,root:owner,element,scene,camera,geometry,mesh,edge,under,floor,light,material,uniforms,prints:new Map(),loading:new Map(),index:Number(owner.dataset.page)||0,pending:null,fold:0,target:0,velocity:0,direction:1,corner:-1,dragging:false,width:4,height:3,visible:false,renderVisible:false,dirty:true,priority:0,worldBounds:new THREE.Box3(),ready:false,request:0,localTime:0,underIndex:null,previewRequest:0,measuredWidth:element.getBoundingClientRect().width||900,measuredRatio:(element.getBoundingClientRect().height||620)/(element.getBoundingClientRect().width||900),turnStarted:0,turnFrom:0,turnDuration:0,peeling:false,pulses:[]};
    surfaces.set(id,s);
    try{
      const p=await print(s,s.index);if(disposed)return;usePrint(s,s.index);showUnder(s,s.index,p);
      await renderer.compileAsync(scene,camera);if(disposed||lost)return;
      s.ready=true;const rect=element.getBoundingClientRect();s.visible=rect.bottom>0&&rect.top<height&&rect.width>0;owner.dataset.paperReady='true';visibility.observe(element);trim();
      const formOwner=owner.closest<HTMLElement>('[data-hero-art]');
      if(formOwner){
        formOwner.addEventListener('portfolio:hero-pulse',()=>{if(!enabled||s.index!==0)return;const line=new THREE.LineLoop(new THREE.BufferGeometry().setAttribute('position',new THREE.BufferAttribute(new Float32Array(60*3),3)),new THREE.LineBasicMaterial({color:0xb83a26,transparent:true,opacity:.5}));line.frustumCulled=false;scene.add(line);s.pulses.push({line,age:0});s.velocity+=.4;if(s.pulses.length>3){const old=s.pulses.shift()!;scene.remove(old.line);old.line.geometry.dispose();(old.line.material as THREE.Material).dispose();}wake();},{signal});
        const forms=new MutationObserver(()=>invalidate(id));forms.observe(formOwner,{attributes:true,attributeFilter:['data-form-state']});cleanups.push(()=>forms.disconnect());}
      const link=owner.closest('.work-card')?.querySelector<HTMLAnchorElement>('[data-case-link]');
      link?.addEventListener('click',event=>{
        if(!enabled||!s.ready||!s.visible||event.defaultPrevented||event.button!==0||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey||link.target==='_blank')return;
        event.preventDefault();if(navigationTimer)return;s.peeling=true;s.dirty=true;s.priority=++interactionSerial;s.direction=1;s.corner=-1;s.turnFrom=s.fold;s.turnStarted=performance.now();s.turnDuration=420;s.root.dataset.paperTurning='true';wake();navigationTimer=setTimeout(()=>location.assign(link.href),430);
      },{signal});
      wake();
    }catch{if(!disposed)owner.dataset.paperReady='unavailable';}
  }
  const cleanups:(()=>void)[]=[];
  const lazy=new IntersectionObserver(entries=>{for(const entry of entries)if(entry.isIntersecting){lazy.unobserve(entry.target);void add(entry.target as HTMLElement);}},{rootMargin:'160px'});
  await document.fonts.ready;
  document.querySelectorAll<HTMLElement>('[data-notebook-surface]').forEach(el=>lazy.observe(el));
  async function invalidate(id:string){
    const s=surfaces.get(id);if(!s)return;
    if(s.index===0){void refresh(s);return;}
    try{const p=await print(s,0);if(disposed||lost)return;if(s.index===0){void refresh(s);return;}if(s.underIndex===0&&s.pending===null)showUnder(s,0,p);trim();wake();}catch{/* Retain native artwork. */}
  }
  window.addEventListener('resize',()=>{
    for(const s of surfaces.values()){cancel(s);if(s.pending!==null)finish(s);s.fold=s.velocity=0;s.dirty=true;s.renderVisible=false;s.previewRequest++;s.underIndex=null;s.root.dataset.paperPainted='false';}
    resize();drawOnce();clearTimeout(resizeTimer);
    resizeTimer=setTimeout(()=>{
      if(disposed||lost)return;
      for(const s of surfaces.values()){
        // Hidden topic panels are checked lazily when they become measurable again.
        if(s.element.getBoundingClientRect().width<1)continue;
        for(const [index,p]of s.prints)if(!sameSpec(p.spec,printSpec(s,index)))discardPrint(s,index,p);
        if(s.visible&&!s.prints.has(s.index))void refresh(s);
      }
      trim();wake();
    },120);
  },{signal,passive:true});
  window.addEventListener('scroll',()=>{for(const s of surfaces.values())if(paperCandidate(s))s.dirty=true;if(!frame)drawOnce();wake();},{signal,passive:true});
  document.addEventListener('visibilitychange',()=>{applyViews(v=>{v.setEnabled(enabled&&!document.hidden);if(document.hidden)v.element.dataset.robotPainted='false';});if(document.hidden){cancelAnimationFrame(frame);frame=0;for(const s of surfaces.values()){cancel(s);if(s.pending!==null)finish(s);s.root.dataset.paperPainted='false';}}else{drawOnce();wake();}},{signal});
  canvas.addEventListener('webglcontextlost',event=>{event.preventDefault();lost=true;applyViews(v=>{v.setEnabled(false);v.element.dataset.robotPainted='false';});viewLifetime.abort();cancelAnimationFrame(frame);frame=0;root.dataset.paperEngine='unavailable';for(const s of surfaces.values()){s.root.dataset.paperPainted='false';if(s.pending!==null)finish(s);}canvas.hidden=true;},{signal});
  root.dataset.paperEngine='ready';
  if(document.querySelector('[data-robot-studio]'))void(async()=>{
    try{const {createRoboticStudio}=await import('./robot-studio');if(disposed||lost||viewLifetime.signal.aborted)return;const view=await createRoboticStudio(renderer,wake,viewLifetime.signal);if(!view)return;if(disposed||lost||viewLifetime.signal.aborted){view.dispose();return;}views.push(view);try{view.setEnabled(enabled&&!document.hidden);view.setHeroMode(heroMode);view.setQuality?.(detail);}catch{retireView(view);return;}drawOnce();wake();}
    catch{if(disposed||lost||viewLifetime.signal.aborted)return;const studio=document.querySelector<HTMLElement>('[data-robot-studio]');if(studio){studio.dataset.robotReady='unavailable';studio.dataset.robotPainted='false';}}
  })();
  return {
    hasSurface:id=>!lost&&Boolean(surfaces.get(id)?.ready),selectPage,
    bend(id,progress,direction,corner){const s=surfaces.get(id);if(!s||!enabled)return;if(s.pending!==null)finish(s);s.dirty=true;s.priority=++interactionSerial;s.direction=direction;s.corner=corner;prepareUnder(s,clamp(s.index+direction,0,Number(s.root.dataset.pageCount)-1));s.dragging=true;s.fold=progress;s.target=progress;s.velocity=0;s.root.dataset.paperDragging='true';wake();},
    cancel(id){const s=surfaces.get(id);if(s){s.request++;s.turnStarted=0;s.pending=null;s.underIndex=null;s.previewRequest++;s.root.dataset.paperTurning='false';cancel(s);}},
    preview(id,direction,amount,corner){const s=surfaces.get(id);if(!s||s.dragging||s.turnStarted||!enabled)return;const next=clamp(s.index+direction,0,Number(s.root.dataset.pageCount)-1);s.dirty=true;s.priority=++interactionSerial;s.direction=direction;if(corner!==undefined)s.corner=clamp(corner,-1,1);s.target=next===s.index?0:amount;prepareUnder(s,amount>0&&next!==s.index?next:null);wake();},
    invalidate,
    setEnabled(value){enabled=value;canvas.hidden=!value;applyViews(v=>{v.setEnabled(value&&!document.hidden);if(!value)v.element.dataset.robotPainted='false';});for(const s of surfaces.values()){cancel(s);if(!value&&s.pending!==null)finish(s);if(!value)s.root.dataset.paperPainted='false';if(value&&Number(s.root.dataset.page)!==s.index)void reconcile(s);}if(value){drawOnce();wake();}else{cancelAnimationFrame(frame);frame=0;}},
    setHeroMode(mode){heroMode=mode;applyViews(v=>{v.setHeroMode(mode);if(mode==='field')v.element.dataset.robotPainted='false';});const s=surfaces.get('hero');if(s)s.root.dataset.paperPainted='false';drawOnce();wake();},
    dispose(){disposed=true;viewLifetime.abort();views.splice(0).forEach(v=>{v.element.dataset.robotPainted='false';try{v.dispose();}catch{/* Release the remaining scenes too. */}});aborter.abort();lazy.disconnect();visibility.disconnect();cleanups.forEach(fn=>fn());cancelAnimationFrame(frame);clearTimeout(navigationTimer);clearTimeout(resizeTimer);for(const s of surfaces.values()){s.root.dataset.paperPainted='false';s.root.removeAttribute('data-paper-turning');s.root.removeAttribute('data-paper-dragging');const geometries=new Set<THREE.BufferGeometry>(),materials=new Set<THREE.Material>();s.scene.traverse(o=>{if(o instanceof THREE.Mesh||o instanceof THREE.Line){geometries.add(o.geometry);const m=o.material;(Array.isArray(m)?m:[m]).forEach(x=>materials.add(x));}if(o instanceof THREE.DirectionalLight)o.shadow.dispose();});geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());s.prints.forEach(p=>{p.front.dispose();p.reverse.dispose();});}blank.dispose();renderer.dispose();canvas.remove();surfaces.clear();}
  };
}
