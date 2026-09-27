// Uses real contracts on a LOCAL EVM. Never labels local receipts as Fuji.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import { network } from 'hardhat';
import { compile } from './compile.mjs';
import {
  orderId,
  services,
  type Brief,
  type Service,
} from '../lib/procurement';
import { matchPayment } from '../lib/settlement';
import { paymentTypes } from '../lib/guard-sdk';
import type { Address, Hex } from 'viem';

compile();
const connection = await network.create('hardhat');
const { ethers } = connection;
const [owner, research, data, verification, merchant] =
  await ethers.getSigners();
const brief = JSON.parse(
  fs.readFileSync('public/evidence/research-example.json', 'utf8'),
) as Brief;
async function deploy(name: string, args: unknown[] = []) {
  const artifact = JSON.parse(
    fs.readFileSync(`contracts/artifacts/${name}.json`, 'utf8'),
  );
  const contract = await new ethers.ContractFactory(
    artifact.abi,
    artifact.bytecode,
    owner,
  ).deploy(...args);
  await contract.waitForDeployment();
  return new ethers.Contract(await contract.getAddress(), artifact.abi, owner);
}
const token = await deploy('DemoUSD');
const vault = await deploy('MissionGuard', [await token.getAddress()]);
const guard = (await vault.getAddress()) as Address;
const expiry = (await ethers.provider.getBlock('latest'))!.timestamp + 3600;
const steps: { label: string; status: string; hash?: string; code?: string }[] =
  [];
const confirm = async (
  label: string,
  tx: Promise<{ wait(): Promise<{ hash: string } | null> }>,
) => {
  const receipt = await (await tx).wait();
  if (!receipt) throw Error('Missing receipt');
  steps.push({ label, status: 'local-confirmed', hash: receipt.hash });
};
await confirm('Mint 10 DemoUSD', token.mint(owner.address, 10000000n));
await confirm('Approve mission', token.approve(guard, 10000000n));
await confirm(
  'Bind report to mission',
  vault.createMission(10000000n, expiry, brief.id),
);
await confirm(
  'Allow demo service',
  vault.setMerchant(1, merchant.address, true),
);
await confirm(
  'Research root',
  vault.createGrant(1, 0, research.address, 8000000n, 2000000n, expiry),
);
await confirm(
  'Data child',
  vault.createGrant(1, 1, data.address, 3000000n, 2000000n, expiry),
);
await confirm(
  'Independent verification root',
  vault.createGrant(1, 0, verification.address, 2000000n, 2000000n, expiry),
);
const sign = async (service: Service, requestOverride?: Hex) => {
  const index = services[service].agentIndex;
  const payment = {
    missionId: 1n,
    grantId: BigInt(index + 1),
    recipient: merchant.address,
    amount: BigInt(services[service].units),
    requestId: requestOverride ?? orderId(brief.id, service, guard, '1'),
    deadline: BigInt(expiry),
    epoch: (await vault.missions(1)).epoch,
  };
  const signer = service === 'activity' ? data : verification;
  const signature = await signer.signTypedData(
    {
      name: 'MissionGuard',
      version: '1',
      chainId: 31337,
      verifyingContract: guard,
    },
    { Payment: [...paymentTypes.Payment] },
    payment,
  );
  return { payment, signature };
};
const activity = await sign('activity');
const activityReceipt = await (
  await vault.executePayment(activity.payment, activity.signature)
).wait();
assert.equal(
  matchPayment(
    {
      status: activityReceipt.status === 1 ? 'success' : 'reverted',
      logs: activityReceipt.logs,
    },
    {
      taskId: brief.id,
      service: 'activity',
      guard,
      missionId: '1',
      recipient: merchant.address as Address,
    },
  ),
  activity.payment.requestId,
);
steps.push({
  label: 'Data order delivered and receipt matched',
  status: 'local-confirmed',
  hash: activityReceipt.hash,
});
async function rejected(
  label: string,
  expected: string,
  call: () => Promise<unknown>,
) {
  try {
    await call();
    assert.fail('Expected policy rejection');
  } catch (e) {
    const code = vault.interface.parseError((e as { data: string }).data)?.name;
    assert.equal(code, expected);
    steps.push({ label, status: 'local-simulation-rejected', code });
  }
}
await rejected('Same order cannot charge twice', 'RequestAlreadyUsed', () =>
  vault.executePayment.staticCall(activity.payment, activity.signature),
);
await confirm('Stop research branch', vault.revokeGrant(1));
const stopped = await sign('activity', ethers.id('new-child-order') as Hex);
await rejected('Descendant loses authority', 'GrantInactive', () =>
  vault.executePayment.staticCall(stopped.payment, stopped.signature),
);
const verify = await sign('verify');
await confirm(
  'Independent verification still pays',
  vault.executePayment(verify.payment, verify.signature),
);
await confirm('Close mission', vault.revokeMission(1));
await confirm('Recover unused 8 DemoUSD', vault.withdrawRemainder(1));
const mission = await vault.missions(1);
assert.equal(mission.specHash, brief.id);
assert.equal(mission.spent, 2000000n);
assert.equal(mission.withdrawn, 8000000n);
assert.equal(await token.balanceOf(guard), 0n);
const report = {
  environment: 'Local Hardhat EVM — NOT Avalanche Fuji',
  chainId: 31337,
  generatedAt: new Date().toISOString(),
  taskId: brief.id,
  dataChainId: brief.spec.chainId,
  execution: 'Scripted signers; real public data; no LLM',
  steps,
  budget: '10',
  spent: '2',
  recovered: '8',
  asset: 'DemoUSD (valueless)',
  passed: true,
};
fs.writeFileSync(
  'public/evidence/procurement-local.json',
  JSON.stringify(report, null, 2) + '\n',
);
console.log(
  JSON.stringify({
    passed: true,
    steps: steps.length,
    spent: report.spent,
    recovered: report.recovered,
    environment: report.environment,
  }),
);
await connection.close();
