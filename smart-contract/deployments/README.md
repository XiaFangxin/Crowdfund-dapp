# 部署交接说明

本项目骨架尚未执行 Sepolia 部署。

团队完成评审并部署后，添加可公开提交的 `sepolia.json`，记录链 ID（`11155111`）、真实合约地址、交易哈希、部署区块以及对应源码的 Git commit。不要包含私钥或带有认证信息的 RPC URL。

Ignition 会在 `ignition/deployments/chain-11155111/` 中维护自己的部署日志。请在本地保留该日志，以便继续部署，不要手动修改。仓库已通过 `.gitignore` 忽略这些生成的日志。

部署与 ABI 导出命令请参考根目录的 [README](../../README.md)。
