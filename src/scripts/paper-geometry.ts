/** A developable cylindrical fold. The flat tail stays attached to the curved crease. */
export function bendPaper(x: number, y: number, width: number, height: number, fold: number, direction: number, corner: number, time: number, flutter: number): [number, number, number] {
  const a = direction, b = corner * .62, length = Math.hypot(a, b), nx = a / length, ny = b / length;
  const extent = Math.abs(nx) * width / 2 + Math.abs(ny) * height / 2;
  const crease = extent - fold * (extent * 2 + .56);
  const distance = x * nx + y * ny - crease;
  const radius = .3 + Math.min(.1, width * .018);
  let along = x * nx + y * ny, z = 0;
  if (distance > 0) {
    const angle = Math.min(Math.PI, distance / radius);
    along = crease + radius * Math.sin(angle) - Math.max(0, distance - Math.PI * radius);
    z = radius * (1 - Math.cos(angle));
  }
  const offset = along - (x * nx + y * ny);
  const breath = flutter * (Math.sin(x * 1.8 + time * .8) * Math.cos(y * 1.1 + time * .67) * .022 + Math.sin(time * 1.2 + x) * .008);
  return [x + nx * offset, y + ny * offset, z + breath];
}
