# Cloud Mode 说明

> 单 owner 的本地优先（local-first）云同步。给作者自己跨设备/防丢用，**不是**多用户后端。
> 公开 demo 访客完全不受影响——匿名访客继续纯本地，不发任何网络请求。

---

## 1. 定位与边界

- **谁用**：只有 owner 一人，目前单设备（手机 Chrome）。
- **匿名 demo 访客**：永远 Local Mode，看不到任何云 UI，不连服务器。
- **不是**多用户 SaaS：服务器只存 owner 一个人的数据，单一 `OWNER_TOKEN` 认证。
- **未来**：真正多用户的云同步是 Pro 功能，见 [`roadmap-native-app.md`](./roadmap-native-app.md)。

---

## 2. 架构：local-first + 背景同步

选型理由（详见对话决策）：owner 单用户单设备，多设备冲突不是问题，所以**不**做 facade 式"cloud 直连后端"，而是：

- **本地永远是工作副本**：所有读写照走 `dataStore`（IndexedDB + localStorage），**业务逻辑零改动**（syncMarks / reconcilePlantEndedAt / 编辑日期同步照片 等全保留）。
- **Cloud Mode 下**：每次本地 mutation 后，把整包 `exportBackup()` 异步推到服务器。UI 从不阻塞在网络上。
- **离线可用**：地铁没信号也能记录，恢复后自动补推。

### mutation 事件机制

`dataStore.ts` 在底层写入处（`savePlantsToLS` / `saveTimelineToLS` / `saveMarksToLS` / `savePhoto` / `deletePhoto`）dispatch `verdant:mutated` 事件。`cloudSync` 监听它 → 500ms debounce → 推送。这样业务逻辑层完全不知道 sync 的存在。

`withSuppressedMutationEvents()` 包裹"从云写回本地"的操作（pull / import），防止 pull → 触发 mutated → 又 push 回去的死循环。

---

## 3. 关键文件

| 文件 | 作用 |
|---|---|
| `lib/storeMode.ts` | Local/Cloud 状态机。token + baseUrl 存 localStorage；`detectMode()` 启动时 ping `/health`（4s 超时），失败静默退回 Local |
| `lib/cloudSync.ts` | 监听 `verdant:mutated` → debounce 推送；`pullFromServer()` 拉全量；`pushAllToServer()` 一次性迁移；`installSyncListener()` 注册 iOS 韧性钩子 |
| `app/[locale]/owner/page.tsx` | 隐藏入口（不链接），owner 输 token、Test/Save&enable、Pull/Push、Sync now、Reseed、Disable |
| `components/CloudModeBadge.tsx` | Garden header 小角标，**仅 Cloud Mode 显示**，点击跳 `/owner`。匿名访客看不到 |
| `components/DataMenu.tsx` | Garden 齿轮菜单加了 "Cloud Mode…" 入口 |
| `components/SeedInit.tsx` | 启动时 `detectMode()`；cloud 则跳过 seed + 启动时 flush 一次；local 才 seedIfEmpty |

---

## 4. 同步协议（对接服务器 API）

服务器 API 契约见 [`server-handoff/api-contract.md`](./server-handoff/api-contract.md)。前端这侧要点：

- **Push（本地 → 云）**：整包 `exportBackup()` JSON → `POST /import?wipe=1`。不做 per-entity diff——owner 数据量小，整包最简单。数据量大了再换 per-resource PUT。
- **Pull（云 → 本地）**：
  - `GET /plants` / `/records` / `/marks`
  - 照片**按 plant 逐个** `GET /photos?plantId=`（后端不接受裸 `/photos`）
  - cover 照片单独 `GET /photos/:id`（`/photos?plantId=` 默认排除 isCover）
  - 服务器返回的签名 URL 照片，fetch 下来转 base64 存进本地 IndexedDB（保持 `<img src={dataUrl}>` 架构红线 §2）

### iOS 韧性（installSyncListener）

iOS Chrome/Safari 会挂起后台标签的 `setTimeout`，导致 debounce 的推送永远不触发。三道保险：
- `visibilitychange` → 切回标签时 flush
- `pagehide` → 尽力 flush（iOS 经常在 POST 完成前杀页面）
- App 启动进 Cloud Mode → flush 一次（补上次没推完的）

---

## 5. Owner 操作流程

手机连 Tailscale 后：

1. 打开 `https://verdant-neon.vercel.app/en/owner`
2. 填 API base URL（`https://117b-company.tailbb76ca.ts.net:8443`）+ OWNER_TOKEN
3. **Test connection** → "Token accepted"
4. **Save & enable** → 只存凭证 + 切 Cloud Mode，**不自动 pull/push**（见 §6 事故教训）
5. 方向由人显式决定：
   - **Push local → cloud**：本地数据上传覆盖服务器（首次迁移用）
   - **Pull cloud → local**：服务器数据覆盖本地
6. 之后正常用，每次记录自动后台同步（不用手点）

token 取法（服务器上，路径见 DEPLOY.md，实际可能在 `.env`）：
`sudo grep ^OWNER_TOKEN /data/r00t/verdant/api/.env`
或从运行进程：`sudo cat /proc/$(systemctl show -p MainPID --value verdant-api)/environ | tr '\0' '\n' | grep OWNER_TOKEN`

---

## 6. 服务器

- 部署在朋友的服务器（host `117b-company`），由朋友的 agent 完成。完整运维手册在**服务器上的** `/data/r00t/verdant/DEPLOY.md`。
- 交接给朋友 agent 的需求/契约在本仓库 [`docs/server-handoff/`](./server-handoff/)。
- **网络**：API 跑 `127.0.0.1:3001`，Tailscale Serve 暴露成 `https://117b-company.tailbb76ca.ts.net:8443`（注意 **8443** 端口，443 被另一个无关 Funnel 占了）。仅 tailnet 内可达，不公开。
- **存储**：SQLite + 照片落盘 `uploads/`。照片服务支持 header auth 和签名 URL 两种。
- **认证**：单 `OWNER_TOKEN`，`Authorization: Bearer`，无 cookie。
- **挂载**：作者 Mac 上 `/Volumes/r00t/verdant` 是这台服务器的 SMB 挂载（**不是** SSH 进的 `ws-shuaijun` 工作站——那是另一台机器，曾因此找不到文件）。

---

## 7. sync-demo 脚本：服务器 → 公开 demo

`scripts/sync-demo-from-server.mjs`（`npm run sync-demo`）把服务器当前内容搬进公开 demo：

- 拉服务器数据 → 重写 `lib/seedData.ts` 的 `PLANTS[]` + 清空重写 `public/demo-photos/`
- 凭证从 `.env.local`（gitignored，模板 `.env.local.example`）或环境变量
- **全量覆盖**，跑完 `git diff` 审一眼再 commit/push，Vercel 部署后新访客就 seed 新内容
- ⚠️ 服务器上有什么 demo 就有什么——不想公开的植物/照片，同步前先处理
- 多照片 record 只取第一张（seed 格式每条 record 一张照片）

---

## 8. 事故教训（已修复，别再踩）

1. **default-pull 清空本地**：早期 `Save & enable` 默认拉服务器覆盖本地，服务器空时把本地清成空，丢了作者一周数据 + demo 状态。**现在**：enable 不自动同步，pull/push 都要人显式点 + 确认对话框。`SeedInit` 启动也不自动 pull（会清掉未同步的离线写）。
2. **iOS setTimeout 挂起 → 同步漏**：后台标签 debounce 不触发，导致以为同步了其实没。**现在**：visibilitychange / pagehide / boot 三处 flush。
3. **`/photos` 必须带 plantId**：后端没有全局照片列表端点，pull 要按 plant 迭代 + cover by id。
