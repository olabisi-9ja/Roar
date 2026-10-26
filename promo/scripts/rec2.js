// node rec2.js <out> <scene> [camfile] ; records phone viewport via screenshot loop with timestamps
const { chromium } = require('playwright'); const fs = require('fs'); const { execFileSync } = require('child_process');
const [out, sceneName, cam] = process.argv.slice(2);
const scenes = require('./scenes2.js');
(async () => {
  const args = ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream', '--autoplay-policy=no-user-gesture-required'];
  if (cam) args.push(`--use-file-for-fake-video-capture=${cam}`);
  const b = await chromium.launch({ args });
  const desk = !!process.env.DESK; const [au, ap] = fs.readFileSync(process.env.ADMIN_AUTH_FILE || __dirname + '/.adminauth', 'utf8').split(':');
  const ctx = await b.newContext(desk ? { viewport: { width: 1600, height: 900 }, deviceScaleFactor: 1.2, httpCredentials: { username: au, password: ap } } : { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, permissions: ['camera', 'microphone'] });
  await ctx.addInitScript(() => { const st = () => { const s = document.createElement('style'); s.textContent = 'nextjs-portal{display:none!important}'; document.documentElement.appendChild(s); }; if (document.documentElement) st(); else document.addEventListener('DOMContentLoaded', st); });
  const p = await ctx.newPage();
  const dir = `rec/${out}`; fs.rmSync(dir, { recursive: true, force: true }); fs.mkdirSync(dir, { recursive: true });
  let on = false, n = 0; const ts = [];
  const loop = (async () => { while (true) { if (on) { const t = Date.now(); try { await p.screenshot({ type: 'jpeg', quality: 90, path: `${dir}/${String(n).padStart(5, '0')}.jpg`, timeout: 5000 }); ts.push(t); n++; } catch {} } else await new Promise(r => setTimeout(r, 30)); if (on === null) break; } })();
  const ctl = { start: () => { on = true; }, stop: () => { on = false; }, log: console.log };
  await scenes[sceneName](p, ctl);
  on = null; await loop; await b.close();
  let list = ''; for (let i = 0; i < ts.length; i++) { const d = i + 1 < ts.length ? (ts[i + 1] - ts[i]) / 1000 : 0.1; list += `file '${String(i).padStart(5, '0')}.jpg'\nduration ${d.toFixed(3)}\n`; }
  list += `file '${String(ts.length - 1).padStart(5, '0')}.jpg'\n`; fs.writeFileSync(`${dir}/list.txt`, list);
  execFileSync('ffmpeg', ['-v', 'error', '-y', '-f', 'concat', '-safe', '0', '-i', `${dir}/list.txt`, '-vf', 'fps=30,format=yuv420p', '-c:v', 'libx264', '-crf', '16', `rec/${out}.mp4`]);
  console.log(out, ts.length, 'frames', ((ts.at(-1) - ts[0]) / 1000).toFixed(1) + 's');
})();
