/* 冒烟测试：vm 沙箱 + stub DOM/localStorage 加载真实 src/app.js
   覆盖：加载不崩、列表/空态渲染、CRUD 落盘、__st API、esc 转义、状态徽章
   盲区（规范 §16）：弹窗挂载后内部链路（querySelector 恒 null）——由 tests/assert-*.js 静态断言补位
   用法：node tests/smoke-test.js */
const vm = require('vm');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const code = fs.readFileSync(path.join(ROOT, 'src', 'app.js'), 'utf8');

// ---- stub DOM（结构抄自样板 quit-tracker tests/smoke-test.js）----
function makeEl() {
  return {
    innerHTML: '',
    style: {},
    className: '',
    classList: { add(){}, remove(){}, toggle(){} },
    setAttribute(){}, getAttribute(){ return null; },
    addEventListener(){}, removeEventListener(){},
    appendChild(){}, remove(){}, focus(){}, click(){},
    querySelector(){ return null; }, querySelectorAll(){ return []; },
    textContent: ''
  };
}

function makeSandbox(preset, hash) {
  const store = Object.assign({}, preset || {});
  const localStorageStub = {
    getItem: k => (k in store ? store[k] : null),
    setItem: (k, v) => { store[k] = String(v); },
    removeItem: k => { delete store[k]; }
  };
  const main = makeEl();
  const documentStub = {
    readyState: 'complete',
    // documentElement 属性真实存储（applyTheme 写 data-theme/data-accent，断言可读回）
    documentElement: {
      attrs: { 'data-theme': 'light' },
      setAttribute(k, v) { this.attrs[k] = v; },
      getAttribute(k) { return k in this.attrs ? this.attrs[k] : null; }
    },
    body: makeEl(),
    getElementById: () => main,
    querySelector: () => null,
    querySelectorAll: () => [],
    createElement: makeEl,
    addEventListener(){},
    activeElement: null
  };
  const windowStub = {
    scrollTo(){}, addEventListener(){},
    matchMedia: () => ({ matches: false, addEventListener(){} }),
    location: { hash: hash || '', search: '' },
    navigator: {},
    document: documentStub,
    localStorage: localStorageStub,
    setInterval: () => 1, clearInterval(){},
    setTimeout, clearTimeout
  };
  const sandbox = {
    window: windowStub, document: documentStub, localStorage: localStorageStub,
    navigator: {}, location: windowStub.location, console, setTimeout, clearTimeout,
    setInterval: () => 1, clearInterval(){},
    Date, Math, JSON, Array, Object, String, Number, isNaN, parseInt
  };
  vm.createContext(sandbox);
  return { sandbox, main, store };
}

function loadApp(preset, hash) {
  const ctx = makeSandbox(preset, hash);
  let threw = null;
  try { vm.runInContext(code, ctx.sandbox); } catch (e) { threw = e; }
  return Object.assign(ctx, { threw });
}

const results = [];
const day = 86400000;
function iso(ts) { return new Date(ts).toISOString().slice(0, 10); }
function sub(over) {
  return Object.assign({
    id: 't1', name: '测试订阅', tag: '测试', serviceType: 'streaming',
    paymentType: 'monthly', lastRenewalDate: '', nextRenewalDate: iso(Date.now() + 30 * day),
    price: 25, billingCycle: 'monthly', feeDetails: '', reminderRule: '7days',
    corePurpose: 'personal', order: 0, createdAt: Date.now() - 10 * day, updatedAt: Date.now()
  }, over || {});
}
function presetOf(subs) {
  return { 'subtrack-v2': JSON.stringify({ v: 2, subscriptions: subs }) };
}
// 安全 parse：断言里读回 store 数据用（未修复态主 key 可能仍是坏 JSON）
function safeParseJSON(raw) {
  try { const d = JSON.parse(raw); return (d && typeof d === 'object') ? d : null; }
  catch (e) { return null; }
}

// ---- 空库 ----
const empty = loadApp();
results.push(['空库加载不抛异常', empty.threw === null, empty.threw && empty.threw.message]);
results.push(['空库渲染空态与工具栏', empty.main.innerHTML.indexOf('还没有订阅') >= 0 && empty.main.innerHTML.indexOf('searchInput') >= 0]);
const st = empty.sandbox.window.__st;
const API = ['openNew', 'openEdit', 'openDetail', 'goHome', 'closeModal', 'confirmDelete'];
results.push(['__st API 完整', !!st && API.every(k => typeof st[k] === 'function')]);

// ---- 正常数据渲染 ----
const one = loadApp(presetOf([sub()]));
results.push(['单条加载不抛异常', one.threw === null, one.threw && one.threw.message]);
const card = one.main.innerHTML;
results.push(['卡片渲染名称与价格', card.indexOf('测试订阅') >= 0 && card.indexOf('¥25.00') >= 0 && card.indexOf('/月') >= 0]);
results.push(['未来 30 天无状态徽章', card.indexOf('badge expired') < 0 && card.indexOf('badge soon') < 0]);

// ---- 状态徽章语义 ----
const soon = loadApp(presetOf([sub({ nextRenewalDate: iso(Date.now()) })]));
results.push(['今天到期 → 即将续费徽章', soon.main.innerHTML.indexOf('badge soon') >= 0 && soon.main.innerHTML.indexOf('即将续费') >= 0]);
const past = loadApp(presetOf([sub({ nextRenewalDate: iso(Date.now() - 2 * day) })]));
results.push(['已过期 2 天 → 已过期徽章', past.main.innerHTML.indexOf('badge expired') >= 0]);

// ---- free 类型 ----
const free = loadApp(presetOf([sub({ paymentType: 'free', price: 0 })]));
results.push(['free 类型显示「免费」且无 ¥ 价格', free.main.innerHTML.indexOf('>免费<') >= 0]);

// ---- XSS 渲染防线（esc 兜底）----
const xss = loadApp(presetOf([sub({ name: '<img src=x onerror=alert(1)>安全文本' })]));
const xc = xss.main.innerHTML;
results.push(['XSS name 被转义（无原始 <img 标签，文本保留）', xss.threw === null && xc.indexOf('<img') < 0 && xc.indexOf('&lt;img') >= 0 && xc.indexOf('安全文本') >= 0]);

// ---- 脏 schema 不崩、不静默清空可见数据面 ----
// v 字段缺失：loadState 走 migrate（D-03 修复前为空态；修复后应迁移 subtrack_data——两条路径都不允许崩）
const dirty = loadApp({ 'subtrack-v2': JSON.stringify({ subscriptions: [sub()] }) });
results.push(['schema 缺 v 字段加载不崩', dirty.threw === null, dirty.threw && dirty.threw.message]);

// ---- 批次 3 · 数据层加固（行为级）----
// D-01: 畸形数据（模拟未消毒导入的落盘结果：恶意 id / 字符串 price / 非字符串 name / 非法枚举 / 坏日期）
const malformed = loadApp(presetOf([
  sub({ id: "x');alert(1);('x", price: '78', name: 123, paymentType: 'weird', billingCycle: 42, nextRenewalDate: 'not-a-date' })
]));
const mHtml = malformed.main.innerHTML;
const mSaved = safeParseJSON(malformed.store['subtrack-v2']);
const mSub0 = mSaved && Array.isArray(mSaved.subscriptions) ? mSaved.subscriptions[0] : null;
results.push(['D-01 畸形落盘数据加载不崩', malformed.threw === null, malformed.threw && malformed.threw.message]);
results.push(['D-01 恶意 id 被重生成（onclick 注入面断绝）', mHtml.length > 0 && !/alert\(1\)/.test(mHtml)]);
results.push(['D-01 重生成 id 满足白名单', !!mSub0 && /^[\w-]+$/.test(mSub0.id), mSub0 && mSub0.id]);
results.push(['D-01 price 字符串数字化（¥78.00）', mHtml.indexOf('¥78.00') >= 0]);
results.push(['D-01 非字符串 name 安全渲染', mHtml.indexOf('123') >= 0]);
results.push(['D-01 非法枚举落默认（paymentType→monthly、billingCycle→monthly）', !!mSub0 && mSub0.paymentType === 'monthly' && mSub0.billingCycle === 'monthly' && mHtml.indexOf('每月') >= 0]);

// D-02: 主 key 损坏 → 备份 key 恢复 + 写回主 key
const good = JSON.stringify({ v: 2, subscriptions: [sub({ name: '备份恢复' })] });
const d2 = loadApp({ 'subtrack-v2': '{broken json', 'subtrack-v2.bak': good });
const d2Back = safeParseJSON(d2.store['subtrack-v2']);
results.push(['D-02 主 key 损坏从备份恢复渲染', d2.threw === null && d2.main.innerHTML.indexOf('备份恢复') >= 0]);
results.push(['D-02 恢复成功立即写回主 key', !!d2Back && d2Back.v === 2 && d2Back.subscriptions[0].name === '备份恢复']);

// D-02c: 主备双坏 + 无 legacy → 安全空态
const dead = loadApp({ 'subtrack-v2': '{{{', 'subtrack-v2.bak': '{{{' });
results.push(['D-02c 双 key 损坏安全空态不崩', dead.threw === null && dead.main.innerHTML.indexOf('还没有订阅') >= 0]);

// D-03: 主 key 缺失 + v1 旧 key → 自动迁移（README 宣称的路径，修复前是死路）
const legacy = JSON.stringify({ subscriptions: [sub({ name: '旧版数据', price: 30 })] });
const d3 = loadApp({ 'subtrack_data': legacy });
const d3Back = safeParseJSON(d3.store['subtrack-v2']);
results.push(['D-03 v1 旧 key 自动迁移渲染', d3.threw === null && d3.main.innerHTML.indexOf('旧版数据') >= 0]);
results.push(['D-03 迁移后立即写回主 key', !!d3Back && d3Back.v === 2 && d3Back.subscriptions.length === 1]);

// ---- 批次 5 · #seed 确认守卫（P-01，行为级）----
const seededEmpty = loadApp(null, '#seed');
const seededEmptyData = safeParseJSON(seededEmpty.store['subtrack-v2']);
results.push(['P-01 空库 + #seed 直接灌入 6 条', seededEmpty.threw === null && !!seededEmptyData && seededEmptyData.subscriptions.length === 6]);
const guarded = loadApp(presetOf([sub({ name: '真实数据' })]), '#seed');
const guardedAfter = safeParseJSON(guarded.store['subtrack-v2']);
// stub 盲区说明：确认弹窗 onMount 内 querySelector 恒 null 会抛错（规范 §16 smoke 已知盲区），
// 故本断言只验证核心语义「真实数据不被直接覆盖」，加载抛错属测试伪影不判失败
results.push(['P-01 有数据 + #seed 不直接覆盖（等确认）', !!guardedAfter
  && guardedAfter.subscriptions.length === 1 && guardedAfter.subscriptions[0].name === '真实数据']);

// ---- 批次 6 · 折算口径统一（D-04，行为级）----
// 矛盾组合：按月支付 + 按年周期，price=100 → 修复后月折算 100/12=8.33、年折算 100（修复前 1200/0）
const conflict = loadApp(presetOf([sub({ paymentType: 'monthly', billingCycle: 'yearly', price: 100 })]));
conflict.sandbox.window.__st.openDetail('t1');
const ch = conflict.main.innerHTML;
results.push(['D-04 矛盾组合月折算走 billingCycle（年费 ÷12 = ¥8.33）', conflict.threw === null && ch.indexOf('¥8.33') >= 0]);
results.push(['D-04 矛盾组合年折算走 billingCycle（旧口径 ¥1200.00 不再出现）', ch.indexOf('每年折算') >= 0 && ch.indexOf('¥1200.00') < 0 && ch.indexOf('年费 ÷ 12') >= 0]);
const q = loadApp(presetOf([sub({ paymentType: 'monthly', billingCycle: 'quarterly', price: 90 })]));
q.sandbox.window.__st.openDetail('t1');
results.push(['D-04 quarterly 折算（¥30.00 / ¥360.00）', q.threw === null && q.main.innerHTML.indexOf('¥30.00') >= 0 && q.main.innerHTML.indexOf('¥360.00') >= 0]);
const normal = loadApp(presetOf([sub({ paymentType: 'monthly', billingCycle: 'monthly', price: 25 })]));
normal.sandbox.window.__st.openDetail('t1');
results.push(['D-04 正常组合折算不变（¥25.00 / ¥300.00）', normal.threw === null && normal.main.innerHTML.indexOf('¥25.00') >= 0 && normal.main.innerHTML.indexOf('¥300.00') >= 0]);
const ot = loadApp(presetOf([sub({ paymentType: 'oneTime', billingCycle: 'monthly', price: 200 })]));
ot.sandbox.window.__st.openDetail('t1');
results.push(['D-04 一次性/免费无月/年折算（¥0.00）', ot.threw === null && ot.main.innerHTML.indexOf('¥0.00') >= 0]);

// ---- 配色方案（1.1.0 新功能，行为级）----
const accDefault = loadApp();
results.push(['ACCENT 默认 data-accent=green', accDefault.threw === null && accDefault.sandbox.document.documentElement.getAttribute('data-accent') === 'green']);
const accOrange = loadApp({ 'subtrack-accent': 'orange' });
results.push(['ACCENT 持久化读取（subtrack-accent=orange）', accOrange.threw === null && accOrange.sandbox.document.documentElement.getAttribute('data-accent') === 'orange']);
const accBad = loadApp({ 'subtrack-accent': 'hacker' });
results.push(['ACCENT 非法值回落 green', accBad.threw === null && accBad.sandbox.document.documentElement.getAttribute('data-accent') === 'green']);

// ---- 渲染输出统计 ----
let pass = 0;
results.forEach(([name, ok, detail]) => {
  console.log((ok ? '✅' : '❌') + ' ' + name + (detail ? '   → ' + detail : ''));
  if (ok) pass++;
});
console.log('\n' + pass + '/' + results.length + ' 通过');
process.exit(pass === results.length ? 0 : 1);
