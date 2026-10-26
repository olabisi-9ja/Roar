const W = 'http://localhost:3001';
const wait = (p, ms) => p.waitForTimeout(ms);
async function enter(p, path) { await p.goto(W + path, { waitUntil: 'networkidle', timeout: 90000 }); await wait(p, 1500); }
module.exports = {
  probe: async (p, c) => { await enter(p, '/capture'); c.start(); await wait(p, 1500); c.stop(); c.log(p.url(), await p.evaluate(() => document.body.innerText.slice(0, 400))); },
};
module.exports.capture = async (p, c) => {
  await enter(p, '/capture');
  await p.getByRole('button', { name: 'Open camera' }).click();
  await p.waitForSelector('main.cam video'); await wait(p, 1500);
  c.start(); await wait(p, 1200);
  await p.getByRole('button', { name: 'Start recording' }).click(); await wait(p, 5000);
  await p.getByRole('button', { name: 'Stop recording' }).click();
  await p.getByText('Share with').waitFor(); await wait(p, 1800);
  const t0 = Date.now();
  await p.getByRole('button', { name: /Send to Roar/ }).click();
  for (let i = 0; i < 90; i++) { await wait(p, 1000); const txt = await p.evaluate(() => document.body.innerText); if (/Your clip is saved/.test(txt)) { c.log('done after', (Date.now() - t0) / 1000, 's'); break; } }
  await wait(p, 3500); c.stop();
  c.log(await p.evaluate(() => document.body.innerText.slice(0, 600)));
};
const A = 'http://localhost:3000';
async function smoothScroll(p, dy, ms = 900) { await p.evaluate(async ([dy, ms]) => { const s = document.scrollingElement; const a = s.scrollTop; const t0 = performance.now(); await new Promise(r => { const f = () => { const t = Math.min(1, (performance.now() - t0) / ms); const e = t < .5 ? 4*t*t*t : 1 - Math.pow(-2*t+2, 3)/2; s.scrollTop = a + dy * e; t < 1 ? requestAnimationFrame(f) : r(); }; f(); }); }, [dy, ms]); }
module.exports.sos = async (p, c) => {
  await enter(p, '/sos'); c.start(); await wait(p, 1200);
  const b = p.getByRole('button', { name: /Hold for 2 seconds/ }); const box = await b.boundingBox();
  await p.mouse.move(box.x + box.width / 2, box.y + box.height / 2); await p.mouse.down(); await wait(p, 2600); await p.mouse.up();
  await p.getByText("What's happening?").waitFor(); await wait(p, 900);
  await p.getByRole('radio', { name: 'Crowding' }).click(); await wait(p, 500);
  await p.getByLabel('Your section').pressSequentially('112', { delay: 120 }); await p.getByLabel('Your row').pressSequentially('14', { delay: 120 });
  await p.getByPlaceholder(/Describe/).pressSequentially('Crush at the front by gate C, people falling', { delay: 45 }); await wait(p, 700);
  await p.getByRole('button', { name: 'Send report' }).click(); await wait(p, 4000); c.stop();
  c.log(await p.evaluate(() => document.body.innerText.slice(0, 300)));
};
module.exports.feed = async (p, c) => {
  await enter(p, '/live'); await wait(p, 2500); c.start(); await wait(p, 2500);
  for (let i = 0; i < 3; i++) { await p.evaluate(async () => { const s = document.querySelector('.feed'); if (s) s.scrollBy({ top: s.clientHeight, behavior: 'smooth' }); }); await wait(p, 3000); }
  c.stop();
};
module.exports.home = async (p, c) => { await enter(p, '/home'); c.start(); await wait(p, 2000); await smoothScroll(p, 520, 1600); await wait(p, 2000); c.stop(); };
module.exports.adminOverview = async (p, c) => { await p.goto(A + '/', { waitUntil: 'networkidle', timeout: 90000 }); await wait(p, 1500); c.start(); await wait(p, 4000); c.stop(); };
module.exports.adminCurate = async (p, c) => {
  await p.goto(A + '/curate', { waitUntil: 'networkidle', timeout: 90000 }); await wait(p, 2500); c.start(); await wait(p, 2500);
  const pub = p.getByRole('button', { name: 'Publish', exact: true }).first();
  await pub.scrollIntoViewIfNeeded(); await wait(p, 600); await pub.hover(); await wait(p, 600); await pub.click(); await wait(p, 3500); await smoothScroll(p, 700, 1500); await wait(p, 2000); c.stop();
};
module.exports.adminIncidents = async (p, c) => {
  await p.goto(A + '/incidents', { waitUntil: 'networkidle', timeout: 90000 }); await wait(p, 1500); c.start(); await wait(p, 3000);
  const b = p.getByRole('button', { name: 'Mark assigned' }).first(); await b.hover(); await wait(p, 700); await b.click(); await wait(p, 3000); c.stop();
};
