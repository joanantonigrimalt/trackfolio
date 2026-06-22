(function () {
  var resolve, reject;
  window.__supabaseLoaded = new Promise(function (res, rej) {
    resolve = res;
    reject = rej;
  });
  var s = document.createElement('script');
  s.src = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.js';
  s.crossOrigin = 'anonymous';
  s.onload = function () { resolve(true); };
  s.onerror = function () { reject(new Error('Failed to load Supabase SDK from CDN')); };
  document.head.appendChild(s);
})();
