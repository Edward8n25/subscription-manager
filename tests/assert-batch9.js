/* 批次 9 · 配色方案切换断言（1.1.0 新功能；借鉴 habit-quit-tracker data-accent 机制）
   覆盖：CSS 三色 token 块（blue/purple/orange + dark 变体）/ JS 持久化与回落 /
        设置弹窗四色 UI / 非 green 配色无绿色残留
   行为级断言（data-accent 读写/持久化/非法回落）见 smoke-test.js。
   用法：node tests/assert-batch9.js */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const app = fs.readFileSync(path.join(ROOT, 'src', 'app.js'), 'utf8');
const style = html.slice(html.indexOf('<style>') + 7, html.indexOf('</style>'));

const results = [];
const t = (name, ok, detail) => results.push([name, ok, detail || '']);
const block = (sel) => {
  const i = style.indexOf(sel);
  if (i < 0) return '';
  return style.slice(i, style.indexOf('}', i) + 1);
};

// ---- CSS · 三色 token 块（green = :root 基线不动）----
t('CSS-a [data-accent="blue"] 定义 accent/hover/on-accent/muted/tint 全套', (() => {
  const b = block('[data-accent="blue"]');
  return ['--accent:', '--accent-hover:', '--on-accent:', '--accent-muted:', '--accent-tint-18:', '--accent-tint-45:', '--accent-tint-78:'].every(k => b.indexOf(k) >= 0);
})());
t('CSS-b [data-accent="purple"] 定义全套', (() => {
  const b = block('[data-accent="purple"]');
  return ['--accent:', '--accent-hover:', '--on-accent:', '--accent-muted:', '--accent-tint-18:', '--accent-tint-45:', '--accent-tint-78:'].every(k => b.indexOf(k) >= 0);
})());
t('CSS-c [data-accent="orange"] 定义全套', (() => {
  const b = block('[data-accent="orange"]');
  return ['--accent:', '--accent-hover:', '--on-accent:', '--accent-muted:', '--accent-tint-18:', '--accent-tint-45:', '--accent-tint-78:'].every(k => b.indexOf(k) >= 0);
})());
t('CSS-d dark 变体 ×3（muted 提透明度）', style.indexOf('[data-theme="dark"][data-accent="blue"]') >= 0 && style.indexOf('[data-theme="dark"][data-accent="purple"]') >= 0 && style.indexOf('[data-theme="dark"][data-accent="orange"]') >= 0);
t('CSS-e 四色主色值与 data-model 预留一致（green/blue/purple/orange）', style.indexOf('#1db954') >= 0 && block('[data-accent="blue"]').indexOf('#1e90ff') >= 0 && block('[data-accent="purple"]').indexOf('#a45ee5') >= 0 && block('[data-accent="orange"]').indexOf('#ff7a45') >= 0);

// ---- 非 green 配色下无绿色 rgba 残留（tint token 化的收益兑现）----
t('CSS-f 三色块内无绿色 rgba(29,185,84 残留', ['blue', 'purple', 'orange'].every(c => {
  const b = block('[data-accent="' + c + '"]') + block('[data-theme="dark"][data-accent="' + c + '"]');
  return !/rgba\(29, ?185, ?84/.test(b);
}));

// ---- 设置 UI（accent-row 四色行 + dot 色点）----
t('UI-a .accent-row/.accent-dot/dot 四色 CSS 存在', /\.accent-row\s*{/.test(style) && /\.accent-dot\s*{/.test(style) && ['dot-green', 'dot-blue', 'dot-purple', 'dot-orange'].every(d => style.indexOf('.' + d) >= 0));
t('UI-b 设置弹窗配色行：data-act=accent 动态生成四按钮（ACCENT_LIST.map）', app.indexOf('data-act="accent"') >= 0 && /data-accent-name="' \+ c \+ '"/.test(app) && /ACCENT_LIST\.map\(function \(c\)/.test(app) && app.indexOf('purple: \'蔷薇紫\'') >= 0 && app.indexOf('orange: \'落日橙\'') >= 0);

// ---- JS · 持久化与联动 ----
t('JS-a ACCENT_KEY=subtrack-accent + ACCENT_LIST 四值', /ACCENT_KEY\s*=\s*'subtrack-accent'/.test(app) && /ACCENT_LIST\s*=\s*\['green', 'blue', 'purple', 'orange'\]/.test(app));
t('JS-b applyTheme 统一设置 data-accent（主题+配色一次刷）', /setAttribute\('data-accent', accent\)/.test(app));
t('JS-c setAccent 持久化 + 即时生效 + toast 反馈', /function setAccent\(/.test(app) && /setItem\(ACCENT_KEY/.test(app));

let pass = 0;
results.forEach(([name, ok, detail]) => {
  console.log((ok ? '✅' : '❌') + ' ' + name + (detail ? '   → ' + detail : ''));
  if (ok) pass++;
});
console.log('\n' + pass + '/' + results.length + ' 通过');
process.exit(pass === results.length ? 0 : 1);
