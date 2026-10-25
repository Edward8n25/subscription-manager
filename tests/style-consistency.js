/* 样式一致性守门（零依赖，可进 CI）——结构抄自样板 quit-tracker tests/style-consistency.js
   目的：防止"收敛完又退化" —— 死 CSS / 失配类名 / 未使用 keyframes 重新出现，或内联 style / 裸值继续增长。
   用法：node tests/style-consistency.js
   说明：间距/圆角/内联/#000 采用棘轮阈值（只许降不许升）；完整收敛属批次 7 范围。 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const app = fs.readFileSync(path.join(ROOT, 'src', 'app.js'), 'utf8');
const style = html.slice(html.indexOf('<style>') + 7, html.indexOf('</style>'));

// ---- 棘轮基线（2026-10-25 批次 7 收敛后实测；只许下调，下调后请同步改这里）----
const BASELINE = {
  spacingViolations: 7,   // 豁免清单（结构性/规范明文值，不再收敛）：app 底部留白 100px、header 安全区 calc(14px+env)、
                          // 搜索框图标定位 36px、空态大留白 80px、modal padding 20px×3（calc 行整行豁免）
  bareRadius: 0,          // 裸 px 圆角已全部 token 化（--radius-xs/sm/lg/pill/50%）
  inlineStyles: 1,        // 仅剩年热力图动态 grid-template-columns（repeat(N,1fr) 无法静态化）
  blackLiterals: 0,       // #000 已全换 --on-accent（#062b14）
};
// 有意无 CSS 字面量来源的动态类（JS 拼接产出，加进来需写明原因）
const STYLE_HOOKS = ['lv-1', 'lv-2', 'lv-3',  // app.js: 'lv-' + heatLevel(level) 动态拼接
  'dot-green', 'dot-blue', 'dot-purple', 'dot-orange', // 配色 dot：'dot-' + c 动态拼接（1.1.0）
  'modal-body']; // showModal 内容包裹容器，无样式需求（批次 5 起）

const results = [];
const hitWord = (name, src) => new RegExp('(^|[^\\w-])' + name.replace(/-/g, '\\-') + '([^\\w-]|$)').test(src);
const hasRule = c => new RegExp('\\.' + c.replace(/-/g, '\\-') + '([^\\w-]|$)').test(style);

// 1. 死 CSS（先剥 /* */ 注释——注释文本里的 data-model.md 之类会被类名正则误判；
//    STYLE_HOOKS 同样豁免——动态拼接类（'dot-'+c / 'lv-'+n）是活类但字面量不可见）
const styleCode = style.replace(/\/\*[\s\S]*?\*\//g, '');
const cssClasses = [...new Set((styleCode.match(/\.[a-zA-Z][\w-]*/g) || []).map(s => s.slice(1)))];
const dead = cssClasses.filter(c => !hitWord(c, app) && !hitWord(c, html.slice(html.indexOf('</style>'))) && STYLE_HOOKS.indexOf(c) < 0).sort();
results.push(['无死 CSS', dead.length === 0, dead.join('  ')]);

// 2. 未使用 @keyframes
const kf = [...new Set((style.match(/@keyframes\s+([\w-]+)/g) || []).map(s => s.split(/\s+/)[1]))];
const unusedKf = kf.filter(k => !new RegExp('animation[^;]*' + k).test(style) && !new RegExp('animation[^;"]*' + k).test(app));
results.push(['无未使用 @keyframes', unusedKf.length === 0, unusedKf.join('  ')]);

// 3. 失配类名（JS 产出但 CSS 无规则；口径抄样板：class=" 后首个标识符 + className/classList 字面量）
const produced = new Set();
(app.match(/class=\\?"([a-zA-Z][\w-]*)/g) || []).forEach(m => {
  const mm = m.match(/([a-zA-Z][\w-]*)$/); if (mm) produced.add(mm[1]);
});
(app.match(/className\s*=\s*'([a-zA-Z][\w-]*)'/g) || []).forEach(m => {
  const mm = m.match(/'([a-zA-Z][\w-]*)'/); if (mm) produced.add(mm[1]);
});
(app.match(/classList\.(?:add|remove|toggle)\('([a-zA-Z][\w-]*)'/g) || []).forEach(m => {
  const mm = m.match(/'([a-zA-Z][\w-]*)'/); if (mm) produced.add(mm[1]);
});
const unstyled = [...produced].filter(c => !hasRule(c) && STYLE_HOOKS.indexOf(c) < 0).sort();
results.push(['无失配类名', unstyled.length === 0, unstyled.join('  ')]);

// 4. 结构性间距棘轮（>4px 必须落在六档；≤4px 微调豁免）
const SPACE = [4, 8, 12, 16, 24, 32];
const badSpacing = [];
(style.match(/(?:padding|margin|gap)(?:-(?:top|right|bottom|left))?:\s*[^;{}]+;/g) || []).forEach(decl => {
  (decl.match(/([0-9.]+)px/g) || []).forEach(v => {
    const n = parseFloat(v);
    if (n <= 4) return;
    if (SPACE.indexOf(n) < 0) badSpacing.push(n);
  });
});
results.push(['结构性间距越界次数 ≤ 基线 ' + BASELINE.spacingViolations,
  badSpacing.length <= BASELINE.spacingViolations, '当前 ' + badSpacing.length]);

// 5. 裸 px 圆角棘轮
const bareRadius = (style.match(/border-radius:\s*(?!var\(|999px|50%)[0-9.]+px/g) || []);
results.push(['裸 px 圆角 ≤ 基线 ' + BASELINE.bareRadius,
  bareRadius.length <= BASELINE.bareRadius, '当前 ' + bareRadius.length]);

// 6. 内联 style 预算棘轮
const inlineCount = (app.match(/\sstyle=\\?"/g) || []).length;
results.push(['内联 style 数量 ≤ 基线 ' + BASELINE.inlineStyles,
  inlineCount <= BASELINE.inlineStyles, '当前 ' + inlineCount]);

// 7. 纯黑字面量棘轮（规范 §8.1 禁 #000；批次 7 换 token 后下调至 0）
const blacks = (style.match(/#000\b/g) || []).length;
results.push(['#000 字面量 ≤ 基线 ' + BASELINE.blackLiterals + '（目标 0）',
  blacks <= BASELINE.blackLiterals, '当前 ' + blacks]);

// 8. 关键 Token 必须存在（SubTrack 令牌体系）
const NEED = ['--bg', '--bg-card', '--bg-input', '--text', '--text-sub', '--text-mute',
  '--border', '--accent', '--accent-hover', '--accent-muted', '--danger', '--warning',
  '--success', '--shadow', '--radius', '--radius-sm', '--radius-pill', '--tap'];
const missing = NEED.filter(t => style.indexOf(t + ':') < 0);
results.push(['Design Token 齐备（色彩 / 圆角 / 阴影 / 触感）', missing.length === 0, missing.join('  ')]);

let pass = 0;
results.forEach(([name, ok, detail]) => {
  console.log((ok ? '✅' : '❌') + ' ' + name + (detail ? '   → ' + detail : ''));
  if (ok) pass++;
});
console.log('\n' + pass + '/' + results.length + ' 通过');
process.exit(pass === results.length ? 0 : 1);
