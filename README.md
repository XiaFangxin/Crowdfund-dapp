# Crowdfund DApp

这是一个用于小组协作开发的众筹 DApp Demo 骨架，技术栈为 React + Vite、ethers.js v6、MetaMask、Solidity、Hardhat 3 和 Ethereum Sepolia。
使用 **Node.js 24.x / npm 11.x**。仓库包含两个独立的 npm 项目，根目录用于存放项目文档。

前端在未安装 MetaMask、未部署合约时也可以打开，并显示配置说明。合约可以在本地编译和测试，无需部署凭据。目前尚未执行 Sepolia 部署。

## 整体架构

```text
React pages -> services/crowdfunding.js -> ethers BrowserProvider
                                         -> MetaMask -> Sepolia Crowdfunding
React components -> hooks/useWallet.js -> MetaMask accounts/network events
Solidity -> Hardhat compile -> ABI export -> frontend/src/contracts/
Ignition -> future deployment -> real contract address -> frontend/.env
```

项目没有后端、数据库或索引服务。MetaMask 提供前端 RPC 连接并签署交易；前端不处理私钥。
`App.jsx` 负责页面导航，并创建一个共享的钱包 hook。Hash 导航支持 `#/campaign/0` 等直接链接，无需配置服务端路由。

## 目录结构与职责

```text
Crowdfund-dapp/
├── frontend/
│   ├── .env.example               # Public deployed address only
│   ├── vite.config.js             # Existing React plugin / JSX runtime
│   └── src/
│       ├── pages/                 # Home, CreateCampaign, CampaignDetail, MyCampaigns
│       ├── components/            # Navbar, ConnectWallet, CampaignList, ContractStatus
│       ├── hooks/                 # Wallet lifecycle and campaign loading
│       ├── services/              # ethers reads/writes, receipts, errors
│       ├── contracts/             # Generated Crowdfunding.json ABI
│       ├── config/                # Sepolia ID and address validation
│       ├── styles.css             # Minimal shared styling
│       ├── App.jsx                # Navigation and shared wallet state
│       └── main.jsx               # Existing React entry point
├── smart-contract/
│   ├── .env.example               # Private deployment configuration template
│   ├── contracts/Crowdfunding.sol # Campaign lifecycle and events
│   ├── test/Crowdfunding.ts       # ethers/Mocha tests on simulated network
│   ├── ignition/modules/         # Declarative deployment module
│   ├── deployments/              # Public deployment handoff documentation
│   ├── scripts/export-abi.mjs     # Copy compiled ABI to frontend
│   ├── hardhat.config.ts          # Hardhat 3 ESM configuration
│   └── tsconfig.json             # Contract tooling TypeScript configuration
└── .gitignore
```

前端目录职责：

- `pages/`：页面内容、表单和交易反馈。
- `components/`：导航栏、钱包连接、众筹列表和配置提示等可复用组件。
- `hooks/`：钱包生命周期、账户与网络状态，以及众筹数据加载。
- `services/`：统一封装 ethers 合约读写、交易回执和错误处理。
- `contracts/`：保存从合约编译产物导出的 ABI。
- `config/`：Sepolia 网络信息及合约地址校验。
- `styles.css`：基础共享样式。
- `App.jsx`：页面导航与共享钱包状态；`main.jsx`：React 入口。

合约目录职责：

- `contracts/`：Solidity 合约及事件定义。
- `test/`：在模拟网络上运行的 ethers/Mocha 测试。
- `ignition/modules/`：声明式部署模块。
- `deployments/`：可公开提交的部署交接说明与记录。
- `scripts/export-abi.mjs`：将编译后的 ABI 导出到前端。
- `hardhat.config.ts`：Hardhat 3 的 ESM 配置。
- `tsconfig.json`：合约开发工具的 TypeScript 配置。

## 前端安装与运行

```sh
git clone <your-repository-url>
cd Crowdfund-dapp/frontend
npm ci
npm run dev
```

打开 Vite 在终端中输出的本地地址。需要接入已部署合约时，在 `frontend/` 中将 `.env.example` 复制为 `.env`：使用 `cp .env.example .env`，或在 PowerShell 中使用 `Copy-Item .env.example .env`。

在部署组提供真实 Sepolia 合约地址之前，保持 `VITE_CROWDFUNDING_ADDRESS` 为空。修改 `.env` 后需要重启 Vite。

```sh
npm run build
npm run preview
```

构建和预览无需 MetaMask 或合约地址。地址为空、无效或为零地址时，前端会禁用合约操作并显示配置提示。地址格式有效但链上没有合约字节码时，会显示错误信息。

## 合约安装、编译与测试

从仓库根目录打开另一个终端，执行：

```sh
cd smart-contract
npm ci
npx hardhat compile
npx hardhat test
npm run export:abi
```

也可以使用 `npm run compile` 和 `npm test`。测试使用带有测试余额的内存 Hardhat 网络，并通过推进区块时间戳验证截止时间相关逻辑，不连接 Sepolia。

首次编译可能需要下载编译器文件，因此需要联网。Hardhat 配置、测试和 Ignition 模块使用 TypeScript，前端使用 JSX。

## 合约接口与 Demo 规则

众筹 ID 从 0 开始，`campaignCount()` 返回众筹数量。每个众筹包含 `creator`、`title`、`description`、`goal`、`deadline`、`amountRaised` 和 `withdrawn`。

合约中的金额单位为 wei，截止时间为 Unix 秒级时间戳。前端 service 使用 ethers 的 `parseEther` 转换 ETH 字符串，页面使用 `formatEther` 显示金额。不要使用浮点运算计算 ETH 金额。

| 接口 | 行为 |
| --- | --- |
| `createCampaign(title, description, goal, deadline)` | 标题非空、目标金额为正、截止时间在未来；返回新 ID |
| `getCampaign(id)` | 返回 `Campaign` 结构体；不存在的 ID 会回退交易 |
| `contribute(id)` payable | 仅可在截止时间之前捐入正数 ETH；重复捐款累计记录 |
| `contributions(id, address)` | 返回该贡献者的累计捐款；退款后清零 |
| `withdraw(id)` | 仅创建者可调用；截止时或截止后、目标达成、仅可提现一次；转出全部筹集金额 |
| `refund(id)` | 截止时或截止后、目标未达成；调用者领取自己的捐款退款，仅可领取一次 |

事件包括 `CampaignCreated`、`Contributed`、`Withdrawn` 和 `Refunded`，众筹 ID 与参与者地址使用索引字段。

捐款可以超过目标金额，创建者也可以捐款。`amountRaised` 表示历史筹集总额，提现或退款后保持不变，并非合约中剩余的托管余额。成功众筹不支持退款。

资金转出前先更新状态，并使用重入保护。测试展示了创建及事件、无效输入、捐款记账、截止时间、创建者提现权限、防止重复提现、失败众筹退款和防止重复退款。

## 后续部署到 Sepolia

部署由小组手动执行，请在团队完成合约评审后进行。

1. 使用专门的测试网账户，并准备 Sepolia 测试 ETH 支付部署 gas。
2. 在 `smart-contract/` 中将 `.env.example` 复制为 `.env`。将 `SEPOLIA_RPC_URL` 设置为 Sepolia 节点服务地址，将 `SEPOLIA_PRIVATE_KEY` 设置为部署账户以 `0x` 开头的私钥。dotenv 仅在合约工具中加载此文件。不要分享该文件，也不要使用持有主网资金的账户私钥。
3. 完成编译与测试后，手动执行：

   ```sh
   npx hardhat ignition deploy ignition/modules/Crowdfunding.ts --network sepolia
   ```

4. 确认 Sepolia 部署成功。在 `smart-contract/deployments/sepolia.json` 中记录可公开的部署信息：链 ID `11155111`、真实合约地址、交易哈希、部署区块和对应源码 commit，不包含敏感信息。
5. 保留 `ignition/deployments/chain-11155111/` 中 Ignition 生成的本地部署日志，以便继续部署。该目录被 Git 忽略；可公开的交接信息单独放在 `deployments/`。

Sepolia 配置变量采用延迟解析，因此编译和测试无需 `.env`，只有部署需要凭据。参考官方文档：[Hardhat 部署指南](https://hardhat.org/docs/guides/deployment)和 [ethers/Mocha 测试指南](https://hardhat.org/docs/guides/testing/using-ethers)。

## ABI 与合约地址交接

合约接口以 `smart-contract/contracts/Crowdfunding.sol` 为准。修改接口后，在 `smart-contract/` 中运行：

```sh
npx hardhat compile
npm run export:abi
```

脚本仅将 `artifacts/contracts/Crowdfunding.sol/Crowdfunding.json` 中的 ABI 复制到 `frontend/src/contracts/Crowdfunding.json`。

接口变更时，应同时提交生成的前端 ABI，不要在 service 代码中手工维护另一份 ABI。导出操作可以在部署前执行，不会生成或编造合约地址。

部署完成后，将 `frontend/.env` 中的 `VITE_CROWDFUNDING_ADDRESS` 设置为交接的真实地址，并重启 Vite。ABI 与地址必须对应 Sepolia 上同一版本的合约。合约源码变更后需要重新部署；仅导出新 ABI 不会更新链上的合约。

## MetaMask 使用方式

启用 MetaMask 扩展及 Sepolia 测试网络。点击 **Connect Wallet** 请求访问账户，必要时点击 **Switch to Sepolia** 切换网络。

账户切换、网络切换和断开连接事件会更新钱包状态。用户拒绝请求时，界面会显示提示。未安装扩展时，各页面仍可以打开并显示接入说明。

配置真实合约后：

- **Home**：读取众筹列表。
- **My Campaigns**：按创建者筛选当前账户的众筹。
- **Create Campaign**：提交创建众筹交易。
- **Campaign Detail**：支持捐款、提现和退款。

每次写入操作都会请求 MetaMask 签名，并等待交易回执。按钮可点击并不保证交易满足所有条件，最终以合约规则为准。截止时间到达后，请刷新页面以更新与时间相关的按钮状态。

## 配置与 Git 安全

- `frontend/.env` **只能包含公开配置**。Vite 会将 `VITE_*` 变量写入浏览器构建产物。不要在 `frontend/` 中放置私钥、助记词、包含认证信息的 RPC 地址或部署凭据。
- `smart-contract/.env` 保存私有部署配置。只提交留空的 `.env.example` 模板，不要在日志或截图中输出私钥。
- `.gitignore` 排除 `node_modules`、`dist`、`artifacts/cache/types`、Ignition 生成的部署日志、应用日志和 `.env` 文件。两个 npm 项目的 lockfile 都应提交。
- 本地构建和测试无需敏感信息。如果误提交了凭据，应撤销或更换凭据；仅删除文件不会清除 Git 历史中的内容。

## 小组职责与开发指南

| 角色 | 负责范围 | 协作方式 |
| --- | --- | --- |
| 1. 智能合约 | `contracts/`、众筹生命周期、接口与事件、资金记账 | 修改前与测试及集成负责人确认函数签名和规则 |
| 2. 合约测试 | `test/`、成功与回退用例、时间边界、资金隔离、对抗性测试 | 评审合约变更，在集成和部署前运行测试 |
| 3. 部署与 Web3 集成 | `hardhat.config.ts`、`ignition/`、`deployments/`、ABI 导出、前端 `services/`、`config/`、`useWallet.js` | 提供地址、链 ID、ABI 版本；与页面负责人协调钱包、网络和错误处理 |
| 4. 前端页面 | `pages/`、表单、导航、加载/空数据/错误状态、交易反馈 | 调用共享 service 函数，与 UI 负责人约定组件 props |
| 5. 前端组件与 UI | `components/`、`styles.css`、响应式布局、无障碍支持 | 构建复用组件，将签名和合约调用保留在 hooks/services 中 |

建议按以下顺序协作：

1. 合约与测试负责人共同确认生命周期规则，并提供经过测试的接口。
2. 集成负责人导出 ABI、对齐 service 函数签名、准备部署交接信息。部署需由团队决定；合约地址为空时，页面开发仍可继续。
3. 页面与 UI 负责人基于 service API 和约定的 props 开发。后续如需模拟数据，应明确标注，并与链上数据分开。
4. 部署后，集成与页面负责人通过 MetaMask 联调 `create -> contribute -> detail`、成功众筹提现和失败众筹退款流程。
5. 接口变更时，在同一个 PR 中包含合约、测试、生成的 ABI 和受影响的 service 修改，同时更新文档与部署交接信息。

Git 协作方式：从团队约定的主分支创建功能分支，例如 `feat/contract-refunds` 或 `feat/campaign-page`。保持每次提交范围清晰，创建 PR，并邀请受影响模块的负责人评审。

修改 App、配置或 package 文件前先与相关成员协调；增加依赖时提交 lockfile 变更。合并前运行前端 `npm run build`，以及合约 `npx hardhat compile` 和 `npx hardhat test`。经常拉取其他成员的修改，并与对应负责人共同解决冲突。不要提交 `node_modules` 或已填写的 `.env` 文件。

## Demo 状态与后续工作

已实现：合约生命周期、本地测试、部署模块（尚未执行）、ABI 导出、钱包连接、网络检测与切换，以及基础页面和 service 方法。

页面可以调用配置好的合约，但目前没有提供真实 Sepolia 地址，也不会显示虚构的众筹或余额。

仍处于 Demo 阶段的部分包括：基础 UI、无分页的全量众筹读取、仅按创建者筛选的 My Campaigns、基础交易反馈、尚无截止时间自动刷新、索引服务、后端或升级机制。

现有测试用于展示测试方式，不等同于安全审计。恶意接收者、重入场景测试和更全面的浏览器测试仍需后续补充。DAO、NFT、IPFS、milestone voting 以及完整生产应用不在本骨架范围内。
