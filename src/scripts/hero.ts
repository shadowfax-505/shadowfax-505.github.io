import * as THREE from 'three';

export function createHero(container: HTMLElement, initialEnabled: boolean) {
  const canvas = container.querySelector<HTMLCanvasElement>('canvas');
  if (!canvas) return { setEnabled() {}, setForm() {}, dispose() {} };
  const gl = canvas.getContext('webgl2', { alpha: true, antialias: false, powerPreference: 'low-power' });
  if (!gl) { container.dataset.webgl = 'unavailable'; return { setEnabled() {}, setForm() {}, dispose() {} }; }
  let renderer: THREE.WebGLRenderer;
  try { renderer = new THREE.WebGLRenderer({ canvas, context: gl, antialias: false, alpha: true, powerPreference: 'low-power' }); }
  catch { container.dataset.webgl = 'unavailable'; return { setEnabled() {}, setForm() {}, dispose() {} }; }

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(42, 1, .1, 50);
  camera.position.z = 8;
  const group = new THREE.Group();
  group.rotation.set(-.28, -.2, -.28);
  scene.add(group);
  const columns = window.innerWidth < 600 ? 34 : 50;
  const rows = window.innerWidth < 600 ? 22 : 32;
  const count = columns * rows;
  const wave = new Float32Array(count * 3);
  const circuit = new Float32Array(count * 3);
  const stars = new Float32Array(count * 3);
  const indices: number[] = [];
  for (let i = 0; i < count; i++) {
    const u = (i % columns) / (columns - 1);
    const v = Math.floor(i / columns) / (rows - 1);
    // The 3D opening echoes the folded ribbon drawn in the server-rendered SVG.
    const angleAround = u * Math.PI * 2;
    const across = (v - .5) * 1.55;
    const ribbonRadius = 1.8 + across * Math.cos(angleAround / 2);
    wave.set([ribbonRadius * Math.cos(angleAround), ribbonRadius * Math.sin(angleAround) * .78, across * Math.sin(angleAround / 2)], i * 3);
    const lane = Math.round(v * 11) / 11;
    const elbow = Math.sin(u * Math.PI * 2) > 0 ? .25 : -.25;
    circuit.set([(u - .5) * 4.7, (lane - .5) * 3.2 + (u > .37 && u < .63 ? elbow : 0), Math.sin(lane * 16) * .22], i * 3);
    const y = 1 - 2 * (i + .5) / count;
    const radius = Math.sqrt(1 - y * y);
    const angle = i * Math.PI * (3 - Math.sqrt(5));
    stars.set([Math.cos(angle) * radius * 2.05, y * 2.05, Math.sin(angle) * radius * 2.05], i * 3);
    if (i % columns < columns - 1) indices.push(i, i + 1);
    if (i + columns < count && i % 3 === 0) indices.push(i, i + columns);
  }
  const impulses = Array.from({ length: 4 }, () => new THREE.Vector4(0, 0, -100, 0));
  const uniforms = {
    uMorph: { value: 0 }, uTime: { value: 0 }, uPixelRatio: { value: 1 },
    uPointer: { value: new THREE.Vector3() }, uPointerStrength: { value: 0 },
    uImpulses: { value: impulses }, uFormPulse: { value: 0 },
  };
  const vertexShader = `
    attribute vec3 aCircuit;
    attribute vec3 aStars;
    uniform float uMorph;
    uniform float uTime;
    uniform float uPixelRatio;
    uniform vec3 uPointer;
    uniform float uPointerStrength;
    uniform vec4 uImpulses[4];
    uniform float uFormPulse;
    varying float vDepth;
    varying float vEnergy;
    void main(){
      vec3 p = mix(position, aCircuit, smoothstep(0.0, 1.0, min(uMorph, 1.0)));
      p = mix(p, aStars, smoothstep(0.0, 1.0, max(0.0, uMorph - 1.0)));
      vec3 toPointer = uPointer - p;
      float influence = exp(-dot(toPointer, toPointer) * 1.2) * uPointerStrength;
      p.xy += toPointer.xy * influence * .13;
      p.z += influence * .5;
      float energy = influence * .8;
      for (int i = 0; i < 4; i++) {
        float age = max(0.0, uTime - uImpulses[i].z);
        vec2 delta = p.xy - uImpulses[i].xy;
        float distanceFromPulse = length(delta);
        float front = distanceFromPulse - age * 2.1;
        float envelope = exp(-front * front * 5.5) * exp(-age * .9) * uImpulses[i].w;
        float displacement = cos(front * 8.0) * envelope;
        p.z += displacement * .38;
        p.xy += delta / max(distanceFromPulse, .01) * displacement * .075;
        energy += envelope * .75;
      }
      p *= 1.0 + uFormPulse * .045;
      p.y += sin(uTime * .85 + p.x * 1.7) * .045;
      p.z += sin(uTime * .6 + p.y * 2.2 + p.x) * .035;
      vec4 mv = modelViewMatrix * vec4(p, 1.0);
      gl_Position = projectionMatrix * mv;
      gl_PointSize = clamp((18.0 + energy * 8.0) * uPixelRatio / -mv.z, 1.0, 5.5);
      vDepth = clamp((p.z + 2.2) / 4.4, 0.0, 1.0);
      vEnergy = clamp(energy + uFormPulse * .3, 0.0, 1.0);
    }`;
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(wave, 3));
  geometry.setAttribute('aCircuit', new THREE.BufferAttribute(circuit, 3));
  geometry.setAttribute('aStars', new THREE.BufferAttribute(stars, 3));
  const pointMaterial = new THREE.ShaderMaterial({ uniforms, vertexShader, transparent: true, depthWrite: false, blending: THREE.NormalBlending, fragmentShader: `varying float vDepth; varying float vEnergy; void main(){float d=length(gl_PointCoord-vec2(.5));float a=1.0-smoothstep(.12,.5,d);vec3 color=mix(vec3(.72,.23,.15),vec3(.14,.29,.63),vEnergy*.8);gl_FragColor=vec4(color,a*(.5+vDepth*.4));}` });
  const points = new THREE.Points(geometry, pointMaterial);
  points.frustumCulled = false;
  group.add(points);
  const lineGeometry = new THREE.BufferGeometry();
  lineGeometry.setAttribute('position', geometry.getAttribute('position'));
  lineGeometry.setAttribute('aCircuit', geometry.getAttribute('aCircuit'));
  lineGeometry.setAttribute('aStars', geometry.getAttribute('aStars'));
  lineGeometry.setIndex(indices);
  const lineMaterial = new THREE.ShaderMaterial({ uniforms, vertexShader, transparent: true, depthWrite: false, fragmentShader: `varying float vDepth;varying float vEnergy;void main(){vec3 color=mix(vec3(.15,.16,.12),vec3(.72,.23,.15),vEnergy*.7);gl_FragColor=vec4(color,.12+vDepth*.2+vEnergy*.12);}` });
  const lines = new THREE.LineSegments(lineGeometry, lineMaterial);
  lines.frustumCulled = false;
  group.add(lines);
  const ringPoints = Array.from({ length: 181 }, (_, i) => {
    const t = i / 180 * Math.PI * 2;
    return new THREE.Vector3(Math.cos(t) * 2.95, Math.sin(t) * 1.68, Math.sin(t) * .6);
  });
  const ringGeometry = new THREE.BufferGeometry().setFromPoints(ringPoints);
  const ringMaterial = new THREE.LineBasicMaterial({ color: 0xb83a26, transparent: true, opacity: .23 });
  const ring = new THREE.LineLoop(ringGeometry, ringMaterial);
  ring.rotation.z = -.55;
  group.add(ring);

  const orbitMaterial = new THREE.LineBasicMaterial({ color: 0x2349a0, transparent: true, opacity: .12 });
  const orbit = new THREE.LineLoop(ringGeometry, orbitMaterial);
  orbit.rotation.set(.72, -.35, .28);
  group.add(orbit);

  let enabled = initialEnabled;
  let visible = true;
  let disposed = false;
  let contextLost = false;
  let frame = 0;
  let last = 0;
  let elapsed = 0;
  let target = 0;
  let morphVelocity = 0;
  let formPulse = 0;
  let nextImpulse = 0;
  const pointer = new THREE.Vector2();
  const pointerTarget = new THREE.Vector2();
  let pointerActive = 0;
  const raycaster = new THREE.Raycaster();
  const pointerPlane = new THREE.Plane();
  const planeNormal = new THREE.Vector3();
  const projectedPointer = new THREE.Vector3();
  const localPointer = new THREE.Vector3();
  const orbitRotation = new THREE.Euler();
  const orbitQuaternion = new THREE.Quaternion();
  const clamp = THREE.MathUtils.clamp;
  const canAnimate = () => enabled && visible && !document.hidden && !contextLost && !disposed;
  const onPointer = (event: PointerEvent) => {
    if (!canAnimate()) return;
    const box = container.getBoundingClientRect();
    if (!box.width || !box.height) return;
    pointerTarget.set(
      clamp((event.clientX - box.left) / box.width * 2 - 1, -1, 1),
      clamp(1 - (event.clientY - box.top) / box.height * 2, -1, 1),
    );
    pointerActive = 1;
  };
  container.addEventListener('pointermove', onPointer, { passive: true });
  const onPointerLeave = () => { pointerTarget.set(0, 0); pointerActive = 0; };
  container.addEventListener('pointerleave', onPointerLeave);
  container.addEventListener('pointercancel', onPointerLeave);

  function projectToField(normalized: THREE.Vector2, result: THREE.Vector3) {
    camera.getWorldDirection(planeNormal);
    pointerPlane.setFromNormalAndCoplanarPoint(planeNormal, group.position);
    raycaster.setFromCamera(normalized, camera);
    if (raycaster.ray.intersectPlane(pointerPlane, projectedPointer)) {
      result.copy(projectedPointer);
      group.worldToLocal(result);
      // Keep a tap in empty space close enough to reach the folded surface.
      result.x = clamp(result.x, -3.1, 3.1);
      result.y = clamp(result.y, -2.5, 2.5);
      result.z = clamp(result.z, -.9, .9);
    }
  }
  const pulsePointer = new THREE.Vector2();
  const pulseOrigin = new THREE.Vector3();
  const onPulse = (event: Event) => {
    if (!canAnimate()) return;
    const detail = (event as CustomEvent<{ x?: number; y?: number }>).detail;
    const x = Number.isFinite(detail?.x) ? detail.x! : 0;
    const y = Number.isFinite(detail?.y) ? detail.y! : 0;
    pulsePointer.set(clamp(x, -.5, .5) * 2, -clamp(y, -.5, .5) * 2);
    group.updateMatrixWorld();
    projectToField(pulsePointer, pulseOrigin);
    impulses[nextImpulse].set(pulseOrigin.x, pulseOrigin.y, elapsed, 1);
    nextImpulse = (nextImpulse + 1) % impulses.length;
    formPulse = Math.max(formPulse, .5);
  };
  container.addEventListener('portfolio:hero-pulse', onPulse);
  function resize() {
    const { width, height } = container.getBoundingClientRect();
    const ratio = Math.min(window.devicePixelRatio, window.innerWidth < 600 ? 1.25 : 1.6);
    renderer.setPixelRatio(ratio);
    renderer.setSize(width, height, false);
    camera.aspect = width / Math.max(height, 1);
    camera.updateProjectionMatrix();
    uniforms.uPixelRatio.value = ratio;
  }
  const resizeObserver = new ResizeObserver(resize);
  resizeObserver.observe(container);
  resize();
  function tick(time: number) {
    if (!canAnimate()) { frame = 0; last = 0; return; }
    frame = requestAnimationFrame(tick);
    if (last && time - last < 1000 / 30) return;
    const delta = last ? Math.min((time - last) / 1000, .05) : 1 / 30;
    last = time;
    // Simulation time freezes when paused or outside the viewport.
    elapsed += delta;
    uniforms.uTime.value = elapsed;
    morphVelocity += (target - uniforms.uMorph.value) * 38 * delta;
    morphVelocity *= Math.exp(-10 * delta);
    uniforms.uMorph.value = clamp(uniforms.uMorph.value + morphVelocity * delta, 0, 2);
    formPulse *= Math.exp(-3.8 * delta);
    uniforms.uFormPulse.value = formPulse;
    const response = 1 - Math.exp(-5 * delta);
    pointer.lerp(pointerTarget, response);
    uniforms.uPointerStrength.value += (pointerActive - uniforms.uPointerStrength.value) * response;
    orbitRotation.set(
      -.28 - pointer.y * .28 + Math.sin(elapsed * .21) * .055,
      -.2 + pointer.x * .42 + Math.sin(elapsed * .16) * .23,
      -.28 - pointer.x * .075 + Math.sin(elapsed * .13) * .045,
    );
    orbitQuaternion.setFromEuler(orbitRotation);
    group.quaternion.slerp(orbitQuaternion, response);
    group.position.y = Math.sin(elapsed * .55) * .065;
    camera.position.x += (pointer.x * .16 - camera.position.x) * response;
    camera.position.y += (pointer.y * .1 - camera.position.y) * response;
    camera.position.z += (8 - formPulse * .15 - camera.position.z) * response;
    camera.lookAt(0, 0, 0);
    camera.updateMatrixWorld();
    group.updateMatrixWorld();
    projectToField(pointer, localPointer);
    uniforms.uPointer.value.lerp(localPointer, response);
    ring.rotation.z = -.55 + Math.sin(elapsed * .32) * .13 + pointer.x * .12;
    ring.rotation.y = Math.sin(elapsed * .23) * .1;
    ringMaterial.opacity = .21 + formPulse * .15;
    orbit.rotation.z = .28 - elapsed * .035;
    orbit.rotation.x = .72 + Math.sin(elapsed * .25) * .1;
    orbitMaterial.opacity = .1 + uniforms.uPointerStrength.value * .06;
    renderer.render(scene, camera);
  }
  function reconcile() {
    if (disposed || contextLost) return;
    container.dataset.webgl = enabled ? 'ready' : 'paused';
    if (canAnimate() && !frame) {
      last = 0;
      frame = requestAnimationFrame(tick);
    } else if (!canAnimate()) {
      if (frame) cancelAnimationFrame(frame);
      frame = 0;
      last = 0;
      pointerActive = 0;
      pointerTarget.set(0, 0);
    }
  }
  const observer = new IntersectionObserver(entries => { visible = entries[0].isIntersecting; reconcile(); }, { rootMargin: '40px' });
  observer.observe(container);
  document.addEventListener('visibilitychange', reconcile);
  const onContextLost = (event: Event) => { event.preventDefault(); contextLost = true; enabled = false; container.dataset.webgl = 'unavailable'; if(frame)cancelAnimationFrame(frame);frame=0; };
  canvas.addEventListener('webglcontextlost', onContextLost);
  renderer.render(scene, camera);
  reconcile();
  return {
    setEnabled(value: boolean) { if (contextLost) return; enabled = value; reconcile(); },
    setForm(index: number) { if (!Number.isFinite(index)) return; target = clamp(index, 0, 2); formPulse = 1; },
    dispose() {
      disposed = true;
      cancelAnimationFrame(frame);
      observer.disconnect(); resizeObserver.disconnect();
      document.removeEventListener('visibilitychange', reconcile);
      container.removeEventListener('pointermove', onPointer);
      container.removeEventListener('pointerleave', onPointerLeave);
      container.removeEventListener('pointercancel', onPointerLeave);
      container.removeEventListener('portfolio:hero-pulse', onPulse);
      canvas.removeEventListener('webglcontextlost', onContextLost);
      geometry.dispose();lineGeometry.dispose();pointMaterial.dispose();lineMaterial.dispose();ringGeometry.dispose();ringMaterial.dispose();orbitMaterial.dispose();renderer.dispose();
    },
  };
}
