(function exposeAudioRuntime(root) {
  async function ensureAudioContextRunning(context) {
    if (!context) throw new Error("AudioContext fehlt");
    if (context.state === "suspended") await context.resume();
    if (context.state !== "running") throw new Error(`AudioContext ist ${context.state}`);
    return context;
  }

  const api = { ensureAudioContextRunning };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (root) root.KlartextAudioRuntime = api;
})(typeof window !== "undefined" ? window : null);
