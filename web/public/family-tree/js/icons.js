/* ============================================================
   העץ המשפחתי — אייקונים
   עותק vanilla של `components/ui/icon.tsx` (רק מה שהעץ צריך).
   שינוי של path שם — לשנות גם כאן.
   קו 1.9, רשת 24, currentColor — האייקון יורש את צבע הכפתור.
   ============================================================ */
(function () {
  'use strict';
  const NS = (window.FT = window.FT || {});

  const PATHS = {
    home: '<path d="M4 11 12 4l8 7v9H4z"></path><path d="M9.5 20v-5.5h5V20"></path>',
    tree: '<rect x="9" y="3" width="6" height="4.6" rx="1.6"></rect><rect x="2.5" y="16" width="6" height="4.6" rx="1.6"></rect><rect x="15.5" y="16" width="6" height="4.6" rx="1.6"></rect><path d="M12 7.6v4.4M5.5 16v-4h13v4"></path>',
    edit: '<path d="M4 20h4L20 8a2.8 2.8 0 0 0-4-4L4 16v4z"></path><path d="M14.5 5.5 18.5 9.5"></path>',
    me: '<circle cx="11" cy="8" r="3.4"></circle><path d="M4.5 20c0-3.5 2.9-5.8 6.5-5.8s6.5 2.3 6.5 5.8"></path><circle cx="19" cy="6" r="2.4" fill="currentColor" stroke="none"></circle>',
    download: '<path d="M12 4v10"></path><path d="M8 10.5 12 14.5 16 10.5"></path><path d="M4 17v3h16v-3"></path>',
    search: '<circle cx="11" cy="11" r="6.5"></circle><path d="M15.8 15.8 21 21"></path>',
    camera: '<path d="M3.5 8.5h3.2L8.2 6h7.6l1.5 2.5h3.2V19h-17z"></path><circle cx="12" cy="13.5" r="3.4"></circle>',
    save: '<path d="M5 4h11l3 3v13H5z"></path><path d="M9 4v5h6V4"></path><path d="M8 20v-6h8v6"></path>',
    close: '<path d="M6 6l12 12M18 6 6 18"></path>',
    plus: '<path d="M12 5v14M5 12h14"></path>',
    minus: '<path d="M5 12h14"></path>',
    trash: '<path d="M4 7h16"></path><path d="M9 7V4h6v3"></path><path d="M6.5 7l1 13h9l1-13"></path><path d="M10.5 11v6M13.5 11v6"></path>',
    phone: '<path d="M7 3.5 9.5 8 7.5 10a12 12 0 0 0 6 6l2-2 4.5 2.5-1 3c-6.5 1-15-7.5-14-14z"></path>',
    crown: '<path d="M3.5 18.5h17L19.2 8l-4.4 3.6L12 5.2 9.2 11.6 4.8 8z"></path>',
    warning: '<path d="M12 4 21 20H3z"></path><path d="M12 10v4.5"></path><circle cx="12" cy="17.6" r=".9" fill="currentColor" stroke="none"></circle>',
    heart: '<path d="M12 20.3S3.8 15.2 3.8 9.9A4.4 4.4 0 0 1 12 7.1a4.4 4.4 0 0 1 8.2 2.8c0 5.3-8.2 10.4-8.2 10.4z" fill="currentColor" stroke="none"></path>',
    check: '<path d="M4.5 12.5 9.5 17.5 19.5 6.5"></path>',
    lock: '<rect x="4.5" y="10" width="15" height="10.5" rx="2.5"></rect><path d="M8 10V7.5a4 4 0 0 1 8 0V10"></path>',
  };
  const HEAVIER = { check: 2.3, close: 2.2 };

  /** מחרוזת SVG לשילוב ב-innerHTML. דקורטיבי — הטקסט שלידו הוא התווית */
  NS.icon = function (name, size) {
    const s = size || 18;
    return (
      '<svg class="ic" width="' + s + '" height="' + s + '" viewBox="0 0 24 24" fill="none" ' +
      'stroke="currentColor" stroke-width="' + (HEAVIER[name] || 1.9) + '" ' +
      'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
      PATHS[name] + '</svg>'
    );
  };
  NS.iconPath = (name) => PATHS[name];
})();
