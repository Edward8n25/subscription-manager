/* 配色对比度守门（零依赖，可进 CI）——结构移植自 habit-quit-tracker tests/contrast-check.js（2026-11-10 校准版）
   目的：四种配色 × 明暗两模式下，关键 token 对（含半透明 tint 合成底）的对比度不得低于 WCAG AA。
   背景：第 2 轮盘点 N-03——浅色主题徽章/标签胶囊/月历深 tint 文字全部不达标（最低 1.54:1），
        色值对齐戒断工具 2026-11-10 校准值（批次 F）。

   用法：node tests/contrast-check.js

   判据（WCAG 2.1）：
     · 文字（含 11–13px 徽章/胶囊小字）→ ≥ 4.5:1（1.4.3 AA）
     · UI 元素 / ≥18.66px 粗体大字    → ≥ 3:1  （1.4.11 AA / 大字放宽）
*/
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const style = html.slice(html.indexOf('<style>') + 7, html.indexOf('</style>'));

/* ── 解析：把某个选择器块里的自定义属性抽成 { name: value } ── */
function readBlock(selector) {
  const esc = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp(esc + '\\s*\\{([^}]*)\\}');
  const m = style.match(re);
  if (!m) return null;
  const out = {};
  (m[1].match(/--[\w-]+\s*:\s*[^;]+;/g) || []).forEach(decl => {
    const i = decl.indexOf(':');
    const k = decl.slice(0, i).trim();
    const v = decl.slice(i + 1).replace(';', '').trim();
    out[k] = v;
  });
  return out;
}

/* ── 颜色解析：#rgb / #rrggbb / rgb() / rgba() → {r,g,b,a} ── */
function parseColor(v) {
  if (!v) return null;
  v = v.trim();
  if (v[0] === '#') {
    const h = v.slice(1);
    if (h.length === 3) {
      return { r: parseInt(h[0] + h[0], 16), g: parseInt(h[1] + h[1], 16), b: parseInt(h[2] + h[2], 16), a: 1 };
    }
    if (h.length === 6) {
      return {
        r: parseInt(h.slice(0, 2), 16),
        g: parseInt(h.slice(2, 4), 16),
        b: parseInt(h.slice(4, 6), 16),
        a: 1
      };
    }
    return null;
  }
  const m = v.match(/rgba?\(([^)]+)\)/);
  if (!m) return null;
  const p = m[1].split(',').map(x => parseFloat(x.trim()));
  return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 };
}

/* ── WCAG 相对亮度 ── */
function luminance(c) {
  const f = x => {
    x /= 255;
    return x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b);
}

/* ── 对比度 ── */
function ratio(fg, bg) {
  if (!fg || !bg) return null;
  const l1 = luminance(fg);
  const l2 = luminance(bg);
  const hi = Math.max(l1, l2);
  const lo = Math.min(l1, l2);
  return (hi + 0.05) / (lo + 0.05);
}

/* ── 半透明 tint 与底色合成不透明色 ── */
function composite(tint, base) {
  if (!tint) return base;
  return {
    r: tint.r * tint.a + base.r * (1 - tint.a),
    g: tint.g * tint.a + base.g * (1 - tint.a),
    b: tint.b * tint.a + base.b * (1 - tint.a),
    a: 1
  };
}

/* ── 取实际生效值：按 CSS 层叠顺序浅 → 深 → 配色覆盖 ── */
function resolve(theme, accent, key) {
  const base = readBlock(':root') || {};
  let v = base[key];
  if (theme === 'dark') {
    const dark = readBlock('[data-theme="dark"]') || {};
    if (dark[key] != null) v = dark[key];
  }
  if (accent !== 'green') {
    const light = readBlock('[data-accent="' + accent + '"]') || {};
    if (light[key] != null) v = light[key];
    if (theme === 'dark') {
      const darkAcc = readBlock('[data-theme="dark"][data-accent="' + accent + '"]') || {};
      if (darkAcc[key] != null) v = darkAcc[key];
    }
  }
  return parseColor(v);
}

/* ── 不透明 token 对检查表：[label, 前景, 背景, 门槛] ── */
const CHECKS = [
  ['正文', '--text', '--bg', 4.5],
  ['次级文字', '--text-sub', '--bg', 4.5],
  ['三级文字', '--text-mute', '--bg', 4.5],
  ['卡片内三级文字', '--text-mute', '--bg-card', 4.5],
  ['强调色当文字（价格/标签胶囊）', '--accent', '--bg', 4.5],
  ['强调色当 UI 元素（按钮/描边）', '--accent', '--bg', 3.0],
  ['强调底上的文字（主按钮）', '--on-accent', '--accent', 4.5],
  ['hover 强调底上的文字', '--on-accent', '--accent-hover', 4.5],
  ['危险文字（按钮 13px 小字）', '--danger', '--bg', 4.5]
];

/* ── 半透明合成底检查表：[label, 前景 token, tint token, 合成基 token, 门槛]
   基一律 --bg-card（徽章/标签/月历格子都落在卡片上）── */
const TINT_PAIRS = [
  ['卡片标签（accent on accent-muted）', '--accent', '--accent-muted', 4.5],
  ['过期徽章', '--danger-text', '--danger-muted', 4.5],
  ['即将续费徽章', '--warning-text', '--warning-muted', 4.5],
  ['免费徽章', '--success-text', '--success-muted', 4.5],
  ['月历 lv-1 文字', '--text', '--accent-tint-18', 4.5],
  ['月历 lv-2 文字', '--text-on-tint', '--accent-tint-45', 4.5],
  ['警示大字（统计四宫格）', '--warning', null, 3.0]
];

const ACCENTS = ['green', 'blue', 'purple', 'orange'];
const THEMES = ['light', 'dark'];

let pass = 0;
let total = 0;
const failures = [];

CHECKS.forEach(([label, fgKey, bgKey, min]) => {
  ACCENTS.forEach(accent => {
    THEMES.forEach(theme => {
      total++;
      const fg = resolve(theme, accent, fgKey);
      const bg = resolve(theme, accent, bgKey);
      if (!fg || !bg) {
        failures.push(accent + '/' + theme + ' ' + label + '：无法解析 ' + (!fg ? fgKey : bgKey));
        return;
      }
      const r = ratio(fg, bg);
      if (r >= min) {
        pass++;
      } else {
        failures.push(accent + '/' + theme + ' ' + label + '：' + r.toFixed(2) + ':1 < ' + min + ':1');
      }
    });
  });
});

TINT_PAIRS.forEach(([label, fgKey, tintKey, min]) => {
  ACCENTS.forEach(accent => {
    THEMES.forEach(theme => {
      total++;
      const fg = resolve(theme, accent, fgKey);
      const base = resolve(theme, accent, '--bg-card');
      const bg = tintKey ? composite(resolve(theme, accent, tintKey), base) : base;
      if (!fg || !bg) {
        failures.push(accent + '/' + theme + ' ' + label + '：无法解析 ' + fgKey + (tintKey ? '/' + tintKey : ''));
        return;
      }
      const r = ratio(fg, bg);
      if (r >= min) {
        pass++;
      } else {
        failures.push(accent + '/' + theme + ' ' + label + '：' + r.toFixed(2) + ':1 < ' + min + ':1');
      }
    });
  });
});

/* ── 四种配色的相对亮度必须落在同一窄带内（切换配色不改变视觉重量）
   带宽沿用 habit-quit-tracker 校准值（2026-11-10）：浅色四色实测 0.145–0.159，深色 0.325–0.363 ── */
const LUM_BANDS = { light: [0.10, 0.22], dark: [0.27, 0.42] };
const lumFail = [];
ACCENTS.forEach(accent => {
  THEMES.forEach(theme => {
    const c = resolve(theme, accent, '--accent');
    if (!c) return;
    const l = luminance(c);
    const [lo, hi] = LUM_BANDS[theme];
    if (l < lo || l > hi) {
      lumFail.push(accent + '/' + theme + '：亮度 ' + l.toFixed(3) + ' 不在 [' + lo + ', ' + hi + ']');
    }
  });
});

/* ── 输出 ── */
console.log('配色对比度检查（' + ACCENTS.length + ' 配色 × ' + THEMES.length + ' 模式 × ' + (CHECKS.length + TINT_PAIRS.length) + ' 项对）');
console.log('');

if (failures.length === 0) {
  console.log('✅ 对比度全部达标   → ' + pass + '/' + total);
} else {
  console.log('❌ 对比度不达标 ' + failures.length + ' 项：');
  failures.forEach(f => console.log('   · ' + f));
}

if (lumFail.length === 0) {
  console.log('✅ 四种配色亮度对齐（切换配色不改变视觉重量）');
} else {
  console.log('❌ 配色亮度不一致 ' + lumFail.length + ' 项：');
  lumFail.forEach(f => console.log('   · ' + f));
}

const ok = failures.length === 0 && lumFail.length === 0;
console.log('');
console.log(ok ? '全部通过' : '存在不达标项');
process.exit(ok ? 0 : 1);
