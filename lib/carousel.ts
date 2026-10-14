export function nextCarouselIndex(current: number, itemCount: number): number {
  if (itemCount <= 1) return 0;
  return (current + 1) % itemCount;
}
