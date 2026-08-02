/* ============================================================
   העץ המשפחתי — שכבת נתונים
   כרגע: localStorage (עובד מכל דפדפן, ללא שרת).
   בעתיד: מוחלף במתאם Supabase — ראו docs/06-family-tree.md.
   ============================================================ */
(function () {
  'use strict';
  const NS = (window.FT = window.FT || {});

  const DATA_KEY = 'cohen-family-tree-v1';
  const PREFS_KEY = 'cohen-family-tree-prefs-v1';

  let state = null; // { version, seq, persons: { id: person } }
  let prefs = null; // { editMode, myId }

  /* האות לעיגול ללא תמונה — מדלגת על קידומת "סבא"/"סבתא" */
  NS.initialOf = function (name) {
    const words = String(name || '').trim().split(/\s+/).filter(Boolean);
    const main = words.find((w) => w !== 'סבא' && w !== 'סבתא') || words[0] || '?';
    return main.charAt(0);
  };

  function uid() {
    return 'p' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  }

  function blankPerson(id) {
    return {
      id,
      name: '',
      gender: null,      // 'm' | 'f' | null
      birthYear: null,
      phone: null,       // מוצג בתצוגה המלאה בלבד
      photo: null,       // data URL
      fatherId: null,
      motherId: null,
      partnerId: null,   // בן/בת זוג מפורש (זוגיות מוסקת גם מהורות משותפת)
      isRoot: false,     // סבא אורגני + סבתא טראקי — "העיקר"
      sortOrder: 0,
    };
  }

  function normalizePerson(raw) {
    if (!raw || !raw.id || !String(raw.name || '').trim()) return null;
    const p = blankPerson(String(raw.id));
    p.name = String(raw.name).trim().slice(0, 60);
    p.gender = raw.gender === 'm' || raw.gender === 'f' ? raw.gender : null;
    const y = parseInt(raw.birthYear, 10);
    p.birthYear = y >= 1800 && y <= 2200 ? y : null;
    p.phone = raw.phone ? String(raw.phone).trim().slice(0, 20) : null;
    p.photo =
      typeof raw.photo === 'string' && raw.photo.startsWith('data:image/')
        ? raw.photo
        : null;
    p.fatherId = raw.fatherId ? String(raw.fatherId) : null;
    p.motherId = raw.motherId ? String(raw.motherId) : null;
    p.partnerId = raw.partnerId ? String(raw.partnerId) : null;
    p.isRoot = !!raw.isRoot;
    p.sortOrder = Number.isFinite(+raw.sortOrder) ? +raw.sortOrder : 0;
    return p;
  }

  /* ---------- העץ ההתחלתי של המשפחה ---------- */
  function seedState() {
    let seq = 0;
    const persons = {};
    const add = (id, name, gender, fatherId, motherId, isRoot) => {
      const p = blankPerson(id);
      p.name = name;
      p.gender = gender;
      p.fatherId = fatherId || null;
      p.motherId = motherId || null;
      p.isRoot = !!isRoot;
      p.sortOrder = seq++;
      persons[id] = p;
      return p;
    };

    // ההורים של סבא אורגני
    add('saada', 'סבא סעדה', 'm');
    add('mazhela', 'סבתא מז׳לה', 'f');
    persons.saada.partnerId = 'mazhela';
    persons.mazhela.partnerId = 'saada';

    // ההורים של סבתא טראקי
    add('khavita', 'סבא חוויטה', 'm');
    add('jula', 'סבתא ג׳ולה', 'f');
    persons.khavita.partnerId = 'jula';
    persons.jula.partnerId = 'khavita';

    // העיקר — סבא אורגני וסבתא טראקי
    add('reuven', 'סבא אורגני ראובן', 'm', 'saada', 'mazhela', true);
    add('traki', 'סבתא טראקי', 'f', 'khavita', 'jula', true);
    persons.reuven.partnerId = 'traki';
    persons.traki.partnerId = 'reuven';

    // הילדים של אורגני וטראקי
    const kids = [
      ['shlomo', 'שלמה', 'm'],
      ['yael', 'יעל', 'f'],
      ['zion', 'ציון', 'm'],
      ['ruti', 'רותי', 'f'],
      ['roni', 'רוני', null],
      ['ilana', 'אילנה', 'f'],
      ['haim', 'חיים', 'm'],
      ['sigal', 'סיגל', 'f'],
      ['uri', 'אורי סלע', 'm'],
      ['nurit', 'נורית', 'f'],
    ];
    for (const [id, name, g] of kids) add(id, name, g, 'reuven', 'traki');

    return { version: 1, seq, persons };
  }

  /* ---------- טעינה ושמירה ---------- */
  function load() {
    try {
      const raw = JSON.parse(localStorage.getItem(DATA_KEY));
      if (raw && raw.persons) {
        const persons = {};
        for (const k of Object.keys(raw.persons)) {
          const p = normalizePerson(raw.persons[k]);
          if (p) persons[p.id] = p;
        }
        if (Object.keys(persons).length) {
          state = { version: 1, seq: +raw.seq || Object.keys(persons).length, persons };
        }
      }
    } catch (e) { /* נתונים פגומים — מתחילים מהעץ ההתחלתי */ }
    if (!state) state = seedState();

    try {
      prefs = JSON.parse(localStorage.getItem(PREFS_KEY)) || {};
    } catch (e) { prefs = {}; }
    prefs.editMode = !!prefs.editMode;
    prefs.myId = prefs.myId && state.persons[prefs.myId] ? prefs.myId : null;
  }

  function save() {
    try {
      localStorage.setItem(DATA_KEY, JSON.stringify(state));
    } catch (e) {
      alert('שמירת הנתונים נכשלה — ייתכן שנגמר המקום בדפדפן. מומלץ לייצא גיבוי ולהקטין תמונות.');
    }
    if (typeof NS.onDataChanged === 'function') NS.onDataChanged();
  }

  function savePrefs() {
    try { localStorage.setItem(PREFS_KEY, JSON.stringify(prefs)); } catch (e) { /* לא קריטי */ }
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

  /* ---------- שינויים ---------- */
  function createPerson(data) {
    const p = blankPerson(uid());
    p.sortOrder = state.seq++;
    applyPatch(p, data);
    if (!p.name) p.name = 'ללא שם';
    state.persons[p.id] = p;
    return p;
  }

  function applyPatch(p, data) {
    if (!data) return;
    if (data.name !== undefined) p.name = String(data.name).trim().slice(0, 60);
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
    if (prefs.myId === id) { prefs.myId = null; savePrefs(); }
    save();
    return true;
  }

  function resetToSeed() {
    state = seedState();
    prefs.myId = null;
    savePrefs();
    save();
  }

  /* ---------- גיבוי / ייבוא ---------- */
  function exportJSON() {
    return JSON.stringify({ app: 'cohen-family-tree', exportedAt: new Date().toISOString(), ...state }, null, 1);
  }

  function importJSON(text) {
    const raw = JSON.parse(text);
    if (!raw || typeof raw.persons !== 'object') throw new Error('קובץ לא מזוהה');
    const persons = {};
    for (const k of Object.keys(raw.persons)) {
      const p = normalizePerson(raw.persons[k]);
      if (p) persons[p.id] = p;
    }
    if (!Object.keys(persons).length) throw new Error('הקובץ לא מכיל אנשים');
    state = { version: 1, seq: +raw.seq || Object.keys(persons).length + 1, persons };
    if (prefs.myId && !persons[prefs.myId]) { prefs.myId = null; savePrefs(); }
    save();
  }

  /* ---------- העדפות ---------- */
  const prefsApi = {
    get editMode() { return prefs.editMode; },
    set editMode(v) { prefs.editMode = !!v; savePrefs(); },
    get myId() { return prefs.myId; },
    set myId(v) { prefs.myId = v || null; savePrefs(); },
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
