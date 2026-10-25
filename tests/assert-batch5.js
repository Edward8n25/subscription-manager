/* 批次 5 · 安全与弹窗断言（静态分析）
   覆盖：J-01 onclick 内插移除 / P-01 #seed 确认 / J-03 遮罩不关闭 / J-04 Enter 接管 / J-06 弹窗栈
   局限（如实记录）：J-01 的注入链需真浏览器 HTML 实体解码才能端到端复现——
   数据层白名单（批次 3）+ 内插模式清零（本文件）双层覆盖，真浏览器验证归发布核验清单。
   用法：node tests/assert-batch5.js */
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

// ---- J-01 · onclick 内插 id 清零（data-* + 渲染期绑定替代）----
t('J-01a 无 openEdit 内插 onclick', app.indexOf("openEdit(\\'") < 0);
t('J-01b 无 confirmDelete 内插 onclick', app.indexOf("confirmDelete(\\'") < 0);
t('J-01c 无 openDetail 内插 onclick', app.indexOf("openDetail(\\'") < 0);
t('J-01d 渲染字符串含 data-act 编辑/删除锚点', app.indexOf('data-act="edit"') >= 0 && app.indexOf('data-act="del"') >= 0);
t('J-01e bindDetailEvents 渲染期绑定存在', /function bindDetailEvents\(/.test(app));
t('J-01f 统计页卡片 data-id 绑定（不再内插）', /function bindStatsEvents\(/.test(app));

// ---- P-01 · #seed 确认守卫 ----
const initBody = fnBody('init') || '';
t('P-01a #seed 分支：空库/演示数据直灌，真实数据走确认（isDemo 判定 + else 弹窗）', initBody.indexOf("'#seed'") >= 0 && /isDemo[\s\S]{0,300}showModal\('灌入演示数据/.test(initBody));
t('P-01b 确认弹窗明示覆盖范围（现有 N 条 vs 6 条演示）', /覆盖现有的 <b>' \+ state\.subscriptions\.length \+ '<\/b> 条数据/.test(initBody));

// ---- J-03 · 点遮罩不关闭（防误关，规范 §12）----
const modalBody = fnBody('showModal') || '';
t('J-03a showModal 无遮罩点击关闭（e.target === back 模式移除）', modalBody.indexOf('e.target === back') < 0);
t('J-03b modal 不再需要 stopPropagation 遮罩补丁', modalBody.indexOf('event.stopPropagation()') < 0);

// ---- J-04 · 表单 Enter 隐式提交接管 ----
t('J-04 form submit preventDefault（拦截页面刷新丢输入）', /addEventListener\('submit', function \(e\) \{\s*e\.preventDefault\(\)/.test(app));

// ---- J-06 · 弹窗栈（叠加 + ESC 关最上层 + 锁滚）----
t('J-06a modalStack 存在且 showModal 压栈', /var modalStack = \[\]/.test(app) && modalBody.indexOf('modalStack.push(') >= 0);
t('J-06b showModal 不再先 closeModal 顶掉前一个（单槽顶替移除）', modalBody.indexOf('closeModal();') < 0);
t('J-06c ESC 关最上层（keydown Escape → closeModal）', /Escape/.test(app) && /key(Key)?Down|keydown/i.test(app) && fnBody('init').indexOf('Escape') >= 0);
t('J-06d z-index 100+10n 递增', /100 \+ modalStack\.length \* 10/.test(app));
t('J-06e body 锁滚随栈开合', /overflow/.test(modalBody) || /updateBodyScrollLock/.test(app));

let pass = 0;
results.forEach(([name, ok, detail]) => {
  console.log((ok ? '✅' : '❌') + ' ' + name + (detail ? '   → ' + detail : ''));
  if (ok) pass++;
});
console.log('\n' + pass + '/' + results.length + ' 通过');
process.exit(pass === results.length ? 0 : 1);
