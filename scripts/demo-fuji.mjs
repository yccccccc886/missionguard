import fs from 'node:fs';
import assert from 'node:assert/strict';
import { JsonRpcProvider, Wallet, Contract, formatEther } from 'ethers';
import { procurementRun } from './lib/procurement-run.mjs';
import { guardAbi, demoTokenAbi } from '../lib/generated/contracts.ts';

const manifest = JSON.parse(
  fs.readFileSync('public/evidence/fuji-deployment.json', 'utf8'),
);
const provider = new JsonRpcProvider(
  'https://api.avax-test.network/ext/bc/C/rpc',
  undefined,
  { cacheTimeout: -1 },
);
try {
  assert.equal(
    (await provider.getNetwork()).chainId,
    43113n,
    'Only Fuji is allowed',
  );
  const balance = await provider.getBalance(manifest.deployer);
  console.log(
    JSON.stringify({
      chainId: 43113,
      deployer: manifest.deployer,
      testAvax: formatEther(balance),
      deployment: manifest.status,
      mode: process.argv.includes('--execute') ? 'execute' : 'read-only',
    }),
  );
  if (process.argv.includes('--execute')) {
    assert.equal(
      manifest.status,
      'deployed',
      'Run deploy:fuji after obtaining test AVAX',
    );
    assert.ok(balance > 0n, 'Free Fuji test AVAX required');
    for (const address of [manifest.guard, manifest.token])
      assert.notEqual(
        await provider.getCode(address),
        '0x',
        'Manifest contract missing',
      );
    const wallet = new Wallet(
      JSON.parse(fs.readFileSync('.secrets/fuji-deployer.json', 'utf8'))
        .privateKey,
      provider,
    );
    assert.equal(wallet.address.toLowerCase(), manifest.deployer.toLowerCase());
    const vault = new Contract(manifest.guard, guardAbi, wallet);
    const token = new Contract(manifest.token, demoTokenAbi, wallet);
    assert.equal(
      (await vault.token()).toLowerCase(),
      manifest.token.toLowerCase(),
      'Wrong settlement token',
    );
    assert.equal(await token.symbol(), 'DemoUSD');
    assert.equal(await token.decimals(), 6n);
    const statePath = '.secrets/fuji-procurement-journal.json';
    const lockPath = '.secrets/fuji-procurement.lock';
    // A leftover lock needs manual inspection after a crash. Never run two signers concurrently.
    const lock = fs.openSync(lockPath, 'wx', 0o600);
    try {
      const state = fs.existsSync(statePath)
        ? JSON.parse(fs.readFileSync(statePath, 'utf8'))
        : {};
      const save = () => {
        fs.writeFileSync(statePath + '.tmp', JSON.stringify(state, null, 2), {
          mode: 0o600,
        });
        fs.renameSync(statePath + '.tmp', statePath);
      };
      const brief = JSON.parse(
        fs.readFileSync('public/evidence/research-example.json', 'utf8'),
      );
      const report = await procurementRun({
        wallet,
        vault,
        token,
        chainId: 43113,
        brief,
        state,
        save,
      });
      fs.writeFileSync(
        'public/evidence/procurement-fuji.json',
        JSON.stringify(report, null, 2) + '\n',
      );
      console.log(
        JSON.stringify({
          passed: report.passed,
          missionId: report.missionId,
          spent: report.spent,
          recovered: report.recovered,
          confirmedTransactions: report.transactions.length,
        }),
      );
    } finally {
      fs.closeSync(lock);
      fs.unlinkSync(lockPath);
    }
  }
} catch (e) {
  // Never serialize provider requests or journal entries containing signed bytes.
  console.error(
    e instanceof assert.AssertionError
      ? e.message
      : 'Fuji run interrupted; preserve the private journal and inspect confirmed hashes before resuming.',
  );
  process.exitCode = 1;
} finally {
  provider.destroy();
}
