/* gas-bridge.js
 * Pengganti google.script.run agar index.html bisa jalan di Cloudflare Pages
 * dan tetap memanggil fungsi di Google Apps Script lewat HTTP (fetch).
 */
(function () {
  var GAS_URL = "https://script.google.com/macros/s/AKfycbwDIGxJ7vIQPsb3Xz-5Ci-HEQruDQLrbYlvbnknr3pF91VnldaOzqKgoURnJv0nYGA/exec";

  function makeRunner(onOk, onFail) {
    var runner = {
      withSuccessHandler: function (fn) { return makeRunner(fn, onFail); },
      withFailureHandler: function (fn) { return makeRunner(onOk, fn); },
      withUserObject: function () { return runner; }
    };
    return new Proxy(runner, {
      get: function (target, name) {
        if (name in target) return target[name];
        if (typeof name !== "string") return undefined;
        return function () {
          var args = Array.prototype.slice.call(arguments);
          fetch(GAS_URL, {
            method: "POST",
            // text/plain = "simple request", tidak memicu preflight CORS
            headers: { "Content-Type": "text/plain;charset=utf-8" },
            body: JSON.stringify({ fn: name, args: args }),
            redirect: "follow"
          })
            .then(function (r) { return r.json(); })
            .then(function (res) {
              if (res && res.ok) { if (onOk) onOk(res.result); }
              else { throw new Error((res && res.error) || "Server error"); }
            })
            .catch(function (err) {
              if (onFail) onFail(err);
              else console.error("[GAS] " + name + " gagal:", err);
            });
        };
      }
    });
  }

  window.google = window.google || {};
  window.google.script = { run: makeRunner(null, null) };
})();

