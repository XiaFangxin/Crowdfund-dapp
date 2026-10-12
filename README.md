# Crowdfund DApp

**Functional Demo（功能演示）· Ethereum Sepolia · 大学课程小组项目**

技术栈为 React + Vite、ethers.js v6、MetaMask、Solidity 和 Hardhat 3。仓库包含两个独立的 npm 项目，根目录没有 npm workspace。本项目尚未达到生产可用标准，也未经过安全审计。

## 项目介绍与功能展示

Crowdfund DApp 是面向校园和社区项目的去中心化众筹演示应用。创建者设定 ETH 筹款目标与截止时间，参与者通过 MetaMask 捐款；截止后，达标项目由创建者提现，未达标项目由参与者各自申请退款。智能合约执行资金与权限规则，前端展示真实链上数据。

核心特点：钱包签名、透明的筹款规则、创建者与参与者分工，以及链上筹款进度展示。当前为 **Functional Demo**，不是承载真实资金的生产产品。

| 实现与验证状态             | 功能与验证范围                                                                                                                                                                      |
| -------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 已实现并在 Sepolia 验证    | 团队已通过 Hardhat Ignition 部署合约；已连接 MetaMask 并识别 Sepolia；已创建 Campaign `0`（`test1`）；详情页已读取创建者、目标金额、已筹金额、截止时间与状态。                      |
| 已实现，尚未完成端到端验证 | Contribute、Withdraw、Refund 的合约、service 与按钮已实现，但 Sepolia 端到端验证尚未确认；Home 列表、My Campaigns 创建者筛选、账户/网络切换与错误提示已实现，完整浏览器回归待完成。 |
| 计划功能                   | 搜索/筛选/排序、进度与自动倒计时、捐款历史与 My Contributions、细化交易反馈、响应式体验；分类、图片、项目更新及里程碑投票为可选扩展。                                               |

上述验证状态依据团队提供的进度，本次文档更新没有独立复现这些流程，也没有发送交易。Etherscan 源码验证状态与当前 Campaign 实时数值尚未确认。本地测试不能替代 Sepolia 端到端验证。

## 整体架构与目录职责

```text
React 页面 -> services/crowdfunding.js -> ethers BrowserProvider
                                         -> MetaMask -> Sepolia Crowdfunding
React 组件 -> hooks/useWallet.js -> MetaMask 账户/网络事件
Solidity -> Hardhat 编译 -> ABI 导出 -> frontend/src/contracts/
Ignition -> Sepolia 部署 -> 公开记录 -> frontend/.env
```

项目没有后端、数据库或索引服务。MetaMask 提供 RPC 访问与交易签名，前端不处理私钥。`App.jsx` 管理共享的钱包 hook 和 Hash 导航，`#/campaign/0` 等直接链接无需配置服务端路由。

| 现有路径                                                            | 职责                                                                                                        |
| ------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| `frontend/src/pages/`                                               | `Home.jsx`、`CreateCampaign.jsx`、`CampaignDetail.jsx`、`MyCampaigns.jsx`：列表、表单、链上读取与操作       |
| `frontend/src/components/`                                          | `Navbar.jsx`、`ConnectWallet.jsx`、`CampaignList.jsx`、`ContractStatus.jsx`：导航、钱包控制、列表与配置提示 |
| `frontend/src/hooks/`                                               | `useWallet.js`：钱包生命周期与事件；`useCampaigns.js`：众筹数据加载                                         |
| `frontend/src/services/crowdfunding.js`                             | ethers 合约读写、等待交易回执与错误格式化                                                                   |
| `frontend/src/config/`                                              | `network.js`：Sepolia 网络 ID；`contracts.js`：公开合约地址校验                                             |
| `frontend/src/contracts/Crowdfunding.json`                          | 仅保存生成的 ABI                                                                                            |
| `frontend/src/App.jsx`, `main.jsx`, `styles.css`                    | 页面导航、React 入口与共享样式                                                                              |
| `frontend/vite.config.js`, `.env.example`                           | Vite/React 配置与公开配置模板                                                                               |
| `smart-contract/contracts/Crowdfunding.sol`                         | 众筹生命周期、资金记账与事件                                                                                |
| `smart-contract/test/Crowdfunding.ts`                               | 在模拟网络运行的 ethers/Mocha 测试                                                                          |
| `smart-contract/ignition/modules/Crowdfunding.ts`                   | `CrowdfundingModule`：部署无需构造参数的 `Crowdfunding`                                                     |
| `smart-contract/deployments/`                                       | 公开部署记录                                                                                                |
| `smart-contract/scripts/export-abi.mjs`                             | 将 ABI 导出到前端                                                                                           |
| `smart-contract/hardhat.config.ts`, `tsconfig.json`, `.env.example` | Hardhat 3 ESM/TypeScript 配置与私有部署配置模板                                                             |

## 部署与快速启动

### 共用 Sepolia 合约

| 项目            | 内容                                                                                                 |
| --------------- | ---------------------------------------------------------------------------------------------------- |
| 网络 / Chain ID | Ethereum Sepolia / `11155111` (`0xaa36a7`)                                                           |
| 合约地址        | `0xbdF615493ce21B7Ae54E6464D44c507C76b85B6C`                                                         |
| 区块浏览器      | [Sepolia Etherscan](https://sepolia.etherscan.io/address/0xbdF615493ce21B7Ae54E6464D44c507C76b85B6C) |
| 已知众筹        | ID `0`，标题 `test1`；状态与其他数值可能变化                                                         |
| 公开记录        | [smart-contract/deployments/sepolia.json](smart-contract/deployments/sepolia.json)                   |

**组员应使用现有共用合约，无需各自重新部署。** 运行前端不需要部署凭据。部署交易哈希、区块号、源码 commit 与实际 Ignition deployment ID 尚未确认，公开记录中保留为 `null`。

### 安装与运行

使用 **Node.js 24.x / npm 11.x**，与两个项目的 package 配置一致；还需 Git 和安装 MetaMask 的浏览器。写入交易与 gas 需要 Sepolia 测试 ETH，读取不需要测试 ETH。以下命令适用于 Git Bash；PowerShell 中用 `Copy-Item` 替代 `cp`，若脚本执行受限则使用 `npm.cmd` / `npx.cmd`。

```sh
git clone https://github.com/XiaFangxin/Crowdfund-dapp.git
cd Crowdfund-dapp
cd frontend
npm ci
cp .env.example .env
```

在 `frontend/.env` 设置以下公开值，示例模板中的地址仍为空：

```dotenv
VITE_CROWDFUNDING_ADDRESS=0xbdF615493ce21B7Ae54E6464D44c507C76b85B6C
```

```sh
# 在 frontend/ 目录执行
npm run dev
# 可选：构建与预览
npm run build
npm run preview
```

打开终端中 Vite 输出的地址。修改 `.env` 后重启 Vite。构建、预览和打开页面不要求安装 MetaMask 或配置地址；链上读取需要 MetaMask 注入的 provider，并切换至 Sepolia。地址为空、无效或为零地址时禁用合约操作，service 还会检查链上合约字节码。

从仓库根目录打开另一个终端：

```sh
cd smart-contract
npm ci
npm run compile
npm test
npm run export:abi
```

编译与测试分别等价于 `npx hardhat compile` / `npx hardhat test`，无需部署用的 `.env`。测试使用有余额的模拟账户，并推进区块时间。首次编译可能下载编译器。`No contracts to compile` 通常表示缓存产物已是最新；需要重新编译时使用 `npx hardhat compile --force`。

ABI 导出读取 `smart-contract/artifacts/contracts/Crowdfunding.sol/Crowdfunding.json`，仅将 `{ abi }` 写入 `frontend/src/contracts/Crowdfunding.json`。先编译，并确认源码和 ABI 与选用的已部署版本对应。导出 ABI 不会部署合约或生成地址。

### MetaMask 连接与演示流程

1. 在 MetaMask 测试网络设置中启用 Sepolia。点击 **Connect Wallet** 授权账户访问，再使用 **Switch to Sepolia**。若提示未知网络，先在 MetaMask 启用 Sepolia 后重试。
2. 打开 Home 与 Campaign `0`（`test1`），或在本地地址后添加 `#/campaign/0`。核对创建者、目标、已筹金额、截止时间和推导状态。**My Campaigns** 按创建者筛选，不是捐款历史页。
3. 在 **Create Campaign** 输入标题、描述、正数 ETH 目标与未来截止时间（浏览器本地时间）。在 MetaMask 确认并等待回执，再返回 Home 查找新项目；当前表单不会直接跳转至新 ID。
4. 详情页支持截止前捐款、截止后达标项目的创建者提现，以及失败项目的参与者退款。这三项仍需记录端到端验证结果。截止后请刷新页面：当前操作资格随渲染计算，尚未使用定时器自动更新。
5. 在 MetaMask **Activity** 查看交易及区块浏览器链接，或查看合约的 Etherscan 页面。当前应用只显示确认文字，尚无交易哈希链接或历史面板。

按钮可用不代表满足全部条件，最终以合约规则为准。后续验证应安排独立的小组测试，使用两个账户及短期成功/失败项目，记录交易哈希和预期状态变化，覆盖拒绝请求、无效调用、提前与重复提现/退款。

### 部署负责人指南

日常开发继续使用共用合约。部署时使用持有 Sepolia 测试 ETH 的专用测试钱包。在 `smart-contract/` 将 `.env.example` 复制为 `.env`，私下设置 `SEPOLIA_RPC_URL` 为 Sepolia 节点地址，`SEPOLIA_PRIVATE_KEY` 为部署账户以 `0x` 开头的私钥。不得将真实值写入文档、截图、PR 或日志。现有配置通过 dotenv 加载文件，并在使用 `sepolia` 时延迟解析变量。

完成评审、编译、测试与 ABI 导出后，现有部署模块的命令为：

```sh
# 在 smart-contract/ 执行；此命令会发送真实 Sepolia 交易
npx hardhat ignition deploy ignition/modules/Crowdfunding.ts --network sepolia
```

若有意部署新版本，使用团队约定的新 deployment ID，例如：

```sh
npx hardhat ignition deploy ignition/modules/Crowdfunding.ts --network sepolia --deployment-id crowdfund-sepolia-v2
```

Ignition 默认使用 `chain-11155111`，在 `ignition/deployments/<deployment-id>/` 保存支持继续部署的日志。复用 ID 不保证创建新合约，字节码变化可能导致部署记录协调冲突。应在本地保留日志，不要手工修改或删除日志来强制部署；独立新版本使用新 ID。生成的日志已被 Git 忽略。原部署 ID 应从负责人的日志确认，不能直接假定为默认值。参阅 [Ignition 官方部署指南](https://hardhat.org/ignition/docs/guides/deploy)。

部署确认后，先用约定的版本化文件名保留旧公开记录，再更新 `deployments/sepolia.json` 中的地址、Chain ID、deployment ID，以及已确认的交易哈希、区块号和源码 commit。检查字节码与基本读取，提交匹配的生成 ABI 和公开记录，更新本 README 及组员本地 `frontend/.env`，重启 Vite 并验证集成。

**已部署的普通智能合约不能原地修改。** Solidity 行为或存储变更必须重新部署才能在 Sepolia 生效，即使函数签名未变。新合约**不会自动继承**旧 Campaign、捐款或 ETH。应保留旧地址以履行旧合约的提现/退款流程；迁移需要单独设计。仅修改前端不需要重新部署。

## 合约接口与演示规则

ID 从 `0` 开始。`Campaign` 包含 `creator`、`title`、`description`、`goal`、`deadline`、`amountRaised`、`withdrawn`。金额单位为 wei，截止时间为 Unix 秒级时间戳；在界面边界使用 `parseEther` / `formatEther`，不要用浮点运算记账 ETH。

| 接口                                                 | 行为                                                           |
| ---------------------------------------------------- | -------------------------------------------------------------- |
| `campaignCount()` / `getCampaign(id)`                | 返回数量与结构体；不存在的 ID 会回退                           |
| `createCampaign(title, description, goal, deadline)` | 标题非空、目标为正、截止时间在未来；返回新 ID                  |
| `contribute(id)` payable                             | 仅可在截止前捐入正数 ETH；重复捐款累加                         |
| `contributions(id, address)`                         | 记录的捐款额；退款后清零，成功提现后保留                       |
| `withdraw(id)`                                       | 仅创建者可在截止时或之后、目标达成时调用一次；释放全部已筹资金 |
| `refund(id)`                                         | 截止时或之后、目标未达成；调用者领取自己的退款，仅一次         |

事件包括 `CampaignCreated`、`Contributed`、`Withdrawn`、`Refunded`，众筹 ID 与参与者地址为索引字段。允许超额筹款与创建者捐款。`amountRaised` 是历史筹款总额，提现或退款后不变，不是剩余托管余额。现有规则不支持成功项目退款。

转账前先更新状态，并使用 `nonReentrant`。现有六项测试覆盖创建/事件、无效输入/ID、捐款记账、截止限制、提现与退款。这不等于安全审计；恶意接收者、更完整的边界和浏览器测试仍需补充。本次仅更新文档，未重新运行测试。

## 开发路线图与 TODO 清单

**推荐课程范围：**先完成 P0，再选择 P1 的搜索/筛选/排序、进度/倒计时、捐款历史/My Contributions。这些功能可基于现有部署提升产品完整度。元数据和 P2 投票为可选项，小规模演示无需后端或索引服务。

路径均相对仓库根目录；花括号写法用于简写现有文件，不是命令。**NEW（新增）**表示尚不存在的建议文件或函数。负责人角色对应下方协作表。

### P0 — 基础流程、问题修复与安全测试

| 功能 / 任务                    | 目的                         | 优先级  | 负责人角色         | 修改文件                                                                                                                                                                                       | 代码改动                                                                                                                                                                                  | 依赖关系                                                          | 验收标准                                                                                                    |
| ------------------------------ | ---------------------------- | ------- | ------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| Sepolia 全流程验证与针对性修复 | 确认真实资金流程             | P0 必做 | 测试 + Web3 + 页面 | `smart-contract/test/Crowdfunding.ts`；`frontend/src/services/crowdfunding.js`；`frontend/src/pages/{CreateCampaign,CampaignDetail}.jsx`；**NEW** `smart-contract/deployments/verification.md` | 验证现有 `createCampaign`、`contribute`、`withdraw`、`refund`、`getCampaign`、`getContribution`；修复可复现缺陷，记录不含敏感信息的手工验证证据                                           | 两个钱包与测试 ETH；仅需修复合约时才更新 ABI/重新部署             | 创建、捐款、读取、成功提现和失败退款有确认哈希；正确处理提前、无权限、重复调用与用户拒绝；状态/余额符合规则 |
| 安全与边界测试                 | 防止资金转出与记账回归       | P0 必做 | 测试 + 合约        | `smart-contract/test/Crowdfunding.ts`；**NEW** `smart-contract/contracts/test/AdversarialReceiver.sol`                                                                                         | 新增接收者辅助合约；测试重入、拒收转账/回滚、多项目资金隔离、超额筹款、准确截止边界、无效提现/退款 ID 和 `Withdrawn` 事件                                                                 | 本地 Hardhat；仅 `Crowdfunding.sol` 需修复时更新正式 ABI/重新部署 | 新旧测试通过；无重复转出或跨项目盗取；转账失败保留领取资格，成功项目不可退款                                |
| 完善交易反馈                   | 说明签名、等待确认与失败状态 | P0 必做 | Web3 + 页面 + UI   | `frontend/src/services/crowdfunding.js`；`frontend/src/pages/{CreateCampaign,CampaignDetail}.jsx`；**NEW** `frontend/src/components/TransactionStatus.jsx`                                     | 在 `tx.wait()` 前新增 **NEW** 交易提交回调；将 `pending`/`message` 扩展为待签名/已提交/已确认/失败状态；保留哈希与回执、浏览器链接，处理替换/拒绝；解析 `CampaignCreated` 回执并跳转到 ID | 无需合约/ABI 修改或重新部署                                       | 所有写入操作等待时显示哈希、防止重复提交、失败后恢复、确认后刷新；创建后跳转真实 ID                         |
| 自动更新状态与钱包回归         | 防止过期资格和旧账户数据残留 | P0 必做 | 页面 + Web3        | `frontend/src/pages/CampaignDetail.jsx`；`frontend/src/hooks/{useWallet,useCampaigns}.js`；**NEW** `frontend/src/utils/campaignStatus.js`                                                      | 将 `ended`/`successful`/`withdrawn` 推导提取为 **NEW** 共享工具；添加定时 effect 与清理；保留账户/网络/ID 切换时的过期请求取消逻辑                                                        | 仅推导界面状态，无需 ABI/重新部署                                 | 到截止时间无需刷新即可更新按钮；错误网络/断开时禁用写入；账户/ID 切换不残留个人捐款；合约仍为最终依据       |
| 响应式与无障碍界面             | 支持手机和键盘演示           | P0 必做 | UI + 页面          | `frontend/src/styles.css`；`frontend/src/components/{Navbar,CampaignList,ConnectWallet,ContractStatus}.jsx`；`frontend/src/pages/{CreateCampaign,CampaignDetail}.jsx`                          | 响应式布局、地址换行、焦点样式、统一加载/空数据/错误状态和无障碍状态提示                                                                                                                  | 与页面负责人约定 props，无合约依赖                                | 360px 与桌面宽度均无横向溢出；键盘导航/表单可用；等待和错误提示清晰                                         |

### P1 — 核心产品增强

| 功能 / 任务                 | 目的                   | 优先级                      | 负责人角色              | 修改文件                                                                                                                                                                                                                                                     | 代码改动                                                                                                                                                                        | 依赖关系                                                                       | 验收标准                                                                                                  |
| --------------------------- | ---------------------- | --------------------------- | ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------- |
| 众筹搜索/筛选/排序          | 帮助用户找到相关项目   | P1 推荐                     | 页面 + UI               | `frontend/src/pages/Home.jsx`；`frontend/src/components/CampaignList.jsx`；**NEW** `frontend/src/components/CampaignFilters.jsx`                                                                                                                             | 在 `Home` 添加查询/状态/排序状态；按标题、描述和共享状态筛选 `useCampaigns` 结果；用 bigint 比较实现稳定的截止时间/已筹金额排序；支持重置与无匹配提示                           | P0 状态工具、现有 `listCampaigns`；无需重新部署                                | 大小写无关搜索、状态筛选与排序可组合；保留原始获取数据                                                    |
| 筹款进度与倒计时            | 展示目标进度与剩余时间 | P1 推荐                     | UI + 页面               | `frontend/src/components/CampaignList.jsx`；`frontend/src/pages/CampaignDetail.jsx`；**NEW** `frontend/src/components/CampaignProgress.jsx`                                                                                                                  | 根据 `goal`、`amountRaised`、`deadline` 显示无障碍进度/倒计时；bigint 比例计算，进度条上限 100% 但保留超额总额；清理定时器                                                      | P0 时间/状态逻辑，无合约变更                                                   | 列表/详情一致；超额金额准确、到期计时归零，正确标注历史总额                                               |
| 捐款记录 / My Contributions | 查看参与记录和退款资格 | P1 推荐                     | Web3 + 页面             | `frontend/src/services/crowdfunding.js`；`frontend/src/pages/CampaignDetail.jsx`；`frontend/src/App.jsx`；`frontend/src/components/Navbar.jsx`；**NEW** `frontend/src/pages/MyContributions.jsx`；**NEW** `frontend/src/components/DonationHistory.jsx`      | **NEW** 查询工具通过 `queryFilter` 读取索引事件 `Contributed`/`Refunded`；分块查询、按哈希/日志位置去重、按区块/日志排序；新增个人路由；用 `getContribution` 与项目状态判断资格 | 先确认部署起始区块或说明分段查询回退方案；考虑 RPC 日志限制；无需 ABI/重新部署 | 历史记录含交易链接，换账户刷新；退款后捐款历史仍保留；提现后保留的映射不标为可退款；RPC 错误可见          |
| 分类、图片/元数据与项目更新 | 改善发现与项目说明     | P1 可选，推荐范围完成后再做 | 合约 + Web3 + 页面 + UI | `smart-contract/contracts/Crowdfunding.sol`；`smart-contract/test/Crowdfunding.ts`；`frontend/src/services/crowdfunding.js`；`frontend/src/pages/{CreateCampaign,CampaignDetail,Home}.jsx`；生成 ABI；**NEW** `frontend/src/components/CampaignMetadata.jsx` | 设计 **NEW** 创建字段 `metadataURI`、创建者专属更新函数/事件；公开托管或 IPFS JSON 定义分类/图片/更新格式；安全渲染文字/URL 并提供回退，约定更新历史语义                        | 托管/固定保存方案、合约测试、ABI 导出、新部署/地址；旧项目仍在旧合约           | 跨浏览器持久可读，仅创建者可更新；缺失 JSON/不安全 URL 可妥善处理；分类筛选一致，资金条款与可编辑信息分开 |

不要将结构化元数据偷偷塞入 `description`，也不要把浏览器本地存储称为去中心化持久化。本地示例数据需明确标注。课程范围使用元数据分类即可，链上分类会增加存储成本。当前状态由截止时间、筹款和提现情况推导；取消、延长截止或提前释放资金需要单独评审资金规则。

### P2 — 高级去中心化功能（可选拓展）

| 功能 / 任务                | 目的                     | 优先级  | 负责人角色                         | 修改文件                                                                                                                                                                                                                                                                                                                                                             | 代码改动                                                                                                                                                                                                                  | 依赖关系                                                                    | 验收标准                                                                                                                         |
| -------------------------- | ------------------------ | ------- | ---------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| 里程碑资金释放与参与者投票 | 按约定进展分阶段释放资金 | P2 可选 | 合约 + 测试，随后 Web3 + 页面 + UI | `smart-contract/contracts/Crowdfunding.sol`；`smart-contract/test/Crowdfunding.ts`；按需修改 `smart-contract/ignition/modules/Crowdfunding.ts`；生成 ABI；`frontend/src/services/crowdfunding.js`；`frontend/src/pages/{CreateCampaign,CampaignDetail}.jsx`；**NEW** `frontend/src/components/MilestoneVoting.jsx`；**NEW** `smart-contract/test/MilestoneVoting.ts` | 设计托管/已释放余额；**NEW** 建议函数 `requestMilestoneRelease`、`voteMilestone`、`executeMilestoneRelease` 与事件；替换该版本一次性 `withdraw` 规则；先明确捐款权重快照、法定投票比例、期限、拒绝/超时与剩余资金退款规则 | P0 完成；新 ABI/合约/部署及独立数据；决定创建者捐款是否有投票权；无自动迁移 | 测试证明合资格单次投票、快照权重、无提前/重复释放、转出不超过托管额，以及明确的拒绝/超时/退款行为；评审后完成双钱包 Sepolia 演示 |

里程碑释放与提现投票应统一设计，因为都影响托管资金和退款。DAO 代币、NFT、代理升级与完整索引服务应在必要演示完成后再考虑。

## 小组开发与协作指南

| 角色（约五人）        | 主要负责文件                                                                                                                                            | 跨角色协作                                                        |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| 1. 智能合约开发       | `smart-contract/contracts/Crowdfunding.sol`                                                                                                             | 与测试、Web3 确认生命周期、记账、函数签名与事件                   |
| 2. 合约测试与安全     | `smart-contract/test/Crowdfunding.ts`、NEW 辅助合约/测试与手工验证证据                                                                                  | 评审资金转出，与 Web3 共同验证 Sepolia                            |
| 3. 部署与 Web3 集成   | `smart-contract/hardhat.config.ts`、`ignition/`、`deployments/`、`scripts/export-abi.mjs`；前端 `services/`、`config/`、`hooks/useWallet.js` 与生成 ABI | 维护源码/ABI/地址对应关系，向页面提供 service 与状态，统筹部署    |
| 4. 前端页面与数据集成 | `frontend/src/pages/`、`hooks/useCampaigns.js`、`App.jsx`                                                                                               | 调用共享 service，与 UI、Web3 约定路由、props 与状态              |
| 5. UI 组件与用户体验  | `frontend/src/components/`、`styles.css`                                                                                                                | 与页面约定 props，签名逻辑保留在 hooks/services，协调 Navbar 修改 |

**接口变更流程：Solidity 修改 → 测试 → 编译 → ABI 导出 → Sepolia 部署 → 合约地址更新 → 前端集成。**

合约与测试负责人先确认规则，Web3 负责人提供匹配的 ABI 与部署证据。页面/UI 可按约定接口开发，但不能将新 ABI 与旧地址混用。协作 PR 应包含合约、测试、生成 ABI 及受影响的 service/页面；评审后再进行部署与地址切换。保留旧版本记录，并按合约地址区分项目。已部署的普通合约无法原地修改，新部署不会继承旧状态或资金。

从 `main` 创建功能分支，例如 `feat/campaign-search`、`fix/transaction-feedback`、`test/payout-security`。先拉取最新修改，保持提交范围清晰，在 PR 中说明行为、截图或不含敏感信息的证据、验证结果与部署影响。邀请受影响模块负责人评审；资金或接口变更需合约、测试与 Web3 共同评审。协调 App、Navbar、配置与 package 文件的修改；依赖变更同步提交 lockfile。

前端合并前，在 `frontend/` 执行 `npm run build` 并验证受影响浏览器流程。合约修改后，在 `smart-contract/` 执行 `npm run compile`、`npm test`、`npm run export:abi` 并检查 ABI 差异。当前没有前端自动化测试脚本。仅文档 PR 应核对路径、命令和记录，无需发送交易或部署。

## 配置与 Git 安全

- `frontend/.env` 只能包含公开配置：Vite 会将 `VITE_*` 写入浏览器构建产物。禁止放入私钥、助记词、带认证信息的 RPC URL 或部署凭据。
- `smart-contract/.env` 保持私有，仅提交空白/示例模板，不要输出真实值。
- `.gitignore` 排除 `.env`、依赖、生成的构建/编译产物、日志与 Ignition 部署日志；两个 npm lockfile 和生成的前端 ABI 应提交。
- 公开记录仅含公开标识与证据；未知哈希、区块、commit 和 deployment ID 保留为 `null`。泄露凭据需撤销或更换，删除文件不能清除 Git 历史。哈哈哈哈哈哈
