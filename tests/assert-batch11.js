/* 批次 I~J · 1.2.0 UI 规范升级断言（静态分析）
   覆盖：字号 6 档收敛 / 行高 4px 网格 / 去 uppercase / 焦点环 / 触控 44 / 动效收敛 /
        原生表面 / toast 2.2s / 底部留白 / 单头部 / 标题栏单行 / 卡片等高 / 文案（即将到期）/
        日历改版（删热力图 + 扣款摘要 + 日期角标 + 明细浮层）/ 统计 SVG / 返回语义 / 排序沉底 /
        卡片键盘可达 / 计费方式合并 / 全屏表单 / 危险按钮降噪
   断言先行：未升级代码上必须失败（反向验证态），升级后全绿。
   用法：node tests/assert-batch11.js */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const read = p => { try { return fs.readFileSync(path.join(ROOT, p), 'utf8'); } catch (e) { return null; } };
const app = read('src/app.js') || '';
const html = read('index.html') || '';
const manifest = read('manifest.json') || '';
const readme = read('README.md') || '';
const dataModel = read('docs/data-model.md') || '';
const style = html.slice(html.indexOf('<style>') + 7, html.indexOf('</style>'));

const results = [];
const t = (name, ok, detail) => results.push([name, ok, detail || '']);

// ---- 排版体系（§8.2）----
// 6 档：12 / 16 / 18 / 22 / 36 / 48（+ 空态 emoji 64）；禁止 11/13/14/15/20 的 1px 邻档
const banned = style.match(/font-size:\s*(11|13|14|15|20)px/g) || [];
t('① 字号收敛 6 档（禁 11/13/14/15/20 邻档）', banned.length === 0, banned.join('  '));
t('①b 高频档齐备（12/16/18/22/36/48 均有使用）', ['12px', '16px', '18px', '22px', '36px', '48px'].every(s => style.indexOf('font-size: ' + s) >= 0));
const lhBad = (style.match(/line-height:\s*[\d.]+px?/g) || []).filter(m => {
  if (m.indexOf('px') < 0) return true;                // 无单位（1.5 / 1.6）一律算越界
  const num = parseFloat(m.replace(/[^\d.]/g, ''));
  return num % 4 !== 0;                                // 行高必须落 4px 网格
});
t('③ 行高全部落 4px 网格（无单位值清零）', lhBad.length === 0, lhBad.join('  '));
t('② 中文界面无 text-transform（uppercase 清零）', style.indexOf('text-transform') < 0);

// ---- 可访问性（§8.8 / §8.9）----
t('④ 全局 :focus-visible 焦点环（2px accent + 2px 偏移）', /:focus-visible\s*{[^}]*outline:\s*2px solid var\(--accent\)[^}]*outline-offset:\s*2px/.test(style));
t('⑤ 触控 44px 命中区（icon-btn::after / btn::before / btn.small::before）',
  /\.icon-btn::after\s*{[^}]*inset:\s*-4px/.test(style) && /\.btn::before\s*{[^}]*inset:\s*-4px/.test(style) && /\.btn\.small::before\s*{[^}]*inset:\s*-6px/.test(style));
t('⑦ 原生表面随主题上色（::selection / caret-color / scrollbar-color）',
  style.indexOf('::selection') >= 0 && style.indexOf('caret-color: var(--accent)') >= 0 && style.indexOf('scrollbar-color') >= 0);

// ---- 动效（§8.7）----
t('⑥ 禁 transition:all（清零）+ --ease 曲线 + 按压缩放',
  style.indexOf('transition: all') < 0 && style.indexOf('--ease:') >= 0 && /\.btn:active\s*{[^}]*scale\(\.985\)/.test(style));
t('⑧ toast 2.2s + 底部安全区（2500 清零）', app.indexOf('2200') >= 0 && app.indexOf('2500') < 0 && /bottom:\s*calc\(24px \+ env\(safe-area-inset-bottom\)\)/.test(style));

// ---- 布局与 chrome（§10 / §11）----
t('⑨ 底部留白 32px（批量操作栏残渣 100px 清零）', /\.app\s*{[^}]*padding:\s*0 16px 32px/.test(style));
t('⑨b 详情页隐藏应用头（统计页保留右上角图标，标题行不吸顶）', /classList\.toggle\('hidden', view === 'detail'\)/.test(app) && /detail-head plain/.test(app));
t('⑱ 标题栏单行（副标题移除）+ 18px 标题', html.indexOf('id="app-sub"') < 0 && style.indexOf('.header .sub') < 0 && /\.header h1\s*{[^}]*font-size:\s*18px/.test(style));

// ---- 卡片（§12.1 信息密度 + 等高）----
t('⑬ 卡片等高：费用详情移出列表 + 徽章并入标题行',
  app.indexOf('card-note') < 0 && app.indexOf('class="badges"') < 0 && /card-title[\s\S]{0,140}badge/.test(app));
t('⑰ 文案：即将续费 → 即将到期', app.indexOf('即将到期') >= 0 && app.indexOf('即将续费') < 0 && readme.indexOf('即将续费') < 0);

// ---- 日历改版（⑩）----
t('⑩ 年热力图移除 + 本月扣款摘要 + 日期角标 + 明细浮层',
  app.indexOf('renderYearHeatmap') < 0 && app.indexOf('本月扣款') >= 0 && app.indexOf('dotmark') >= 0 && app.indexOf('cal-pop') >= 0 && app.indexOf('data-day=') >= 0);
t('⑩b 统计页不再重复放日历（详情页唯一调用）', (app.match(/renderCalendar\(\);/g) || []).length === 1, '当前 ' + (app.match(/renderCalendar\(\);/g) || []).length);

// ---- 统计（⑪）----
t('⑪ 统计图标 SVG（emoji 清零）', app.indexOf('💰') < 0 && /<rect x="2" y="6"/.test(app));

// ---- 返回语义（⑪b）----
t('⑪b 返回回到来源视图（detailOrigin + backToStats）', app.indexOf('detailOrigin') >= 0 && /backToStats/.test(app));

// ---- 排序与键盘（⑫）----
t('⑫ 排序空日期沉底（9999-12-31 排序键）', app.indexOf("'9999-12-31'") >= 0);
t('⑫b 卡片可键盘到达（tabindex/role + Enter/Space）', /tabindex="0" role="link"/.test(app) && /e\.key !== 'Enter' && e\.key !== ' '/.test(app));

// ---- 计费方式合并（⑯）----
t('⑯ 计费方式合并（BILLING_OPTIONS + cycleLabel + 表单单字段）',
  app.indexOf('BILLING_OPTIONS') >= 0 && app.indexOf('function cycleLabel') >= 0
  && app.indexOf('id="qt-billing"') >= 0 && app.indexOf('name="billingCycle"') < 0 && app.indexOf('name="paymentType"') < 0);
t('⑯b 详情字段列表用「计费方式」单行', app.indexOf("kvRow('计费方式'") >= 0);
t('⑯c data-model.md 记录计费方式映射（存储两字段不变）', dataModel.indexOf('计费方式') >= 0);

// ---- 全屏表单（⑮）----
t('⑮ 全屏表单（showModal full + sheet 三段布局）',
  app.indexOf('{ full: true }') >= 0 && style.indexOf('.modal-back.full') >= 0
  && style.indexOf('.sheet-head') >= 0 && style.indexOf('.sheet-body') >= 0 && style.indexOf('.sheet-foot') >= 0);

// ---- 危险按钮降噪（⑭）----
t('⑭ 危险块按钮降噪（描边 + 红字，hover 浅红底）',
  /\.btn\.danger\.block\s*{[^}]*border-color:\s*var\(--border\)[^}]*color:\s*var\(--danger-text\)/.test(style));

// ---- 版本与品牌（1.2.0 品牌统一）----
t('版本 1.2.0（APP_VERSION + manifest，与戒断工具对齐）', /var APP_VERSION = '1\.2\.0'/.test(app) && /"version":\s*"1\.2\.0"/.test(manifest));
t('品牌统一：标签页「订阅管理 · 本地订阅账本」，页头「订阅管理」，UI 无「SubTrack」', html.indexOf('<title>订阅管理 · 本地订阅账本</title>') >= 0 && html.indexOf('id="app-title">订阅管理') >= 0
  && [html, app, manifest, readme].every(s => s.indexOf('SubTrack') < 0));

// ---- 图标提示（对齐戒断 F14：::before 气泡 / ::after 命中区）----
t('三个图标按钮带 data-tip 且 hover/focus-visible 显示', /data-tip="切换主题"/.test(html) && /data-tip="统计"/.test(html) && /data-tip="设置"/.test(html)
  && /\.icon-btn\[data-tip\]::before\s*{[^}]*content:\s*attr\(data-tip\)/.test(style)
  && /\.icon-btn\[data-tip\]:hover::before/.test(style) && /\.icon-btn\[data-tip\]:focus-visible::before/.test(style));

// ---- 设置面板（对齐戒断：分组标题 / 主题三选 / 选中态 / 关于块）----
t('设置面板：主题三选 + 配色四选 + 选中态 + 关于块（订阅数在数据管理、不显示数据键）', app.indexOf('data-theme-set=') >= 0 && app.indexOf('跟随系统') >= 0 && app.indexOf('data-accent-name=') >= 0
  && /\.btn\.active\s*{[^}]*background:\s*var\(--text\)/.test(style)
  && app.indexOf('settings-about-name') >= 0 && app.indexOf('settings-about-ver') >= 0 && app.indexOf('settings-about-note') >= 0
  && app.indexOf('field-hint') >= 0 && app.indexOf('数据键') < 0);

// ---- 列表排序行（1.2.0 收尾：与标签胶囊同皮肤）----
t('⑲ 排序行：胶囊按钮 + 排序弹窗，计数右对齐弱化（原生 select 清零）',
  /class="sort-btn"/.test(app) && app.indexOf('sort-bar select') < 0 && app.indexOf('openSortPicker') >= 0
  && /\.sort-bar \.count\s*{[^}]*margin-left:\s*auto/.test(style) && /\.sort-btn\s*{[^}]*border-radius:\s*var\(--radius-pill\)/.test(style));

// ---- 图标（1.2.0 重绘：纯几何 / 无文字 / 无渐变）----
const iconSvg = read('assets/icons/icon.svg') || '';
t('图标重绘：无渐变/无 text 元素，深底 + 白色几何 + 品牌绿点', iconSvg.indexOf('linearGradient') < 0 && iconSvg.indexOf('<text') < 0
  && iconSvg.indexOf('#121212') >= 0 && iconSvg.indexOf('#1db954') >= 0);

let pass = 0;
results.forEach(([name, ok, detail]) => {
  console.log((ok ? '✅' : '❌') + ' ' + name + (detail ? '   → ' + detail : ''));
  if (ok) pass++;
});
console.log('\n' + pass + '/' + results.length + ' 通过');
process.exit(pass === results.length ? 0 : 1);
