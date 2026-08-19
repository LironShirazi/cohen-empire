/* העץ המשפחתי — אתחול */
(function () {
  'use strict';
  const NS = (window.FT = window.FT || {});

  /**
   * האתחול נקרא **במפורש** מהראוט (app/family-tree/tree-canvas.tsx)
   * ולא מ-DOMContentLoaded: בניווט צד-לקוח האירוע הזה כבר קרה מזמן
   * לפני שהסקריפטים נטענים, והעץ פשוט לא היה מצויר.
   *
   * `store.load()` אסינכרוני מאז המעבר ל-Supabase; כל השאר נשאר
   * סינכרוני ולכן `layout.js`/`render.js`/`ui.js` לא השתנו.
   */
  NS.boot = async function boot() {
    await NS.store.load();
    NS.render.init();
    NS.ui.init();

    NS.onDataChanged = () => NS.ui.refresh();
    NS.onPersonTap = (id) => NS.ui.openCard(id);

    NS.render.draw();
    NS.render.fit();
  };
})();
