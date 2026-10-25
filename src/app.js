/* =========================================================================
   SubTrack · 订阅管理（按 quit-tracker 设计规范重写）
   - 单文件 IIFE，零依赖
   - 主题：浅/深 + Spotify 绿主色
   - 数据：localStorage
   - 功能：CRUD / 搜索 / 标签筛选 / 排序 / 批量操作 / 日历 / 统计 / 导入导出
   ========================================================================= */

(function () {
  'use strict';

  // ============== 常量 ==============
  var STORAGE_KEY = 'subtrack-v2';
  var BACKUP_KEY = 'subtrack-v2.bak';
  var LEGACY_KEY = 'subtrack_data';
  var THEME_KEY = 'subtrack-theme';
  var ACCENT_KEY = 'subtrack-accent'; // 配色方案（设置内切换）：green | blue | purple | orange，默认 green（1.1.0）
  var ACCENT_LIST = ['green', 'blue', 'purple', 'orange'];
  var PREFS_KEY = 'subtrack-prefs';
  var SCHEMA_VERSION = 2;

  var SERVICE_TYPES = {
    streaming: { label: '流媒体', icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="5 3 19 12 5 21 5 3"/></svg>' },
    cloud:     { label: '云存储', icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z"/></svg>' },
    devTools:  { label: '开发工具', icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>' },
    office:    { label: '办公', icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>' },
    gaming:    { label: '游戏', icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="6" y1="12" x2="10" y2="12"/><line x1="8" y1="10" x2="8" y2="14"/><line x1="15" y1="13" x2="15.01" y2="13"/><line x1="18" y1="11" x2="18.01" y2="11"/><rect x="2" y="6" width="20" height="12" rx="2"/></svg>' },
    music:     { label: '音乐', icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>' },
    ai:        { label: 'AI 服务', icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2a3 3 0 0 0-3 3v1H7a3 3 0 0 0-3 3v3a3 3 0 0 0 1 2.2V18a3 3 0 0 0 3 3h2v1a3 3 0 0 0 6 0v-1h2a3 3 0 0 0 3-3v-3.8a3 3 0 0 0 1-2.2V9a3 3 0 0 0-3-3h-2V5a3 3 0 0 0-3-3z"/><circle cx="9" cy="10" r="1" fill="currentColor"/><circle cx="15" cy="10" r="1" fill="currentColor"/></svg>' },
    reading:   { label: '阅读', icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>' },
    other:     { label: '其他', icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>' }
  };

  var PAYMENT_TYPES = {
    free:     '免费',
    monthly:  '按月',
    yearly:   '按年',
    oneTime:  '一次性'
  };

  var BILLING_CYCLES = {
    monthly:    '每月',
    quarterly:  '每季',
    yearly:     '每年',
    custom:     '自定义'
  };

  var REMINDER_RULES = {
    '7days':  '提前 7 天',
    '14days': '提前 14 天',
    '30days': '提前 30 天',
    'none':   '不提醒'
  };

  var CORE_PURPOSES = {
    personal: '个人',
    work:     '工作',
    family:   '家庭'
  };

  // ============== 数据层 ==============
  // 读取链（规范 §13）：主 key → safeParse → 备份 key 回退（恢复即写回主 key）→ v1 旧 key 迁移 → 安全空态。
  // 任何来源的数据（读取/迁移/导入）一律先过 normalizeImport 管道——渲染层只见净化数据。
  var state = loadState();
  var prefs = loadPrefs();

  function readRaw(key) {
    try { return localStorage.getItem(key); } catch (e) { return null; }
  }

  function safeParse(raw) {
    if (!raw) return null;
    try {
      var d = JSON.parse(raw);
      return (d && typeof d === 'object') ? d : null;
    } catch (e) { return null; }
  }

  // id 会拼进 onclick/data-* 属性：只放行 [\w-]，不合规一律重生成（注入面断绝）
  function safeId(raw) {
    return (typeof raw === 'string' && /^[\w-]+$/.test(raw)) ? raw : uid();
  }

  // 单条订阅归一化：类型收敛 + 枚举白名单 + 长度对齐表单 maxlength
  function normalizeSubscription(s) {
    if (!s || typeof s !== 'object') return null;
    function num(v) { v = Number(v); return isNaN(v) ? 0 : v; }
    function str(v) { return typeof v === 'string' ? v : (v == null ? '' : String(v)); }
    function date(v) { return (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v)) ? v : ''; }
    function pick(v, keys, dft) { return keys.indexOf(v) >= 0 ? v : dft; }
    return {
      id: safeId(s.id),
      name: str(s.name).slice(0, 50),
      tag: str(s.tag).slice(0, 20),
      serviceType: pick(s.serviceType, Object.keys(SERVICE_TYPES), 'other'),
      paymentType: pick(s.paymentType, ['free', 'monthly', 'yearly', 'oneTime'], 'monthly'),
      lastRenewalDate: date(s.lastRenewalDate),
      nextRenewalDate: date(s.nextRenewalDate),
      price: Math.max(0, num(s.price)),
      billingCycle: pick(s.billingCycle, ['monthly', 'quarterly', 'yearly', 'custom'], 'monthly'),
      feeDetails: str(s.feeDetails).slice(0, 500),
      reminderRule: pick(s.reminderRule, ['7days', '14days', '30days', 'none'], '7days'),
      corePurpose: pick(s.corePurpose, ['personal', 'work', 'family'], 'personal'),
      order: num(s.order),
      createdAt: num(s.createdAt) || Date.now(),
      updatedAt: num(s.updatedAt) || Date.now()
    };
  }

  function normalizeImport(list) {
    var out = [];
    if (!Array.isArray(list)) return out;
    list.forEach(function (s) {
      var n = normalizeSubscription(s);
      if (n) out.push(n);
    });
    return out;
  }

  function emptyState() {
    return { v: SCHEMA_VERSION, subscriptions: [] };
  }

  function loadState() {
    var raw = readRaw(STORAGE_KEY);
    var data = safeParse(raw);
    if (data && Array.isArray(data.subscriptions)) {
      // 版本标记不符 → 归一化收编，绝不因版本不匹配清空数据（规范 §13）
      var needsRewrite = data.v !== SCHEMA_VERSION;
      data = { v: SCHEMA_VERSION, subscriptions: normalizeImport(data.subscriptions) };
      // 净化结果落盘（含首次消毒 D-01 脏数据的场景），下次打开不再重复消毒
      if (needsRewrite || JSON.stringify(data) !== raw) saveState(data);
      return data;
    }
    // 主 key 缺失/损坏 → 备份 key 回退，恢复成功立即写回主 key + toast
    var bak = safeParse(readRaw(BACKUP_KEY));
    if (bak && Array.isArray(bak.subscriptions)) {
      bak = { v: SCHEMA_VERSION, subscriptions: normalizeImport(bak.subscriptions) };
      saveState(bak);
      toast('主数据异常，已从备份恢复', 'warning');
      return bak;
    }
    // 主备均不可用 → v1 旧 key 迁移（README 宣称的自动迁移路径）
    return migrate();
  }

  // 从 v1（原 subtrack_data）迁移；成功立即写回主 key，旧 key 保留作备份
  function migrate() {
    var old = safeParse(readRaw(LEGACY_KEY));
    if (old && Array.isArray(old.subscriptions) && old.subscriptions.length > 0) {
      var migrated = { v: SCHEMA_VERSION, subscriptions: normalizeImport(old.subscriptions) };
      saveState(migrated);
      return migrated;
    }
    return emptyState();
  }

  // 双写主 key + 备份 key（D-02）；saveState(data) 的显式入参供 loadState 恢复路径使用——
  // 该路径在 var state 求值期内，默认参数会取到 undefined
  function saveState(data) {
    var json = JSON.stringify(data || state);
    try {
      localStorage.setItem(STORAGE_KEY, json);
    } catch (e) {
      toast('保存失败：' + e.message, 'error');
    }
    try {
      localStorage.setItem(BACKUP_KEY, json);
    } catch (e) { /* 备份失败静默（配额超限取舍，主 key 已失败时无意义重试） */ }
  }

  function loadPrefs() {
    try {
      var raw = localStorage.getItem(PREFS_KEY);
      if (!raw) return { sortBy: 'nextRenewalDate', tag: 'all', search: '' };
      return Object.assign({ sortBy: 'nextRenewalDate', tag: 'all', search: '' }, JSON.parse(raw));
    } catch (e) {
      return { sortBy: 'nextRenewalDate', tag: 'all', search: '' };
    }
  }

  function savePrefs() {
    try { localStorage.setItem(PREFS_KEY, JSON.stringify(prefs)); }
    catch (e) { /* ignore */ }
  }

  function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }

  // ============== 业务：CRUD ==============
  function getById(id) {
    return state.subscriptions.find(function (s) { return s.id === id; });
  }

  function addSubscription(data) {
    var sub = Object.assign({
      id: uid(),
      name: '',
      tag: '',
      serviceType: 'other',
      paymentType: 'monthly',
      lastRenewalDate: '',
      nextRenewalDate: '',
      price: 0,
      billingCycle: 'monthly',
      feeDetails: '',
      reminderRule: '7days',
      corePurpose: 'personal',
      order: state.subscriptions.length,
      createdAt: Date.now(),
      updatedAt: Date.now()
    }, data);
    state.subscriptions.push(sub);
    saveState();
    return sub;
  }

  function updateSubscription(id, data) {
    var sub = getById(id);
    if (!sub) return null;
    Object.keys(data).forEach(function (k) { sub[k] = data[k]; });
    sub.updatedAt = Date.now();
    saveState();
    return sub;
  }

  function deleteSubscription(id) {
    state.subscriptions = state.subscriptions.filter(function (s) { return s.id !== id; });
    saveState();
  }

  function deleteSubscriptions(ids) {
    var set = { };
    ids.forEach(function (id) { set[id] = true; });
    state.subscriptions = state.subscriptions.filter(function (s) { return !set[s.id]; });
    saveState();
  }

  function duplicateSubscription(id) {
    var orig = getById(id);
    if (!orig) return null;
    var copy = Object.assign({}, orig, {
      id: uid(),
      name: orig.name + ' (副本)',
      order: state.subscriptions.length,
      createdAt: Date.now(),
      updatedAt: Date.now()
    });
    state.subscriptions.push(copy);
    saveState();
    return copy;
  }

  function updateOrder(orderedIds) {
    orderedIds.forEach(function (id, i) {
      var s = getById(id);
      if (s) s.order = i;
    });
    saveState();
  }

  // ============== 工具 ==============
  function pad2(n) { return n < 10 ? '0' + n : '' + n; }

  function formatDate(d) {
    if (!d) return '';
    var date = (d instanceof Date) ? d : new Date(d);
    if (isNaN(date.getTime())) return '';
    return date.getFullYear() + '/' + pad2(date.getMonth() + 1) + '/' + pad2(date.getDate());
  }

  function todayISO() {
    var d = new Date();
    return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate());
  }

  function daysUntil(dateStr) {
    if (!dateStr) return null;
    var d = new Date(dateStr);
    var now = new Date();
    now.setHours(0, 0, 0, 0);
    d.setHours(0, 0, 0, 0);
    return Math.round((d - now) / 86400000);
  }

  function isExpired(d) {
    var days = daysUntil(d);
    return days !== null && days < 0;
  }

  function isExpiringSoon(d) {
    var days = daysUntil(d);
    return days !== null && days >= 0 && days <= 7;
  }

  function getServiceLabel(t) { return (SERVICE_TYPES[t] || SERVICE_TYPES.other).label; }
  function getServiceIcon(t) { return (SERVICE_TYPES[t] || SERVICE_TYPES.other).icon; }
  function getPaymentLabel(t) { return PAYMENT_TYPES[t] || t || ''; }
  function getBillingLabel(t) { return BILLING_CYCLES[t] || t || ''; }
  function getReminderLabel(t) { return REMINDER_RULES[t] || '不提醒'; }
  function getPurposeLabel(t) { return CORE_PURPOSES[t] || t || ''; }

  function getPriceUnit(t) {
    var u = { free: '', monthly: '月', yearly: '年', oneTime: '次' };
    return u[t] || '次';
  }

  function esc(s) {
    if (s == null) return '';
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  // ============== 统计 ==============
  function calculateMonthlyTotal(subs) {
    var now = new Date();
    var m = now.getMonth(); var y = now.getFullYear();
    return subs.filter(function (s) {
      if (!s.nextRenewalDate) return false;
      var d = new Date(s.nextRenewalDate);
      return d.getMonth() === m && d.getFullYear() === y;
    }).reduce(function (sum, s) { return sum + (s.price || 0); }, 0);
  }

  function calculateAnnualEstimate(subs) {
    return subs.reduce(function (sum, s) {
      if (s.paymentType === 'free' || s.paymentType === 'oneTime') return sum;
      var p = s.price || 0;
      if (s.billingCycle === 'monthly') return sum + p * 12;
      if (s.billingCycle === 'quarterly') return sum + p * 4;
      if (s.billingCycle === 'yearly') return sum + p;
      return sum + p * 12; // custom 按月
    }, 0);
  }

  function calculateTagStats(subs) {
    var stats = {};
    subs.forEach(function (s) {
      var t = s.tag || '未分类';
      if (!stats[t]) stats[t] = { count: 0, total: 0 };
      stats[t].count++;
      stats[t].total += s.price || 0;
    });
    return stats;
  }

  function getExpiringSoon(subs) {
    return subs.filter(function (s) { return isExpiringSoon(s.nextRenewalDate); })
      .sort(function (a, b) { return new Date(a.nextRenewalDate) - new Date(b.nextRenewalDate); });
  }

  function getExpired(subs) {
    return subs.filter(function (s) { return isExpired(s.nextRenewalDate); });
  }

  function getAllTags(subs) {
    var set = {};
    subs.forEach(function (s) { if (s.tag) set[s.tag] = true; });
    return Object.keys(set).sort();
  }

  // ============== 渲染 ==============
  var main = document.getElementById('main');
  var view = 'list'; // 'list' | 'detail' | 'stats'
  var detailId = null;
  var calMonthOffset = 0;
  var calView = 'month'; // 'month' | 'year'
  var selectedIds = {}; // Set 模拟
  var searchInputDebounce = null;

  function render() {
    if (view === 'list') renderList();
    else if (view === 'detail') renderDetail();
    else if (view === 'stats') renderStats();
  }

  // ============== 列表 ==============
  function renderList() {
    var subs = state.subscriptions.slice();
    var html = '';

    // 搜索框 + 新增按钮
    html += '<div class="toolbar">'
         + '  <div class="search-box">'
         + '    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>'
         + '    <input type="text" id="searchInput" placeholder="搜索订阅..." value="' + esc(prefs.search) + '">'
         + '  </div>'
         + '  <button class="btn primary" id="addBtn">'
         + '    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>'
         + '    新增'
         + '  </button>'
         + '</div>';

    // 标签筛选
    var tags = ['all'].concat(getAllTags(subs));
    html += '<div class="tag-filters" id="tagFilters">';
    tags.forEach(function (t) {
      var active = prefs.tag === t;
      var label = t === 'all' ? '全部' : esc(t);
      html += '<button class="tag-filter' + (active ? ' active' : '') + '" data-tag="' + esc(t) + '">' + label + '</button>';
    });
    html += '</div>';

    // 排序
    html += '<div class="sort-bar">'
         + '  <span>共 ' + subs.length + ' 项 ·</span>'
         + '  <select id="sortSelect">'
         + '    <option value="nextRenewalDate"' + (prefs.sortBy === 'nextRenewalDate' ? ' selected' : '') + '>按续费时间</option>'
         + '    <option value="price"' + (prefs.sortBy === 'price' ? ' selected' : '') + '>按价格</option>'
         + '    <option value="name"' + (prefs.sortBy === 'name' ? ' selected' : '') + '>按名称</option>'
         + '  </select>'
         + '</div>';

    // 过滤 + 排序
    var filtered = filterAndSort(subs, prefs);

    if (filtered.length === 0) {
      if (state.subscriptions.length === 0) {
        html += '<div class="empty">'
             + '  <div class="em">📦</div>'
             + '  <h3>还没有订阅</h3>'
             + '  <p>把第一个订阅加进来吧</p>'
             + '  <button class="btn primary" onclick="window.__st.openNew()">+ 新增订阅</button>'
             + '</div>';
      } else {
        html += '<div class="empty"><div class="em">🔍</div><h3>没找到匹配的订阅</h3><p>试试别的关键词或标签</p></div>';
      }
    } else {
      html += '<div class="card-list" id="cardList">';
      filtered.forEach(function (s) {
        html += renderCard(s);
      });
      html += '</div>';
    }

    // 批量操作栏（按需显示）
    if (Object.keys(selectedIds).length > 0) {
      html += '<div class="batch-actions">'
           + '  <div class="info">已选 <b>' + Object.keys(selectedIds).length + '</b> 项</div>'
           + '  <button class="btn ghost small" id="cancelSelectBtn">取消</button>'
           + '  <button class="btn danger small" id="batchDeleteBtn">删除</button>'
           + '</div>';
    }

    main.innerHTML = html;
    bindListEvents();
  }

  function filterAndSort(subs, p) {
    var out = subs.slice();
    if (p.tag && p.tag !== 'all') {
      out = out.filter(function (s) { return s.tag === p.tag; });
    }
    var q = (p.search || '').trim().toLowerCase();
    if (q) {
      out = out.filter(function (s) {
        return (s.name && s.name.toLowerCase().indexOf(q) >= 0) ||
               (s.tag && s.tag.toLowerCase().indexOf(q) >= 0);
      });
    }
    out.sort(function (a, b) {
      var va, vb;
      switch (p.sortBy) {
        case 'price': va = a.price || 0; vb = b.price || 0; break;
        case 'name':  va = (a.name || '').toLowerCase(); vb = (b.name || '').toLowerCase(); break;
        case 'nextRenewalDate':
        default:      va = a.nextRenewalDate || ''; vb = b.nextRenewalDate || ''; break;
      }
      if (va < vb) return -1;
      if (va > vb) return 1;
      return 0;
    });
    return out;
  }

  function renderCard(s) {
    var selected = !!selectedIds[s.id];
    var expiredClass = isExpired(s.nextRenewalDate) ? 'expired' : (isExpiringSoon(s.nextRenewalDate) ? 'soon' : '');
    var free = s.paymentType === 'free';
    var priceText = free ? '免费' : '¥' + (s.price || 0).toFixed(2);
    var priceUnit = free ? '' : '/' + getPriceUnit(s.paymentType);

    var badges = '';
    if (free) badges += '<span class="badge free">免费</span>';
    else if (isExpired(s.nextRenewalDate)) badges += '<span class="badge expired">已过期</span>';
    else if (isExpiringSoon(s.nextRenewalDate)) badges += '<span class="badge soon">即将续费</span>';

    var html = ''
      + '<article class="subscription-card' + (selected ? ' selected' : '') + '" data-id="' + esc(s.id) + '">'
      + '  <div class="card-head">'
      + '    <div class="card-icon">' + getServiceIcon(s.serviceType) + '</div>'
      + '    <div class="card-title">' + esc(s.name) + '</div>'
      + (s.tag ? '<div class="card-tag">' + esc(s.tag) + '</div>' : '')
      + '  </div>'
      + '  <div class="card-price' + (free ? ' free' : '') + '">' + priceText + (priceUnit ? '<span class="card-price-unit">' + esc(priceUnit) + '</span>' : '') + '</div>'
      + (badges ? '<div class="badges">' + badges + '</div>' : '')
      + '  <div class="card-meta">'
      + '    <span>续费 <b class="' + expiredClass + '">' + (s.nextRenewalDate ? formatDate(s.nextRenewalDate) : '未设置') + '</b></span>'
      + '    <span>' + esc(getBillingLabel(s.billingCycle)) + '</span>'
      + '    <span>' + esc(getPurposeLabel(s.corePurpose)) + '</span>'
      + '  </div>'
      + (s.feeDetails ? '<div class="card-note"><span class="card-note-label">费用详情</span>' + esc(s.feeDetails) + '</div>' : '')
      + '  <div class="card-actions" data-card-actions="1">'
      + '    <button class="btn ghost small" data-act="edit" data-id="' + esc(s.id) + '">编辑</button>'
      + '    <button class="btn ghost small" data-act="copy" data-id="' + esc(s.id) + '">复制</button>'
      + '    <button class="btn danger small" data-act="del" data-id="' + esc(s.id) + '">删除</button>'
      + '  </div>'
      + '</article>';
    return html;
  }

  function bindListEvents() {
    // 搜索
    var sInput = main.querySelector('#searchInput');
    if (sInput) {
      sInput.addEventListener('input', function (e) {
        clearTimeout(searchInputDebounce);
        searchInputDebounce = setTimeout(function () {
          prefs.search = e.target.value;
          savePrefs();
          // 增量重渲染：保留 search input 焦点
          var wasFocused = sInput === document.activeElement;
          var pos = sInput.selectionStart;
          render();
          var ni = main.querySelector('#searchInput');
          if (ni) {
            ni.value = e.target.value;
            if (wasFocused) { ni.focus(); try { ni.setSelectionRange(pos, pos); } catch (e) {} }
          }
        }, 120);
      });
    }

    // 新增
    var addBtn = main.querySelector('#addBtn');
    if (addBtn) addBtn.addEventListener('click', openNew);
    var emptyAddBtn = main.querySelector('.empty .btn.primary');
    if (emptyAddBtn) emptyAddBtn.addEventListener('click', openNew);

    // 标签筛选
    var tagWrap = main.querySelector('#tagFilters');
    if (tagWrap) {
      tagWrap.addEventListener('click', function (e) {
        var btn = e.target.closest('.tag-filter');
        if (!btn) return;
        prefs.tag = btn.getAttribute('data-tag');
        savePrefs();
        render();
      });
    }

    // 排序
    var sortSel = main.querySelector('#sortSelect');
    if (sortSel) {
      sortSel.addEventListener('change', function (e) {
        prefs.sortBy = e.target.value;
        savePrefs();
        render();
      });
    }

    // 卡片操作（事件委托）
    var cardList = main.querySelector('#cardList');
    if (cardList) {
      cardList.addEventListener('click', handleCardClick);
    }

    // 批量操作
    var cancelBtn = main.querySelector('#cancelSelectBtn');
    if (cancelBtn) cancelBtn.addEventListener('click', clearSelection);
    var batchDel = main.querySelector('#batchDeleteBtn');
    if (batchDel) batchDel.addEventListener('click', batchDelete);
  }

  function handleCardClick(e) {
    var btn = e.target.closest('button[data-act]');
    if (btn) {
      e.stopPropagation();
      var id = btn.getAttribute('data-id');
      var act = btn.getAttribute('data-act');
      if (act === 'edit') openEdit(id);
      else if (act === 'copy') { duplicateSubscription(id); render(); toast('已复制', 'success'); }
      else if (act === 'del') confirmDelete(id);
      return;
    }
    var card = e.target.closest('.subscription-card');
    if (!card) return;
    var cid = card.getAttribute('data-id');
    // 进入详情
    openDetail(cid);
  }

  function clearSelection() {
    selectedIds = {};
    render();
  }

  function batchDelete() {
    var ids = Object.keys(selectedIds);
    if (ids.length === 0) return;
    showModal('批量删除', ''
      + '<p class="modal-tip">将永久删除选中的 <b>' + ids.length + '</b> 个订阅，此操作不可撤销。</p>'
      + '<div class="modal-actions">'
      + '  <button class="btn ghost" onclick="window.__st.closeModal()">取消</button>'
      + '  <button class="btn danger" id="qt-confirm">确认删除</button>'
      + '</div>',
      function (back) {
        back.querySelector('#qt-confirm').addEventListener('click', function () {
          deleteSubscriptions(ids);
          selectedIds = {};
          closeModal();
          render();
          toast('已删除 ' + ids.length + ' 个订阅', 'success');
        });
      });
  }

  // ============== 详情页 ==============
  var listScrollY = 0; // S-02：列表滚动位记忆

  // S-01：日历子状态复位（进详情/进统计必须复位，防上次翻月/视图残留——规范 §11 铁律 2）
  function resetCalState() {
    calMonthOffset = 0;
    calView = 'month';
  }

  function openDetail(id) {
    if (view === 'list') listScrollY = window.scrollY || 0; // S-02：仅从列表进详情时捕获（统计页进详情不污染）
    view = 'detail';
    detailId = id;
    resetCalState();
    render();
    window.scrollTo(0, 0);
  }

  function renderDetail() {
    var s = getById(detailId);
    if (!s) { view = 'list'; return renderList(); }

    // D-04（用户裁决 2026-10-25）：月/年折算统一走 billingCycle，paymentType 只作展示——
    // 与统计页 calculateAnnualEstimate 同口径；free/oneTime 不折算（同统计页排除逻辑）
    var p = s.price || 0;
    var isRecurring = s.paymentType !== 'free' && s.paymentType !== 'oneTime';
    var monthly = 0;
    var annual = 0;
    if (isRecurring) {
      if (s.billingCycle === 'monthly') { monthly = p; annual = p * 12; }
      else if (s.billingCycle === 'quarterly') { monthly = p / 3; annual = p * 4; }
      else if (s.billingCycle === 'yearly') { monthly = p / 12; annual = p; }
      else { monthly = p; annual = p * 12; } // custom 按月折算（同统计页口径）
    }
    var daysToRenewal = daysUntil(s.nextRenewalDate);
    var daysClass = '';
    var daysText = '—';
    if (daysToRenewal !== null) {
      if (daysToRenewal < 0) { daysText = '已过 ' + (-daysToRenewal) + ' 天'; daysClass = 'danger'; }
      else if (daysToRenewal === 0) { daysText = '今天'; daysClass = 'warning'; }
      else { daysText = '还有 ' + daysToRenewal + ' 天'; if (daysToRenewal <= 7) daysClass = 'warning'; }
    }

    var html = ''
      + '<div class="detail-head">'
      + '  <button class="back-btn" onclick="window.__st.goHome()" aria-label="返回">'
      + '    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>'
      + '  </button>'
      + '  <div class="detail-title">' + esc(s.name) + '</div>'
      + '  <div class="right">'
      + '    <button class="icon-btn" data-act="edit" data-id="' + esc(s.id) + '" aria-label="编辑">'
      + '      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>'
      + '    </button>'
      + '    <button class="icon-btn" data-act="del" data-id="' + esc(s.id) + '" aria-label="删除">'
      + '      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/></svg>'
      + '    </button>'
      + '  </div>'
      + '</div>';

    // 大价格区
    var priceText = s.paymentType === 'free' ? '免费' : '¥' + (s.price || 0).toFixed(2);
    var priceUnit = s.paymentType === 'free' ? '' : '/' + getPriceUnit(s.paymentType);
    html += '<div class="big-price">'
         + '  <div class="icon">' + getServiceIcon(s.serviceType) + '</div>'
         + '  <div class="price">' + priceText + (priceUnit ? '<span class="big-price-unit">' + esc(priceUnit) + '</span>' : '') + '</div>'
         + '  <div class="name">' + esc(s.tag || '未分类') + ' · ' + esc(getServiceLabel(s.serviceType)) + '</div>'
         + '</div>';

    // 数据四宫格
    html += '<div class="stat-grid">'
         + statCard('下次续费', daysText, s.nextRenewalDate ? formatDate(s.nextRenewalDate) : '未设置', daysClass)
         + statCard('每月折算', '¥' + monthly.toFixed(2), isRecurring ? cycleMonthlySub(s.billingCycle) : '—')
         + statCard('每年折算', '¥' + annual.toFixed(2), isRecurring ? cycleAnnualSub(s.billingCycle) : '—')
         + statCard('已使用', Math.max(0, Math.floor((Date.now() - s.createdAt) / 86400000)) + ' 天', '加入于 ' + formatDate(s.createdAt))
         + '</div>';

    // 字段列表
    html += '<div class="section-title">订阅信息</div>';
    html += '<div class="kv-list">'
         + kvRow('服务类型', getServiceLabel(s.serviceType))
         + kvRow('支付形式', getPaymentLabel(s.paymentType))
         + kvRow('计费周期', getBillingLabel(s.billingCycle))
         + kvRow('核心用途', getPurposeLabel(s.corePurpose))
         + kvRow('续费提醒', getReminderLabel(s.reminderRule))
         + kvRow('上次续费', s.lastRenewalDate ? formatDate(s.lastRenewalDate) : '无记录')
         + '</div>';

    if (s.feeDetails) {
      html += '<div class="section-title">费用详情</div>'
           + '<div class="detail-note">' + esc(s.feeDetails) + '</div>';
    }

    // 日历
    html += '<div class="section-title">续费日历</div>';
    html += renderCalendar();

    // 删除按钮
    html += '<div class="divider"></div>'
         + '<button class="btn danger block" data-act="del" data-id="' + esc(s.id) + '">删除整个订阅</button>';

    main.innerHTML = html;
    bindDetailEvents();
    bindCalendarEvents();
  }

  // J-01：详情页编辑/删除走 data-* + 渲染期绑定——onclick 内插 id 是 JS 注入面
  //（esc 的 &#39; 实体在 HTML 解码后于 onclick JS 字符串里还原为引号，可逃逸）
  function bindDetailEvents() {
    var acts = main.querySelectorAll('[data-act]');
    acts.forEach(function (btn) {
      btn.addEventListener('click', function (e) {
        e.stopPropagation();
        var act = btn.getAttribute('data-act');
        var id = btn.getAttribute('data-id');
        if (act === 'edit') openEdit(id);
        else if (act === 'del') confirmDelete(id);
      });
    });
  }

  function statCard(label, value, sub, cls) {
    return '<div class="stat">'
         + '  <div class="label">' + esc(label) + '</div>'
         + '  <div class="value ' + (cls || '') + '">' + value + '</div>'
         + '  <div class="sub">' + esc(sub) + '</div>'
         + '</div>';
  }

  // D-04：折算副标题随 billingCycle（原按 paymentType 文案已随口径一并更换）
  function cycleMonthlySub(c) {
    if (c === 'monthly') return '按月计费';
    if (c === 'quarterly') return '季费 ÷ 3';
    if (c === 'yearly') return '年费 ÷ 12';
    return '自定义按月';
  }

  function cycleAnnualSub(c) {
    if (c === 'yearly') return '按年计费';
    if (c === 'quarterly') return '季费 × 4';
    return '月费 × 12';
  }

  function kvRow(k, v) {
    return '<div class="kv-item"><span class="k">' + esc(k) + '</span><span class="v">' + esc(v) + '</span></div>';
  }

  function goHome() {
    view = 'list';
    detailId = null;
    render();
    window.scrollTo(0, listScrollY); // S-02：恢复进入前列表滚动位（原实现无条件回顶）
  }

  // ============== 日历 ==============
  function renderCalendar() {
    var now = new Date();
    var recordMap = buildRenewalMap();
    return ''
      + '<div class="cal-tabs">'
      + '  <button class="cal-tab' + (calView === 'month' ? ' active' : '') + '" data-view="month">月历</button>'
      + '  <button class="cal-tab' + (calView === 'year' ? ' active' : '') + '" data-view="year">年热力图</button>'
      + '</div>'
      + '<div class="calendar-wrap">'
      + (calView === 'month' ? renderMonth(now, recordMap) : renderYearHeatmap(now, recordMap))
      + '</div>';
  }

  // 日历事件绑定：J-07 原 setTimeout(0) 补绑在连续两次 render 时会对同一元素双绑，改为渲染期绑定
  function bindCalendarEvents() {
    var tabs = main.querySelectorAll('.cal-tab');
    tabs.forEach(function (t) {
      t.addEventListener('click', function () {
        calView = t.getAttribute('data-view');
        render();
      });
    });
    var prev = main.querySelector('.cal-prev');
    var next = main.querySelector('.cal-next');
    if (prev) prev.addEventListener('click', function () { calMonthOffset--; render(); });
    if (next) next.addEventListener('click', function () { calMonthOffset++; render(); });
  }

  function buildRenewalMap() {
    var map = {};
    state.subscriptions.forEach(function (s) {
      if (!s.nextRenewalDate) return;
      var d = new Date(s.nextRenewalDate);
      var key = d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate());
      if (!map[key]) map[key] = [];
      map[key].push(s);
    });
    return map;
  }

  function heatLevel(count) {
    if (!count) return 0;
    if (count === 1) return 1;
    if (count === 2) return 2;
    return 3;
  }

  function renderMonth(now, recordMap) {
    var year = now.getFullYear();
    var month = now.getMonth() + calMonthOffset;
    while (month < 0) { month += 12; year--; }
    while (month > 11) { month -= 12; year++; }
    var firstDay = new Date(year, month, 1);
    var startDow = firstDay.getDay();
    var daysInMonth = new Date(year, month + 1, 0).getDate();
    var monthName = year + ' 年 ' + (month + 1) + ' 月';
    var todayKey = now.getFullYear() + '-' + pad2(now.getMonth() + 1) + '-' + pad2(now.getDate());

    var html = ''
      + '<div class="cal-head">'
      + '  <button class="icon-btn cal-prev" aria-label="上月">'
      + '    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="18" height="18"><polyline points="15 18 9 12 15 6"/></svg>'
      + '  </button>'
      + '  <h3>' + monthName + '</h3>'
      + '  <button class="icon-btn cal-next" aria-label="下月">'
      + '    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="18" height="18"><polyline points="9 18 15 12 9 6"/></svg>'
      + '  </button>'
      + '</div>'
      + '<div class="cal-grid">'
      + ['日','一','二','三','四','五','六'].map(function (d) { return '<div class="cal-dow">' + d + '</div>'; }).join('');

    for (var i = 0; i < startDow; i++) html += '<div class="cal-day muted"></div>';
    for (var d = 1; d <= daysInMonth; d++) {
      var key = year + '-' + pad2(month + 1) + '-' + pad2(d);
      var recs = recordMap[key] || [];
      var level = heatLevel(recs.length);
      var classes = ['cal-day', 'lv-' + level];
      if (key === todayKey) classes.push('today');
      var label = recs.length > 0 ? recs.length + ' 次' : (key === todayKey ? '今天' : d);
      var title = key + (recs.length ? ' · ' + recs.length + ' 次续费' : '');
      html += '<div class="' + classes.join(' ') + '" title="' + esc(title) + '">' + label + '</div>';
    }
    html += '</div>';

    // 图例
    html += '<div class="cal-legend">'
         + '  <span>0 次</span>'
         + '  <span class="swatch lv-0"></span>'
         + '  <span class="swatch lv-1"></span>'
         + '  <span class="swatch lv-2"></span>'
         + '  <span class="swatch lv-3"></span>'
         + '  <span>3+ 次</span>'
         + '</div>';

    return html;
  }

  function renderYearHeatmap(now, recordMap) {
    var startDate = new Date(now.getFullYear(), 0, 1);
    startDate.setHours(0, 0, 0, 0);
    var endDate = new Date(now.getFullYear(), 11, 31);
    endDate.setHours(0, 0, 0, 0);
    var startOffset = startDate.getDay();
    var alignedStart = new Date(startDate.getTime() - startOffset * 86400000);
    var totalDays = Math.ceil((endDate - alignedStart) / 86400000) + 1;
    var weeks = Math.ceil(totalDays / 7);

    var html = '<div class="cal-head"><h3>' + now.getFullYear() + ' 年热力图</h3></div>'
             + '<div class="cal-grid" style="grid-template-columns: repeat(' + weeks + ', 1fr);">';  // 纵列=周

    for (var w = 0; w < weeks; w++) {
      html += '<div class="heat-col">';
      for (var r = 0; r < 7; r++) {
        var idx = w * 7 + r;
        var ts = alignedStart.getTime() + idx * 86400000;
        var day = new Date(ts);
        var future = ts > Date.now();
        var inYear = day.getFullYear() === now.getFullYear();
        if (!inYear) {
          html += '<div class="cal-day muted heat-cell"></div>';
          continue;
        }
        var key = day.getFullYear() + '-' + pad2(day.getMonth() + 1) + '-' + pad2(day.getDate());
        var count = recordMap[key] ? recordMap[key].length : 0;
        var level = future ? 0 : heatLevel(count);
        var cls = 'cal-day lv-' + level;
        if (future) cls += ' muted';
        html += '<div class="' + cls + ' heat-cell" title="' + esc(key) + (count ? ' · ' + count + ' 次' : '') + '"></div>';
      }
      html += '</div>';
    }
    html += '</div>';

    html += '<div class="cal-legend">'
         + '  <span>少</span>'
         + '  <span class="swatch lv-0"></span>'
         + '  <span class="swatch lv-1"></span>'
         + '  <span class="swatch lv-2"></span>'
         + '  <span class="swatch lv-3"></span>'
         + '  <span>多</span>'
         + '</div>';

    return html;
  }

  // ============== 统计页 ==============
  function renderStats() {
    var subs = state.subscriptions;
    var monthlyTotal = calculateMonthlyTotal(subs);
    var annualEst = calculateAnnualEstimate(subs);
    var tagStats = calculateTagStats(subs);
    var expiring = getExpiringSoon(subs);
    var expired = getExpired(subs);
    var active = subs.filter(function (s) { return s.paymentType !== 'free'; }).length;
    var free = subs.filter(function (s) { return s.paymentType === 'free'; }).length;

    var html = ''
      + '<div class="detail-head">'
      + '  <button class="back-btn" onclick="window.__st.goHome()" aria-label="返回">'
      + '    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>'
      + '  </button>'
      + '  <div class="detail-title">数据统计</div>'
      + '</div>';

    // 大数字：本月续费总额
    html += '<div class="big-price">'
         + '  <div class="icon">💰</div>'
         + '  <div class="price">¥' + monthlyTotal.toFixed(2) + '</div>'
         + '  <div class="name">本月续费总额</div>'
         + '</div>';

    // 数据四宫格
    html += '<div class="stat-grid">'
         + statCard('订阅总数', String(subs.length), '付费 ' + active + ' · 免费 ' + free)
         + statCard('年支出预估', '¥' + annualEst.toFixed(2), '按计费周期推算')
         + statCard('即将续费', String(expiring.length) + ' 项', expiring.length > 0 ? '7 天内' : '暂无')
         + statCard('已过期', String(expired.length) + ' 项', expired.length > 0 ? '需要处理' : '一切正常', expired.length > 0 ? 'warning' : '')
         + '</div>';

    // 即将续费列表
    if (expiring.length > 0) {
      html += '<div class="section-title">即将续费（7 天内）</div>';
      html += '<div class="card-list">';
      expiring.slice(0, 10).forEach(function (s) {
        var days = daysUntil(s.nextRenewalDate);
        html += '<div class="subscription-card" data-id="' + esc(s.id) + '">'
             + '  <div class="card-head">'
             + '    <div class="card-icon">' + getServiceIcon(s.serviceType) + '</div>'
             + '    <div class="card-title">' + esc(s.name) + '</div>'
             + '    <div class="card-tag">' + (days === 0 ? '今天' : days + ' 天后') + '</div>'
             + '  </div>'
             + '  <div class="card-price' + (s.paymentType === 'free' ? ' free' : '') + '">' + (s.paymentType === 'free' ? '免费' : '¥' + (s.price || 0).toFixed(2)) + '</div>'
             + '  <div class="card-meta"><span>' + formatDate(s.nextRenewalDate) + '</span></div>'
             + '</div>';
      });
      html += '</div>';
    }

    // 按标签统计
    var tagKeys = Object.keys(tagStats);
    if (tagKeys.length > 0) {
      html += '<div class="section-title">按标签分布</div>';
      html += '<div class="kv-list">';
      tagKeys.forEach(function (t) {
        var st = tagStats[t];
        html += '<div class="kv-item"><span class="k">' + esc(t) + ' (' + st.count + ')</span><span class="v kv-accent">¥' + st.total.toFixed(2) + '</span></div>';
      });
      html += '</div>';
    }

    // 日历视图
    html += '<div class="section-title">续费日历</div>';
    html += renderCalendar();

    main.innerHTML = html;
    bindStatsEvents();
    bindCalendarEvents();
  }

  // J-01：统计页「即将续费」卡片点击进详情，走 data-id + 渲染期绑定
  function bindStatsEvents() {
    var cards = main.querySelectorAll('.card-list .subscription-card[data-id]');
    cards.forEach(function (c) {
      c.addEventListener('click', function () {
        openDetail(c.getAttribute('data-id'));
      });
    });
  }

  // ============== 模态框 ==============
  // J-06：弹窗栈——叠加显示（z=100+10n）、ESC 关最上层、栈非空时 body 锁滚；
  // 原单槽实现（showModal 先 closeModal）会把导入链路里的前序弹窗顶掉
  var modalStack = [];
  var lastFocused = null; // A-02：焦点归还触发元素

  function updateBodyScrollLock() {
    document.body.style.overflow = modalStack.length > 0 ? 'hidden' : '';
  }

  function showModal(title, bodyHtml, onMount) {
    var back = document.createElement('div');
    back.className = 'modal-back';
    back.style.zIndex = String(100 + modalStack.length * 10);
    back.innerHTML = '<div class="modal" role="dialog" aria-modal="true" aria-label="' + esc(title) + '">'
                   + '  <h2>' + esc(title) + '</h2>'
                   + '  <div class="modal-body">' + bodyHtml + '</div>'
                   + '</div>';
    // J-03：点遮罩不关闭（防误关丢表单输入）；关闭一律走按钮或 ESC（规范 §12）
    document.body.appendChild(back);
    modalStack.push(back);
    updateBodyScrollLock();
    // A-02：记录触发元素，聚焦弹窗内首个可聚焦控件（autofocus 对 innerHTML 注入无效，规范 §15）
    lastFocused = document.activeElement;
    var firstInput = back.querySelector('input, select, textarea, button');
    if (firstInput) { try { firstInput.focus(); } catch (e) {} }
    if (onMount) onMount(back);
    return back;
  }

  function closeModal() {
    var top = modalStack.pop();
    if (top) top.remove();
    updateBodyScrollLock();
    // A-02：栈空时焦点归还打开弹窗的触发元素
    if (modalStack.length === 0 && lastFocused && lastFocused.focus) {
      try { lastFocused.focus(); } catch (e) {}
      lastFocused = null;
    }
  }

  // ============== 新增 / 编辑 ==============
  function openNew() { openEditForm(null); }
  function openEdit(id) { openEditForm(id); }

  function openEditForm(id) {
    var s = id ? getById(id) : null;
    var isEdit = !!s;
    var d = s || {
      name: '', tag: '', serviceType: 'other', paymentType: 'monthly',
      lastRenewalDate: '', nextRenewalDate: todayISO(),
      price: 0, billingCycle: 'monthly', feeDetails: '',
      reminderRule: '7days', corePurpose: 'personal'
    };

    var serviceOptions = Object.keys(SERVICE_TYPES).map(function (k) {
      return '<option value="' + k + '"' + (d.serviceType === k ? ' selected' : '') + '>' + SERVICE_TYPES[k].label + '</option>';
    }).join('');
    var paymentOptions = Object.keys(PAYMENT_TYPES).map(function (k) {
      return '<option value="' + k + '"' + (d.paymentType === k ? ' selected' : '') + '>' + PAYMENT_TYPES[k] + '</option>';
    }).join('');
    var billingOptions = Object.keys(BILLING_CYCLES).map(function (k) {
      return '<option value="' + k + '"' + (d.billingCycle === k ? ' selected' : '') + '>' + BILLING_CYCLES[k] + '</option>';
    }).join('');
    var reminderOptions = Object.keys(REMINDER_RULES).map(function (k) {
      return '<option value="' + k + '"' + (d.reminderRule === k ? ' selected' : '') + '>' + REMINDER_RULES[k] + '</option>';
    }).join('');
    var purposeOptions = Object.keys(CORE_PURPOSES).map(function (k) {
      return '<option value="' + k + '"' + (d.corePurpose === k ? ' selected' : '') + '>' + CORE_PURPOSES[k] + '</option>';
    }).join('');

    var html = ''
      + '<form id="qt-form">'
      + '<div class="field"><label>订阅名称 <span class="required">*</span></label><input class="input" name="name" value="' + esc(d.name) + '" placeholder="如：Netflix" required maxlength="50"></div>'
      + '<div class="field"><label>标签 <span class="required">*</span></label><input class="input" name="tag" value="' + esc(d.tag) + '" placeholder="如：视频娱乐" required maxlength="20"></div>'
      + '<div class="field-row">'
      + '  <div class="field"><label>服务类型</label><select class="select" name="serviceType">' + serviceOptions + '</select></div>'
      + '  <div class="field"><label>支付形式</label><select class="select" name="paymentType">' + paymentOptions + '</select></div>'
      + '</div>'
      + '<div class="field-row">'
      + '  <div class="field"><label>上次续费</label><input class="input" type="date" name="lastRenewalDate" value="' + esc(d.lastRenewalDate) + '"></div>'
      + '  <div class="field"><label>下次续费 <span class="required">*</span></label><input class="input" type="date" name="nextRenewalDate" value="' + esc(d.nextRenewalDate) + '" required></div>'
      + '</div>'
      + '<div class="field-row">'
      + '  <div class="field"><label>续费价格 <span class="required">*</span></label><input class="input" type="number" name="price" value="' + (d.price || '') + '" placeholder="0.00" step="0.01" min="0" required></div>'
      + '  <div class="field"><label>计费周期</label><select class="select" name="billingCycle">' + billingOptions + '</select></div>'
      + '</div>'
      + '<div class="field-row">'
      + '  <div class="field"><label>续费提醒</label><select class="select" name="reminderRule">' + reminderOptions + '</select></div>'
      + '  <div class="field"><label>核心用途</label><select class="select" name="corePurpose">' + purposeOptions + '</select></div>'
      + '</div>'
      + '<div class="field"><label>费用详情</label><textarea class="textarea" name="feeDetails" placeholder="备注：首年折扣、涨价历史等" maxlength="500">' + esc(d.feeDetails) + '</textarea></div>'
      + '</form>'
      + '<div class="modal-actions">'
      + '<button class="btn ghost" onclick="window.__st.closeModal()">取消</button>'
      + (isEdit ? '<button class="btn danger" id="qt-del">删除</button>' : '')
      + '  <button class="btn primary" id="qt-save">' + (isEdit ? '保存' : '创建') + '</button>'
      + '</div>';

    showModal(isEdit ? '编辑订阅' : '新增订阅', html, function (back) {
      // J-04：接管 Enter 隐式提交——原行为是浏览器默认提交（无 action → 页面刷新，输入全丢）
      var form = back.querySelector('#qt-form');
      form.addEventListener('submit', function (e) {
        e.preventDefault();
        var saveBtn = back.querySelector('#qt-save');
        if (saveBtn) saveBtn.click();
      });

      // 删按钮
      var del = back.querySelector('#qt-del');
      if (del) del.addEventListener('click', function () { closeModal(); confirmDelete(s.id); });

      back.querySelector('#qt-save').addEventListener('click', function () {
        var form = back.querySelector('#qt-form');
        var data = {};
        var inputs = form.querySelectorAll('[name]');
        inputs.forEach(function (i) {
          if (i.type === 'number') data[i.name] = parseFloat(i.value) || 0;
          else data[i.name] = i.value.trim();
        });

        // 校验
        if (!data.name) { toast('请填写订阅名称', 'warning'); return; }
        if (!data.tag) { toast('请填写标签', 'warning'); return; }
        if (!data.nextRenewalDate) { toast('请选择下次续费时间', 'warning'); return; }
        if (data.paymentType !== 'free' && data.price < 0) { toast('价格无效', 'warning'); return; }

        if (isEdit) {
          updateSubscription(id, data);
          toast('已保存', 'success');
        } else {
          addSubscription(data);
          toast('已添加', 'success');
        }
        closeModal();
        render();
      });
    });
  }

  function confirmDelete(id) {
    var s = getById(id);
    if (!s) return;
    showModal('删除订阅？', ''
      + '<p class="modal-tip">将永久删除 <b>' + esc(s.name) + '</b>，此操作不可撤销。</p>'
      + '<div class="modal-actions">'
      + '  <button class="btn ghost" onclick="window.__st.closeModal()">取消</button>'
      + '  <button class="btn danger" id="qt-confirm">确认删除</button>'
      + '</div>',
      function (back) {
        back.querySelector('#qt-confirm').addEventListener('click', function () {
          deleteSubscription(id);
          closeModal();
          if (view === 'detail') { view = 'list'; detailId = null; }
          render();
          toast('已删除', 'success');
        });
      });
  }

  // ============== 设置 ==============
  function openSettings() {
    var html = ''
      + '<div class="section-title flush">配色</div>'
      + '<div class="accent-row">'
      + ACCENT_LIST.map(function (c) {
          var names = { green: 'Spotify 绿', blue: '亮蓝', purple: '蔷薇紫', orange: '落日橙' };
          return '<button class="btn" data-act="accent" data-accent-name="' + c + '">'
               + '<span class="accent-dot dot-' + c + '"></span>' + names[c] + '</button>';
        }).join('')
      + '</div>'
      + '<div class="section-title">数据管理</div>'
      + '<div class="btn-stack">'
      + '  <button class="btn block" id="qt-export">导出 JSON 备份</button>'
      + '  <button class="btn block" id="qt-import">导入备份</button>'
      + '  <input type="file" id="qt-import-file" accept="application/json,.json" class="hidden">'
      + '</div>'
      + '<div class="settings-hint">'
      + '  你的所有数据都只存在本设备浏览器中。'
      + '  清除浏览器数据将永久丢失，请定期导出备份。'
      + '</div>'
      + '<div class="section-title">关于</div>'
      + '<div class="settings-about">'
      + '  SubTrack 1.1.0<br>'
      + '  共 ' + state.subscriptions.length + ' 个订阅 · 数据键 ' + STORAGE_KEY
      + '</div>'
      + '<div class="modal-actions">'
      + '  <button class="btn ghost block" onclick="window.__st.closeModal()">关闭</button>'
      + '</div>';

    showModal('设置', html, function (back) {
      // 配色切换：持久化 + 即时生效（CSS 变量随 data-accent 即刷），弹窗开着无需重渲染
      function setAccent(c) {
        try { localStorage.setItem(ACCENT_KEY, c); } catch (e) {}
        applyTheme();
        toast('已切换配色', 'success');
      }
      back.querySelectorAll('[data-act="accent"]').forEach(function (btn) {
        btn.addEventListener('click', function () {
          setAccent(btn.getAttribute('data-accent-name'));
        });
      });

      back.querySelector('#qt-export').addEventListener('click', function () {
        var blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
        var url = URL.createObjectURL(blob);
        var a = document.createElement('a');
        a.href = url;
        a.download = 'subtrack-backup-' + new Date().toISOString().slice(0, 10) + '.json';
        a.click();
        URL.revokeObjectURL(url);
        toast('已导出', 'success');
      });

      var fileInput = back.querySelector('#qt-import-file');
      back.querySelector('#qt-import').addEventListener('click', function () { fileInput.click(); });
      fileInput.addEventListener('change', function (e) {
        var file = e.target.files[0];
        if (!file) return;
        var reader = new FileReader();
        reader.onload = function (ev) {
          try {
            var data = JSON.parse(ev.target.result);
            if (!data || !Array.isArray(data.subscriptions)) throw new Error('格式错误');
            var incoming = normalizeImport(data.subscriptions); // D-01：导入数据强制消毒
            if (incoming.length === 0) throw new Error('没有有效订阅');
            showModal('导入方式', ''
              + '<p class="modal-tip">检测到 <b>' + incoming.length + '</b> 个订阅。</p>'
              + '<div class="modal-actions">'
              + '  <button class="btn ghost" onclick="window.__st.closeModal()">取消</button>'
              + '  <button class="btn" id="qt-merge">合并</button>'
              + '  <button class="btn danger" id="qt-overwrite">覆盖</button>'
              + '</div>',
              function (back2) {
                back2.querySelector('#qt-merge').addEventListener('click', function () {
                  var existingIds = {};
                  state.subscriptions.forEach(function (s) { existingIds[s.id] = true; });
                  incoming.forEach(function (s) {
                    if (!existingIds[s.id]) state.subscriptions.push(s);
                  });
                  saveState();
                  closeModal();
                  render();
                  toast('已合并', 'success');
                });
                back2.querySelector('#qt-overwrite').addEventListener('click', function () {
                  state.subscriptions = incoming;
                  saveState();
                  closeModal();
                  render();
                  toast('已覆盖', 'success');
                });
              });
          } catch (err) {
            toast('导入失败：' + err.message, 'error');
          }
        };
        reader.readAsText(file);
      });
    });
  }

  // ============== Toast ==============
  function toast(msg, type) {
    type = type || 'info';
    var c = document.getElementById('toastContainer');
    c.innerHTML = ''; // 单例语义：新 toast 出现即清旧条（J-05：模块级单 timer 会让前一条永驻）
    var t = document.createElement('div');
    t.className = 'toast ' + type;
    var icons = {
      success: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>',
      error: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>',
      warning: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>',
      info: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>'
    };
    t.innerHTML = (icons[type] || icons.info) + '<span>' + esc(msg) + '</span>';
    c.appendChild(t);
    var timer = setTimeout(function () { if (t.parentNode) t.remove(); }, 2500);
  }

  // ============== 主题 ==============
  function applyTheme() {
    var saved = 'auto';
    try { saved = localStorage.getItem(THEME_KEY) || 'auto'; } catch (e) {}
    var dark;
    if (saved === 'dark') dark = true;
    else if (saved === 'light') dark = false;
    else dark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light');
    // 配色方案：只换 accent 系 token（green 为基线，非法值回落默认）——与主题一次刷
    var accent = 'green';
    try { accent = localStorage.getItem(ACCENT_KEY) || 'green'; } catch (e) {}
    if (ACCENT_LIST.indexOf(accent) < 0) accent = 'green';
    document.documentElement.setAttribute('data-accent', accent);
  }

  // ============== 初始化 ==============
  function init() {
    applyTheme();

    // 调试入口：URL 强制浅色
    if (/theme=light/.test(location.search)) {
      document.documentElement.setAttribute('data-theme', 'light');
    } else if (/theme=dark/.test(location.search)) {
      document.documentElement.setAttribute('data-theme', 'dark');
    }

    document.getElementById('theme-btn').addEventListener('click', function () {
      var cur = document.documentElement.getAttribute('data-theme');
      try { localStorage.setItem(THEME_KEY, cur === 'dark' ? 'light' : 'dark'); } catch (e) {}
      applyTheme();
    });
    document.getElementById('stats-btn').addEventListener('click', function () {
      view = 'stats';
      resetCalState(); // S-01：从详情翻月后进统计不残留
      render();
      window.scrollTo(0, 0);
    });
    document.getElementById('settings-btn').addEventListener('click', openSettings);

    if (window.matchMedia) {
      window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', applyTheme);
    }

    // URL 调试入口
    if (/detail=/.test(location.search)) {
      var m = location.search.match(/detail=([\w-]+)/);
      if (m && getById(m[1])) openDetail(m[1]);
      else render();
    } else if (/view=stats/.test(location.search)) {
      view = 'stats';
      resetCalState();
      render();
    } else {
      render();
    }

    // 调试入口：#seed 灌入演示数据
    // P-01：库内为空或本就是演示数据时直接（重）灌；存在真实数据时必须先确认，防误覆盖
    if (location.hash === '#seed') {
      var isDemo = state.subscriptions.length === 6 && state.subscriptions.every(function (s, i) {
        return s.id === 's' + (i + 1);
      });
      if (state.subscriptions.length === 0 || isDemo) {
        installSeed();
        render();
        var m2 = location.search.match(/detail=([\w-]+)/);
        if (m2 && getById(m2[1])) openDetail(m2[1]);
      } else {
        showModal('灌入演示数据？', ''
          + '<p class="modal-tip">'
          + '将用 <b>6 条演示订阅</b> 覆盖现有的 <b>' + state.subscriptions.length + '</b> 条数据，此操作不可撤销。</p>'
          + '<div class="modal-actions">'
          + '  <button class="btn ghost" id="qt-seed-cancel">取消</button>'
          + '  <button class="btn danger" id="qt-seed-ok">覆盖灌入</button>'
          + '</div>',
          function (back) {
            back.querySelector('#qt-seed-cancel').addEventListener('click', closeModal);
            back.querySelector('#qt-seed-ok').addEventListener('click', function () {
              installSeed();
              closeModal();
              render();
              toast('已灌入演示数据', 'success');
            });
          });
      }
    }

    // J-06：ESC 只关最上层弹窗（规范 §12）
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && modalStack.length > 0) closeModal();
    });

    // 注册 Service Worker（离线能力；file:// 协议下不可用，双击打开时静默跳过）
    if ('serviceWorker' in navigator && location.protocol !== 'file:') {
      navigator.serviceWorker.register('sw.js').catch(function (e) {
        console.warn('SW register failed', e);
      });
    }

    window.__st = {
      openNew: openNew,
      openEdit: openEdit,
      openDetail: openDetail,
      goHome: goHome,
      closeModal: closeModal,
      confirmDelete: confirmDelete
    };
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // ---------- 调试：种子数据 ----------
  function installSeed() {
    var now = Date.now();
    var day = 86400000;
    function dateStr(d) { return new Date(d).toISOString().slice(0, 10); }
    state.subscriptions = [
      { id: 's1', name: 'Netflix', tag: '视频', serviceType: 'streaming',
        paymentType: 'monthly', lastRenewalDate: dateStr(now - 25 * day),
        nextRenewalDate: dateStr(now + 5 * day), price: 78, billingCycle: 'monthly',
        feeDetails: '高级套餐 4K', reminderRule: '7days', corePurpose: 'personal',
        order: 0, createdAt: now - 90 * day, updatedAt: now },
      { id: 's2', name: 'iCloud+ 200G', tag: '云存储', serviceType: 'cloud',
        paymentType: 'yearly', lastRenewalDate: dateStr(now - 60 * day),
        nextRenewalDate: dateStr(now + 305 * day), price: 388, billingCycle: 'yearly',
        feeDetails: '家庭共享划算', reminderRule: '30days', corePurpose: 'family',
        order: 1, createdAt: now - 200 * day, updatedAt: now },
      { id: 's3', name: 'GitHub Pro', tag: '开发', serviceType: 'devTools',
        paymentType: 'monthly', lastRenewalDate: dateStr(now - 12 * day),
        nextRenewalDate: dateStr(now + 18 * day), price: 32, billingCycle: 'monthly',
        feeDetails: '', reminderRule: '7days', corePurpose: 'work',
        order: 2, createdAt: now - 365 * day, updatedAt: now },
      { id: 's4', name: 'Spotify', tag: '音乐', serviceType: 'music',
        paymentType: 'yearly', lastRenewalDate: dateStr(now - 30 * day),
        nextRenewalDate: dateStr(now + 335 * day), price: 168, billingCycle: 'yearly',
        feeDetails: '学生套餐', reminderRule: '30days', corePurpose: 'personal',
        order: 3, createdAt: now - 100 * day, updatedAt: now },
      { id: 's5', name: 'Notion', tag: '办公', serviceType: 'office',
        paymentType: 'monthly', lastRenewalDate: dateStr(now - 20 * day),
        nextRenewalDate: dateStr(now + 2 * day), price: 60, billingCycle: 'monthly',
        feeDetails: '团队版', reminderRule: '7days', corePurpose: 'work',
        order: 4, createdAt: now - 50 * day, updatedAt: now },
      { id: 's6', name: 'ChatGPT Plus', tag: 'AI', serviceType: 'ai',
        paymentType: 'monthly', lastRenewalDate: dateStr(now - 3 * day),
        nextRenewalDate: dateStr(now + 27 * day), price: 130, billingCycle: 'monthly',
        feeDetails: '日常写代码用', reminderRule: '7days', corePurpose: 'work',
        order: 5, createdAt: now - 180 * day, updatedAt: now }
    ];
    saveState();
  }
})();
