/**
 * Scrolls `el` into view inside `container` only. Unlike Element.scrollIntoView this never scrolls
 * outer layout containers, and it can leave room for a sticky header (`offset`).
 */
export function scrollWithin(
  container: HTMLElement,
  el: HTMLElement,
  { block = 'nearest', offset = 0, smooth = false }: { block?: 'nearest' | 'start'; offset?: number; smooth?: boolean } = {},
) {
  const c = container.getBoundingClientRect();
  const r = el.getBoundingClientRect();
  const top = r.top - c.top + container.scrollTop - offset;
  let target: number | null = top;
  if (block === 'nearest') {
    const bottom = r.bottom - c.top + container.scrollTop - container.clientHeight;
    if (r.top - offset < c.top) target = top;
    else if (r.bottom > c.bottom) target = bottom;
    else target = null;
  }
  if (target !== null) container.scrollTo({ top: Math.max(0, target), behavior: smooth ? 'smooth' : 'auto' });
}
