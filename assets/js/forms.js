/* Shared Formspree handling. An email draft is not a confirmed submission. */
(function () {
  "use strict";
  var CFG = window.OJ_CONFIG || {};
  var toastTimer;

  function toast(msg) {
    var t = document.getElementById("toast");
    if (!t) return;
    t.querySelector("#toastMsg, span").textContent = msg;
    t.classList.add("is-visible");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.classList.remove("is-visible"); }, 8000);
  }

  function serialize(form) {
    var data = Object.create(null);
    // FormData honours disabled fields, unchecked controls and repeated names.
    new FormData(form).forEach(function (value, name) {
      if (typeof value !== "string") return;
      data[name] = name in data ? [].concat(data[name], value) : value;
    });
    return data;
  }

  function mailtoFallback(data, subject) {
    var lines = [subject, ""];
    Object.keys(data).forEach(function (key) {
      if (data[key] && key.charAt(0) !== "_") {
        var label = key.replace(/_/g, " ").replace(/^\w/, function (c) { return c.toUpperCase(); });
        lines.push(label + ": " + data[key]);
      }
    });
    window.location.href = "mailto:" + (CFG.email || "oj.oyesola@gmail.com") +
      "?subject=" + encodeURIComponent(subject) + "&body=" + encodeURIComponent(lines.join("\n"));
  }

  function handle(form, successPanel, subject, fallbackNote) {
    var sending = false;
    form.addEventListener("submit", async function (e) {
      e.preventDefault();
      if (sending) return;
      if (!form.checkValidity()) { form.reportValidity(); return; }
      var data = serialize(form);
      var id = (CFG.formspreeId || "").trim();
      if (!id) {
        toast(fallbackNote || "Your email app is opening. Please send the draft to complete your submission.");
        mailtoFallback(data, subject);
        return;
      }

      var btn = form.querySelector('button[type="submit"]');
      var label = btn ? btn.innerHTML : "";
      var controller = new AbortController();
      var timeout = setTimeout(function () { controller.abort(); }, 20000);
      sending = true;
      form.setAttribute("aria-busy", "true");
      if (btn) { btn.disabled = true; btn.textContent = "Sending…"; }
      try {
        var res = await fetch("https://formspree.io/f/" + encodeURIComponent(id), {
          method: "POST",
          headers: { "Content-Type": "application/json", "Accept": "application/json" },
          body: JSON.stringify(Object.assign(data, { _subject: subject })),
          signal: controller.signal
        });
        if (!res.ok) throw new Error("Formspree " + res.status);
        form.hidden = true;
        if (successPanel) {
          successPanel.hidden = false;
          successPanel.focus();
        }
        form.dispatchEvent(new CustomEvent("oj:form-success"));
      } catch (err) {
        toast("Delivery wasn't confirmed. Retry, or send the draft in your email app. Your details are still here.");
        mailtoFallback(data, subject);
      } finally {
        clearTimeout(timeout);
        sending = false;
        form.removeAttribute("aria-busy");
        if (btn) { btn.disabled = false; btn.innerHTML = label; }
      }
    });
  }

  window.OJForms = { handle: handle };
})();
