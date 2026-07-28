(function () {
  try {
    var stored = localStorage.getItem("dahoko.theme");
    var dark =
      stored === "dark" ||
      (stored !== "light" &&
        matchMedia("(prefers-color-scheme: dark)").matches);
    document.documentElement.classList.toggle("dark", dark);
  } catch (error) {
    /* Theme falls back to light. */
  }
})();
