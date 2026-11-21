// Test bot: answers each activity correctly using the data-ok / data-seq markers.
(() => {
  window.tapEl = el => {
    const r = el.getBoundingClientRect();
    const o = { bubbles: true, clientX: r.x + r.width / 2, clientY: r.y + r.height / 2, pointerId: 1 };
    el.dispatchEvent(new PointerEvent('pointerdown', o));
    el.dispatchEvent(new PointerEvent('pointerup', o));
  };
  window.log = [];
  const vis = el => el && el.offsetParent !== null && getComputedStyle(el).visibility !== 'hidden';
  window.autoStep = () => {
    const q = s => document.querySelector(s);
    const st = q('.stage');
    if (q('.modal')) return;
    if (q('.play')) return tapEl(q('.play'));
    // Tests can ask the bot to open daily practice (from the map button, or from the "you finished" screen).
    if (window.autoWant === 'practice' && !q('.stage')) { const f = q('.practice-fab') || q('.fin-practice'); if (f) return tapEl(f); }
    if (window.autoWant === 'books' && !q('.stage')) { const f = q('.fin-books'); if (f) return tapEl(f); }
    if (q('.node.current')) return tapEl(q('.node.current'));
    if (q('.hatch-egg') && !q('.hatch-egg.burst')) return tapEl(q('.hatch-egg'));
    if (q('.reward-row .go')) { if (!log.includes('lesson done')) log.push('lesson done'); window.stopAuto && stopAuto(); return; }
    if (!st) return;
    // Letter tracing: draw the current stroke with real pointer events along the guide line.
    const tsvg = st.querySelector('.trace-svg');
    if (tsvg) {
      const cur = tsvg.querySelector('.tr-guide.cur');
      if (!cur) return;
      const m = cur.getScreenCTM();
      const toClient = (x, y) => { const p = new DOMPoint(x, y).matrixTransform(m); return { clientX: p.x, clientY: p.y }; };
      const fire = (type, pt) => tsvg.dispatchEvent(new PointerEvent(type, { bubbles: true, cancelable: true, pointerId: 7, pointerType: 'touch', isPrimary: true, ...pt }));
      if (cur.tagName === 'circle') { fire('pointerdown', toClient(+cur.getAttribute('cx'), +cur.getAttribute('cy'))); fire('pointerup', toClient(+cur.getAttribute('cx'), +cur.getAttribute('cy'))); log.push('trace dot'); return; }
      const L = cur.getTotalLength(), pts = [];
      for (let d = 0; d <= L; d += 4) { const q = cur.getPointAtLength(d); pts.push(toClient(q.x, q.y)); }
      const e = cur.getPointAtLength(L); pts.push(toClient(e.x, e.y));
      fire('pointerdown', pts[0]);
      pts.slice(1).forEach(p => fire('pointermove', p));
      fire('pointerup', pts[pts.length - 1]);
      log.push('trace stroke');
      return;
    }
    // Story questions (pictures or words): the right answer carries data-ok like every other choice.
    const ok = st.querySelector('[data-ok]:not(.locked):not(.right)');
    if (ok && !st.dataset.ok) { log.push(st.querySelector('.big-ear') ? 'question' : 'ok ' + st.className); return tapEl(ok); }
    const field = st.querySelector('.pop-field');
    if (field) {
      const b = [...field.querySelectorAll('.bubble:not(.popped)')].find(b => b.dataset.g === field.dataset.target && b.getBoundingClientRect().top < innerHeight - 60);
      if (b) { b.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true })); log.push('pop ' + field.dataset.target); }
      return;
    }
    const nt = st.querySelector('.blend-tile.next'); if (nt) return tapEl(nt);
    const knob = st.querySelector('.knob.ready');
    if (knob && !st.querySelector('.pic-card')) { log.push('slide'); return tapEl(knob); }
    if (st.dataset.seq && st.querySelector('.tray')) {
      const seq = st.dataset.seq.split(',');
      const filled = st.querySelectorAll('.sound-box .tile').length;
      const t = [...st.querySelectorAll('.tray-tile:not(.used)')].find(t => t.dataset.g === seq[filled]);
      if (t) tapEl(t);
      return;
    }
    const judge = st.querySelector('.judge-row');
    if (judge && st.dataset.ok) {
      if (vis(judge)) {
        const v = st.dataset.ok; log.push('judge ' + v);
        if (v === 'yes') tapEl(st.querySelector('.judge.yes'));
        else { tapEl(st.querySelector('.judge.no')); st.dataset.pending = v.split(':')[1]; }
        delete st.dataset.ok;
      }
      return;
    }
    if (st.dataset.pending && !st.querySelector('.word-card.locked')) {
      const t = st.querySelectorAll('.word-tile')[+st.dataset.pending];
      if (t) { tapEl(t); delete st.dataset.pending; }
      return;
    }
    // Story pages: tap every word in order (the glowing one), then the next button opens.
    const nw = st.querySelector('.story-text .sw.next'); if (nw) { log.push('word'); return tapEl(nw); }
    const go = st.querySelector('.btn.go:not([disabled])'); if (go) { log.push('go'); return tapEl(go); }
  };
  window.startAuto = (ms = 1000) => {
    window.stopAuto && stopAuto();
    const id = setInterval(() => { try { autoStep(); } catch (e) { log.push('ERR ' + e.message); } }, ms);
    window.stopAuto = () => clearInterval(id);
  };
})();
