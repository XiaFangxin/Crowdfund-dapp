# 课程展示教程：Sepolia合约 + Supabase收藏/评论 + 本机前端

版本标识：COURSE-LOCAL-V4（2026-11-03）。本版需要部署智能合约，并配置Supabase数据库及 `interactions` Edge Function，以演示真实收藏和评论；前端仅在展示电脑运行开发服务，无需申请域名或发布前端网站。下面命令默认从仓库根目录执行。

## 1. 准备

- Node.js 24.x、npm 11.x、安装MetaMask的浏览器及可用网络。
- 两个有Sepolia测试ETH的测试钱包：A部署/创建项目，B捐款。
- 部署成员另需Sepolia RPC URL和部署钱包私钥。
- 一位成员准备Supabase Cloud项目及管理权限；Edge Function需要Sepolia只读RPC。演示电脑需能访问Supabase、Sepolia RPC，并使用固定地址 `http://localhost:5173`。

合约只需一位成员部署一次。已有当前V2的真实地址、部署区块和同版本源码时，展示成员直接进入第3节。

## 2. 一次性部署智能合约

安装并验证，逐条成功后继续：

```powershell
npm.cmd --prefix smart-contract ci
npm.cmd --prefix smart-contract run compile
npm.cmd --prefix smart-contract test
npm.cmd --prefix smart-contract run check:abi
```

如果smart-contract/.env不存在，复制smart-contract/.env.example为.env；已有文件直接编辑，不覆盖。填写：

```dotenv
SEPOLIA_RPC_URL=YOUR_SEPOLIA_RPC_URL
SEPOLIA_PRIVATE_KEY=YOUR_DEPLOYER_PRIVATE_KEY
```

私钥仅留在部署者本机，不写入前端配置或提交Git。确认钱包有Sepolia测试ETH，然后执行：

```powershell
Set-Location smart-contract
npx.cmd hardhat ignition deploy ignition/modules/Crowdfunding.ts --network sepolia --deployment-id crowdfund-sepolia-v2
Set-Location ..
```

此命令发送测试网交易。若deployment ID已使用，先确认是否为同一次部署的续跑；有意新部署使用新ID，不复用V1日志或删除旧日志强行重跑。

部署成功后保存并交给展示成员：

| 资料 | 用途 |
| --- | --- |
| V2合约地址 | 填前端.env |
| 真实部署区块号 | 填前端.env，查询完整事件历史 |
| 部署交易哈希 | 证明部署成功并排查问题 |
| 管理员钱包地址 | 使用分类、暂停及交接功能 |
| 源码commit、deployment ID | 确保成员使用同一版本 |

核对部署收据成功、网络为Sepolia(chainId 11155111)、owner为部署钱包、初始分类数为6。记录到独立的smart-contract/deployments/sepolia-v2.json，不覆盖V1。新合约不继承旧项目和资金。

已知问题：此前合约编译/测试曾因Hardhat缓存锁超时（MultiProcessMutexTimeoutError）未完成。遇到此错误先检查其他Hardhat任务并正常结束占用，再重试；不要盲删不明锁。首次编译可能需要下载编译器，检查通过后再部署。仓库当前尚无已核验V2部署记录，不要把V1地址填成V2。

## 3. 本机启动前端

获取部署成员提供的同版本源码，在根目录安装前端依赖：

```powershell
npm.cmd --prefix frontend ci
```

如果frontend/.env不存在，复制frontend/.env.example为.env；已有文件直接编辑。使用真实部署结果替换以下占位值：

```dotenv
VITE_CROWDFUNDING_VERSION=v2
VITE_CROWDFUNDING_V2_ADDRESS=YOUR_REAL_V2_ADDRESS
VITE_CROWDFUNDING_V2_DEPLOY_BLOCK=YOUR_REAL_DEPLOYMENT_BLOCK
VITE_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=YOUR_PUBLIC_PUBLISHABLE_KEY
VITE_SUPABASE_ANON_KEY=
```

通常无需修改React源码，服务会根据版本选择仓库内对应ABI。前端只需要公开地址、区块、Supabase URL和publishable key，不需要部署私钥或服务端RPC凭据。使用publishable key时 `VITE_SUPABASE_ANON_KEY` 留空。Supabase两个值必须属于第3.1节配置的同一个项目。

从根目录启动：

```powershell
npm.cmd --prefix frontend run dev -- --port 5173 --strictPort
```

也可以进入frontend目录后运行：

```powershell
npm.cmd run dev -- --port 5173 --strictPort
```

打开 **http://localhost:5173**，在MetaMask选择Sepolia并连接钱包A。保持终端运行；修改.env后须重启服务，结束时按Ctrl+C。5173被占用时先处理占用，strictPort会直接报错。

根目录没有package.json，不能在根目录直接npm run dev。前端页面在本机，交易在Sepolia，因此演示时仍需联网。

## 3.1 配置收藏和评论所需的Supabase

**沿用现有实现时，本节是必做项。** 收藏和评论通过 `frontend/src/services/supabase.js` 请求 `POST /functions/v1/interactions`，没有本地离线替代。只建数据库、只填URL/公钥、只连接MetaMask，都不能完成写入；数据库迁移、Edge Function和钱包签名会话必须配套启用。若另外开发localStorage模式可以不依赖云端，但不属于本次文档调整。

推荐使用Supabase Cloud，由一名成员配置一次。前端仍在本机，不需要Docker自托管或发布前端网站。以下命令仅供负责人手动执行，会修改选中的Supabase项目；本次文档修改没有执行这些操作。

### A. 创建项目并应用数据库迁移

在Supabase Dashboard创建本Demo专用项目，等待数据库就绪，保存project ref和数据库密码。使用支持Node.js 24的Supabase CLI，在仓库根目录逐条执行：

```powershell
npx.cmd supabase login
npx.cmd supabase link --project-ref YOUR_PROJECT_REF
npx.cmd supabase db push
```

确认link指向本Demo项目再执行db push。仓库迁移位于 `supabase/migrations/202610210001_offchain_interactions.sql`，包含评论、收藏、签名挑战、会话及权限规则。不要另建无权限规则的简化表。随后在项目SQL Editor运行 `supabase/tests/verify_permissions.sql` 检查权限；不要通过关闭RLS解决访问问题。

### B. 填写服务端设置并部署函数

若 `supabase/.env.local` 不存在，复制模板；已有文件直接编辑，不覆盖：

```powershell
Copy-Item supabase/secrets.example.txt supabase/.env.local
```

将其中配置改为实际部署结果，以下占位值不能直接使用：

```dotenv
APP_ORIGINS=["http://localhost:5173"]
CHAIN_RPC_URL=YOUR_SEPOLIA_READ_RPC_URL
CAMPAIGN_CONTRACTS=[{"chainId":11155111,"address":"YOUR_REAL_V2_ADDRESS","version":"v2"}]
MODERATION_CONTRACT_ADDRESS=
```

- `CAMPAIGN_CONTRACTS` 必须包含前端正在使用的真实合约地址和正确版本。模板中的V1记录不等于已允许V2，不能将V1地址标成V2。服务端会读取链上项目，展示前必须先创建真实项目。
- `APP_ORIGINS` 精确匹配浏览器地址，不含路径或末尾斜杠。本教程固定为 `http://localhost:5173`；不要改用 `http://127.0.0.1:5173` 或其他端口，除非同时更新服务端配置并重新上传secrets。
- `CHAIN_RPC_URL` 仅用于服务端只读链查询，无需钱包私钥，不放入前端。
- 仅展示收藏/评论时，`MODERATION_CONTRACT_ADDRESS` 可以留空；它只用于额外的管理员举报审核。
- 托管Edge Runtime自动提供 `SUPABASE_URL` 和 `SUPABASE_SERVICE_ROLE_KEY`，不要将service-role密钥复制到前端，也不要提交 `.env.local`。

确认上述设置后执行：

```powershell
npx.cmd supabase secrets set --env-file supabase/.env.local
npx.cmd supabase functions deploy interactions
```

必须从仓库根目录部署，使CLI读取 `supabase/config.toml`：其中已为本函数设置 `verify_jwt=false`，函数内部仍验证origin、钱包签名和自己的会话令牌。不要删除这些验证，也不要改为浏览器直接访问数据库。只在Dashboard创建项目而不部署函数，前端不能使用收藏/评论。

### C. 连接本机前端并验收

从该Supabase项目的连接/API设置中获取URL和公开publishable key，填写第3节的 `frontend/.env` 并重启Vite。旧式anon key仅作为兼容选项；不能使用secret或service-role key。无需为本模块配置邮箱登录，也不需要把本机页面部署到公网。

先按以下步骤彩排，再进行正式展示：

1. 打开 `http://localhost:5173/#/campaign/项目ID`，连接钱包A并切到Sepolia。
2. 点击 **Sign in with wallet (no gas)**，核对签名消息中的 `localhost:5173`、URI和chainId。此步骤为消息签名，不发送交易，也不消耗Gas；单纯Connect Wallet不等于已登录链下互动。
3. 点击 **Save campaign (no gas)**，确认按钮变成 **Unsave campaign**；进入Profile查看 **Saved Campaigns**，确认该项目存在。
4. 返回详情，在评论框输入现场演示内容，点击 **Post comment (no gas)**，确认评论出现在列表中。
5. 刷新页面后重新点击钱包消息签名登录：会话只保存在页面内存，刷新后需重新签名，但云端收藏和评论应仍存在。必要时使用 **Refresh comments** / **Refresh saved campaigns**。
6. 点击 **Unsave campaign (no gas)**，确认收藏列表同步移除；切换钱包B并重新签名，确认B没有继承A的收藏，公开评论仍可读取。

验收只要求真实收藏/取消收藏和评论可写入、可重新读取。不要求本次演示回复、举报、Views排序、跨设备登录或管理员审核；这些功能的完整检查见 [Supabase说明](supabase/README.md) 和 [人工验收](supabase/VERIFY.md)。

CLI部署与secrets使用方式参考官方 [函数部署](https://supabase.com/docs/guides/functions/deploy) 和 [环境变量](https://supabase.com/docs/guides/functions/secrets) 文档。

## 4. 提前准备三个演示项目

| 项目 | 准备方法 | 现场展示 |
| --- | --- | --- |
| 进行中项目 | 截止时间在展示结束之后 | 列表、详情、捐款、进度、暂停/恢复 |
| 成功到期项目 | A创建低目标项目，B捐款达标，展示前到期；不要提前提现 | A提现 |
| 失败到期项目 | A创建高目标项目，B小额捐款未达标，展示前到期；不要提前退款 | B退款 |

创建时留出交易确认时间。合约使用链上时间，修改电脑时间不能提前提现或退款。另记下项目ID、关键交易哈希，并提前彩排一次。可以准备彩排录屏备用，但现场要说明哪些是预录内容。

## 5. 课堂展示顺序

1. 展示首页列表、搜索、分类/状态筛选和项目详情。
2. A现场创建新项目，演示MetaMask签名与交易确认；metadata URI可以留空。
3. 切B给预先准备的进行中项目捐款，确认后展示筹款金额与个人贡献。
4. 切A给成功到期项目提现，再切B给失败到期项目退款。
5. 返回项目详情，以钱包A完成 **Sign in with wallet (no gas)**，演示收藏、Profile收藏列表、发表评论和刷新后重新读取，再演示取消收藏。区分链上交易与无Gas的链下消息签名。
6. 切当前owner进入管理员页，展示分类管理及暂停/恢复。
7. 时间允许可在最后演示两步交接：A提名B，B进入管理员页接受。不要在其他管理演示前让A失去权限。

入口：

- 首页：http://localhost:5173/#/
- 创建：http://localhost:5173/#/create
- 个人页：http://localhost:5173/#/profile
- 管理页：http://localhost:5173/#/admin
- 详情：http://localhost:5173/#/campaign/项目ID

每笔交易确认后再进行下一笔。切换账户通过MetaMask操作，两个钱包都预留测试ETH支付Gas。

## 6. 本次可以跳过什么

**收藏和评论是本次必演项目，不能跳过Supabase配置。** 若显示未配置/不可用或操作失败，说明该部分尚未准备完成，不能宣称已成功写入。

回复、举报、Views展示及举报审核不是本次最低验收要求；无需为它们额外配置审核合约或安排现场演示。也不需要部署前端、申请域名或自行运行Node后端。

图片/metadata与项目更新正文需要公开HTTPS/IPFS JSON；没有准备好可以跳过，不影响基础创建、捐款、提现和退款。本地文件路径不能当作HTTPS/IPFS URI。

长期维护、定期清理过期会话等扩展安排参考 `supabase/README.md`；单次展示先完成第3.1节的部署和实测，不把完整生产运维作为前置要求。

## 7. 快速排错与完成标准

| 问题 | 处理 |
| --- | --- |
| 页面提示V2未配置 | 核对版本、真实V2地址、部署区块，重启Vite |
| 无法读链或发交易 | 检查MetaMask已启用、处于Sepolia、钱包连接和网络可用 |
| 余额不足 | 两个钱包都需要Sepolia测试ETH支付Gas |
| 提现/退款不可用 | 检查钱包身份、真实截止时间、是否达标及是否已经处理 |
| 管理员无权限 | 使用当前owner；被提名钱包必须先接受才能管理 |
| 交易待确认或刷新后被锁 | 使用Check saved transaction查收据；先核对MetaMask活动，不清存储绕过保护或重复发送；恢复成功后刷新页面 |
| 历史查询失败 | 核对真实部署起始区块和RPC连接，不把失败当作无记录 |
| 评论/收藏提示未配置 | 核对frontend/.env的Supabase URL和公开key，重启Vite；这是本次必演项 |
| interactions返回404 | 确认部署了同一Supabase项目的interactions函数，而非仅创建项目 |
| CORS/origin错误 | APP_ORIGINS精确匹配http://localhost:5173；修改后重新上传secrets |
| 登录或评论/收藏返回401 | 先连接钱包和Sepolia，再点击Sign in with wallet；刷新后需重新签名；确认函数使用仓库的verify_jwt=false配置 |
| 项目不允许/链查询失败 | 核对CAMPAIGN_CONTRACTS真实地址、版本和前端一致，CHAIN_RPC_URL可读Sepolia，项目ID真实存在 |
| 迁移/RPC缺失或写入失败 | 确认db push成功且项目一致，检查Edge Function日志；不要关闭RLS或将service-role放进前端 |

准备完成标准：**合约部署成功并记录地址/区块、本机前端能启动、两个钱包彩排通过、三个演示项目准备好，以及Supabase迁移与函数部署完成、收藏/取消收藏与评论写入及刷新后读取实测通过。** 最近代码验证为前端47项测试和构建通过；本次仅修改文档，没有执行真实Supabase/Sepolia部署或重新运行代码测试。上述步骤是待执行的交付流程，不代表云端联调已完成。
