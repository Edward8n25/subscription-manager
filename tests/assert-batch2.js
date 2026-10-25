/* 批次 2 · 零风险项修复断言（静态分析；smoke 层盲区的补位，规范 §16）
   覆盖：W-02 seed.html 迁 tests/ + 守卫 + 相对路径 / W-03 apple-touch-icon PNG /
        A-01 去 user-scalable=no / J-02 编辑弹窗关闭入口 / J-05 toast 计时器 / J-07 cal-tab 双绑
   断言先行：未修复代码上必须失败（反向验证态），修复后全绿。
   用法：node tests/assert-batch2.js */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const read = p => { try { return fs.readFileSync(path.join(ROOT, p), 'utf8'); } catch (e) { return null; } };
const indexHtml = read('index.html') || '';
const app = read('src/app.js') || '';
const seedHtml = read(path.join('tests', 'seed.html'));

const results = [];
const t = (name, ok, detail) => results.push([name, ok, detail || '']);

// ---- W-02 · seed.html 归位 tests/ + 执行守卫 + 相对路径 ----
t('W-02a seed.html 已迁至 tests/（根目录不再有）', seedHtml !== null && !fs.existsSync(path.join(ROOT, 'seed.html')));
t('W-02b seed.html 带 ?run=1 执行守卫（默认不灌库）', !!seedHtml && /run=1/.test(seedHtml) && seedHtml.indexOf('location.search') >= 0);
t('W-02c seed.html 跳转为相对路径 ../index.html（tests/ 子目录出发）', !!seedHtml && seedHtml.indexOf("'../index.html") >= 0 && seedHtml.indexOf("'/index.html") < 0 && seedHtml.indexOf('"/index.html') < 0);

// ---- W-03 · apple-touch-icon 必须指 PNG（iOS 不支持 SVG）----
const ati = indexHtml.match(/<link[^>]*apple-touch-icon[^>]*>/);
t('W-03 apple-touch-icon 指向 PNG', !!ati && /\.png/.test(ati[0]) && !/\.svg/.test(ati[0]));

// ---- A-01 · viewport 禁 user-scalable=no ----
const vp = indexHtml.match(/<meta[^>]*viewport[^>]*>/);
t('A-01 viewport 无 user-scalable=no', !!vp && vp[0].indexOf('user-scalable') < 0);

// ---- J-02 · 编辑态弹窗必须自带关闭入口 ----
// openEditForm 的 modal-actions：qt-del（编辑态删除按钮）出现处的前文必须已有取消按钮（无条件渲染）
const delIdx = app.indexOf('qt-del');
const beforeDel = delIdx >= 0 ? app.slice(Math.max(0, delIdx - 200), delIdx) : '';
t('J-02 编辑态 modal-actions 含取消按钮（ghost + 取消）', delIdx >= 0 && beforeDel.indexOf('取消') >= 0 && beforeDel.indexOf('btn ghost') >= 0);

// ---- J-05 · toast 单 timer 互踩：每条自持 timer + 新 toast 清旧条 ----
t('J-05a toast 不再依赖模块级单 toastTimer', app.indexOf('var toastTimer') < 0);
t('J-05b toast 内自持 setTimeout（闭包 timer）', /function toast\(msg, type\) \{[\s\S]*?var timer = setTimeout/.test(app));
t('J-05c 新 toast 出现时清理容器内旧条（单例语义）', /function toast\(msg, type\) \{[\s\S]*?c\.innerHTML\s*=\s*''/.test(app));

// ---- J-07 · cal-tab 补绑竞态：废除 setTimeout 补绑，改渲染期绑定 ----
t('J-07a renderCalendar 不再用 setTimeout 补绑', !/setTimeout\(function \(\) \{\s*var tabs/.test(app));
t('J-07b 日历事件绑定收敛为 bindCalendarEvents 且渲染期调用', /function bindCalendarEvents\(/.test(app) && (app.match(/bindCalendarEvents\(\)/g) || []).length >= 2);

// ---- U-08 · 死 CSS 不复活（style-consistency 死 CSS=0 的显式清单版）----
// .hidden 于批次 7 合法复活（设置弹窗 file input 隐藏有真实引用，由 style-consistency 无死 CSS 检查守护），移出清单
const styleBlock = indexHtml.slice(indexHtml.indexOf('<style>') + 7, indexHtml.indexOf('</style>'));
const deadFive = ['expiring-soon', 'field-error', 'value.lg', 'toast .close'];
const survived = deadFive.filter(sel => styleBlock.indexOf(sel) >= 0);
t('U-08 死 CSS 选择器已清除（.hidden 已合法复活不在此列）', survived.length === 0, '残留: ' + survived.join('  '));

let pass = 0;
results.forEach(([name, ok, detail]) => {
  console.log((ok ? '✅' : '❌') + ' ' + name + (detail ? '   → ' + detail : ''));
  if (ok) pass++;
});
console.log('\n' + pass + '/' + results.length + ' 通过');
process.exit(pass === results.length ? 0 : 1);
