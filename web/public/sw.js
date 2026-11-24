// Service Worker של האפליקציה — **התראות Push בלבד** (CLAUDE.md §23).
//
// ⚠️ אין כאן קאשינג ובכוונה אין מאזין `fetch`: מצב המשחק, הרמזים,
// הצ'אט והדירוג הם אמת-שרת בלבד (docs/02 §3.10), וקבוצה שתקבל מהקאש
// רמז ישן גרועה מקבוצה בלי קליטה. מי שרוצה להוסיף כאן קאש — לקרוא
// קודם את §3.10.

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    // מטען שאינו JSON — מציגים את הטקסט כמו שהוא
    data = { body: event.data ? event.data.text() : "" };
  }

  const title = data.title || "אימפריית כהן";
  event.waitUntil(
    self.registration.showNotification(title, {
      body: data.body || "",
      icon: "/brand/pwa-192.png",
      badge: "/brand/pwa-badge.png",
      // אותו `tag` מחליף התראה קודמת במקום לערום: חמישה סטוריז של אותו
      // אדם הם התראה אחת, לא חמש
      tag: data.tag || undefined,
      renotify: Boolean(data.tag),
      lang: "he",
      dir: "rtl",
      data: { url: data.url || "/" },
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = new URL(event.notification.data?.url || "/", self.location.origin).href;

  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      // אפליקציה פתוחה — מעבירים אותה ליעד ומביאים לקדמה, במקום חלון שני
      for (const client of windows) {
        if (new URL(client.url).origin === self.location.origin && "focus" in client) {
          await client.focus();
          if ("navigate" in client) await client.navigate(target).catch(() => {});
          return;
        }
      }
      await self.clients.openWindow(target);
    })()
  );
});
