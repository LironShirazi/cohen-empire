"use client";

import Link from "next/link";
import { useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import "./family-tree.css";

// הסדר קובע: store לפני main, ו-main אחרון כי הוא מגדיר את boot
const SCRIPTS = ["store", "layout", "render", "export", "ui", "main"];

function loadScript(src: string): Promise<void> {
  const existing = document.querySelector(`script[src="${src}"]`);
  if (existing) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const el = document.createElement("script");
    el.src = src;
    el.async = false;
    el.onload = () => resolve();
    el.onerror = () => reject(new Error(`טעינת ${src} נכשלה`));
    document.body.appendChild(el);
  });
}

/**
 * המעטפת של מנוע העץ. ה-DOM כאן הוא בדיוק מה ש-`ui.js` ו-`render.js`
 * מחפשים לפי id — הם מנהלים את מה שבתוך המעטפות האלה, ו-React לא
 * מרנדר אותן מחדש (אין state בקומפוננטה) כדי שלא ידרוס אותם.
 *
 * הלקוח של Supabase מוזרק ל-`window.FT` **לפני** טעינת הסקריפטים:
 * `store.js` הוא קובץ סטטי ולא מודול, ולכן הוא לא יכול לייבא אותו
 * בעצמו — ראו ההערה בראש store.js.
 */
export function TreeCanvas({
  userId,
  isOwner,
}: {
  userId: string;
  isOwner: boolean;
}) {
  useEffect(() => {
    let cancelled = false;

    (async () => {
      const ft = ((window as unknown as { FT?: Record<string, unknown> }).FT ??=
        {});
      ft.supabase = createClient();
      ft.currentUserId = userId;
      ft.isOwner = isOwner;

      try {
        for (const name of SCRIPTS) {
          await loadScript(`/family-tree/js/${name}.js`);
          if (cancelled) return;
        }
        await (ft as { boot: () => Promise<void> }).boot();
      } catch (err) {
        console.error("[family-tree]", err);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [userId, isOwner]);

  return (
    <div className="ft-root flex-1">
      <header className="topbar">
        <Link className="home-link" href="/" title="חזרה לדף הבית">
          🏠
        </Link>
        <div className="titles">
          <h1>🌳 העץ המשפחתי</h1>
          <p>אימפריית כהן — ב״ה משפחה גדולה</p>
        </div>
      </header>

      <div className="toolbar">
        <button id="btn-edit" className="tb-btn" aria-pressed="false">
          ✏️ עריכת העץ
        </button>
        <button id="btn-me" className="tb-btn">
          🙋 אני בעץ
        </button>
        <div className="menu-wrap">
          <button id="btn-export" className="tb-btn">
            ⬇️ ייצוא
          </button>
          <div id="export-menu" className="menu hidden">
            <button data-act="png">🖼️ תמונה (PNG)</button>
            <button data-act="pdf">📄 קובץ PDF</button>
            <hr />
            <button data-act="json">💾 גיבוי נתונים (JSON)</button>
            <button data-act="import">📥 ייבוא נתונים</button>
            <hr />
            <button data-act="reset">↩️ איפוס לעץ ההתחלתי</button>
          </div>
        </div>
        <input
          id="search"
          className="tb-search"
          list="search-list"
          placeholder="🔍 חיפוש בעץ..."
          autoComplete="off"
        />
        <datalist id="search-list"></datalist>
      </div>

      <main id="tree-wrap">
        <svg id="tree-svg" xmlns="http://www.w3.org/2000/svg"></svg>
        <div className="zoom-controls">
          <button id="zoom-in" title="הגדלה">
            ＋
          </button>
          <button id="zoom-out" title="הקטנה">
            －
          </button>
          <button id="zoom-fit" title="התאמה למסך">
            ⤢
          </button>
        </div>
        <p className="canvas-hint">
          גררו לתזוזה · צביטה או גלגלת לזום · הקישו על עלה לפרטים
        </p>
      </main>

      <div id="sheet" className="sheet hidden"></div>
      <div id="overlay-full" className="overlay hidden"></div>
      <div id="modal" className="overlay hidden">
        <div className="modal-box" id="modal-box"></div>
      </div>
      <input type="file" id="import-file" accept="application/json,.json" hidden />
      <div id="toast" className="toast hidden"></div>
    </div>
  );
}
