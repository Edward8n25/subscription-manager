# SubTrack 数据模型

> 设计遵循个人 PWA 开发规范 v3；本文档仅记录 SubTrack 特有设计。

---

## Storage Key

```
localStorage['subtrack-v2'] = {        // 主 key
  v: 2,
  subscriptions: [
    {
      id: string,           // uid()，导入数据经 safeId 白名单（[\w-]），不合规重生成
      name: string,         // 订阅名称（≤50 字）
      tag: string,          // 用户自定义标签（≤20 字，用于筛选/分组）
      serviceType: 'streaming' | 'cloud' | 'devTools' | 'office' | 'gaming' | 'music' | 'ai' | 'reading' | 'other',
      paymentType: 'free' | 'monthly' | 'yearly' | 'oneTime',
      lastRenewalDate: 'YYYY-MM-DD' | '',
      nextRenewalDate: 'YYYY-MM-DD',
      price: number,        // 元，非负
      billingCycle: 'monthly' | 'quarterly' | 'yearly' | 'custom',
      feeDetails: string,   // 备注（≤500 字）
      reminderRule: '7days' | '14days' | '30days' | 'none',
      corePurpose: 'personal' | 'work' | 'family',
      order: number,        // 随数据保存；排序 UI 不消费（见「UI 关键决策」）
      createdAt: timestamp,
      updatedAt: timestamp
    }
  ]
}

localStorage['subtrack-v2.bak'] = { … }   // 备份 key：与主 key 双写，主 key 损坏/缺失时自动恢复并写回

localStorage['subtrack-prefs'] = {
  sortBy: 'nextRenewalDate' | 'price' | 'name',
  tag: string | 'all',
  search: string
}

localStorage['subtrack-accent'] = 'green' | 'blue' | 'purple' | 'orange'   // 配色方案（1.1.0），非法值回落 green

localStorage['subtrack-theme'] = 'light' | 'dark' | 'auto'
```

读取链（规范 §13）：主 key → 归一化管道（类型收敛 / 枚举白名单 / 截断）→ 主坏回退备份 key（恢复即写回）→ v1 旧 key `subtrack_data` 迁移 → 安全空态。任何版本数据都走管道，不因版本不匹配清空数据。

---

## Schema 升级历史

| Schema | 时间 | 改动 |
|---|---|---|
| (v1) | 旧版 | 单独 key `subtrack_data`，结构相同 |
| v2 | 2026-08-11 | 合并到 `subtrack-v2`，从旧 key 自动迁移一次；新增 `order` 字段（2026-10-25 盘点核实：排序 UI 未消费该字段） |

迁移代码在 `app.js` 的 `migrate()` 函数。

---

## 关键计算

```js
// 月支出总额（本月内需要续费的所有订阅金额之和）
function calculateMonthlyTotal(subs) {
  var now = new Date();
  return subs.filter(s => 
    new Date(s.nextRenewalDate).getMonth() === now.getMonth() &&
    new Date(s.nextRenewalDate).getFullYear() === now.getFullYear()
  ).reduce((sum, s) => sum + (s.price || 0), 0);
}

// 年支出预估（按计费周期推算）
function calculateAnnualEstimate(subs) {
  return subs.reduce((sum, s) => {
    if (s.paymentType === 'free' || s.paymentType === 'oneTime') return sum;
    var p = s.price || 0;
    if (s.billingCycle === 'monthly') return sum + p * 12;
    if (s.billingCycle === 'quarterly') return sum + p * 4;
    if (s.billingCycle === 'yearly') return sum + p;
    return sum + p * 12;  // custom 按月算
  }, 0);
}

// 7 天内续费（即将到期）
function isExpiringSoon(dateStr) {
  var days = daysUntil(dateStr);
  return days !== null && days >= 0 && days <= 7;
}
```

---

## UI 关键决策

### 1. 主题：从 12 莫兰迪 → 1 主色
原版用 6 色 × 2 明暗 = 12 个莫兰迪主题，太复杂。新版用 Spotify 绿（#1db954）单主色 + 浅/深双主题，符合"极简克制"原则。

配色方案已实现（1.1.0，借鉴 habit-quit-tracker 的 `data-accent` 机制）：设置弹窗内四色切换，`data-accent` 属性只换 accent 系 token（accent / hover / on-accent / muted / tint×3），背景与文字保持中性；`subtrack-accent` key 持久化，非法值回落 green。
```js
// 已实现四色（主色即预留值，衍生 token 同构定义于 index.html [data-accent] 块）
var ACCENT_LIST = ['green', 'blue', 'purple', 'orange'];
```

### 2. 列表/详情/统计 三视图
- **列表**：项目多时用，每张卡片只显示关键信息
- **详情**：点击卡片进入，**大数字价格** + 四宫格（替代原版的侧滑面板）
- **统计**：顶栏图标进入，集中看月度/年支出

原版的"侧滑统计面板"在移动端体验不好（占满屏幕 + 看不到列表），改为独立页面更清晰。

### 3. 日历：4 档色阶
```js
function heatLevel(count) {
  if (!count) return 0;     // 0 次
  if (count === 1) return 1; // 1 次
  if (count === 2) return 2; // 2 次
  return 3;                  // 3+ 次
}
```

### 4. 排序字段

`order` 字段随数据创建/复制时维护，但当前排序 UI（按续费时间 / 价格 / 名称）不消费该字段，拖拽排序 UI 未实现（2026-10-25 盘点如实记录）。

---

## 与 quit-tracker 的复用

| 组件 | 复用方式 |
|---|---|
| 主题系统 | 直接复制 `applyTheme()` 逻辑 |
| 模态框 | 复用 `showModal`/`closeModal` |
| Toast | 复用 `toast()` 函数 |
| 紧急工具 | 复用 `esc()` 转义函数 |
| 月历渲染 | 复用 `renderMonth` 逻辑（改用订阅数据） |
| Service Worker | 复用 `sw.js` 模板 |

差异：详情页用**大数字价格**而不是大计时器，但布局结构一致（四宫格 + 字段列表 + 日历）。
