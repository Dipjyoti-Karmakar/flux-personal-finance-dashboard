
(function () {
  var ua = navigator.userAgent || '';
  // Detect common in-app browser signatures
  var isInApp = /LinkedInApp|Instagram|FBAN|FBAV/i.test(ua);

  if (isInApp) {
    // Replace the entire page with a fallback screen
    document.documentElement.innerHTML = '<!DOCTYPE html><html lang="en"><head>'
      + '<meta charset="UTF-8">'
      + '<meta name="viewport" content="width=device-width,initial-scale=1.0">'
      + '<title>Open in Browser</title>'
      + '<style>'
      + '*{margin:0;padding:0;box-sizing:border-box}'
      + 'body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;'
      + 'background:#0d0f14;color:#e8eaf0;display:flex;align-items:center;justify-content:center;'
      + 'min-height:100vh;padding:24px;text-align:center}'
      + '.card{max-width:420px;width:100%;padding:40px 28px;background:#13161e;'
      + 'border:1px solid rgba(255,255,255,0.07);border-radius:18px}'
      + '.icon{font-size:48px;margin-bottom:20px}'
      + 'h1{font-size:22px;font-weight:600;margin-bottom:12px;color:#e8eaf0}'
      + 'p{font-size:15px;line-height:1.6;color:#7a8099;margin-bottom:28px}'
      + '.btn{display:inline-block;padding:14px 32px;background:#c8a96e;color:#0d0f14;'
      + 'font-size:15px;font-weight:600;border:none;border-radius:12px;cursor:pointer;'
      + 'text-decoration:none;transition:opacity .2s}'
      + '.btn:hover{opacity:.85}'
      + '.hint{margin-top:20px;font-size:12px;color:#4a5068;line-height:1.5}'
      + '</style></head><body>'
      + '<div class="card">'
      + '<div class="icon">🔒</div>'
      + '<h1>Open in Your Browser</h1>'
      + '<p>Google Sign-In does not work inside in-app browsers. '
      + 'Please open this page in Chrome or Safari to continue.</p>'
      + '<a class="btn" href="' + window.location.href.replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/'/g,'&#39;').replace(/</g,'&lt;').replace(/>/g,'&gt;') + '" target="_blank" '
      + 'rel="noopener noreferrer">Open in Chrome to sign in with Google</a>'
      + '<div class="hint">Tap the button above, or copy the link and paste it into your browser\'s address bar.</div>'
      + '</div></body></html>';

    // Stop any further script execution
    throw new Error('In-app browser detected - blocking page load');
  }
})();
