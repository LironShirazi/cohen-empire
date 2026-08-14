/* ============================================================
   העץ המשפחתי — ייצוא: תמונה (PNG), קובץ PDF, גיבוי JSON
   ללא ספריות חיצוניות: SVG → Canvas → PNG/JPEG,
   וה-PDF נבנה ידנית עם תמונת JPEG משובצת (DCTDecode).
   ============================================================ */
(function () {
  'use strict';
  const NS = (window.FT = window.FT || {});

  function download(blob, filename) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      URL.revokeObjectURL(a.href);
      a.remove();
    }, 2000);
  }

  function todayStr() {
    const d = new Date();
    return `${d.getDate()}.${d.getMonth() + 1}.${d.getFullYear()}`;
  }

  /* בונה SVG עצמאי מלא של העץ, עם רקע וכותרת */
  function buildExportSVG() {
    const map = {};
    for (const p of NS.store.all()) map[p.id] = p;
    const model = NS.layout.build(map);
    const content = NS.render.buildContent(model, { interactive: false, myId: null });
    const b = model.bbox;
    const PAD = 60, HEADER = 90;
    const w = Math.ceil(b.width + PAD * 2);
    const h = Math.ceil(b.height + PAD * 2 + HEADER);
    const ox = PAD - b.minX;
    const oy = PAD + HEADER - b.minY;
    const midX = w / 2;
    const svg =
      `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" ` +
      `width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" direction="rtl">` +
      `<style>${exportCSS()}</style>` +
      content.defs +
      `<rect x="0" y="0" width="${w}" height="${h}" fill="#f7f1e6"/>` +
      `<text x="${midX}" y="46" text-anchor="middle" style="font:700 28px 'Segoe UI',Arial,sans-serif;fill:#23422f">🌳 העץ המשפחתי — אימפריית כהן</text>` +
      `<text x="${midX}" y="72" text-anchor="middle" style="font:14px 'Segoe UI',Arial,sans-serif;fill:#8a7f66">נכון לתאריך ${todayStr()}</text>` +
      `<g transform="translate(${ox} ${oy})">${content.body}</g>` +
      `</svg>`;
    return { svg, w, h };
  }

  /* עותק ה-CSS הדרוש לרינדור העץ בקובץ המיוצא (עצמאי מה-CSS של הדף) */
  function exportCSS() {
    return `
      .link{fill:none;stroke:#b3a689;stroke-width:2}
      .couple{stroke:#c9962e;stroke-width:2.5}
      .couple.far{stroke-dasharray:5 5;stroke-width:1.5;opacity:.6;fill:none}
      .heart{font-size:13px;fill:#c0392b;paint-order:stroke;stroke:#f7f1e6;stroke-width:5}
      .person .ph-bg{fill:#eee9dc;stroke:none}
      .person.g-m .ph-bg{fill:#dbe9f6}
      .person.g-f .ph-bg{fill:#f9e0ea}
      .person .ring{fill:none;stroke:#8a8a7e;stroke-width:2.5}
      .person.g-m .ring{stroke:#4a7fb5}
      .person.g-f .ring{stroke:#c76b8e}
      .person.root .ring{stroke:#c9962e;stroke-width:5}
      .initial{font:700 26px 'Segoe UI',Arial,sans-serif;fill:#6b6152}
      .name{font:700 13px 'Segoe UI',Arial,sans-serif;fill:#2f2a1f;paint-order:stroke;stroke:#f7f1e6;stroke-width:4}
      .year{font:11px 'Segoe UI',Arial,sans-serif;fill:#7a715c;paint-order:stroke;stroke:#f7f1e6;stroke-width:4}
      .me-badge circle{fill:#2e7d47}
      .me-badge text{font-size:11px}
    `;
  }

  /* SVG → Canvas (עם הגבלת גודל בטוחה לדפדפני מובייל) */
  function svgToCanvas(cb) {
    const { svg, w, h } = buildExportSVG();
    let scale = 2;
    const MAX_PIXELS = 14e6;
    if (w * h * scale * scale > MAX_PIXELS) scale = Math.sqrt(MAX_PIXELS / (w * h));
    const blob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(w * scale);
      canvas.height = Math.round(h * scale);
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#f7f1e6';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);
      cb(null, canvas);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      cb(new Error('רינדור התמונה נכשל'));
    };
    img.src = url;
  }

  function exportPNG() {
    svgToCanvas((err, canvas) => {
      if (err) return alert(err.message);
      canvas.toBlob((blob) => {
        if (!blob) return alert('יצירת הקובץ נכשלה');
        download(blob, `family-tree-${todayStr()}.png`);
      }, 'image/png');
    });
  }

  /* PDF מינימלי עם עמוד אחד ותמונת JPEG משובצת */
  function jpegToPdfBlob(jpegDataUrl, pxW, pxH) {
    const b64 = jpegDataUrl.split(',')[1];
    const bin = atob(b64);
    const img = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) img[i] = bin.charCodeAt(i);

    // גודל עמוד בנקודות: מקסימום 1600 נק' בצלע הארוכה, שומר יחס
    const long = Math.max(pxW, pxH);
    const ptScale = Math.min(1, 1600 / long);
    const w = +(pxW * ptScale).toFixed(2);
    const h = +(pxH * ptScale).toFixed(2);

    const enc = new TextEncoder();
    const parts = [];
    let offset = 0;
    const offsets = [];
    const push = (x) => {
      const u = typeof x === 'string' ? enc.encode(x) : x;
      parts.push(u);
      offset += u.length;
    };
    const obj = (num, body) => {
      offsets[num] = offset;
      push(`${num} 0 obj\n${body}\nendobj\n`);
    };

    push('%PDF-1.4\n');
    obj(1, '<< /Type /Catalog /Pages 2 0 R >>');
    obj(2, '<< /Type /Pages /Kids [3 0 R] /Count 1 >>');
    obj(
      3,
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${w} ${h}] ` +
        `/Resources << /XObject << /Im0 4 0 R >> /ProcSet [/PDF /ImageC] >> /Contents 5 0 R >>`
    );
    offsets[4] = offset;
    push(
      `4 0 obj\n<< /Type /XObject /Subtype /Image /Width ${pxW} /Height ${pxH} ` +
        `/ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${img.length} >>\nstream\n`
    );
    push(img);
    push('\nendstream\nendobj\n');
    const contentStream = `q ${w} 0 0 ${h} 0 0 cm /Im0 Do Q`;
    obj(5, `<< /Length ${contentStream.length} >>\nstream\n${contentStream}\nendstream`);

    const xrefStart = offset;
    let xref = 'xref\n0 6\n0000000000 65535 f \n';
    for (let i = 1; i <= 5; i++) xref += String(offsets[i]).padStart(10, '0') + ' 00000 n \n';
    push(xref + `trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF`);

    return new Blob(parts, { type: 'application/pdf' });
  }

  function exportPDF() {
    svgToCanvas((err, canvas) => {
      if (err) return alert(err.message);
      const jpeg = canvas.toDataURL('image/jpeg', 0.9);
      const blob = jpegToPdfBlob(jpeg, canvas.width, canvas.height);
      download(blob, `family-tree-${todayStr()}.pdf`);
    });
  }

  function exportData() {
    const blob = new Blob([NS.store.exportJSON()], { type: 'application/json' });
    download(blob, `family-tree-data-${todayStr()}.json`);
  }

  NS.exporter = { exportPNG, exportPDF, exportData };
})();
