/* 批次 6 · 状态机与口径断言（静态分析；D-04 折算行为级断言在 smoke-test.js）
   覆盖：S-01 openDetail 复位子状态 / S-02 列表滚动记忆 / D-04 折算统一走 billingCycle
   局限（如实记录）：S-01 翻月残留、S-02 滚动恢复需真实 DOM/滚动，静态断言锁代码结构，
   真浏览器验证归发布核验清单。用法：node tests/assert-batch6.js */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const app = fs.readFileSync(path.join(ROOT, 'src', 'app.js'), 'utf8');
const fnBody = (name) => {
  const i = app.indexOf('function ' + name);
  if (i < 0) return null;
  const next = app.indexOf('\n  function ', i + 10);
  return app.slice(i, next < 0 ? app.length : next);
};

const results = [];
const t = (name, ok, detail) => results.push([name, ok, detail || '']);

// ---- S-01 · openDetail 复位日历子状态（规范 §11 铁律 2）----
const openBody = fnBody('openDetail') || '';
t('S-01a openDetail 调用 resetCalState 复位日历子状态', openBody.indexOf('resetCalState()') >= 0);
t('S-01b resetCalState 收敛定义且统计页入口同样复位', /function resetCalState\(\)\s*{[\s\S]{0,80}calMonthOffset = 0;[\s\S]{0,40}calView = 'month'/.test(app) && (app.match(/resetCalState\(\)/g) || []).length >= 4);

// ---- S-02 · 列表滚动位置记忆（规范 §11 铁律 4）----
t('S-02a openDetail 仅在列表视图捕获 listScrollY', openBody.indexOf('listScrollY') >= 0 && openBody.indexOf("view === 'list'") >= 0);
const homeBody = fnBody('goHome') || '';
t('S-02b goHome 恢复 listScrollY（不再无条件回顶）', homeBody.indexOf('scrollTo(0, listScrollY)') >= 0);

// ---- D-04 · 折算统一走 billingCycle（paymentType 只作展示；用户裁决 2026-10-25）----
const detailBody = fnBody('renderDetail') || '';
t('D-04a 折算按 billingCycle 三档计算', detailBody.indexOf("s.billingCycle === 'quarterly'") >= 0 && detailBody.indexOf("s.billingCycle === 'yearly'") >= 0);
t('D-04b free/oneTime 折算为 0（与统计页口径一致）', detailBody.indexOf("s.paymentType !== 'free'") >= 0 && detailBody.indexOf("s.paymentType !== 'oneTime'") >= 0);
t('D-04c 详情折算不再读 paymentType 判周期', !/monthly = s\.paymentType === 'monthly'/.test(detailBody));

let pass = 0;
results.forEach(([name, ok, detail]) => {
  console.log((ok ? '✅' : '❌') + ' ' + name + (detail ? '   → ' + detail : ''));
  if (ok) pass++;
});
console.log('\n' + pass + '/' + results.length + ' 通过');
process.exit(pass === results.length ? 0 : 1);
