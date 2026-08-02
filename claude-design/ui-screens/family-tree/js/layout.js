/* ============================================================
   העץ המשפחתי — חישוב פריסה
   האלגוריתם: איחוד בני זוג ל"יחידות", שיוך יחידות לדורות,
   סידור ראשוני לפי סריקת עומק, ואז איטרציות מרכוז:
   ילדים מתחת להורים ← הורים מעל הילדים ← פתרון חפיפות.
   מתאים גם לעץ גדול (מאות עלים) — הכל ליניארי פר-איטרציה.
   ============================================================ */
(function () {
  'use strict';
  const NS = (window.FT = window.FT || {});

  const C = (NS.CONST = {
    R: 36,          // רדיוס עיגול
    PW: 100,        // רוחב משבצת לאדם
    ROW_H: 190,     // גובה דור
    UNIT_GAP: 34,   // רווח מינימלי בין יחידות באותו דור
    TOP: 90,        // שוליים עליונים
    LABEL_H: 46,    // גובה הטקסט מתחת לעיגול
  });

  /* איחוד־קבוצות (union-find) פשוט */
  function makeUF(ids) {
    const parent = {};
    ids.forEach((id) => (parent[id] = id));
    const find = (x) => (parent[x] === x ? x : (parent[x] = find(parent[x])));
    const union = (a, b) => { const ra = find(a), rb = find(b); if (ra !== rb) parent[rb] = ra; };
    return { find, union };
  }

  function build(personsMap) {
    const persons = Object.values(personsMap);
    const ids = persons.map((p) => p.id);
    const byId = (id) => personsMap[id] || null;

    /* ---- 1. יחידות: בני זוג + הורים משותפים באותה יחידה ---- */
    const uf = makeUF(ids);
    for (const p of persons) {
      if (p.partnerId && personsMap[p.partnerId]) uf.union(p.id, p.partnerId);
      if (p.fatherId && p.motherId && personsMap[p.fatherId] && personsMap[p.motherId])
        uf.union(p.fatherId, p.motherId);
    }
    const unitOf = {}; // personId -> unit
    const units = [];
    const groups = {};
    for (const id of ids) {
      const root = uf.find(id);
      (groups[root] = groups[root] || []).push(id);
    }
    for (const root of Object.keys(groups)) {
      const members = groups[root]
        .map(byId)
        .sort((a, b) => {
          const gv = (p) => (p.gender === 'm' ? 0 : p.gender === 'f' ? 2 : 1);
          return gv(a) - gv(b) || a.sortOrder - b.sortOrder;
        });
      const unit = {
        id: 'u' + units.length,
        members,
        width: members.length * C.PW,
        layer: 0,
        x: 0,
      };
      units.push(unit);
      members.forEach((m) => (unitOf[m.id] = unit));
    }

    const parentUnitsOf = (unit) => {
      const set = new Set();
      for (const m of unit.members) {
        for (const pid of [m.fatherId, m.motherId]) {
          const pu = pid && unitOf[pid];
          if (pu && pu !== unit) set.add(pu);
        }
      }
      return [...set];
    };
    const childPersonsOf = (unit) => {
      const memberIds = new Set(unit.members.map((m) => m.id));
      return persons
        .filter((p) => (p.fatherId && memberIds.has(p.fatherId)) || (p.motherId && memberIds.has(p.motherId)))
        .filter((p) => !memberIds.has(p.id))
        .sort((a, b) => a.sortOrder - b.sortOrder);
    };

    /* ---- 2. שיוך לדורות (מסלול ארוך ביותר מהשורשים) ---- */
    for (let i = 0; i <= units.length + 1; i++) {
      let changed = false;
      for (const u of units) {
        let L = 0;
        for (const pu of parentUnitsOf(u)) L = Math.max(L, pu.layer + 1);
        if (L > u.layer) { u.layer = L; changed = true; }
      }
      if (!changed) break;
    }

    /* ---- 3. סדר ראשוני בתוך כל דור — סריקת עומק מהשורשים ---- */
    const rows = [];
    const placed = new Set();
    const place = (u) => {
      if (placed.has(u.id)) return;
      placed.add(u.id);
      (rows[u.layer] = rows[u.layer] || []).push(u);
      for (const c of childPersonsOf(u)) place(unitOf[c.id]);
    };
    const roots = units
      .filter((u) => parentUnitsOf(u).length === 0)
      .sort((a, b) => Math.min(...a.members.map((m) => m.sortOrder)) - Math.min(...b.members.map((m) => m.sortOrder)));
    roots.forEach(place);
    units.forEach(place); // ליתר ביטחון — יחידות שלא הושגו
    for (let i = 0; i < rows.length; i++) rows[i] = rows[i] || [];

    /* ---- 4. מיקומי X ---- */
    const memberX = (u, m) => {
      const idx = u.members.indexOf(m);
      return u.x - u.width / 2 + C.PW / 2 + idx * C.PW;
    };
    const memberOffset = (u, m) => memberX(u, m) - u.x;

    // אתחול: פריסה רציפה בכל שורה
    for (const row of rows) {
      let edge = 0;
      for (const u of row) {
        u.x = edge + u.width / 2;
        edge += u.width + C.UNIT_GAP;
      }
    }

    const resolveOverlaps = (row) => {
      // פתרון חפיפות בשיטת צברים: יחידות שמתנגשות מתמזגות לצבר אחד
      // שממורכז על ממוצע המיקומים הרצויים — כך שורת אחים נשארת
      // ממורכזת מתחת להורים במקום להידחף לצד אחד.
      if (row.length < 2) return;
      const clusters = [];
      for (const u of row) {
        let cl = { units: [u], offs: [0], sum: u.x, n: 1 };
        while (clusters.length) {
          const prev = clusters[clusters.length - 1];
          const prevC = prev.sum / prev.n;
          const prevLastIdx = prev.units.length - 1;
          const prevRight =
            prevC + prev.offs[prevLastIdx] + prev.units[prevLastIdx].width / 2;
          const clC = cl.sum / cl.n;
          const clLeft = clC + cl.offs[0] - cl.units[0].width / 2;
          if (clLeft >= prevRight + C.UNIT_GAP) break;
          // מיזוג הצבר הנוכחי לתוך הקודם
          const base =
            prev.offs[prevLastIdx] +
            prev.units[prevLastIdx].width / 2 +
            C.UNIT_GAP +
            cl.units[0].width / 2 -
            cl.offs[0];
          for (let i = 0; i < cl.units.length; i++) {
            prev.units.push(cl.units[i]);
            prev.offs.push(base + cl.offs[i]);
          }
          prev.sum += cl.sum - cl.n * base;
          prev.n += cl.n;
          cl = clusters.pop();
        }
        clusters.push(cl);
      }
      for (const cl of clusters) {
        const c = cl.sum / cl.n;
        for (let i = 0; i < cl.units.length; i++) cl.units[i].x = c + cl.offs[i];
      }
    };

    // נקודת העיגון של הורי אדם (אמצע זוג ההורים או ההורה היחיד)
    const parentAnchorX = (p) => {
      const f = byId(p.fatherId), m = byId(p.motherId);
      if (f && m) return (memberX(unitOf[f.id], f) + memberX(unitOf[m.id], m)) / 2;
      const one = f || m;
      return one ? memberX(unitOf[one.id], one) : null;
    };

    const desiredFromParents = (u) => {
      let sum = 0, n = 0;
      for (const m of u.members) {
        const ax = parentAnchorX(m);
        if (ax != null) { sum += ax - memberOffset(u, m); n++; }
      }
      return n ? sum / n : null;
    };

    const desiredFromChildren = (u) => {
      const kids = childPersonsOf(u);
      if (!kids.length) return null;
      // קיבוץ ילדים לפי זוג ההורים שלהם (עיגון שונה לכל זוג)
      const groupsByAnchor = {};
      for (const c of kids) {
        const key = (c.fatherId || '') + '|' + (c.motherId || '');
        (groupsByAnchor[key] = groupsByAnchor[key] || []).push(c);
      }
      let sum = 0, n = 0;
      for (const key of Object.keys(groupsByAnchor)) {
        const group = groupsByAnchor[key];
        const meanChildX =
          group.reduce((s, c) => s + memberX(unitOf[c.id], c), 0) / group.length;
        // היסט העיגון של הקבוצה בתוך היחידה
        const sample = group[0];
        const f = byId(sample.fatherId), mo = byId(sample.motherId);
        const inUnit = [f, mo].filter((x) => x && unitOf[x.id] === u);
        if (!inUnit.length) continue;
        const anchorOffset =
          inUnit.reduce((s, x) => s + memberOffset(u, x), 0) / inUnit.length;
        sum += meanChildX - anchorOffset;
        n++;
      }
      return n ? sum / n : null;
    };

    const PASSES = 12;
    for (let pass = 0; pass < PASSES; pass++) {
      for (let li = 1; li < rows.length; li++) {
        for (const u of rows[li]) {
          const d = desiredFromParents(u);
          if (d != null) u.x = d;
        }
        resolveOverlaps(rows[li]);
      }
      for (let li = rows.length - 2; li >= 0; li--) {
        for (const u of rows[li]) {
          const d = desiredFromChildren(u);
          if (d != null) u.x = d;
        }
        resolveOverlaps(rows[li]);
      }
    }
    // מעבר אחרון מלמעלה למטה כדי שהילדים יתיישרו סופית מתחת להורים
    for (let li = 1; li < rows.length; li++) {
      for (const u of rows[li]) {
        const d = desiredFromParents(u);
        if (d != null) u.x = d;
      }
      resolveOverlaps(rows[li]);
    }

    /* ---- 5. תוצאה: מיקומים לכל אדם + נתוני חיבורים ---- */
    const positions = {}; // personId -> {x, y}
    for (const u of units) {
      const y = C.TOP + u.layer * C.ROW_H;
      for (const m of u.members) positions[m.id] = { x: memberX(u, m), y };
    }

    // קווי זוגיות: זוגות מפורשים או הורים משותפים
    const coupleLines = [];
    const seenPair = new Set();
    const addPair = (a, b) => {
      if (!a || !b) return;
      const key = [a.id, b.id].sort().join('~');
      if (seenPair.has(key)) return;
      seenPair.add(key);
      coupleLines.push([a, b]);
    };
    for (const p of persons) {
      if (p.partnerId) addPair(p, byId(p.partnerId));
    }
    for (const p of persons) {
      const f = byId(p.fatherId), m = byId(p.motherId);
      if (f && m) addPair(f, m);
    }

    // חיבורי הורים→ילדים, מקובצים לפי זוג ההורים
    const childLinks = []; // { anchorX, anchorY, fromCouple, children: [person] }
    const seenGroup = new Set();
    for (const p of persons) {
      if (!p.fatherId && !p.motherId) continue;
      const key = (p.fatherId || '') + '|' + (p.motherId || '');
      if (seenGroup.has(key)) continue;
      seenGroup.add(key);
      const siblings = persons
        .filter((q) => (q.fatherId || '') === (p.fatherId || '') && (q.motherId || '') === (p.motherId || ''))
        .filter((q) => q.fatherId || q.motherId)
        .sort((a, b) => a.sortOrder - b.sortOrder);
      const f = byId(p.fatherId), m = byId(p.motherId);
      const parentsHere = [f, m].filter(Boolean);
      if (!parentsHere.length) continue;
      const anchorX = parentsHere.reduce((s, x) => s + positions[x.id].x, 0) / parentsHere.length;
      const anchorY = positions[parentsHere[0].id].y;
      childLinks.push({ anchorX, anchorY, fromCouple: parentsHere.length === 2, children: siblings });
    }

    /* ---- גבולות התוכן ---- */
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    for (const id of Object.keys(positions)) {
      const pos = positions[id];
      minX = Math.min(minX, pos.x - C.PW / 2);
      maxX = Math.max(maxX, pos.x + C.PW / 2);
      minY = Math.min(minY, pos.y - C.R - 20);
      maxY = Math.max(maxY, pos.y + C.R + C.LABEL_H);
    }
    if (!isFinite(minX)) { minX = 0; maxX = 100; minY = 0; maxY = 100; }

    return {
      positions, units, coupleLines, childLinks,
      bbox: { minX, maxX, minY, maxY, width: maxX - minX, height: maxY - minY },
    };
  }

  NS.layout = { build };
})();
