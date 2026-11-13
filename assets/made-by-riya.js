/* A small "Made by Riya Dutta" stamp in the corner, linking back to the portfolio.
   Include with: <script src="assets/made-by-riya.js" defer></script> */
(function () {
  var PORTFOLIO = 'https://riyavdutta.github.io/riya-portfolio/';
  var a = document.createElement('a');
  a.href = PORTFOLIO;
  a.setAttribute('aria-label', 'Made by Riya Dutta: see her portfolio');
  a.style.cssText = 'position:fixed;right:16px;bottom:16px;z-index:9999;display:flex;align-items:center;gap:10px;padding:8px 14px 8px 8px;' +
    'background:#fcf7d9;color:#65232b;border-radius:10px;text-decoration:none;font:400 10px/1.2 "Space Mono",monospace;letter-spacing:.08em;' +
    'box-shadow:0 0 0 2px #fff,0 10px 22px -10px rgba(43,23,17,.55);transform:rotate(-2deg);transition:transform .25s ease';
  a.innerHTML = '<span style="display:flex;align-items:center;justify-content:center;width:34px;height:40px;background:#65232b;color:#fcf7d9;' +
    'font:italic 500 15px Georgia,\'Playfair Display\',serif;outline:3px dotted #fcf7d9;outline-offset:-5px">RD</span><span>MADE BY<br>RIYA DUTTA</span>';
  a.addEventListener('mouseenter', function () { a.style.transform = 'rotate(0deg) translateY(-2px)'; });
  a.addEventListener('mouseleave', function () { a.style.transform = 'rotate(-2deg)'; });
  (document.body ? Promise.resolve() : new Promise(function (r) { document.addEventListener('DOMContentLoaded', r); })).then(function () { document.body.appendChild(a); });
})();
