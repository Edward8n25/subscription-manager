/* 批次 4 · Service Worker 策略断言（静态分析）
   覆盖：W-01 cache-first → network-first 重写 / CACHE bump / W-04 预缓存补 PNG 图标
   局限（如实记录）：SW 行为需真实 Service Worker 环境，静态断言只锁策略结构；
   断网兜底与发版生效的实测归发布前 §7.4 上线核验清单。
   用法：node tests/assert-batch4.js */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const sw = fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8');

const results = [];
const t = (name, ok, detail) => results.push([name, ok, detail || '']);

// ---- W-01 · 禁 cache-first，改 network-first ----
t('W-01a CACHE 名随策略变更 bump（subtrack-v2）', /const CACHE = 'subtrack-v2'/.test(sw), (sw.match(/const CACHE = '[^']+'/) || [''])[0]);
t('W-01b 不再 cache-first（命中缓存即返回的模式已移除）', !/caches\.match\(req\)\s*\.then\(\s*\(cached\)\s*=>\s*\{\s*if \(cached\) return cached;/.test(sw));
t('W-01c fetch 以网络优先开场（respondWith 内先行 fetch(req)）', /respondWith\(\s*(?:\/\/[^\n]*\n\s*)*fetch\(req\)/.test(sw));
t('W-01d 仅 res.ok 且同源才写缓存', /res\.ok[\s\S]{0,220}caches\.open\(CACHE\)/.test(sw));
t('W-01e 导航请求不写缓存（发版后 HTML 不回填旧版）', /mode !== 'navigate'/.test(sw) || /req\.mode[^;]*navigate/.test(sw));
t('W-01f 失败回退：先查缓存，兜底 index.html', /catch\(\(\) =>[\s\S]{0,200}caches\.match\(req\)[\s\S]{0,120}caches\.match\('\.\/index\.html'\)/.test(sw));

// ---- W-04 · 预缓存清单补 PNG ----
t('W-04 ASSETS 预缓存含 icon-192.png 与 icon-512.png', sw.indexOf('icon-192.png') >= 0 && sw.indexOf('icon-512.png') >= 0);

// ---- 文档一致性 ----
t('DOC sw.js 头注释与实际策略一致（不再自称 offline-first）', sw.indexOf('offline-first') < 0 && /network-first/i.test(sw));

// ---- 上线核验补断言（2026-10-25 线上发现，盘点漏网项）----
// SW-REG: sw.js 从未被注册（index.html/app.js 无 register 调用）→ 离线从未生效
const app = fs.readFileSync(path.join(ROOT, 'src', 'app.js'), 'utf8');
t('SW-REG app.js 注册 Service Worker（register sw.js，file:// 除外）', /serviceWorker\.register\('sw\.js'\)/.test(app));
// SW-SCOPE: GitHub Pages 项目站共享 origin——activate 清理必须只删自己前缀的缓存，
// 否则会删掉同 origin 其他项目（如 quit-tracker）的缓存，反之亦然
t('SW-SCOPE activate 清理限定 subtrack- 前缀（同源共存不互删）', /k\.startsWith\('subtrack-'\) && k !== CACHE/.test(sw));

let pass = 0;
results.forEach(([name, ok, detail]) => {
  console.log((ok ? '✅' : '❌') + ' ' + name + (detail ? '   → ' + detail : ''));
  if (ok) pass++;
});
console.log('\n' + pass + '/' + results.length + ' 通过');
process.exit(pass === results.length ? 0 : 1);
