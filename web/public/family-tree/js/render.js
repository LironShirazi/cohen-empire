/* ============================================================
   העץ המשפחתי — רינדור SVG + גרירה / זום (עכבר, גלגלת, צביטה)
   ============================================================ */
(function () {
  'use strict';
  const NS = (window.FT = window.FT || {});
  const C = NS.CONST;

  const esc = (s) =>
    String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

  /**
   * שם המשפחה שמוצג מתחת ללב. השדה הוא פר-אדם ולא פר-זוג, כי יש
   * כלות וחתנים ששמרו על שם המשפחה שלהם — ולכן: שם משותף מוצג פעם
   * אחת, שני שמות שונים מוצגים שניהם, ואם רק לאחד יש שם מוצג שלו.
   */
  function coupleLastName(a, b) {
    const na = String((a && a.lastName) || '').trim();
    const nb = String((b && b.lastName) || '').trim();
    if (na && nb) return na === nb ? na : `${na} · ${nb}`;
    return na || nb || '';
  }

  /* שם ארוך נשבר לשתי שורות בקרבת האמצע */
  function nameLines(name) {
    const n = String(name || '').trim();
    if (n.length <= 12 || !n.includes(' ')) return [n];
    const words = n.split(/\s+/);
    let best = 1, bestDiff = Infinity;
    for (let i = 1; i < words.length; i++) {
      const a = words.slice(0, i).join(' ').length;
      const b = words.slice(i).join(' ').length;
      const diff = Math.abs(a - b);
      if (diff < bestDiff) { bestDiff = diff; best = i; }
    }
    return [words.slice(0, best).join(' '), words.slice(best).join(' ')];
  }

  function personSVG(p, pos, opts) {
    const { x, y } = pos;
    const R = C.R;
    const cls =
      'person ' +
      (p.gender === 'm' ? 'g-m' : p.gender === 'f' ? 'g-f' : 'g-n') +
      (p.isRoot ? ' root' : '') +
      (opts.myId === p.id ? ' me' : '');
    const initial = NS.initialOf(p.name);
    let media;
    if (p.photo) {
      media =
        `<circle class="ph-bg" cx="${x}" cy="${y}" r="${R}"/>` +
        `<image href="${p.photo}" xlink:href="${p.photo}" x="${x - R}" y="${y - R}" ` +
        `width="${R * 2}" height="${R * 2}" clip-path="url(#clip-${esc(p.id)})" preserveAspectRatio="xMidYMid slice"/>` +
        `<circle class="ring" cx="${x}" cy="${y}" r="${R}"/>`;
    } else {
      media =
        `<circle class="ph-bg" cx="${x}" cy="${y}" r="${R}"/>` +
        `<text class="initial" x="${x}" y="${y + 10}" text-anchor="middle">${esc(initial)}</text>` +
        `<circle class="ring" cx="${x}" cy="${y}" r="${R}"/>`;
    }
    const lines = nameLines(p.name);
    const nameY = y + R + 16;
    const nameSVG = lines
      .map((ln, i) => `<text class="name" x="${x}" y="${nameY + i * 14}" text-anchor="middle">${esc(ln)}</text>`)
      .join('');
    const yearY = nameY + lines.length * 14 + 1;
    const yearSVG = p.birthYear
      ? `<text class="year" x="${x}" y="${yearY}" text-anchor="middle">${p.birthYear}</text>`
      : '';
    const meBadge =
      opts.myId === p.id
        ? `<g class="me-badge"><circle cx="${x + R - 6}" cy="${y - R + 6}" r="10"/><text x="${x + R - 6}" y="${y - R + 10}" text-anchor="middle">🙋</text></g>`
        : '';
    const hit = opts.interactive
      ? `<circle class="hit" cx="${x}" cy="${y}" r="${R + 14}"/>`
      : '';
    return `<g class="${cls}" data-id="${esc(p.id)}">${media}${nameSVG}${yearSVG}${meBadge}${hit}</g>`;
  }

  /* בונה את תוכן ה-SVG (defs + גוף) — משמש גם לתצוגה חיה וגם לייצוא */
  function buildContent(model, opts) {
    opts = opts || {};
    const R = C.R;
    let defs = '';
    let links = '';
    let couples = '';
    let nodes = '';

    for (const link of model.childLinks) {
      const busY = C.TOP + 0; // מחושב לפי שורת הילדים בפועל
      const childYs = link.children.map((c) => model.positions[c.id].y);
      const rowY = Math.min(...childYs);
      const by = rowY - R - 26;
      const startY = link.fromCouple ? link.anchorY : link.anchorY + R;
      const xs = link.children.map((c) => model.positions[c.id].x);
      const minX = Math.min(...xs, link.anchorX);
      const maxX = Math.max(...xs, link.anchorX);
      let d = `M ${link.anchorX} ${startY} V ${by}`;
      if (xs.length > 1 || Math.abs(xs[0] - link.anchorX) > 1) {
        d += ` M ${minX} ${by} H ${maxX}`;
      }
      for (const c of link.children) {
        const pos = model.positions[c.id];
        d += ` M ${pos.x} ${by} V ${pos.y - R}`;
      }
      links += `<path class="link" d="${d}"/>`;
      void busY;
    }

    for (const [a, b] of model.coupleLines) {
      const pa = model.positions[a.id], pb = model.positions[b.id];
      if (!pa || !pb) continue;
      if (pa.y === pb.y) {
        const left = pa.x < pb.x ? pa : pb;
        const right = pa.x < pb.x ? pb : pa;
        const midX = (left.x + right.x) / 2;
        const family = coupleLastName(a, b);
        couples +=
          `<line class="couple" x1="${left.x + R}" y1="${left.y}" x2="${right.x - R}" y2="${right.y}"/>` +
          `<text class="heart" x="${midX}" y="${pa.y + 4}" text-anchor="middle">♥</text>` +
          (family
            ? `<text class="couple-name" x="${midX}" y="${pa.y + 20}" text-anchor="middle">${esc(family)}</text>`
            : '');
      } else {
        couples += `<path class="couple far" d="M ${pa.x} ${pa.y} L ${pb.x} ${pb.y}"/>`;
      }
    }

    const personsSorted = model.units.flatMap((u) => u.members);
    for (const p of personsSorted) {
      const pos = model.positions[p.id];
      if (!pos) continue;
      if (p.photo) {
        defs += `<clipPath id="clip-${esc(p.id)}"><circle cx="${pos.x}" cy="${pos.y}" r="${R - 2}"/></clipPath>`;
      }
      nodes += personSVG(p, pos, opts);
    }

    return {
      defs: `<defs>${defs}</defs>`,
      body: `<g class="links">${links}</g><g class="couples">${couples}</g><g class="nodes">${nodes}</g>`,
    };
  }

  /* ---------- תצוגה חיה ---------- */
  const view = { tx: 0, ty: 0, scale: 1 };
  let svg, vp, wrap;
  let model = null;

  function applyView() {
    vp.setAttribute('transform', `translate(${view.tx} ${view.ty}) scale(${view.scale})`);
  }

  function draw(selectedId) {
    model = NS.layout.build(collectPersons());
    const content = buildContent(model, {
      interactive: true,
      myId: NS.store.prefs.myId,
    });
    svg.innerHTML = `${content.defs}<g id="vp">${content.body}</g>`;
    vp = svg.querySelector('#vp');
    if (selectedId) {
      const g = svg.querySelector(`g.person[data-id="${CSS.escape(selectedId)}"]`);
      if (g) g.classList.add('selected');
    }
    applyView();
  }

  function collectPersons() {
    const map = {};
    for (const p of NS.store.all()) map[p.id] = p;
    return map;
  }

  function fit() {
    const rect = wrap.getBoundingClientRect();
    const b = model.bbox;
    const pad = 30;
    const s = Math.min(
      (rect.width - pad * 2) / b.width,
      (rect.height - pad * 2) / b.height,
      1.35
    );
    view.scale = Math.max(0.12, s);
    view.tx = rect.width / 2 - (b.minX + b.width / 2) * view.scale;
    view.ty = rect.height / 2 - (b.minY + b.height / 2) * view.scale;
    applyView();
  }

  function centerOn(personId) {
    const pos = model && model.positions[personId];
    if (!pos) return;
    const rect = wrap.getBoundingClientRect();
    if (view.scale < 0.55) view.scale = 0.9;
    view.tx = rect.width / 2 - pos.x * view.scale;
    view.ty = rect.height / 2.6 - pos.y * view.scale;
    applyView();
  }

  function zoomAt(cx, cy, factor) {
    const ns = Math.min(3, Math.max(0.1, view.scale * factor));
    const k = ns / view.scale;
    view.tx = cx - (cx - view.tx) * k;
    view.ty = cy - (cy - view.ty) * k;
    view.scale = ns;
    applyView();
  }

  /* ---------- אינטראקציה ---------- */
  function initEvents() {
    const pointers = new Map();
    let pinchStart = null;
    let downInfo = null;

    svg.addEventListener('pointerdown', (e) => {
      svg.setPointerCapture(e.pointerId);
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pointers.size === 1) {
        downInfo = { x: e.clientX, y: e.clientY, tx: view.tx, ty: view.ty, moved: false, target: e.target };
      } else if (pointers.size === 2) {
        const [a, b] = [...pointers.values()];
        pinchStart = {
          dist: Math.hypot(a.x - b.x, a.y - b.y),
          scale: view.scale,
          cx: (a.x + b.x) / 2,
          cy: (a.y + b.y) / 2,
          tx: view.tx,
          ty: view.ty,
        };
        downInfo = null;
      }
    });

    svg.addEventListener('pointermove', (e) => {
      if (!pointers.has(e.pointerId)) return;
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pointers.size === 2 && pinchStart) {
        const [a, b] = [...pointers.values()];
        const dist = Math.hypot(a.x - b.x, a.y - b.y);
        const k = dist / (pinchStart.dist || 1);
        const ns = Math.min(3, Math.max(0.1, pinchStart.scale * k));
        const kk = ns / pinchStart.scale;
        const rect = wrap.getBoundingClientRect();
        const cx = pinchStart.cx - rect.left, cy = pinchStart.cy - rect.top;
        view.scale = ns;
        view.tx = cx - (cx - pinchStart.tx) * kk;
        view.ty = cy - (cy - pinchStart.ty) * kk;
        applyView();
      } else if (pointers.size === 1 && downInfo) {
        const dx = e.clientX - downInfo.x, dy = e.clientY - downInfo.y;
        if (Math.hypot(dx, dy) > 5) downInfo.moved = true;
        view.tx = downInfo.tx + dx;
        view.ty = downInfo.ty + dy;
        applyView();
      }
    });

    const endPointer = (e) => {
      if (pointers.has(e.pointerId)) pointers.delete(e.pointerId);
      if (pointers.size < 2) pinchStart = null;
      if (downInfo && !downInfo.moved && e.type === 'pointerup') {
        const g = downInfo.target && downInfo.target.closest
          ? downInfo.target.closest('g.person')
          : null;
        if (g && typeof NS.onPersonTap === 'function') NS.onPersonTap(g.getAttribute('data-id'));
      }
      if (pointers.size === 0) downInfo = null;
    };
    svg.addEventListener('pointerup', endPointer);
    svg.addEventListener('pointercancel', endPointer);

    svg.addEventListener(
      'wheel',
      (e) => {
        e.preventDefault();
        const rect = wrap.getBoundingClientRect();
        zoomAt(e.clientX - rect.left, e.clientY - rect.top, e.deltaY < 0 ? 1.15 : 1 / 1.15);
      },
      { passive: false }
    );

    // סיבוב מכשיר או שינוי גודל חלון מחזירים את העץ להתאמה למסך.
    // ה-debounce הוא בגלל הנייד: פתיחת סרגל הכתובת מייצרת רצף אירועים,
    // ו-fit() לכל אחד מהם היה קופץ מול העיניים
    let refitTimer = null;
    window.addEventListener('resize', () => {
      if (refitTimer) clearTimeout(refitTimer);
      refitTimer = setTimeout(() => {
        refitTimer = null;
        // המסך אולי כבר לא מוצג (ניווט לראוט אחר) — אין מה למדוד
        if (!wrap || !wrap.isConnected || !model) return;
        fit();
      }, 180);
    });
  }

  function init() {
    svg = document.getElementById('tree-svg');
    wrap = document.getElementById('tree-wrap');
    initEvents();
  }

  NS.render = {
    init, draw, fit, centerOn, buildContent,
    zoomIn() {
      const r = wrap.getBoundingClientRect();
      zoomAt(r.width / 2, r.height / 2, 1.25);
    },
    zoomOut() {
      const r = wrap.getBoundingClientRect();
      zoomAt(r.width / 2, r.height / 2, 1 / 1.25);
    },
    get model() { return model; },
  };
})();
