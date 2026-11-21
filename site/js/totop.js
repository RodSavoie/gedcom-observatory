/* Back to top: a quiet arrow at the bottom right. It appears once the page (or a view that scrolls on its own,
   such as By the Numbers) has been scrolled down, and glides back to the top with a quick ease-in-out. */
(function () {
  const SHOW_AFTER = 320;   // pixels scrolled before the arrow appears
  const btn = document.createElement('button');
  btn.className = 'to-top'; btn.type = 'button'; btn.title = 'Back to top'; btn.setAttribute('aria-label', 'Back to top');
  btn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 14l6-6 6 6"/></svg>';

  let scroller = null;   // whatever was scrolled last: the page itself, or a view's own scrolling area
  const pos = el => (el ? el.scrollTop : window.scrollY || document.documentElement.scrollTop);
  const update = () => btn.classList.toggle('show', pos(scroller) > SHOW_AFTER);

  document.addEventListener('scroll', e => {
    const t = e.target;
    scroller = (t === document || t === document.documentElement || t === document.body) ? null : t;
    // a scrolled box that is tiny (a list, a menu) shouldn't summon the arrow
    if (scroller && scroller.clientHeight < window.innerHeight * 0.5) return;
    update();
  }, true);
  window.addEventListener('hashchange', () => { scroller = null; setTimeout(update, 50); });

  const ease = t => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);   // ease-in-out
  btn.addEventListener('click', () => {
    const el = scroller, from = pos(el);
    if (!from) return;
    const dur = Math.min(650, 280 + from / 12), t0 = performance.now();
    const set = y => (el ? (el.scrollTop = y) : window.scrollTo(0, y));
    const step = now => { const k = Math.min(1, (now - t0) / dur); set(from * (1 - ease(k))); if (k < 1) requestAnimationFrame(step); };
    requestAnimationFrame(step);
  });

  const add = () => document.body.append(btn);
  if (document.body) add(); else document.addEventListener('DOMContentLoaded', add);
})();
