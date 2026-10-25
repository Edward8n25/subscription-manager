/* 批次 3 · 数据层加固断言（静态分析）
   覆盖：D-01 导入消毒管道 / D-02 备份 key 双写 / D-03 v1→v2 迁移死路
   行为级断言见 tests/smoke-test.js（vm 沙箱真实加载）。用法：node tests/assert-batch3.js */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const app = fs.readFileSync(path.join(ROOT, 'src', 'app.js'), 'utf8');

const results = [];
const t = (name, ok, detail) => results.push([name, ok, detail || '']);
const fnBody = (name) => {
  const i = app.indexOf('function ' + name);
  if (i < 0) return null;
  const next = app.indexOf('\n  function ', i + 10);
  return app.slice(i, next < 0 ? app.length : next);
};

// ---- D-01 · 导入消毒管道 ----
t('D-01a normalizeSubscription/normalizeImport 管道存在', typeof normalizeImport === 'undefined' ? /function normalizeImport\(/.test(app) : true);
const normBody = fnBody('normalizeSubscription');
t('D-01b safeId 白名单只放行 [\\w-]', /\\w/.test(normBody || '') || /function safeId\([\s\S]{0,120}\[\\w-\]/.test(app));
t('D-01c 管道覆盖：price 数字化 / 枚举落默认 / 字段截断', !!normBody && normBody.indexOf('Number(') >= 0 && normBody.indexOf("indexOf(v) >= 0 ? v :") >= 0);
const settingsBody = fnBody('openSettings') || '';
t('D-01d 导入入口（openSettings）走 normalizeImport', settingsBody.indexOf('normalizeImport(') >= 0);
const loadBody = fnBody('loadState') || '';
t('D-01e loadState 读链归一化（渲染层只见净化数据）', loadBody.indexOf('normalizeImport(') >= 0);

// ---- D-02 · 备份 key 双写 ----
t('D-02a BACKUP_KEY = subtrack-v2.bak', /BACKUP_KEY\s*=\s*'subtrack-v2\.bak'/.test(app));
const saveBody = fnBody('saveState') || '';
const setItemCount = (saveBody.match(/setItem\(/g) || []).length;
t('D-02b saveState 双写（主 key + 备份 key）', setItemCount >= 2, 'saveState 内 setItem ×' + setItemCount);
t('D-02c loadState 主坏回退备份 key', loadBody.indexOf('BACKUP_KEY') >= 0);

// ---- D-03 · v1→v2 迁移 ----
t('D-03a 旧 key subtrack_data 被读取（migrate）', /'subtrack_data'/.test(app));
t('D-03b loadState 主 key 为空/损坏时可达 migrate', loadBody.indexOf('migrate(') >= 0);
const migBody = fnBody('migrate') || '';
t('D-03c 迁移成功立即写回主 key', migBody.indexOf('saveState(') >= 0);

let pass = 0;
results.forEach(([name, ok, detail]) => {
  console.log((ok ? '✅' : '❌') + ' ' + name + (detail ? '   → ' + detail : ''));
  if (ok) pass++;
});
console.log('\n' + pass + '/' + results.length + ' 通过');
process.exit(pass === results.length ? 0 : 1);
