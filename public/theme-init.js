try {
  const theme = localStorage.getItem("klartext.theme");
  if (theme === "dark" || (!theme && matchMedia("(prefers-color-scheme: dark)").matches)) {
    document.documentElement.dataset.theme = "dark";
  }
} catch {
  // Storage may be disabled. The CSS system preference remains the fallback.
}
