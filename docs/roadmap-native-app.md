# 路线：做成真正的原生 App

> 记录 2026-06-11 的方向决策与技术分析。还没动手，这是动手时的施工图。

---

## 已定的方向（2026-06-11）

| 决策 | 选择 |
|---|---|
| **分发形态** | 上架 App Store / Play Store（用 Capacitor 把现有网页包原生壳） |
| **数据模型** | 先纯本地，云同步留作未来 Pro 功能 |
| **iOS 防丢** | 用 iCloud（用户自己的 iCloud，零后端成本） |

---

## 为什么是 App 而不是停在 PWA

核心动机：**解决本地数据被回收/丢失的问题**。

- **PWA = Safari 里的网站**：受 Safari 7 天 ITP 回收政策管，用户一周不打开，IndexedDB 可能被系统清掉。
- **原生 app（Capacitor）**：跑 WKWebView，数据存在 app 自己的沙箱，**不受那个 7 天政策影响**。用户也无法像清网站那样精确清掉 app 数据（iOS 没有单 app "清除数据"按钮）。

→ "清缓存丢数据"和"Safari 回收"这两个问题，**做成 app 直接消失**。

**前提**：要真正稳，别继续用 WebView 的 IndexedDB（低存储时理论上仍可能被清）。把数据落到**原生持久层**——Capacitor SQLite 插件，存 app 的 Documents 目录。好在有 `dataStore` 抽象层（架构约束 #1），换存储实现只动这一层，页面零改动。这正是当初做这层抽象的目的。

---

## 防丢：两种 iCloud 别搞混

| 类型 | 换手机恢复 | 删 app 重装恢复 | 性质 |
|---|---|---|---|
| **iCloud 设备备份**（整机备份）| ✅ | ❌（只在整机恢复时用）| 被动 |
| **iCloud Drive / CloudKit**（app 主动写云）| ✅ | ✅ | 主动 |

"引导用户存 iCloud 防止删 app 丢数据"——必须是**第二种**。

### 这是独立开发者的甜蜜点

CloudKit / iCloud Drive 让你**不用自建多用户后端**，就拿到：
- 数据自动备份到**用户自己的 iCloud**（你零服务器成本、零数据隐私责任）
- 跨设备同步
- 删 app 重装可恢复

卡在"纯本地"和"自建云后端"中间，对独立开发者最划算。

**两种实现**：
- **简单版**：把 `exportBackup()` JSON 自动写到 app 的 iCloud Drive 容器，系统自动同步，重装后读回。改动小，复用现有备份逻辑。
- **完整版**：CloudKit 做记录级结构化同步，更顺滑但要原生集成。

---

## 必须知道的 trade-off

CloudKit / iCloud **只覆盖 Apple 生态**——Android 用户没有 iCloud。

早期策略：
- **iOS 版**：用 iCloud Drive 防丢（免费、稳）
- **Android 版**：先纯本地 + 备份提醒（Google Drive 备份或等 Pro）
- **Pro 阶段**：要一套方案覆盖双端，再上统一的自建后端（多用户版的 Cloud Mode）

---

## 分阶段流程

| 阶段 | 做什么 |
|---|---|
| **1. 固本地体验** | PWA 完善：离线、安装引导、`storage.persist()`（已做）、自动备份提醒、导出更顺手 |
| **2. Capacitor 包壳** | 引入 Capacitor，配 iOS/Android 工程；`dataStore` 换原生 SQLite（存 Documents） |
| **3. iOS iCloud 防丢** | 接 iCloud Drive 容器写 backup，或 CloudKit 同步 |
| **4. 上架准备** | 图标（已有品牌 V 全套）、截图素材、隐私政策、商店描述、过审。Apple 开发者账号 $99/年 |
| **5. Pro 云** | 免费纯本地，Pro 跨设备云同步（统一双端后端，复用现有 Cloud Mode 架构 + server-handoff 契约） |

---

## 已就位的地基

- **`dataStore` 抽象层**：本地 → 原生 SQLite / 云，只换这一层，13 个调用方零改动。Cloud Mode 已经验证过这套抽象能切换后端。
- **纯前端无 SSR 运行时依赖**：Capacitor 包壳很顺。
- **品牌 icon 全套**：iOS / PWA / favicon 都有。
- **备份导出/导入**：`exportBackup()` 的无损 JSON 正好能喂给 iCloud Drive 方案。
- **Cloud Mode 经验**：[`cloud-mode.md`](./cloud-mode.md) 里的 local-first + 同步协议，是未来 Pro 多用户云的雏形。
