/* 批次 A~E · 第 2 轮盘点修复断言（静态分析；盘点报告见 .dev/盘点/03-复审第2轮_全量诊断_主报告.md）
   覆盖：N-01 热力图未来遮罩 / N-02 空态双绑定 / N-08/09/10+E-02 P3 残留 / N-06 CI 测试门 / N-15 文档精度
   断言先行：未修复代码上必须失败（反向验证态），修复后全绿。随批次增量追加。
   用法：node tests/assert-batch10.js */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const read = p => { try { return fs.readFileSync(path.join(ROOT, p), 'utf8'); } catch (e) { return null; } };
const app = read('src/app.js') || '';
const readme = read('README.md') || '';

const results = [];
const t = (name, ok, detail) => results.push([name, ok, detail || '']);
const fnBody = (name) => {
  const i = app.indexOf('function ' + name);
  if (i < 0) return null;
  const next = app.indexOf('\n  function ', i + 10);
  return app.slice(i, next < 0 ? app.length : next);
};

// ---- N-01 · 年热力图（S1）——1.2.0 契约变更：视图整体移除，改「月历 + 本月扣款摘要」----
t('N-01a 年热力图已移除（renderYearHeatmap / heat-cell 零引用）', app.indexOf('renderYearHeatmap') < 0 && app.indexOf('heat-cell') < 0);
t('N-01b 日历改「本月扣款 N 笔」摘要（替代密度图）', app.indexOf('本月扣款') >= 0 && app.indexOf('class="calsum"') >= 0);
t('N-01c README 不再宣称双视图日历（月历 + 摘要为唯一口径，移除记录保留）', readme.indexOf('双视图日历') < 0 && readme.indexOf('GitHub 贡献图风格') < 0 && readme.indexOf('本月扣款') >= 0);

// ---- N-02 · 空态「+ 新增订阅」双绑定（S2：inline onclick 与 addEventListener 各触发一次 → 弹窗叠两层）----
t('N-02a 空态按钮无 inline onclick（双绑定断绝；绑定统一走 bindListEvents）', app.indexOf('onclick="window.__st.openNew()"') < 0 && app.indexOf('<button class="btn primary">+ 新增订阅</button>') >= 0);
t('N-02b 空态按钮监听路径保留（.empty .btn.primary 渲染期绑定仍在）', app.indexOf("querySelector('.empty .btn.primary')") >= 0 && /emptyAddBtn[\s\S]{0,80}addEventListener\('click', openNew\)/.test(app));

// ---- N-08 · price 无上限（D-06 残留：1e308 → "¥1e+308"）----
t('N-08a 价格输入带上限属性 max=999999', app.indexOf('max="999999"') >= 0);
t('N-08b 保存路径有价格上限校验与提示（表单按钮直读 value，原生 max 不拦截）', /data\.price > 999999/.test(app) && app.indexOf('价格超出上限') >= 0);

// ---- N-09 · 「共 N 项」不随筛选（E-04 残留）----
t('N-09a 列表计数区分筛选态（筛选中显示「筛出 X / 共 Y 项」）', /筛出 ' \+ filtered\.length \+ ' \/ 共 ' \+ subs\.length/.test(app) && /filterActive/.test(app));

// ---- N-10 · UTC 日期残留（E-03：种子/导出文件名用 toISOString，凌晨偏一天）----
const installBody = fnBody('installSeed') || '';
t('N-10a installSeed 日期改本地拼接（无 toISOString）', !!installBody && installBody.indexOf('toISOString') < 0 && /getFullYear\(\) \+ '-' \+ pad2/.test(installBody));
const seedHtml = read('tests/seed.html') || '';
t('N-10b tests/seed.html 日期改本地拼接（与 installSeed 同源同步）', !!seedHtml && seedHtml.indexOf('toISOString') < 0 && /getFullYear\(\) \+ '-'/.test(seedHtml));
t('N-10c 导出备份文件名用本地日期（todayISO）', app.indexOf("'subtrack-backup-' + todayISO()") >= 0);

// ---- E-02 · 非法日期显示空白而非占位（残留：格式合法但不存在的日期，如 2026-02-30）----
t('E-02a formatDateSafe 存在且 4 个续费日期展示点全部改用（def + 4 调用 ≥ 5）', /function formatDateSafe\(/.test(app) && (app.match(/formatDateSafe\(/g) || []).length >= 5);
const dataModel = read('docs/data-model.md') || '';
t('E-02b data-model.md price 注记上限（≤ 999999）', dataModel.indexOf('≤ 999999') >= 0);

// ---- N-06 · CI 部署无测试门（回归可直达生产）----
const yml = read('.github/workflows/pages.yml') || '';
t('N-06a pages.yml 存在 test job（checkout + setup-node）', yml.indexOf('\n  test:') >= 0 && yml.indexOf('actions/setup-node@v4') >= 0);
t('N-06b test job 跑语法检查与全部套件（node --check + smoke/style/assert-batch*）', /node --check src\/app\.js/.test(yml) && /tests\/smoke-test\.js/.test(yml) && /assert-batch\*\.js/.test(yml));
t('N-06c deploy 依赖 test（needs: test，红灯不部署）', /needs:\s*test/.test(yml));

// ---- N-15 · README 断言数宣称过期（93/133）+ ES5 表述不精确（Object.assign/find 为 ES2015）----
// 断言数自计算：直接数 tests/ 下真实断言条数与 README 宣称比对，批次增删断言不会让本断言过期
const testFiles = fs.readdirSync(path.join(ROOT, 'tests')).filter(f => /^assert-batch\d+\.js$/.test(f)).sort();
let batchCount = 0;
testFiles.forEach(f => { batchCount += ((read('tests/' + f) || '').match(/^t\(/gm) || []).length; });
const smokeCount = ((read('tests/smoke-test.js') || '').match(/^results\.push\(\[/gm) || []).length;
const styleCount = ((read('tests/style-consistency.js') || '').match(/^results\.push\(\[/gm) || []).length;
const totalCount = batchCount + smokeCount + styleCount;
t('N-15a README 测试数据与实测一致（测试表 ' + batchCount + ' + 徽章 ' + totalCount + ' passing；93/133 清除）',
  readme.indexOf('共 93 项') < 0 && readme.indexOf('133 项断言') < 0
  && readme.indexOf('| ' + batchCount + ' |') >= 0 && readme.indexOf(totalCount + ' tests passing') >= 0,
  '实测 batch=' + batchCount + ' smoke=' + smokeCount + ' style=' + styleCount);
t('N-15b README ES5 表述精确（含 ES2015 内置方法说明与 IE11 边界）', readme.indexOf('ES2015') >= 0 && readme.indexOf('不支持 IE11') >= 0);

// ---- N-03 · 批次 F 对比度校准（数值判据在 tests/contrast-check.js 守门；这里锁结构与引用）----
const html = read('index.html') || '';
const style = html.slice(html.indexOf('<style>') + 7, html.indexOf('</style>'));
t('F-a 语义小字 token 三件套存在（--danger/warning/success-text，浅深双主题各有定义）',
  (style.match(/--danger-text:/g) || []).length >= 2 && (style.match(/--warning-text:/g) || []).length >= 2 && (style.match(/--success-text:/g) || []).length >= 2);
t('F-b 月历 lv-3 改实色 accent + on-accent（tint-78 token 已移除）',
  /\.cal-day\.lv-3\s*\{[^}]*background:\s*var\(--accent\)/.test(style) && /\.cal-day\.lv-3\s*\{[^}]*color:\s*var\(--on-accent\)/.test(style) && style.indexOf('--accent-tint-78') < 0);
t('F-c 徽章三色改用 *-text token（11px 小字达标路径）',
  /\.badge\.expired\s*\{[^}]*var\(--danger-text\)/.test(style) && /\.badge\.soon\s*\{[^}]*var\(--warning-text\)/.test(style) && /\.badge\.free\s*\{[^}]*var\(--success-text\)/.test(style));
t('F-d CI 测试循环包含 contrast-check.js', yml.indexOf('tests/contrast-check.js') >= 0);

// ---- N-04 · 输入类控件字号 <16px → iOS 聚焦自动放大 ----
t('G-a 输入类控件字号统一 16px（搜索框 / .input/.textarea/.select）',
  /\.search-box input\s*\{[^}]*font-size:\s*16px/.test(style)
  && /\.input, \.textarea, \.select\s*\{[^}]*font-size:\s*16px/.test(style));

// ---- N-17 · theme-color 固定深色，浅色主题下移动端地址栏颜色不符 ----
t('G-b applyTheme 同步 meta theme-color（浅 #ffffff / 深 #121212）',
  /meta\[name="theme-color"\]/.test(app) && /metaTheme\.setAttribute\('content', dark \? '#121212' : '#ffffff'\)/.test(app));
t('G-c index.html 保留 theme-color meta（JS 未跑前的初始值）', html.indexOf('<meta name="theme-color"') >= 0);

// ---- N-14 · 死代码链删除（批量选择永不可达 / updateOrder 零调用；方案一整链清除）----
t('H-a app.js 批量链零引用（selectedIds / updateOrder / deleteSubscriptions / batchDelete / clearSelection / batch-actions）',
  app.indexOf('selectedIds') < 0 && app.indexOf('updateOrder') < 0 && app.indexOf('deleteSubscriptions') < 0
  && app.indexOf('batchDelete') < 0 && app.indexOf('clearSelection') < 0 && app.indexOf('batch-actions') < 0);
t('H-b index.html 批量死 CSS 移除（.subscription-card.selected / .batch-actions / --shadow-up）',
  style.indexOf('.subscription-card.selected') < 0 && style.indexOf('.batch-actions') < 0 && style.indexOf('--shadow-up') < 0);
t('H-c app.js 头注释不再宣称「批量操作」', app.indexOf('批量操作') < 0);
t('H-d data-model.md 注记批次 H 清理记录（order 字段保留、updateOrder 已移除）', dataModel.indexOf('批次 H') >= 0 && dataModel.indexOf('updateOrder') >= 0);

let pass = 0;
results.forEach(([name, ok, detail]) => {
  console.log((ok ? '✅' : '❌') + ' ' + name + (detail ? '   → ' + detail : ''));
  if (ok) pass++;
});
console.log('\n' + pass + '/' + results.length + ' 通过');
process.exit(pass === results.length ? 0 : 1);
