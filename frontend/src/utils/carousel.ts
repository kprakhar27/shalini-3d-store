export function carouselPosition(
  index: number,
  total: number,
  radius: number
): { position: [number, number, number]; rotationY: number } {
  const angle = (index / total) * Math.PI * 2
  return {
    position: [Math.cos(angle) * radius, 0, Math.sin(angle) * radius],
    rotationY: -angle,
  }
}
