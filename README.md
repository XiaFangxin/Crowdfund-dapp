# Crowdfund DApp V2

React + Vite + ethers.js v6 / Solidity + Hardhat 3 / Sepolia + MetaMask / 可选 Supabase 链下互动。

**2026-10-22 集成验收：V2 尚未部署，Supabase 尚未连接真实项目。本地功能代码和测试已完成，最终视觉设计与真实浏览器端到端联调仍待完成。** 本项目为课程功能演示，未经过独立安全审计。

## V2 Architecture

```text
React -> crowdfunding service -> MetaMask -> Sepolia 合约
React -> metadata service -> HTTPS / IPFS JSON 和图片
React -> interactions Edge Function -> PostgreSQL
                    -> SIWE 钱包会话 / 只读链上 Campaign 与 owner 校验
```

| 层与实际路径 | 权威数据与职责 |
| --- | --- |
| `smart-contract/contracts/Crowdfunding.sol` | Campaign 身份、创建者、目标、截止时间、筹款、提现、退款、分类 registry、管理员与暂停；数据库不能修改这些规则 |
| `frontend/src/contracts/Crowdfunding.json` / `CrowdfundingV2.json` | 分别为 V1 / V2 ABI；`config/contracts.js` 选择匹配版本和地址，V2 无地址时禁止链上操作 |
| `frontend/src/services/crowdfunding.js`、`events.js`、`transactions.js` | ethers v6 合约读写、分段日志查询、交易确认；金额使用 bigint；查询失败不伪造完整历史 |
| HTTPS / IPFS；`frontend/src/services/metadata.js` | 图片、摘要、详细介绍和更新正文；仅 URI 上链，不执行远程 HTML；分类以链上 categoryId 为准 |
| `supabase/functions/`、`supabase/migrations/` | 评论、近似 Views、收藏、举报、会话与审核日志；不托管资金，不创建交易 signer |
| `frontend/src/hooks/`、`components/offchain/` | 钱包生命周期、会话、取消旧请求、分页与交互；App 使用 Hash 路由和全局会话 Provider |

链下项目身份始终为 **chainId + lowercase contractAddress + decimal-string campaignId**。同一 ID 在 V1/V2 或重新部署后互不共享记录。服务端允许列表验证 Campaign 首次注册；管理员审核每次重新读取配置的 V2 owner。匿名浏览不要求 MetaMask 签名；评论、收藏、举报要求服务端验证的钱包会话。连接钱包不等于已登录链下模块。

## Features

| 功能 | 已实现 | 本地验证 | Sepolia / 托管验证与剩余工作 |
| --- | --- | --- | --- |
| 创建、捐款、提现、退款 | 合约、服务、页面与交易阶段提示 | Hardhat 成功/失败/截止/重复操作/重入/资金隔离 | 团队曾报告 V1 部署、创建 Campaign 0（test1）和详情读取；本次未独立复查实时链状态，资金全流程未确认 |
| V2 管理员、分类、暂停、metadataURI、更新事件 | 合约及前端功能入口；管理员不可挪用资金 | Hardhat 权限与回归；ABI 和 mock provider 服务读取 | **V2 未部署，全部 V2 链上行为未做 Sepolia E2E** |
| Explorer | 搜索、分类/状态筛选、创建/截止/金额/进度排序；可选日志统计捐款次数与人数 | bigint 精度、筛选、RPC 日志缩小范围与缺失数据拒绝 | 需要正确起始区块；大历史性能、浏览器交互待验 |
| Profile | Created、当前贡献、可退款、事件交易历史、Saved | 页面静态渲染、事件服务和业务规则 | MetaMask 切换/过期/拒绝签名需浏览器回归；最终 Tabs/分页体验待完善 |
| 评论、回复、收藏、举报、Views | Edge + SQL + React；评论单层回复/每页20；私有收藏与审核 | 实际迁移、会话重放/过期/注销、账户隔离、owner 校验、RLS 和去重限流 | **没有真实 Supabase 凭据，未部署/连接，不能称为云端联调通过** |
| 元数据与展示 | URI 预览、校验、封面降级、纯文本、倒计时、进度条 | 协议、大小、JSON、文本安全和边界测试 | 图片上传、内容编辑器、最终视觉设计未实现 |
| 高级功能 | 暂无 Milestone Voting、DAO、NFT 或代理升级 | 不适用 | 见 Future Roadmap，不属于已完成功能 |

## Installation / Quick Start

使用 **Node.js 24.x / npm 11.x**。仓库有三个独立 npm 项目，根目录没有 package.json / workspace。从仓库根目录执行；PowerShell 执行策略限制时使用 `npm.cmd` / `npx.cmd`。

```sh
npm --prefix smart-contract ci
npm --prefix frontend ci
npm --prefix supabase ci --ignore-scripts

npm --prefix smart-contract run compile
npm --prefix smart-contract test
npm --prefix smart-contract run export:abi
npm --prefix smart-contract run check:abi
npm --prefix frontend test
npm --prefix frontend run build
npm --prefix supabase run check
npm --prefix supabase test
```

本地 Hardhat 测试不需要私钥或 Sepolia RPC，首次编译可能下载编译器。`No contracts to compile` 表示缓存已更新。后端测试使用 PGlite PostgreSQL WASM 执行实际迁移和角色权限检查，链 RPC 使用 mock，不要求 Docker 或云端凭据。

首次运行可复制 `frontend/.env.example` 为自己的 `frontend/.env`（不要覆盖已有配置），填写公开配置，随后：

```sh
npm --prefix frontend run dev
# 或构建后本地预览
npm --prefix frontend run preview
```

V1 演示配置：

```dotenv
VITE_CROWDFUNDING_VERSION=v1
VITE_CROWDFUNDING_ADDRESS=0xbdF615493ce21B7Ae54E6464D44c507C76b85B6C
# 经负责人查证后填写真实部署区块；留空时事件历史不可用
VITE_CROWDFUNDING_DEPLOY_BLOCK=
```

V2 配置模板（空地址会正常阻止操作，**不能使用 V1 地址填空**）：

```dotenv
VITE_CROWDFUNDING_VERSION=v2
VITE_CROWDFUNDING_V2_ADDRESS=
VITE_CROWDFUNDING_V2_DEPLOY_BLOCK=
```

修改配置后重启 Vite / 重新构建。默认版本为 v1；显式空地址不会自动回退。合约读取需要 MetaMask provider 和 Sepolia（chainId `11155111`），不要求先授权账户；私有 Profile 和写入需要连接账户。无 MetaMask、错误网络或无效配置显示提示并禁止链上调用。页面本身和已配置的公开评论/Views 不要求签名。使用 MetaMask 的 Switch to Sepolia，未知网络时先启用其测试网络。

### Supabase Setup & Off-chain Architecture

完整配置、安全边界、action 参数、限流和部署步骤见 [supabase/README.md](supabase/README.md)；人工回归见 [supabase/VERIFY.md](supabase/VERIFY.md)。后端源码不依赖邮箱密码或外部钱包登录供应商。

负责人需手动完成：

1. 创建 Supabase 测试项目，安装 CLI，审阅迁移后执行 `supabase link`、`supabase db push`；用 `supabase/tests/verify_permissions.sql` 检查全部 oc_* 对象的 RLS / grants。
2. 复制 `supabase/secrets.example.txt` 到被忽略的 `supabase/.env.local`；配置精确 `APP_ORIGINS`、私有只读 `CHAIN_RPC_URL` 和真实合约允许列表 `CAMPAIGN_CONTRACTS`。V2 未部署时 `MODERATION_CONTRACT_ADDRESS` 留空，审核关闭。
3. 手动设置 secrets 并部署 `interactions` Edge Function；`verify_jwt=false` 仅适用于这个自带会话鉴权的函数，不能删去服务端认证。托管运行时注入 `SUPABASE_SERVICE_ROLE_KEY`，只允许服务端持有。
4. 在前端自己的配置中添加公开 `VITE_SUPABASE_URL` 和 `VITE_SUPABASE_PUBLISHABLE_KEY`（或旧式 anon key），重启前端。**service-role、secret key、私钥和认证 RPC URL 不得进入 VITE_*。** 构建配置会拒绝 Supabase 服务端密钥设置。
5. 定期以受信任调度器执行 `public.oc_cleanup()`，制定审核记录/隐藏评论保留政策。用两个钱包完成下述人工验收。

SIWE 风格消息绑定 origin、URI、链、地址、服务端 nonce 和5分钟有效期；服务端恢复签名并原子消费 nonce，签发最长1小时的随机不透明会话。数据库只保存令牌哈希，每次私有操作重新派生会话钱包；浏览器不直接访问表或 RPC。原始令牌仅在内存，刷新需重新签名，切钱包/网络、到期和登出清理身份。离线撤销显示待重试，不保证离线时服务器立即撤销。

全部10张表启用 RLS，anon/authenticated 无表和模块 RPC 权限；Edge 的服务端角色调用验证身份与所有权的 SQL。举报审核额外读取当前 V2 owner，客户端 isAdmin 无效。匿名 Views 使用不具登录权限的访问令牌、固定30分钟去重窗口和原子限流，属于近似统计，不代表独立人数或机器人证明。

未配置 Supabase 时显示未配置/不可用并禁用相关写入，已有链上资金功能不受影响。接口失败显示错误，不伪造评论、统计或成功反馈。匿名访问同一窗口刷新不会无限增加 Views；收藏可由同一钱包在另一设备重新登录后恢复。

## Contract Interfaces

源码使用 Solidity `0.8.28`，Hardhat 3 ESM/TypeScript，无代理。以下为 V2；实际 ABI 是接口依据：

| 函数 | 参数与权限 / 规则 |
| --- | --- |
| `createCampaign(title, description, goal, deadline, categoryId)` | 唯一创建入口，五参数；有效且启用的分类，正数 wei 目标、未来 Unix 秒；创建即开放捐款。V1 为四参数，V2 不保留绕过分类入口 |
| `getCampaign(id)` / `campaignCount()` / `contributions(id,wallet)` | 原七字段 Campaign getter 保持；历史 amountRaised 不随提现/退款减少，不可当合约余额 |
| `contribute(id)` / `withdraw(id)` / `refund(id)` | 捐款 payable；截止前捐款，截止后成功由创建者提现一次，失败由参与者各自退款一次；暂停只影响新捐款 |
| `owner()` / `pendingOwner()` / `transferOwnership(newOwner)` / `acceptOwnership()` | 部署者默认 owner；旧 owner 提名、新 owner 接受。前端已有读取，**尚无权限转移表单/service 写入封装** |
| `campaignPaused(id)` / `setCampaignPaused(id,paused)` | 仅当前 owner 可暂停/恢复，管理员不可直接移动资金 |
| `categoryCount()` / `getCategory(id)` / `getCampaignCategoryId(id)` | 分类稳定 ID；初始0–5为 Education、Charity、Technology、Creative、Environment、Community |
| `addCategory(name)` / `renameCategory(id,name)` / `setCategoryActive(id,active)` | 仅 owner；名称1–64可打印ASCII、无首尾空格；不物理删除；停用不影响历史项目资金流程；名称不保证唯一，ID 唯一 |
| `getCampaignMetadataURI(id)` / `setCampaignMetadataURI(id,uri)` | 只有创建者可更新展示 URI，不能改目标、截止、资金或分类 |
| `publishCampaignUpdate(id,uri)` | 仅创建者，URI 写事件；不存全部公告正文 |

V2 事件：`OwnershipTransferStarted`、`OwnershipTransferred`、`CampaignPauseChanged`、`CampaignMetadataUpdated`、`CampaignUpdatePublished`、`CampaignCategoryAssigned`、`CategoryAdded`、`CategoryRenamed`、`CategoryStatusChanged`。原 `CampaignCreated`、`Contributed`、`Withdrawn`、`Refunded` 保留；事件准确参数见 ABI。服务层 `getWalletActivity` / `getCampaignUpdates` / `getDonationStatistics` 分段读取日志；部署起始区块未知或 RPC 失败时历史不可用，不能显示为零条已验证历史。

Metadata / Updates 只接受非空 HTTPS 或 IPFS URI，最长2048可打印ASCII字节。前端还校验 JSON、大小、图片与公开 URL；内容作为文本渲染。规范分别见 [campaign-metadata.schema.json](smart-contract/schemas/campaign-metadata.schema.json) 和 [campaign-update.schema.json](smart-contract/schemas/campaign-update.schema.json)。例如：

```json
{"schemaVersion":"1.0","image":"ipfs://IMAGE_CID","summary":"项目摘要","additionalDescription":"详细介绍"}
```

```json
{"schemaVersion":"1.0","title":"第一周进展","body":"完成内容与资金使用说明","images":["ipfs://IMAGE_CID"],"publishedAt":"2026-10-22T08:00:00Z"}
```

推荐固定 IPFS CID 或按版本发布的 HTTPS 路径。内容变化创建新 URI，保留历史文件；更新文档可使用 schema 的 previousUpdateURI 连接版本。HTTPS 文件可变，链上 URI 本身不保证内容永久不变。没有上传服务；创建/更新页面需使用已托管的 JSON，不把本地文件路径当 URI。

## Deployment

| 版本 | 地址 / ABI / 状态 |
| --- | --- |
| V1 | `0xbdF615493ce21B7Ae54E6464D44c507C76b85B6C`；`frontend/src/contracts/Crowdfunding.json`；历史记录 [sepolia.json](smart-contract/deployments/sepolia.json) 保留 |
| V2 | **未部署，无新地址**；`frontend/src/contracts/CrowdfundingV2.json` 与当前源码生成结果一致 |

本次不修改 V1 部署记录或实际 `.env`，不部署或发送 Sepolia 交易。V1 部署交易、区块、源码 commit 和 Ignition ID 仍需负责人查证，不能编造。V2 配置拒绝已知 V1 地址；服务还验证网络、字节码和 V2 能力。配置检查不能代替部署源码核验。

`npm --prefix smart-contract run export:abi` 只覆盖独立 V2 ABI，不覆盖 V1；`check:abi` 比较编译产物与前端导出，验证只有五参数创建入口、保留的 V1 函数/事件以及服务端链读取签名。前端服务另外通过 mock EIP-1193 + 实际 V2 ABI 测试。

Ignition 模块 `smart-contract/ignition/modules/Crowdfunding.ts` 名为 `CrowdfundingV2Module`，无构造参数，`m.getAccount(0)` 成为初始 owner。未来经小组明确批准后，部署负责人才能在 smart-contract 目录手动执行：

```sh
npx hardhat ignition deploy ignition/modules/Crowdfunding.ts --network sepolia --deployment-id crowdfund-sepolia-v2
```

部署前人工确认：当前源码/ABI/测试、部署账户0与两步管理员交接、测试ETH、目标网络、全新 deployment ID。部署后的新地址、交易哈希、区块、commit 和 Ignition ID 单独记录为 V2，不覆盖 V1；核验初始分类与 owner，再手动更新前端及服务端允许列表/审核地址。

普通已部署合约不能原地修改。V2 从新的 Campaign 0 开始；V1 项目、余额、历史、退款与提现责任不会自动迁移。不要复用旧 Ignition 日志强制替换，也不要将 V2 ABI 配到 V1 地址。数据库复合键确保两版本互动数据隔离；跨版本收藏仅标记部署信息，不误跳到当前同 ID 项目。

## Integration Verification

2026-10-22 本次验证：Hardhat compile、21项 Hardhat 测试、ABI export / check；前端18项测试与 production build；链下6项测试与 Node 语法检查。具体测试文件：

- 合约：`smart-contract/test/Crowdfunding.ts`、`CrowdfundingV2.ts`、`Categories.ts`。
- 前端：`frontend/tests/integration.test.js`、`services.test.js`、`pages.test.js`、`offchain.test.js`、`offchain-client.test.js`、`social-pages.test.js`。
- 链下：`supabase/tests/chain.test.js`、`interactions.test.js`、`permissions.test.js`；权限复查 SQL 为 `supabase/tests/verify_permissions.sql`。

| 场景 | 现有保护与验证边界 |
| --- | --- |
| 新钱包 / 空数据 | Profile 当前账户筛选、零贡献/空收藏；SSR 与规则测试覆盖初始提示，真实钱包 UI 待验 |
| 钱包切换 / 旧请求 | useWallet 立即清身份、useResource 取消并隔离响应、App 按身份重挂页面、会话 generation 防旧登录；服务端注销测试通过，浏览器并发切换待验 |
| 错误网络 / 无 MetaMask | 页面提示、service 拒绝不匹配网络；SSR 与 mock 测试，不等于扩展真实交互验证 |
| 无 Supabase / API 异常 | 模块降级、超时/错误；异常200响应不再误报成功；复合身份不符的 metrics 被拒绝；测试覆盖 |
| RPC 错误 / 日志范围 | 自动缩小日志范围、失败不返回部分成功；权限 RPC 失败关闭；测试覆盖 |
| 越权管理员 / 链下身份伪造 | 合约 onlyOwner、服务端 fresh owner、会话派生作者、SQL 隔离与 RLS；测试覆盖，不能仅靠按钮隐藏 |
| 交易拒绝 / 替换 / 回退 | 签名、提交、确认、成功/失败及哈希链接；本地生命周期与广播后RPC中断测试；确认不可用时保留哈希、提示先查询，不误报链上失败；持久化恢复仍待验收 |

构建有约567KB主 JS 的体积提示，尚未按页面分包。Windows PGlite 初始化打印路径诊断，但 SQL/权限断言通过。本机未执行 Deno 类型检查或 Supabase CLI/Docker 测试；Node 语法检查不等于 Edge 托管运行验证。

**必须人工完成的验收**：配置真实 Supabase 后，两个钱包/两个浏览器验证签名拒绝、切换、过期、离线注销重试、评论本人隐藏/越权拒绝、收藏跨设备、重复举报、匿名 Views 去重和审核 owner 变更。V2 经批准部署后，再验证分类、暂停/恢复、元数据/更新、成功提现与失败退款及全部交易反馈，记录交易哈希。当前没有 V2 Sepolia 或 hosted Supabase E2E 通过的声明。

## Team Responsibilities

| 负责人角色 | 真实文件范围 | 下一轮交付 |
| --- | --- | --- |
| 合约 / 部署 | `smart-contract/contracts/`、`test/`、`ignition/modules/`、`scripts/`、`deployments/` | 查证 V1 起始区块；评审 V2、人工部署与管理员核验、单独发布 V2 记录；每次变更先检查 ABI |
| Web3 / 状态 | `frontend/src/services/crowdfunding.js`、`events.js`、`transactions.js`、`hooks/useWallet.js`、`useResource.js`、`useTransaction.js` | 两钱包浏览器回归、广播后断网恢复策略、长日志性能与轮询刷新体验 |
| 链下后端 | `supabase/migrations/`、`functions/`、`tests/`、`config.toml` | 配置测试项目、检查云端权限、Edge/CORS、cleanup 调度、审核保留政策与限流 |
| React / UI | `frontend/src/pages/`、`components/`、`styles.css`、`App.jsx` | 按下表完成最终视觉、响应式、无障碍、确认弹窗，不重复实现已有业务 |
| 集成 QA / 文档 | `frontend/tests/`、`supabase/VERIFY.md`、本 README | 按矩阵记录通过/失败、浏览器与网络条件、部署标识和证据，不将本地测试写成 Sepolia 通过 |

## V2 Frontend UI TODO

下表文件**均已存在**，不是需要重建的 NEW 文件。已有功能型表单、列表与基础样式；待办是最终 UI 与明确列出的未完业务。P0=联调/错误恢复，P1=演示前体验，P2=后续增强。所有链上 V2 专属操作依赖真实 V2 部署；链下功能依赖 Supabase 配置，普通互动可先对允许的 V1 开启。

| 优先级 / 页面与真实文件 | 已连接的 API / Hook | 具体修改点与验收条件 | 部署依赖 |
| --- | --- | --- | --- |
| P1 Home：`frontend/src/pages/Home.jsx`；`components/CampaignFilters.jsx`、`CampaignCard.jsx`、`CampaignList.jsx` | useCampaigns/useCategories；listCampaigns/listCategories/getDonationStatistics；loadMetrics | 完成筛选栏与移动端折叠菜单、卡片封面比例/状态/进度层级、骨架屏和空态；筛选可组合且可清除，长标题不溢出；统计失败显示不可用并回退排序，不显示假0 | 基本列表V1可用；分类需V2；Views/Favorites需Supabase |
| P1 Profile：`frontend/src/pages/Profile.jsx`、`MyCampaigns.jsx`、`MyContributions.jsx` | getWalletContributions/getWalletActivity/refund；useResource/useTransaction；SavedCampaigns | 完成 Created/Contributions/Refundable/Saved 的 Tabs、地址复制、交易历史卡与长列表分页；新钱包显示真实空态；切钱包不残留A记录；收藏失败不禁用退款，交易链接指向实际哈希 | 资金V1可用；Saved需Supabase；历史需真实起始区块 |
| P1 Detail：`frontend/src/pages/CampaignDetail.jsx`、`components/CampaignMetadata.jsx` | getCampaign/getContribution/getCampaignUpdates；contribute/withdraw/refund；setCampaignMetadataURI/publishCampaignUpdate | 设计封面/分类/进度/倒计时、详情与更新时间线、创建者编辑表单、资金操作卡和确认说明；暂停不禁用合法退款/提现；到期自动刷新资格；无效图片/JSON可重试；远程正文只显示文本 | 元数据、分类、更新、暂停需V2；基础资金V1可用 |
| P1 Create：`frontend/src/pages/CreateCampaign.jsx` | listCategories/createCampaign；fetchDocument；useTransaction | 完成分区表单、启用分类下拉、预览卡、错误定位、创建成功后详情入口与可选 metadata 二次交易提示；明确没有图片上传服务；categoryId=0有效，停用分类不可选；确认后不可重复创建 | 五参数分类创建需V2；V1保留四参数路径 |
| P0 Admin：`frontend/src/pages/AdminDashboard.jsx`；`hooks/useContractOwner.js` | getOwnership；setCampaignPaused/addCategory/renameCategory/setCategoryActive；owner/pendingOwner | 设计后台统计、项目列表、分类编辑/停用确认与权限加载态；改善定时刷新导致表单/权限区短暂重载；普通钱包不能看到管理表单，RPC失败不得显示已授权；停用不影响历史项目资金 | 必须V2；权限转移表单尚未实现，需单独补service和交互 |
| P1 登录：`frontend/src/components/offchain/WalletSignIn.jsx`、`hooks/useWalletSession.jsx` | auth.challenge/verify/session/logout | 增加无Gas签名说明、认证徽章、会话到期和离线撤销样式；取消签名不显示成功；Connect不等于认证；换钱包立即清理 | Supabase，EOA MetaMask |
| P1 评论：`frontend/src/components/offchain/CommentSection.jsx` | comments/comment.create/comment.hide/comment.moderate；useInteractionQuery/useOffchainAction | 完成输入器计数、回复缩进、分页焦点、隐藏确认、加载占位；刷新后合理保留回复展开位置；空/隐藏正文显示占位；每页20且最多一层回复，非本人隐藏被拒绝 | Supabase；管理员隐藏需服务端V2 owner |
| P1 收藏：`frontend/src/components/offchain/FavoriteButton.jsx`、`SavedCampaigns.jsx`；Profile | favorite.state/favorite.set/saved.list | 完成图标选中/处理中状态、取消反馈、Saved分页与跨部署提示卡；同钱包跨设备恢复；其他部署记录不能跳到当前同ID | Supabase |
| P1 举报：`frontend/src/components/offchain/ReportDialog.jsx` | report.create；useOffchainAction | 当前为内联region；若改弹窗需焦点陷阱、Escape和焦点返回，补原因选项/字符数/成功反馈；重复举报提示可理解，提交不触发链上暂停 | Supabase |
| P1 Views：`frontend/src/components/offchain/Views.jsx`、`services/interactions.js` | visitor/view/metrics | 设计近似统计tooltip、加载/不可用和重试样式；同30分钟窗口刷新不累加；无钱包也不弹签名；与金额/独立捐款人数视觉区分 | Supabase |
| P0 举报后台：`frontend/src/components/offchain/AdminReports.jsx`、AdminDashboard | reports.list/report.moderate/comment.moderate；单独setCampaignPaused | 完成详情抽屉、状态/原因布局、隐藏确认和处理反馈；将现有浏览器confirm改为明确显示Gas/地址的暂停确认；只有匹配当前V2项目才提供链上暂停；不得自动发交易。处理备注存储尚未实现，不能只画已保存状态 | Supabase + V2审核地址；链上暂停另需MetaMask明确签名 |
| P0/P1 公共钱包/交易：`frontend/src/components/ConnectWallet.jsx`、`ContractStatus.jsx`、`TransactionStatus.jsx`、`Navbar.jsx`；`hooks/useTransaction.js`、`styles.css` | useWallet；waitForTransaction；useResource | 完成移动导航、长地址换行、按钮禁用、统一toast与读屏提示；签名/提交/确认/成功/失败可区分；广播后RPC中断保留哈希并提示查收据后再操作；真实网络下确认是否需要持久化待确认交易，防止跨刷新重试 | 浏览器回归；资金交易需真实合约和测试ETH |
| P2 公共性能 / 可访问性：`frontend/src/App.jsx`、`styles.css`、全部页面与组件 | 现有Hooks/服务不改职责 | 页面分包、键盘导航、对比度、320px/平板/桌面布局、长正文/地址/列表测试；保持异常态和权限提示可见，不靠隐藏按钮保护后端 | 不依赖部署；最终交互仍需浏览器验收 |

## Future Roadmap

- **Milestone Voting：未实现。** 需要单独设计里程碑、投票资格、资金释放、超时与退款规则，并重新评审/测试/部署；不能只补一个前端投票按钮。
- 大规模项目分页、事件索引和缓存，减少全量链读取；保持链上资金为权威，索引异常可核对。
- 图片/JSON上传、内容版本编辑器、HTTPS/IPFS可用性检查；当前只支持已有URI。
- 待确认交易恢复、按页分包、完整浏览器自动化；目前单元/服务/SSR测试不代替真实MetaMask。
- ERC-1271钱包、跨标签会话、验证码/WAF、实时评论、更深回复、审核备注与保留政策；当前都未实现。

## Backend → Frontend Coverage & Completion Checklist

核对日期：2026-10-22。**前端尚未完全跟进全部后端能力，也未完成真实部署联调。** 核心众筹、分类/暂停、元数据/更新、评论/收藏/举报/浏览量已有功能型入口；下表区分缺少接入、已有入口和待验证。它补充上面的逐页面 UI TODO，不将视觉待办等同于后端功能缺失。

### 接口覆盖清单

| 后端能力 / 接口 | 实际前端入口 | 当前状态与剩余事项 |
| --- | --- | --- |
| createCampaign / contribute / withdraw / refund；getCampaign / contributions | `frontend/src/services/crowdfunding.js`；`pages/CreateCampaign.jsx`、`CampaignDetail.jsx`、`Profile.jsx` | 已接入；V1四参数/V2五参数分开，资金不能转移到数据库。待确认交易恢复、部署后资金E2E见下表 |
| 分类读取、addCategory / renameCategory / setCategoryActive | 同一service；`hooks/useCategories.js`；Home/Create/AdminDashboard | 已接入；停用只影响新建。最终分类管理UI、轮询稳定性和真实V2回归待完成 |
| owner / pendingOwner / transferOwnership / acceptOwnership | `getOwnership`、`hooks/useContractOwner.js`、AdminDashboard | **只接入读取；两个写接口尚无service封装或表单**，属于明确功能缺口 |
| campaignPaused / setCampaignPaused | service、CampaignDetail、AdminDashboard、`components/offchain/AdminReports.jsx` | 已接入；举报处理与链上暂停分开，不能自动发交易；确认弹窗和真实权限回归待完成 |
| metadataURI getter/setter / publishCampaignUpdate / CampaignUpdatePublished | service、CampaignDetail、CreateCampaign、`components/CampaignMetadata.jsx` | 已接入；创建和附加metadata是两笔独立交易，已有创建成功详情链接。URI加载重试、更新历史布局和上传说明需完善；上传后端不存在 |
| CampaignCreated / Contributed / Withdrawn / Refunded | `services/events.js`；getWalletActivity / getDonationStatistics；Profile/MyContributions/Home | 已接入历史查询；真实起始区块待查证，长历史分页和查询性能待完善。getContributionHistory是同一历史服务的子集，不必重复做页面 |
| auth.challenge / auth.verify / auth.logout | `hooks/useWalletSession.jsx`；`components/offchain/WalletSignIn.jsx` | 已接入签名登录和Logout；监听MetaMask切换，清理旧身份。真实扩展/过期/离线撤销联调待完成 |
| auth.session | 服务端存在；前端当前未主动调用此action | 会话靠本地到期时间及每次私有请求的服务端校验；**不是缺少身份鉴权**。可补页面重新聚焦时的会话检查以更早发现撤销，不允许据此自动伪造/续期会话 |
| visitor / view / metrics | `services/interactions.js`、`components/offchain/Views.jsx`、Home | 已接入无签名计数和Views/Favorites排序；失败重试入口与近似统计说明待完善，云端去重/限流待验 |
| comments / comment.create / comment.hide / comment.moderate | `components/offchain/CommentSection.jsx`；CampaignDetail | 已接入匿名列表、单层回复、本人隐藏及管理员隐藏；有分页，不需要重写评论后端。回复展开保持、隐藏确认与真实权限联调待完善 |
| favorite.state / favorite.set / saved.list | `FavoriteButton.jsx`、`SavedCampaigns.jsx`；CampaignDetail/Profile | 已接入收藏、取消、个人分页和跨部署显示；跨设备恢复待真实Supabase验证，Saved Tab和卡片仍需设计 |
| report.create / reports.list / report.moderate | `ReportDialog.jsx`、`AdminReports.jsx`；详情/评论/后台 | 已接入举报、筛选分页、状态处理及可选隐藏评论；审核弹窗和联调待完成。后端允许V2审核管理员处理允许列表中的V1/V2举报；当前前端后台仍要求选择V2配置，不能在V1页面直接进入 |
| 审核日志、oc_cleanup、RLS、限流、会话哈希、nonce消费 | `supabase/migrations/`、`functions/` 的服务端内部能力 | 不应直接暴露数据库到浏览器。审核日志没有公开查询action/页面，cleanup需服务端调度；如要做审计页，先新增有权限的后端接口 |

### 需要完成的功能与集成工作

除本表外，上方 **V2 Frontend UI TODO** 的逐页面视觉、响应式和无障碍工作仍须完成。以下状态均为未完成/待验收，不应在演示材料里标为完成。

| 编号 / 优先级 / 类型 | 实际文件与API | 具体需要写或配置的内容 | 验收条件与依赖 |
| --- | --- | --- | --- |
| F01 / P0 / 缺少接入 | `frontend/src/services/crowdfunding.js`、`pages/AdminDashboard.jsx`、`hooks/useContractOwner.js`；transferOwnership/acceptOwnership | 增加两个V2写入封装、合法非零地址校验、当前owner提名表单、pendingOwner接受按钮、确认说明及交易反馈。接受入口不能只放在isOwner分支内，否则候选人无法使用 | 旧owner只能提名；只有候选钱包可接受；接受前不能管理，接受后旧owner立即失权；每步刷新owner/pendingOwner。需V2；建议新增 `frontend/tests/ownership-ui.test.js`（NEW）验证入口权限与调用 |
| F02 / P0 / 交易恢复缺口 | `services/transactions.js`、`crowdfunding.js`、`hooks/useTransaction.js`、`components/TransactionStatus.jsx`、CreateCampaign | 确认未知状态已有提示/哈希，但没有跨刷新待确认交易恢复。补按chain+contract+wallet隔离的公开哈希记录、主动查收据/继续等待入口和重试保护；创建已确认但事件ID解析失败时提供按原收据恢复ID入口，不重新发创建交易 | RPC中断/刷新/路由切换后不误认为未提交；不自动重发；确认失败才能重试，成功从同地址CampaignCreated恢复ID；替换/取消识别正确。新增对应前端回归测试；真实广播场景需Sepolia人工验收 |
| F03 / P0 / 状态体验 | `hooks/useResource.js`、`useContractOwner.js`、`useCategories.js`、AdminDashboard/CreateCampaign | 当前轮询会清空加载数据，可能使管理员区域重挂、分类短暂消失。区分初始加载与后台刷新，保留编辑草稿和已选分类；权限错误/变化时必须立即禁用管理写入，不能为保留UI而继续宣称授权 | 15/30秒刷新不丢草稿；账户/网络/部署变化仍立即清私人数据；分类停用后重验提交；owner变更与RPC失败均不可继续管理。补可控延迟/切换测试 |
| F04 / P0 / 人工部署配置 | `frontend/src/config/contracts.js`、实际私有配置；`smart-contract/deployments/`；`supabase/secrets.example.txt` | 负责人查证V1部署起始区块；获准后独立部署V2并记录新地址/区块/commit；配置前端V2和后端allowlist/moderation地址。不编造地址，不覆盖V1记录 | ABI/地址/链匹配、初始owner与6分类正确；未部署时继续阻止V2操作。需人工批准部署；本轮文档工作不执行部署或改.env |
| F05 / P0 / 云端模块联调 | `supabase/config.toml`、迁移/functions、`supabase/VERIFY.md`；前端supabase service | 实际创建测试项目、迁移、Edge部署、精确origin与只读RPC配置、公开key配置；验证RLS/grants、CORS、超时与所有action；安排cleanup | 两钱包不能互改评论/收藏，不能伪造管理员；匿名只读和受限Views正常；同钱包跨设备恢复收藏；V2未配置时审核拒绝。没有云端凭据时只能记录待配置，不能写通过 |
| F06 / P0 / 浏览器集成验证 | `hooks/useWallet.js`、`useWalletSession.jsx`、App、全部pages/offchain组件；`frontend/tests/` | 补真实浏览器验收记录，条件允许再加浏览器自动化（拟建 `frontend/tests/e2e/`，NEW，工具待团队选择）；覆盖新钱包、拒绝签名、钱包/网络切换、并发旧请求、无MetaMask/无Supabase、空数据、RPC错误、过期/离线Logout | A切到B不残留私人结果；拒绝请求不显示成功；错误网络不发交易；所有写操作有锁和可理解反馈；Supabase失败不影响合法退款。SSR/mock通过不能代替本项 |
| F07 / P1 / 钱包控制入口 | `components/ConnectWallet.jsx`、`offchain/WalletSignIn.jsx`、`hooks/useWallet.js`、`useWalletSession.jsx` | 明确区分Connect、链下Sign in和Logout；补“在MetaMask切换账号”的入口说明。若提供站内账户选择，需显式用户点击后调用钱包支持的权限请求并处理拒绝；若做本地Disconnect，单独定义行为 | 当前已有链下Logout、已有MetaMask切换监听；**站内账户选择按钮和断开MetaMask授权尚未实现**。不能把Logout宣称为已撤销钱包连接授权；不能页面加载即弹选择/签名 |
| F08 / P1 / 错误恢复 | `components/CampaignMetadata.jsx`、`offchain/Views.jsx`、`services/metadata.js`、`interactions.js` | 元数据/图片/Views增加明确重试按钮；URI/项目变化时取消旧请求；保留超时、大小和安全检查，不把坏JSON或外部HTML插入页面 | 失败可重试且不必重新发链上交易；无效URI明确报错；旧项目响应不覆盖当前内容；Views重试仍遵守服务端窗口去重 |
| F09 / P1 / 历史与个人页 | `pages/Profile.jsx`、`MyContributions.jsx`、`MyCampaigns.jsx`、`components/offchain/SavedCampaigns.jsx` | 完成Tabs、长事件历史的客户端分页/加载提示、地址复制和空态；已有Saved分页无需再写一套；说明事件查询需要部署区块，日志范围大时不能假装成功空历史 | Created/Contributions/Refundable/Saved含义明确；未授权/错误网络/查询失败不同于无记录；金额bigint；其他部署收藏不误链接当前同ID；未知起始区块显示不可用 |
| F10 / P1 / 审核体验 | `pages/AdminDashboard.jsx`、`components/offchain/AdminReports.jsx`、`ReportDialog.jsx`、CommentSection | 完成举报详情、状态反馈、隐藏确认和单独链上暂停确认；同一动作失败重试时保留requestId以利用现有后端幂等性；说明后台审核的V2配置前提 | 提交举报/标记处理中/解决不发送链上交易；暂停必须单独确认MetaMask；只能对同部署V2发暂停；普通用户请求审核被服务端拒绝；V1举报可在已配置V2后台查看和处理 |
| F11 / P1 / 页面视觉交付 | 上方逐页面UI TODO全部真实路径；`frontend/src/styles.css` | 按现有业务做布局、表单、卡片、按钮、弹窗、toast、loading/empty/error、移动导航与键盘焦点；无需重写service或合约 | 至少320px/平板/桌面可操作，长地址/长正文不溢出，键盘可提交/取消，权限和Gas提示始终可见；真实数据与降级态都需检查 |
| F12 / P2 / 会话体验增强 | `hooks/useWalletSession.jsx`；auth.session | 可选：页面重新聚焦/恢复联网时检查服务端会话并清理已撤销登录态；沿用旧响应隔离，避免A请求清理B新会话。不是自动续期或跨标签共享登录 | 被撤销令牌下一次检查/私有请求后显示需重新登录；不能把客户端wallet字段当身份。服务器每次鉴权已存在，此项仅改善提前反馈 |

### 当前后端本身尚未提供的能力

以下不能作为“前端漏接已有API”分给UI组。需要另开后端/合约任务，再做前端接入：

- **图片/JSON上传与编辑器**：没有上传接口或存储桶权限方案。当前应保留粘贴已托管URI的流程与明确说明；不要画成已经能上传。
- **审核备注与审计日志页面**：后端目前记录审核日志，但没有备注存储/写入参数或日志查询action。需先设计受服务端owner校验的接口、迁移与测试，再在AdminReports中展示；不可让浏览器读service-role表。
- **隐藏评论恢复、评论编辑、深层回复、用户举报进度列表**：当前没有对应完整接口。当前承诺为隐藏本人评论、管理员隐藏、单层回复及管理员处理举报；如增加这些功能，先明确权限/历史保留/接口，不虚构按钮成功。
- **收藏专属独立分享页、跨版本运行时切换**：当前Saved在Profile，部署版本由构建配置选择，其他部署记录只标识而不误跳。若需要运行时切换，应统一地址/ABI/provider/缓存/会话及服务端allowlist验证后再做。
- **实时通知/实时评论、自动会话续期、跨标签登录、ERC-1271、验证码/WAF、事件索引、大规模链上项目服务端分页、Milestone Voting**：均属于Future Roadmap，不是本轮已实现能力。

完成标准：逐项更新本节状态并附测试/验收记录；功能代码、视觉完成、本地自动化通过、Supabase云端通过、Sepolia端到端通过必须分别记录。不得只因为有按钮或有后端接口就标记全部完成。
