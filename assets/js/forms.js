/* ==========================================================================
   OJ_Oyesola — shared form handling (Formspree + graceful fallback)
   Used by index.html (booking) and contract.html (agreement).
   ========================================================================== */
(function () {
  "use strict";
  var CFG = window.OJ_CONFIG || {};

  var toastTimer = null;
  function toast(msg) {
    var t = document.getElementById("toast");
    if (!t) return;
    t.querySelector("#toastMsg, span").textContent = msg;
    t.classList.add("is-visible");
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.classList.remove("is-visible"); }, 5600);
  }

  function serialize(form) {
    var data = {};
    Array.prototype.forEach.call(form.querySelectorAll("input, select, textarea"), function (el) {
      if (!el.name || el.name.charAt(0) === "_") return;
      if (el.type === "checkbox" || el.type === "radio") {
        if (el.checked) data[el.name] = el.value;
        return;
      }
      if (el.type === "submit" || el.type === "button") return;
      if (el.type !== "file") data[el.name] = el.value;
    });
    return data;
  }

  function mailtoFallback(data, subject) {
    var lines = [subject, ""];
    Object.keys(data).forEach(function (k) {
      if (data[k]) {
        var label = k.replace(/_/g, " ").replace(/^\w/, function (c) { return c.toUpperCase(); });
        lines.push(label + ": " + data[k]);
      }
    });
    window.location.href = "mailto:" + (CFG.email || "oj.oyesola@gmail.com") +
      "?subject=" + encodeURIComponent(subject) +
      "&body=" + encodeURIComponent(lines.join("\n"));
  }

  function handle(form, successPanel, subject, fallbackNote) {
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      if (!form.checkValidity()) { form.reportValidity(); return; }
      var data = serialize(form);
      var id = (CFG.formspreeId || "").trim();
      var btn = form.querySelector('button[type="submit"]');
      var btnLabel = btn ? btn.innerHTML : "";

      if (id) {
        if (btn) { btn.disabled = true; btn.textContent = "Sending…"; }
        fetch("https://formspree.io/f/" + id, {
          method: "POST",
          headers: { "Content-Type": "application/json", "Accept": "application/json" },
          body: JSON.stringify(Object.assign({ _subject: subject }, data))
        }).then(function (res) {
          if (res.ok) { form.hidden = true; if (successPanel) successPanel.hidden = false; }
          else throw new Error("Formspree " + res.status);
        }).catch(function () {
          toast("Couldn't send right now — opening your email app instead.");
          mailtoFallback(data, subject);
        }).finally(function () {
          if (btn) { btn.disabled = false; btn.innerHTML = btnLabel; }
        });
      } else {
        mailtoFallback(data, subject);
        toast(fallbackNote);
        form.hidden = true;
        if (successPanel) successPanel.hidden = false;
      }
    });
  }

  window.OJForms = { handle: handle, toast: toast };
})();
