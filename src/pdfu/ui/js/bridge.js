/* =========================================================================
   Bridge between the UI and Python.

   In the app, pywebview injects window.pywebview.api (see src/pdfu/app.py,
   class Api). Opened as a plain web page (for UI work, or the screenshots
   in docs/), a demo bridge stands in: it fakes files, passwords and
   progress so every screen can be reached without Python.
   ========================================================================= */
(function () {
  'use strict';

  function nativeBridge() {
    var api = window.pywebview.api;
    return {
      native: true,
      init: function () { return api.init(); },
      pickFiles: function () { return api.pick_files(); },
      inspect: function (path) { return api.inspect(path); },
      submitPassword: function (path, pw) { return api.submit_password(path, pw); },
      saveChoices: function (path) { return api.save_choices(path); },
      browseFolder: function (start) { return api.browse_folder(start || ''); },
      unlock: function (path, dest) { return api.unlock(path, dest || null); },
      openFolder: function (path) { return api.open_folder(path); },
      setSetting: function (key, value) { return api.set_setting(key, value); },
      setSize: function (size) { return api.set_size(size); },
      minimize: function () { return api.minimize(); },
      close: function () { return api.close(); },
      log: function (msg) { try { api.log(String(msg)); } catch (e) { /* ignore */ } }
    };
  }

  /* ---------------- demo bridge (browser only) ---------------- */
  function demoBridge() {
    var sleep = function (ms) { return new Promise(function (r) { setTimeout(r, ms); }); };
    var DIR = 'C:\\DOCS\\';
    var SAMPLES = {
      'Document.pdf':                 { folder: 'C:\\DOCS', size: 1258291, pages: 14, kind: 'locked' },
      'Invoice_0412.pdf':             { folder: 'C:\\DOCS\\BILLING', size: 319488, pages: 2, kind: 'locked' },
      'S-201 Framing Plan.pdf':       { folder: 'C:\\PROJECTS\\2026 WAREHOUSE\\DRAWINGS', size: 9017753, pages: 36, kind: 'password' },
      'A-101 Floor Plan.pdf':         { folder: 'C:\\PROJECTS\\2026 WAREHOUSE\\DRAWINGS', size: 2411724, pages: 1, kind: 'clean' },
      'Bad download.pdf':             { folder: 'C:\\USERS\\YOU\\DOWNLOADS', size: 1820, pages: 0, kind: 'broken' }
    };
    var unlockedPw = {};
    var sessionPw = [];
    var recent = ['C:\\UNLOCKED', 'D:\\ARCHIVE'];
    var params = new URLSearchParams(location.search);

    function parts(path) {
      var i = Math.max(path.lastIndexOf('\\'), path.lastIndexOf('/'));
      return i < 0 ? { folder: DIR.replace(/\\$/, ''), name: path } : { folder: path.slice(0, i), name: path.slice(i + 1) };
    }
    function info(path, sample) {
      var p = parts(path);
      var locked = sample.kind !== 'clean';
      return {
        ok: true, path: path, name: p.name, folder: sample.folder || p.folder, size_bytes: sample.size, pages: sample.pages,
        status: locked ? 'locked' : 'not_encrypted', can_print: !locked, can_copy: !locked, can_edit: !locked,
        certified: false, signed: false, needed_password: sample.kind === 'password'
      };
    }
    function sampleFor(path) {
      var p = parts(path);
      return SAMPLES[p.name] || { folder: p.folder, size: 524288, pages: 4, kind: 'locked' };
    }
    return {
      native: false,
      samples: Object.keys(SAMPLES),
      init: function () {
        return Promise.resolve({
          version: '1.0.0', qpdf: '12.4.2', native: false,
          systemTheme: (window.matchMedia && matchMedia('(prefers-color-scheme: dark)').matches) ? 'dark' : 'light',
          theme: params.get('theme') || 'auto', saveMode: params.get('save') || 'same',
          size: params.get('size') || 'small', zoom: Number(params.get('zoom')) || (params.get('size') === 'normal' ? 2 : 1),
          normalAvailable: true, startupFiles: []
        });
      },
      pickFiles: function () {
        return new Promise(function (resolve) {
          var input = document.getElementById('demoPick');
          var done = false;
          input.value = '';
          input.onchange = function () {
            done = true;
            resolve(Array.prototype.map.call(input.files, function (f) { return DIR + f.name; }));
          };
          input.click();
          window.addEventListener('focus', function once() {
            window.removeEventListener('focus', once);
            setTimeout(function () { if (!done) resolve([]); }, 600);
          });
        });
      },
      inspect: function (path) {
        var s = sampleFor(path);
        var p = parts(path);
        return sleep(250).then(function () {
          if (!/\.pdf$/i.test(path)) return { ok: false, kind: 'not_pdf', name: p.name };
          if (s.kind === 'broken') return { ok: false, kind: 'unreadable', path: path, name: p.name, folder: s.folder,
            message: "COULDN'T READ THIS PDF. IT MAY BE DAMAGED OR NOT A REAL PDF." };
          if (s.kind === 'password' && sessionPw.indexOf('steel2026') < 0) {
            return { ok: true, status: 'needs_password', path: path, name: p.name, folder: s.folder, size_bytes: s.size, pages: 0 };
          }
          return info(path, s);
        });
      },
      submitPassword: function (path, pw) {
        return sleep(200).then(function () {
          if (pw !== 'steel2026') return { ok: true, status: 'needs_password', wrong: true };
          sessionPw.push(pw); unlockedPw[path] = pw;
          return info(path, sampleFor(path));
        });
      },
      saveChoices: function (path) {
        var f = sampleFor(path).folder;
        return Promise.resolve([{ path: f, note: 'ORIGINAL' }].concat(recent.slice(0, 2).map(function (r) { return { path: r, note: 'RECENT' }; })));
      },
      browseFolder: function () { return Promise.resolve(prompt('Folder to save into:', 'C:\\UNLOCKED') || null); },
      unlock: function (path, dest) {
        var s = sampleFor(path);
        var p = parts(path);
        var push = function (pct, step) { if (window.PDFu) window.PDFu.onProgress({ pct: pct, step: step }); };
        return sleep(120).then(function () { push(2, 'open'); return sleep(300); })
          .then(function () { push(25, unlockedPw[path] ? 'password' : 'restrictions'); return sleep(300); })
          .then(function () { push(45, 'clearing'); return sleep(250); })
          .then(function () {
            var pct = 50;
            return new Promise(function (resolve) {
              (function tick() {
                pct = Math.min(99, pct + 7); push(pct, 'writing');
                if (pct < 99) setTimeout(tick, 70); else resolve();
              })();
            });
          })
          .then(function () {
            push(100, 'done');
            var dir = dest || s.folder;
            if (dest && recent.indexOf(dest) < 0) recent.unshift(dest);
            var out = p.name.replace(/\.pdf$/i, '') + '_Unlocked.pdf';
            return { ok: true, out_path: dir + '\\' + out, out_dir: dir, out_name: out, same_folder: !dest, signed: false, certified: false };
          });
      },
      openFolder: function () { return Promise.resolve(true); },
      setSetting: function () { return Promise.resolve(true); },
      setSize: function (size) { return Promise.resolve({ size: size, zoom: size === 'normal' ? 2 : 1 }); },
      minimize: function () { return Promise.resolve(); },
      close: function () { return Promise.resolve({ pending: false, demo: true }); },
      log: function (msg) { console.warn('[PDFu]', msg); }
    };
  }

  /* pywebview injects its API asynchronously; wait a moment for it. */
  window.PDFuBridge = {
    ready: function () {
      return new Promise(function (resolve) {
        if (window.pywebview && window.pywebview.api && window.pywebview.api.init) return resolve(nativeBridge());
        var settled = false;
        window.addEventListener('pywebviewready', function () {
          if (!settled) { settled = true; resolve(nativeBridge()); }
        });
        var inApp = /^http:\/\/(127\.0\.0\.1|localhost):\d+\//.test(location.href) && !/[?&]demo\b/.test(location.search);
        setTimeout(function () {
          if (!settled) { settled = true; resolve(demoBridge()); }
        }, inApp ? 8000 : 400);
      });
    }
  };
})();
