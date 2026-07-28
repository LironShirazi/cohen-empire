/* העץ המשפחתי — אתחול */
(function () {
  'use strict';
  const NS = window.FT;

  document.addEventListener('DOMContentLoaded', () => {
    NS.store.load();
    NS.render.init();
    NS.ui.init();

    NS.onDataChanged = () => NS.ui.refresh();
    NS.onPersonTap = (id) => NS.ui.openCard(id);

    NS.render.draw();
    NS.render.fit();
  });
})();
