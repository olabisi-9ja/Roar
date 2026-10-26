// Records the SOS round trip: fan phone and control room at the same time, each as its own video.
const { chromium } = require('playwright'); const fs = require('fs'); const { execFileSync } = require('child_process');
const [au, ap] = fs.readFileSync(process.env.ADMIN_AUTH_FILE || __dirname + '/.adminauth', 'utf8').split(':');
const W = 'http://localhost:3001', A = 'http://localhost:3000';
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
function recorder(page, name) {
  const dir = `rec/${name}`; fs.rmSync(dir, { recursive: true, force: true }); fs.mkdirSync(dir, { recursive: true });
  let on = false, done = false, n = 0; const ts = [];
  const loop = (async () => { while (!done) { if (on) { const t = Date.now(); try { await page.screenshot({ type: 'jpeg', quality: 90, path: `${dir}/${String(n).padStart(5, '0')}.jpg`, timeout: 5000 }); ts.push(t); n++; } catch {} } else await wait(30); } })();
  return {
    start: () => { on = true; },
    async finish() {
      done = true; await loop;
      let list = ''; for (let i = 0; i < ts.length; i++) { const d = i + 1 < ts.length ? (ts[i + 1] - ts[i]) / 1000 : 0.1; list += `file '${String(i).padStart(5, '0')}.jpg'\nduration ${d.toFixed(3)}\n`; }
      list += `file '${String(ts.length - 1).padStart(5, '0')}.jpg'\n`; fs.writeFileSync(`${dir}/list.txt`, list);
      execFileSync('ffmpeg', ['-v', 'error', '-y', '-f', 'concat', '-safe', '0', '-i', `${dir}/list.txt`, '-vf', 'fps=30,format=yuv420p', '-c:v', 'libx264', '-crf', '16', `rec/${name}.mp4`]);
      console.log(name, ts.length, 'frames', ((ts.at(-1) - ts[0]) / 1000).toFixed(1) + 's', 'started', new Date(ts[0]).toISOString());
    },
  };
}
const hide = () => { const st = () => { const s = document.createElement('style'); s.textContent = 'nextjs-portal{display:none!important}'; document.documentElement.appendChild(s); }; if (document.documentElement) st(); else document.addEventListener('DOMContentLoaded', st); };
(async () => {
  const b = await chromium.launch();
  const fanCtx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const roomCtx = await b.newContext({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1.5, httpCredentials: { username: au, password: ap } });
  await fanCtx.addInitScript(hide); await roomCtx.addInitScript(hide);
  const fan = await fanCtx.newPage(), room = await roomCtx.newPage();
  await fan.goto(W + '/sos', { waitUntil: 'networkidle', timeout: 90000 }); await wait(1500);
  await room.goto(A + '/incidents', { waitUntil: 'networkidle', timeout: 90000 }); await wait(1000);
  const rf = recorder(fan, 'sos2_fan'), rr = recorder(room, 'sos2_room');
  rf.start(); await wait(1000);
  const hb = await fan.getByRole('button', { name: /Hold for 2 seconds/ }).boundingBox();
  await fan.mouse.move(hb.x + hb.width / 2, hb.y + hb.height / 2); await fan.mouse.down(); await wait(2500); await fan.mouse.up();
  await fan.getByText("What's happening?").waitFor(); await wait(700);
  await fan.getByRole('radio', { name: 'Medical' }).click(); await wait(300);
  await fan.getByLabel('Your section').pressSequentially('112', { delay: 110 }); await fan.getByLabel('Your row').pressSequentially('14', { delay: 110 });
  await fan.getByPlaceholder(/Describe/).pressSequentially('Man collapsed in row 14, not responding', { delay: 40 }); await wait(500);
  await fan.getByRole('button', { name: 'Send report' }).click();
  await fan.getByText('Report received').waitFor(); await wait(1500);
  // Control room: the report arrives
  await room.reload({ waitUntil: 'networkidle' }); rr.start(); await wait(2500);
  const card = room.locator('article', { hasText: 'Man collapsed' }).first();
  await card.getByRole('button', { name: 'Mark acknowledged' }).hover(); await wait(500);
  await card.getByRole('button', { name: 'Mark acknowledged' }).click(); await wait(2500);
  await card.getByRole('button', { name: 'Mark assigned' }).hover(); await wait(500);
  await card.getByRole('button', { name: 'Mark assigned' }).click(); await wait(2500);
  // Fan phone flips to "Help is on the way" on its next poll
  await fan.getByText('Help is on the way').waitFor({ timeout: 15000 }); await wait(3500);
  await rr.finish(); await rf.finish();
  console.log('fan screen:', (await fan.evaluate(() => document.body.innerText)).slice(0, 260).replace(/\n+/g, ' | '));
  await b.close();
})();
