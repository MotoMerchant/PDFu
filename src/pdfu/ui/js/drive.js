/* =========================================================================
   FloppyDrive: drives the .pk-drive CSS (from pdfu-floppy-drive.html).
   Four calls, as in the animation spec:
     await drive.insert(fileName)   // a PDF was picked; resolves when the disk is seated
     drive.startReading()           // unlocking began: disk pulled in, drive shakes
     await drive.finish()           // unlocking succeeded: disk pops out stamped UNLOCKED
     await drive.eject()            // eject / main menu / before a new file
   All motion is CSS transitions keyed off data-phase; this only flips
   attributes on a timer. A newer call cancels the timers of an older one.
   ========================================================================= */
(function () {
  'use strict';

  function FloppyDrive(el, speed) {
    this.el = el;
    this.speed = speed || 1;
    this.el.style.setProperty('--speed', this.speed);
    this.nameEl = el.querySelector('.pk-name');
    this.run = 0;
    this.timers = [];
  }

  FloppyDrive.prototype = {
    get phase() { return this.el.dataset.phase; },
    set: function (phase) { this.el.dataset.phase = phase; },
    led: function (on) { this.el.dataset.led = on ? 'on' : 'off'; },
    clear: function () { this.timers.forEach(clearTimeout); this.timers = []; },
    wait: function (ms, run) {
      var self = this;
      return new Promise(function (resolve, reject) {
        self.timers.push(setTimeout(function () { (run === self.run ? resolve : reject)('cancelled'); }, ms / self.speed));
      });
    },
    nameSize: function (name) {
      var n = name.length;
      return n <= 13 ? 32 : n <= 20 ? 26 : n <= 30 ? 21 : 19;   // px at disk scale 1
    },
    insert: function (name) {
      var self = this;
      var start = this.phase !== 'empty' ? this.eject() : Promise.resolve();
      return start.then(function () {
        var run = ++self.run;
        self.clear();
        self.nameEl.textContent = name;
        self.nameEl.style.fontSize = self.nameSize(name) + 'px';
        self.el.dataset.unlocked = 'false';
        self.led(false);
        self.set('empty');
        void self.el.offsetWidth;                    // commit the start position before animating
        self.set('arrive');                          // slides up to the open position (label showing)
        return self.wait(480, run)
          .then(function () { self.set('label'); return self.wait(700, run); })   // name is written on the label
          .then(function () {
            self.set('seated'); self.led(true);       // waits at the open position until UNLOCK
            self.wait(600, run).then(function () { self.led(false); }, function () {});
            return true;
          }, function () { return false; });
      });
    },
    startReading: function () {
      ++this.run; this.clear();
      this.set('reading'); this.led(true);
    },
    finish: function () {
      var self = this, run = ++this.run;
      this.clear();
      this.led(false);
      this.el.dataset.unlocked = 'true';
      this.set('ejecting');                          // pops back out with a bounce
      return this.wait(360, run).then(function () { self.set('done'); }, function () {});
    },
    eject: function () {
      var self = this, run = ++this.run;
      this.clear();
      if (this.phase === 'empty') return Promise.resolve();
      this.led(false);
      this.set('removing');
      return this.wait(520, run).then(function () { self.set('empty'); self.el.dataset.unlocked = 'false'; }, function () {});
    }
  };

  window.FloppyDrive = FloppyDrive;
})();
