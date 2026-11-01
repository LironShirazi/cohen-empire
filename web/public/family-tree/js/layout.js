/* ============================================================
   העץ המשפחתי — חישוב פריסה
   האלגוריתם: איחוד בני זוג ל"יחידות", שיוך יחידות לדורות, ואז
   בנייה מלמטה למעלה בשיטת טטריס: לכל תת-עץ נשמר הרוחב שהוא תופס בכל
   שורה (כולל קווים שעוברים דרכה), ותתי-עצים סמוכים מחליקים זה לצד זה
   עד שהם נוגעים. שתי משפחות לא תופסות אותו מקום באותה שורה, ולכן
   בעץ רגיל קווים לא נחתכים; ההורים תמיד ממורכזים מעל הילדים.

   דור יכול להתפרס על כמה שורות: משפחה יורדת לשורה נמוכה יותר אם
   השורה עברה את MAX_PER_ROW או אם הירידה מצמצמת את רוחב העץ — קודם
   המשפחה עם הכי הרבה ילדים.
   ============================================================ */
(function () {
  'use strict';
  const NS = (window.FT = window.FT || {});

  /**
   * ⚠️ הבכור מימין. `NS.compareSiblings` מחזיר בכור-ראשון (סדר קריאה),
   * אבל כאן אינדקס 0 מקבל את ה-x הקטן ביותר — כלומר את הצד השמאלי.
   * לכן כל שימוש בו כאן מסתיים ב-`.reverse()`, והצעיר יוצא שמאלה.
   */
  const siblingOrder = (a, b) =>
    NS.compareSiblings ? NS.compareSiblings(a, b) : a.sortOrder - b.sortOrder;

  const C = (NS.CONST = {
    R: 36,          // רדיוס עיגול
    PW: 100,        // רוחב משבצת לאדם
    ROW_H: 190,     // גובה שורה
    UNIT_GAP: 34,   // רווח מינימלי בין אחים
    FAMILY_GAP: 90, // רווח מינימלי בין משפחות שונות באותה שורה (בני דודים)
    STEM_W: 20,     // הרוחב שקו תופס בשורה שהוא עובר דרכה
    TOP: 90,        // שוליים עליונים
    LABEL_H: 46,    // גובה הטקסט מתחת לעיגול
    MAX_PER_ROW: 30, // מקסימום עלים בשורה, כולל בני זוג
    SINK_MIN_GAIN: 150, // ירידה לשורה נמוכה יותר חייבת לחסוך לפחות כך ברוחב
    SINK_BUDGET_MS: 400, // תקרת זמן לחיפוש הרוחב — הוא רץ על ה-thread של המסך
    // גבהי הקו האופקי של משפחה, בפיקסלים מעל מרכז שורת הילדים. הראשון הוא
    // ברירת המחדל; השאר לקווים שהיו מתמזגים — קורה רק כשהעץ אינו עץ פשוט
    // (נישואים בין ענפים). התחום מוגבל: מעל 108 מתחיל הטקסט של השורה
    // שמעל, ומתחת ל-36 העיגול של הילד.
    BUS_LANES: [62, 76, 90, 48, 104],
    BUS_MARGIN: 14, // קווים שקרובים מזה באותו גובה ייראו כקו אחד
  });

  /**
   * השיוך לשורות האחרון. החיפוש יקר יחסית ו-`build` רץ בכל הקשה על אדם,
   * בעוד שבחירה לא משנה את המבנה — לכן הוא רץ רק כשהמבנה השתנה.
   */
  let tierCache = null;

  /* איחוד־קבוצות (union-find) פשוט */
  function makeUF(ids) {
    const parent = {};
    ids.forEach((id) => (parent[id] = id));
    const find = (x) => (parent[x] === x ? x : (parent[x] = find(parent[x])));
    const union = (a, b) => { const ra = find(a), rb = find(b); if (ra !== rb) parent[rb] = ra; };
    return { find, union };
  }

  /* מתאר: לכל שורה — הקצה השמאלי והימני שתת-העץ תופס בה */
  const extend = (contour, row, l, r) => {
    const cur = contour[row];
    if (!cur) contour[row] = [l, r];
    else { cur[0] = Math.min(cur[0], l); cur[1] = Math.max(cur[1], r); }
  };
  const absorb = (contour, other, dx) => {
    for (const row of Object.keys(other)) extend(contour, row, other[row][0] + dx, other[row][1] + dx);
  };
  /* כמה להזיז את `next` ימינה כדי שיעמוד לצד `acc` בלי לגעת בו באף שורה */
  const slideRight = (acc, next, gapAt) => {
    let shift = -Infinity;
    for (const row of Object.keys(next)) {
      if (acc[row]) shift = Math.max(shift, acc[row][1] + gapAt(Number(row)) - next[row][0]);
    }
    if (shift !== -Infinity) return shift;
    // אין שורה משותפת — נשארים בסדר, פשוט זה אחרי זה
    const right = Math.max(...Object.values(acc).map((e) => e[1]));
    const left = Math.min(...Object.values(next).map((e) => e[0]));
    return right + gapAt(-1) - left;
  };

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
        layer: 0, // הדור
        row: 0,   // השורה בפועל — דור יכול להתפרס על כמה שורות
        x: 0,
      };
      units.push(unit);
      members.forEach((m) => (unitOf[m.id] = unit));
    }

    const parentsKey = (p) => (p.fatherId || '') + '|' + (p.motherId || '');
    const parentsIn = (p) => [byId(p.fatherId), byId(p.motherId)].filter(Boolean);

    const parentUnitsOf = (unit) => {
      const set = new Set();
      for (const m of unit.members) {
        for (const parent of parentsIn(m)) {
          if (unitOf[parent.id] !== unit) set.add(unitOf[parent.id]);
        }
      }
      return [...set];
    };
    const childPersonsOf = (unit) => {
      const memberIds = new Set(unit.members.map((m) => m.id));
      return persons
        .filter((p) => (p.fatherId && memberIds.has(p.fatherId)) || (p.motherId && memberIds.has(p.motherId)))
        .filter((p) => !memberIds.has(p.id))
        .sort(siblingOrder)
        .reverse();
    };
    for (const u of units) u.kids = childPersonsOf(u);

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

    /* ---- 3. סריקת עומק מהשורשים. מי שהגיעו אליו ראשון הוא ההורה "הראשי"
       שלו, וזה מה שהופך את הגרף לעץ. נישואים בין ענפים נותנים ליחידה הורה
       שני — הקו שלו מצויר, אבל הוא לא משפיע על המיקום ---- */
    const genRows = [];
    const placed = new Set();
    const primaryKids = new Map(units.map((u) => [u, []]));
    const treeRoots = [];
    const visit = (u) => {
      placed.add(u);
      (genRows[u.layer] = genRows[u.layer] || []).push(u);
      for (const c of u.kids) {
        const v = unitOf[c.id];
        if (placed.has(v)) continue;
        primaryKids.get(u).push(v);
        visit(v);
      }
    };
    const startFrom = (u) => {
      if (placed.has(u)) return;
      treeRoots.push(u);
      visit(u);
    };
    units
      .filter((u) => parentUnitsOf(u).length === 0)
      .sort((a, b) => Math.min(...a.members.map((m) => m.sortOrder)) - Math.min(...b.members.map((m) => m.sortOrder)))
      .forEach(startFrom);
    units.forEach(startFrom); // ליתר ביטחון — יחידות שלא הושגו
    for (let i = 0; i < genRows.length; i++) genRows[i] = genRows[i] || [];

    /* ---- בלוקים: מה שיורד לשורה חדשה יורד יחד. אחים לא מתפצלים, ונישואים
       בין שני ענפים מחברים את שתי המשפחות לבלוק אחד ---- */
    const blocksByGen = genRows.map((row) => {
      const genUF = makeUF(row.map((u) => u.id));
      const firstOfKey = {};
      for (const u of row) {
        for (const m of u.members) {
          if (!parentsIn(m).length) continue;
          const key = parentsKey(m);
          if (firstOfKey[key]) genUF.union(firstOfKey[key], u.id);
          else firstOfKey[key] = u.id;
        }
      }
      const byRoot = {};
      const blocks = [];
      for (const u of row) {
        const r = genUF.find(u.id);
        if (!byRoot[r]) blocks.push((byRoot[r] = { units: [], kids: 0, size: 0, tier: 0 }));
        const block = byRoot[r];
        block.units.push(u);
        block.kids += u.members.filter((m) => parentsIn(m).length).length;
        block.size += u.members.length;
        u.block = block;
      }
      return blocks;
    });

    /* ---- 4. מיקומי X ---- */
    const memberX = (u, m) => {
      const idx = u.members.indexOf(m);
      return u.x - u.width / 2 + C.PW / 2 + idx * C.PW;
    };
    const memberOffset = (u, m) => memberX(u, m) - u.x;

    /* בונה את תת-העץ של `u` סביב u.x = 0 ומחזיר את המתאר שלו */
    const measure = (u) => {
      const contour = {};
      extend(contour, u.row, -u.width / 2, u.width / 2);

      // ילדים ראשיים, מקובצים למשפחות — יחידה עם שני בני זוג אחרי
      // נישואים שניים מחזיקה יותר ממשפחה אחת
      const famByKey = new Map();
      for (const v of primaryKids.get(u)) {
        const lead = v.members.find((m) => parentsIn(m).some((x) => unitOf[x.id] === u));
        const key = parentsKey(lead);
        if (!famByKey.has(key)) {
          famByKey.set(key, { lead, kids: [], contour: {} });
        }
        famByKey.get(key).kids.push(v);
      }
      const fams = [...famByKey.values()];
      u.kidDx = [];
      if (!fams.length) return contour;

      for (const fam of fams) {
        const topRow = Math.min(...fam.kids.map((v) => v.row));
        fam.placed = [];
        for (const v of fam.kids) {
          const cv = measure(v);
          const dx = fam.placed.length
            ? slideRight(fam.contour, cv, (row) => (row === topRow ? C.UNIT_GAP : C.FAMILY_GAP))
            : 0;
          absorb(fam.contour, cv, dx);
          fam.placed.push({ v, dx });
        }
        // מרכז הקו האופקי של המשפחה: אמצע שני הילדים הקיצוניים
        const drops = fam.placed.flatMap(({ v, dx }) =>
          v.members
            .filter((m) => parentsIn(m).some((x) => unitOf[x.id] === u))
            .map((m) => {
              const memberDx = dx + memberOffset({ x: 0, members: v.members, width: v.width }, m);
              // ילד בשורה נמוכה מאחיו: הקו שלו עובר דרך השורות שביניהם
              for (let r = topRow; r < v.row; r++) {
                extend(fam.contour, r, memberDx - C.STEM_W / 2, memberDx + C.STEM_W / 2);
              }
              return memberDx;
            })
        );
        fam.center = (Math.min(...drops) + Math.max(...drops)) / 2;
        fam.topRow = topRow;
        const parentsHere = parentsIn(fam.lead).filter((x) => unitOf[x.id] === u);
        fam.anchorOffset =
          parentsHere.reduce((s, x) => s + memberOffset({ x: 0, members: u.members, width: u.width }, x), 0) /
          parentsHere.length;
      }

      // המשפחות זו לצד זו, והיחידה מתרכזת מעל ממוצע העוגנים
      const all = {};
      let goal = 0;
      fams.forEach((fam, i) => {
        fam.dx = i ? slideRight(all, fam.contour, () => C.FAMILY_GAP) : 0;
        absorb(all, fam.contour, fam.dx);
        goal += fam.dx + fam.center - fam.anchorOffset;
      });
      goal /= fams.length;

      for (const fam of fams) {
        const anchor = fam.anchorOffset;
        for (const { v, dx } of fam.placed) u.kidDx.push({ v, dx: fam.dx + dx - goal });
        // הקו מההורים עובר בכל שורה שעד המשפחה, וברוחב שלה כולל העוגן
        for (let r = u.row + 1; r < fam.topRow; r++) {
          extend(contour, r, anchor - C.STEM_W / 2, anchor + C.STEM_W / 2);
        }
        extend(contour, fam.topRow, anchor, anchor);
      }
      absorb(contour, all, -goal);
      return contour;
    };

    const setX = (u, x) => {
      u.x = x;
      for (const { v, dx } of u.kidDx) setX(v, x + dx);
    };
    const subtreeUnits = (u) => [u, ...primaryKids.get(u).flatMap(subtreeUnits)];

    const arrange = () => {
      let base = 0;
      genRows.forEach((genRow) => {
        const tiers = [...new Set(genRow.map((u) => u.block.tier))].sort((a, b) => a - b);
        for (const u of genRow) u.row = base + tiers.indexOf(u.block.tier);
        base += tiers.length;
      });

      // העץ הגדול קודם; עץ נוסף (למשל הורי כלה) מתקרב למי שהוא קשור אליו,
      // למקום הפנוי הקרוב — כמו שמתאר חוסם ענפים, רק בלי סדר קבוע
      const trees = treeRoots
        .map((root) => {
          const contour = measure(root);
          setX(root, 0);
          return { root, contour, list: subtreeUnits(root) };
        })
        .sort((a, b) => b.list.length - a.list.length);

      const taken = {}; // row -> [[l, r], ...]
      const inPlace = new Set();
      for (const tree of trees) {
        // הזזה רצויה: שהקשרים אל מה שכבר הונח יהיו קצרים ככל האפשר
        const pulls = [];
        for (const u of tree.list) {
          for (const c of u.kids) {
            const v = unitOf[c.id];
            if (inPlace.has(v)) pulls.push(memberX(v, c) - u.x);
          }
          for (const m of u.members) {
            for (const parent of parentsIn(m)) {
              const pu = unitOf[parent.id];
              if (inPlace.has(pu)) pulls.push(memberX(pu, parent) - memberX(u, m));
            }
          }
        }
        const fits = (s) =>
          Object.keys(tree.contour).every((row) =>
            (taken[row] || []).every(
              ([l, r]) =>
                tree.contour[row][1] + s + C.FAMILY_GAP <= l || tree.contour[row][0] + s - C.FAMILY_GAP >= r
            )
          );
        let shift = 0;
        if (Object.keys(taken).length) {
          const edge = Math.max(...Object.values(taken).flat().map((e) => e[1]));
          const left = Math.min(...Object.values(tree.contour).map((e) => e[0]));
          const fallback = edge + C.FAMILY_GAP - left;
          const want = pulls.length ? pulls.reduce((s, x) => s + x, 0) / pulls.length : fallback;
          const options = [want, fallback];
          for (const row of Object.keys(tree.contour)) {
            for (const [l, r] of taken[row] || []) {
              options.push(r + C.FAMILY_GAP - tree.contour[row][0]);
              options.push(l - C.FAMILY_GAP - tree.contour[row][1]);
            }
          }
          shift = options
            .filter(fits)
            .reduce((b, s) => (Math.abs(s - want) < Math.abs(b - want) ? s : b), fallback);
        }
        for (const u of tree.list) { u.x += shift; inPlace.add(u); }
        for (const row of Object.keys(tree.contour)) {
          (taken[row] = taken[row] || []).push([tree.contour[row][0] + shift, tree.contour[row][1] + shift]);
        }
      }

      let minX = Infinity, maxX = -Infinity;
      for (const u of units) {
        minX = Math.min(minX, u.x - u.width / 2);
        maxX = Math.max(maxX, u.x + u.width / 2);
      }
      return isFinite(minX) ? maxX - minX : 0;
    };

    /* ---- 5. הטטריס: אילו משפחות יורדות לשורה נמוכה יותר ---- */
    const signature = persons
      .map((p) => [p.id, p.fatherId, p.motherId, p.partnerId, p.gender, p.birthYear, p.sortOrder].join(','))
      .join(';');

    if (tierCache && tierCache.signature === signature) {
      for (const u of units) u.block.tier = tierCache.tiers[u.members[0].id] || 0;
    } else {
      const byKids = (a, b) => b.kids - a.kids || b.size - a.size;
      // השורה הראשונה מתחת ל-`block` שיש בה מקום, ואם אין — שורה חדשה
      const nextFit = (blocks, block) => {
        for (let t = block.tier + 1; ; t++) {
          const used = blocks.filter((b) => b.tier === t).reduce((s, b) => s + b.size, 0);
          // שורה ריקה מקבלת הכל: משפחה שגדולה מהתקרה לא תיכנס לשום שורה
          if (!used || used + block.size <= C.MAX_PER_ROW) return t;
        }
      };

      // א. תקרת העלים בשורה. משפחה בודדת גדולה מהתקרה נשארת שלמה —
      // אחים לא מתפצלים
      for (const blocks of blocksByGen) {
        for (let t = 0; t <= blocks.length; t++) {
          for (;;) {
            const here = blocks.filter((b) => b.tier === t);
            if (here.length < 2 || here.reduce((s, b) => s + b.size, 0) <= C.MAX_PER_ROW) break;
            const biggest = here.sort(byKids)[0];
            biggest.tier = nextFit(blocks, biggest);
          }
        }
      }

      // ב. רוחב: משפחה שתופסת רוחב שמרחיק את השכנות שלה יורדת, אם זה
      // באמת מצמצם את העץ
      let width = arrange();
      const deadline = Date.now() + C.SINK_BUDGET_MS;
      for (let round = 0; round < 3; round++) {
        let improved = false;
        for (const blocks of blocksByGen) {
          for (const block of blocks.slice().sort(byKids)) {
            if (!block.kids || Date.now() > deadline) continue;
            const was = block.tier;
            block.tier = nextFit(blocks, block);
            const w = arrange();
            if (w <= width - C.SINK_MIN_GAIN) { width = w; improved = true; }
            else block.tier = was;
          }
        }
        if (!improved) break;
      }

      const tiers = {};
      for (const u of units) tiers[u.members[0].id] = u.block.tier;
      tierCache = { signature, tiers };
    }

    arrange();

    /* ---- 6. תוצאה: מיקומים לכל אדם + נתוני חיבורים ---- */
    const positions = {}; // personId -> {x, y}
    for (const u of units) {
      const y = C.TOP + u.row * C.ROW_H;
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
      const key = parentsKey(p);
      if (seenGroup.has(key)) continue;
      seenGroup.add(key);
      const siblings = persons
        .filter((q) => (q.fatherId || '') === (p.fatherId || '') && (q.motherId || '') === (p.motherId || ''))
        .filter((q) => q.fatherId || q.motherId)
        .sort(siblingOrder)
        .reverse();
      const parentsHere = parentsIn(p);
      if (!parentsHere.length) continue;
      const anchorX = parentsHere.reduce((s, x) => s + positions[x.id].x, 0) / parentsHere.length;
      const anchorY = positions[parentsHere[0].id].y;
      childLinks.push({ anchorX, anchorY, fromCouple: parentsHere.length === 2, children: siblings });
    }

    /* ---- גובה הקו האופקי של כל משפחה ----
       קו באותו גובה כמו של משפחה סמוכה מתמזג איתו, ובני דודים נראים כאחים.
       לכן כל שורה מקבלת צביעת אינטרוולים חמדנית: משפחה עוברת לגובה הבא
       רק כשהקו שלה באמת נתקל בקו אחר. כשכל הגבהים תפוסים — הגובה שמתפנה
       הכי מוקדם, כי התחום בין השורות מוגבל. */
    const linksByRow = {};
    for (const link of childLinks) {
      const xs = link.children.map((c) => positions[c.id].x);
      link.rowY = Math.min(...link.children.map((c) => positions[c.id].y));
      link.minX = Math.min(...xs, link.anchorX);
      link.maxX = Math.max(...xs, link.anchorX);
      (linksByRow[link.rowY] = linksByRow[link.rowY] || []).push(link);
    }
    for (const rowLinks of Object.values(linksByRow)) {
      rowLinks.sort((a, b) => a.minX - b.minX || a.maxX - b.maxX);
      const laneEnds = C.BUS_LANES.map(() => -Infinity);
      for (const link of rowLinks) {
        let lane = laneEnds.findIndex((end) => end + C.BUS_MARGIN < link.minX);
        if (lane < 0) lane = laneEnds.indexOf(Math.min(...laneEnds));
        laneEnds[lane] = Math.max(laneEnds[lane], link.maxX);
        link.busY = link.rowY - C.BUS_LANES[lane];
      }
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
