import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import type { RenderBounds, SharedSceneView } from './shared-scene';

const clamp=THREE.MathUtils.clamp;
const smooth=(t:number)=>{t=clamp(t,0,1);return t*t*(3-2*t);};
const mix=(a:number,b:number,t:number)=>a+(b-a)*smooth(t);
const up=new THREE.Vector3(0,1,0);
const arrivalKey='mr-studio-arrival-v1';
const owners=new WeakMap<HTMLElement,symbol>();

/** An original product study. Its PBR scene shares the notebook renderer and frame budget. */
export async function createRoboticStudio(renderer:THREE.WebGLRenderer,wake:()=>void,ownerSignal?:AbortSignal):Promise<SharedSceneView|null>{
  const element=document.querySelector<HTMLElement>('[data-robot-studio]');
  const stage=element?.querySelector<HTMLElement>('[data-robot-stage]');
  if(!element||!stage||ownerSignal?.aborted)return null;
  const owner=Symbol('robot-studio');owners.set(element,owner);
  const owns=()=>owners.get(element)===owner;
  const replay=element.querySelector<HTMLButtonElement>('[data-robot-fold]');
  const aborter=new AbortController(),{signal}=aborter;
  const reduced=matchMedia('(prefers-reduced-motion: reduce)');
  const fine=matchMedia('(hover:hover) and (pointer:fine)');
  const scene=new THREE.Scene();
  const camera=new THREE.PerspectiveCamera(34,1,.1,35);
  const geometries=new Set<THREE.BufferGeometry>(),materials=new Set<THREE.Material>(),textures=new Set<THREE.Texture>();
  const geometryCache=new Map<string,THREE.BufferGeometry>();
  const startup:Record<string,number>={};let startupStart=performance.now();
  function recordStartup(name:string){const end=performance.now();startup[name]=Math.round(end-startupStart);performance.measure(`portfolio:robot:${name}`,{start:startupStart,end});if(owns())element!.dataset.robotStartup=JSON.stringify(startup);startupStart=end;}
  async function checkpoint(name:string){
    recordStartup(name);
    const scheduler=(globalThis as typeof globalThis&{scheduler?:{yield?:()=>Promise<void>}}).scheduler;
    if(scheduler?.yield)await scheduler.yield();else await new Promise<void>(resolve=>setTimeout(resolve,0));
    startupStart=performance.now();return !disposed&&!ownerSignal?.aborted&&owns();
  }
  const lights:THREE.DirectionalLight[]=[];
  let enabled=true,mode:'paper'|'field'='paper',disposed=false,ready=false,dirty=true;
  let poster=element.dataset.robotPoster==='true',cycle=13,frames=0,arrivalAge=0,arrivalStart=0,orbit=0,orbitTarget=0,replaySpeed=1,cleaned=false;
  let arrival:'pending'|'running'|'skipped'|'complete'='pending';
  const hover=new THREE.Vector2(),hoverTarget=new THREE.Vector2();
  const focus=new THREE.Vector3(-.42,1.30,.12);
  const yAxis=new THREE.Vector3(0,1,0),zAxis=new THREE.Vector3(0,0,1);
  const direction=new THREE.Vector3(),normal=new THREE.Vector3(),elbow=new THREE.Vector3(),wrist=new THREE.Vector3();
  const temp=new THREE.Vector3(),toolPoint=new THREE.Vector3(),targetPoint=new THREE.Vector3();
  const foldAxis=new THREE.Vector3(Math.SQRT1_2,0,-Math.SQRT1_2);
  const baseTool=new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(
    foldAxis.clone().negate(),up,new THREE.Vector3(-Math.SQRT1_2,0,-Math.SQRT1_2),
  ));
  const foldQuaternion=new THREE.Quaternion();
  const shoulder=new THREE.Vector3(-1.75,1.02,-.40);
  const paperOrigin=new THREE.Vector3(.8,.375,.62);
  const paperWidth=2.6,paperHeight=1.86,crease=-.88;
  const home=new THREE.Vector3(-.72,1.20,-.28);
  element.dataset.robotReady='loading';element.dataset.robotPainted='false';element.dataset.robotArrival='pending';

  function rememberArrival(){try{sessionStorage.setItem(arrivalKey,'1');}catch{/* A private tab still gets a single arrival in this document. */}}
  function interrupted(){return element!.dataset.robotInterrupted==='true'||scrollY>24||Boolean((window as Window&{__mrStudioInterrupted?:boolean}).__mrStudioInterrupted);}
  function interrupt(){
    if(arrival==='pending'||arrival==='running'){const started=arrival==='running';arrival='skipped';arrivalAge=1.2;cycle=started?22:13;rememberArrival();if(ready){pose(cycle);positionCamera();}if(owns())element!.dataset.robotArrival=arrival;dirty=true;wake();}
  }
  // Install before asynchronous shader preparation so early input can always skip arrival.
  window.addEventListener('pointerdown',interrupt,{signal,passive:true});
  window.addEventListener('keydown',interrupt,{signal});
  window.addEventListener('wheel',interrupt,{signal,passive:true});
  window.addEventListener('touchstart',interrupt,{signal,passive:true});
  window.addEventListener('scroll',()=>{if(scrollY>24)interrupt();},{signal,passive:true});
  try{
    const seen=sessionStorage.getItem(arrivalKey)==='1';
    const back=(performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming|undefined)?.type==='back_forward';
    if(seen||back||interrupted()||poster||reduced.matches)arrival='skipped';
  }catch{if(interrupted()||poster||reduced.matches)arrival='skipped';}
  element.dataset.robotArrival=arrival;cycle=arrival==='pending'?4:13;
  ownerSignal?.addEventListener('abort',onOwnerAbort,{once:true});

  function geometry<T extends THREE.BufferGeometry>(g:T):T{geometries.add(g);return g;}
  function material<T extends THREE.Material>(m:T):T{materials.add(m);return m;}
  function box(w:number,h:number,d:number,r=.05){const key=`box:${w}:${h}:${d}:${r}`;let g=geometryCache.get(key);if(!g){g=geometry(new RoundedBoxGeometry(w,h,d,3,r));geometryCache.set(key,g);}return g;}
  const ceramic=material(new THREE.MeshStandardMaterial({color:0xeceae2,roughness:.3,metalness:.12}));
  const ceramicSide=material(new THREE.MeshStandardMaterial({color:0xdadbd4,roughness:.34,metalness:.16}));
  const steel=material(new THREE.MeshStandardMaterial({color:0xb6c0c0,metalness:.94,roughness:.25}));
  const darkSteel=material(new THREE.MeshStandardMaterial({color:0x303b3d,metalness:.78,roughness:.35}));
  const rubber=material(new THREE.MeshStandardMaterial({color:0x192021,metalness:.05,roughness:.67}));
  const red=material(new THREE.MeshStandardMaterial({color:0xa83e2d,metalness:.24,roughness:.37}));
  const tableMaterial=material(new THREE.MeshStandardMaterial({color:0xe3e0d7,roughness:.52,metalness:.08}));
  function mesh(g:THREE.BufferGeometry,m:THREE.Material,parent:THREE.Object3D=scene){const o=new THREE.Mesh(g,m);o.castShadow=true;o.receiveShadow=true;parent.add(o);return o;}
  function cylinder(radius:number,height:number,m:THREE.Material,parent:THREE.Object3D=scene){const key=`cylinder:${radius}:${height}`;let g=geometryCache.get(key);if(!g){g=geometry(new THREE.CylinderGeometry(radius,radius,height,36));geometryCache.set(key,g);}return mesh(g,m,parent);}
  const boltGeometry=geometry(new THREE.CylinderGeometry(.027,.027,.018,6));
  function bolt(parent:THREE.Object3D,x:number,y:number,z:number){const b=mesh(boltGeometry,darkSteel,parent);b.rotation.x=Math.PI/2;b.position.set(x,y,z);return b;}
  const table=mesh(box(7.5,.22,4.65,.11),tableMaterial);table.position.set(.0,.19,.16);
  const underside=mesh(box(7.34,.065,4.5,.035),ceramicSide);underside.position.set(0,.052,.16);
  const base=new THREE.Group();base.position.set(shoulder.x,.3,shoulder.z);scene.add(base);
  const foot=cylinder(.57,.12,darkSteel,base);foot.position.y=.07;
  const footCap=cylinder(.52,.08,steel,base);footCap.position.y=.17;
  const pedestal=cylinder(.43,.44,ceramic,base);pedestal.position.y=.4;
  const seam=cylinder(.437,.032,rubber,base);seam.position.y=.42;
  const collar=cylinder(.37,.12,steel,base);collar.position.y=.67;
  for(let i=0;i<6;i++){const a=i/6*Math.PI*2;const b=mesh(boltGeometry,steel,base);b.position.set(Math.cos(a)*.48,.14,Math.sin(a)*.48);}
  const badge=mesh(box(.14,.045,.008,.006),red,base);badge.position.set(0,.50,.432);
  if(!await checkpoint('base')){cleanup();return null;}

  function joint(radius:number,width:number){
    const g=new THREE.Group();
    const core=cylinder(radius,width,rubber,g);core.rotation.x=Math.PI/2;
    const axle=cylinder(radius*.77,width+.026,steel,g);axle.rotation.x=Math.PI/2;
    for(const sign of [-1,1]){const cap=cylinder(radius*.66,.028,ceramicSide,g);cap.rotation.x=Math.PI/2;cap.position.z=sign*(width/2+.023);const center=cylinder(radius*.24,.035,darkSteel,g);center.rotation.x=Math.PI/2;center.position.z=sign*(width/2+.046);}
    for(let i=0;i<4;i++){const a=i*Math.PI/2+Math.PI/4;bolt(g,Math.cos(a)*radius*.49,Math.sin(a)*radius*.49,width/2+.044);}
    scene.add(g);return g;
  }
  const shoulderJoint=joint(.35,.48),elbowJoint=joint(.28,.40),wristJoint=joint(.18,.29);
  if(!await checkpoint('joints')){cleanup();return null;}
  function arm(length:number,width:number,depth:number){
    const g=new THREE.Group();scene.add(g);
    mesh(box(width*.79,length-.18,depth*.84,.10),darkSteel,g);
    const shell=mesh(box(width,length-.30,depth,.12),ceramic,g);shell.position.y=.035;
    const face=mesh(box(width*.75,length-.47,.025,.075),ceramicSide,g);face.position.z=depth/2+.01;face.position.y=.025;
    const stripe=mesh(box(.015,length*.32,.009,.004),red,g);stripe.position.set(width*.22,.03,depth/2+.03);
    for(const y of [-length*.29,length*.29])for(const x of [-width*.22,width*.22])bolt(g,x,y,depth/2+.032);
    const path=new THREE.CatmullRomCurve3([new THREE.Vector3(0,-length*.43,-depth*.51),new THREE.Vector3(.035,-length*.17,-depth*.78),new THREE.Vector3(.035,length*.20,-depth*.73),new THREE.Vector3(0,length*.43,-depth*.5)]);
    mesh(geometry(new THREE.TubeGeometry(path,24,.025,6,false)),rubber,g);
    for(const y of [-length*.25,length*.25]){const clampPart=mesh(box(.13,.065,.06,.015),steel,g);clampPart.position.set(.018,y,-depth*.73);}
    return g;
  }
  const upperLength=1.8,lowerLength=1.8;
  const upperArm=arm(upperLength,.43,.40);
  if(!await checkpoint('upper-arm')){cleanup();return null;}
  const lowerArm=arm(lowerLength,.35,.34);
  if(!await checkpoint('lower-arm')){cleanup();return null;}
  const gripper=new THREE.Group();scene.add(gripper);
  const toolShaft=cylinder(.11,.27,steel,gripper);toolShaft.rotation.x=Math.PI/2;toolShaft.position.set(0,.12,.36);
  const toolRing=cylinder(.13,.038,rubber,gripper);toolRing.rotation.x=Math.PI/2;toolRing.position.set(0,.12,.28);
  const toolBody=mesh(box(.28,.19,.19,.045),darkSteel,gripper);toolBody.position.set(0,.08,.21);
  const toolCover=mesh(box(.26,.07,.17,.025),ceramic,gripper);toolCover.position.set(0,.205,.21);
  const jaws=[new THREE.Group(),new THREE.Group()];
  jaws.forEach((jaw,index)=>{gripper.add(jaw);mesh(box(.19,.035,.25,.012),steel,jaw).position.z=.075;const pad=mesh(box(.14,.014,.065,.005),rubber,jaw);pad.position.set(0,index===0?-.018:.018,-.025);for(const x of [-.065,.065])bolt(jaw,x,0,.177);});

  if(!await checkpoint('gripper')){cleanup();return null;}

  // One procedural print follows the deformed paper, including its reverse side.
  const print=document.createElement('canvas');print.width=1024;print.height=768;
  const ctx=print.getContext('2d');
  if(ctx){
    ctx.fillStyle='#f8f5ec';ctx.fillRect(0,0,1024,768);ctx.fillStyle='#303c39';ctx.font='18px monospace';ctx.fillText('STUDY / 01',94,115);
    ctx.font='52px Georgia, serif';ctx.fillText('A signal takes shape.',94,185);ctx.strokeStyle='#d9d4c7';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(94,227);ctx.lineTo(930,227);ctx.stroke();
    ctx.font='14px monospace';ctx.fillStyle='#6b7169';ctx.fillText('MATERIAL / PAPER       METHOD / ONE CAREFUL FOLD',94,667);
    ctx.setLineDash([3,9]);ctx.strokeStyle='#c7c7b9';for(let j=0;j<4;j++){ctx.beginPath();ctx.moveTo(96,305+j*63);ctx.lineTo(928,305+j*63);ctx.stroke();}ctx.setLineDash([]);
    ctx.strokeStyle='#b44732';ctx.lineWidth=2.4;ctx.beginPath();for(let i=0;i<=160;i++){const x=96+i/160*830,y=414+Math.sin(i/160*Math.PI*4)*56*Math.exp(-Math.pow((i/160-.5)*1.6,2));if(i===0)ctx.moveTo(x,y);else ctx.lineTo(x,y);}ctx.stroke();
    for(const x of [96,926]){ctx.fillStyle='#b44732';ctx.beginPath();ctx.arc(x,414,5,0,Math.PI*2);ctx.fill();}
  }
  const paperPrint=new THREE.CanvasTexture(print);paperPrint.colorSpace=THREE.SRGBColorSpace;paperPrint.anisotropy=Math.min(4,renderer.capabilities.getMaxAnisotropy());textures.add(paperPrint);
  const paperGeometry=geometry(new THREE.PlaneGeometry(paperWidth,paperHeight,64,48));
  const paper=mesh(paperGeometry,material(new THREE.MeshStandardMaterial({map:paperPrint,color:0xffffff,side:THREE.DoubleSide,roughness:.84,metalness:0})));paper.position.copy(paperOrigin);paper.frustumCulled=false;
  const edgeGeometry=geometry(new THREE.BufferGeometry().setAttribute('position',new THREE.BufferAttribute(new Float32Array(4*40*3),3)));
  const paperEdge=new THREE.LineLoop(edgeGeometry,material(new THREE.LineBasicMaterial({color:0xc8c1af,transparent:true,opacity:.65})));paperEdge.position.copy(paperOrigin);paperEdge.frustumCulled=false;scene.add(paperEdge);
  // Soft local occlusion supports, rather than replaces, the real directional shadow.
  const shadowCanvas=document.createElement('canvas');shadowCanvas.width=shadowCanvas.height=128;
  const shadowContext=shadowCanvas.getContext('2d');if(shadowContext){const gradient=shadowContext.createRadialGradient(64,64,4,64,64,64);gradient.addColorStop(0,'rgba(28,34,31,.23)');gradient.addColorStop(.42,'rgba(28,34,31,.09)');gradient.addColorStop(1,'rgba(28,34,31,0)');shadowContext.fillStyle=gradient;shadowContext.fillRect(0,0,128,128);}
  const shadowTexture=new THREE.CanvasTexture(shadowCanvas);textures.add(shadowTexture);
  const contact=mesh(geometry(new THREE.PlaneGeometry(2.35,1.9)),material(new THREE.MeshBasicMaterial({map:shadowTexture,transparent:true,depthWrite:false})));contact.rotation.x=-Math.PI/2;contact.position.set(shoulder.x,.304,shoulder.z);contact.castShadow=false;contact.receiveShadow=false;
  const fill=new THREE.HemisphereLight(0xf8f3e8,0x86918d,1.3);scene.add(fill);
  const key=new THREE.DirectionalLight(0xfff3df,2.75);key.position.set(-3.4,6.4,4.3);key.castShadow=true;key.shadow.mapSize.set(1024,1024);Object.assign(key.shadow.camera,{left:-4,right:4,top:4,bottom:-3,near:.1,far:15});key.shadow.bias=-.0006;key.shadow.normalBias=.025;key.shadow.radius=3.5;scene.add(key);lights.push(key);
  const rim=new THREE.DirectionalLight(0xc8dbe6,1.75);rim.position.set(3.3,4.8,-3.3);scene.add(rim);lights.push(rim);
  const front=new THREE.DirectionalLight(0xfff9ee,.65);front.position.set(1,2,6);scene.add(front);lights.push(front);

  if(!await checkpoint('paper-and-lighting')){cleanup();return null;}

  function creaseRadius(angle:number){return mix(.10,.012,(angle-2.45)/.49);}
  function bent(x:number,z:number,angle:number,result:THREE.Vector3){
    const distance=Math.max(0,(crease-x-z)*Math.SQRT1_2);
    result.set(x,0,z);
    if(distance>0){
      // Integrate the sheet tangent through a cylindrical band, then continue
      // along its flat flap. The pressed crease tightens without a hard hinge.
      const radius=creaseRadius(angle),arc=Math.min(distance,radius*angle),localAngle=arc/radius;
      const remaining=distance-arc;
      const horizontal=radius*Math.sin(localAngle)+remaining*Math.cos(angle);
      const height=radius*(1-Math.cos(localAngle))+remaining*Math.sin(angle);
      const shift=(distance-horizontal)*Math.SQRT1_2;
      result.x+=shift;result.z+=shift;result.y=height;
    }
    return result;
  }
  function paperNormal(x:number,z:number,angle:number,result:THREE.Vector3){
    const distance=Math.max(0,(crease-x-z)*Math.SQRT1_2),a=Math.min(angle,distance/creaseRadius(angle));
    return result.set(Math.sin(a)*Math.SQRT1_2,Math.cos(a),Math.sin(a)*Math.SQRT1_2);
  }
  const traceDotCanvas=document.createElement('canvas');traceDotCanvas.width=traceDotCanvas.height=32;
  const traceCtx=traceDotCanvas.getContext('2d');if(traceCtx){traceCtx.fillStyle='#fff';traceCtx.beginPath();traceCtx.arc(16,16,13,0,Math.PI*2);traceCtx.fill();}
  const traceDotTexture=new THREE.CanvasTexture(traceDotCanvas);textures.add(traceDotTexture);
  const markerGeometry=geometry(new THREE.BufferGeometry().setAttribute('position',new THREE.BufferAttribute(new Float32Array(9),3)));
  const markers=new THREE.Points(markerGeometry,material(new THREE.PointsMaterial({map:traceDotTexture,color:0xb44732,size:.045,transparent:true,depthWrite:false,alphaTest:.05,opacity:.9})));markers.position.copy(paperOrigin);markers.frustumCulled=false;scene.add(markers);
  const traceMaterial=material(new THREE.LineBasicMaterial({color:0xc14c33,transparent:true,opacity:.72}));
  const trails=Array.from({length:3},()=>{const g=geometry(new THREE.BufferGeometry().setAttribute('position',new THREE.BufferAttribute(new Float32Array(18*3),3)));const line=new THREE.Line(g,traceMaterial);line.position.copy(paperOrigin);line.frustumCulled=false;scene.add(line);return line;});
  const tracePosition=new THREE.Vector3(),traceNormal=new THREE.Vector3();
  function signalPoint(t:number,angle:number,result:THREE.Vector3){
    const x=(96/1024+t*830/1024-.5)*paperWidth;
    const y=414+Math.sin(t*Math.PI*4)*56*Math.exp(-Math.pow((t-.5)*1.6,2));
    const z=(y/768-.5)*paperHeight;
    bent(x,z,angle,result);paperNormal(x,z,angle,traceNormal);return result.addScaledVector(traceNormal,.009);
  }
  function traceSignal(time:number,angle:number){
    const dots=markerGeometry.attributes.position as THREE.BufferAttribute;
    trails.forEach((line,i)=>{const t=(time*.045+i/3)%1;signalPoint(t,angle,tracePosition);dots.setXYZ(i,tracePosition.x,tracePosition.y,tracePosition.z);
      const p=line.geometry.attributes.position as THREE.BufferAttribute;for(let j=0;j<p.count;j++){signalPoint(Math.max(0,t-j*.0028),angle,tracePosition);p.setXYZ(j,tracePosition.x,tracePosition.y,tracePosition.z);}p.needsUpdate=true;});dots.needsUpdate=true;
  }
  const corner=new THREE.Vector3(),foldedCorner=new THREE.Vector3();
  function cornerAt(angle:number,result:THREE.Vector3){return bent(-paperWidth/2,-paperHeight/2,angle,result).add(paperOrigin);}
  function retreat(t:number,from:THREE.Vector3,result:THREE.Vector3){
    if(t<.4)return result.copy(from).addScaledVector(up,mix(0,.66,t/.4));
    temp.copy(from).addScaledVector(up,.66);return result.lerpVectors(temp,home,smooth((t-.4)/.6));
  }
  function pose(time:number){
    const t=((time%46)+46)%46;
    let angle=0,toolAngle=0,gap=.19,phase='idle';
    cornerAt(0,corner);cornerAt(2.94,foldedCorner);toolPoint.copy(home);
    if(t<4){/* Rest, ready to begin. */}
    else if(t<7){phase='approach';targetPoint.copy(corner).addScaledVector(up,.36);toolPoint.lerpVectors(home,targetPoint,smooth((t-4)/3));}
    else if(t<9){phase='approach';toolPoint.copy(corner).addScaledVector(up,mix(.36,0,(t-7)/2));}
    else if(t<10){phase='grasp';toolPoint.copy(corner);gap=mix(.19,.035,t-9);}
    else if(t<16){phase='lift';angle=mix(0,2.87,(t-10)/6);toolAngle=angle;cornerAt(angle,toolPoint);gap=.035;}
    else if(t<18){phase='press';angle=mix(2.87,2.94,(t-16)/2);toolAngle=angle;cornerAt(angle,toolPoint);gap=.035;}
    else if(t<19){phase='release';angle=toolAngle=2.94;toolPoint.copy(foldedCorner);gap=mix(.035,.19,t-18);}
    else if(t<22){phase='return';angle=2.94;toolAngle=mix(2.94,0,(t-19)/3);retreat((t-19)/3,foldedCorner,toolPoint);}
    else if(t<25){angle=2.94;}
    else if(t<28){phase='approach';angle=2.94;toolAngle=mix(0,2.94,(t-25)/3);targetPoint.copy(foldedCorner).addScaledVector(up,.36);toolPoint.lerpVectors(home,targetPoint,smooth((t-25)/3));}
    else if(t<30){phase='approach';angle=toolAngle=2.94;toolPoint.copy(foldedCorner).addScaledVector(up,mix(.36,0,(t-28)/2));}
    else if(t<31){phase='grasp';angle=toolAngle=2.94;toolPoint.copy(foldedCorner);gap=mix(.19,.035,t-30);}
    else if(t<37){phase='unfold';angle=mix(2.94,0,(t-31)/6);toolAngle=angle;cornerAt(angle,toolPoint);gap=.035;}
    else if(t<38){phase='press';toolPoint.copy(corner);gap=.035;}
    else if(t<39){phase='release';toolPoint.copy(corner);gap=mix(.035,.19,t-38);}
    else if(t<42){phase='return';retreat((t-39)/3,corner,toolPoint);}
    if(owns()){element!.dataset.robotPhase=phase;element!.dataset.robotFold=angle.toFixed(3);}traceSignal(time,angle);
    const positions=paperGeometry.attributes.position as THREE.BufferAttribute,uv=paperGeometry.attributes.uv as THREE.BufferAttribute;
    for(let i=0;i<positions.count;i++){bent((uv.getX(i)-.5)*paperWidth,(.5-uv.getY(i))*paperHeight,angle,temp);positions.setXYZ(i,temp.x,temp.y,temp.z);}
    positions.needsUpdate=true;paperGeometry.computeVertexNormals();
    const edge=edgeGeometry.attributes.position as THREE.BufferAttribute;
    for(let i=0;i<edge.count;i++){const side=Math.floor(i/40),u=(i%40)/39,x=side===0?u*paperWidth-paperWidth/2:side===1?paperWidth/2:side===2?(1-u)*paperWidth-paperWidth/2:-paperWidth/2,z=side===0?-paperHeight/2:side===1?u*paperHeight-paperHeight/2:side===2?paperHeight/2:(1-u)*paperHeight-paperHeight/2;bent(x,z,angle,temp);edge.setXYZ(i,temp.x,temp.y-.002,temp.z);}
    edge.needsUpdate=true;
    foldQuaternion.setFromAxisAngle(foldAxis,toolAngle);gripper.quaternion.copy(foldQuaternion).multiply(baseTool);gripper.position.copy(toolPoint);
    jaws[0].position.y=gap/2;jaws[1].position.y=-gap/2;
    wrist.set(0,.12,.40).applyQuaternion(gripper.quaternion).add(toolPoint);
    direction.copy(wrist).sub(shoulder);const horizontal=Math.max(.001,Math.hypot(direction.x,direction.z));
    const distance=clamp(direction.length(),.15,upperLength+lowerLength-.015);
    const pitch=Math.atan2(direction.y,horizontal)+Math.acos(clamp((upperLength*upperLength+distance*distance-lowerLength*lowerLength)/(2*upperLength*distance),-1,1));
    temp.set(direction.x/horizontal,0,direction.z/horizontal);
    elbow.copy(shoulder).addScaledVector(temp,Math.cos(pitch)*upperLength).addScaledVector(up,Math.sin(pitch)*upperLength);
    function bone(g:THREE.Group,a:THREE.Vector3,b:THREE.Vector3){g.position.copy(a).add(b).multiplyScalar(.5);direction.copy(b).sub(a).normalize();g.quaternion.setFromUnitVectors(yAxis,direction);}
    bone(upperArm,shoulder,elbow);bone(lowerArm,elbow,wrist);
    normal.set(-temp.z,0,temp.x).normalize();
    for(const [joint,point] of [[shoulderJoint,shoulder],[elbowJoint,elbow],[wristJoint,wrist]] as const){joint.position.copy(point);joint.quaternion.setFromUnitVectors(zAxis,normal);}
    base.rotation.y=Math.atan2(temp.x,temp.z)*.12;
  }
  function positionCamera(){
    element!.dataset.robotOrbit=orbit.toFixed(4);
    const arrivalProgress=arrival==='pending'?1:arrival==='running'?1-smooth(arrivalAge/1.2):0;
    const yaw=.50+orbit+hover.x*.035+arrivalProgress*.12;
    const elevation=.36+hover.y*.018+arrivalProgress*.035;
    const radius=8.2+arrivalProgress*.48;
    camera.position.set(focus.x+Math.sin(yaw)*Math.cos(elevation)*radius,focus.y+Math.sin(elevation)*radius,focus.z+Math.cos(yaw)*Math.cos(elevation)*radius);
    camera.lookAt(focus);camera.updateMatrixWorld();
  }
  function bounds(viewport?:{width:number;height:number}):RenderBounds|null{
    const r=stage!.getBoundingClientRect(),vw=viewport?.width||innerWidth,vh=viewport?.height||innerHeight;
    if(r.width<1||r.height<1||r.bottom<=0||r.top>=vh||r.right<=0||r.left>=vw)return null;
    return {left:r.left,top:r.top,width:r.width,height:r.height};
  }
  function canPresent(){return ready&&enabled&&!reduced.matches&&!document.hidden&&!disposed&&owns();}
  function eligible(){return canPresent()&&mode==='paper';}
  function state(){
    if(!owns())return;
    element!.dataset.robotState=disposed?'disposed':!enabled||reduced.matches?'paused':mode==='field'?'field':poster?'poster':'ready';
    if(replay){replay.hidden=!ready;replay.disabled=!eligible()||poster;}
    stage!.tabIndex=eligible()&&!poster?0:-1;
    stage!.setAttribute('aria-label',eligible()&&!poster?'An imagined robotics study: an articulated arm folds a printed sheet. Drag horizontally or use Left and Right arrows to orbit; Home resets the view.':'An imagined robotics study: an articulated arm folds a printed sheet.');
    if(!canPresent())element!.dataset.robotPainted='false';
  }
  let drag:{id:number;x:number;y:number;orbit:number}|undefined;
  stage.addEventListener('pointerdown',event=>{if(!eligible()||poster)return;drag={id:event.pointerId,x:event.clientX,y:event.clientY,orbit:orbitTarget};},{signal,passive:true});
  stage.addEventListener('pointermove',event=>{
    if(!eligible()||poster)return;
    const r=stage.getBoundingClientRect();
    if(drag&&event.pointerId===drag.id){const dx=event.clientX-drag.x,dy=event.clientY-drag.y;if(event.pointerType!=='touch'||Math.abs(dx)>Math.abs(dy)*1.3&&Math.abs(dx)>10){orbitTarget=clamp(drag.orbit+dx/r.width*.85,-.38,.38);wake();}}
    if(fine.matches&&event.pointerType!=='touch'){hoverTarget.set(clamp((event.clientX-r.left)/r.width-.5,-.5,.5),clamp((event.clientY-r.top)/r.height-.5,-.5,.5));wake();}
  },{signal,passive:true});
  const leave=()=>{drag=undefined;hoverTarget.set(0,0);wake();};
  stage.addEventListener('pointerleave',leave,{signal});stage.addEventListener('pointercancel',leave,{signal});stage.addEventListener('pointerup',()=>{drag=undefined;},{signal,passive:true});
  stage.addEventListener('keydown',event=>{if(!eligible()||poster||!['ArrowLeft','ArrowRight','Home'].includes(event.key))return;event.preventDefault();interrupt();orbitTarget=event.key==='Home'?0:clamp(orbitTarget+(event.key==='ArrowLeft'?-.065:.065),-.38,.38);hoverTarget.set(0,0);dirty=true;wake();},{signal});
  replay?.addEventListener('click',()=>{if(!eligible())return;interrupt();poster=false;cycle=4;replaySpeed=2.25;dirty=true;state();wake();},{signal});
  const posterPose=()=>{poster=true;cycle=13;orbit=orbitTarget=0;hover.set(0,0);hoverTarget.set(0,0);arrival='skipped';element!.dataset.robotArrival=arrival;pose(cycle);positionCamera();dirty=true;state();wake();};
  element.addEventListener('portfolio:studio-poster',posterPose,{signal});
  reduced.addEventListener('change',()=>{interrupt();state();dirty=true;wake();},{signal});
  function onOwnerAbort(){disposed=true;ready=false;state();if(owns()){element!.dataset.robotReady='disposed';element!.dataset.robotPainted='false';}cleanup();}
  function cleanup(){if(cleaned)return;cleaned=true;geometryCache.clear();aborter.abort();ownerSignal?.removeEventListener('abort',onOwnerAbort);lights.forEach(light=>light.shadow.dispose());geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());textures.forEach(t=>t.dispose());scene.clear();}
  try{
    // The same procedural RoomEnvironment lighting, baked with a 128-pixel
    // face budget and stored as lossless half-float CubeUV data. Loading it avoids
    // room/blur render passes and their shader compilation on each visitor's device.
    const response=await fetch('/assets/robotic-room.cubeuv.bin.gz',{signal});
    if(!response.ok)throw new Error('Studio reflection asset unavailable');
    const payload=await response.arrayBuffer(),header=new Uint8Array(payload,0,Math.min(2,payload.byteLength));
    // Hosts may apply Content-Encoding, in which case fetch already decoded it.
    const decoded=header[0]===0x1f&&header[1]===0x8b
      ?await new Response(new Blob([payload]).stream().pipeThrough(new DecompressionStream('gzip'),{signal})).arrayBuffer()
      :payload;
    if(disposed||ownerSignal?.aborted||!owns()){cleanup();return null;}
    if(decoded.byteLength!==384*512*4*2)throw new Error('Studio reflection asset has an invalid shape');
    const reflection=new THREE.DataTexture(new Uint16Array(decoded),384,512,THREE.RGBAFormat,THREE.HalfFloatType);
    reflection.mapping=THREE.CubeUVReflectionMapping;reflection.colorSpace=THREE.LinearSRGBColorSpace;
    reflection.minFilter=reflection.magFilter=THREE.LinearFilter;reflection.generateMipmaps=false;reflection.flipY=false;reflection.needsUpdate=true;
    textures.add(reflection);scene.environment=reflection;scene.environmentIntensity=.68;
    if(!await checkpoint('environment')){cleanup();return null;}
    pose(cycle);positionCamera();
    // Compile the exact ACES presentation variants, one material per task. The
    // printed notebooks use NoToneMapping; warming under that state would force
    // a second expensive PBR compilation on the first studio presentation.
    const warmed=new Set<THREE.Material>(),jobs:THREE.Object3D[]=[];
    scene.traverse(object=>{if(object instanceof THREE.Mesh||object instanceof THREE.Line||object instanceof THREE.Points){const list=Array.isArray(object.material)?object.material:[object.material];if(list.some(m=>!warmed.has(m))){list.forEach(m=>warmed.add(m));jobs.push(object);}}});
    for(let i=0;i<jobs.length;i++){
      const previousTone=renderer.toneMapping,previousExposure=renderer.toneMappingExposure;
      let compiling:Promise<unknown>;
      try{renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=.94;compiling=renderer.compileAsync(jobs[i],camera,scene);}
      finally{renderer.toneMapping=previousTone;renderer.toneMappingExposure=previousExposure;}
      await compiling;
      if(!await checkpoint(`shader-${i+1}`)){cleanup();return null;}
    }
    recordStartup('compile-complete');
    if(disposed||ownerSignal?.aborted||!owns()){cleanup();return null;}
    if(arrival==='pending'&&interrupted())interrupt();
    pose(cycle);positionCamera();
    ready=true;element.dataset.robotReady='true';element.dataset.robotFrames='0';
    if(poster)posterPose();else state();
    wake();
  }catch(error){if(owns()&&!disposed){element.dataset.robotReady='unavailable';element.dataset.robotPainted='false';element.dataset.robotFailure=error instanceof Error?error.message:'Scene preparation failed';stage.tabIndex=-1;}cleanup();return null;}
  return {
    id:'robot-studio',element,scene,camera,toneMapping:THREE.ACESFilmicToneMapping,toneMappingExposure:.94,
    measure(viewport){
      if(!canPresent()){if(owns())element.dataset.robotPainted='false';return null;}
      const rect=bounds(viewport);if(!rect){element.dataset.robotPainted='false';return null;}
      camera.aspect=rect.width/rect.height;camera.updateProjectionMatrix();return rect;
    },
    update(_now,dt){
      if(!eligible())return;
      if(!poster){
        const step=Math.min(dt,.05);
        if(arrival==='pending'){if(interrupted()){interrupt();}else{arrival='running';arrivalStart=_now;rememberArrival();element.dataset.robotArrival=arrival;}}
        if(arrival==='running'){
          arrivalAge=clamp((_now-arrivalStart)/1000,0,1.2);
          if(arrivalAge<.18)cycle=mix(4,10,arrivalAge/.18);
          else if(arrivalAge<.80)cycle=mix(10,18,(arrivalAge-.18)/.62);
          else cycle=mix(18,22,(arrivalAge-.80)/.40);
          if(arrivalAge>=1.2){arrival='complete';cycle=22;element.dataset.robotArrival=arrival;}
        }else{cycle+=step*replaySpeed;if(replaySpeed>1&&cycle>=22){cycle=22;replaySpeed=1;}}
        const response=1-Math.exp(-5*step);orbit+=(orbitTarget-orbit)*response;hover.lerp(hoverTarget,response);
        pose(cycle);positionCamera();frames++;element.dataset.robotFrames=String(frames);
      }
    },
    isAnimating(){return eligible()&&Boolean(bounds())&&(!poster||dirty);},
    setEnabled(value){enabled=value;if(!value){drag=undefined;interrupt();}state();dirty=true;if(value)wake();},
    setHeroMode(value){mode=value;state();dirty=true;if(value==='paper')wake();},
    setQuality(detail){const size=detail<.8?512:1024;if(key.shadow.mapSize.width!==size){key.shadow.mapSize.set(size,size);key.shadow.map?.dispose();key.shadow.map=null;}},
    presented(){if(canPresent()){element.dataset.robotPainted='true';dirty=false;}},
    dispose(){disposed=true;ready=false;state();if(owns()){element.dataset.robotReady='disposed';element.dataset.robotPainted='false';}cleanup();},
  };
}
