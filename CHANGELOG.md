# Changelog

记录 SubTrack 的全部行为变更（规范 §17：Keep-a-Changelog 分类，每批必记；测试契约变更单独写明）。

### 线上核验修复（2026-10-25，§7.4 首发实测发现）

- **SW-REG Service Worker 注册缺失**（原始缺陷，盘点漏网）：`index.html`/`app.js` 从未调用 `navigator.serviceWorker.register` —— `sw.js` 是死文件，离线从未生效、README「可离线」宣称失实。现于 init 注册（file:// 协议静默跳过）。
- **SW-SCOPE 同源缓存互删防护**：GitHub Pages 项目站共享 origin，activate 无差别清缓存会删掉同 origin 其他项目（如 habit-quit-tracker）的缓存；现只清理 `subtrack-` 前缀。
- assert-batch4 新增 2 断言（10/10）；十套件回归全绿。

## [1.1.0] - 2026-10-25

### 新增
- **配色方案切换**（借鉴 habit-quit-tracker 的 `data-accent` 机制）：设置弹窗新增「配色」行，四色可选——Spotify 绿（默认）/ 亮蓝 / 蔷薇紫 / 落日橙（主色取 data-model.md 预留 ACCENTS）。
- `data-accent` 属性只换 accent 系 token（accent / hover / on-accent / muted / tint×3），背景与文字保持中性；`subtrack-accent` key 持久化，非法值回落 green。
- 新增 `.accent-row` / `.accent-dot` / `.dot-*` 选择器与 UI。

### 测试
- 新增 `tests/assert-batch9.js`：11 条断言（三色 token 块全套 / dark 变体 / 主色与预留一致 / 非 green 配色零绿色 rgba 残留 / UI 与持久化）。
- smoke 新增 3 条行为断言（共 32）：默认 green / 持久化读取 / 非法值回落（documentElement stub 增强为真实属性存储）。
- **反向验证记录**：assert-batch9 功能落地前 1/11、smoke 29/32；落地后 11/11 + 32/32，九套件回归无退化。
- **四色实机截图验收**：设置弹窗配色行渲染、真点击切亮蓝（全局生效 + 持久化 + toast 反馈 + 零绿色残留）、深色落日橙统计页——均正常。
- 检查器健壮性修复：style-consistency 死 CSS 提取先剥 `/* */` 注释（此前注释内 `data-model.md` 被误判为类）；STYLE_HOOKS 对死 CSS 与失配两个检查统一豁免。

## [1.0.0] - 2026-10-25

### 批次 8 · a11y 与文档收尾（2026-10-25）

#### 行为修正声明（用户可感知）
- **A-02 弹窗可访问性**：弹窗 DOM 补 `role="dialog"` + `aria-modal="true"` + `aria-label`；打开时聚焦弹窗内首个可聚焦控件（autofocus 对 innerHTML 注入无效）；关闭（栈空）时焦点归还触发元素。
- **A-04 动效降级**：新增 `prefers-reduced-motion: reduce` 媒体查询——系统开启「减少动态效果」时动画/过渡降级为 0.01ms（规范 §20-2 建议补齐项）。
- **Doc-04 宣称如实化**：README 首段「提醒续费日期」改为如实描述——「即将续费」徽章为被动提示，无系统级推送（reminderRule 字段仍存储但无主动提醒实现，已如实记录）。
- **Doc-06 调试入口全量文档化**：README 补 `?view=stats`、`?theme=light/dark`、`#seed`（含确认守卫行为说明）与 `tests/seed.html?run=1` 夹具说明。
- **版本口径定版 1.0.0**：设置弹窗「SubTrack 1.0.0」（移除已废弃的 MavisUI 引用）、manifest 新增 `version: 1.0.0`、CHANGELOG 定版。
- **发布齐件**：新增 LICENSE（MIT, Edward8n25）；README 新增「开发与测试」节（9 个测试脚本运行命令公开）；README/data-model.md 数据说明补备份 key 双写与消毒管道描述。

#### 测试
- 新增 `tests/assert-batch8.js`：14 条静态断言（弹窗 aria 与焦点 / reduced-motion / 宣称如实化 / LICENSE / 版本口径 / 文档一致性）。
- **反向验证记录**：assert-batch8 修复前 0/14；修复后 14/14，既有七套件（smoke 29 / batch2 12 / batch3 11 / batch4 8 / batch5 16 / batch6 7 / batch7 14 / style 8）回归无退化。

### 批次 7 · UI 一致性收敛（2026-10-25）

#### 行为修正声明（用户可感知，均为视觉微调）
- **U-01 tint token**：新增 `--accent-tint-18/45/78`（日历色阶）、`--danger-muted`（过期徽章）——6 处绿色 rgba 字面量与 1 处 fallback 清零，换主色不再残留绿底。
- **U-02 纯黑清零**：新增 `--on-accent`（#062b14，替代 #000 ×2：主按钮文字、选中勾标）与 `--text-on-tint`（深 tint 反白，替代 #fff ×2）。
- **U-05/U-06 圆角阴影全 token**：新增 `--radius-xs`（4px）/`--radius-lg`（16px），裸圆角 5→0；新增 `--shadow-up`（底栏向上浮起阴影）+ toast 改用 `--shadow-lg`，裸阴影 2→0。
- **U-03 内联收敛**：JS 内联 style 12→1（仅剩年热力图动态 `grid-template-columns`，无法静态化）；新增 `.big-price-unit`/`.detail-note`/`.heat-col`/`.heat-cell`/`.kv-accent`/`.flush`/`.btn-stack`/`.hidden`（合法复活）/`.settings-hint`/`.settings-about` 十个语义类。
- **U-04 间距收敛**：33 处越界值就近落六档（6/7/9→8、10/11/13→12、14/15→16、20→24、3/5→4），越界 41→7；剩余 7 处为**豁免清单**（固化在 style-consistency.js）：app 底部留白 100px、header 安全区 `calc(14px+env)`、搜索框图标定位 36px、空态留白 80px、modal padding（calc 行整体豁免）。
- **divider 补样式**（盘点新发现 P3）：详情页分隔线此前 CSS 缺失不可见，补 1px 线并从 STYLE_HOOKS 移出。
- **A-05 按钮两档**：`.btn.small` 28px → 32px（规范主 36/次 32，第三档尺寸清除）。
- **附带修复（盘点遗漏的既有缺陷）**：`.big-price .icon svg` 无尺寸约束撑满容器（详情页大图标异常放大），限定 48×48。
- **间距映射规则**：就近落档、平手向上；`calc()`/`env()`/负值/≥24 大留白不动。

#### 测试
- 新增 `tests/assert-batch7.js`：14 条静态断言（token 齐备 / 绿 rgba 仅存定义区 5 处 / #000 #fff 规则体清零 / 裸圆角裸阴影清零 / 内联=1 / 按钮两档 / divider / 豁免清单固化）。
- **反向验证记录**：assert-batch7 于改动完成后即 14/14（本批为纯收敛、无「修复前功能态」可锁——棘轮基线本身即是反向保障：style-consistency 间距 41→7、圆角 5→0、内联 12→1、#000 2→0，只许降不许升）；smoke 29/29、batch2 12/12（U-08 清单移出已合法复活的 .hidden 并注明）、batch3/4/5/6 全绿回归。
- **双主题截图验收**：浅/深两主题详情页（日历 tint 色阶、today 描边、divider、detail-note、折算四宫格）均正常。

### 批次 6 · 状态机与口径（2026-10-25）

#### 行为修正声明（用户可感知）
- **D-04 折算口径统一**（用户裁决 2026-10-25）：详情页「每月折算 / 每年折算」改按 **billingCycle** 计算（monthly ×12 / quarterly ÷3、×4 / yearly ÷12、custom 按月），与统计页「年支出预估」同口径；free / oneTime 不折算（显示 ¥0.00，与统计页排除逻辑一致）；折算副标题文案随周期类型更换。**影响范围**：正常组合（按月+每月、按年+每年）数字不变；此前 quarterly 组合折算恒为 0（现正确显示）；矛盾组合（如按月+按年）以 billingCycle 为准。
- **S-01 子状态复位**：进入详情页/统计页时日历复位到当月+月历视图——此前上个订阅翻到的月份/年热力图会残留到下一个订阅。
- **S-02 滚动记忆**：从列表进详情再返回，恢复进入前的滚动位置（此前无条件回顶）；从统计页进详情不污染列表滚动位。

#### 测试
- 新增 `tests/assert-batch6.js`：7 条静态断言（复位收敛 + 三入口复位 / 滚动捕获与恢复 / 折算三档 + free/oneTime 排除 + 不再读 paymentType）；smoke 恢复 D-04 行为断言 5 条（共 29）。
- **反向验证记录**：assert-batch6 修复前 0/7、smoke D-04 断言修复前 26/29（矛盾组合 ¥8.33 与 quarterly ¥30.00/¥360.00 均不出现）；修复后 7/7 + 29/29，既有五套件（12/11/8/16/8）回归无退化。
- **局限（如实记录）**：S-01 翻月残留、S-02 滚动恢复需真实 DOM 与滚动环境，静态/沙箱断言只锁代码结构与折算数值，真浏览器验证归发布核验清单。

### 批次 5 · 安全与弹窗（2026-10-25）

#### 行为修正声明（用户可感知）
- **J-01 注入面清零**：详情页编辑/删除、「删除整个订阅」、统计页即将续费卡片共 4 处 onclick 内插 id 全部改为 `data-act`/`data-id` + 渲染期绑定（`bindDetailEvents`/`bindStatsEvents`）——esc 的 `&#39;` 实体在 onclick JS 字符串层解码后可逃逸（构造 id 可执行任意 JS），现已从源头断绝；固定无参调用（返回/取消/关闭）保留内联桥。
- **P-01 #seed 守卫**：库内为空或本就是 6 条演示数据时直接（重）灌（seed.html→index 跳转链路不受影响）；**存在真实数据时先弹确认**，明示「6 条演示覆盖现有 N 条、不可撤销」。
- **J-03 遮罩不关闭**：弹窗点遮罩不再关闭（防误关丢表单输入）；关闭 = 取消/确定/关闭按钮或 ESC。
- **J-04 Enter 接管**：编辑表单内按 Enter 由应用接管（preventDefault + 触发保存），此前会触发浏览器隐式提交导致页面刷新、输入全丢。
- **J-06 弹窗栈**：`modalStack` 叠加（z=100+10n）、ESC 关最上层、栈非空时 body 锁滚；修复导入链路中「导入方式」弹窗顶掉「设置」弹窗的问题。弹窗打开期间背景不可滚动（新增行为）。
- **附带收敛**：新增 `.modal-tip` 公共类，4 处同款弹窗文案内联 style 收敛（棘轮 15→12），数值原样搬运无设计变更。

#### 测试
- 新增 `tests/assert-batch5.js`：16 条静态断言；smoke 新增 P-01 行为断言（空库直灌 / 真实数据不直接覆盖）。
- **反向验证记录**：assert-batch5 修复前 1/16、smoke 修复前 26/29；修复后 16/16 + 24/24，既有 12/12、11/11、8/8、style 8/8 回归无退化。
- **局限（如实记录）**：J-01 端到端注入复现、J-06 叠加视觉、J-03/J-04 交互需真实 DOM（smoke stub 的 querySelector 恒 null 属规范 §16 已知盲区），真浏览器验证归发布核验清单。

### 批次 4 · Service Worker 策略（2026-10-25）

#### 行为修正声明（用户可感知）
- **W-01 缓存策略**：sw.js 从 cache-first 重写为 network-first（规范 §14）——在线一律拿最新 HTML/JS，离线才回退缓存；导航请求成功不写缓存。修复前已访问用户被永久锁在旧版（发版不生效）。
- **CACHE bump**：`subtrack-v1` → `subtrack-v2`（改缓存策略必须连动 bump）；activate 时自动清除旧名缓存。
- **W-04 预缓存补齐**：ASSETS 清单补 `icon-192.png` / `icon-512.png`（manifest 有引用但此前不预缓存，离线首启图标 404）。

#### 测试
- 新增 `tests/assert-batch4.js`：8 条静态断言（CACHE bump / 无 cache-first 模式 / network-first 结构 / 导航不回填 / 失败兜底 / 预缓存清单 / 头注释一致）。
- **反向验证记录**：修复前 1/8（W-01d 原代码即有 res.ok 判断，天然通过）；修复后 8/8，smoke 22/22、assert-batch2 12/12、assert-batch3 11/11、style 8/8 回归无退化。
- **局限（如实记录）**：SW 运行时行为需真实 Service Worker 环境，静态断言只锁策略结构；断网兜底与发版生效的实测归发布前规范 §7.4 上线核验清单执行。

### 批次 3 · 数据层加固（2026-10-25）

#### 行为修正声明（用户可感知）
- **D-01 导入消毒**：导入备份强制走归一化管道——非法 id（非 `[\w-]`）自动重生成、price 数字化且负值拉平为 0、非法枚举字段落默认值、文本按表单上限截断（名称 50 / 标签 20 / 详情 500）；「检测到 N 个订阅」的 N 为净化后数量；内容全非法时提示「导入失败：没有有效订阅」。畸形文件导入后不再出现白屏（修复前：坏数据落盘，刷新永久白屏，只能清 localStorage）。
- **D-02 备份双写**：新增备份 key `subtrack-v2.bak`，保存时主备双写；主 key 损坏/为空时自动从备份恢复（toast 提示「主数据异常，已从备份恢复」）并写回主 key。localStorage 空间占用约 ×2（已知取舍）。
- **D-03 迁移生效**：v1（`subtrack_data`）→ v2 自动迁移首次真正生效——此前 v2 key 不存在时迁移代码不可达（README 宣称不成立）；现在主备 key 均无数据时自动迁移旧 key，成功立即写回主 key，旧 key 保留。
- **读链净化**：每次启动对 localStorage 数据做一次归一化校验，含脏数据时净化后回写（干净数据不动）。

#### 测试
- `smoke-test.js` 新增 11 条行为断言（共 22）：畸形落盘数据不崩、恶意 id 重生成且白名单合规、price 数字化、枚举落默认、备份恢复写回、双 key 损坏安全空态、v1 迁移写回。
- 新增 `tests/assert-batch3.js`：11 条静态断言（管道存在 / 双写 / 迁移可达且写回）。
- **反向验证记录**：修复前 smoke 13/22（D-01 断言直接复现 P0：`(s.price || 0).toFixed is not a function`）、assert-batch3 2/11；修复后全部 22/22 + 11/11，既有 assert-batch2 12/12、style 8/8 回归无退化。

### 批次 2 · 零风险修复（2026-10-25）

#### 行为修正声明（用户可感知）
- **A-01**：viewport 移除 `user-scalable=no`——移动端恢复双指缩放（规范 §10 无障碍要求）。
- **W-02**：种子夹具从根目录 `seed.html` 迁至 `tests/seed.html`，新增 `?run=1` 执行守卫——直接打开不再自动覆盖数据；跳转改相对路径（GitHub Pages 子路径下可用）。
- **J-02**：编辑订阅弹窗新增「取消」按钮——此前编辑态无关闭入口。
- **J-05**：Toast 修正为真单例——新提示出现即清除旧提示；此前 2.5s 内连发两条时前一条永不消失。
- **W-03**：iOS 添加主屏图标修复——`apple-touch-icon` 从 SVG 改指 `icon-192.png`（iOS 不支持 SVG）。

#### 内部修复
- **J-07**：日历页签/翻月事件从 `setTimeout(0)` 补绑改为渲染期绑定 `bindCalendarEvents()`，消除连续渲染时的双绑竞态。
- **U-08**：删除 5 处死 CSS：`.hidden`、`.card-meta .expiring-soon`、`.field-error`、`.toast .close`、`.stat .value.lg`。

#### 测试（新建 tests/ 基线）
- `smoke-test.js`：11 断言（vm 沙箱加载真实 app.js：渲染 / 徽章语义 / esc 转义 / __st API）。
- `style-consistency.js`：8 项守门。棘轮基线：间距越界 41 / 裸圆角 5 / 内联 style 15 / #000 字面量 2（只许降不许升；完整收敛属批次 7）。
- `assert-batch2.js`：12 断言（W-02/W-03/A-01/J-02/J-05/J-07/U-08）。
- **反向验证记录**：assert-batch2 修复前 0/12（全红）→ 修复后 12/12；style-consistency 修复前 5/8（死 CSS=5）→ 修复后 8/8；smoke 修复前后均 11/11（锁定现状行为，未迁就改动）。
- 零风险铁律核对：本批 diff 新增行零 px / 色值 / z-index 变更。

### 批次 1 · 目录归位（2026-10-25）
- 6 张根目录截图归位 `docs/screenshots/` 并按规范命名（`shot-<视图>-<主题>.png`）；重复冗长截图移入 `.trash-pending/`（待用户手动删）。
- README：目录树与实际结构对齐、修正错误路径（下划线 → 连字符）、移除指向已废弃旧规范的断链。
- data-model.md：移除断链引用；「拖拽排序」宣称改为如实描述（order 字段未消费、UI 未实现）。

### 批次 0 · 安全垫（2026-10-25）
- git init（main 分支）+ .gitignore（规范模板基线）+ 全量首提交（含盘点报告；发布整理时报告已移入本地 `.dev/` 档案，不入公开树）。
