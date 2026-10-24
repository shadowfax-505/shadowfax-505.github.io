import * as THREE from 'three';

/** 3D reconstruction of an F450-class quadcopter like the 2019 school build. Not a scan of the original. */
export function createDrone(container: HTMLElement) {
  const canvas = container.querySelector<HTMLCanvasElement>('canvas');
  const noop = { setEnabled(_value: boolean) {}, dispose() {} };
  if (!canvas) return noop;
  let renderer: THREE.WebGLRenderer;
  try {
    const gl = canvas.getContext('webgl2', { alpha: true, antialias: true, powerPreference: 'low-power' });
    if (!gl) throw new Error('No WebGL');
    renderer = new THREE.WebGLRenderer({ canvas, context: gl, alpha: true, antialias: true, powerPreference: 'low-power' });
  } catch {
    container.dataset.webgl = 'unavailable';
    return noop;
  }
  renderer.setClearColor(0x000000, 0);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(38, 1, .1, 40);
  const initialYaw = Math.atan2(6.2, 7.6), initialPitch = .526;
  let cameraYaw = initialYaw, cameraPitch = initialPitch;
  let targetYaw = cameraYaw, targetPitch = cameraPitch, cameraDistance = 11.36;
  let yawVelocity = 0, pitchVelocity = 0;
  const controls = container.querySelector<HTMLElement>('[data-drone-controls]');
  const orbitSurface = container.querySelector<HTMLElement>('[data-drone-orbit]');
  const flightButtons = [...container.querySelectorAll<HTMLButtonElement>('[data-drone-flight]')];
  const viewButtons = [...container.querySelectorAll<HTMLButtonElement>('[data-drone-view]')];
  let flightMode: 'hover' | 'orbit' = 'hover';
  scene.add(new THREE.HemisphereLight(0xeef0e8, 0x2a2d31, 2.0));
  const key = new THREE.DirectionalLight(0xfff1dc, 3.4);
  key.position.set(-3, 6, 4); scene.add(key);
  const rim = new THREE.DirectionalLight(0xbcd0e6, 1.6);
  rim.position.set(5, 2, -5); scene.add(rim);
  const rig = new THREE.Group();
  rig.rotation.y = -.15;
  scene.add(rig);
  // F450-class quadcopter, modelled at 1 unit = 100 mm and scaled to frame: 450 mm motor-to-motor diagonal,
  // glass-fibre centre plates, nylon arms (red = front), 2212-size motors, 10-inch props, 3S pack, GPS mast.
  const airframe = new THREE.Group(); airframe.scale.setScalar(.82); rig.add(airframe);
  const materials = {
    plate: new THREE.MeshStandardMaterial({ color: 0x1f2226, metalness: .2, roughness: .55 }),
    pcb: new THREE.MeshStandardMaterial({ color: 0x23272c, metalness: .25, roughness: .5 }),
    pad: new THREE.MeshStandardMaterial({ color: 0xc9a24b, metalness: .85, roughness: .3 }),
    armFront: new THREE.MeshStandardMaterial({ color: 0xc7372b, metalness: .05, roughness: .6 }),
    armRear: new THREE.MeshStandardMaterial({ color: 0xe7e3da, metalness: .05, roughness: .62 }),
    motorBase: new THREE.MeshStandardMaterial({ color: 0x2b2e33, metalness: .6, roughness: .35 }),
    bell: new THREE.MeshStandardMaterial({ color: 0xb9bcc0, metalness: .85, roughness: .28 }),
    battery: new THREE.MeshStandardMaterial({ color: 0x30343a, metalness: .2, roughness: .6 }),
    label: new THREE.MeshStandardMaterial({ color: 0xd8a422, metalness: .1, roughness: .55 }),
    esc: new THREE.MeshStandardMaterial({ color: 0x3f6fb6, metalness: .1, roughness: .55 }),
    fc: new THREE.MeshStandardMaterial({ color: 0x141619, metalness: .3, roughness: .45 }),
    gps: new THREE.MeshStandardMaterial({ color: 0x1a1c20, metalness: .3, roughness: .4 }),
    redWire: new THREE.MeshStandardMaterial({ color: 0xb8322a, roughness: .5 }),
    blackWire: new THREE.MeshStandardMaterial({ color: 0x18191b, roughness: .5 }),
    blade: new THREE.MeshStandardMaterial({ color: 0x222428, metalness: .1, roughness: .45, side: THREE.DoubleSide }),
    bladeFront: new THREE.MeshStandardMaterial({ color: 0xd04a2a, metalness: .1, roughness: .45, side: THREE.DoubleSide }),
    strap: new THREE.MeshStandardMaterial({ color: 0x111214, roughness: .8 }),
    led: new THREE.MeshBasicMaterial({ color: 0x4fd18b }),
    blur: new THREE.MeshBasicMaterial({ color: 0x9aa0a6, transparent: true, opacity: .07, side: THREE.DoubleSide, depthWrite: false }),
  };
  function mesh(geometry: THREE.BufferGeometry, material: THREE.Material, position: [number,number,number], parent: THREE.Object3D = airframe) {
    const item = new THREE.Mesh(geometry, material);
    item.position.set(...position); parent.add(item); return item;
  }
  function box(w: number,h: number,d: number, material: THREE.Material, position: [number,number,number], parent: THREE.Object3D = airframe) {
    return mesh(new THREE.BoxGeometry(w,h,d),material,position,parent);
  }
  // Centre plates: chamfered squares, top glass-fibre, bottom the power-distribution PCB.
  const plateShape = new THREE.Shape();
  const half = .78, cham = .32;
  plateShape.moveTo(-half+cham,-half); plateShape.lineTo(half-cham,-half); plateShape.lineTo(half,-half+cham); plateShape.lineTo(half,half-cham);
  plateShape.lineTo(half-cham,half); plateShape.lineTo(-half+cham,half); plateShape.lineTo(-half,half-cham); plateShape.lineTo(-half,-half+cham); plateShape.closePath();
  const plateGeo = new THREE.ExtrudeGeometry(plateShape, { depth: .03, bevelEnabled: false });
  const top = mesh(plateGeo, materials.plate, [0,.32,0]); top.rotation.x = -Math.PI/2; top.rotation.z = Math.PI/4;
  const bottom = mesh(plateGeo, materials.pcb, [0,0,0]); bottom.rotation.x = -Math.PI/2; bottom.rotation.z = Math.PI/4;
  [[.36,0],[-.36,0],[0,.36],[0,-.36]].forEach(([x,z])=>box(.16,.012,.1,materials.pad,[x,.036,z]));
  // Flight controller, status LED and receiver on the top plate.
  box(.5,.13,.5,materials.fc,[0,.42,.05]);
  mesh(new THREE.SphereGeometry(.028,8,6),materials.led,[.18,.49,.25]);
  box(.3,.08,.2,materials.fc,[0,.39,-.45]);
  mesh(new THREE.CylinderGeometry(.006,.006,.55,5),materials.blackWire,[.12,.66,-.5]).rotation.z = .5;
  // GPS on a folding mast at the rear.
  mesh(new THREE.CylinderGeometry(.022,.022,.85,8),materials.motorBase,[0,.76,-.32]);
  mesh(new THREE.CylinderGeometry(.3,.3,.09,28),materials.gps,[0,1.2,-.32]);
  const gpsArrow = new THREE.Shape(); gpsArrow.moveTo(0,.16); gpsArrow.lineTo(.09,-.06); gpsArrow.lineTo(0,-.01); gpsArrow.lineTo(-.09,-.06); gpsArrow.closePath();
  const arrow = mesh(new THREE.ShapeGeometry(gpsArrow), materials.armRear, [0,1.247,-.32]); arrow.rotation.x = -Math.PI/2;
  // 3S LiPo strapped under the bottom plate.
  box(1.05,.24,.34,materials.battery,[0,-.17,0]).rotation.y = Math.PI/2;
  box(.36,.245,.6,materials.label,[0,-.17,.12]);
  [-.25,.25].forEach(z=>box(.4,.27,.05,materials.strap,[0,-.17,z]));
  const rotorGroups: THREE.Group[] = [];
  for (let i=0;i<4;i++) {
    // i 0,1 front (red arms), 2,3 rear. Front is +z.
    const angle = [Math.PI/4, 3*Math.PI/4, 5*Math.PI/4, 7*Math.PI/4][i];
    const dx = Math.sin(angle), dz = Math.cos(angle);
    const front = dz > 0;
    const armMat = front ? materials.armFront : materials.armRear;
    // Arm: deep at the root, tapering to the motor pad.
    const armGroup = new THREE.Group(); armGroup.rotation.y = angle - Math.PI/2; airframe.add(armGroup);
    const armShape = new THREE.Shape();
    armShape.moveTo(.42,-.13); armShape.lineTo(2.08,-.09); armShape.lineTo(2.08,.09); armShape.lineTo(.42,.13); armShape.closePath();
    const armGeo = new THREE.ExtrudeGeometry(armShape,{depth:.24,bevelEnabled:true,bevelSize:.012,bevelThickness:.012,bevelSegments:1});
    armGeo.translate(0,0,-.12);
    mesh(armGeo,armMat,[0,.16,0],armGroup);
    const mx = dx*2.25, mz = dz*2.25;
    mesh(new THREE.CylinderGeometry(.24,.24,.04,24),armMat,[mx,.2,mz]);
    // ESC under the arm with its leads.
    const esc = box(.5,.07,.2,materials.esc,[dx*1.15,.02,dz*1.15]); esc.rotation.y = angle - Math.PI/2;
    [ -.025, .025 ].forEach((o,k)=>{
      const pts=[new THREE.Vector3(dx*.55+o,.05,dz*.55-o),new THREE.Vector3(dx*.9+o,.0,dz*.9-o),new THREE.Vector3(dx*1.4+o,.03,dz*1.4-o),new THREE.Vector3(mx*.92,.2,mz*.92)];
      mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts),14,.013,5,false),k?materials.blackWire:materials.redWire,[0,0,0]);
    });
    // Motor: base, bell, shaft.
    mesh(new THREE.CylinderGeometry(.15,.16,.12,24),materials.motorBase,[mx,.28,mz]);
    mesh(new THREE.CylinderGeometry(.14,.14,.16,24),materials.bell,[mx,.42,mz]);
    const rotor = new THREE.Group(); rotor.position.set(mx,.53,mz); airframe.add(rotor);
    rotorGroups.push(rotor);
    // 10-inch two-blade prop (radius 1.27).
    const shape = new THREE.Shape();
    shape.moveTo(0,-.05); shape.bezierCurveTo(.4,-.17,1.05,-.14,1.27,-.03);
    shape.bezierCurveTo(1.0,.06,.38,.12,0,.05);
    shape.bezierCurveTo(-.38,.17,-1.05,.14,-1.27,.03);
    shape.bezierCurveTo(-1.0,-.06,-.4,-.12,0,-.05);
    const blade = mesh(new THREE.ShapeGeometry(shape,18),front?materials.bladeFront:materials.blade,[0,0,0],rotor);
    blade.rotation.x = -Math.PI/2; blade.rotation.z = i * .7;
    mesh(new THREE.CylinderGeometry(.05,.07,.09,12),materials.bell,[0,.03,0],rotor);
    const blur = mesh(new THREE.CircleGeometry(1.27,48),materials.blur,[mx,.52,mz]);
    blur.rotation.x = -Math.PI/2;
    // Landing leg under the arm root.
    mesh(new THREE.CylinderGeometry(.035,.035,.9,8),materials.armRear,[dx*.85,-.42,dz*.85]);
    const foot = mesh(new THREE.SphereGeometry(.06,10,8),materials.strap,[dx*.85,-.88,dz*.85]); foot.scale.y = .6;
  }
  const cssInk = getComputedStyle(document.documentElement).getPropertyValue('--field-ink').trim().split(/\s+/).map(Number);
  const gridColor = new THREE.Color((cssInk[0]||22)/255,(cssInk[1]||24)/255,(cssInk[2]||27)/255);
  const grid = new THREE.GridHelper(8,16,gridColor,gridColor);
  grid.position.y=-1.16; scene.add(grid);
  const gridMaterial = grid.material as THREE.Material;
  gridMaterial.transparent=true; gridMaterial.opacity=.16;
  const shadow = mesh(new THREE.CircleGeometry(1.9,40),new THREE.MeshBasicMaterial({color:0x000000,transparent:true,opacity:.07,depthWrite:false}),[0,-1.14,0],scene);
  shadow.rotation.x=-Math.PI/2; shadow.scale.y=.8;
  // A flight-study guide, deliberately illustrative rather than a measured trajectory.
  const orbitPoints = Array.from({length:97},(_,i)=>{
    const angle=i/96*Math.PI*2;
    return new THREE.Vector3(Math.cos(angle)*2.9,-1.13,Math.sin(angle)*2.9);
  });
  const orbitGuide = new THREE.Line(new THREE.BufferGeometry().setFromPoints(orbitPoints),new THREE.LineDashedMaterial({color:0xc2410c,transparent:true,opacity:.34,dashSize:.07,gapSize:.12}));
  orbitGuide.computeLineDistances(); orbitGuide.visible=false; scene.add(orbitGuide);
  // A moving ground trace is a visual study, not a recovered flight record.
  const trailGeometry = new THREE.BufferGeometry();
  const trailPositions = new Float32Array(64 * 3), trailColors = new Float32Array(64 * 3);
  for(let i=0;i<64;i++){const a=i/63;trailColors.set([.76*a,.25*a,.05*a],i*3);}
  trailGeometry.setAttribute('position',new THREE.BufferAttribute(trailPositions,3));
  trailGeometry.setAttribute('color',new THREE.BufferAttribute(trailColors,3));
  const flightTrail=new THREE.Line(trailGeometry,new THREE.LineBasicMaterial({vertexColors:true,transparent:true,opacity:.5,depthWrite:false}));
  flightTrail.frustumCulled=false;scene.add(flightTrail);
  const trailBeacon=mesh(new THREE.SphereGeometry(.035,8,6),new THREE.MeshBasicMaterial({color:0xc2410c}),[2.9,-1.05,0],scene);
  function traceFlight(time:number){
    for(let i=0;i<64;i++){const a=time*.36-(1-i/63)*1.3;trailPositions.set([Math.cos(a)*2.9,-1.08,Math.sin(a)*2.9],i*3);}
    trailGeometry.attributes.position.needsUpdate=true;
    trailBeacon.position.set(Math.cos(time*.36)*2.9,-1.05,Math.sin(time*.36)*2.9);
  }
  traceFlight(0);
  let contextLost=false, enabled=false, disposed=false, frame=0, previous=0, elapsed=0, targetX=0, targetY=0;
  let pointerId: number | null = null, dragX=0, dragY=0, downX=0, downY=0, dragTime=0, dragStarted=false;
  function updateCamera() {
    camera.position.set(
      Math.sin(cameraYaw)*Math.cos(cameraPitch)*cameraDistance,
      Math.sin(cameraPitch)*cameraDistance,
      Math.cos(cameraYaw)*Math.cos(cameraPitch)*cameraDistance
    );
    camera.lookAt(0,-.32,0);
  }
  function renderOnce() {
    if(disposed || contextLost || document.hidden || container.dataset.visible==='false') return;
    updateCamera(); renderer.render(scene,camera);
  }
  function pose() {
    const orbit=flightMode==='orbit', phase=elapsed*.52;
    rig.position.set(orbit ? Math.sin(phase)*.48 : 0,orbit ? .13+Math.sin(phase*2)*.13 : Math.sin(elapsed*.95)*.09,orbit ? Math.cos(phase)*.32 : 0);
    rig.rotation.x=THREE.MathUtils.lerp(rig.rotation.x,(orbit?Math.sin(phase)*.13:Math.sin(elapsed*.62)*.035)+targetY*.18,.08);
    rig.rotation.z=THREE.MathUtils.lerp(rig.rotation.z,(orbit?-.16+Math.cos(phase)*.08:Math.sin(elapsed*.8)*.035)-targetX*.18,.08);
    rig.rotation.y=orbit?-.15-phase:-.15+Math.sin(elapsed*.25)*.12+targetX*.35;
    shadow.position.x=rig.position.x; shadow.position.z=rig.position.z;
    shadow.scale.setScalar(1+rig.position.y*.22);
  }
  function render(now: number) {
    if (!enabled || disposed) return;
    frame=requestAnimationFrame(render);
    if (now-previous<1000/30) return;
    const delta=Math.min((now-previous)/1000,.08); previous=now; elapsed+=delta;
    if(pointerId===null) {
      targetYaw+=yawVelocity*delta;
      targetPitch=THREE.MathUtils.clamp(targetPitch+pitchVelocity*delta,.18,1.1);
      const friction=Math.exp(-delta*6.5);
      yawVelocity*=friction; pitchVelocity*=friction;
      if(Math.abs(yawVelocity)<.003) yawVelocity=0;
      if(Math.abs(pitchVelocity)<.003) pitchVelocity=0;
    }
    const cameraEase=1-Math.exp(-delta*13);
    cameraYaw=THREE.MathUtils.lerp(cameraYaw,targetYaw,cameraEase);
    cameraPitch=THREE.MathUtils.lerp(cameraPitch,targetPitch,cameraEase);
    pose(); traceFlight(elapsed);
    rotorGroups.forEach((rotor,i)=>{ rotor.rotation.y+=delta*(i%2?-1:1)*(flightMode==='orbit'?62:38); });
    updateCamera();
    renderer.render(scene,camera);
  }
  function releasePointer() {
    const released=pointerId; pointerId=null; dragStarted=false;
    container.dataset.dragging='false';
    if(released!==null && orbitSurface?.hasPointerCapture(released)) orbitSurface.releasePointerCapture(released);
  }
  function setEnabled(value: boolean) {
    value = value && !contextLost;
    if(disposed || value===enabled) return;
    enabled=value;
    cancelAnimationFrame(frame);
    if(!enabled) {
      releasePointer(); yawVelocity=pitchVelocity=0; targetX=targetY=0;
      // Pausing freezes the current frame, including camera easing and rotor phase.
      targetYaw=cameraYaw; targetPitch=cameraPitch;
    }
    if(enabled){previous=performance.now();frame=requestAnimationFrame(render);}
  }
  function resize() {
    const {width,height}=container.getBoundingClientRect();
    if(!width||!height||disposed||contextLost) return;
    renderer.setSize(width,height,false); camera.aspect=width/height;
    cameraDistance=11.36*(camera.aspect<1.2?1.18:1);
    camera.updateProjectionMatrix();renderOnce();
  }
  function pointer(event: PointerEvent) {
    if(event.pointerType==='touch'||!enabled||pointerId!==null||event.target instanceof Element && event.target.closest('.drone-toolbar')) return;
    const bounds=container.getBoundingClientRect();
    targetX=THREE.MathUtils.clamp((event.clientX-bounds.left)/bounds.width-.5,-.5,.5);
    targetY=THREE.MathUtils.clamp((event.clientY-bounds.top)/bounds.height-.5,-.5,.5);
  }
  function leave(){targetX=targetY=0;}
  function manualCamera() {
    yawVelocity=pitchVelocity=0;
    if(!enabled) {cameraYaw=targetYaw;cameraPitch=targetPitch;renderOnce();}
  }
  function resetView() {targetYaw=initialYaw;targetPitch=initialPitch;manualCamera();}
  function replayStudy() {elapsed=0;resetView();pose();renderOnce();}
  function view(event: Event) {
    const value=(event.currentTarget as HTMLButtonElement).dataset.droneView;
    if(value==='reset') resetView();
    else {targetYaw+=(value==='left'?-1:1)*Math.PI/6;manualCamera();}
  }
  function flight(event: Event) {
    flightMode=(event.currentTarget as HTMLButtonElement).dataset.droneFlight==='orbit'?'orbit':'hover';
    container.dataset.flightMode=flightMode;
    flightButtons.forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.droneFlight===flightMode)));
    orbitGuide.visible=flightMode==='orbit';
    materials.blur.opacity=flightMode==='orbit' ? .1 : .07;
    if(!enabled) {pose();renderOnce();}
  }
  function dragDown(event: PointerEvent) {
    if(disposed||contextLost||pointerId!==null||event.button!==0) return;
    pointerId=event.pointerId; dragX=downX=event.clientX;dragY=downY=event.clientY;
    dragTime=performance.now();dragStarted=event.pointerType!=='touch';
    yawVelocity=pitchVelocity=0;targetX=targetY=0;
    if(dragStarted) container.dataset.dragging='true';
    orbitSurface?.setPointerCapture(event.pointerId);
    if(event.pointerType!=='touch') event.preventDefault();
  }
  function dragMove(event: PointerEvent) {
    if(pointerId!==event.pointerId) return;
    if(!dragStarted) {
      const horizontal=Math.abs(event.clientX-downX), vertical=Math.abs(event.clientY-downY);
      // Vertical gestures belong to the page, including inside the artwork.
      if(vertical>10 && vertical>horizontal) {releasePointer();return;}
      if(horizontal<8 || horizontal<vertical*1.3) return;
      dragStarted=true;container.dataset.dragging='true';
    }
    const now=performance.now(), delta=Math.max((now-dragTime)/1000,.016);
    const dx=(event.clientX-dragX)*.008,dy=(event.clientY-dragY)*.006;
    targetYaw-=dx; targetPitch=THREE.MathUtils.clamp(targetPitch+dy,.18,1.1);
    yawVelocity=THREE.MathUtils.clamp(-dx/delta,-2.5,2.5);
    pitchVelocity=THREE.MathUtils.clamp(dy/delta,-1.2,1.2);
    dragX=event.clientX;dragY=event.clientY;dragTime=now;
    if(!enabled) {cameraYaw=targetYaw;cameraPitch=targetPitch;renderOnce();}
    if(event.cancelable) event.preventDefault();
  }
  function dragEnd(event: PointerEvent) {
    if(pointerId!==event.pointerId) return;
    if(event.type!=='pointerup'||!enabled||performance.now()-dragTime>100) yawVelocity=pitchVelocity=0;
    releasePointer();
  }
  function orbitKeys(event: KeyboardEvent) {
    if(!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Home'].includes(event.key)) return;
    event.preventDefault();
    if(event.key==='Home') {resetView();return;}
    if(event.key==='ArrowLeft') targetYaw-=Math.PI/12;
    if(event.key==='ArrowRight') targetYaw+=Math.PI/12;
    if(event.key==='ArrowUp') targetPitch=THREE.MathUtils.clamp(targetPitch+.09,.18,1.1);
    if(event.key==='ArrowDown') targetPitch=THREE.MathUtils.clamp(targetPitch-.09,.18,1.1);
    manualCamera();
  }
  function lost(event: Event){event.preventDefault();setEnabled(false);contextLost=true;container.dataset.webgl='unavailable';if(controls) controls.hidden=true;}
  canvas.addEventListener('webglcontextlost',lost);
  container.addEventListener('pointermove',pointer,{passive:true});
  container.addEventListener('pointerleave',leave);
  container.addEventListener('portfolio:replay-drone',replayStudy);
  orbitSurface?.addEventListener('pointerdown',dragDown);
  orbitSurface?.addEventListener('pointermove',dragMove);
  orbitSurface?.addEventListener('pointerup',dragEnd);
  orbitSurface?.addEventListener('pointercancel',dragEnd);
  orbitSurface?.addEventListener('lostpointercapture',dragEnd);
  orbitSurface?.addEventListener('keydown',orbitKeys);
  flightButtons.forEach(button=>button.addEventListener('click',flight));
  viewButtons.forEach(button=>button.addEventListener('click',view));
  const observer=new ResizeObserver(resize);observer.observe(container);
  resize();container.dataset.webgl='ready';container.dataset.flightMode='hover';
  if(controls) controls.hidden=false;
  if(orbitSurface) orbitSurface.hidden=false;
  return {setEnabled,dispose(){
    setEnabled(false);releasePointer();disposed=true;observer.disconnect();
    canvas.removeEventListener('webglcontextlost',lost);
    container.removeEventListener('pointermove',pointer);container.removeEventListener('pointerleave',leave);container.removeEventListener('portfolio:replay-drone',replayStudy);
    orbitSurface?.removeEventListener('pointerdown',dragDown);
    orbitSurface?.removeEventListener('pointermove',dragMove);
    orbitSurface?.removeEventListener('pointerup',dragEnd);
    orbitSurface?.removeEventListener('pointercancel',dragEnd);
    orbitSurface?.removeEventListener('lostpointercapture',dragEnd);
    orbitSurface?.removeEventListener('keydown',orbitKeys);
    flightButtons.forEach(button=>button.removeEventListener('click',flight));
    viewButtons.forEach(button=>button.removeEventListener('click',view));
    if(controls) controls.hidden=true;
    if(orbitSurface) orbitSurface.hidden=true;
    const geometries=new Set<THREE.BufferGeometry>(), mats=new Set<THREE.Material>();
    scene.traverse(object=>{if(object instanceof THREE.Mesh || object instanceof THREE.Line){geometries.add(object.geometry);(Array.isArray(object.material)?object.material:[object.material]).forEach(material=>mats.add(material));}});
    geometries.forEach(geometry=>geometry.dispose());mats.forEach(material=>material.dispose());renderer.dispose();
  }};
}
