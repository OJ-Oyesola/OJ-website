/* ==========================================================================
   OJ_Oyesola — site configuration
   --------------------------------------------------------------------------
   Edit the values below and everything on the site updates.
     formspreeId : create a free form at https://formspree.io → copy the ID
                 from your endpoint (https://formspree.io/f/<THIS-PART>).
                 Until it is set, the booking + contract forms gracefully
                 fall back to opening a pre-filled email.
   whatsapp    : international format, digits only.
   instagram   : handle WITHOUT the @ (leave "" to hide the links).
   ========================================================================== */
window.OJ_CONFIG = {
  formspreeId: "xnpqbjky",
  email: "oj.oyesola@gmail.com",
  phoneDisplay: "+234 706 584 8333",
  whatsapp: "2347065848333",
  instagram: "oj_oyesola",
  salt: "f90fab92741ea744b18d7471c6ad555e"
};

/* Shared contact links and footer date; keep page scripts focused on behaviour. */
document.addEventListener("DOMContentLoaded", function () {
  "use strict";
  var cfg = window.OJ_CONFIG;
  document.querySelectorAll("[data-email]").forEach(function (link) {
    link.href = "mailto:" + cfg.email;
    if (link.hasAttribute("data-email-text")) link.textContent = cfg.email;
  });
  document.querySelectorAll("[data-phone]").forEach(function (link) {
    link.href = "https://wa.me/" + cfg.whatsapp;
    if (link.hasAttribute("data-phone-text")) link.textContent = cfg.phoneDisplay;
  });
  document.querySelectorAll("[data-ig]").forEach(function (link) {
    link.href = cfg.instagram ? "https://instagram.com/" + encodeURIComponent(cfg.instagram) : "#";
    link.hidden = !cfg.instagram;
  });
  document.querySelectorAll("[data-ig-text]").forEach(function (el) {
    el.textContent = cfg.instagram ? "@" + cfg.instagram : "";
  });
  var row = document.getElementById("igContactRow");
  if (row) row.hidden = !cfg.instagram;
  var year = document.getElementById("year");
  if (year) year.textContent = new Date().getFullYear();
});
