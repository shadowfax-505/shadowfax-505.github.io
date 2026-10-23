import * as THREE from 'three';

/**
 * Particle field beside the name. Three forms share one point set:
 * 0 EMG — six recording channels with muscle bursts, the signal the AFO recorder captures;
 * 1 PCB — routed traces with a via column, the board that captures it;
 * 2 Loop — the folded ribbon from the original site.
 * Colours come from the CSS custom properties --field-ink / --field-accent so the field follows the theme.
 */
export type FieldController = { setEnabled(on: boolean): void; setForm(i: number): void; refreshColors(): void; dispose(): void };
const noop: FieldController = { setEnabled() {}, setForm() {}, refreshColors() {}, dispose() {} };

export function createField(container: HTMLElement, initialEnabled: boolean): FieldController {
  const canvas = container.querySelector<HTMLCanvasElement>('canvas');
  if (!canvas) return noop;
  let renderer: THREE.WebGLRenderer;
  try {
    const gl = canvas.getContext('webgl2', { alpha: true, antialias: false, powerPreference: 'low-power' });
    if (!gl) throw new Error('no webgl2');
    renderer = new THREE.WebGLRenderer({ canvas, context: gl, antialias: false, alpha: true, powerPreference: 'low-power' });
  } catch { container.dataset.webgl = 'unavailable'; return noop; }

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(40, 1, .1, 50);
  camera.position.z = 8;
  const group = new THREE.Group();
  group.rotation.set(-.22, -.18, -.12);
  scene.add(group);

  const narrow = window.innerWidth < 600;
  const columns = narrow ? 60 : 96;
  const rows = 6 * (narrow ? 3 : 4);
  const count = columns * rows;
  const emg = new Float32Array(count * 3);
  const circuit = new Float32Array(count * 3);
  const ribbon = new Float32Array(count * 3);
  const tone = new Float32Array(count);
  const horizontal: number[] = [];
  const vertical: number[] = [];
  const lanes = 6, perLane = rows / lanes;
  // Deterministic pseudo-noise so the server fallback and the field agree from load to load.
  const hash = (n: number) => { const x = Math.sin(n * 127.1) * 43758.5453; return x - Math.floor(x); };
  for (let i = 0; i < count; i++) {
    const col = i % columns, row = Math.floor(i / columns);
    const u = col / (columns - 1), v = row / (rows - 1);
    const lane = Math.floor(row / perLane), sub = row % perLane;
    // EMG: each lane is a channel; sub-rows thicken the trace into a band.
    const phase = lane * .17;
    const burst = Math.exp(-Math.pow(((u + phase) % .5 - .26) / .055, 2)) + .55 * Math.exp(-Math.pow(((u + phase + .19) % .5 - .26) / .04, 2));
    const carrier = Math.sin(u * 190 + lane * 3.1) * .6 + Math.sin(u * 77 + lane) * .4;
    const jitter = (hash(col * 31 + lane * 7) - .5) * .25;
    const amp = (.05 + burst * .42) * (carrier + jitter);
    const laneY = (lanes - 1) / 2 - lane;
    emg.set([(u - .5) * 5.6, laneY * .62 + amp + (sub - (perLane - 1) / 2) * .012, (sub - (perLane - 1) / 2) * .03 + Math.sin(u * 6 + lane) * .05], i * 3);
    // PCB: lanes become traces with 45° jogs and a via column.
    const track = Math.round(v * 11) / 11;
    const jog = u > .34 && u < .44 ? (u - .34) * 2.4 : u >= .44 && u < .62 ? .24 : u >= .62 && u < .72 ? .24 - (u - .62) * 2.4 : 0;
    const dir = Math.sin(track * 9.7) > 0 ? 1 : -1;
    circuit.set([(u - .5) * 5.2, (track - .5) * 3.4 + jog * dir, Math.sin(track * 16) * .18], i * 3);
    // Loop: the original folded ribbon.
    const around = u * Math.PI * 2, across = (v - .5) * 1.55;
    const r = 1.8 + across * Math.cos(around / 2);
    ribbon.set([r * Math.cos(around), r * Math.sin(around) * .78, across * Math.sin(around / 2)], i * 3);
    tone[i] = lane === 1 ? 1 : 0;
    if (col < columns - 1) horizontal.push(i, i + 1);
    if (row + 1 < rows && col % 4 === 0) vertical.push(i, i + columns);
  }

  const css = getComputedStyle(document.documentElement);
  const readColor = (name: string, fallback: string) => {
    const raw = css.getPropertyValue(name).trim() || fallback;
    const [r, g, b] = raw.split(/\s+/).map(Number);
    return new THREE.Color(r / 255, g / 255, b / 255);
  };
  const impulses = Array.from({ length: 4 }, () => new THREE.Vector4(0, 0, -100, 0));
  const uniforms = {
    uMorph: { value: 0 }, uTime: { value: 0 }, uPixelRatio: { value: 1 },
    uPointer: { value: new THREE.Vector3() }, uPointerStrength: { value: 0 },
    uImpulses: { value: impulses }, uFormPulse: { value: 0 },
    uInk: { value: readColor('--field-ink', '22 24 27') }, uAccent: { value: readColor('--field-accent', '194 65 12') },
    uVertical: { value: 0 },
  };
  const vertexShader = `
    attribute vec3 aCircuit;
    attribute vec3 aRibbon;
    attribute float aTone;
    uniform float uMorph, uTime, uPixelRatio, uPointerStrength, uFormPulse;
    uniform vec3 uPointer;
    uniform vec4 uImpulses[4];
    varying float vDepth;
    varying float vEnergy;
    varying float vTone;
    void main(){
      vTone = aTone * (1.0 - smoothstep(0.0, 1.0, min(uMorph, 1.0)));
      vec3 p = mix(position, aCircuit, smoothstep(0.0, 1.0, min(uMorph, 1.0)));
      p = mix(p, aRibbon, smoothstep(0.0, 1.0, max(0.0, uMorph - 1.0)));
      vec3 toPointer = uPointer - p;
      float influence = exp(-dot(toPointer, toPointer) * 1.4) * uPointerStrength;
      p.xy += toPointer.xy * influence * .12;
      p.z += influence * .45;
      float energy = influence * .8;
      for (int i = 0; i < 4; i++) {
        float age = max(0.0, uTime - uImpulses[i].z);
        vec2 d = p.xy - uImpulses[i].xy;
        float dist = length(d);
        float front = dist - age * 2.1;
        float env = exp(-front * front * 5.5) * exp(-age * .9) * uImpulses[i].w;
        float disp = cos(front * 8.0) * env;
        p.z += disp * .34;
        p.xy += d / max(dist, .01) * disp * .07;
        energy += env * .75;
      }
      p *= 1.0 + uFormPulse * .04;
      p.y += sin(uTime * .85 + p.x * 1.7) * .03;
      vec4 mv = modelViewMatrix * vec4(p, 1.0);
      gl_Position = projectionMatrix * mv;
      gl_PointSize = clamp((15.0 + energy * 8.0) * uPixelRatio / -mv.z, 1.0, 5.0);
      vDepth = clamp((p.z + 2.2) / 4.4, 0.0, 1.0);
      vEnergy = clamp(energy + uFormPulse * .3, 0.0, 1.0);
    }`;
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(emg, 3));
  geometry.setAttribute('aCircuit', new THREE.BufferAttribute(circuit, 3));
  geometry.setAttribute('aRibbon', new THREE.BufferAttribute(ribbon, 3));
  geometry.setAttribute('aTone', new THREE.BufferAttribute(tone, 1));
  const pointMaterial = new THREE.ShaderMaterial({
    uniforms, vertexShader, transparent: true, depthWrite: false,
    fragmentShader: `uniform vec3 uInk; uniform vec3 uAccent; varying float vDepth; varying float vEnergy; varying float vTone;
      void main(){ float d = length(gl_PointCoord - vec2(.5)); float a = 1.0 - smoothstep(.15, .5, d);
      gl_FragColor = vec4(mix(uInk, uAccent, clamp(.2 + vTone * .8 + vEnergy * .75, 0.0, 1.0)), a * (.42 + vDepth * .4 + vTone * .15)); }`,
  });
  const points = new THREE.Points(geometry, pointMaterial);
  points.frustumCulled = false;
  group.add(points);
  const lineFragment = (vertical: boolean) => `uniform vec3 uInk; uniform vec3 uAccent; uniform float uVertical; varying float vDepth; varying float vEnergy; varying float vTone;
    void main(){ gl_FragColor = vec4(mix(uInk, uAccent, clamp(vTone + vEnergy * .7, 0.0, 1.0)), (.1 + vDepth * .18 + vEnergy * .12 + vTone * .25) * ${vertical ? 'uVertical' : '1.0'}); }`;
  const makeLines = (index: number[], vertical: boolean) => {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', geometry.getAttribute('position'));
    g.setAttribute('aCircuit', geometry.getAttribute('aCircuit'));
    g.setAttribute('aRibbon', geometry.getAttribute('aRibbon'));
    g.setAttribute('aTone', geometry.getAttribute('aTone'));
    g.setIndex(index);
    const m = new THREE.ShaderMaterial({ uniforms, vertexShader, fragmentShader: lineFragment(vertical), transparent: true, depthWrite: false });
    const l = new THREE.LineSegments(g, m);
    l.frustumCulled = false;
    group.add(l);
    return { g, m };
  };
  const hLines = makeLines(horizontal, false);
  const vLines = makeLines(vertical, true);

  let enabled = initialEnabled, visible = true, disposed = false, contextLost = false;
  let frame = 0, last = 0, elapsed = 0, target = 0, morphVelocity = 0, formPulse = 0, nextImpulse = 0, pointerActive = 0;
  const pointer = new THREE.Vector2(), pointerTarget = new THREE.Vector2();
  const raycaster = new THREE.Raycaster(), plane = new THREE.Plane(), normal = new THREE.Vector3();
  const hit = new THREE.Vector3(), local = new THREE.Vector3();
  const euler = new THREE.Euler(), quat = new THREE.Quaternion();
  const clamp = THREE.MathUtils.clamp;
  const canAnimate = () => enabled && visible && !document.hidden && !contextLost && !disposed;

  function project(n: THREE.Vector2, out: THREE.Vector3) {
    camera.getWorldDirection(normal);
    plane.setFromNormalAndCoplanarPoint(normal, group.position);
    raycaster.setFromCamera(n, camera);
    if (raycaster.ray.intersectPlane(plane, hit)) {
      out.copy(hit); group.worldToLocal(out);
      out.set(clamp(out.x, -3.1, 3.1), clamp(out.y, -2.5, 2.5), clamp(out.z, -.9, .9));
    }
  }
  const box = () => container.getBoundingClientRect();
  const onMove = (e: PointerEvent) => {
    if (!canAnimate()) return;
    const b = box(); if (!b.width) return;
    pointerTarget.set(clamp((e.clientX - b.left) / b.width * 2 - 1, -1, 1), clamp(1 - (e.clientY - b.top) / b.height * 2, -1, 1));
    pointerActive = 1;
  };
  const onLeave = () => { pointerTarget.set(0, 0); pointerActive = 0; };
  const tap = new THREE.Vector2(), origin = new THREE.Vector3();
  const onDown = (e: PointerEvent) => {
    if (!canAnimate() || (e.target as Element).closest('button')) return;
    const b = box();
    tap.set((e.clientX - b.left) / b.width * 2 - 1, 1 - (e.clientY - b.top) / b.height * 2);
    group.updateMatrixWorld(); project(tap, origin);
    impulses[nextImpulse].set(origin.x, origin.y, elapsed, 1);
    nextImpulse = (nextImpulse + 1) % impulses.length;
    formPulse = Math.max(formPulse, .5);
  };
  container.addEventListener('pointermove', onMove, { passive: true });
  container.addEventListener('pointerleave', onLeave);
  container.addEventListener('pointercancel', onLeave);
  container.addEventListener('pointerdown', onDown);

  function resize() {
    const { width, height } = box();
    const ratio = Math.min(window.devicePixelRatio, narrow ? 1.5 : 1.75);
    renderer.setPixelRatio(ratio);
    renderer.setSize(width, height, false);
    camera.aspect = width / Math.max(height, 1);
    camera.position.z = camera.aspect < .9 ? 9.4 : 8;
    camera.updateProjectionMatrix();
    uniforms.uPixelRatio.value = ratio;
    if (!frame) renderer.render(scene, camera);
  }
  const ro = new ResizeObserver(resize); ro.observe(container); resize();

  function tick(time: number) {
    if (!canAnimate()) { frame = 0; last = 0; return; }
    frame = requestAnimationFrame(tick);
    if (last && time - last < 1000 / 30) return;
    const dt = last ? Math.min((time - last) / 1000, .05) : 1 / 30;
    last = time; elapsed += dt;
    uniforms.uTime.value = elapsed;
    morphVelocity += (target - uniforms.uMorph.value) * 38 * dt;
    morphVelocity *= Math.exp(-10 * dt);
    uniforms.uMorph.value = clamp(uniforms.uMorph.value + morphVelocity * dt, 0, 2);
    uniforms.uVertical.value = clamp(uniforms.uMorph.value, 0, 1);
    formPulse *= Math.exp(-3.8 * dt);
    uniforms.uFormPulse.value = formPulse;
    const k = 1 - Math.exp(-5 * dt);
    pointer.lerp(pointerTarget, k);
    uniforms.uPointerStrength.value += (pointerActive - uniforms.uPointerStrength.value) * k;
    euler.set(-.22 - pointer.y * .22 + Math.sin(elapsed * .21) * .05, -.18 + pointer.x * .36 + Math.sin(elapsed * .16) * .18, -.12 - pointer.x * .06);
    quat.setFromEuler(euler); group.quaternion.slerp(quat, k);
    camera.position.x += (pointer.x * .14 - camera.position.x) * k;
    camera.position.y += (pointer.y * .09 - camera.position.y) * k;
    camera.lookAt(0, 0, 0); camera.updateMatrixWorld(); group.updateMatrixWorld();
    project(pointer, local);
    uniforms.uPointer.value.lerp(local, k);
    renderer.render(scene, camera);
  }
  function reconcile() {
    if (disposed || contextLost) return;
    container.dataset.webgl = 'ready';
    if (canAnimate() && !frame) { last = 0; frame = requestAnimationFrame(tick); }
    else if (!canAnimate()) { if (frame) cancelAnimationFrame(frame); frame = 0; last = 0; onLeave(); renderer.render(scene, camera); }
  }
  const io = new IntersectionObserver(([e]) => { visible = e.isIntersecting; reconcile(); }, { rootMargin: '40px' });
  io.observe(container);
  document.addEventListener('visibilitychange', reconcile);
  const lost = (e: Event) => { e.preventDefault(); contextLost = true; container.dataset.webgl = 'unavailable'; if (frame) cancelAnimationFrame(frame); frame = 0; };
  canvas.addEventListener('webglcontextlost', lost);
  renderer.render(scene, camera);
  reconcile();

  return {
    setEnabled(v) { if (!contextLost) { enabled = v; reconcile(); } },
    setForm(i) { if (Number.isFinite(i)) { target = clamp(i, 0, 2); formPulse = 1; if (!canAnimate()) { uniforms.uMorph.value = target; uniforms.uVertical.value = clamp(target, 0, 1); renderer.render(scene, camera); } } },
    refreshColors() {
      const s = getComputedStyle(document.documentElement);
      const parse = (n: string) => { const [r, g, b] = s.getPropertyValue(n).trim().split(/\s+/).map(Number); return new THREE.Color(r / 255, g / 255, b / 255); };
      uniforms.uInk.value = parse('--field-ink'); uniforms.uAccent.value = parse('--field-accent');
      if (!frame) renderer.render(scene, camera);
    },
    dispose() {
      disposed = true; cancelAnimationFrame(frame); io.disconnect(); ro.disconnect();
      document.removeEventListener('visibilitychange', reconcile);
      container.removeEventListener('pointermove', onMove); container.removeEventListener('pointerleave', onLeave);
      container.removeEventListener('pointercancel', onLeave); container.removeEventListener('pointerdown', onDown);
      canvas.removeEventListener('webglcontextlost', lost);
      geometry.dispose(); pointMaterial.dispose(); hLines.g.dispose(); hLines.m.dispose(); vLines.g.dispose(); vLines.m.dispose(); renderer.dispose();
    },
  };
}
