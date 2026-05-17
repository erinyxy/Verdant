# Growth Marks 页 — 实施规格

> 这份文档是 Verdant「生长大事记」页的完整实施需求，已与产品方对齐冻结。
> 请按本文档实施，遇到需求边界外的决策点请先暂停询问，不要自行脑补默认行为。

---

## 1. 命名与路由

| 维度 | 值 |
|---|---|
| 路由 | `app/[locale]/milestones/page.tsx` |
| LocalStorage key | `verdant:marks` |
| 数据类型 | `GrowthMark`, `GrowthMarkEvent` |
| 组件 | `components/GrowthMarkCard.tsx`, `components/GrowthMarkDetail.tsx` |
| dataStore 方法 | `getAllMarks` / `getMarkById` / `syncMarks` |
| i18n 命名空间 | `marks.*` |

> ⚠️ 若仓库中已存在 `memories` 命名的路由/类型/key/i18n key，全部替换为上表对应项。原 `memories` 相关入口需要清理干净。

---

## 2. 三语文案对照表

| 位置 | 英文 | 中文 | 日文 |
|---|---|---|---|
| 底部 tab | Milestones | 大事记 | 小さな記念 |
| 页面大标题 | Growth Marks | 生长大事记 | 成長の印 |
| 页面副标题 | Some moments worth keeping | 一些想留下的时刻 | 残しておきたい、いくつかの瞬間 |
| 卡片副标题（7 天） | 7 days together 🌿 | 和你一起，7 天 🌿 | いっしょに 7 日 🌿 |
| 卡片副标题（30 天） | 30 days together 🌿 | 和你一起，30 天 🌿 | いっしょに 30 日 🌿 |
| 卡片副标题（90 天） | 90 days together 🌿 | 和你一起，90 天 🌿 | いっしょに 90 日 🌿 |
| 卡片副标题（180 天） | 180 days together 🌿 | 和你一起，180 天 🌿 | いっしょに 180 日 🌿 |
| 卡片副标题（365 天） | 365 days together 🌿 | 和你一起，365 天 🌿 | いっしょに 365 日 🌿 |
| 卡片结尾文案 | Growing quietly, little by little 🌿 | 一点一点，在长呢 🌿 | 今日も、少しずつ 🌿 |
| 空状态 | Your first growth mark is on its way · {days} days to go | 第一枚生长大事记还在路上 · 再过 {days} 天 | 最初の記念はもうすぐ · あと {days} 日 |

**事件文案 i18n key**（每条三语都要有）：

| key | 英文示例 | 中文示例 | 日文示例 |
|---|---|---|---|
| `marks.event.firstPhoto` | The day we met | 第一次见到你 | はじめて出会った日 |
| `marks.event.lastPhoto` | How you look today | 你今天的样子 | 今日のあなた |
| `marks.event.newLeaf` | A new leaf 🌿 | 长出了新叶 🌿 | 新しい葉が出た 🌿 |
| `marks.event.blooming` | Blooming 🌸 | 开花了 🌸 | 花が咲いた 🌸 |
| `marks.event.sick` | Looking unwell ⚠️ | 状态不太好 ⚠️ | ちょっと元気がない ⚠️ |
| `marks.event.lookingBeautiful` | Looking beautiful 💚 | 真好看 💚 | きれいだね 💚 |
| `marks.event.repot` | A new home 🪴 | 换了新家 🪴 | 新しいお家 🪴 |
| `marks.event.fertilize` | Got some food 🌱 | 加了点养分 🌱 | 栄養をあげた 🌱 |
| `marks.event.prune` | A little trim ✂️ | 修剪了一下 ✂️ | 少し整えた ✂️ |

**统计单位文案**：

| key | 英文 | 中文 | 日文 |
|---|---|---|---|
| `marks.stats.water` | {n} waterings | 浇水 {n} 次 | 水やり {n} 回 |
| `marks.stats.newLeaf` | {n} new leaves | 长了 {n} 片新叶 | 新しい葉 {n} 枚 |
| `marks.stats.blooming` | bloomed {n} times | 开花 {n} 次 | {n} 回咲いた |
| `marks.stats.maintenance` | {n} care actions | 维护 {n} 次 | お手入れ {n} 回 |

> 文案如果觉得不够柔和可以微调，但保持"温柔陪伴感"的调性，避免效率工具腔。

---

## 3. 数据结构

```ts
// 添加到 lib/dataStore.ts

export type MilestoneDays = 7 | 30 | 90 | 180 | 365;

export interface GrowthMarkEvent {
  timestamp: string;           // ISO 8601
  daysFromStart: number;
  photoId?: string;            // 关联 IndexedDB 中的照片
  type:
    | "firstPhoto"
    | "lastPhoto"
    | "newLeaf"
    | "blooming"
    | "sick"
    | "lookingBeautiful"
    | "repot"
    | "fertilize"
    | "prune";
}

export interface GrowthMark {
  id: string;
  plantId: string;
  milestoneDays: MilestoneDays;
  generatedAt: string;         // ISO 8601
  milestoneDate: string;       // ISO 8601, 达成 milestone 的日历日
  events: GrowthMarkEvent[];   // 最多 8 条
  stats: {
    water: number;
    newLeaf: number;
    blooming: number;
    maintenance: number;       // fertilize + repot + prune 合计
  };
  captionKey: string;          // 副标题 i18n key，生成时固化保存
}
```

存储位置：LocalStorage key `verdant:marks`，存 `GrowthMark[]` JSON。

---

## 4. 业务逻辑

### 4.1 起算日（startDate）

优先级取第一个非空值：

1. `plant.startedOn`（用户在新增页主动填的）
2. 该植物最早一条 timeline 记录的 `timestamp`（注意 timeline 时间是用户可改的）
3. `plant.createdAt`

### 4.2 陪伴天数

```ts
const days = Math.floor((Date.now() - new Date(startDate).getTime()) / 86400000);
```

### 4.3 触发规则

对每棵植物，遍历五个 milestone (7/30/90/180/365)：

- 若当前陪伴天数 ≥ milestone
- 且 (plantId, milestone) 组合在 marks 中不存在
- 且该 milestone 当天前**存在至少一张照片**

→ 生成一张 GrowthMark 卡片。

> 完全无照片的 milestone：跳过，不生成空卡片。

### 4.4 syncMarks 调用时机

进入 `/milestones` 页面时调用一次，扫描所有植物，把"应生未生"的卡片一次性补全。

例：用户突然补录了"15 天前我开始养它"的初始记录，syncMarks 会一次性生成 7 天卡片（因为起算日往前推了）。

### 4.5 已生成卡片永不修改

卡片是"快照"。即使后续 timeline 数据变化（新增记录、修改时间），已生成的卡片内容（events、stats、captionKey）永不重算。

### 4.6 事件挑选算法

候选事件 = 该 milestone 周期内 (startDate ~ milestoneDate) 所有 timeline entries 中：

- 必选：周期开头第一张照片对应的 entry（type: `firstPhoto`）
- 必选：milestone 当天前最近一张照片对应的 entry（type: `lastPhoto`）
- 周期内所有 state 类记录：`newLeaf` / `blooming` / `sick` / `lookingBeautiful` 各一条
- 周期内重要 action：`repot` / `fertilize` / `prune` 各一条
- **浇水（water）不进 timeline**，仅进底部统计

合并规则：

- 同一天多个事件可合并为一条（按事件类型优先级取主类型）
- 总数超过 8 条时，按以下优先级截断：

```
lastPhoto > firstPhoto > blooming > newLeaf > sick > repot > lookingBeautiful > fertilize > prune
```

### 4.7 副标题文案选择

每个 milestone 只准备 1 句（即上方文案表中的对应行）。`captionKey` 设为对应 i18n key（如 `marks.caption.30days`），生成时存下来。

> v2 如果想做"随机轮换"，再追加候选 key。

### 4.8 统计计算

| 字段 | 来源 |
|---|---|
| `stats.water` | 周期内 actions 包含 `water` 的 entry 数 |
| `stats.newLeaf` | 周期内 states 包含 `newLeaf` 的 entry 数 |
| `stats.blooming` | 周期内 states 包含 `blooming` 的 entry 数 |
| `stats.maintenance` | 周期内 actions 包含 `fertilize` 或 `repot` 或 `prune` 的 entry 数（每条 entry 算一次，不重复计数） |

渲染规则：每项独立判断，**N>0 才显示**，全 0 则整个统计带不渲染。

### 4.9 善后

`deletePlant(plantId)` 内部新增逻辑：删除 LocalStorage 中所有 `plantId` 匹配的 GrowthMark。

---

## 5. 视觉与交互

### 5.1 页面布局

- 顶部：大标题 + 副标题（约 24px / 14px）
- 主体：大卡片垂直堆叠，按 `generatedAt` desc，植物混合
- 间距：卡片之间 24px
- 空状态：插画 + 倒计时文案居中

### 5.2 GrowthMarkCard（海报式竖向）

```
┌─────────────────────────────┐
│  Monstera                   │ ← 植物名（大字）
│  30 Days                    │ ← milestone 主标题
│  和你一起，30 天 🌿          │ ← captionKey 副标题
├─────────────────────────────┤
│  ● Day 1   [img ~160px]     │ ← firstPhoto（首图稍大）
│            第一次见到你       │
│  ● Day 5   长出了新叶 🌿     │ ← state 事件，无图则纯文字
│  ● Day 12  换了新家 🪴       │
│  ● Day 18  [img ~80px]      │ ← 带照片的中间事件，图小
│            开花了 🌸         │
│  ● Day 30  [img ~160px]     │ ← lastPhoto（尾图稍大）
│            今天的你           │
├─────────────────────────────┤
│  🌿 2  🌸 1  💧 5  🪴 3      │ ← 统计带（仅 N>0 项）
│  一点一点，在长呢 🌿          │ ← 结尾文案
└─────────────────────────────┘
```

样式要点：

- 圆角 16，米白底（与首页背景区分），轻阴影像贴在纸面
- 左侧 timeline 竖线为浅灰绿（与品牌色调一致），节点圆点为深一档
- 所有图必须 `<img src={dataUrl} />`，**不要用 background-image**（截图友好）
- 字体：现有无衬线为主，副标题可加一点手写感
- 视觉调性参考 PRD：Light Journal Style，安静、克制、有纸面感

### 5.3 GrowthMarkDetail（全屏放大）

- 点击卡片 → 全屏 modal/portal 放大整张卡片
- 纯阅读，**不提供下载按钮**，用户自行用系统截图保存
- 进入动效：柔和淡入
- 关闭：点击空白处 / 顶部 X / 系统返回手势

### 5.4 空状态

- 当 `getAllMarks()` 返回空数组时显示
- 居中轻盈插画（可用 SVG 简笔叶子）
- 文案：「第一枚生长大事记还在路上 · 再 X 天」
- X 的计算：扫所有植物，找出 `(7 - 当前陪伴天数)` 的最小正值；若没有植物则不显示倒计时部分

---

## 6. Bottom Tab 集成

更新底部 tab navigation：

- 原 Memories tab → Milestones（三语：Milestones / 大事记 / 小さな記念）
- 路由目标：`/[locale]/milestones`
- 图标保持原线条手绘风（如果原来是 Memory 相关 icon，可改为类似"标签"或"小石碑"的简笔线条）

---

## 7. 实施 Task 清单

按以下顺序实施，每完成一项请更新 cowork mode 的 task 状态：

1. **dataStore 扩展：GrowthMark 类型与核心方法**
2. **i18n：三语 messages 更新（marks 命名空间）**
3. **路由：新建 /milestones 替换 /memories**
4. **GrowthMarkCard 组件：海报式卡片**
5. **GrowthMarkDetail 组件：全屏放大 modal**
6. **空状态：插画 + 倒计时**
7. **底部 tab 集成：Memories → Milestones**
8. **验证：mock 数据 + 三语 + 视觉**

> Task 1 与 Task 2 可并行（互不依赖）。
> Task 3~7 依赖 Task 1 和 Task 2 完成。
> Task 8 在所有前置完成后跑一遍。

---

## 8. 验证清单

实施完成后必须自测：

- [ ] seedData 三株植物能正确触发对应 milestone 卡片（按各植物当前陪伴天数）
- [ ] 人为修改 plant.startedOn 跨越多个 milestone → syncMarks 一次性补出多张卡片
- [ ] 无任何照片的植物不会生成卡片
- [ ] 三语切换 (en/ja/zh) 无遗漏 key，所有文案显示正常
- [ ] 卡片视觉对齐 Light Journal Style（米白底、轻阴影、纸面感）
- [ ] 移动端视口（375 ~ 414 宽）下卡片排版无破版
- [ ] 用系统截图工具截卡片，照片完整显示（验证 `<img>` 没踩 background-image 的坑）
- [ ] 删除植物后该植物的 marks 同步消失
- [ ] 全 0 统计的卡片不渲染统计带（不会出现空白区）
- [ ] 空状态显示正确的倒计时数字

---

## 9. 不要做（明确范围外）

- 不实现"下载卡片为图片"按钮
- 不实现卡片随机文案轮换（v1 每个 milestone 固定一句）
- 不实现事件型 milestone（首次开花、首次新叶等），仅天数型
- 不实现卡片编辑/删除
- 不实现卡片分享到社交平台
- 不引入 html2canvas 等截图依赖

如有以上范围之外的需求，请暂停询问产品方。

---

## 10. UI 精细化打磨 round 1（追加，必做）

实施 task 1~7 完成后，需要按以下规格做卡片视觉打磨。目标：从「信息卡片」升级为「档案物件」（museum archive feel）。

### 10.1 卡片底色与质地

| 元素 | 值 |
|---|---|
| 卡片底色 | `#F1E8D2` ~ `#EDE3CC`（archive ivory，比页面背景明显暖一档） |
| Grain 噪点 | 内嵌细颗粒 noise SVG 作 `background-image`，`opacity: 0.04~0.06`，`background-size: 120px`。推荐 `<feTurbulence baseFrequency="0.9" />` |
| 阴影 | `0 1px 2px rgba(60,40,20,0.04), 0 4px 16px rgba(60,40,20,0.06)`（偏棕调，不要纯黑） |
| 边缘 | `border: 1px solid rgba(140,110,70,0.08)` 模拟纸边 |

⚠️ Grain 必须克制，不能让卡片看起来"粗糙"——超过 0.08 透明度就过头。

### 10.2 标题区重构：30 Days 改为右上角 capsule

去掉原来"植物名 → 30 Days → 副标题"的三行堆叠。改成：

```
┌─────────────────────────────┐
│  Monstera           [DAY 30]│ ← 植物名 + 右上角 capsule
│  和你一起，30 天 🌿          │ ← 副标题紧跟植物名
├─────────────────────────────┤
```

Capsule 样式：

| 属性 | 值 |
|---|---|
| 位置 | 卡片右上角，`top: 20px; right: 20px`（绝对定位） |
| 形状 | 圆角胶囊 `border-radius: 999px` |
| 尺寸 | 高 26~28px，水平 padding 12px |
| 边框 | `1px solid rgba(122,154,119,0.35)` |
| 背景 | 透明 或 `rgba(122,154,119,0.05)` |
| 字体 | Sans-serif（与系统一致） |
| 文字 | `DAY 30` 全大写 |
| 字号 / 字重 | 11px / 600 |
| letter-spacing | 0.12em |
| 颜色 | `#4A6B47` 深灰绿 |

### 10.3 Day N 标签升级为 archive indexing 风格

timeline 里每条事件前的 "Day 12" 改写法和样式：

```
原: Day 12   长出了新叶 🌿
新: DAY · 12   长出了新叶 🌿
```

样式：

| 属性 | 值 |
|---|---|
| 字体 | Monospace（IBM Plex Mono / JetBrains Mono / SF Mono） |
| 字号 | 11px |
| letter-spacing | 0.1em |
| 字重 | 500 |
| 颜色 | `#6B8B66` ~ `#7A9A77` 灰绿 |
| 间隔符 | `·` 半角圆点 |

### 10.4 结尾文案：去除"默认说明文字"感

| 属性 | 值 |
|---|---|
| 颜色 | `#3D5238` 深叶绿（比正文略深） |
| 字号 | 13px（与正文一致或略大） |
| 字重 | 500 |
| letter-spacing | 0.02em |
| line-height | 1.6 |
| font-style | `italic`（**仅 en / ja，中文保持正体**——中文 italic 会变形） |
| 与统计带间距 | top padding 16~20px |

可选加强：文案上方加一条极浅短横线（24px 宽，颜色 `#D4C9A8`），像签字栏，强化"手写一句话"的物件感。

### 10.5 文案修订（已写入第 2 节文案表，仅在此重申）

| key | 修订 |
|---|---|
| `marks.event.firstPhoto` | en: `The day we met`（去掉 first，更克制） |
| `marks.event.lastPhoto` | en: `How you look today`<br/>zh: `你今天的样子`<br/>ja: `今日のあなた`（"あなた"比"君"更普适温柔） |

### 10.6 验证补充

在第 8 节验证清单基础上追加：

- [ ] 卡片视觉脱离页面底色，有"档案被抽出来一页"的体感
- [ ] DAY 30 capsule 在右上角，植物名与之水平对齐
- [ ] timeline 中 "DAY · N" 颜色为灰绿，字体为 monospace
- [ ] 结尾文案不再像浅灰说明文字，有收尾分量
- [ ] 中文结尾文案不是斜体（必须正体）
- [ ] grain 噪点细腻不粗糙，远看几乎看不出但近看有纸质感

