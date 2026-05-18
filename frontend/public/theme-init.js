(function () {
  try {
    var theme = localStorage.getItem("theme");
    var prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    var shouldBeDark = theme === "dark" || (theme !== "light" && prefersDark);
    var root = document.documentElement;
    if (shouldBeDark) {
      root.classList.add("dark");
      root.classList.remove("light");
    } else {
      root.classList.add("light");
      root.classList.remove("dark");
    }
  } catch (_e) {
    /* localStorage blocked */
  }
})();
