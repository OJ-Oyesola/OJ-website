/* OJ_Oyesola — contract page: typed-signature preview + form wiring */
(function () {
  "use strict";
  document.addEventListener("DOMContentLoaded", function () {
    /* Live signature preview in the handwriting font. */
    var input = document.getElementById("c-sig");
    var preview = document.getElementById("sigPreview");
    if (input && preview) {
      input.addEventListener("input", function () {
        preview.textContent = input.value;
      });
    }

    var form = document.getElementById("contractForm");
    if (form && window.OJForms) {
      window.OJForms.handle(
        form,
        document.getElementById("contractSuccess"),
        "Signed Photography Service Agreement — OJ_Oyesola",
        "Your email app is opening with the agreement. Please send the draft to submit your signature."
      );
    }

  });
})();
