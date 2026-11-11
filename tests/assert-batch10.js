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

// ---- N-01 · 年热力图未来遮罩（S1：未来续费被强制置空，README「全年续费密度」不成立）----
const heatBody = fnBody('renderYearHeatmap') || '';
t('N-01a renderYearHeatmap 不再用 future 遮罩置空（future ? 0 模式移除）', !!heatBody && !/future \? 0/.test(heatBody));
t('N-01b renderYearHeatmap 内无 future 残留引用（变量连同声明清除）', !!heatBody && !/\bfuture\b/.test(heatBody), '残留: ' + (heatBody.match(/\bfuture\b/g) || []).length + ' 处');
t('N-01c README 热力图文案如实（不再称「密度一图看完」，改「续费与到期分布」）', readme.indexOf('全年续费密度一图看完') < 0 && readme.indexOf('到期分布') >= 0);

let pass = 0;
results.forEach(([name, ok, detail]) => {
  console.log((ok ? '✅' : '❌') + ' ' + name + (detail ? '   → ' + detail : ''));
  if (ok) pass++;
});
console.log('\n' + pass + '/' + results.length + ' 通过');
process.exit(pass === results.length ? 0 : 1);
