# Fuji 部署与验收

项目使用 **Avalanche Fuji C-Chain，chain ID 43113**，只使用无价值的测试 AVAX 和 DemoUSD。

## 水龙头的两种地址

Builder Hub 水龙头给连接的钱包发币，不一定给项目部署地址发币。`0x…` 是 C-Chain 地址；右侧 P-Chain 要求 `P-fuji…`，不能把 `0x…` 地址粘贴进去。倒计时只是冷却状态，不证明目标地址已收到币。

本项目部署地址：`0x2848485539a48884Ae1035e1A4B88C1f552ed8CD`。

先在 Fuji RPC 或区块浏览器核对领取交易。如果测试币到了自己的钱包，可在 **Fuji 网络**向部署地址发送 0.2 测试 AVAX，并保留其余测试币做浏览器演示。无需购买主网 AVAX、跨链或索取他人私钥。

官方说明：[Core 地址与测试币](https://docs.avax.network/academy/avalanche-l1/avalanche-fundamentals/03-multi-chain-architecture-intro/06-setup-core)。

## 执行顺序

```sh
npm run demo:fuji
npm run deploy:fuji
npm run demo:fuji -- --execute
npm run submission:check
```

第一条仅查询余额和部署状态。第三条会在 Fuji 执行 12 笔测试交易：铸造 10 DemoUSD、授权、创建任务与三条授权、付款 1.5、撤销研究分支、独立分支付款 0.5、关闭并退回 8。另有两次只读模拟，分别要求精确返回 `RequestAlreadyUsed` 和 `GrantInactive`；不会把网络故障或模拟误标成确认交易。

任务绑定已收录的真实链数据简报。三个代理使用不同测试密钥；商户是项目自身部署地址。流程是脚本执行，不是自主模型采购，也不是商业付费。

## 中断恢复

私有日志 `.secrets/fuji-procurement-journal.json` 保存代理测试密钥、已签名交易和交易哈希，在广播前落盘。再次运行相同命令会核对并复用同一笔交易；已完整执行的任务不会再发送交易。不要删除日志或改换任务来解决超时。

并发执行由 `.secrets/fuji-procurement.lock` 阻止。进程异常退出留下锁时，应确认旧进程已停止并检查已发交易，再手动解除锁。脚本不会自动抢锁或替换交易。

授权有效期为初始化起 24 小时。若过期、交易被外部替换或合约状态被其他操作改变，停止完整验收，先核对该任务余额并由原任务所有者关闭/退款；不要强行开始第二笔扣款。单笔交易最大 Gas 预算限制为 0.05 测试 AVAX。

成功结果写到 `public/evidence/procurement-fuji.json`，仅包含公开地址、交易回执、模拟错误和结果统计，不包含密钥或可广播的原始交易。随后还需部署更新的网站，在浏览器中验证付款回执恢复；命令行验收不能代替浏览器验收。

本地故障注入验证：`npm run test:fuji-run`。它用相同流程在本地链测试广播前中断、付款后中断、重复运行和请求被篡改；不会产生 Fuji 成功证据。
