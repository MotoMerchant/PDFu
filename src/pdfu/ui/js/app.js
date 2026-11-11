/* =========================================================================
   PDFu controller: state machine, controls, keyboard, drag and drop.
   Modes: idle > reading > loaded | password | notlocked | error
          loaded > [saveas] > unlocking > done | error
   ========================================================================= */
(function () {
  'use strict';

  var $ = function (sel) { return document.querySelector(sel); };
  var dev = $('#device'), view = $('#view'), statusEl = $('#status'), outModeEl = $('#outMode');
  var menuEl = $('#menu'), overlayEl = $('#overlay'), rocker = $('#rocker');
  var unlockLed = $('#unlockLed'), openLed = $('#openLed');

  var reduced = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  var SPEED = reduced ? 4 : 1;
  var k = function (ms) { return Math.round(ms / SPEED); };
  var sleep = function (ms) { return new Promise(function (r) { setTimeout(r, ms); }); };
  var drive = new window.FloppyDrive($('#drive'), SPEED);
  var bridge = null;

  var S = {
    mode: 'idle', seq: 0, same: true, file: null, queue: [], pw: { wrong: false },
    choices: [], sel: 0, prog: { shown: 0, target: 0, steps: [] }, result: null, error: null,
    err: '', toast: '', winMsg: '', closing: false, menu: null, about: false, dragging: false,
    size: 'small', zoom: 1, normalAvailable: true, themePref: 'auto', systemTheme: 'light',
    version: '', qpdf: '', demo: false
  };
  var timers = { err: 0, toast: 0, win: 0 };
  var lastViewKey = '';

  var LABELS = { idle: 'READY', reading: 'READING', loaded: 'LOCKED', password: 'PASSWORD', notlocked: 'NOT LOCKED',
                 saveas: 'SAVE AS', unlocking: 'BUSY', done: 'DONE', error: 'ERROR' };

  function blocked() { return S.mode === 'unlocking' || S.mode === 'saveas'; }
  function baseName(p) { var i = Math.max(p.lastIndexOf('\\'), p.lastIndexOf('/')); return i < 0 ? p : p.slice(i + 1); }
  function dirName(p) { var i = Math.max(p.lastIndexOf('\\'), p.lastIndexOf('/')); return i < 0 ? '' : p.slice(0, i); }
  function isPdf(p) { return /\.pdf$/i.test(p); }

  /* ------------------------------------------------------------ rendering */
  function viewKey() {
    var f = S.file || {};
    switch (S.mode) {
      case 'idle': return 'idle|' + S.dragging;
      case 'reading': return 'reading|' + f.name;
      case 'loaded': return 'loaded|' + f.path + '|' + S.same;
      case 'password': return 'password|' + f.path + '|' + S.pw.wrong + '|' + S.pw.n + '|' + S.queue.length;
      case 'notlocked': return 'notlocked|' + f.path + '|' + S.queue.length;
      case 'saveas': return 'saveas|' + f.path + '|' + S.choices.length;
      case 'unlocking': return 'unlocking|' + S.seq;
      case 'done': return 'done|' + (S.result && S.result.out_path) + '|' + S.queue.length;
      case 'error': return 'error|' + (S.error && S.error.message) + '|' + S.queue.length;
    }
    return S.mode;
  }

  function render() {
    var theme = S.themePref === 'auto' ? S.systemTheme : S.themePref;
    dev.dataset.theme = theme;
    dev.dataset.size = S.size;
    dev.dataset.mode = S.mode;
    dev.dataset.save = S.same ? 'same' : 'ask';
    dev.style.zoom = S.zoom;
    document.body.classList.toggle('dark-page', theme === 'dark');

    statusEl.textContent = S.winMsg || S.err || S.toast || LABELS[S.mode] || '';
    outModeEl.textContent = S.same ? 'OUT: SAME FOLDER + _Unlocked' : 'OUT: ASK EACH TIME';
    rocker.setAttribute('aria-pressed', S.same ? 'true' : 'false');

    var ready = S.mode === 'loaded' || S.mode === 'saveas' || S.mode === 'unlocking';
    unlockLed.classList.toggle('on', ready);
    unlockLed.classList.toggle('blinking', S.mode === 'loaded');
    openLed.classList.toggle('on', S.mode === 'done');

    var key = viewKey();
    if (key !== lastViewKey) {
      lastViewKey = key;
      var ctx = { file: S.file, same: S.same, queue: S.queue.length, pw: S.pw, choices: S.choices, sel: S.sel,
                  result: S.result, error: S.error, demo: S.demo, dragging: S.dragging };
      view.innerHTML = (window.Screens[S.mode] || window.Screens.idle)(ctx);
      if (S.mode === 'unlocking') renderProgress();
      if (S.mode === 'password') {
        var input = $('#pwInput');
        if (input) setTimeout(function () { input.focus(); }, 30);
      }
    }
    renderOverlay();
  }

  function renderProgress() {
    var segs = document.querySelectorAll('#segs i');
    var lit = Math.round(S.prog.shown / 5);
    for (var i = 0; i < segs.length; i++) segs[i].classList.toggle('on', i < lit);
    var pct = $('#pct'); if (pct) pct.textContent = S.prog.shown + '%';
    var log = $('#log'); if (log) log.innerHTML = window.Screens.logLines(S.prog.steps, S.prog.shown, S.file ? S.file.name : '');
  }

  function renderOverlay() {
    if (S.about) {
      overlayEl.hidden = false;
      if (!overlayEl.firstChild) overlayEl.innerHTML = window.Screens.about({ version: S.version, qpdf: S.qpdf });
    } else {
      overlayEl.hidden = true; overlayEl.innerHTML = '';
    }
    document.querySelectorAll('.menu-title').forEach(function (b) {
      b.setAttribute('aria-expanded', b.dataset.menu === S.menu ? 'true' : 'false');
    });
    if (!S.menu) { menuEl.hidden = true; menuEl.innerHTML = ''; return; }
    var anchor = document.querySelector('.menu-title[data-menu="' + S.menu + '"]');
    menuEl.innerHTML = window.Screens.menu(S.menu, {
      blocked: blocked(), hasDisk: drive.phase !== 'empty', size: S.size, normalAvailable: S.normalAvailable,
      themePref: S.themePref, same: S.same
    });
    // .titlebar is the anchor's offsetParent and sits 24 px into .crt-inner, the menu's containing block
    menuEl.style.left = (anchor ? 24 + anchor.offsetLeft - 3 : 34) + 'px';
    menuEl.hidden = false;
  }

  function flash(field, text, ms) {
    clearTimeout(timers[field]);
    S[field] = text; render();
    if (ms) timers[field] = setTimeout(function () { S[field] = ''; render(); }, ms);
  }

  /* --------------------------------------------------------------- flows */
  function loadPaths(paths) {
    if (blocked()) return;
    var pdfs = (paths || []).filter(isPdf);
    if (!pdfs.length) { if ((paths || []).length) flash('err', 'NOT A PDF', 2200); return; }
    S.queue = pdfs.slice(1);
    insertPath(pdfs[0]);
  }

  function insertPath(path) {
    if (blocked()) return;
    closeMenus();
    var seq = ++S.seq;
    var name = baseName(path);
    S.toast = '';
    var start = Promise.resolve();
    if (drive.phase !== 'empty') {           // a new file ejects the old disk first
      S.mode = 'idle'; render();
      start = drive.eject().then(function () { return sleep(60); });
    }
    start.then(function () {
      if (seq !== S.seq) return;
      S.file = { path: path, name: name, folder: dirName(path) };
      S.result = null; S.error = null; S.pw = { wrong: false, n: 0 };
      S.mode = 'reading'; render();
      var inspecting = bridge.inspect(path);
      return Promise.all([drive.insert(name), inspecting]).then(function (both) {
        if (seq !== S.seq) return;
        applyInspect(both[1]);
      });
    }).catch(function (e) { reportError(e); });
  }

  function applyInspect(info) {
    if (!info || !info.ok) {
      if (info && info.kind === 'not_pdf') { flash('err', 'NOT A PDF', 2200); goIdle(); return; }
      S.error = { message: (info && info.message) || "COULDN'T READ THIS FILE." };
      S.mode = 'error'; drive.eject(); render(); return;
    }
    S.file = Object.assign({}, S.file, info);
    if (info.status === 'needs_password') {
      S.pw = { wrong: !!info.wrong, n: (S.pw.n || 0) + 1 };
      S.mode = 'password';
    } else if (info.status === 'not_encrypted') {
      S.mode = 'notlocked';
    } else {
      S.mode = 'loaded';
    }
    render();
  }

  function submitPassword() {
    var input = $('#pwInput');
    if (!input || S.mode !== 'password') return;
    var value = input.value;
    var seq = S.seq;
    bridge.submitPassword(S.file.path, value).then(function (res) {
      if (seq !== S.seq || S.mode !== 'password') return;
      if (res && res.ok && res.status === 'needs_password') {
        S.pw = { wrong: true, n: (S.pw.n || 0) + 1 }; render(); return;
      }
      applyInspect(res);
    }).catch(reportError);
  }

  function runUnlock() {
    if (S.mode !== 'loaded') return;
    if (S.same) { startUnlock(null); return; }
    var seq = S.seq;
    bridge.saveChoices(S.file.path).then(function (choices) {
      if (seq !== S.seq || S.mode !== 'loaded') return;
      S.choices = (choices || []).concat([{ browse: true, note: 'BROWSE' }]);
      S.sel = 0; S.mode = 'saveas'; render();
    }).catch(reportError);
  }

  function pickFolder(i) {
    if (S.mode !== 'saveas') return;
    var choice = S.choices[i];
    if (!choice) return;
    if (!choice.browse) { startUnlock(choice.path); return; }
    bridge.browseFolder(S.file.folder).then(function (dir) {
      if (dir && S.mode === 'saveas') startUnlock(dir);
    }).catch(reportError);
  }

  function startUnlock(dest) {
    var seq = ++S.seq;
    S.mode = 'unlocking'; S.prog = { shown: 0, target: 0, steps: [] }; S.result = null;
    render();
    drive.startReading();
    var result = null;
    var job = bridge.unlock(S.file.path, dest).then(function (r) { result = r || { ok: false }; },
      function (e) { result = { ok: false, message: 'UNEXPECTED ERROR: ' + e }; });

    sleep(k(480)).then(function loop() {        // the disk is pulled in first
      if (seq !== S.seq) return;
      var p = S.prog;
      if (result && result.ok) p.target = 100;
      if (p.shown < p.target) { p.shown = Math.min(p.target, p.shown + 4); renderProgress(); }
      if (result && (!result.ok || p.shown >= 100)) return finishUnlock(seq, result);
      return sleep(k(90)).then(loop);
    });
    return job;
  }

  function finishUnlock(seq, result) {
    if (!result.ok) {
      S.error = { message: result.message || 'UNLOCK FAILED.' };
      S.mode = 'error'; drive.eject(); render();
      return;
    }
    return sleep(k(300)).then(function () {
      if (seq !== S.seq) return;
      S.result = result; S.mode = 'done'; render();
      return drive.finish();
    });
  }

  function goIdle() {
    ++S.seq;
    S.mode = 'idle'; S.file = null; S.result = null; S.error = null; S.toast = '';
    render();
    return drive.eject();
  }

  function eject() {
    if (blocked()) return;
    S.queue = [];
    goIdle();
  }

  function loadNext() {
    if (blocked()) return;
    if (S.queue.length) { insertPath(S.queue.shift()); return; }
    pick();
  }

  function pick() {
    if (blocked()) return;
    closeMenus();
    bridge.pickFiles().then(function (paths) { if (paths && paths.length) loadPaths(paths); }).catch(reportError);
  }

  function openFolder() {
    if (S.mode !== 'done' || !S.result) return;
    bridge.openFolder(S.result.out_path);
    flash('toast', 'OPENING FOLDER...', 1600);
  }

  function toggleSave(value) {
    if (blocked()) return;
    S.same = value === undefined ? !S.same : value === 'same';
    bridge.setSetting('save_mode', S.same ? 'same' : 'ask');
    render();
  }

  function setSize(size) {
    if (size === S.size || blocked()) { closeMenus(); return; }
    bridge.setSize(size).then(function (res) {
      if (res && !res.refused) { S.size = res.size; S.zoom = res.zoom; }
      closeMenus();
    }).catch(reportError);
  }

  function setTheme(pref) {
    S.themePref = pref; bridge.setSetting('theme', pref); closeMenus();
  }

  function closeWindow() {
    closeMenus();
    bridge.close().then(function (res) {
      if (res && res.pending) { S.closing = true; flash('winMsg', 'FINISHING...', 0); }
      else if (res && res.demo) flash('winMsg', 'CLOSE', 1400);
    }).catch(reportError);
  }

  function minimize() {
    bridge.minimize();
    if (!bridge.native) flash('winMsg', 'MINIMIZE', 1400);
  }

  function closeMenus() { if (S.menu || S.about) { S.menu = null; S.about = false; render(); } }

  function reportError(e) {
    try { bridge && bridge.log((e && e.stack) || String(e)); } catch (x) { /* ignore */ }
  }

  /* ---------------------------------------------------- Python -> UI events */
  window.PDFu = {
    onProgress: function (p) {
      if (S.mode !== 'unlocking' || !p) return;
      S.prog.target = Math.max(S.prog.target, Math.min(100, p.pct | 0));
      if (p.step && S.prog.steps.indexOf(p.step) < 0) S.prog.steps.push(p.step);
    },
    onFilesDropped: function (d) {
      S.dragging = false; render();
      if (d && d.paths && d.paths.length) loadPaths(d.paths);
      else if (d && d.names && d.names.length) flash('err', 'NOT A PDF', 2200);
    },
    onSystemTheme: function (theme) { S.systemTheme = theme === 'dark' ? 'dark' : 'light'; render(); },
    onClosePending: function () { S.closing = true; flash('winMsg', 'FINISHING...', 0); }
  };

  /* ------------------------------------------------------------- controls */
  var ACTIONS = {
    pick: pick,
    sample: function () {
      var list = bridge.samples || [];
      var i = (ACTIONS.sample.i = ((ACTIONS.sample.i === undefined ? -1 : ACTIONS.sample.i) + 1) % list.length);
      loadPaths([list[i]]);
    },
    eject: function () { closeMenus(); eject(); },
    home: eject,
    next: loadNext,
    unlock: runUnlock,
    open: openFolder,
    'toggle-save': function () { toggleSave(); },
    'set-save': function (el) { toggleSave(el.dataset.value); closeMenus(); },
    'set-size': function (el) { setSize(el.dataset.value); },
    'set-theme': function (el) { setTheme(el.dataset.value); },
    'cancel-ask': function () { if (S.mode === 'saveas') { S.mode = 'loaded'; render(); } },
    'pick-folder': function (el) { pickFolder(Number(el.dataset.index)); },
    'pw-skip': function () { if (S.queue.length) loadNext(); else eject(); },
    menu: function (el) { var m = el.dataset.menu; S.about = false; S.menu = S.menu === m ? null : m; render(); },
    about: function () { S.menu = null; S.about = true; render(); },
    'about-close': function () { S.about = false; render(); },
    minimize: minimize,
    close: closeWindow
  };

  document.addEventListener('click', function (ev) {
    var el = ev.target.closest('[data-action]');
    if (!el || el.disabled) {
      if (S.menu && !ev.target.closest('#menu')) { S.menu = null; render(); }
      return;
    }
    var action = el.dataset.action;
    if (S.menu && action !== 'menu' && !el.closest('#menu')) { S.menu = null; render(); }
    var fn = ACTIONS[action];
    if (fn) { ev.preventDefault(); fn(el); }
  });

  document.addEventListener('submit', function (ev) {
    if (ev.target.dataset.form === 'password') { ev.preventDefault(); submitPassword(); }
  });

  view.addEventListener('mouseover', function (ev) {
    var row = ev.target.closest('.folder-row');
    if (!row || S.mode !== 'saveas') return;
    S.sel = Number(row.dataset.index);
    view.querySelectorAll('.folder-row').forEach(function (r) { r.classList.toggle('sel', r === row); });
  });

  document.addEventListener('keydown', function (ev) {
    var inInput = ev.target && ev.target.tagName === 'INPUT';
    if ((ev.ctrlKey || ev.metaKey) && (ev.key === 'o' || ev.key === 'O')) { ev.preventDefault(); pick(); return; }
    if (ev.altKey && ev.key === 'F4') { ev.preventDefault(); closeWindow(); return; }
    if (ev.key === 'Escape') {
      if (S.menu || S.about) { closeMenus(); return; }
      if (S.mode === 'saveas') { ACTIONS['cancel-ask'](); return; }
      if (S.mode === 'password') { ACTIONS['pw-skip'](); return; }
      return;
    }
    if (S.mode === 'saveas' && (ev.key === 'ArrowDown' || ev.key === 'ArrowUp')) {
      ev.preventDefault();
      S.sel = (S.sel + (ev.key === 'ArrowDown' ? 1 : -1) + S.choices.length) % S.choices.length;
      view.querySelectorAll('.folder-row').forEach(function (r, i) { r.classList.toggle('sel', i === S.sel); if (i === S.sel) r.focus(); });
      return;
    }
    if (ev.key === 'Enter' && !inInput) {
      var onButton = ev.target && ev.target.tagName === 'BUTTON';
      if (S.mode === 'loaded' && !onButton) { ev.preventDefault(); runUnlock(); }
      else if (S.mode === 'saveas' && !onButton) { ev.preventDefault(); pickFolder(S.sel); }
    }
  });

  /* drag and drop: Python receives the real paths (see app.py _on_drop) */
  var dragDepth = 0;
  function setDragging(on) { if (S.dragging !== on) { S.dragging = on; render(); } }
  document.addEventListener('dragenter', function (ev) { ev.preventDefault(); dragDepth++; if (!blocked()) setDragging(true); });
  document.addEventListener('dragover', function (ev) { ev.preventDefault(); if (ev.dataTransfer) ev.dataTransfer.dropEffect = blocked() ? 'none' : 'copy'; });
  document.addEventListener('dragleave', function () { if (--dragDepth <= 0) { dragDepth = 0; setDragging(false); } });
  document.addEventListener('drop', function (ev) {
    ev.preventDefault(); dragDepth = 0; setDragging(false);
    if (bridge && !bridge.native && ev.dataTransfer) {
      loadPaths(Array.prototype.map.call(ev.dataTransfer.files, function (f) { return f.name; }));
    }
  });

  if (window.matchMedia) {
    var mq = matchMedia('(prefers-color-scheme: dark)');
    var follow = function () { if (bridge && !bridge.native) { S.systemTheme = mq.matches ? 'dark' : 'light'; render(); } };
    if (mq.addEventListener) mq.addEventListener('change', follow);
  }
  window.addEventListener('error', function (ev) { reportError(ev.error || ev.message); });
  window.addEventListener('unhandledrejection', function (ev) { reportError(ev.reason); });

  /* ----------------------------------------------------------------- boot */
  render();
  window.PDFuBridge.ready().then(function (b) {
    bridge = b;
    S.demo = !b.native;
    if (S.demo) document.body.classList.add('preview');
    return b.init();
  }).then(function (cfg) {
    S.version = cfg.version; S.qpdf = cfg.qpdf;
    S.systemTheme = cfg.systemTheme === 'dark' ? 'dark' : 'light';
    S.themePref = cfg.theme || 'auto';
    S.same = cfg.saveMode !== 'ask';
    S.size = cfg.size === 'normal' ? 'normal' : 'small';
    S.zoom = cfg.zoom || 1;
    S.normalAvailable = cfg.normalAvailable !== false;
    lastViewKey = '';
    render();
    if (cfg.startupFiles && cfg.startupFiles.length) loadPaths(cfg.startupFiles);
  }).catch(reportError);

  /* exposed for tests and the screenshot script */
  window.PDFuDebug = { state: S, render: render, loadPaths: loadPaths };
})();
