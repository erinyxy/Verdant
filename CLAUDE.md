@AGENTS.md

# 项目：Verdant（植物成长记录 App）

## 项目定位
- **类型**：移动端 Web App（纯前端 Demo）
- **核心定义**：A Plant Memory Journal — 植物成长记忆记录工具
- **不是**：效率工具、提醒软件、SaaS Dashboard
- **是**：围绕"植物成长记忆"的记录体验

## 核心价值
帮助用户通过记录植物日常变化（浇水、长新叶、换盆、拍照），看到植物随时间成长的过程，便捷清晰掌握植物的生长状态变化，并获得一种**温柔的陪伴感**。

## 完整 PRD
详细需求见同目录的 `Verdant PRD.txt`，包含：
- 5 个页面规格（Home / Record / Plant Detail / Newcomer / Memory）
- 底部 tab 导航（Home / Record / Memories）
- UI 风格（Light Journal Style，80% clean / 20% handmade warmth）
- 配色、字体、动效要求
- Mock 数据初始化（三色堇 / 橡皮树 / 蓝眼菊）

## 技术栈（已锁定）
- **框架**：Next.js
- **样式**：TailwindCSS
- **国际化（i18n）**：**从 day 1 就要有,不是后期添加**
  - 库：`next-intl`
  - 支持语言：英文（默认）/ 日语 / 中文
  - 最终发布版本面向英语和日语用户,中文保留供开发时切换查看
  - **所有 UI 文字必须从翻译文件读取**,不允许硬编码字符串
- **存储**：浏览器本地存储（无后端、无数据库、无云同步）
  - 元数据（植物列表、时间线条目）→ LocalStorage
  - **照片 → IndexedDB**（LocalStorage 容量限制 5-10MB，装不下照片，必须分开）
  - 推荐用 `idb` 库简化 IndexedDB 操作
- **图片压缩**：客户端压缩，推荐 `browser-image-compression`
- **部署**：可直接 Vercel 部署
- **PWA**：支持 Add to Home Screen、Apple touch icon、standalone 显示

## 明确不做（避免范围扩张）
- 登录注册、云同步、分享、社交
- 后端 API、AI 识别、推送通知
- 复杂数据分析、图表、Dashboard

## 产品原则
- 体验优先于功能堆砌
- 界面风格：温暖、自然、有生命感，像纸张和植物馆展签，避免冷硬的效率工具感
- 用户首先是自己

## 视觉风格要点（关键）
- **风格**：Light Journal Style
- **配色**：暖米白/纸张色背景，浅绿/灰绿/淡棕作为辅助
- **阴影**：非常轻，像卡片贴在纸面
- **字体**：现代无衬线为主，少量手写点缀
- **图标**：线条感，轻微手绘感
- **动效**：非常克制，柔和淡入，轻微位移
- **避免**：SaaS dashboard 风、Notion clone、Material Design、强科技感

## 边界情况处理建议
- "Today vs 7 days ago" 对比：植物记录不足 7 天时，需要降级显示（如"还在积累记忆中..."），不要显示空白或报错
- Memory 卡片生成：需要确定触发时机（推荐：按养护起始日累计达到 7/30/90/180 天自动生成）

## 关键架构约束（Day 1 必须遵守）

### 1. 数据访问层抽象
- **所有数据读写必须封装在 `dataStore` 模块**(如 `lib/dataStore.ts`)
- 组件不直接调 `localStorage` 或 `indexedDB`,只调 `dataStore.savePlant()`、`dataStore.getPlantById()`、`dataStore.getRecordsBetween()` 等语义化方法
- 原因:未来商业化 Pro 版需要切换到云端后端,这一层抽象能避免重写所有页面

### 2. Memory 卡片"可截图友好"设计
- 卡片图片用 `<img>` 标签,不要用 CSS `background-image: url(...)`
- 照片源走 IndexedDB → base64 data URL(同源,避免 canvas 跨域)
- 原因:未来要支持卡片生成图片分享/下载

### 3. 时间线数据按时间戳索引
- 时间线条目必须有标准化 `timestamp` 字段(ISO 8601 或 unix 毫秒)
- IndexedDB 给 `timestamp` 建索引,`dataStore` 提供按时间范围查询的方法
- 原因:未来要支持年度报告下载,需要按时间范围聚合数据

### 4. 双图对比组件设计:参照图来源必须可配置
- **背景**:双图对比是 Verdant 的灵魂功能,目标是"解决植物状态对比的痛点"
- **MVP**:右图来源是"7 天前 / 30 天前 / 起点"三档预设(已在 PRD)
- **设计要求**:对比组件的参照图来源不能硬编码,要做成"可配置的图片源"
  - 组件接口:`<PhotoCompare leftPhotoId={...} rightPhotoId={...} />`,而不是 `<PhotoCompare daysAgo={7} />`
  - "选择 7 天前"应该是上层逻辑:根据 `daysAgo` 找到对应的 `photoId`,再传给对比组件
- **原因**:未来要进化成"用户自由选择任意一张历史照片做对比",不应该重写组件
- **关键产品哲学**:这个功能要快速迭代,先做简版让用户感受,再根据使用反馈决定复杂版怎么做

## 已确认的产品决策（对话中锁定，优先级高于 PRD 原始文档）

### 页面结构
- 底部 Tab 维持现有实现：**Home / Garden / Milestones**（非 PRD 原始的 Home/Record/Memories）
- Record 入口保留为右下角悬浮按钮，不放进底部 Tab
- 首页"最近动态"列表无需加植物详情跳转入口
- 植物详情页顶部无需显示状态标签

### 语言与文字
- **植物名称、备注（note）等用户输入字段，以用户提交内容为第一优先，不随 locale 变化**
  - 用户可能用任意语言命名植物（如日本用户也可能填英文名），系统原样存储和显示，不做自动翻译
  - 仅 UI 框架文字（按钮、标签、提示语等）走 i18n 翻译文件
- Seed/demo 数据的植物名称按当前 locale 显示（三语言版本），这是 demo 展示需要，不是产品逻辑

### 图片处理
- 所有用户上传的照片在客户端压缩后存储：最大 1MB、最长边 1200px（使用 browser-image-compression）
- Demo 数据录入工具（demo-builder.html）中上传的照片：最大宽度 900px、quality 0.78

### 待实现功能（已明确需求，排期中）
- **记录可编辑/删除**：时间线条目支持修改日期、状态、动作，支持整条删除（P0，影响 Growth Mark 准确性）
- **封面照片可后期更换**：植物详情页提供入口替换封面，不限于新增时上传（P1）
- **植物"离开了"逻辑**（P2）：
  - 植物详情页可标记"已离开"，填写离开日期
  - 标记后 together 天数从离开日期起定格，不再增加
  - Garden 页面底部单独显示"曾经陪伴过的植物"区域
  - 离开的植物仍可查看时间线和 Growth Mark，只读不可新增记录

### 已知 Bug（待修复）
- 植物详情页 TimelineCard 的 action/state 显示英文原始 key（如 "water"），未走 i18n（P0）
- 植物详情页相对时间（Today/Yesterday/Xd ago）硬编码英文，未走 i18n（P0）

## 协作偏好
- 请用**中文**回复
- 代码解释要简明易懂，假设我是新手
- 给出完整可运行的代码，避免片段化
- 优先简单易维护的技术方案，避免引入过于复杂的依赖
- 重要决策前先和我确认，不要自己脑补默认行为
