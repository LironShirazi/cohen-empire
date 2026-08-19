/* ============================================================
   העץ המשפחתי — שכבת נתונים (Supabase)

   **אותו API בדיוק כמו בגרסת ה-localStorage** (docs/06 §4):
   get/all/childrenOf/parentsOf/partnersOf/createPerson/updatePerson/
   addParents/addChild/addPartner/canDelete/deletePerson/resetToSeed/
   exportJSON/importJSON/prefs — כדי ש-layout.js, render.js ו-ui.js
   לא ישתנו בכלל.

   ⚠️ **הקריאות נשארות סינכרוניות.** `render.draw()` קורא ל-`all()`
   בתוך הרינדור, ו-ui.js משתמש באובייקט שחוזר מ-`addChild`/`addPartner`
   מיד אחרי הקריאה. לכן: טוענים הכל פעם אחת למפה בזיכרון, קוראים
   ממנה, וכותבים **אופטימית** — מעדכנים את המפה, מציירים מיד, ושולחים
   ל-Supabase ברקע. Realtime מיישר קו אם מישהו אחר שינה משהו.

   `NS.supabase` (וגם `NS.currentUserId`/`NS.isOwner`) מוזרקים מהראוט
   לפני שהקובץ הזה נטען — ראו app/family-tree/tree-canvas.tsx.
   ============================================================ */
(function () {
  'use strict';
  const NS = (window.FT = window.FT || {});

  const PREFS_KEY = 'cohen-family-tree-prefs-v1';
  const BUCKET = 'family-tree';

  let state = { persons: {} };
  // מה שידוע לנו שנמצא בשרת — הבסיס להשוואה בכל שמירה
  let persisted = {};
  let prefs = { editMode: false };
  let pendingWrites = 0;
  let reloadQueued = false;

  const db = () => NS.supabase;

  /* האות לעיגול ללא תמונה — מדלגת על קידומת "סבא"/"סבתא" */
  NS.initialOf = function (name) {
    const words = String(name || '').trim().split(/\s+/).filter(Boolean);
    const main = words.find((w) => w !== 'סבא' && w !== 'סבתא') || words[0] || '?';
    return main.charAt(0);
  };

  // מזהה אמיתי מהסוג של העמודה — העלה נוצר בקליינט ורק אז נשמר,
  // ולכן הוא חייב להיות uuid תקין ולא המזהה הקצר שהיה ב-localStorage
  function uid() {
    return crypto.randomUUID();
  }

  function blankPerson(id) {
    return {
      id,
      name: '',
      lastName: null,    // מוצג מתחת ללב של בני הזוג (render.js)
      gender: null,      // 'm' | 'f' | null
      birthYear: null,
      phone: null,       // מוצג בתצוגה המלאה בלבד
      photo: null,       // URL מה-bucket (או dataURL עד שנשמר)
      fatherId: null,
      motherId: null,
      partnerId: null,
      isRoot: false,
      sortOrder: 0,
    };
  }

  /* ---------- תרגום שורה ↔ אובייקט ---------- */
  function rowToPerson(row) {
    const p = blankPerson(row.id);
    p.name = row.name;
    p.lastName = row.last_name;
    p.gender = row.gender;
    p.birthYear = row.birth_year;
    p.phone = row.phone;
    p.photo = row.photo_url;
    p.fatherId = row.father_id;
    p.motherId = row.mother_id;
    p.partnerId = row.partner_id;
    p.isRoot = !!row.is_root;
    p.sortOrder = row.sort_order;
    return p;
  }

  function personToRow(p) {
    return {
      id: p.id,
      name: p.name || 'ללא שם',
      last_name: p.lastName,
      gender: p.gender,
      birth_year: p.birthYear,
      phone: p.phone,
      photo_url: p.photo,
      father_id: p.fatherId,
      mother_id: p.motherId,
      partner_id: p.partnerId,
      is_root: p.isRoot,
      sort_order: p.sortOrder,
    };
  }

  function normalizePerson(raw) {
    if (!raw || !raw.id || !String(raw.name || '').trim()) return null;
    const p = blankPerson(String(raw.id));
    p.name = String(raw.name).trim().slice(0, 60);
    p.lastName = raw.lastName ? String(raw.lastName).trim().slice(0, 40) : null;
    p.gender = raw.gender === 'm' || raw.gender === 'f' ? raw.gender : null;
    const y = parseInt(raw.birthYear, 10);
    p.birthYear = y >= 1800 && y <= 2200 ? y : null;
    p.phone = raw.phone ? String(raw.phone).trim().slice(0, 20) : null;
    p.photo = typeof raw.photo === 'string' ? raw.photo : null;
    p.fatherId = raw.fatherId ? String(raw.fatherId) : null;
    p.motherId = raw.motherId ? String(raw.motherId) : null;
    p.partnerId = raw.partnerId ? String(raw.partnerId) : null;
    p.isRoot = !!raw.isRoot;
    p.sortOrder = Number.isFinite(+raw.sortOrder) ? +raw.sortOrder : 0;
    return p;
  }

  function snapshot() {
    const out = {};
    for (const id of Object.keys(state.persons)) {
      out[id] = JSON.stringify(personToRow(state.persons[id]));
    }
    return out;
  }

  function fail(message, err) {
    console.error('[family-tree]', message, err);
    if (NS.ui && NS.ui.toast) NS.ui.toast('⚠️ ' + message);
    else alert(message);
  }

  /* ---------- טעינה ---------- */
  async function fetchAll() {
    const { data, error } = await db()
      .from('family_members')
      .select('*')
      .order('sort_order');
    if (error) throw error;

    const persons = {};
    let mine = null;
    for (const row of data) {
      persons[row.id] = rowToPerson(row);
      if (row.profile_id && row.profile_id === NS.currentUserId) mine = row.id;
    }
    state = { persons };
    persisted = snapshot();
    prefs.myId = mine;
  }

  async function load() {
    try {
      prefs = JSON.parse(localStorage.getItem(PREFS_KEY)) || {};
    } catch (e) { prefs = {}; }
    prefs.editMode = !!prefs.editMode;

    await fetchAll();
    subscribe();
  }

  // "עדכון חי כשמישהו מוסיף עלה" (docs/06 §4). העץ קטן, ולכן פשוט
  // טוענים אותו מחדש במקום למזג שורה-שורה — אין כאן את בעיית שני
  // המקורות של הצ'אט, כי יש מקור אחד בלבד
  function subscribe() {
    if (NS.__ftChannel) return;
    NS.__ftChannel = db()
      .channel('family-tree')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'family_members' },
        () => {
          // בזמן שכתיבה שלנו בדרך, הרענון היה מחזיר מצב ישן ומוחק
          // את מה שהמשתמש בדיוק עשה על המסך
          if (pendingWrites > 0) { reloadQueued = true; return; }
          fetchAll()
            .then(() => { if (typeof NS.onDataChanged === 'function') NS.onDataChanged(); })
            .catch((err) => console.error('[family-tree] רענון נכשל', err));
        }
      )
      .subscribe();
  }

  /* ---------- שמירה ---------- */
  function save() {
    // מציירים מיד; הכתיבה עצמה רצה ברקע
    if (typeof NS.onDataChanged === 'function') NS.onDataChanged();
    void persist();
  }

  function savePrefs() {
    try { localStorage.setItem(PREFS_KEY, JSON.stringify({ editMode: prefs.editMode })); }
    catch (e) { /* לא קריטי */ }
  }

  // dataURL → קובץ ב-bucket. התמונה נבחרת במחבר כ-JPEG 512px
  // (ui.js), אז אין כאן דחיסה נוספת — רק העלאה והחלפה ב-URL
  async function uploadPhoto(person) {
    const value = person.photo;
    if (!value || !value.startsWith('data:')) return;
    const blob = await (await fetch(value)).blob();
    const path = `${person.id}/${Date.now()}.jpg`;
    const { error } = await db().storage.from(BUCKET).upload(path, blob, {
      contentType: blob.type || 'image/jpeg',
      upsert: true,
    });
    if (error) throw error;
    const { data } = db().storage.from(BUCKET).getPublicUrl(path);
    person.photo = data.publicUrl;
  }

  // הורים לפני ילדים — FK נבדק לכל שורה בנפרד, ולכן אי אפשר להכניס
  // ילד לפני שההורה שלו קיים בשרת
  function orderForInsert(people) {
    const byId = {};
    for (const p of people) byId[p.id] = p;
    const out = [];
    const done = new Set();
    const visit = (p) => {
      if (!p || done.has(p.id)) return;
      done.add(p.id);
      visit(byId[p.fatherId]);
      visit(byId[p.motherId]);
      out.push(p);
    };
    for (const p of people) visit(p);
    return out;
  }

  async function persist() {
    pendingWrites += 1;
    try {
      const current = state.persons;
      const added = [];
      const changed = [];
      for (const id of Object.keys(current)) {
        if (!(id in persisted)) added.push(current[id]);
        else if (persisted[id] !== JSON.stringify(personToRow(current[id])))
          changed.push(current[id]);
      }
      const removed = Object.keys(persisted).filter((id) => !(id in current));

      if (!added.length && !changed.length && !removed.length) return;

      for (const p of added.concat(changed)) await uploadPhoto(p);

      // תמונת המצב נלקחת **כאן** — אחרי ההעלאות (כדי שתכיל את ה-URL
      // ולא את ה-dataURL) ולפני הכתיבות. אם נעדכן את `persisted` רק
      // בסוף, עריכה שנעשתה בזמן שהכתיבה באוויר הייתה נרשמת כאילו
      // כבר נשמרה — ונעלמת בלי שאיש ידע
      const intended = snapshot();

      // 1. הוספות — בלי partner_id, שהוא מעגלי מעצם טבעו (א↔ב)
      if (added.length) {
        const rows = orderForInsert(added).map((p) => ({
          ...personToRow(p),
          partner_id: null,
          created_by: NS.currentUserId,
        }));
        for (const row of rows) {
          const { error } = await db().from('family_members').insert(row);
          if (error) throw error;
        }
      }

      // 2. עדכונים — כולל ה-partner_id של מה שהרגע נוסף
      for (const p of added.concat(changed)) {
        const { error } = await db()
          .from('family_members')
          .update(personToRow(p))
          .eq('id', p.id);
        if (error) throw error;
      }

      // 3. מחיקות — אחרי שהקשרים כבר נותקו למעלה
      for (const id of removed) {
        const { error } = await db().from('family_members').delete().eq('id', id);
        if (error) {
          if (error.code === '23503') {
            throw new Error('אי אפשר למחוק עלה שיש לו צאצאים');
          }
          throw error;
        }
      }

      persisted = intended;
    } catch (err) {
      fail(err.message || 'השמירה נכשלה', err);
      // המצב על המסך כבר לא מייצג את השרת — טוענים מחדש כדי שלא
      // יישאר עלה "מדומיין" שאף אחד אחר לא רואה
      try {
        await fetchAll();
        if (typeof NS.onDataChanged === 'function') NS.onDataChanged();
      } catch (e) { /* אין מה לעשות מעבר להודעה שכבר הוצגה */ }
    } finally {
      pendingWrites -= 1;
      if (pendingWrites === 0 && reloadQueued) {
        reloadQueued = false;
        fetchAll()
          .then(() => { if (typeof NS.onDataChanged === 'function') NS.onDataChanged(); })
          .catch(() => {});
      }
    }
  }

  /* ---------- שאילתות ---------- */
  function get(id) { return (id && state.persons[id]) || null; }

  function all() {
    return Object.values(state.persons).sort((a, b) => a.sortOrder - b.sortOrder);
  }

  function childrenOf(id) {
    return all().filter((p) => p.fatherId === id || p.motherId === id);
  }

  function parentsOf(id) {
    const p = get(id);
    if (!p) return [];
    return [get(p.fatherId), get(p.motherId)].filter(Boolean);
  }

  function partnersOf(id) {
    const p = get(id);
    if (!p) return [];
    const ids = new Set();
    if (p.partnerId && get(p.partnerId)) ids.add(p.partnerId);
    for (const q of all()) {
      if (q.partnerId === id) ids.add(q.id);
    }
    for (const c of childrenOf(id)) {
      const other = c.fatherId === id ? c.motherId : c.fatherId;
      if (other && get(other)) ids.add(other);
    }
    ids.delete(id);
    return [...ids].map(get);
  }

  function nextSortOrder() {
    return all().reduce((max, p) => Math.max(max, p.sortOrder), -1) + 1;
  }

  /* ---------- שינויים ---------- */
  function createPerson(data) {
    const p = blankPerson(uid());
    p.sortOrder = nextSortOrder();
    applyPatch(p, data);
    if (!p.name) p.name = 'ללא שם';
    state.persons[p.id] = p;
    return p;
  }

  function applyPatch(p, data) {
    if (!data) return;
    if (data.name !== undefined) p.name = String(data.name).trim().slice(0, 60);
    if (data.lastName !== undefined)
      p.lastName = data.lastName ? String(data.lastName).trim().slice(0, 40) : null;
    if (data.gender !== undefined)
      p.gender = data.gender === 'm' || data.gender === 'f' ? data.gender : null;
    if (data.birthYear !== undefined) {
      const y = parseInt(data.birthYear, 10);
      p.birthYear = y >= 1800 && y <= 2200 ? y : null;
    }
    if (data.phone !== undefined)
      p.phone = data.phone ? String(data.phone).trim().slice(0, 20) : null;
    if (data.photo !== undefined) p.photo = data.photo || null;
    if (data.fatherId !== undefined)
      p.fatherId = data.fatherId && data.fatherId !== p.id && state.persons[data.fatherId] ? data.fatherId : null;
    if (data.motherId !== undefined)
      p.motherId = data.motherId && data.motherId !== p.id && state.persons[data.motherId] ? data.motherId : null;
  }

  function updatePerson(id, patch) {
    const p = get(id);
    if (!p) return;
    applyPatch(p, patch);
    save();
    return p;
  }

  // הוספת אבא ו/או אמא לעלה. fatherData/motherData: אובייקט פרטים או null.
  function addParents(childId, fatherData, motherData) {
    const child = get(childId);
    if (!child) return;
    let father = get(child.fatherId);
    let mother = get(child.motherId);
    if (!father && fatherData) {
      father = createPerson({ ...fatherData, gender: 'm' });
      child.fatherId = father.id;
    }
    if (!mother && motherData) {
      mother = createPerson({ ...motherData, gender: 'f' });
      child.motherId = mother.id;
    }
    // קישור זוגיות בין ההורים אם שניהם קיימים ופנויים
    if (father && mother) {
      if (!father.partnerId) father.partnerId = mother.id;
      if (!mother.partnerId) mother.partnerId = father.id;
    }
    save();
  }

  // הוספת בן/בת לעלה. otherParent: { id } קיים, { create: data } חדש, או null.
  function addChild(parentId, childData, otherParent) {
    const parent = get(parentId);
    if (!parent) return;
    let other = null;
    if (otherParent && otherParent.id) other = get(otherParent.id);
    if (otherParent && otherParent.create) {
      const g =
        otherParent.create.gender ||
        (parent.gender === 'm' ? 'f' : parent.gender === 'f' ? 'm' : null);
      other = createPerson({ ...otherParent.create, gender: g });
      if (!parent.partnerId) parent.partnerId = other.id;
      if (!other.partnerId) other.partnerId = parent.id;
    }
    const child = createPerson(childData);
    // שיבוץ אבא/אמא לפי מגדר, עם עדיפות לשדה הפנוי
    const put = (person, slot) => { child[slot] = person.id; };
    if (parent.gender === 'f') put(parent, 'motherId');
    else put(parent, 'fatherId');
    if (other) {
      const freeSlot = child.fatherId ? 'motherId' : 'fatherId';
      if (other.gender === 'f' && !child.motherId) put(other, 'motherId');
      else if (other.gender === 'm' && !child.fatherId) put(other, 'fatherId');
      else put(other, freeSlot);
    }
    save();
    return child;
  }

  function addPartner(personId, data) {
    const p = get(personId);
    if (!p) return;
    const g = data.gender || (p.gender === 'm' ? 'f' : p.gender === 'f' ? 'm' : null);
    const partner = createPerson({ ...data, gender: g });
    if (!p.partnerId) p.partnerId = partner.id;
    partner.partnerId = p.id;
    save();
    return partner;
  }

  function canDelete(id) {
    return childrenOf(id).length === 0;
  }

  function deletePerson(id) {
    if (!canDelete(id)) return false;
    for (const q of all()) {
      if (q.partnerId === id) q.partnerId = null;
      if (q.fatherId === id) q.fatherId = null;
      if (q.motherId === id) q.motherId = null;
    }
    delete state.persons[id];
    if (prefs.myId === id) prefs.myId = null;
    save();
    return true;
  }

  /* ---------- פעולות הרסניות על נתונים משותפים ---------- */
  // העץ כבר לא פרטי לדפדפן: איפוס או ייבוא מוחקים את מה שכל המשפחה
  // הזינה. לכן הם למנהל-על בלבד (docs/06 §4), ולא לכל מי שנכנס
  function requireOwner() {
    if (!NS.isOwner) {
      throw new Error('הפעולה הזו שמורה למנהל-על — העץ משותף לכל המשפחה');
    }
  }

  function resetToSeed() {
    // ui.js לא עוטף את הקריאה הזו ב-try, ולכן מסבירים כאן ולא זורקים
    if (!NS.isOwner) {
      alert('איפוס העץ שמור למנהל-על — העץ משותף לכל המשפחה');
      return;
    }
    alert('איפוס העץ ההתחלתי נעשה מול מסד הנתונים ולא מהדפדפן — פנו למנהל.');
  }

  /* ---------- גיבוי / ייבוא ---------- */
  function exportJSON() {
    const persons = {};
    for (const p of all()) persons[p.id] = p;
    return JSON.stringify(
      { app: 'cohen-family-tree', exportedAt: new Date().toISOString(), version: 1, persons },
      null,
      1
    );
  }

  function importJSON(text) {
    requireOwner();
    const raw = JSON.parse(text);
    if (!raw || typeof raw.persons !== 'object') throw new Error('קובץ לא מזוהה');
    const persons = {};
    for (const k of Object.keys(raw.persons)) {
      const p = normalizePerson(raw.persons[k]);
      if (p) persons[p.id] = p;
    }
    if (!Object.keys(persons).length) throw new Error('הקובץ לא מכיל אנשים');
    state = { persons };
    save();
  }

  /* ---------- העדפות ---------- */
  // editMode נשאר מקומי (העדפת תצוגה פר-מכשיר). myId הוא כבר לא
  // העדפה אלא נתון משותף — השדה profile_id של השורה
  async function claim(nextId) {
    const previous = prefs.myId;
    if (previous === nextId) return;
    prefs.myId = nextId;
    if (typeof NS.onDataChanged === 'function') NS.onDataChanged();

    pendingWrites += 1;
    try {
      if (previous) {
        const { error } = await db()
          .from('family_members')
          .update({ profile_id: null })
          .eq('id', previous);
        if (error) throw error;
      }
      if (nextId) {
        const { error } = await db()
          .from('family_members')
          .update({ profile_id: NS.currentUserId })
          .eq('id', nextId);
        if (error) throw error;
      }
    } catch (err) {
      prefs.myId = previous;
      fail(err.message || 'לא הצלחנו לעדכן את "זה אני"', err);
      if (typeof NS.onDataChanged === 'function') NS.onDataChanged();
    } finally {
      pendingWrites -= 1;
    }
  }

  const prefsApi = {
    get editMode() { return prefs.editMode; },
    set editMode(v) { prefs.editMode = !!v; savePrefs(); },
    get myId() { return prefs.myId || null; },
    set myId(v) { void claim(v || null); },
  };

  NS.store = {
    load, get, all, childrenOf, parentsOf, partnersOf,
    createPerson: (d) => { const p = createPerson(d); save(); return p; },
    updatePerson, addParents, addChild, addPartner,
    canDelete, deletePerson, resetToSeed,
    exportJSON, importJSON,
    prefs: prefsApi,
  };
})();
