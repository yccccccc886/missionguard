import fs from 'node:fs';
import assert from 'node:assert/strict';
import { network } from 'hardhat';
import { Wallet, ContractFactory, Contract, parseEther } from 'ethers';
import { procurementRun } from './lib/procurement-run.mjs';
import { durableTransactions } from './lib/durable-transactions.mjs';
import { compile } from './compile.mjs';

compile();
const connection = await network.create('hardhat');
try {
  const { ethers } = connection;
  const [funder] = await ethers.getSigners();
  const wallet = Wallet.createRandom().connect(ethers.provider);
  await (
    await funder.sendTransaction({ to: wallet.address, value: parseEther('2') })
  ).wait();
  async function deploy(name, args = []) {
    const artifact = JSON.parse(
      fs.readFileSync(`contracts/artifacts/${name}.json`, 'utf8'),
    );
    const deployed = await new ContractFactory(
      artifact.abi,
      artifact.bytecode,
      funder,
    ).deploy(...args);
    await deployed.waitForDeployment();
    return new Contract(await deployed.getAddress(), artifact.abi, wallet);
  }
  const token = await deploy('DemoUSD');
  const vault = await deploy('MissionGuard', [await token.getAddress()]);
  const brief = JSON.parse(
    fs.readFileSync('public/evidence/research-example.json', 'utf8'),
  );
  let persisted = '{}';
  let state = {};
  const save = () => {
    persisted = JSON.stringify(state);
  };
  const args = { wallet, token, vault, chainId: 31337, brief, save };
  await assert.rejects(
    () =>
      procurementRun({
        ...args,
        state,
        save() {
          save();
          if (state.journal?.mint)
            throw Error('Injected interruption before broadcast');
        },
      }),
    /Injected interruption before broadcast/,
  );
  assert.equal(
    await token.balanceOf(wallet.address),
    0n,
    'Persistence must precede broadcast',
  );
  const mintHash = state.journal.mint.hash;
  state = JSON.parse(persisted);
  await assert.rejects(
    () =>
      procurementRun({
        ...args,
        state,
        afterConfirm(label) {
          if (label === 'payActivity')
            throw Error('Injected interruption after confirmed payment');
        },
      }),
    /Injected interruption/,
  );
  const paidHash = state.journal.payActivity.hash;
  state = JSON.parse(persisted);
  const report = await procurementRun({ ...args, state });
  assert.equal(report.spent, '2');
  assert.equal(report.recovered, '8');
  assert.equal(state.journal.payActivity.hash, paidHash);
  assert.equal(
    state.journal.mint.hash,
    mintHash,
    'Resume signed a new mint transaction',
  );
  const nonce = await ethers.provider.getTransactionCount(wallet.address);
  await procurementRun({ ...args, state });
  assert.equal(
    await ethers.provider.getTransactionCount(wallet.address),
    nonce,
    'Completed retry sent another transaction',
  );
  assert.equal(
    await vault.missionCount(),
    1n,
    'Resume created another mission',
  );
  assert.equal(report.transactions.length, 12);
  assert.equal(report.probes.duplicateOrder.code, 'RequestAlreadyUsed');
  assert.equal(report.probes.revokedDescendant.code, 'GrantInactive');
  assert.ok(!JSON.stringify(report).includes('privateKey'));
  for (const key of state.keys)
    assert.ok(!JSON.stringify(report).includes(key));
  const replay = durableTransactions({
    wallet,
    chainId: 31337,
    journal: state.journal,
    save,
  });
  await assert.rejects(
    () => replay('mint', { to: token.target, data: '0x1234' }),
    /Journal calldata changed/,
  );
  console.log(
    JSON.stringify({
      passed: true,
      environment: 'LOCAL ONLY',
      checks: [
        'interruption before broadcast reuses persisted signed bytes',
        'interruption after payment resumes same transaction',
        '2 spent / 8 recovered',
        'repeat completed run broadcasts nothing',
        'one mission only',
        'public evidence excludes agent keys',
        'changed recovery request is rejected',
      ],
    }),
  );
} finally {
  await connection.close();
}
