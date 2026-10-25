/* 批次 7 · UI 一致性断言（静态分析）
   覆盖：U-01 tint token / U-02 去 #000 / U-03 内联收敛 / U-05 圆角 token / U-06 阴影 token /
        divider 补样式 / A-05 按钮两档 / 间距豁免清单固化
   用法：node tests/assert-batch7.js */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const app = fs.readFileSync(path.join(ROOT, 'src', 'app.js'), 'utf8');
const style = html.slice(html.indexOf('<style>') + 7, html.indexOf('</style>'));

const results = [];
const t = (name, ok, detail) => results.push([name, ok, detail || '']);
const count = (re, src) => (src.match(re) || []).length;

// ---- U-01 · 着色元素走 tint token ----
t('U-01a tint token 四件套定义', style.indexOf('--accent-tint-18:') >= 0 && style.indexOf('--accent-tint-45:') >= 0 && style.indexOf('--accent-tint-78:') >= 0 && style.indexOf('--danger-muted:') >= 0);
// 绿色 rgba 全部收进 token 定义区（accent-muted 浅/深 + tint ×3 = 5 处），规则体内零字面量
t('U-01b 绿色 rgba 仅存于 token 定义（5 处）', count(/rgba\(29, ?185, ?84/g, style) === 5, '当前 ' + count(/rgba\(29, ?185, ?84/g, style));
t('U-01c 日历色阶/图例/过期徽章全走 var()', !/\.cal-day\.lv-\d\s*{[^}]*rgba/.test(style) && !/\.swatch\.lv-\d\s*{[^}]*rgba/.test(style) && style.indexOf('var(--danger-muted)') >= 0);

// ---- U-02 · 纯黑清零 / 反白 token ----
t('U-02a #000 字面量清零', count(/#000\b/g, style) === 0);
t('U-02b --on-accent 定义且按钮/勾标使用', style.indexOf('--on-accent:') >= 0 && count(/var\(--on-accent\)/g, style) >= 2);
t('U-02c 深 tint 反白走 --text-on-tint（#fff 规则体清零）', style.indexOf('--text-on-tint:') >= 0 && count(/#fff\b/g, style) === 0 && count(/var\(--text-on-tint\)/g, style) >= 2);

// ---- U-03 · JS 内联仅剩动态 grid ----
t('U-03 JS 内联仅剩动态 grid-template-columns（1 处）', count(/\sstyle=\\?"/g, app) === 1 && app.indexOf("style=\"grid-template-columns") >= 0);

// ---- U-05 · 圆角全 token ----
t('U-05a 裸 px 圆角清零', count(/border-radius:\s*(?!var\(|50%)[0-9.]+px/g, style) === 0);
t('U-05b --radius-xs/--radius-lg token 定义并使用', style.indexOf('--radius-xs:') >= 0 && style.indexOf('--radius-lg:') >= 0 && count(/var\(--radius-xs\)/g, style) >= 3 && count(/var\(--radius-lg\)/g, style) >= 2);

// ---- U-06 · 阴影走 token（含底栏向上阴影专用档）----
t('U-06a --shadow-up 定义且 batch-actions 使用', style.indexOf('--shadow-up:') >= 0 && style.indexOf('box-shadow: var(--shadow-up)') >= 0);
// 肯定式校验（负向 lookahead 会被 \s* 回溯绕过）：每条 box-shadow 必须以 var( 或 cal-day.today 的 inset 描边开头
const shadows = style.match(/box-shadow:[^;]+;/g) || [];
const badShadows = shadows.filter(s => !/^box-shadow:\s*(var\(--|inset 0 0 0 2px var\()/.test(s));
t('U-06b box-shadow 仅 token 引用与 cal-day.today inset（无裸值）', badShadows.length === 0, badShadows.join(' | '));

// ---- divider / 按钮两档 / 间距豁免固化 ----
t('D-NEW divider 有规则（盘点 P3 修复）', /\.divider\s*{[^}]*height:\s*1px/.test(style));
t('A-05 按钮高度两档（36/32，28 已收敛）', /min-height: 28px/.test(style) === false && /min-height: 36px/.test(style) && /min-height: 32px/.test(style));
t('豁免清单注释固化在棘轮基线', fs.readFileSync(path.join(ROOT, 'tests', 'style-consistency.js'), 'utf8').indexOf('豁免清单') >= 0);

let pass = 0;
results.forEach(([name, ok, detail]) => {
  console.log((ok ? '✅' : '❌') + ' ' + name + (detail ? '   → ' + detail : ''));
  if (ok) pass++;
});
console.log('\n' + pass + '/' + results.length + ' 通过');
process.exit(pass === results.length ? 0 : 1);
