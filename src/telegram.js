// Inside a Telegram Mini App: the game takes the whole height, Telegram's Back button works, and the save is
// also kept in Telegram's CloudStorage (per user, on Telegram's servers, the same on every device), because a
// Telegram client may clear the webview's localStorage. Outside Telegram none of this does anything.

const KEY = "tamquoc";
const LIMIT = 4096;                                  // the most characters CloudStorage takes in one value
const tg = () => globalThis.Telegram?.WebApp;        // looked up each time: tests put a fake one there

/** In a Telegram Mini App that has CloudStorage (Bot API 6.9+)? */
export const inTelegram = () => { const t = tg(); return !!(t?.initData && t.CloudStorage && (t.isVersionAtLeast?.("6.9") ?? true)) };

/** Set the Mini App up; `onBack` runs when Telegram's Back button is pressed. */
export function telegramInit(onBack) {
  const t = tg();
  if (!t?.initData) return;
  t.ready(); t.expand();
  t.disableVerticalSwipes?.();                       // a swipe down is a scroll here, not "close the game"
  try { t.setHeaderColor?.("#1c120c"); t.setBackgroundColor?.("#0d0806") } catch { /* older clients */ }
  if (t.BackButton) { t.BackButton.onClick(onBack); t.BackButton.show() }
}

const call = (fn, ...args) => new Promise((ok, fail) => tg().CloudStorage[fn](...args, (err, res) => (err ? fail(err) : ok(res))));

/** The save text kept in Telegram, or null: none, not in Telegram, an error, or no answer within `ms`. */
export async function cloudLoad(ms = 2500) {
  if (!inTelegram()) return null;
  try { return (await Promise.race([call("getItem", KEY), new Promise((ok) => setTimeout(ok, ms, null))])) || null } catch { return null }
}
/** Keep the save text in Telegram. False when it wasn't kept. */
export async function cloudSave(text) {
  // ponytail: one value, 4096 characters; a full roster's save is about 1500. If saves grow, cut them into pieces
  // (save_0..save_n plus a count), as game/src/meta/cloud.js does.
  if (!inTelegram() || text.length > LIMIT) return false;
  try { await call("setItem", KEY, text); return true } catch { return false }
}
export async function cloudClear() {
  if (!inTelegram()) return false;
  try { await call("removeItem", KEY); return true } catch { return false }
}

/** A yes/no question: Telegram's own popup inside Telegram (some clients show no window.confirm), the browser's outside. */
export const ask = (text) => (tg()?.initData && tg().showConfirm ? new Promise((ok) => tg().showConfirm(text, ok)) : Promise.resolve(confirm(text)));
