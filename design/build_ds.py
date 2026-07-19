# -*- coding: utf-8 -*-
"""בונה את קבצי מערכת העיצוב של 'המירוץ למיליון' לתיקיית ds/."""
import os

OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "ds")

TOKENS = """
:root{
  --bg:#FDF6EC; --surface:#FFFFFF; --ink:#33241C; --muted:#8A7466; --line:#EADFD2;
  --brand:#E8542F; --brand-soft:#FBE3DA; --accent:#F2B705; --sky:#2380BF;
  --ok:#27AE60; --danger:#D64545;
  --t-red:#E23D3D; --t-blue:#2E86DE; --t-green:#27AE60;
  --t-orange:#F39C12; --t-purple:#8E5AC8; --t-yellow:#F1C40F;
  --radius:18px; --radius-sm:12px;
  --shadow:0 6px 24px rgba(51,36,28,.10);
}
*{box-sizing:border-box;margin:0;padding:0}
html{direction:rtl}
body{
  background:var(--bg); color:var(--ink);
  font-family:"Rubik","Heebo",-apple-system,"Segoe UI","Noto Sans Hebrew",Arial,sans-serif;
  font-size:17px; line-height:1.55; padding:24px;
}
h1{font-size:26px;font-weight:800} h2{font-size:20px;font-weight:700}
.small{font-size:14px;color:var(--muted)}
.card{background:var(--surface);border:1px solid var(--line);border-radius:var(--radius);
  box-shadow:var(--shadow);padding:20px}
.stack>*+*{margin-top:14px}
.chip{display:inline-flex;align-items:center;gap:6px;background:var(--brand-soft);
  color:var(--brand);border-radius:999px;padding:4px 12px;font-size:14px;font-weight:700}
.btn{display:flex;align-items:center;justify-content:center;gap:10px;width:100%;
  min-height:60px;border-radius:999px;border:none;font:inherit;font-size:20px;
  font-weight:800;cursor:pointer}
.btn-primary{background:var(--brand);color:#fff}
.btn-secondary{background:var(--surface);color:var(--brand);border:2.5px solid var(--brand)}
.btn-quiet{background:transparent;color:var(--muted);min-height:48px;font-size:17px}
"""

def page(title, body, extra_css="", group="רכיבים"):
    return f"""<!-- @dsCard group="{group}" -->
<!doctype html>
<html lang="he" dir="rtl">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{title}</title>
<style>{TOKENS}{extra_css}</style>
</head>
<body>
{body}
</body>
</html>
"""

FILES = {}

# ---------- יסודות: צבעים ----------
_sw = lambda var, name, note="": f"""
<div class="sw"><div class="dot" style="background:var({var})"></div>
<div><b>{name}</b><div class="small">{var}{(' · '+note) if note else ''}</div></div></div>"""
FILES["foundations/colors.html"] = page("צבעים", f"""
<div class="stack">
  <h1>🎨 פלטת צבעים</h1>
  <div class="card"><h2>מותג</h2><div class="grid">
    {_sw('--brand','כתום שקיעה','צבע ראשי — כפתורים, הדגשות')}
    {_sw('--accent','זהב','ספירה לאחור, גביעים')}
    {_sw('--sky','תכלת דרומי','קישורים, מפה')}
    {_sw('--bg','קרם','רקע כללי חם')}
    {_sw('--ink','חום כהה','טקסט')}
    {_sw('--muted','חום עמום','טקסט משני')}
  </div></div>
  <div class="card"><h2>צבעי קבוצות (6)</h2><div class="grid">
    {_sw('--t-red','האדומים 🦅')}
    {_sw('--t-blue','הכחולים 🐬')}
    {_sw('--t-green','הירוקים 🐢')}
    {_sw('--t-orange','הכתומים 🦁')}
    {_sw('--t-purple','הסגולים 🦄')}
    {_sw('--t-yellow','הצהובים 🐝')}
  </div></div>
</div>""", """
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:14px;margin-top:12px}
.sw{display:flex;gap:10px;align-items:center}
.dot{width:44px;height:44px;border-radius:14px;border:1px solid var(--line);flex:none}
""", group="יסודות")

# ---------- יסודות: טיפוגרפיה ----------
FILES["foundations/typography.html"] = page("טיפוגרפיה", """
<div class="stack">
  <h1>🔤 טיפוגרפיה</h1>
  <div class="card stack">
    <div><div class="small">כותרת ענק · 34px/800 — ספירה לאחור, מסך זוכים</div>
      <div style="font-size:34px;font-weight:800">המירוץ למיליון 2026</div></div>
    <div><div class="small">כותרת 1 · 26px/800</div><h1>ניהול המירוץ</h1></div>
    <div><div class="small">כותרת 2 · 20px/700</div><h2>התחנה הבאה</h2></div>
    <div><div class="small">גוף · 17px — מינימום! מיועד לגילאי 3 עד 70+</div>
      <div>סעו אל המקום שבו סבא נהג לקנות פיתות חמות בכל יום שישי.</div></div>
    <div><div class="small">משני · 14px — לתיאורים בלבד, לא לתוכן חשוב</div>
      <div class="small">הרמז נשלח לכל חברי הקבוצה</div></div>
  </div>
  <div class="card small">עקרונות: פונט עברי עגול וחם (Rubik/Heebo) · טקסט גדול וקריא ·
  בלי טקסט חשוב מתחת ל-17px · ניגודיות גבוהה</div>
</div>""", group="יסודות")

# ---------- כפתורים ----------
FILES["components/buttons.html"] = page("כפתורים", """
<div class="stack" style="max-width:342px">
  <h1>🔘 כפתורים</h1>
  <button class="btn btn-primary">כניסה למשחק 🏁</button>
  <button class="btn btn-secondary">היכל התהילה 🏆</button>
  <button class="btn btn-primary" disabled style="opacity:.45">ממתין לאישור המנהל…</button>
  <button class="btn btn-quiet">ביטול</button>
  <div class="card small">גובה 60px לפחות — נוח גם לילד בן 3 וגם לסבתא בת 70.
  טקסט 20px, פינות עגולות מלאות, מצב לחוץ כהה ב-10%.</div>
</div>""")

# ---------- טפסים וקודים ----------
FILES["components/inputs.html"] = page("התחברות וקודים", """
<div class="stack" style="max-width:342px">
  <h1>🔑 התחברות והרשמה</h1>
  <div class="card stack">
    <button class="btn btn-secondary">🔵 התחברות עם Google</button>
    <div class="divider"><span>או הרשמה קלילה</span></div>
    <label class="field"><span>טלפון נייד</span><input type="tel" placeholder="050-1234567"></label>
    <label class="field"><span>שם מלא</span><input placeholder="שרה כהן"></label>
    <label class="field"><span>סיסמה</span><input type="password" placeholder="••••••••"></label>
    <button class="btn btn-primary">הרשמה</button>
    <div class="small" style="text-align:center">שלושה שדות וזהו — בלי אימייל, בלי SMS</div>
  </div>
  <div class="card stack">
    <h2>קוד משחק</h2>
    <div class="codes">
      <b>ר</b><b>ץ</b><b>2</b><b>0</b><b>2</b><b>6</b>
    </div>
    <h2>קוד קבוצה</h2>
    <div class="codes codes-team"><b>7</b></div>
  </div>
</div>""", """
.field{display:block}
.field span{display:block;font-weight:700;font-size:15px;margin-bottom:6px}
.field input{width:100%;height:56px;border:2px solid var(--line);border-radius:var(--radius-sm);
  padding:0 14px;font:inherit;font-size:18px;background:#fff}
.field input:focus{outline:none;border-color:var(--brand)}
.divider{display:flex;align-items:center;gap:10px;color:var(--muted);font-size:14px}
.divider::before,.divider::after{content:"";flex:1;height:1px;background:var(--line)}
.codes{display:flex;gap:8px;justify-content:center}
.codes b{width:46px;height:56px;display:flex;align-items:center;justify-content:center;
  background:#fff;border:2px solid var(--line);border-radius:var(--radius-sm);font-size:24px}
.codes-team b{border-color:var(--brand);color:var(--brand)}
""")

# ---------- ספירה לאחור ----------
FILES["components/countdown.html"] = page("ספירה לאחור", """
<div class="stack" style="max-width:342px;text-align:center">
  <h1>⏳ ספירה לאחור</h1>
  <div class="card" style="background:linear-gradient(160deg,#FFF3E4,#FBE3DA)">
    <div style="font-size:15px;font-weight:700;color:var(--brand)">יום העצמאות · בית סבא וסבתא</div>
    <div style="font-size:28px;font-weight:800;margin:4px 0 14px">המירוץ למיליון 2026 🏁</div>
    <div class="cd">
      <div><b>23</b><span>ימים</span></div>
      <div><b>14</b><span>שעות</span></div>
      <div><b>52</b><span>דקות</span></div>
      <div><b>08</b><span>שניות</span></div>
    </div>
  </div>
  <div class="small">גדולה, בולטת ויפה — הדבר הראשון שרואים בדף הבית</div>
</div>""", """
.cd{display:flex;gap:8px;justify-content:center}
.cd>div{background:var(--ink);color:#fff;border-radius:14px;min-width:64px;padding:10px 6px}
.cd b{display:block;font-size:30px;font-weight:800;font-variant-numeric:tabular-nums}
.cd span{font-size:12px;opacity:.75}
""", group="מסך הבית")

# ---------- ציטוט סבא/סבתא ----------
FILES["components/quote-card.html"] = page("משפטי סבא וסבתא", """
<div class="stack" style="max-width:342px">
  <h1>💬 משפטי סבא וסבתא</h1>
  <div class="quote">
    <div class="avatar">👴</div>
    <div class="bubble">״מי שלא רץ — שילך ברגל, העיקר שיגיע לאכול.״<div class="small">— סבא</div></div>
  </div>
  <div class="quote">
    <div class="avatar" style="background:#F3E0F7">👵</div>
    <div class="bubble">״שתו מים! גם המנצחים צריכים לשתות.״<div class="small">— סבתא</div></div>
  </div>
  <div class="card small">מופיעים באקראי: דף הבית, מסכי המתנה, בין משימות.
  במקום האימוג׳י — תמונה/קריקטורה אמיתית.</div>
</div>""", """
.quote{display:flex;gap:10px;align-items:flex-end}
.avatar{width:56px;height:56px;border-radius:50%;background:#E4EEF7;display:flex;
  align-items:center;justify-content:center;font-size:30px;flex:none;border:1px solid var(--line)}
.bubble{background:var(--surface);border:1px solid var(--line);border-radius:var(--radius);
  border-bottom-right-radius:4px;padding:14px 16px;box-shadow:var(--shadow);font-size:18px}
""", group="מסך הבית")

# ---------- כרטיס קבוצה ----------
FILES["components/team-card.html"] = page("כרטיס קבוצה", """
<div class="stack" style="max-width:342px">
  <h1>👥 כרטיס קבוצה</h1>
  <div class="card team" style="--team:var(--t-blue)">
    <div class="head"><span class="animal">🐬</span>
      <div><b style="font-size:22px">הכחולים · דולפינים</b>
        <div class="small">8 חברי קבוצה</div></div>
      <span class="chip" style="margin-inline-start:auto">קוד 7</span></div>
    <div class="members">
      <span>שרה</span><span>דוד</span><span>נועה</span><span>איתן</span>
      <span>תמר (3)</span><span>סבתא רחל</span><span>+2</span>
    </div>
  </div>
  <div class="card team" style="--team:var(--t-green)">
    <div class="head"><span class="animal">🐢</span>
      <div><b style="font-size:22px">הירוקים · צבים</b>
        <div class="small">7 חברי קבוצה</div></div>
      <span class="chip" style="margin-inline-start:auto">קוד 3</span></div>
  </div>
  <div class="small">פס הצבע, החיה והשם — זהות הקבוצה בכל מסך</div>
</div>""", """
.team{border-inline-start:8px solid var(--team);padding-inline-start:16px}
.head{display:flex;gap:12px;align-items:center}
.animal{width:56px;height:56px;border-radius:16px;background:color-mix(in srgb,var(--team) 15%,#fff);
  display:flex;align-items:center;justify-content:center;font-size:32px;flex:none}
.members{display:flex;flex-wrap:wrap;gap:6px;margin-top:12px}
.members span{background:var(--bg);border:1px solid var(--line);border-radius:999px;
  padding:4px 12px;font-size:14px;font-weight:600}
""", group="קבוצות")

# ---------- לידרבורד ----------
FILES["components/leaderboard.html"] = page("לידרבורד חי", """
<div class="stack" style="max-width:342px">
  <h1>🏅 טבלת מובילים</h1>
  <div class="card" style="padding:8px 0">
    <div class="row"><span class="rank">🥇</span><i style="background:var(--t-orange)"></i><b>הכתומים · אריות 🦁</b></div>
    <div class="row"><span class="rank">🥈</span><i style="background:var(--t-blue)"></i><b>הכחולים · דולפינים 🐬</b></div>
    <div class="row"><span class="rank">🥉</span><i style="background:var(--t-green)"></i><b>הירוקים · צבים 🐢</b></div>
    <div class="row"><span class="rank">4</span><i style="background:var(--t-purple)"></i><b>הסגולים · חדי־קרן 🦄</b></div>
    <div class="row"><span class="rank">5</span><i style="background:var(--t-red)"></i><b>האדומים · נשרים 🦅</b></div>
    <div class="row"><span class="rank">6</span><i style="background:var(--t-yellow)"></i><b>הצהובים · דבורים 🐝</b></div>
  </div>
  <div class="card small">⚠️ דירוג בלבד — בלי ״משימה 3 מתוך 7״. שומרים על המתח עד הסוף.
  מתעדכן בזמן אמת עם אנימציית החלפת מקומות.</div>
</div>""", """
.row{display:flex;gap:12px;align-items:center;padding:12px 18px;border-bottom:1px solid var(--line)}
.row:last-child{border-bottom:none}
.rank{width:34px;text-align:center;font-size:22px;font-weight:800;color:var(--muted)}
.row i{width:14px;height:14px;border-radius:50%;flex:none}
.row b{font-size:17px}
""", group="מירוץ חי")

# ---------- רמז ומשימה ----------
FILES["components/clue-card.html"] = page("רמז ומשימה", """
<div class="stack" style="max-width:342px">
  <h1>🧭 מהלך המשחק</h1>
  <div class="card stack">
    <div class="chip">🔒 בדרך לתחנה</div>
    <h2>הרמז</h2>
    <div style="font-size:18px">״המקום שבו סבא קנה פיתות חמות בכל שישי,
    והריח היה מגיע עד הכביש…״</div>
    <div class="dist">📍 עוד 340 מ׳ 🔥</div>
    <div class="small">מד המרחק מוצג רק אם המנהל התורן בחר בכך (ברירת מחדל: מוצג)</div>
  </div>
  <div class="card stack" style="border-color:var(--ok)">
    <div class="chip" style="background:#DFF3E7;color:var(--ok)">🎉 הגעתם! המשימה נפתחה</div>
    <h2>המשימה</h2>
    <div>מצאו את הלחמנייה הכי גדולה במאפייה וצלמו את כל הקבוצה נוגסת בה יחד 📸</div>
    <button class="btn btn-primary">צלמו והעלו תמונה</button>
  </div>
</div>""", """
.dist{background:var(--ink);color:#fff;border-radius:999px;padding:10px 18px;
  text-align:center;font-size:20px;font-weight:800}
""", group="מירוץ חי")

# ---------- צ'אט ----------
FILES["components/chat.html"] = page("צ'אט קבוצתי", """
<div class="stack" style="max-width:342px">
  <h1>💬 צ'אט קבוצתי</h1>
  <div class="card stack" style="background:var(--bg)">
    <div class="msg them"><div class="who">דוד</div>אנחנו ליד המאפייה, איפה אתם?</div>
    <div class="msg them"><div class="who">נועה</div><div class="att">📷 תמונה</div>תראו את תמר!</div>
    <div class="msg me">מגיעים עוד 2 דקות 🏃</div>
    <div class="msg admin"><div class="who">📣 המנהל התורן</div>תזכורת: חוזרים לבית סבא עד 17:00!</div>
    <div class="composer"><span>📎</span><span>📷</span><i>הודעה…</i><b>שלח</b></div>
  </div>
</div>""", """
.msg{max-width:85%;border-radius:var(--radius);padding:10px 14px;font-size:16px;background:#fff;
  border:1px solid var(--line);align-self:flex-start;border-top-right-radius:4px}
.msg.me{background:var(--brand);color:#fff;border:none;align-self:flex-end;
  border-top-right-radius:var(--radius);border-top-left-radius:4px}
.msg.admin{background:#FFF3D6;border-color:var(--accent)}
.who{font-size:13px;font-weight:800;color:var(--brand);margin-bottom:2px}
.msg.admin .who{color:#9A7B00}
.att{background:rgba(0,0,0,.06);border-radius:10px;padding:22px 10px;text-align:center;
  margin-bottom:6px;font-size:14px}
.card.stack{display:flex;flex-direction:column}
.composer{display:flex;align-items:center;gap:10px;background:#fff;border:1px solid var(--line);
  border-radius:999px;padding:8px 14px;margin-top:6px}
.composer i{flex:1;color:var(--muted);font-style:normal}
.composer b{color:var(--brand)}
""", group="מירוץ חי")

# ---------- היכל התהילה ----------
FILES["components/hall-of-fame.html"] = page("היכל התהילה", """
<div class="stack" style="max-width:342px">
  <h1>🏆 היכל התהילה</h1>
  <div class="card fame" style="--team:var(--t-purple)">
    <div class="year">2025</div><div class="photo">📸</div>
    <div><b>הסגולים · חדי־קרן 🦄</b><div class="small">רות, יואב, מיכל, אבי ועוד 4</div></div>
  </div>
  <div class="card fame" style="--team:var(--t-red)">
    <div class="year">2024</div><div class="photo">📸</div>
    <div><b>האדומים · נשרים 🦅</b><div class="small">דני, שירה, עומר ועוד 5</div></div>
  </div>
  <div class="card fame" style="--team:var(--t-blue)">
    <div class="year">2023</div><div class="photo">📸</div>
    <div><b>הכחולים · לווייתנים 🐋</b><div class="small">משפחת כהן הצעירה</div></div>
  </div>
  <div class="card small">כולל 20 שנות היסטוריה שיוזנו ידנית · סטטיסטיקות:
  שיאן הזכיות, שיאן ההשתתפויות</div>
</div>""", """
.fame{display:flex;gap:12px;align-items:center;border-inline-start:8px solid var(--team)}
.year{font-size:20px;font-weight:800;color:var(--brand);min-width:52px}
.photo{width:52px;height:52px;border-radius:12px;background:var(--bg);border:1px solid var(--line);
  display:flex;align-items:center;justify-content:center;font-size:22px;flex:none}
""", group="מורשת")

# ---------- ניהול משתתפים ----------
FILES["components/admin-participants.html"] = page("ניהול משתתפים", """
<div class="stack" style="max-width:342px">
  <h1>🧑‍💼 רשימת משתתפים (מנהל תורן)</h1>
  <div class="card" style="padding:12px">
    <div class="add"><span>➕</span><i>הוספת משתתף — חיפוש או שם חופשי…</i></div>
    <div class="sugg"><b>משתמשי האתר:</b> שרה כהן · דוד כהן · נועה לוי · ⌨️ הקלדה חופשית</div>
  </div>
  <div class="card" style="padding:6px 0">
    <div class="p"><input type="checkbox" checked><b>שרה כהן</b><span class="src">רשומה</span><span class="team" style="--team:var(--t-blue)">🐬 הכחולים</span></div>
    <div class="p"><input type="checkbox" checked><b>תמר (3)</b><span class="src manual">ידני</span><span class="team none">לא שויכה</span></div>
    <div class="p"><input type="checkbox" checked><b>סבא אלי</b><span class="src manual">ידני</span><span class="team none">לא שויך</span></div>
    <div class="p"><input type="checkbox"><b>דוד כהן</b><span class="src">רשום</span><span class="team" style="--team:var(--t-green)">🐢 הירוקים</span></div>
  </div>
  <div class="bar"><b>3 נבחרו</b><button class="btn btn-primary" style="min-height:48px;font-size:17px;width:auto;padding:0 22px">שייך לקבוצה…</button></div>
</div>""", """
.add{display:flex;gap:8px;align-items:center;border:2px dashed var(--line);border-radius:var(--radius-sm);padding:12px}
.add i{color:var(--muted);font-style:normal}
.sugg{font-size:13px;color:var(--muted);padding:8px 4px 2px}
.p{display:flex;gap:10px;align-items:center;padding:12px 16px;border-bottom:1px solid var(--line)}
.p:last-child{border-bottom:none}
.p input{width:24px;height:24px;accent-color:var(--brand)}
.p b{flex:1}
.src{font-size:12px;background:#E4EEF7;color:var(--sky);border-radius:999px;padding:2px 10px}
.src.manual{background:var(--bg);color:var(--muted)}
.team{font-size:13px;font-weight:700;color:var(--team)}
.team.none{color:var(--muted);font-weight:400}
.bar{position:sticky;bottom:0;display:flex;align-items:center;justify-content:space-between;
  background:var(--ink);color:#fff;border-radius:var(--radius);padding:10px 16px}
""", group="ניהול")

if __name__ == "__main__":
    for path, html in FILES.items():
        full = os.path.join(OUT, path)
        os.makedirs(os.path.dirname(full), exist_ok=True)
        with open(full, "w", encoding="utf-8") as f:
            f.write(html)
        print(path, len(html))
