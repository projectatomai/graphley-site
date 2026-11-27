// Keeps every "© <year>" line on the current year without a redeploy.
(function () {
  function run() {
    var y = String(new Date().getFullYear());
    var els = document.querySelectorAll('[data-pm-year]');
    for (var i = 0; i < els.length; i++) els[i].textContent = y;
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', run);
  else run();
})();
