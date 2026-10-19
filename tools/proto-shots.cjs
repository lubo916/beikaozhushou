#!/usr/bin/env node
// 原型截图器：把原型某页（含各视图）按指定宽度截图，供 AI 和你对照。
// 用法：node tools/proto-shots.cjs S06 S18 [--views] [--widths 375,834,1280] [--exam kj] [--full]
//       node tools/proto-shots.cjs all --widths 1280      （全部页面，只截默认视图）
// 输出：.bk/proto/<页ID>/<视图>@<宽度>.png，以及 .bk/proto/index.html 画廊
const path = require('path');
const fs = require('fs');
const { execSync } = require('child_process');

function loadPlaywright() {
  const names = ['playwright', '@playwright/test'];
  for (const n of names) { try { return require(n); } catch (e) {} }
  try {
    const g = execSync('npm root -g', { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim();
    for (const n of names) { try { return require(path.join(g, n)); } catch (e) {} }
  } catch (e) {}
  console.error('找不到 playwright：先在仓库根运行 pnpm install，或 npm i -g playwright');
  process.exit(2);
}

const args = process.argv.slice(2);
const opt = { widths: [375, 1280], views: false, full: false, exam: '', out: '.bk/proto', proto: 'design/prototype/prototype.html', ids: [] };
for (let i = 0; i < args.length; i++) {
  const a = args[i];
  if (a === '--views') opt.views = true;
  else if (a === '--full') opt.full = true;
  else if (a === '--widths') opt.widths = args[++i].split(',').map(Number);
  else if (a === '--exam') opt.exam = args[++i];
  else if (a === '--out') opt.out = args[++i];
  else if (a === '--proto') opt.proto = args[++i];
  else opt.ids.push(a.toUpperCase());
}
if (!fs.existsSync(opt.proto)) { console.error('找不到原型文件：' + opt.proto); process.exit(2); }

(async () => {
  const { chromium } = loadPlaywright();
  const launch = {};
  if (process.env.BK_CHROMIUM) launch.executablePath = process.env.BK_CHROMIUM;
  const browser = await chromium.launch(launch);
  const url = 'file://' + path.resolve(opt.proto);
  const shots = [];
  for (const w of opt.widths) {
    const ctx = await browser.newContext({ viewport: { width: w, height: w < 700 ? 812 : 900 } });
    const page = await ctx.newPage();
    await page.goto(url + '#S06');
    await page.waitForTimeout(300);
    const meta = await page.evaluate(`({ names: typeof NM!=='undefined'?NM:{}, views: typeof VIEWS!=='undefined'?VIEWS:{} })`);
    let ids = opt.ids.includes('ALL') ? Object.keys(meta.names) : opt.ids;
    for (const id of ids) {
      if (!meta.names[id]) { console.error('原型里没有页面 ' + id); continue; }
      const views = opt.views && meta.views[id] ? meta.views[id].map(v => v[0]) : [''];
      for (const v of views) {
        await page.goto(url + '#' + id);
        await page.waitForTimeout(250);
        if (opt.exam) await page.evaluate(`(()=>{const s=document.querySelector('#scSel');if(s){s.value=${JSON.stringify(opt.exam)};s.dispatchEvent(new Event('change'))}})()`);
        if (v) await page.evaluate(`(()=>{const s=document.querySelector('#stSel');if(s){s.value='v:'+${JSON.stringify(v)};s.dispatchEvent(new Event('change'))}})()`);
        await page.waitForTimeout(250);
        if (opt.full) {
          await page.addStyleTag({ content: 'html,body,.stage,.frame,.app,main,.main,[class*=scroll]{height:auto!important;max-height:none!important;overflow:visible!important}' });
          await page.waitForTimeout(150);
        }
        const dir = path.join(opt.out, id);
        fs.mkdirSync(dir, { recursive: true });
        const file = path.join(dir, `${v || 'default'}@${w}.png`);
        const el = await page.$('#frame');
        if (opt.full) await page.screenshot({ path: file, fullPage: true });
        else await (el || page).screenshot({ path: file });
        shots.push({ id, name: meta.names[id], view: v || 'default', w, file: path.relative(opt.out, file) });
        console.log('已截图 ' + file);
      }
    }
    await ctx.close();
  }
  await browser.close();
  const html = `<!doctype html><meta charset="utf-8"><title>原型截图</title><style>body{font:14px system-ui;margin:16px}figure{display:inline-block;margin:8px;vertical-align:top}img{border:1px solid #ccc;max-width:420px}</style>` +
    shots.map(s => `<figure><img src="${s.file}" loading="lazy"><figcaption>${s.id} ${s.name} · ${s.view} · ${s.w}px</figcaption></figure>`).join('');
  fs.writeFileSync(path.join(opt.out, 'index.html'), html);
  console.log(`完成：${shots.length} 张，画廊 ${path.join(opt.out, 'index.html')}`);
})().catch(e => { console.error('截图失败：' + e.message); process.exit(1); });
