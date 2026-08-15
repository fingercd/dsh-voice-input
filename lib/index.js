/**
 * dsh-voice-input — host (node) half.
 *
 * Pure UI plugin: the empty apply exists so the plugin appears in the host
 * cordis.yml / Loader (which is what `dsh-client-modules` scans to serve the
 * browser bundle); the browser half ships via exports["./client"], discovered
 * through the package.json `dsh.client` declaration.
 *
 * Optional host-side config (cordis.patch.yml row `config`):
 *   funasrUrl: string  — default FunASR websocket endpoint the browser half
 *                        falls back to when Web Speech API is unavailable.
 * The browser half reads this through window.__DSH_BOOT__? No — it reads its
 * own localStorage override first, then this static default. Keep host
 * behavior zero so the plugin stays trivially unloadable.
 */
function apply() {}

export { apply };
