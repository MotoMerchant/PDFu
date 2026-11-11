/* =========================================================================
   CRT screens. Each returns HTML for #view; copy follows the build brief §4.
   Buttons carry data-action; app.js handles every click in one place.
   ========================================================================= */
(function () {
  'use strict';

  var ICONS = {
    disk: 'M0 0h15v1h-15zM0 1h1v1h-1zM3 1h9v1h-9zM14 1h2v1h-2zM0 2h1v1h-1zM3 2h2v1h-2zM9 2h3v1h-3zM14 2h2v1h-2zM0 3h1v1h-1zM3 3h2v1h-2zM9 3h3v1h-3zM14 3h2v1h-2zM0 4h1v1h-1zM3 4h2v1h-2zM9 4h3v1h-3zM14 4h2v1h-2zM0 5h1v1h-1zM3 5h9v1h-9zM14 5h2v1h-2zM0 6h1v1h-1zM14 6h2v1h-2zM0 7h1v1h-1zM2 7h11v1h-11zM14 7h2v1h-2zM0 8h1v1h-1zM2 8h1v1h-1zM12 8h1v1h-1zM14 8h2v1h-2zM0 9h1v1h-1zM2 9h1v1h-1zM4 9h7v1h-7zM12 9h1v1h-1zM14 9h2v1h-2zM0 10h1v1h-1zM2 10h1v1h-1zM12 10h1v1h-1zM14 10h2v1h-2zM0 11h1v1h-1zM2 11h1v1h-1zM4 11h7v1h-7zM12 11h1v1h-1zM14 11h2v1h-2zM0 12h1v1h-1zM2 12h1v1h-1zM12 12h1v1h-1zM14 12h2v1h-2zM0 13h1v1h-1zM2 13h1v1h-1zM12 13h1v1h-1zM14 13h2v1h-2zM0 14h16v1h-16z',
    upload: 'M7 1h2v1h-2zM6 2h4v1h-4zM5 3h6v1h-6zM4 4h8v1h-8zM3 5h10v1h-10zM2 6h12v1h-12zM6 7h4v1h-4zM6 8h4v1h-4zM6 9h4v1h-4zM0 10h2v1h-2zM6 10h4v1h-4zM14 10h2v1h-2zM0 11h2v1h-2zM14 11h2v1h-2zM0 12h2v1h-2zM14 12h2v1h-2zM0 13h16v1h-16zM0 14h16v1h-16z',
    lock: 'M5 1h6v1h-6zM4 2h8v1h-8zM3 3h3v1h-3zM10 3h3v1h-3zM3 4h2v1h-2zM11 4h2v1h-2zM3 5h2v1h-2zM11 5h2v1h-2zM3 6h2v1h-2zM11 6h2v1h-2zM1 7h14v1h-14zM1 8h14v1h-14zM1 9h6v1h-6zM9 9h6v1h-6zM1 10h5v1h-5zM10 10h5v1h-5zM1 11h6v1h-6zM9 11h6v1h-6zM1 12h6v1h-6zM9 12h6v1h-6zM1 13h14v1h-14zM1 14h14v1h-14z',
    unlock: 'M9 0h6v1h-6zM8 1h8v1h-8zM7 2h3v1h-3zM14 2h2v1h-2zM7 3h2v1h-2zM15 3h1v1h-1zM7 4h2v1h-2zM7 5h2v1h-2zM7 6h2v1h-2zM1 7h14v1h-14zM1 8h14v1h-14zM1 9h6v1h-6zM9 9h6v1h-6zM1 10h5v1h-5zM10 10h5v1h-5zM1 11h6v1h-6zM9 11h6v1h-6zM1 12h6v1h-6zM9 12h6v1h-6zM1 13h14v1h-14zM1 14h14v1h-14z',
    hourglass: 'M1 0h14v1h-14zM1 1h14v1h-14zM2 2h1v1h-1zM13 2h1v1h-1zM2 3h1v1h-1zM13 3h1v1h-1zM3 4h1v1h-1zM5 4h6v1h-6zM12 4h1v1h-1zM4 5h1v1h-1zM6 5h4v1h-4zM11 5h1v1h-1zM5 6h1v1h-1zM7 6h2v1h-2zM10 6h1v1h-1zM6 7h1v1h-1zM9 7h1v1h-1zM6 8h1v1h-1zM9 8h1v1h-1zM5 9h1v1h-1zM10 9h1v1h-1zM4 10h1v1h-1zM7 10h2v1h-2zM11 10h1v1h-1zM3 11h1v1h-1zM5 11h6v1h-6zM12 11h1v1h-1zM2 12h1v1h-1zM4 12h8v1h-8zM13 12h1v1h-1zM2 13h12v1h-12zM1 14h14v1h-14zM1 15h14v1h-14z',
    check: 'M13 2h2v1h-2zM12 3h3v1h-3zM11 4h3v1h-3zM10 5h3v1h-3zM1 6h2v1h-2zM9 6h3v1h-3zM1 7h3v1h-3zM8 7h3v1h-3zM2 8h3v1h-3zM7 8h3v1h-3zM3 9h6v1h-6zM4 10h4v1h-4zM5 11h2v1h-2z',
    folder: 'M1 2h5v1h-5zM1 3h6v1h-6zM1 4h14v1h-14zM1 5h14v1h-14zM1 6h2v1h-2zM15 6h1v1h-1zM1 7h2v1h-2zM4 7h12v1h-12zM1 8h2v1h-2zM4 8h11v1h-11zM1 9h1v1h-1zM3 9h12v1h-12zM1 10h1v1h-1zM3 10h11v1h-11zM1 11h1v1h-1zM3 11h11v1h-11zM1 12h14v1h-14zM1 13h14v1h-14z',
    warn: 'M7 0h2v1h-2zM6 1h4v1h-4zM6 2h4v1h-4zM5 3h2v1h-2zM9 3h2v1h-2zM5 4h2v1h-2zM9 4h2v1h-2zM4 5h2v1h-2zM7 5h2v1h-2zM10 5h2v1h-2zM4 6h2v1h-2zM7 6h2v1h-2zM10 6h2v1h-2zM3 7h2v1h-2zM7 7h2v1h-2zM11 7h2v1h-2zM3 8h2v1h-2zM7 8h2v1h-2zM11 8h2v1h-2zM2 9h2v1h-2zM7 9h2v1h-2zM12 9h2v1h-2zM2 10h2v1h-2zM12 10h2v1h-2zM1 11h2v1h-2zM7 11h2v1h-2zM13 11h2v1h-2zM1 12h2v1h-2zM7 12h2v1h-2zM13 12h2v1h-2zM0 13h2v1h-2zM14 13h2v1h-2zM0 14h16v1h-16zM0 15h16v1h-16z',
    key: 'M2 2h4v1h-4zM1 3h6v1h-6zM0 4h2v1h-2zM6 4h2v1h-2zM0 5h2v1h-2zM6 5h2v1h-2zM0 6h2v1h-2zM6 6h10v1h-10zM0 7h2v1h-2zM6 7h10v1h-10zM1 8h6v1h-6zM10 8h2v1h-2zM13 8h2v1h-2zM2 9h4v1h-4zM10 9h2v1h-2zM13 9h2v1h-2zM10 10h2v1h-2zM13 10h2v1h-2z'
  };
  var POINTER = 'M0 0h1v1h-1zM0 1h2v1h-2zM0 2h3v1h-3zM0 3h4v1h-4zM0 4h5v1h-5zM0 5h6v1h-6zM0 6h7v1h-7zM0 7h8v1h-8zM0 8h5v1h-5zM0 9h2v1h-2zM3 9h2v1h-2zM0 10h1v1h-1zM3 10h2v1h-2zM4 11h2v1h-2zM4 12h2v1h-2z';

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (ch) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch];
    });
  }
  function icon(name, size, extra) {
    return '<svg width="' + size + '" height="' + size + '" viewBox="0 0 16 16" aria-hidden="true"' + (extra || '') +
      '><path fill="currentColor" d="' + ICONS[name] + '"/></svg>';
  }
  function pwin(title, body, opts) {
    opts = opts || {};
    var x = opts.closeAction
      ? '<button type="button" class="pwin-x" data-action="' + opts.closeAction + '" aria-label="' + esc(opts.closeLabel || 'Close') + '">x</button>'
      : '<span class="pwin-x" aria-hidden="true">x</span>';
    return '<div class="pwin" style="width:' + (opts.width || 500) + 'px">' +
      '<div class="pwin-title"><span>' + esc(title) + '</span>' + x + '</div>' + body + '</div>';
  }

  /* Paths: DOS style, upper case, middle-shortened to fit a screen line. */
  function sep(p) { return p.indexOf('\\') >= 0 || /^[A-Za-z]:/.test(p) ? '\\' : '/'; }
  function withSlash(p) { if (!p) return ''; var s = sep(p); return p.slice(-1) === s ? p : p + s; }
  function shortPath(p, max) {
    p = withSlash(p || '');
    if (p.length <= max) return p.toUpperCase();
    var s = sep(p);
    var segs = p.split(s).filter(function (x, i) { return x !== '' || i === 0; });
    var head = segs[0] + s;            // "C:\" or "/"
    var first = 1;
    if (p.slice(0, 2) === '\\\\') { head = '\\\\' + segs[1] + s; first = 2; }   // \\SERVER\
    var tail = '';
    for (var i = segs.length - 1; i >= first; i--) {
      var next = segs[i] + s + tail;
      if ((head + '…' + s + next).length > max) break;
      tail = next;
    }
    var out;
    if (tail) {
      out = head + '…' + s + tail;                       // C:\…\2026 WAREHOUSE\DRAWINGS\
    } else {
      var last = segs[segs.length - 1] + s;
      out = ('…' + s + last).length <= max ? '…' + s + last  // …\DRAWINGS\
        : '…' + last.slice(-(max - 1));                      // …ERY LONG FOLDER NAME\
    }
    return out.toUpperCase();
  }
  function fmtSize(b) {
    if (!(b > 0)) return '';
    if (b >= 1048576) return (b / 1048576).toFixed(1) + ' MB';
    return Math.max(1, Math.round(b / 1024)) + ' KB';
  }
  function metaText(f) {
    var bits = [fmtSize(f.size_bytes), f.pages ? f.pages + ' PG' : ''].filter(Boolean);
    return bits.join(' · ');
  }
  function inLine(f) {
    var meta = metaText(f);
    var room = Math.max(12, 40 - (meta ? meta.length + 3 : 0) - 3);   // the line holds ~40 VT323 characters
    return 'IN ' + esc(shortPath(f.folder, room)) + (meta ? ' · ' + esc(meta) : '');
  }
  function yn(v) { return v ? 'YES' : 'NO'; }
  function perms(f) { return 'PRINT:' + yn(f.can_print) + ' COPY:' + yn(f.can_copy) + ' EDIT:' + yn(f.can_edit); }
  function outName(name) { return String(name || '').replace(/\.pdf$/i, '') + '_Unlocked.pdf'; }
  function nextLabel(queue) { return queue > 0 ? 'LOAD NEXT (' + queue + ')' : 'LOAD NEXT'; }

  var Screens = {
    idle: function (c) {
      return '<div class="v-col">' +
        '<button type="button" class="pwin insert" data-action="pick" aria-label="Insert PDF: drop a file or click to browse">' +
          '<div class="pwin-title"><span>INSERT PDF</span><span class="pwin-x" aria-hidden="true">x</span></div>' +
          '<div class="insert-body">' + icon('upload', 112) +
            '<div class="insert-head">' + (c.dragging ? 'RELEASE TO<br>INSERT DISK' : 'DROP FILE OR<br>INSERT DISK') + '</div>' +
            '<div class="insert-sub">CLICK TO BROWSE<span class="blink">_</span></div>' +
          '</div>' +
        '</button>' +
        (c.demo ? '<button type="button" class="sample-btn" data-action="sample">OR LOAD A SAMPLE DISK</button>' : '') +
      '</div>';
    },

    reading: function (c) {
      return '<div class="v-col" style="gap:18px;max-width:520px">' + icon('disk', 96) +
        '<div class="f-ps2p" style="font-size:15px">READING A:<span class="blink">_</span></div>' +
        '<div class="f-vt mid" style="font-size:22px;text-align:center;overflow-wrap:anywhere">' + esc(c.file.name.toUpperCase()) + '</div>' +
      '</div>';
    },

    loaded: function (c) {
      var f = c.file;
      var where = c.same
        ? '<div><span class="mid">SAVES AS </span>' + esc(outName(f.name)) + '</div>' +
          '<div class="mid">NEXT TO THE ORIGINAL IN ' + esc(shortPath(f.folder, 40)) + '</div>'
        : '<div><span class="mid">SAVES AS </span>' + esc(outName(f.name)) + '</div>' +
          '<div class="mid">YOU\'LL PICK THE FOLDER AFTER [UNLOCK]</div>';
      var notes = [];
      if (f.needed_password) notes.push('OPEN PASSWORD ACCEPTED. THE COPY WILL OPEN WITHOUT ONE.');
      if (f.signed) notes.push('NOTE: SIGNATURES IN THE COPY WILL SHOW AS INVALID.');
      return pwin('FILE LOADED',
        '<div class="pwin-body">' +
          '<div class="info-row">' + icon('lock', 80, ' style="flex:none"') +
            '<div class="info-col">' +
              '<div class="fname">' + esc(f.name) + '</div>' +
              '<div class="meta">' + inLine(f) + '</div>' +
              '<div class="tags"><span class="tag">LOCKED</span><span class="perms">' + perms(f) + '</span></div>' +
            '</div>' +
          '</div>' +
          '<div class="dash-box">' + where + '</div>' +
          (notes.length ? '<div class="note">' + notes.map(esc).join('<br>') + '</div>' : '') +
          '<div class="prompt">PRESS [UNLOCK] TO RUN<span class="blink">_</span></div>' +
        '</div>');
    },

    password: function (c) {
      var f = c.file;
      return pwin('PASSWORD REQUIRED',
        '<form class="pwin-body" data-form="password" autocomplete="off">' +
          '<div class="info-row" style="gap:20px">' + icon('key', 64, ' style="flex:none"') +
            '<div class="info-col">' +
              '<div class="fname">' + esc(f.name) + '</div>' +
              '<div class="meta">THIS FILE NEEDS A PASSWORD TO OPEN.</div>' +
            '</div>' +
          '</div>' +
          '<div class="pw-field"><label for="pwInput">PASSWORD:</label>' +
            '<input id="pwInput" class="pw-input" type="password" spellcheck="false" autocomplete="off" aria-describedby="pwNote"></div>' +
          '<div id="pwNote" class="note" aria-live="polite">' +
            (c.pw.wrong ? 'WRONG PASSWORD. TRY AGAIN.' : 'KEPT IN MEMORY FOR THIS SESSION ONLY. NEVER SAVED.') + '</div>' +
          '<div class="btn-row">' +
            '<button type="submit" class="pix-btn primary">OK</button>' +
            '<button type="button" class="pix-btn secondary" data-action="pw-skip">' + (c.queue ? 'SKIP FILE' : 'CANCEL') + '</button>' +
          '</div>' +
        '</form>', { closeAction: 'pw-skip', closeLabel: 'Cancel' });
    },

    notlocked: function (c) {
      var f = c.file;
      var msg = f.certified
        ? 'EDITING IS BLOCKED BY A CERTIFICATION SIGNATURE (A DIGITAL SEAL). THAT ISN\'T ENCRYPTION, AND PDFU DOESN\'T REMOVE IT.'
        : 'THIS PDF HAS NO RESTRICTIONS. NO COPY NEEDED.';
      return pwin('NO LOCK FOUND',
        '<div class="pwin-body">' +
          '<div class="info-row">' + icon('unlock', 80, ' style="flex:none"') +
            '<div class="info-col">' +
              '<div class="fname">' + esc(f.name) + '</div>' +
              '<div class="meta">' + inLine(f) + '</div>' +
              '<div class="tags"><span class="tag">NOT LOCKED</span><span class="perms">' + perms(f) + '</span></div>' +
            '</div>' +
          '</div>' +
          '<div class="dash-box">' + esc(msg) + '</div>' +
          '<div class="btn-row">' +
            '<button type="button" class="pix-btn primary" data-action="next">' + nextLabel(c.queue) + '</button>' +
            '<button type="button" class="pix-btn secondary" data-action="home">MAIN MENU</button>' +
          '</div>' +
        '</div>');
    },

    saveas: function (c) {
      var rows = c.choices.map(function (ch, i) {
        return '<button type="button" class="folder-row' + (i === c.sel ? ' sel' : '') + '" data-action="pick-folder" data-index="' + i + '">' +
          icon('folder', 32, ' style="flex:none"') +
          '<span class="path">' + esc(ch.browse ? 'OTHER FOLDER...' : shortPath(ch.path, 36)) + '</span>' +
          '<span class="fnote">' + esc(ch.note || '') + '</span>' +
          '<svg class="arrow" width="14" height="22" viewBox="0 0 8 13" aria-hidden="true"><path fill="currentColor" d="' + POINTER + '"/></svg>' +
        '</button>';
      }).join('');
      return pwin('WHERE SHOULD THE COPY GO?',
        '<div class="pwin-body" style="padding:14px 16px 16px;gap:8px">' +
          '<div class="f-vt mid" style="font-size:20px;padding:0 4px 4px">FILE NAME: ' + esc(outName(c.file.name)) + '</div>' +
          rows +
          '<div class="f-vt mid" style="font-size:20px;text-align:center;padding-top:4px">PICK A FOLDER TO SAVE AND UNLOCK</div>' +
        '</div>', { closeAction: 'cancel-ask', closeLabel: 'Cancel' });
    },

    unlocking: function () {
      var segs = '';
      for (var i = 0; i < 20; i++) segs += '<i></i>';
      return '<div class="v-col" style="width:480px">' + icon('hourglass', 60) +
        '<div class="f-ps2p" style="font-size:16px">UNLOCKING...</div>' +
        '<div class="progress-row"><div class="segs" id="segs">' + segs + '</div><div class="pct" id="pct">0%</div></div>' +
        '<div class="log" id="log"></div>' +
      '</div>';
    },

    done: function (c) {
      var r = c.result;
      var notes = r.signed ? '<div class="note">NOTE: SIGNATURES IN THE COPY WILL SHOW AS INVALID.</div>' : '';
      return pwin('COMPLETE',
        '<div class="pwin-body" style="padding:22px 24px;gap:20px">' +
          '<div class="info-row">' + icon('unlock', 80, ' style="flex:none"') +
            '<div class="info-col" style="gap:10px">' +
              '<div style="display:flex;align-items:center;gap:10px">' + icon('check', 28) +
                '<span class="f-ps2p" style="font-size:20px">UNLOCKED!</span></div>' +
              '<div class="meta">' + (r.same_folder ? 'SAVED NEXT TO THE ORIGINAL:' : 'SAVED A COPY TO:') + '</div>' +
              '<div class="f-ps2p" style="font-size:11px;line-height:1.7;overflow-wrap:anywhere">' +
                esc(shortPath(r.out_dir, 34)) + '<br>' + esc(r.out_name) + '</div>' +
              notes +
            '</div>' +
          '</div>' +
          '<div class="btn-row">' +
            '<button type="button" class="pix-btn primary" data-action="next">' + nextLabel(c.queue) + '</button>' +
            '<button type="button" class="pix-btn secondary" data-action="home">MAIN MENU</button>' +
          '</div>' +
        '</div>', { width: 520 });
    },

    error: function (c) {
      var f = c.file || { name: '' };
      return pwin('ERROR',
        '<div class="pwin-body">' +
          '<div class="info-row">' + icon('warn', 72, ' style="flex:none"') +
            '<div class="info-col">' +
              (f.name ? '<div class="fname">' + esc(f.name) + '</div>' : '') +
              '<div class="meta" style="color:var(--c-glow)">' + esc(c.error.message || 'SOMETHING WENT WRONG.') + '</div>' +
              '<div class="note">THE ORIGINAL FILE WAS NOT CHANGED.</div>' +
            '</div>' +
          '</div>' +
          '<div class="btn-row">' +
            '<button type="button" class="pix-btn primary" data-action="next">' + nextLabel(c.queue) + '</button>' +
            '<button type="button" class="pix-btn secondary" data-action="home">MAIN MENU</button>' +
          '</div>' +
        '</div>');
    },

    about: function (c) {
      return pwin('ABOUT PDFU',
        '<div class="pwin-body" style="gap:12px">' +
          '<div class="info-row" style="gap:20px">' + icon('disk', 64, ' style="flex:none"') +
            '<div class="info-col">' +
              '<div class="f-ps2p" style="font-size:14px">PDFU V' + esc(c.version) + '</div>' +
              '<div class="meta">MODEL PU-1 · QPDF ' + esc(c.qpdf) + ' BUILT IN</div>' +
            '</div>' +
          '</div>' +
          '<div class="dash-box">REMOVES PRINT, COPY AND EDIT RESTRICTIONS AND SAVES AN UNLOCKED COPY. THE ORIGINAL IS NEVER CHANGED.</div>' +
          '<div class="note">ONLY UNLOCK FILES YOU\'RE ALLOWED TO MODIFY.<br>KEYS: CTRL+O OPEN · ENTER UNLOCK · ESC BACK</div>' +
          '<div class="btn-row"><button type="button" class="pix-btn primary" data-action="about-close">OK</button></div>' +
        '</div>', { closeAction: 'about-close', width: 500 });
    }
  };

  /* The log lines under the progress bar; shown once the engine reports the step. */
  Screens.logLines = function (steps, shownPct, name) {
    var LINES = [
      { step: 'open', at: 0, text: '> READING ENCRYPTION DICTIONARY' },
      { step: 'restrictions', at: 25, text: '> OWNER RESTRICTIONS FOUND' },
      { step: 'password', at: 25, text: '> OPEN PASSWORD ACCEPTED' },
      { step: 'clearing', at: 45, text: '> CLEARING PERMISSION FLAGS' },
      { step: 'writing', at: 70, text: '> WRITING ' + outName(name).toUpperCase() }
    ];
    return LINES.filter(function (l) { return steps.indexOf(l.step) >= 0 && shownPct >= l.at; })
      .map(function (l) { return '<div>' + esc(l.text) + '</div>'; }).join('');
  };

  Screens.menu = function (which, c) {
    function item(action, label, opts) {
      opts = opts || {};
      var tick = opts.tick === undefined ? '' : '<span class="tick ' + (opts.tick ? 'on' : '') + '"></span>';
      return '<button type="button" role="menuitem" class="menu-item" data-action="' + action + '"' +
        (opts.value ? ' data-value="' + opts.value + '"' : '') + (opts.disabled ? ' disabled' : '') + '>' +
        tick + '<span>' + esc(label) + '</span>' + (opts.kbd ? '<span class="kbd">' + esc(opts.kbd) + '</span>' : '') + '</button>';
    }
    var sepr = '<div class="menu-sep"></div>';
    if (which === 'file') {
      return item('pick', 'OPEN PDF...', { kbd: 'CTRL+O', disabled: c.blocked }) +
        item('eject', 'EJECT DISK', { disabled: c.blocked || !c.hasDisk }) + sepr +
        item('close', 'EXIT', { kbd: 'ALT+F4' });
    }
    if (which === 'options') {
      return item('set-size', 'SIZE: SMALL', { value: 'small', tick: c.size === 'small' }) +
        item('set-size', 'SIZE: NORMAL (2X)', { value: 'normal', tick: c.size === 'normal', disabled: !c.normalAvailable }) + sepr +
        item('set-theme', 'THEME: FOLLOW WINDOWS', { value: 'auto', tick: c.themePref === 'auto' }) +
        item('set-theme', 'THEME: LIGHT', { value: 'light', tick: c.themePref === 'light' }) +
        item('set-theme', 'THEME: DARK', { value: 'dark', tick: c.themePref === 'dark' }) + sepr +
        item('set-save', 'SAVE TO: SAME FOLDER', { value: 'same', tick: c.same, disabled: c.blocked }) +
        item('set-save', 'SAVE TO: ASK EACH TIME', { value: 'ask', tick: !c.same, disabled: c.blocked });
    }
    return item('about', 'ABOUT PDFU...');
  };

  Screens.util = { esc: esc, shortPath: shortPath, outName: outName, fmtSize: fmtSize };
  window.Screens = Screens;
})();
