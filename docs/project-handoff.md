# Verdant 项目交接文档

> **状态截至**：2026-06-11，commit `5ac9beb`
> **目的**：让新 session 不用翻整段对话历史，也不用从头 grep 代码库，就能进入工作状态。
> **维护**：每个重要 session 收尾时更新本文档。

---

## 1. 这是什么

**Verdant** — 一个移动端 Web App，**Plant Memory Journal**（植物成长记忆日志）。

- **核心定义**：围绕"植物成长记忆"的记录体验
- **不是**：效率工具、提醒软件、SaaS Dashboard、社交平台、植物图鉴
- **关键氛围**：Light Journal Style — 暖米白纸张色、轻阴影、克制动效、有手感而非工业感
- **隐私模型**：纯本地存储，每个用户只看到自己的数据。**不是**公开画廊。

---

## 2. 关键文档（必读）

| 文档 | 作用 |
|---|---|
| `CLAUDE.md` | **项目宪法**。技术栈锁定、4 条架构约束、产品决策、协作偏好。每次新 session 都应先读 |
| `AGENTS.md` | 一句话提醒：Next.js 16 有破坏性变更，写代码前查 `node_modules/next/dist/docs/` |
| `Verdant PRD.txt` | 原始 PRD（已被对话决策部分覆盖，以 CLAUDE.md 为准）|
| `Verdant_Backlog.md` | 未来想法池：架构警示区 / 纯 Backlog 分类 |
| `docs/growth-marks-spec.md` | Growth Marks 页（Milestones）的完整实施规格 |
| `docs/cloud-mode.md` | **Cloud Mode**（单 owner 本地优先云同步）完整说明 + 事故教训 |
| `docs/server-handoff/` | 给朋友 agent 的后端部署需求/契约/数据模型（4 件套）|
| `docs/roadmap-native-app.md` | 做成原生 App 的方向决策与施工图（Capacitor / iCloud 防丢）|
| `docs/project-handoff.md` | **本文档** |

---

## 3. 代码地图

```
verdant/
├── app/
│   ├── layout.tsx              # 根 layout，Lora + Manrope 字体，favicon link
│   ├── favicon.ico             # 浏览器 tab 默认 favicon（V 图标）
│   ├── globals.css             # Tailwind v4 + 品牌色 tokens (--brand-sage 等)
│   └── [locale]/
│       ├── layout.tsx          # locale 路由 layout，挂 SeedInit + BottomNav
│       ├── page.tsx            # Home：最近动态 + Growth Lookback + My Plants
│       ├── garden/page.tsx     # My Garden：active + Once together 分区
│       ├── milestones/page.tsx # Milestones：GrowthMark 卡片列表
│       ├── newcomer/page.tsx   # 新建植物表单（自动建 day-1 bringHome 记录）
│       ├── plant/[id]/page.tsx # 植物详情（hero + Growth Compare + timeline + 删除植物）
│       ├── owner/page.tsx      # 隐藏 Cloud Mode 入口（不链接，owner 手输 URL）
│       └── record/page.tsx     # 记录表单（FAB 入口）
│
├── lib/
│   ├── dataStore.ts            # ★ 所有数据访问的单一抽象层（必读）
│   │                           #   写入处 dispatch verdant:mutated 供 cloudSync 监听
│   ├── seedData.ts             # demo 数据初始化（5 株植物）
│   ├── storeMode.ts            # Local/Cloud 模式状态机 + detectMode()
│   └── cloudSync.ts            # Cloud Mode 背景同步（push/pull/iOS 韧性）
│
├── hooks/
│   └── useDataStore.ts         # usePlants / usePlant / useTimeline / usePhotosByPlant
│
├── components/
│   ├── BottomNav.tsx           # 底部三 tab：Home / Garden / Milestones
│   ├── SeedInit.tsx            # 客户端首次挂载触发 seedIfEmpty + persist storage
│   ├── DevReset.tsx            # 开发模式悬浮 "Reset" 按钮（清数据+重 seed）
│   ├── PhotoFromStore.tsx      # 按 photoId 从 IndexedDB 读取并 <img> 渲染
│   ├── PhotoCompare.tsx        # 双图对比（left/rightPhotoId，可配置参照）
│   ├── GrowthMarkCard.tsx      # 海报式卡片，按 kind 分支（milestone / farewell）
│   ├── GrowthMarkDetail.tsx    # 全屏 modal + Save image (html-to-image)
│   ├── CoverPhotoPicker.tsx    # 植物详情 hero 上换头像的底部抽屉
│   ├── SampleDataBanner.tsx    # 示例数据提示横幅（Home + Garden）
│   ├── FirstPlantEmptyState.tsx# 无植物时的温暖空状态
│   ├── DataMenu.tsx            # Garden header 齿轮：导出/导入备份 + Cloud Mode 入口
│   ├── CloudModeBadge.tsx      # Garden header 小角标（仅 Cloud Mode 显示）
│   └── LocaleSwitcher.tsx      # Home header 的语言切换
│
├── messages/
│   ├── en.json                 # 英文（默认）
│   ├── zh.json                 # 中文
│   └── ja.json                 # 日文
│
├── public/
│   ├── manifest.json           # PWA manifest（icon-192/512）
│   ├── apple-touch-icon.png    # iOS Home Screen icon (180×180)
│   ├── icons/                  # 所有品牌图标 + favicon 集
│   │   ├── brand-v-source.PNG  # 主品牌 V app icon 原图（其它都从它生成）
│   │   ├── icon-192.png        # PWA + 卡片 watermark 共用
│   │   ├── icon-512.png        # PWA maskable
│   │   ├── favicon-filled-{16,32,48,64}.png
│   │   └── ...
│   └── demo-photos/            # seed 引用的真实植物照片
│
├── scripts/
│   └── sync-demo-from-server.mjs  # npm run sync-demo：服务器数据 → 重写 seedData + demo-photos
├── proxy.ts                    # next-intl middleware（Next.js 16 改名为 proxy）
├── i18n/{request,routing}.ts   # next-intl 配置
└── package.json
```

---

## 4. 技术栈（锁定，不要改）

- **Next.js 16** + Turbopack（**重要**：中间件文件名是 `proxy.ts` 不是 `middleware.ts`）
- **TailwindCSS v4**（`@theme inline` 注册品牌色 tokens）
- **next-intl 4.x** — 路由 `[locale]/`，默认 `en`，支持 `zh/ja`
- **idb** — IndexedDB 封装
- **html-to-image** — Growth Mark 卡片转 PNG
- **browser-image-compression** — 客户端图片压缩（用户上传走这个）
- **html2canvas / jsPDF 等不要引入** — backlog 提到但 MVP 不做
- **没有后端、没有数据库、没有云同步、没有登录** — 这是死线

---

## 5. 4 条架构约束（不可妥协）

来自 CLAUDE.md，每次写代码前回顾：

1. **数据访问层抽象**：组件**永远不**直接调 `localStorage` 或 `indexedDB`，必须走 `dataStore`。
2. **照片用 `<img src={dataUrl}>`**，绝不用 CSS `background-image`（要支持截图）。
3. **时间戳标准化**：所有时间用 ISO 8601；IndexedDB 给 `timestamp` 建索引。
4. **PhotoCompare 接口**：组件只接受两个 `photoId`，"7 天前/30 天前/起点"的选择逻辑在**上层**。

---

## 6. 数据模型

### 三个存储区

| 存储 | 内容 | 大小限制 |
|---|---|---|
| `localStorage` | 元数据：plants / timeline / marks 数组 | 5-10 MB（够 |
| `IndexedDB` (store="photos") | 全部照片（base64 data URL）| 浏览器配额（通常几百 MB）|
| `localStorage` flags | seeding / cleared / sampleData / sampleBannerDismissed | 几个字节 |

### 核心类型（lib/dataStore.ts）

```ts
Plant {
  id, name, nickname?, startedOn?, endedAt?, coverPhotoId?,
  createdAt, updatedAt
}

TimelineEntry {
  id, plantId, timestamp, actions[], states[], photoIds[], note?
}

Photo {
  id, plantId, timestamp, dataUrl,
  isCover?  // 见 §7.1 day-1 vs cover 解耦
}

GrowthMark {
  id, plantId,
  kind?: "milestone" | "farewell",   // 缺省视为 milestone（向后兼容）
  milestoneDays,                     // milestone: 7|30|90|180|365；farewell: 实际陪伴天数
  generatedAt, milestoneDate, events[], stats, captionKey
}
```

### Action / State 枚举

```ts
ActionType = "water" | "fertilize" | "repot" | "prune" | "bringHome" | "sow" | "sayGoodbye"
StateType  = "newLeaf" | "blooming" | "sick" | "lookingBeautiful"
```

⚠️ `sayGoodbye` 是**生命周期动作**——故意从 Record 页的 chip 列表里排除，只能通过植物详情头部的 3-dot 菜单触发。

---

## 7. 关键设计决策（很容易翻车的点）

### 7.1 day-1 photo 与 cover 完全独立

**问题史**：早期 demo-builder 把 `coverDataUrl` 字段当"day-1 photo"用，cowork 又把它映射成 seedData 的 `coverPhoto`，导致换头像后 Growth Compare "First Day" 跟着变（用户期望它独立）。

**现在的模型**：
- `Plant.coverPhotoId` = **只是头像**（plant detail hero + garden 圆形头像）
- `Photo.isCover: true` = **cover-only**，从 `getPhotosByPlant` 默认排除
- Growth Compare "First Day"、Milestone `firstPhoto` event 都走 `getPhotosByPlant`（默认）→ 它们看不到 isCover 照片
- `CoverPhotoPicker` 显式传 `{includeCover: true}` 让用户能选到也能换回

**seedData 的双字段**：
```ts
dayOnePhoto?: string  // 普通照片，存在 startedOn 时间戳，作为 day-1
coverPhoto?: string   // isCover=true 的独立头像，可有可无
```

如果 `coverPhoto` 缺省，`coverPhotoId` 自动 fallback 到 `dayOnePhoto` 或第一张 record 照片。

### 7.2 植物 lifecycle（active ↔ past）

- `Plant.endedAt: string` 决定植物是否 past
- **自动维护**：`reconcilePlantEndedAt(plantId)` 在每次 saveRecord / updateRecord / deleteRecord 后自动调用，根据 sayGoodbye 时间线条目反推 endedAt
- **复活机制**：删掉 sayGoodbye 那条 timeline → reconcile 发现没 sayGoodbye 了 → 清 endedAt → 同时**自动删 farewell mark**
- Past 植物：FAB 隐藏（不能新增记录），3-dot 菜单隐藏（无可选动作），Garden 显示在底部"Once together"区
- `daysTogether` 对 past 植物**冻结**在 `endedAt - startedOn`

### 7.3 Sample data 体验

防止新用户误以为这是"别人的植物"画廊：

- `verdant:sampleData = "1"` 由 `seedIfEmpty()` seed 完成后设置 → 触发 Home/Garden 顶部温和的 banner
- 用户点 "Clear sample data" → `clearSampleData()` 清光 + 设 `verdant:cleared = "1"`
- `verdant:cleared` 这个 flag **阻止 seedIfEmpty 重新 seed**，否则刷新会复活示例数据
- `DevReset` 在开发模式手动清掉所有 flags 让 seed 重跑

### 7.4 Growth Marks 与 Farewell Mark

详见 `docs/growth-marks-spec.md`。要点：

- **17 档 milestone**：7 / 30 / 60 / 100 / 150 / 200 / 250 / 300 / 365 / 400 / 500 / 600 / 700 / 730 / 800 / 900 / 1000 天
  - caption 已**模板化**（`marks.caption.together` 用 `{n}` 插值），加档位零翻译成本
  - 730 那张卡右上角胶囊显示 "2 YEARS"（caption 仍是 "730 days together"）
  - 旧 mark 的 captionKey 指向已删的 per-day key，但卡片改读 `milestoneDays` 走模板，照常渲染
- **触发时机**：进 `/milestones` 页时 `syncMarks()` 一次性扫描所有 plant，生成缺失的卡。**懒触发**。
- **快照原则**：已生成的 mark 永不修改（即使 timeline 后续改变）
- **无照片不生成**：周期内没照片 → skip
- **Farewell mark**：用户点 Say goodbye 时**立即**生成（不是懒触发），记录全周期事件 + 总天数
- **复活清除**：删除 sayGoodbye 时间线条目 → 自动删 farewell mark

### 7.5 i18n 边界

参考 memory `verdant_i18n_scope`：

- **UI 文案**：按钮、标签、空状态、错误提示等 → 走 i18n 翻译文件
- **用户输入**：植物名、昵称、note → **原样保存**，不随 locale 变化（日本人可能用英文名，反之亦然）
- **Demo seed 数据**：植物名是日文（チューリップ 等），不按 locale 切换（这是 demo 选择，不是产品逻辑）

### 7.6 同日记录排序

记录的 timestamp 是 date-only（午夜），同日多条会**完全相等**。`getRecordsByPlant` / `getPhotosByPlant` / Home 合并排序都加了 **id desc tiebreak**（id 含 `Date.now()`，新插入的字符串更大 → 排前面）。直觉是"最新加的在最上面"。

### 7.7 编辑记录日期 → 照片 timestamp 跟随

`updateRecord` 在 timestamp 变化时**同步更新**该 record 所有 photoIds 对应的照片 timestamp，否则 Growth Compare 会指向错日期的照片。

### 7.8 PNG 导出的几个坑

`GrowthMarkDetail.handleSave` 里踩过的坑（已注释在源码里，别再踩）：

- 卡片背景的 fractalNoise SVG，html-to-image 渲不出来 → 导出前临时把 noise backgrounds 清掉，导出完再恢复
- 第一次 `toBlob` 经常 race condition 出空白 img → 跑一次 warm-up（throwaway）再正式跑
- 所有 `<img>` 在导出前先 `await img.decode()` 保证解码完成
- **`height: "0.5px"` 在导出 PNG 时会被 round 掉** → hairline 用 `height: 1`
- **`pixelRatio: 3`** 在 3x retina 上更锐（文件 ~2.3MB）
- **不要设 `backgroundColor`** → 让圆角真的透明出来，分享到任何底色都对

### 7.9 备份/恢复

- `exportBackup()` → 把 plants + timeline + marks + 全部 photos 打包成一个 JSON（无损）
- `importBackup(data)` → 校验 → `clearAllData()` → 写回 → 设 `cleared=1`（防止 auto-seed 覆盖）+ 清 `sampleData`
- 入口：Garden 头部齿轮菜单 `<DataMenu />`
- **持久化存储**：`SeedInit` 挂载时 `navigator.storage.persist()` 降低被回收概率

---

## 8. 已确认的产品决策（覆盖 PRD）

> 注：CLAUDE.md "已确认的产品决策" 章节是权威。这里只挑最容易踩的几条强调。

- **底部 Tab：Home / Garden / Milestones**（不是 PRD 原始的 Home/Record/Memories）
- **Record 入口**：右下 FAB，**不进 Tab**
- **Growth Compare 灵魂功能**：参照图来源必须可配置（`<PhotoCompare leftPhotoId rightPhotoId />`），不要硬编码 daysAgo
- **Memory 卡片可截图**：照片必须 `<img>` 不能 background-image；走 IndexedDB → data URL 同源
- **图片压缩**：用户上传走 browser-image-compression，最大 1MB / 1200px
- **Demo builder（独立工具，不在 repo 主线）**：上传最大宽 900px / quality 0.78
- **`coverDataUrl` in demo-builder JSON = day-1 photo**（不是头像！头像是另外的换封面操作）

---

## 9. 日常 workflow

### 启动

```bash
cd /Users/errena/Sites/verdant
npm run dev      # http://localhost:3000
```

打开 `/en`、`/zh`、`/ja` 任意一个。

### 构建验证

```bash
npm run build    # Turbopack 编译 + TypeScript 全量检查
```

每次推送前跑一遍，TS 错误一次性捞出来。

### Reset demo 数据

- **开发模式**：左下浮动 "Reset" 按钮（仅 NODE_ENV=development 显示），一键清光+重 seed
- **手动**：DevTools → Application → Clear site data → 刷新

### 部署

- **Vercel 接 GitHub auto-deploy**（不用 vercel CLI）
- 推 `main` → 自动构建 → 上线
- 生产 URL：https://verdant-neon.vercel.app
- 别名：https://verdant-git-main-erin-v-projects.vercel.app
- Vercel MCP 工具可查部署状态（list_deployments / get_deployment）

### iOS PWA 测试踩坑提醒

iOS 对 PWA icon **缓存极顽固**：
1. 长按旧图标 → Remove → Delete from Home Screen
2. Safari → 设置 → Clear History and Website Data（必要时）
3. 重新 Add to Home Screen

否则 iOS 一直显示旧图标。

---

## 10. 数据备份建议

CLAUDE.md 已锁定纯前端、无云同步。所以**用户必须养成定期导出习惯**：

- Garden 齿轮菜单 → Export backup → 下载 `verdant-backup-YYYY-MM-DD.json`
- 存网盘/邮件给自己/U 盘
- 换设备/换浏览器：旧设备导出 → 新设备 Restore

`navigator.storage.persist()` 已经主动请求 persistent storage，但**不是 100% 防丢**（用户主动清缓存、iOS Safari 7 天回收 PWA 存储还是没救）。

> **防丢的正式方案已定方向**：做成原生 App（Capacitor 包壳，绕开 Safari 回收）+ iOS 走 iCloud Drive 防丢。详见 `docs/roadmap-native-app.md`。owner 自己已有 Cloud Mode（`docs/cloud-mode.md`），但那是单用户专用，不是公开用户的备份方案。

---

## 11. 完成的主要工作

### 2026-05 截至（按时间线）

1. **项目骨架 + i18n + dataStore 抽象** —— Day 1 全部就位
2. **5 个真实页面**（Home / Garden / Milestones / Plant Detail / Newcomer / Record）
3. **Growth Marks 系统**（spec §1-9 + UI 打磨 round 1 / §10）
4. **Plant lifecycle**：endedAt + sayGoodbye + revive + Garden 分区
5. **Cover photo picker** + day-1/cover 解耦（isCover flag）
6. **Milestone card 保存图片**（html-to-image + Web Share fallback）
7. **Sample data 体验**：banner + clear-with-confirm + 防重 seed
8. **Backup export/import**（无损 JSON 全量）+ persistent storage
9. **同日排序 tiebreak** + 编辑日期同步照片 timestamp
10. **Farewell Growth Mark**（新 kind）+ Lora 衬线题刻
11. **品牌 V icon 全套**（iOS + PWA + favicon + 卡片 watermark）
12. **卡片导出打磨**：rounded-3xl + pixelRatio 3 + 透明圆角

### 2026-06 截至

13. **Cloud Mode**（单 owner 本地优先云同步，Tailscale 后端）—— 详见 `docs/cloud-mode.md`
    - `storeMode` + `cloudSync` + `/owner` 隐藏页 + CloudModeBadge + DataMenu 入口
    - 后端部署在朋友服务器（`docs/server-handoff/` 4 件套交接），sync-demo 脚本反向更新 demo
    - ⚠️ 踩坑：default-pull 清空本地丢过数据；iOS setTimeout 挂起漏同步（均已修，见 cloud-mode §8）
14. **删除植物**功能（详情页 3-dot 菜单，cascade 删 timeline/marks/photos，past 植物也能删）
15. **Newcomer day-1 锚定**：照片 + 自动 bringHome 记录都落在 startedOn（不再是"今天"）
16. **Garden together-days 修复**：`getTogetherDays` 传 records，无 startedOn 时用最早记录兜底
17. **iOS viewport 根治**：手机端改文档滚动 + 纯 fixed nav（去掉 h-dvh 框 + translateZ + backdrop-filter）
18. **Milestone 5 → 17 档** + caption 模板化 + 730="2 YEARS" 胶囊
19. **首页 "Erin's Lab" 署名**（Noto Sans，图案下方居中）
20. **方向决策**：做成原生 App（Capacitor），云留作 Pro，iOS 走 iCloud 防丢 —— 详见 `docs/roadmap-native-app.md`

---

## 12. 已知 / 待办（CLAUDE.md backlog 维护）

CLAUDE.md "已知 Bug" / "待实现功能" 章节是单一来源。每次完成或新发现请去那里更新（不在本文档维护）。

---

## 13. 协作约定

- **回复用中文**
- 代码解释**简明易懂**，假设用户是新手
- 给**完整可运行**的代码，避免片段
- 优先**简单易维护**，避免复杂依赖
- **重要决策前先确认**，不脑补默认行为
- 改动前先 **`npm run build`** 验证，避免推上 Vercel 才发现 TS 错

---

## 14. 给下个 session 的临别叮嘱

- **先读 `CLAUDE.md`** —— 比读本文档更重要，它是合同
- **遇到数据问题第一反应**：grep `dataStore.ts`，所有读写都在那
- **想加新功能时**：先看 `Verdant_Backlog.md` 的"架构警示区"，避免现在做出"以后要重写"的代码
- **Next.js 16 不是你训练数据里的 Next.js**：API 有破坏性变更，写代码前查 `node_modules/next/dist/docs/`（AGENTS.md 提醒）
- **commit 前请 build**：TS 错在 dev 模式经常漏，build 时全量检查
- **iOS / 浏览器缓存极顽固**：换 icon / 改 CSS 时让用户 hard refresh / 重装 PWA
- **保持温柔**：这是 Plant Memory Journal，不是 SaaS Dashboard。任何 UI 写出"Material Design"味道都要重做。
