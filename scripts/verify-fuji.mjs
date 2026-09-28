import fs from 'node:fs';
import assert from 'node:assert/strict';
import { Contract, JsonRpcProvider } from 'ethers';
import { guardAbi, demoTokenAbi } from '../lib/generated/contracts.ts';
import { matchPayment } from '../lib/settlement.ts';
const report = JSON.parse(
  fs.readFileSync('public/evidence/procurement-fuji.json', 'utf8'),
);
const provider = new JsonRpcProvider(
  'https://api.avax-test.network/ext/bc/C/rpc',
  undefined,
  { cacheTimeout: -1 },
);
try {
  assert.equal((await provider.getNetwork()).chainId, 43113n);
  assert.equal(report.chainId, 43113);
  const vault = new Contract(report.guard, guardAbi, provider);
  const token = new Contract(report.token, demoTokenAbi, provider);
  assert.equal((await vault.token()).toLowerCase(), report.token.toLowerCase());
  const m = await vault.missions(report.missionId);
  assert.equal(m.owner, report.owner);
  assert.equal(m.specHash, report.taskId);
  assert.equal(m.budget, 10000000n);
  assert.equal(m.spent, 2000000n);
  assert.equal(m.withdrawn, 8000000n);
  assert.equal(m.revoked, true);
  const receipts = await Promise.all(
    report.transactions.map(async (tx) => {
      const r = await provider.getTransactionReceipt(tx.hash);
      assert.ok(r, `Missing receipt: ${tx.label}`);
      assert.equal(r.status, 1);
      assert.equal(r.from.toLowerCase(), report.owner.toLowerCase());
      assert.equal(
        r.to.toLowerCase(),
        ['mint', 'approve'].includes(tx.label)
          ? report.token.toLowerCase()
          : report.guard.toLowerCase(),
      );
      const block = await provider.getBlock(r.blockNumber);
      assert.equal(r.blockHash, block.hash);
      if (['payActivity', 'payVerification'].includes(tx.label))
        matchPayment(
          { status: 'success', logs: r.logs },
          {
            taskId: report.taskId,
            service: tx.label === 'payActivity' ? 'activity' : 'verify',
            guard: report.guard,
            missionId: report.missionId,
            recipient: report.owner,
          },
        );
      return {
        label: tx.label,
        hash: tx.hash,
        blockNumber: r.blockNumber,
        blockHash: r.blockHash,
      };
    }),
  );
  const result = {
    verifiedAt: new Date().toISOString(),
    chainId: 43113,
    passed: true,
    mode: 'read-only-receipt-recheck',
    missionId: report.missionId,
    guard: report.guard,
    receipts,
    spent: '2',
    refunded: '8',
    currentVaultTokenBalance: String(await token.balanceOf(report.guard)),
  };
  fs.mkdirSync('output', { recursive: true });
  fs.writeFileSync(
    'output/fuji-receipt-recheck.json',
    JSON.stringify(result, null, 2) + '\n',
  );
  console.log(
    JSON.stringify({
      passed: true,
      confirmedReceipts: receipts.length,
      missionId: report.missionId,
      spent: '2',
      refunded: '8',
    }),
  );
} finally {
  provider.destroy();
}
