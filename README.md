# Crowdfund DApp V2 · 课程展示版

React + Vite + ethers v6 / Solidity + Hardhat 3 / Sepolia + MetaMask。

更新：2026-11-03。本项目采用 **Sepolia部署智能合约 + Supabase Cloud提供收藏/评论 + 本机运行前端** 的单机课程展示方案，不需要购买域名、部署前端网站或自行维护常驻Node后端服务。详细操作见 [课程部署与展示教程](DELIVERY_GUIDE.md)。

## 展示方案

```text
本机浏览器 http://localhost:5173
          ↓ React界面 + ethers
        MetaMask
          ↓
Sepolia智能合约（项目、捐款、提现、退款、分类和管理员权限）

同一本机React界面
          ↓ 钱包消息签名登录（无Gas）
Supabase interactions Edge Function
          ↓
Supabase PostgreSQL（收藏、评论）
```

核心众筹业务由智能合约承担。**本次要求实际展示收藏和评论，因此沿用当前实现时必须配置Supabase数据库并部署 `interactions` Edge Function。** 这些功能不由当前合约提供，也没有localStorage离线替代模式；仅创建Supabase项目或填写前端公钥仍不足以使用。

这是本仓库现有实现的依赖，并非单机展示天然需要云端数据库。可以另外开发本地演示模式，但本次只完善现有方案的交付文档，不新增模拟功能。Supabase后端部署与前端托管相互独立，展示电脑仍通过 `npm run dev` 使用本机页面。

| 功能 | 最简方案能否演示 |
| --- | --- |
| 首页项目列表、搜索/状态/分类筛选、详情、筹款进度 | 可以，需要MetaMask处于Sepolia |
| 创建项目、捐款、到期后成功提现/失败退款 | 可以，需要两个测试钱包和测试ETH |
| Profile创建项目、贡献、退款与交易历史 | 可以，需要填写真实部署起始区块 |
| 管理员分类管理、暂停/恢复、两步权限交接 | 可以，需要部署当前V2并使用对应管理员钱包 |
| 待确认交易保存、刷新后查询收据、重复提交保护 | 可以，使用同一浏览器的本地存储 |
| 图片/metadata、项目更新正文 | 可选，需要已托管的HTTPS/IPFS JSON；基础众筹演示可跳过 |
| 收藏/取消收藏、Profile收藏列表、发表评论及刷新后读取 | 本次必演；需配置Supabase数据库、Edge Function和钱包消息签名登录，无需Gas |
| 回复、举报、Views及举报审核 | 本次可跳过；举报审核另需服务端配置真实V2管理合约 |

前端在本机运行，但交易发生在真实Sepolia测试网；需要联网和测试ETH。合约部署一次后，其他成员拿到源码、ABI、地址和区块即可在各自电脑运行前端，不需要每人重新部署。

## 快速运行（已有V2部署）

准备Node.js **24.x**、npm **11.x**、带MetaMask的浏览器；钱包切换到Sepolia（chainId 11155111）。在仓库根目录执行：

```powershell
npm.cmd --prefix frontend ci
```

若frontend/.env尚不存在，复制frontend/.env.example为frontend/.env；已有文件直接编辑，不要覆盖。填入部署成员提供的真实值：

```dotenv
VITE_CROWDFUNDING_VERSION=v2
VITE_CROWDFUNDING_V2_ADDRESS=YOUR_REAL_V2_ADDRESS
VITE_CROWDFUNDING_V2_DEPLOY_BLOCK=YOUR_REAL_DEPLOYMENT_BLOCK
VITE_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=YOUR_PUBLIC_PUBLISHABLE_KEY
VITE_SUPABASE_ANON_KEY=
```

Supabase两个公开值取自同一个项目；使用publishable key时，`VITE_SUPABASE_ANON_KEY` 留空。不要填写secret或service-role key。首次接入先按 [教程第3.1节](DELIVERY_GUIDE.md#31-配置收藏和评论所需的supabase) 完成数据库迁移、服务端配置和Edge Function部署，再重启开发服务。从仓库根目录启动：

```powershell
npm.cmd --prefix frontend run dev -- --port 5173 --strictPort
```

打开 **http://localhost:5173**，连接MetaMask。也可进入frontend目录后执行 `npm run dev -- --port 5173 --strictPort`；PowerShell遇执行策略限制时使用npm.cmd。终端保持运行，结束时按Ctrl+C。根目录没有package.json，不能在根目录直接npm run dev。

没有V2地址时，先让一位成员按 [教程](DELIVERY_GUIDE.md) 部署合约。V2不能填写V1地址；ABI由仓库服务按版本选择，通常只需配置地址和区块，不用改React源码。

## 代码与当前状态

| 目录 | 内容 |
| --- | --- |
| smart-contract/ | Solidity合约、Hardhat测试、Ignition部署模块和部署记录 |
| frontend/ | React界面、钱包、合约调用、交易恢复与链下组件，本机运行 |
| supabase/ | 评论/收藏等链下后端，本次需部署数据库迁移和interactions函数 |

当前已实现核心资金流程、分类/暂停、管理员两步交接、Profile Tabs与交易历史、待确认交易恢复和后台刷新保留数据。实际演示前仍需用真实钱包走通计划展示的流程。

部署记录：V1地址为 `0xbdF615493ce21B7Ae54E6464D44c507C76b85B6C`，仓库记录区块11892197，见 [sepolia.json](smart-contract/deployments/sepolia.json)；本次未实时复查。**当前仓库尚无已核验V2部署记录。** V2需单独部署并保存记录，不覆盖V1。新合约不会继承旧项目和资金。

## 展示前检查

- 准备创建者/管理员A、捐款者B两个有Sepolia测试ETH的钱包，提前连接本机站点。
- 提前创建至少一个已达标到期项目和一个未达标到期项目，分别留待现场提现、退款；再留一个进行中的项目现场捐款。
- 提现与退款取决于链上截止时间，不能靠修改电脑时间提前执行。现场新建项目可用于演示创建，不必现场等待它结束。
- 交易发出后先等待确认；遇待确认面板使用“Check saved transaction”，不要清存储或重复提交。恢复完成后刷新页面重载数据。
- 在同一个项目详情页完成钱包消息签名登录，演示收藏、Profile收藏列表、取消收藏及发表评论；刷新后重新签名登录，确认收藏和评论仍可读取。切换B确认不会继承A的收藏身份。
- Supabase未配置或写入失败时，收藏/评论验收不通过，不能用禁用按钮或错误提示代替成功演示。图片/JSON未准备好仍可跳过元数据。

## 本地验证记录

最近代码验证：前端 **47项测试及production build通过**；链下6项测试和Node语法检查通过。合约compile/test曾受Hardhat编译器缓存锁超时影响，未完成本次重新验证；部署成员应先解决并通过检查。ABI检查基于已有产物通过，不代替重新编译。真实Sepolia/MetaMask全流程仍需演示前实测。

```powershell
npm.cmd --prefix frontend test
npm.cmd --prefix frontend run build
```

本次仅调整文档，没有重新执行上述测试或部署。首次编译可能下载编译器；本项目用于测试网课程演示，未经过独立安全审计。私钥仅保存在部署者本机smart-contract/.env，不能放入frontend/.env或提交Git。

图片上传/编辑器、Milestone Voting、DAO/NFT等未实现；页面分包、正式域名、前端托管、生产维护配置不作为本次课程展示的前置要求。Supabase完整架构与扩展验收见 [Supabase说明](supabase/README.md) 和 [人工验收](supabase/VERIFY.md)。本次必做的最小部署与收藏/评论演示步骤以 [交付教程](DELIVERY_GUIDE.md) 为准；尚未执行真实云端部署或确认云端联调成功。
