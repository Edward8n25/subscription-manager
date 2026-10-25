/* 批次 8 · a11y 与文档收尾断言（静态分析）
   覆盖：A-02 弹窗 role/aria/焦点归还 / A-04 prefers-reduced-motion /
        Doc-04 弱宣称如实化 / Doc-06 调试入口文档化 / LICENSE / 版本口径 1.0.0
   用法：node tests/assert-batch8.js */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const read = p => { try { return fs.readFileSync(path.join(ROOT, p), 'utf8'); } catch (e) { return null; } };
const app = read('src/app.js') || '';
const html = read('index.html') || '';
const readme = read('README.md') || '';
const license = read('LICENSE') || '';
const changelog = read('CHANGELOG.md') || '';
const manifest = read('manifest.json') || '';
const dataModel = read('docs/data-model.md') || '';

const results = [];
const t = (name, ok, detail) => results.push([name, ok, detail || '']);

// ---- A-02 · 弹窗可访问性（规范 §15）----
t('A-02a modal 带 role="dialog" 与 aria-modal="true"', /role="dialog" aria-modal="true"/.test(app));
t('A-02b 打开时聚焦首个控件（autofocus 对 innerHTML 无效）', /firstInput[\s\S]{0,120}focus\(\)/.test(app));
t('A-02c 关闭时焦点归还触发元素（lastFocused）', /lastFocused/.test(app) && /lastFocused\.focus\(\)/.test(app));

// ---- A-04 · prefers-reduced-motion 兜底（规范 §20-2 建议补齐）----
t('A-04 reduced-motion 媒体查询降级动画', /@media\s*\(prefers-reduced-motion:\s*reduce\)/.test(html) && /animation-duration:\s*0\.01ms/.test(html));

// ---- Doc-04 · 「提醒续费日期」弱宣称如实化 ----
t('Doc-04 README 不再裸称「提醒续费日期」，改为被动徽章描述', readme.indexOf('提醒续费日期') < 0 && /即将续费.*徽章/.test(readme));

// ---- Doc-06 · 调试入口全量文档化 ----
t('Doc-06a README 调试入口含 ?view=stats 与 ?theme=', /view=stats/.test(readme) && /theme=light/.test(readme));
t('Doc-06b README 如实记载 #seed 守卫行为与 tests/seed.html?run=1', /#seed/.test(readme) && /run=1/.test(readme) && /确认/.test(readme));

// ---- 发布齐件（规范 §7.1 ③）----
t('REL-a LICENSE 存在且为 MIT', !!license && /MIT License/.test(license) && /Edward8n25/.test(license));
t('REL-b README 公开测试运行命令（node tests/smoke-test.js）', /node tests\/smoke-test\.js/.test(readme) && /style-consistency\.js/.test(readme));
t('REL-c README 数据说明含备份双写', /subtrack-v2\.bak/.test(readme) || /双写/.test(readme));

// ---- 版本口径（1.0.0 定版；1.1.0 起新功能递增）----
t('VER-a 设置弹窗版本文案为 1.1.0 且不再引用已废弃 MavisUI', /SubTrack 1\.1\.0/.test(app) && app.indexOf('MavisUI') < 0);
t('VER-b manifest.json version 字段 1.1.0', /"version":\s*"1\.1\.0"/.test(manifest));
t('VER-c CHANGELOG 定版 [1.0.0] - 2026-10-25', /\[1\.0\.0\]\s*-\s*2026-10-25/.test(changelog));

// ---- 文档一致性 ----
t('DOC data-model.md 记载备份 key 双写', /subtrack-v2\.bak/.test(dataModel));

let pass = 0;
results.forEach(([name, ok, detail]) => {
  console.log((ok ? '✅' : '❌') + ' ' + name + (detail ? '   → ' + detail : ''));
  if (ok) pass++;
});
console.log('\n' + pass + '/' + results.length + ' 通过');
process.exit(pass === results.length ? 0 : 1);
