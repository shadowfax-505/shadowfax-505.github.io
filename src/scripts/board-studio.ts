import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import type { RenderBounds, SharedSceneView } from './shared-scene';
import parts from '../data/afo/board-parts.json';

const clamp=THREE.MathUtils.clamp;
const settle=(t:number)=>{t=clamp(t,0,1);const c=1.35;return 1+(c+1)*Math.pow(t-1,3)+c*Math.pow(t-1,2);};
const isPart=(name:string)=>/^(R|C|D|Q|SW|L|FB|TP|U|J|Y|F)\d+$/.test(name);
const passive=(name:string)=>/^(R|C|D|Q|L|FB|TP|F)\d+$/.test(name);
const partInfo=parts as unknown as Record<string,[string,string]>;
const arrivalKey='mr-board-arrival-v1';

type Part={node:THREE.Object3D;ref:string;home:THREE.Vector3;delay:number};

/**
 * The AFO recorder's AD7606 board, loaded from its KiCad export and drawn in the shared paper renderer.
 * On first view the components are placed one by one, passives first, the way a pick-and-place machine
 * would; afterwards it can be turned by drag or arrow keys, and hovering a part names it.
 */
export async function createBoardStudio(renderer:THREE.WebGLRenderer,wake:()=>void,ownerSignal?:AbortSignal):Promise<SharedSceneView|null>{
  const element=document.querySelector<HTMLElement>('[data-board-studio]');
  const stage=element?.querySelector<HTMLElement>('[data-board-stage]');
  if(!element||!stage||ownerSignal?.aborted)return null;
  const label=element.querySelector<HTMLElement>('[data-board-label]'),labelName=element.querySelector<HTMLElement>('[data-board-label-name]'),labelRole=element.querySelector<HTMLElement>('[data-board-label-role]');
  const replay=element.querySelector<HTMLButtonElement>('[data-board-assemble]');
  const aborter=new AbortController(),{signal}=aborter;
  const reduced=matchMedia('(prefers-reduced-motion: reduce)');
  const fine=matchMedia('(hover:hover) and (pointer:fine)');
  const scene=new THREE.Scene();
  const camera=new THREE.PerspectiveCamera(26,1,.1,80);
  const geometries=new Set<THREE.BufferGeometry>(),materials=new Set<THREE.Material>(),textures=new Set<THREE.Texture>();
  const pieces:Part[]=[],pickables:THREE.Object3D[]=[];
  const focus=new THREE.Vector3(.1,.45,.15),raycaster=new THREE.Raycaster(),pointer=new THREE.Vector2();
  let enabled=true,mode:'paper'|'field'='paper',disposed=false,ready=false,cleaned=false;
  let yaw=-.42,yawTarget=-.42,pitch=.66,pitchTarget=.66,time=0,assembleAge=-1,hovered:Part|undefined;
  let drag:{id:number;x:number;y:number;yaw:number;pitch:number}|undefined;
  const highlight=new THREE.Box3Helper(new THREE.Box3(),0xa35a22);highlight.visible=false;scene.add(highlight);
  materials.add(highlight.material as THREE.Material);geometries.add(highlight.geometry);
  element.dataset.boardReady='loading';element.dataset.viewPainted='false';

  function bounds(viewport?:{width:number;height:number}):RenderBounds|null{
    const r=stage!.getBoundingClientRect(),vw=viewport?.width||innerWidth,vh=viewport?.height||innerHeight;
    if(r.width<1||r.height<1||r.bottom<=0||r.top>=vh||r.right<=0||r.left>=vw)return null;
    return {left:r.left,top:r.top,width:r.width,height:r.height};
  }
  function canPresent(){return ready&&enabled&&!reduced.matches&&!document.hidden&&!disposed;}
  function eligible(){return canPresent()&&mode==='paper';}
  function assembling(){return assembleAge>=0&&assembleAge<2.6;}
  function state(){
    element!.dataset.boardState=disposed?'disposed':!enabled||reduced.matches?'paused':assembling()?'assembling':'ready';
    if(replay){replay.hidden=!ready;replay.disabled=!eligible();}
    stage!.tabIndex=eligible()?0:-1;
    if(!canPresent()){element!.dataset.viewPainted='false';hide();}
  }
  function place(){
    // Components drop in on a staggered schedule; anything not yet due is hidden above the board.
    for(const p of pieces){
      const t=assembleAge<0?1:(assembleAge-p.delay)/.42;
      p.node.visible=t>0;
      p.node.position.copy(p.home);p.node.position.y+=(1-settle(t))*.016;
    }
  }
  function positionCamera(){
    const radius=15.2;
    camera.position.set(focus.x+Math.sin(yaw)*Math.cos(pitch)*radius,focus.y+Math.sin(pitch)*radius,focus.z+Math.cos(yaw)*Math.cos(pitch)*radius);
    camera.lookAt(focus);camera.updateMatrixWorld();
  }
  function hide(){hovered=undefined;highlight.visible=false;if(label)label.hidden=true;}
  function pick(event:PointerEvent){
    if(!eligible()||drag||assembling()||!fine.matches){hide();return;}
    const r=stage!.getBoundingClientRect();
    pointer.set((event.clientX-r.left)/r.width*2-1,-((event.clientY-r.top)/r.height)*2+1);
    raycaster.setFromCamera(pointer,camera);
    const hit=raycaster.intersectObjects(pickables,true)[0];
    let node:THREE.Object3D|null=hit?.object??null;
    while(node&&!isPart(node.name))node=node.parent;
    const part=node?pieces.find(p=>p.node===node):undefined;
    if(!part){if(hovered){hide();wake();}stage!.style.cursor='';return;}
    if(part!==hovered){
      hovered=part;highlight.box.setFromObject(part.node);highlight.box.expandByScalar(.03);highlight.visible=true;
      const [name,role]=partInfo[part.ref]??[part.ref,''];
      if(labelName)labelName.textContent=`${part.ref} · ${name}`;
      if(labelRole){labelRole.textContent=role;labelRole.hidden=!role;}
      wake();
    }
    if(label){label.hidden=false;label.style.transform=`translate(${Math.round(event.clientX-r.left+14)}px,${Math.round(event.clientY-r.top+14)}px)`;}
    stage!.style.cursor='help';
  }
  function startAssembly(){assembleAge=0;hide();place();state();wake();}

  stage.addEventListener('pointerdown',event=>{if(!eligible())return;drag={id:event.pointerId,x:event.clientX,y:event.clientY,yaw:yawTarget,pitch:pitchTarget};hide();stage.dataset.orbiting='true';},{signal,passive:true});
  stage.addEventListener('pointermove',event=>{
    if(drag&&drag.id===event.pointerId){
      yawTarget=clamp(drag.yaw-(event.clientX-drag.x)/stage.clientWidth*2.4,-1.35,.55);
      if(event.pointerType==='mouse')pitchTarget=clamp(drag.pitch+(event.clientY-drag.y)/stage.clientHeight*1.1,.32,1.12);
      wake();return;
    }
    pick(event);
  },{signal,passive:true});
  const leave=()=>{drag=undefined;delete stage.dataset.orbiting;hide();stage.style.cursor='';wake();};
  stage.addEventListener('pointerup',()=>{drag=undefined;delete stage.dataset.orbiting;},{signal,passive:true});
  stage.addEventListener('pointerleave',leave,{signal});stage.addEventListener('pointercancel',leave,{signal});
  stage.addEventListener('keydown',event=>{
    if(!eligible()||!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Home'].includes(event.key))return;
    event.preventDefault();
    if(event.key==='Home'){yawTarget=-.42;pitchTarget=.66;}
    else if(event.key==='ArrowLeft'||event.key==='ArrowRight')yawTarget=clamp(yawTarget+(event.key==='ArrowLeft'?.12:-.12),-1.35,.55);
    else pitchTarget=clamp(pitchTarget+(event.key==='ArrowUp'?.06:-.06),.32,1.12);
    wake();
  },{signal});
  replay?.addEventListener('click',()=>{if(eligible())startAssembly();},{signal});
  reduced.addEventListener('change',()=>{state();wake();},{signal});
  ownerSignal?.addEventListener('abort',onOwnerAbort,{once:true});
  function onOwnerAbort(){disposed=true;ready=false;state();element!.dataset.boardReady='disposed';cleanup();}
  function cleanup(){
    if(cleaned)return;cleaned=true;aborter.abort();ownerSignal?.removeEventListener('abort',onOwnerAbort);
    scene.traverse(object=>{if(object instanceof THREE.Mesh){geometries.add(object.geometry);(Array.isArray(object.material)?object.material:[object.material]).forEach(m=>materials.add(m));}if(object instanceof THREE.Light)(object as THREE.DirectionalLight).shadow?.dispose();});
    geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());textures.forEach(t=>t.dispose());scene.clear();
  }

  try{
    // Baked studio reflections (the same CubeUV room the paper scenes use); fetch decodes gzip when the host already did.
    const response=await fetch('/assets/studio-room.cubeuv.bin.gz',{signal});
    if(!response.ok)throw new Error('Studio reflection asset unavailable');
    const payload=await response.arrayBuffer(),header=new Uint8Array(payload,0,Math.min(2,payload.byteLength));
    const decoded=header[0]===0x1f&&header[1]===0x8b
      ?await new Response(new Blob([payload]).stream().pipeThrough(new DecompressionStream('gzip'),{signal})).arrayBuffer()
      :payload;
    if(decoded.byteLength!==384*512*4*2)throw new Error('Studio reflection asset has an invalid shape');
    const reflection=new THREE.DataTexture(new Uint16Array(decoded),384,512,THREE.RGBAFormat,THREE.HalfFloatType);
    reflection.mapping=THREE.CubeUVReflectionMapping;reflection.colorSpace=THREE.LinearSRGBColorSpace;
    reflection.minFilter=reflection.magFilter=THREE.LinearFilter;reflection.generateMipmaps=false;reflection.flipY=false;reflection.needsUpdate=true;
    textures.add(reflection);scene.environment=reflection;scene.environmentIntensity=.95;
    if(disposed||ownerSignal?.aborted){cleanup();return null;}

    // Decode the compressed geometry off the main thread.
    MeshoptDecoder.useWorkers?.(2);
    const loader=new GLTFLoader();loader.setMeshoptDecoder(MeshoptDecoder);
    const gltf=await loader.loadAsync('/assets/afo/board.glb');
    if(disposed||ownerSignal?.aborted){cleanup();return null;}
    const model=gltf.scene;model.scale.setScalar(100);model.position.set(-3.75,0,-2.5);
    const pivot=new THREE.Group();pivot.add(model);scene.add(pivot);
    model.traverse(object=>{
      if(object instanceof THREE.Mesh){object.castShadow=true;object.receiveShadow=!isPart(object.name);}
      if(isPart(object.name)&&object.parent&&!isPart(object.parent.name)){pickables.push(object);pieces.push({node:object,ref:object.name,home:object.position.clone(),delay:0});}
    });
    if(pieces.length<20)throw new Error('Board model has too few parts');
    // Passives first, swept left to right like a placement head; then the ICs and connectors.
    pieces.sort((a,b)=>Number(passive(b.ref))-Number(passive(a.ref))||a.home.x-b.home.x||a.home.z-b.home.z);
    pieces.forEach((p,i)=>{p.delay=i/(pieces.length-1)*1.9;});

    const key=new THREE.DirectionalLight(0xfff4e2,1.55);key.position.set(-5,11,6);key.castShadow=true;
    key.shadow.mapSize.set(1024,1024);key.shadow.camera.left=key.shadow.camera.bottom=-6;key.shadow.camera.right=key.shadow.camera.top=6;key.shadow.camera.near=1;key.shadow.camera.far=30;key.shadow.radius=4;key.shadow.bias=-.0008;
    scene.add(key,new THREE.HemisphereLight(0xfffaf0,0xd9d2c2,.55));
    const floorMaterial=new THREE.ShadowMaterial({color:0x1b2126,opacity:.2});materials.add(floorMaterial);
    const floor=new THREE.Mesh(new THREE.PlaneGeometry(40,40),floorMaterial);floor.rotation.x=-Math.PI/2;floor.position.y=-.02;floor.receiveShadow=true;scene.add(floor);

    let seen=false;try{seen=sessionStorage.getItem(arrivalKey)==='1';}catch{/* Treat as a first visit. */}
    if(!seen&&bounds()){assembleAge=0;try{sessionStorage.setItem(arrivalKey,'1');}catch{/* One arrival per document is enough. */}}
    place();positionCamera();
    await renderer.compileAsync(scene,camera);
    if(disposed||ownerSignal?.aborted){cleanup();return null;}
    ready=true;element.dataset.boardReady='true';state();wake();
  }catch(error){
    if(!disposed){element.dataset.boardReady='unavailable';element.dataset.viewPainted='false';element.dataset.boardFailure=error instanceof Error?error.message:'Scene preparation failed';stage.tabIndex=-1;}
    cleanup();return null;
  }
  return {
    id:'board-studio',element,scene,camera,toneMapping:THREE.ACESFilmicToneMapping,toneMappingExposure:1.02,
    measure(viewport){
      if(!canPresent()){element.dataset.viewPainted='false';return null;}
      const rect=bounds(viewport);if(!rect){element.dataset.viewPainted='false';return null;}
      camera.aspect=rect.width/rect.height;camera.updateProjectionMatrix();return rect;
    },
    update(_now,dt){
      if(!eligible())return;
      const step=Math.min(dt,.05);time+=step;
      if(assembleAge>=0){assembleAge+=step;place();if(!assembling()){assembleAge=-1;place();state();}}
      // A slow sway while nobody is touching it; drag and keys set the target directly.
      const sway=drag||hovered?0:Math.sin(time*.32)*.07;
      const response=1-Math.exp(-6*step);
      yaw+=(yawTarget+sway-yaw)*response;pitch+=(pitchTarget-pitch)*response;
      positionCamera();
      element.dataset.boardFrames=String((Number(element.dataset.boardFrames)||0)+1);
    },
    isAnimating(){return eligible()&&Boolean(bounds());},
    setEnabled(value){enabled=value;if(!value){drag=undefined;hide();}state();if(value)wake();},
    setHeroMode(value){mode=value;state();if(value==='paper')wake();},
    setQuality(detail){const size=detail<.8?512:1024;scene.traverse(object=>{if(object instanceof THREE.DirectionalLight&&object.shadow.mapSize.width!==size){object.shadow.mapSize.set(size,size);object.shadow.map?.dispose();object.shadow.map=null;}});},
    presented(){if(canPresent()){element.dataset.viewPainted='true';}},
    dispose(){disposed=true;ready=false;state();element.dataset.boardReady='disposed';cleanup();},
  };
}
