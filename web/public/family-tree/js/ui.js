/* ============================================================
   העץ המשפחתי — ממשק משתמש
   כרטיס עלה, תצוגה מוגדלת, טפסי הוספה/עריכה, "אני בעץ",
   חיפוש, תפריט ייצוא, מצב עריכה.
   ============================================================ */
(function () {
  'use strict';
  const NS = (window.FT = window.FT || {});

  const $ = (sel) => document.querySelector(sel);
  const esc = (s) =>
    String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

  let currentCardId = null;

  /* ---------- עזרים ---------- */
  function toast(msg) {
    const t = $('#toast');
    t.textContent = msg;
    t.classList.remove('hidden');
    clearTimeout(toast._t);
    toast._t = setTimeout(() => t.classList.add('hidden'), 2600);
  }

  function avatarHTML(p, size) {
    const cls = p.gender === 'm' ? 'g-m' : p.gender === 'f' ? 'g-f' : 'g-n';
    if (p.photo)
      return `<img class="avatar ${cls}" style="width:${size}px;height:${size}px" src="${p.photo}" alt="">`;
    const initial = NS.initialOf(p.name);
    return `<div class="avatar avatar-initial ${cls}" style="width:${size}px;height:${size}px;font-size:${Math.round(size * 0.42)}px">${esc(initial)}</div>`;
  }

  function chip(p) {
    return `<button class="chip" data-goto="${esc(p.id)}">${avatarHTML(p, 22)}<span>${esc(p.name)}</span></button>`;
  }

  function wireChips(container) {
    container.querySelectorAll('[data-goto]').forEach((el) => {
      el.addEventListener('click', () => {
        closeFull();
        openCard(el.getAttribute('data-goto'));
      });
    });
  }

  /* ---------- מיקום התמונה בעיגול ----------
     מה שנשמר הוא בדיוק הריבוע שנחתך כאן, ולכן אף מקום תצוגה לא צריך
     לדעת על החיתוך: ה-SVG (preserveAspectRatio="…slice") וה-CSS
     (object-fit: cover) ממשיכים לקבל תמונה מרובעת כמו קודם. */
  function cropOverlay() {
    let el = document.getElementById('crop-overlay');
    if (!el) {
      el = document.createElement('div');
      el.id = 'crop-overlay';
      el.className = 'overlay crop-overlay hidden';
      (document.querySelector('.ft-root') || document.body).appendChild(el);
    }
    return el;
  }

  function closeCropper() {
    const el = document.getElementById('crop-overlay');
    if (!el) return;
    el.classList.add('hidden');
    el.innerHTML = '';   // משחרר את התמונה ואת המאזינים
  }

  function openCropper(src, onDone) {
    const overlay = cropOverlay();
    const stage = Math.max(
      200,
      Math.min(300, Math.min(window.innerWidth, window.innerHeight) - 150)
    );
    overlay.innerHTML = `
      <div class="crop-box">
        <div class="modal-head">
          <h3>מיקום התמונה בעיגול</h3>
          <button class="btn-close" data-crop-cancel>✕</button>
        </div>
        <div class="crop-body">
          <div class="crop-stage" style="width:${stage}px;height:${stage}px">
            <canvas class="crop-canvas"></canvas>
            <div class="crop-ring"></div>
          </div>
          <p class="hint">גררו את התמונה עם האצבע וכוונו את הזום — מה שנמצא בתוך העיגול הוא מה שיישמר.</p>
          <div class="crop-zoom">
            <button type="button" class="btn-mini" data-zoom="out" aria-label="הקטנה">－</button>
            <input type="range" class="crop-range" min="1" max="4" step="0.01" value="1" aria-label="זום">
            <button type="button" class="btn-mini" data-zoom="in" aria-label="הגדלה">＋</button>
          </div>
          <div class="form-actions">
            <button type="button" class="btn btn-primary" data-crop-save>שמירת התמונה</button>
            <button type="button" class="btn btn-cancel" data-crop-cancel>ביטול</button>
          </div>
        </div>
      </div>`;
    overlay.classList.remove('hidden');

    const canvas = overlay.querySelector('.crop-canvas');
    const range = overlay.querySelector('.crop-range');
    const ctx = canvas.getContext('2d');
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = canvas.height = Math.round(stage * dpr);

    // ox/oy הם שברים מצלע הריבוע, ולכן אותו מצב מתאר גם את התצוגה
    // על המסך וגם את הפלט ב-512 בלי חישוב נוסף
    const state = { scale: 1, ox: 0, oy: 0 };
    const img = new Image();
    img.crossOrigin = 'anonymous';   // תמונה שכבר ב-bucket — בלי זה הקנבס "מזוהם"

    function clamp() {
      const m = Math.min(img.width, img.height);
      const lx = ((img.width / m) * state.scale - 1) / 2;
      const ly = ((img.height / m) * state.scale - 1) / 2;
      state.ox = Math.max(-lx, Math.min(lx, state.ox));
      state.oy = Math.max(-ly, Math.min(ly, state.oy));
    }

    function paintTo(g, S) {
      clamp();
      const eff = (S / Math.min(img.width, img.height)) * state.scale;
      const dw = img.width * eff;
      const dh = img.height * eff;
      g.fillStyle = '#fff';
      g.fillRect(0, 0, S, S);
      g.drawImage(img, (S - dw) / 2 + state.ox * S, (S - dh) / 2 + state.oy * S, dw, dh);
    }

    const paint = () => paintTo(ctx, canvas.width);

    function output() {
      // בלי הגדלה מלאכותית: הריבוע הנראה מכסה min(w,h)/scale פיקסלים במקור
      const OUT = Math.max(128, Math.min(512, Math.round(Math.min(img.width, img.height) / state.scale)));
      const c = document.createElement('canvas');
      c.width = c.height = OUT;
      paintTo(c.getContext('2d'), OUT);
      return c.toDataURL('image/jpeg', 0.85);
    }

    function setScale(v) {
      state.scale = Math.max(1, Math.min(4, v));
      range.value = String(state.scale);
      paint();
    }

    /* גרירה באצבע אחת, צביטה בשתיים */
    const pts = new Map();
    let pinch = 0;
    const spread = () => {
      const [a, b] = Array.from(pts.values());
      return a && b ? Math.hypot(a.x - b.x, a.y - b.y) : 0;
    };
    canvas.addEventListener('pointerdown', (e) => {
      canvas.setPointerCapture(e.pointerId);
      pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pts.size === 2) pinch = spread();
    });
    canvas.addEventListener('pointermove', (e) => {
      const prev = pts.get(e.pointerId);
      if (!prev) return;
      const now = { x: e.clientX, y: e.clientY };
      pts.set(e.pointerId, now);
      if (pts.size >= 2) {
        const d = spread();
        if (pinch > 0 && d > 0) setScale(state.scale * (d / pinch));
        pinch = d;
        return;
      }
      state.ox += (now.x - prev.x) / stage;
      state.oy += (now.y - prev.y) / stage;
      paint();
    });
    const drop = (e) => {
      pts.delete(e.pointerId);
      pinch = pts.size === 2 ? spread() : 0;
    };
    canvas.addEventListener('pointerup', drop);
    canvas.addEventListener('pointercancel', drop);
    canvas.addEventListener('wheel', (e) => {
      e.preventDefault();
      setScale(state.scale * (e.deltaY < 0 ? 1.1 : 1 / 1.1));
    }, { passive: false });

    range.addEventListener('input', () => setScale(parseFloat(range.value)));
    overlay.querySelectorAll('[data-zoom]').forEach((b) =>
      b.addEventListener('click', () =>
        setScale(state.scale * (b.getAttribute('data-zoom') === 'in' ? 1.2 : 1 / 1.2))
      )
    );
    overlay.querySelectorAll('[data-crop-cancel]').forEach((b) =>
      b.addEventListener('click', closeCropper)
    );
    overlay.querySelector('[data-crop-save]').addEventListener('click', () => {
      let out;
      try {
        out = output();
      } catch {
        closeCropper();
        return toast('לא הצלחנו לחתוך את התמונה — בחרו אותה מחדש מהמכשיר');
      }
      closeCropper();
      onDone(out);
    });

    img.onload = paint;
    img.onerror = () => {
      closeCropper();
      toast('טעינת התמונה נכשלה — בחרו אותה מחדש מהמכשיר');
    };
    img.src = src;
  }

  /* שדה תמונה: העיגול עצמו הוא הכפתור שפותח את בורר הקבצים.
     ה-input נשאר בעמוד אבל מוסתר — "לא נבחר קובץ" של הדפדפן היה
     יעד מגע זעיר בנייד, ובעברית הוא גם נשבר לרוחב. */
  function photoFieldHTML(fid, existing) {
    return `
      <div class="field photo-field" id="${fid}">
        <label>תמונה</label>
        <div class="photo-row">
          <button type="button" class="photo-preview${existing ? ' has-photo' : ''}" aria-label="בחירת תמונה">${
            existing ? `<img src="${esc(existing)}" alt="">` : '📷'
          }</button>
          <div class="photo-buttons">
            <button type="button" class="btn-mini photo-pick">${existing ? 'החלפת תמונה' : 'בחירת תמונה'}</button>
            <button type="button" class="btn-mini photo-adjust" ${existing ? '' : 'hidden'}>מיקום בעיגול</button>
            <button type="button" class="btn-mini photo-clear" ${existing ? '' : 'hidden'}>הסרה</button>
          </div>
          <input type="file" accept="image/*" class="photo-input" tabindex="-1" aria-hidden="true">
        </div>
        <p class="hint photo-hint">הקישו על העיגול כדי לבחור תמונה מהמכשיר, ואז מקמו אותה בתוך העיגול.</p>
      </div>`;
  }

  function wirePhotoField(root, fid, existing) {
    const box = root.querySelector('#' + fid);
    const input = box.querySelector('.photo-input');
    const preview = box.querySelector('.photo-preview');
    const pickBtn = box.querySelector('.photo-pick');
    const adjustBtn = box.querySelector('.photo-adjust');
    const clearBtn = box.querySelector('.photo-clear');
    let value = existing || null;
    let source = null;   // התמונה כפי שנבחרה, כדי שאפשר יהיה למקם מחדש בלי בחירה חוזרת

    function render() {
      preview.innerHTML = value ? `<img src="${esc(value)}" alt="">` : '📷';
      preview.classList.toggle('has-photo', !!value);
      pickBtn.textContent = value ? 'החלפת תמונה' : 'בחירת תמונה';
      adjustBtn.hidden = !value;
      clearBtn.hidden = !value;
    }

    const browse = () => input.click();
    preview.addEventListener('click', browse);
    pickBtn.addEventListener('click', browse);

    input.addEventListener('change', () => {
      const file = input.files && input.files[0];
      input.value = '';   // כדי שבחירה חוזרת של אותו קובץ תפעיל change שוב
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        source = reader.result;
        openCropper(source, (out) => { value = out; render(); });
      };
      reader.onerror = () => toast('קריאת התמונה נכשלה');
      reader.readAsDataURL(file);
    });

    adjustBtn.addEventListener('click', () => {
      if (value) openCropper(source || value, (out) => { value = out; render(); });
    });

    clearBtn.addEventListener('click', () => {
      value = null;
      source = null;
      render();
    });

    return { get: () => value };
  }

  /* קבוצת שדות פרטים אישיים (לשימוש חוזר בטפסים) */
  function personFieldsHTML(prefix, p, opts) {
    p = p || {};
    opts = opts || {};
    return `
      <div class="field"><label>שם *</label>
        <input type="text" id="${prefix}-name" required maxlength="60" value="${esc(p.name || '')}" placeholder="שם מלא"></div>
      <div class="field"><label>שם משפחה <span class="hint">(יוצג מתחת ללב של בני הזוג)</span></label>
        <input type="text" id="${prefix}-last" maxlength="40" value="${esc(p.lastName || '')}" placeholder="למשל כהן"></div>
      ${opts.fixedGender ? '' : `
      <div class="field"><label>מגדר</label>
        <select id="${prefix}-gender">
          <option value="" ${!p.gender ? 'selected' : ''}>לא צוין</option>
          <option value="m" ${p.gender === 'm' ? 'selected' : ''}>זכר</option>
          <option value="f" ${p.gender === 'f' ? 'selected' : ''}>נקבה</option>
        </select></div>`}
      <div class="field"><label>שנת לידה</label>
        <input type="number" id="${prefix}-year" min="1800" max="2200" value="${p.birthYear || ''}" placeholder="למשל 1950"></div>
      <div class="field"><label>טלפון <span class="hint">(יוצג בתצוגה המלאה)</span></label>
        <input type="tel" id="${prefix}-phone" maxlength="20" value="${esc(p.phone || '')}" placeholder="050-0000000"></div>
      ${photoFieldHTML(prefix + '-photo', p.photo || null)}`;
  }

  function readPersonFields(root, prefix, photoGetter) {
    const g = root.querySelector(`#${prefix}-gender`);
    return {
      name: root.querySelector(`#${prefix}-name`).value.trim(),
      lastName: root.querySelector(`#${prefix}-last`).value,
      gender: g ? g.value || null : undefined,
      birthYear: root.querySelector(`#${prefix}-year`).value,
      phone: root.querySelector(`#${prefix}-phone`).value,
      photo: photoGetter.get(),
    };
  }

  /* ---------- מודאל כללי ---------- */
  function openModal(title, bodyHTML) {
    const modal = $('#modal');
    const box = $('#modal-box');
    box.innerHTML = `
      <div class="modal-head"><h3>${esc(title)}</h3><button class="btn-close" data-close>✕</button></div>
      <div class="modal-body">${bodyHTML}</div>`;
    modal.classList.remove('hidden');
    box.querySelectorAll('[data-close]').forEach((b) => b.addEventListener('click', closeModal));
    return box;
  }
  function closeModal() { $('#modal').classList.add('hidden'); }

  /* ---------- כרטיס עלה (Bottom Sheet) ---------- */
  function openCard(id) {
    const p = NS.store.get(id);
    if (!p) return;
    currentCardId = id;
    NS.render.draw(id);
    NS.render.centerOn(id);

    const parents = NS.store.parentsOf(id);
    const partners = NS.store.partnersOf(id);
    const children = NS.store.childrenOf(id);
    const edit = NS.store.prefs.editMode;
    const isMe = NS.store.prefs.myId === id;

    const rel = (label, people) =>
      people.length
        ? `<div class="rel-row"><span class="rel-label">${label}:</span>${people.map(chip).join('')}</div>`
        : '';

    const sheet = $('#sheet');
    sheet.innerHTML = `
      <div class="sheet-grab"></div>
      <div class="sheet-head">
        ${avatarHTML(p, 56)}
        <div class="sheet-title">
          <h3>${esc(p.name)} ${p.isRoot ? '⭐' : ''} ${isMe ? '<span class="me-tag">אני</span>' : ''}</h3>
          <p>${p.birthYear ? 'שנת לידה: ' + p.birthYear : 'שנת לידה לא ידועה'}</p>
        </div>
        <button class="btn-close" id="sheet-close">✕</button>
      </div>
      <div class="sheet-rels">
        ${rel('הורים', parents)}${rel('בן/בת זוג', partners)}${rel('ילדים', children)}
      </div>
      <div class="sheet-actions">
        <button class="btn" id="act-full">🔍 תצוגה מוגדלת</button>
        <button class="btn" id="act-edit">✏️ עריכת העלה</button>
      </div>
      ${edit ? `
      <div class="sheet-actions edit-actions">
        ${parents.length < 2 ? `<button class="btn btn-add" id="act-parents">➕ אבא ואמא</button>` : ''}
        <button class="btn btn-add" id="act-child">➕ בן/בת</button>
        <button class="btn btn-add" id="act-partner">➕ בן/בת זוג</button>
        ${NS.store.canDelete(id) ? `<button class="btn btn-danger" id="act-delete">🗑️ מחיקה</button>` : ''}
      </div>` : `
      <div class="sheet-actions">
        <button class="btn btn-ghost" id="act-enable-edit">🔓 הפעלת מצב עריכה להוספת קרובים</button>
      </div>`}
      ${!isMe ? `<button class="btn-link" id="act-me">🙋 זה אני — סמנו את העיגול שלי</button>` : ''}
    `;
    sheet.classList.remove('hidden');

    wireChips(sheet);
    $('#sheet-close').addEventListener('click', closeCard);
    $('#act-full').addEventListener('click', () => openFull(id));
    $('#act-edit').addEventListener('click', () => formEdit(id));
    const on = (sel, fn) => { const el = sheet.querySelector(sel); if (el) el.addEventListener('click', fn); };
    on('#act-parents', () => formAddParents(id));
    on('#act-child', () => formAddChild(id));
    on('#act-partner', () => formAddPartner(id));
    on('#act-delete', () => doDelete(id));
    on('#act-enable-edit', () => { setEditMode(true); openCard(id); });
    on('#act-me', () => {
      NS.store.prefs.myId = id;
      toast('סומן! זה העיגול שלך 🙋');
      refresh();
      openCard(id);
    });
  }

  function closeCard() {
    currentCardId = null;
    $('#sheet').classList.add('hidden');
    NS.render.draw();
  }

  /* ---------- תצוגה מוגדלת ---------- */
  function openFull(id) {
    const p = NS.store.get(id);
    if (!p) return;
    const parents = NS.store.parentsOf(id);
    const partners = NS.store.partnersOf(id);
    const children = NS.store.childrenOf(id);
    const rel = (label, people) =>
      people.length
        ? `<div class="full-rel"><h4>${label}</h4><div class="chips">${people.map(chip).join('')}</div></div>`
        : '';
    const overlay = $('#overlay-full');
    overlay.innerHTML = `
      <div class="full-box">
        <button class="btn-close" id="full-close">✕</button>
        ${avatarHTML(p, 190)}
        <h2>${esc(p.name)} ${p.isRoot ? '⭐' : ''}</h2>
        <p class="full-year">${p.birthYear ? 'שנת לידה: ' + p.birthYear : 'שנת לידה לא ידועה'}</p>
        ${p.phone ? `<p class="full-phone">📞 <a href="tel:${esc(p.phone.replace(/[^\d+*#]/g, ''))}">${esc(p.phone)}</a></p>` : ''}
        ${rel('הורים', parents)}${rel('בן/בת זוג', partners)}${rel(`ילדים (${children.length})`, children)}
        <div class="sheet-actions">
          <button class="btn" id="full-edit">✏️ עריכת העלה</button>
          <button class="btn btn-cancel" id="full-back">חזרה לעץ</button>
        </div>
      </div>`;
    overlay.classList.remove('hidden');
    wireChips(overlay);
    $('#full-close').addEventListener('click', closeFull);
    $('#full-back').addEventListener('click', closeFull);
    $('#full-edit').addEventListener('click', () => { closeFull(); formEdit(id); });
    overlay.addEventListener('click', (e) => { if (e.target === overlay) closeFull(); }, { once: true });
  }
  function closeFull() { $('#overlay-full').classList.add('hidden'); }

  /* ---------- טפסים ---------- */
  function formEdit(id) {
    const p = NS.store.get(id);
    if (!p) return;
    const box = openModal('עריכת ' + p.name, `
      <form novalidate id="f-edit">
        ${personFieldsHTML('pe', p)}
        <div class="form-actions">
          <button type="submit" class="btn btn-primary">שמירה</button>
          <button type="button" class="btn btn-cancel" data-close>ביטול</button>
        </div>
      </form>`);
    const photo = wirePhotoField(box, 'pe-photo', p.photo);
    box.querySelector('#f-edit').addEventListener('submit', (e) => {
      e.preventDefault();
      const data = readPersonFields(box, 'pe', photo);
      if (!data.name) return toast('חובה להזין שם');
      NS.store.updatePerson(id, data);
      closeModal();
      toast('נשמר ✔');
      openCard(id);
    });
  }

  function formAddParents(id) {
    const p = NS.store.get(id);
    if (!p) return;
    const father = NS.store.get(p.fatherId);
    const mother = NS.store.get(p.motherId);
    const section = (role, existing, prefix) =>
      existing
        ? `<div class="parent-col"><h4>${role}</h4><div class="exists">${chip(existing)}<span class="hint">כבר קיים בעץ</span></div></div>`
        : `<div class="parent-col"><h4>${role}</h4>
             <div class="field"><label>שם</label><input type="text" id="${prefix}-name" maxlength="60" placeholder="השאירו ריק כדי לדלג"></div>
             <div class="field"><label>שנת לידה</label><input type="number" id="${prefix}-year" min="1800" max="2200"></div>
           </div>`;
    const box = openModal('הוספת הורים ל' + p.name, `
      <form novalidate id="f-parents">
        <div class="parents-grid">
          ${section('אבא', father, 'fa')}
          ${section('אמא', mother, 'mo')}
        </div>
        <p class="hint">אפשר להוסיף רק אחד מההורים — פרטים נוספים ותמונה אפשר להשלים אחר-כך בעריכת העלה.</p>
        <div class="form-actions">
          <button type="submit" class="btn btn-primary">הוספה</button>
          <button type="button" class="btn btn-cancel" data-close>ביטול</button>
        </div>
      </form>`);
    wireChips(box);
    box.querySelector('#f-parents').addEventListener('submit', (e) => {
      e.preventDefault();
      const val = (sel) => { const el = box.querySelector(sel); return el ? el.value.trim() : ''; };
      const fName = val('#fa-name'), mName = val('#mo-name');
      if (!father && !mother && !fName && !mName) return toast('הזינו שם של לפחות הורה אחד');
      if (father && !mName) return toast('הזינו את שם האמא');
      if (mother && !fName) return toast('הזינו את שם האבא');
      NS.store.addParents(
        id,
        fName ? { name: fName, birthYear: val('#fa-year') } : null,
        mName ? { name: mName, birthYear: val('#mo-year') } : null
      );
      closeModal();
      toast('ההורים נוספו לעץ 🌳');
      openCard(id);
    });
  }

  function formAddChild(id) {
    const p = NS.store.get(id);
    if (!p) return;
    const partners = NS.store.partnersOf(id);
    const options =
      partners.map((q, i) => `<option value="${esc(q.id)}" ${i === 0 ? 'selected' : ''}>${esc(q.name)}</option>`).join('') +
      `<option value="__new__">➕ הורה שני חדש...</option>` +
      `<option value="" ${partners.length ? '' : 'selected'}>ללא הורה שני</option>`;
    const box = openModal('הוספת בן/בת ל' + p.name, `
      <form novalidate id="f-child">
        ${personFieldsHTML('ch', null)}
        <div class="field"><label>ההורה השני</label>
          <select id="ch-other">${options}</select></div>
        <div id="new-other" class="sub-box" hidden>
          <div class="field"><label>שם ההורה השני</label><input type="text" id="no-name" maxlength="60"></div>
          <div class="field"><label>שנת לידה</label><input type="number" id="no-year" min="1800" max="2200"></div>
        </div>
        <div class="form-actions">
          <button type="submit" class="btn btn-primary">הוספה</button>
          <button type="button" class="btn btn-cancel" data-close>ביטול</button>
        </div>
      </form>`);
    const photo = wirePhotoField(box, 'ch-photo', null);
    const otherSel = box.querySelector('#ch-other');
    const newBox = box.querySelector('#new-other');
    otherSel.addEventListener('change', () => { newBox.hidden = otherSel.value !== '__new__'; });
    box.querySelector('#f-child').addEventListener('submit', (e) => {
      e.preventDefault();
      const data = readPersonFields(box, 'ch', photo);
      if (!data.name) return toast('חובה להזין שם');
      let other = null;
      if (otherSel.value === '__new__') {
        const n = box.querySelector('#no-name').value.trim();
        if (!n) return toast('הזינו את שם ההורה השני');
        other = { create: { name: n, birthYear: box.querySelector('#no-year').value } };
      } else if (otherSel.value) {
        other = { id: otherSel.value };
      }
      const child = NS.store.addChild(id, data, other);
      closeModal();
      toast(data.name + ' נוסף/ה לעץ 🌱');
      openCard(child.id);
    });
  }

  function formAddPartner(id) {
    const p = NS.store.get(id);
    if (!p) return;
    const box = openModal('הוספת בן/בת זוג ל' + p.name, `
      <form novalidate id="f-partner">
        ${personFieldsHTML('pa', null)}
        <div class="form-actions">
          <button type="submit" class="btn btn-primary">הוספה</button>
          <button type="button" class="btn btn-cancel" data-close>ביטול</button>
        </div>
      </form>`);
    const photo = wirePhotoField(box, 'pa-photo', null);
    box.querySelector('#f-partner').addEventListener('submit', (e) => {
      e.preventDefault();
      const data = readPersonFields(box, 'pa', photo);
      if (!data.name) return toast('חובה להזין שם');
      const partner = NS.store.addPartner(id, data);
      closeModal();
      toast('נוסף/ה לעץ ♥');
      openCard(partner.id);
    });
  }

  function doDelete(id) {
    const p = NS.store.get(id);
    if (!p) return;
    if (!NS.store.canDelete(id)) return toast('אי אפשר למחוק עלה שיש לו ילדים בעץ');
    if (!confirm('למחוק את ' + p.name + ' מהעץ? פעולה זו אינה הפיכה.')) return;
    NS.store.deletePerson(id);
    closeCard();
    toast('נמחק מהעץ');
  }

  /* ---------- "אני בעץ" — הוספה/איתור עצמי אחרי הרשמה ---------- */
  function openSelfFlow() {
    const myId = NS.store.prefs.myId;
    if (myId && NS.store.get(myId)) return openCard(myId);
    const people = NS.store.all();
    const opts = (filter) =>
      people
        .filter(filter)
        .map((q) => `<option value="${esc(q.id)}">${esc(q.name)}${q.birthYear ? ' (' + q.birthYear + ')' : ''}</option>`)
        .join('');
    const box = openModal('אני בעץ המשפחתי 🙋', `
      <div class="self-tabs">
        <label class="radio"><input type="radio" name="self-mode" value="exists" checked> אני כבר מופיע/ה בעץ</label>
        <label class="radio"><input type="radio" name="self-mode" value="new"> עדיין לא בעץ — הוסיפו אותי</label>
      </div>
      <form novalidate id="f-self">
        <div id="self-exists">
          <div class="field"><label>מי אני?</label>
            <select id="self-pick"><option value="">בחרו את עצמכם...</option>${opts(() => true)}</select></div>
        </div>
        <div id="self-new" hidden>
          ${personFieldsHTML('se', null)}
          <div class="field"><label>אבא (אם כבר בעץ)</label>
            <select id="se-father"><option value="">ללא / לא בעץ</option>${opts((q) => q.gender !== 'f')}</select></div>
          <div class="field"><label>אמא (אם כבר בעץ)</label>
            <select id="se-mother"><option value="">ללא / לא בעץ</option>${opts((q) => q.gender !== 'm')}</select></div>
        </div>
        <div class="form-actions">
          <button type="submit" class="btn btn-primary">שמירה</button>
          <button type="button" class="btn btn-cancel" data-close>ביטול</button>
        </div>
      </form>`);
    const photo = wirePhotoField(box, 'se-photo', null);
    const radios = box.querySelectorAll('input[name=self-mode]');
    const upd = () => {
      const mode = box.querySelector('input[name=self-mode]:checked').value;
      box.querySelector('#self-exists').hidden = mode !== 'exists';
      box.querySelector('#self-new').hidden = mode !== 'new';
    };
    radios.forEach((r) => r.addEventListener('change', upd));
    box.querySelector('#f-self').addEventListener('submit', (e) => {
      e.preventDefault();
      const mode = box.querySelector('input[name=self-mode]:checked').value;
      if (mode === 'exists') {
        const pick = box.querySelector('#self-pick').value;
        if (!pick) return toast('בחרו את עצמכם מהרשימה');
        NS.store.prefs.myId = pick;
        closeModal();
        toast('נמצאת! אפשר לערוך את העיגול שלך ✔');
        refresh();
        openCard(pick);
      } else {
        const data = readPersonFields(box, 'se', photo);
        if (!data.name) return toast('חובה להזין שם');
        const person = NS.store.createPerson(data);
        const faId = box.querySelector('#se-father').value;
        const moId = box.querySelector('#se-mother').value;
        if (faId || moId)
          NS.store.updatePerson(person.id, { fatherId: faId || null, motherId: moId || null });
        NS.store.prefs.myId = person.id;
        closeModal();
        toast('ברוך הבא לעץ המשפחתי! 🌳');
        refresh();
        openCard(person.id);
      }
    });
  }

  /* ---------- סרגל כלים ---------- */
  function setEditMode(v) {
    NS.store.prefs.editMode = v;
    refreshToolbar();
    if (v) toast('מצב עריכה פעיל — הקישו על עלה כדי להוסיף לו קרובים');
  }

  function refreshToolbar() {
    const btn = $('#btn-edit');
    const on = NS.store.prefs.editMode;
    btn.classList.toggle('active', on);
    btn.setAttribute('aria-pressed', on ? 'true' : 'false');
    btn.textContent = on ? '✏️ מצב עריכה פעיל' : '✏️ עריכת העץ';
    const meBtn = $('#btn-me');
    meBtn.textContent = NS.store.prefs.myId ? '🙋 העיגול שלי' : '🙋 אני בעץ';
  }

  /* ---------- חיפוש עם השלמה אוטומטית ----------
     קודם כאן ישב `<datalist>` עם כל בני המשפחה. ככל שהעץ גדל זו הפכה
     לרשימה שאי אפשר לסרוק בעין (ובנייד היא נפתחת על חצי מסך), ולכן
     החיפוש מציג עכשיו רק את ההתאמות למה שהוקלד — עד MAX_RESULTS,
     בתיבה שגובהה חמש שורות וכל השאר בגלילה. */
  const MAX_RESULTS = 30;
  let suggestions = [];   // ההתאמות המוצגות כרגע
  let suggIndex = -1;     // הפריט המסומן במקלדת (-1 = אין)

  const norm = (s) => String(s == null ? '' : s).trim().toLowerCase();

  // דירוג: מי שהשם שלו מתחיל בשאילתה קודם, אחריו מי שמילה בשם מתחילה
  // בה, ורק אז התאמה באמצע מילה. ככה "דוד" מביא קודם את דוד ולא את "אבידוד".
  function matchRank(name, q) {
    const n = norm(name);
    const i = n.indexOf(q);
    if (i < 0) return -1;
    if (i === 0) return 0;
    return /\s/.test(n[i - 1]) ? 1 : 2;
  }

  function findMatches(query) {
    const q = norm(query);
    if (!q) return [];
    const scored = [];
    NS.store.all().forEach((p) => {
      const rank = Math.min(
        ...[p.name, p.lastName].map((f) => {
          const r = matchRank(f, q);
          return r < 0 ? 9 : r;
        })
      );
      if (rank < 9) scored.push({ p, rank });
    });
    scored.sort((a, b) => a.rank - b.rank || a.p.name.localeCompare(b.p.name, 'he'));
    return scored.slice(0, MAX_RESULTS).map((x) => x.p);
  }

  function highlight(name, query) {
    const q = norm(query);
    const i = norm(name).indexOf(q);
    if (!q || i < 0) return esc(name);
    return (
      esc(name.slice(0, i)) +
      '<mark>' + esc(name.slice(i, i + q.length)) + '</mark>' +
      esc(name.slice(i + q.length))
    );
  }

  // התיבה היא position:fixed — ל-.toolbar יש overflow-x לגלילה, ותיבה
  // absolute בתוכו הייתה נחתכת. לכן המיקום מחושב מול השדה עצמו.
  function placeSuggestions() {
    const box = $('#search-results');
    const r = $('#search').getBoundingClientRect();
    // בנייד השדה יכול להיות צר מכדי להציג שם ושנת לידה, ולכן הרשימה
    // רחבה ממנו במידת הצורך — ואז נדחפת פנימה כדי לא לחרוג מהמסך
    const width = Math.min(Math.max(r.width, 220), window.innerWidth - 16);
    const left = Math.max(8, Math.min(r.left, window.innerWidth - width - 8));
    box.style.top = r.bottom + 6 + 'px';
    box.style.left = left + 'px';
    box.style.width = width + 'px';
  }

  function closeSuggestions() {
    suggestions = [];
    suggIndex = -1;
    const box = $('#search-results');
    box.classList.add('hidden');
    box.innerHTML = '';
    $('#search').setAttribute('aria-expanded', 'false');
  }

  function renderSuggestions(query) {
    if (!norm(query)) return closeSuggestions();
    const box = $('#search-results');
    suggestions = findMatches(query);
    suggIndex = -1;
    box.innerHTML = suggestions.length
      ? suggestions
          .map((p, i) => {
            const meta = [p.lastName, p.birthYear].filter(Boolean).join(' · ');
            return `<button type="button" class="search-item" role="option" aria-selected="false" data-idx="${i}">
              ${avatarHTML(p, 26)}
              <span class="search-item-text">
                <span class="search-item-name">${highlight(p.name, query)}</span>
                ${meta ? `<span class="search-item-meta">${esc(meta)}</span>` : ''}
              </span>
            </button>`;
          })
          .join('')
      : '<p class="search-empty">לא נמצא בעץ</p>';
    box.scrollTop = 0;
    box.classList.remove('hidden');
    placeSuggestions();
    $('#search').setAttribute('aria-expanded', 'true');
  }

  function setActiveSuggestion(i) {
    const items = $('#search-results').querySelectorAll('.search-item');
    if (!items.length) return;
    suggIndex = (i + items.length) % items.length;
    items.forEach((el, n) => {
      const on = n === suggIndex;
      el.classList.toggle('active', on);
      el.setAttribute('aria-selected', on ? 'true' : 'false');
      if (on) el.scrollIntoView({ block: 'nearest' });
    });
  }

  function pickSuggestion(person) {
    const search = $('#search');
    search.value = '';
    closeSuggestions();
    search.blur();
    openCard(person.id);
  }

  function refreshSearch() {
    const box = $('#search-results');
    // רק אם הרשימה פתוחה — עריכה בעץ יכולה לשנות שם בזמן שהיא מוצגת
    if (box && !box.classList.contains('hidden')) renderSuggestions($('#search').value);
  }

  function doSearch(q) {
    if (!norm(q)) return;
    const found = findMatches(q)[0];
    if (found) pickSuggestion(found);
    else toast('לא נמצא בעץ: ' + q.trim());
  }

  function initToolbar() {
    $('#btn-edit').addEventListener('click', () => setEditMode(!NS.store.prefs.editMode));
    $('#btn-me').addEventListener('click', openSelfFlow);
    $('#zoom-in').addEventListener('click', NS.render.zoomIn);
    $('#zoom-out').addEventListener('click', NS.render.zoomOut);
    $('#zoom-fit').addEventListener('click', NS.render.fit);

    const search = $('#search');
    const results = $('#search-results');
    search.addEventListener('input', () => renderSuggestions(search.value));
    search.addEventListener('focus', () => renderSuggestions(search.value));
    search.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        if (!suggestions.length) return;
        e.preventDefault();
        setActiveSuggestion(suggIndex + (e.key === 'ArrowDown' ? 1 : -1));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (suggestions[suggIndex]) pickSuggestion(suggestions[suggIndex]);
        else doSearch(search.value);
      } else if (e.key === 'Escape') {
        closeSuggestions();
      }
    });
    // mousedown לפני ה-blur של השדה — אחרת הרשימה נסגרת לפני ה-click
    results.addEventListener('mousedown', (e) => e.preventDefault());
    results.addEventListener('click', (e) => {
      const el = e.target.closest('.search-item');
      if (!el) return;
      const person = suggestions[Number(el.getAttribute('data-idx'))];
      if (person) pickSuggestion(person);
    });
    document.addEventListener('click', (e) => {
      if (e.target !== search && !results.contains(e.target)) closeSuggestions();
    });
    // הסרגל נגלל אופקית והמסך מסתובב — התיבה fixed וצריכה להתיישר מחדש
    $('.toolbar').addEventListener('scroll', () => {
      if (!results.classList.contains('hidden')) placeSuggestions();
    });
    window.addEventListener('resize', () => {
      if (!results.classList.contains('hidden')) placeSuggestions();
    });

    // תפריט ייצוא
    const menu = $('#export-menu');
    $('#btn-export').addEventListener('click', (e) => {
      e.stopPropagation();
      menu.classList.toggle('hidden');
    });
    document.addEventListener('click', (e) => {
      if (!menu.contains(e.target)) menu.classList.add('hidden');
    });
    menu.addEventListener('click', (e) => {
      const act = e.target.getAttribute && e.target.getAttribute('data-act');
      if (!act) return;
      menu.classList.add('hidden');
      if (act === 'png') { toast('מכין תמונה...'); NS.exporter.exportPNG(); }
      if (act === 'pdf') { toast('מכין PDF...'); NS.exporter.exportPDF(); }
      if (act === 'json') NS.exporter.exportData();
      if (act === 'import') $('#import-file').click();
      if (act === 'reset') {
        if (confirm('לאפס את העץ לגרסה ההתחלתית? כל השינויים שנעשו יימחקו.')) {
          NS.store.resetToSeed();
          toast('העץ אופס לגרסה ההתחלתית');
          NS.render.fit();
        }
      }
    });

    $('#import-file').addEventListener('change', (e) => {
      const file = e.target.files && e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        try {
          NS.store.importJSON(reader.result);
          toast('הנתונים יובאו בהצלחה ✔');
          NS.render.fit();
        } catch (err) {
          alert('ייבוא נכשל: ' + err.message);
        }
        e.target.value = '';
      };
      reader.readAsText(file);
    });
  }

  function refresh() {
    NS.render.draw(currentCardId);
    refreshToolbar();
    refreshSearch();
  }

  NS.ui = {
    init() {
      initToolbar();
      refreshToolbar();
      refreshSearch();
    },
    openCard, closeCard, refresh, toast,
  };
})();
