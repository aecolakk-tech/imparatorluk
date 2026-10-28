import { boot, sleep } from './play-lib.mjs';
const T = await boot('Balon Test', '&poll6'); await T.dismiss();
for (let i = 0; i < 40; i++) {
  const r = await T.I(() => { const S = window.__imp(); const w = S.world; const now = Date.now(); const tk = (w.talks ?? []).filter((t) => t.at && now - t.at > 7000 && now - t.at < 30000).at(-1); if (!tk) return null; const q = S.placed.find((x) => x[0] === tk.a); if (!q) return null; S.look(q[1], q[2]); return tk.a; });
  if (r) { await sleep(1500); await T.p.screenshot({ path: `/tmp/bubble-${process.env.PORT}.png` }); console.log('shot', r); break; }
  await sleep(1500);
}
console.log(T.errors.slice(0, 5)); await T.b.close();
