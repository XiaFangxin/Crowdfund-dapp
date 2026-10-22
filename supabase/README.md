# Supabase Setup & Off-chain Architecture

更新日期：2026-10-22。本模块为可选功能；Solidity + Sepolia + MetaMask 架构及既有资金流程保留。**尚未连接或部署到真实 Supabase 项目，也未部署 Sepolia 合约或发送链上交易。** 以下部署命令仅供负责人配置后手动执行。总体验收状态与 UI 优先级见 [主 README](../README.md)；本节命令均在仓库根目录执行。

### 职责边界、身份和权限

```text
React -> MetaMask -> Sepolia Crowdfunding        Campaign / creator / owner / money
React -> interactions Edge Function -> PostgreSQL  comments / views / favorites / reports
            | SIWE signature + opaque session validation
            | allowed contract getCampaign() / current V2 owner() (read-only RPC)
```

所有项目数据以 **chainId + lowercase contractAddress + decimal-string campaignId** 标识，数据库主键、外键、唯一索引、前端缓存和查询均包含该组合。V1/V2 的 Campaign 0 不会合并。`oc_campaigns` 只保存经链上验证的身份指针、校验时间和近似 Views，不复制目标、余额、筹款额、创建者、分类或管理员角色作为权威数据。匿名首次访问一个新指针时，服务端验证允许合约的 `getCampaign()`；后续复用该身份记录。链上资金规则与链上页面原有权限检查不变。

钱包登录没有邮箱/密码，不调用资金交易。服务端生成 256-bit 随机 nonce 与 5 分钟挑战，按 [EIP-4361 / SIWE](https://eips.ethereum.org/EIPS/eip-4361) 格式绑定准确域名、URI、钱包、chainId=11155111、Issued At 与 Expiration Time。前端只签署完全符合该模板的消息，使用 MetaMask `personal_sign`；Edge 用 ethers 验证 EIP-191 签名，并从自己保存的挑战恢复身份，拒绝客户端自填 message/author/admin。数据库通过原子条件更新消费 nonce，并建立最长 1 小时会话，重放或并发验证只有一次可成功。

会话采用标准**随机不透明 Bearer 令牌**：32 个加密随机字节，数据库仅保存 SHA-256 哈希；不是自造 JWT，也不冒充 Supabase Auth 用户。原始令牌只在当前页面内存保存，不写 localStorage；刷新页面需重新签名，另一个设备签入同一钱包会恢复其云端收藏。每个私有 RPC 再次依据哈希、origin、有效期查询服务端会话，从会话派生作者钱包；请求中的 walletAddress / isAdmin 无效。登出删除当前服务端会话；钱包/链切换立即清理界面并撤销旧会话。网络离线无法保证即时服务器撤销时，UI 显示待重试并保留内存撤销队列，恢复联网后重试；已经过期/撤销的令牌视为失效，不能继续写入。其他设备的独立会话不随本设备登出自动注销。

数据库对所有 10 张 `oc_*` 表启用 RLS，撤销 PUBLIC / anon / authenticated 的表访问及所有本模块 RPC 执行权限，不提供匿名写入策略；即使未来误授 SELECT，默认拒绝 RLS 仍隐藏数据。浏览器只调用 Edge，不直接调用 PostgREST 表/RPC。Edge 在服务端持有 service-role，调用 `security invoker` RPC；这些 RPC 从有效会话中派生用户并检查所有权、复合外键与唯一约束。服务端角色是受信任边界，绝不能进入客户端。设计参考 [Supabase RLS](https://supabase.com/docs/guides/database/postgres/row-level-security) 和 [函数权限](https://supabase.com/docs/guides/database/functions)。没有依赖可由用户修改的 user_metadata 或数据库 isAdmin 字段。

审核权限使用单独、人工配置的 V2 `MODERATION_CONTRACT_ADDRESS`，可管理允许列表里的 V1/V2 链下举报。每次读取举报或审核时，服务端直接读取该 V2 的 owner、registry 能力和区块号，匹配会话钱包；RPC 失败、网络不符、V2 未配置或旧 owner 一律拒绝。数据库只接受由 Edge 单独传入的校验结果，并记录审核人、区块和动作。链与数据库无法做同一个原子事务；权限以该次 RPC 读取区块为依据，不缓存管理员身份。V2 尚未部署时可使用 V1 的普通互动，但管理员审核关闭，举报留待处理。

### 实际目录与接口

| 路径 | 用途 |
| --- | --- |
| `supabase/migrations/202610210001_offchain_interactions.sql` | 身份指针、挑战、会话、匿名访问令牌、评论、收藏、举报、审核日志、去重窗口、限流；复合键、分页索引及私有 RPC |
| `supabase/functions/interactions/index.ts` | 可部署的 Deno Edge 入口；读取服务端设置、服务端 Supabase REST RPC 客户端；不创建交易 signer |
| `supabase/functions/_shared/core.js`、`handler.js`、`chain.js` | SIWE 消息/签名与输入检查、CORS/HTTP/会话路由、合约允许列表及链上权限读取 |
| `supabase/config.toml`、`supabase/functions/deno.json` | 此函数的自定义鉴权配置和固定 ethers npm 导入；**verify_jwt=false 仅用于本函数**，因为它验证自有的数据库会话，不接受 Supabase 用户 JWT 冒充钱包 |
| `supabase/secrets.example.txt` | 服务端配置占位模板，不含真实凭据 |
| `supabase/tests/`、`supabase/package.json`、`supabase/package-lock.json` | Node + PostgreSQL WASM 测试、真实 SQL 迁移/角色权限检查；不是伪造连接结果 |
| `frontend/src/services/supabase.js`、`interactions.js` | 轻量 fetch 型 Supabase Edge 客户端（无需额外客户端 SDK）；公开配置、会话请求、匿名访问令牌、批量计数 |
| `frontend/src/hooks/useWalletSession.jsx`、`useInteractionQuery.js`、`useOffchainAction.js` | 应用级会话、过期/切换/撤销、旧请求取消、数据隔离、重复提交保护 |
| `frontend/src/config/supabasePublic.js`、`frontend/vite.config.js` | 检查公开设置；构建时拒绝 service-role JWT、secret key 或服务端 Supabase key 变量，错误不打印其值 |
| `frontend/src/utils/interactionKey.js`、`walletChallenge.js` | 复合标识、不同部署链接保护、签名前消息绑定校验 |

所有 API 都是 `POST /functions/v1/interactions`，JSON 包含 action；公钥放 `apikey`，已登录请求另带 `Authorization: Bearer <opaque-session-token>`。客户端不发送自己的数据库 author 身份。动作如下：

| action | 权限、主要参数及结果 |
| --- | --- |
| `auth.challenge` / `auth.verify` | 公开且限流；wallet+chainId 获取服务端消息；id+signature 原子验证并返回会话；不接受客户端挑战正文 |
| `auth.session` / `auth.logout` | 有效会话；检查或撤销当前会话，不接受自填钱包身份 |
| `visitor` / `view` | 无钱包登录；visitor 返回匿名访问令牌，view 带复合项目键和 `x-visitor-token`；不请求 MetaMask 签名 |
| `comments` | 公开；复合键、可选 parentId、offset；固定每页 20，offset 最多 10000；隐藏评论正文返回 null，保留回复位置 |
| `comment.create` / `comment.hide` | 已验证钱包；body 最多 2000 字符、requestId UUID；最多一层回复；hide 仅本人。隐藏是软删除，正文不再公开，审计/回复仍保留 |
| `favorite.state` / `favorite.set` / `saved.list` | 已验证钱包；saved 布尔值决定收藏/取消，复合键唯一；个人收藏固定每页 20，可跨设备恢复；只有会话本人可改 |
| `report.create` | 已验证钱包；targetKind、可选 commentId、10–1000 字符 reason、requestId；每钱包对同一对象只能举报一次，跨项目评论 ID 不能复用 |
| `reports.list` / `report.moderate` / `comment.moderate` | 服务端校验当前 V2 owner；举报每页 20，可筛状态；标记 in_review/resolved/dismissed，处理评论举报时可同时隐藏；审核日志记录动作，不发送链上交易 |
| `metrics` | 公开；最多 100 个复合键/批次，返回字符串形式的近似 views 和收藏数量；不公开收藏用户身份 |

### 人工配置与部署步骤

1. 在 Supabase Dashboard 新建项目，妥善保存数据库密码和管理密钥，不写入仓库。当前模块使用自己的 Edge 钱包会话，不需要启用邮箱密码、匿名 Auth 注册或额外钱包身份供应商。创建项目不等于已连接本应用。
2. 安装 Supabase CLI，**由负责人手动**在仓库根目录执行。`db push` 会修改选中 Supabase 项目，先审阅迁移并确认项目是本应用目标：

```sh
npx supabase login
npx supabase link --project-ref YOUR_PROJECT_REF
npx supabase db push
```

也可在全新测试项目的 SQL Editor 执行本迁移内容；二者选一种，不要重复执行。迁移仅管理 `oc_*` 对象，不撤销其他应用函数的权限。之后在 SQL Editor 执行 `supabase/tests/verify_permissions.sql`；它只检查 RLS/角色/RPC 权限，不查询令牌或私密正文。

3. 复制 `supabase/secrets.example.txt` 为 Git 忽略的 `supabase/.env.local`，填写自己的值：

| 设置 | 公开性及说明 |
| --- | --- |
| `APP_ORIGINS` | 服务端维护的精确 origin JSON 数组，例如 `["http://localhost:5173"]`；生产填写实际 HTTPS 域名；不能使用通配符，也不含路径/末尾斜杠。开发端口变化需同步更新 |
| `CHAIN_RPC_URL` | **仅服务端**，Sepolia 只读 RPC，可含供应商凭据；不放在 VITE_*，不提供私钥 |
| `CAMPAIGN_CONTRACTS` | 服务端项目允许列表：JSON 数组，每项 `{chainId, address, version}`；模板只有真实 V1 地址。V2 必须等新部署后填入真实地址及 `version:"v2"`，不能把 V1 标为 V2 |
| `MODERATION_CONTRACT_ADDRESS` | 真实、已审阅且在允许列表中的 V2 管理合约；未部署时留空，后台审核拒绝访问；不能编造新地址 |
| `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` | 托管 Edge Runtime 自动注入；URL 本身是公开标识，但 **service-role 密钥只能在服务端**。不要把内置变量复制到浏览器或在命令输出中展示 |

4. 手动设置 Edge secrets 并部署本函数（这些命令不会部署 Sepolia，也不会发送链上交易）：

```sh
npx supabase secrets set --env-file supabase/.env.local
npx supabase functions deploy interactions
```

`config.toml` 已为该函数设置 import map 和自定义 session 鉴权。`verify_jwt=false` 不是允许匿名评论写入：入口必须继续验证 origin、SIWE/会话和服务端权限，不能删除相关检查。其他函数不要随意照搬该设置。原始会话只能发给这个 Edge API，不能拿去当 Supabase Auth JWT 访问数据表。

5. 在自己的前端环境中人工添加下列**公开**设置并重启/重建 Vite；本次未修改现有 `.env`：

```dotenv
VITE_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=YOUR_PUBLIC_PUBLISHABLE_KEY
```

也支持旧式 `VITE_SUPABASE_ANON_KEY`，但只接受 role=anon 的公钥 JWT。绝不配置 `VITE_SUPABASE_SERVICE_ROLE_KEY` 或任何 secret key；构建检查会拒绝这些设置。现有链上版本、地址、部署起始区块设置保持独立，V2 开关不自动迁移数据。

6. 设置维护任务（Supabase Cron Dashboard 或其他受信任调度器）定期执行 `select public.oc_cleanup();`，清理过期挑战/会话/匿名令牌/限流记录；Views 历史累计不会因此清零。清理函数仅服务端可执行。审核日志、举报和隐藏评论的业务保留/删除政策仍需团队制定，当前没有自动删除这些记录。

### 去重、限流和降级行为

- Views：匿名令牌有效 1 天，localStorage 仅保存这个不具备登录权限的访问令牌；不能访问存储时在页面内存复用。每个令牌、每个复合 Campaign、每个固定 30 分钟窗口最多计一次，重复刷新不会在该窗口增加。窗口边界可再计一次；不是自然人数证明。
- 默认数据库原子限流：每 origin 总请求 600/分钟；挑战全局 120/小时及每钱包 5/10 分钟；匿名令牌签发每 origin 200/小时；每匿名令牌 view 请求 120/小时；每项目有效 Views 增量 200/小时；私有请求每钱包 60/分钟，评论 10/分钟及 100/天，举报 10/天。超限返回 429，可在迁移中根据实际流量调整。没有信任 X-Forwarded-For 等客户端可伪造 IP 头。
- 匿名令牌可被清除/轮换，钱包也可新建，因此这些是近似统计和基础防刷，不承诺抵御分布式机器人；全局/项目上限仍限制无限增量。CAPTCHA、网关 WAF/IP 规则及更复杂异常检测尚未实现，高流量生产环境需另行接入。
- 前端只在计数成功加载后启用 Views/Favorites 排序，使用 bigint 比较；失败显示 unavailable，不用虚构计数代替。加载评论或计数无需钱包签名；收藏/发言/举报才需一次钱包登录签名。
- 未配置 Supabase 时，`WalletSignIn`、评论区、Views 显示未配置状态，收藏/举报控件不可用；既有项目、捐款、提现、退款继续通过现有合约。已配置但服务不可达时显示错误/重试，不宣称已连接或已写入。链上页面原有 RPC/钱包读取条件仍保留，没有将整个 Campaign Explorer 改成数据库项目列表。

### 测试、当前验证范围与仍未完成的工作

```sh
# 仓库根目录；不需要 Supabase 凭据或真实链 RPC
npm --prefix supabase ci --ignore-scripts
npm --prefix supabase run check
npm --prefix supabase test
npm --prefix frontend test
npm --prefix frontend run build
```

本地后端测试将**实际迁移**执行到 PGlite PostgreSQL WASM，创建测试角色并运行实际 Edge handler；链 RPC 使用只读 mock，不调用真实网络。覆盖 nonce/消息篡改/有效期/并发重放、会话注销、匿名令牌不能当登录令牌、作者与收藏账户隔离、跨合约 ID 隔离、回复层级、分页、重复举报、当前 owner 变更及 RPC 失败关闭、审核日志、Views 去重限流、全部 RPC/表权限和 RLS 默认拒绝。前端新增 `frontend/tests/offchain.test.js` 覆盖公开密钥限制、签名前消息绑定、复合键和 bigint 统计排序。

最终本地验证：**后端 6 项测试通过，前端 18 项测试通过，后端语法检查与 production build 成功，ABI 与权限检查通过**。前端还通过 `frontend/tests/social-pages.test.js` 覆盖已配置状态下的匿名组件渲染；这仍不代替浏览器交互验证。构建保留了大于 500 KB 的包体积提示，后续可按页面分包。Windows 下 PostgreSQL WASM 初始化会打印路径诊断，但迁移、角色/RLS 和 API 断言全部通过。

当前无真实 Supabase 凭据，不能宣称 hosted PostgreSQL/PostgREST、Supabase gateway/CORS 或浏览器 MetaMask 全流程已验证；本机无 Supabase CLI、Docker 和 Deno，运行的是 Node 语法检查与 PostgreSQL WASM 测试，不冒充 `deno check` 或托管部署验证。部署后必须按 [supabase/VERIFY.md](VERIFY.md) 的步骤用两个钱包及不同浏览器复测。EOA MetaMask 签名已实现；ERC-1271 智能合约钱包、自动 session refresh、跨标签共享登录、验证码、实时评论订阅、图片上传和深层回复均未实现。网页刷新需重新登录，签名不产生 Gas。

### Supabase UI TODO：已实现代码与组员具体工作

| 位置 / 真实文件 | 已实现的功能型交互 | UI 组员还要写什么 / 验收条件 |
| --- | --- | --- |
| 登录：`frontend/src/components/offchain/WalletSignIn.jsx`、`hooks/useWalletSession.jsx`；`App.jsx` 全局 Provider | 显式无 Gas 登录、签名拒绝提示、会话到期、切钱包/链清空、登出及离线撤销重试；服务端而非客户端建立身份 | 设计登录说明弹窗、已认证徽章、会话倒计时、离线撤销提醒样式；不得把 Connect Wallet 当成已认证。验收：切到 B 后 A 的收藏/写入状态立即消失，登录失败不能显示已认证 |
| 评论：`frontend/src/components/offchain/CommentSection.jsx`；`pages/CampaignDetail.jsx` | 匿名列表、作者短地址/时间、纯文本提交、单层回复、本人隐藏、管理员隐藏、每页 20、上一页/下一页、刷新和错误提示 | 美化输入器/评论卡、字符计数、提交骨架屏、回复展开布局、隐藏确认及分页焦点；隐藏正文显示 tombstone，不能执行远程 HTML。举报使用现有 ReportDialog，不另写匿名数据库插入 |
| 收藏：`frontend/src/components/offchain/FavoriteButton.jsx`、`SavedCampaigns.jsx`；`pages/Profile.jsx` | 读取服务端收藏状态、幂等保存/取消、个人分页列表、跨设备恢复、显示复合部署；不同合约不跳到当前同 ID 项目 | 设计收藏图标/选中/加载状态，Profile 的 Saved Tab、跨版本提示卡和取消收藏反馈；不同部署的记录不可生成当前 `#/campaign/id` 链接，除非 sameDeployment 已确认 |
| 举报：`frontend/src/components/offchain/ReportDialog.jsx`；详情和评论卡 | 展开/关闭表单、10–1000 字符原因、重复提交锁、已有举报冲突反馈；服务端唯一约束阻止同对象重复举报 | 当前是内联 region 表单，尚非完整模态框；若改成弹窗，要实现焦点陷阱、Escape、返回焦点、原因选择+补充文本和成功提示。不能在提交举报后自动暂停项目 |
| 浏览量：`frontend/src/components/offchain/Views.jsx`、`services/interactions.js`；详情页 | 无签名匿名登记、固定窗口去重、近似统计标识、不可用状态；不写链 | 设计 Views 小图标、近似统计说明 tooltip、加载/失败重试样式；刷新同一窗口不得无限增长，不能把它显示为链上可信数据或独立人数 |
| Explorer：`pages/Home.jsx`、`components/CampaignFilters.jsx`、`CampaignCard.jsx`、`utils/campaigns.js` | 复合键批量读取 Supabase 计数；仅数据完整时启用 Views/Favorites 排序，卡片显示近似浏览量/收藏数，原链上筛选排序保留 | 整合链上/链下指标的视觉区分、计数刷新按钮/状态、移动端排序菜单；统计错误不可影响真实筹款金额或制造假计数 |
| Profile：`pages/Profile.jsx` + `SavedCampaigns.jsx` | 保留创建项目、贡献、退款和事件历史，增加钱包认证与云端收藏；没有迁移资金 | 设计统一 Created / Contributions / Refundable / Saved 导航、空状态和分页；收藏失败不能禁用链上退款，切钱包必须清空私人结果 |
| 后台：`frontend/src/components/offchain/AdminReports.jsx`、`pages/AdminDashboard.jsx` | 显式钱包认证后请求服务器举报列表、状态筛选/分页、处理中/已处理/驳回、可选隐藏评论；服务端二次 owner 验证；单独按钮+确认后才调用现有 `setCampaignPaused(id,true)` | 设计举报详情抽屉、原因/正文审阅布局、处理备注表单（备注存储尚未实现）、状态标签和焦点提示；当前暂停使用浏览器 confirm，需升级为明确标识 Gas/合约地址的确认弹窗。只允许匹配当前真实 V2 复合标识的链上暂停，V1/其他部署只显示不可用说明 |
| 公共：`services/supabase.js`、`hooks/useInteractionQuery.js`、`useOffchainAction.js`、`styles.css` | 超时、错误反馈、AbortSignal 与旧响应隔离、重复操作锁、基本响应式样式及未配置降级；无 service-role 浏览器直连 | 补充统一 toast、重试 UI、长列表加载、键盘/读屏及移动端回归。无凭据环境只能验收禁用/降级状态，不能标记真实云端联调已完成 |

所有新增链下组件均已有功能型代码，表中的最终视觉设计、真实 MetaMask/Supabase 联调和额外功能仍属待办；没有把这些待办标为完成。
