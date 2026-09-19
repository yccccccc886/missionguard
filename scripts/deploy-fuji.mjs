// Fuji only. Resume partial deployments by reading the public manifest.
import fs from 'node:fs';
import {
  JsonRpcProvider,
  Wallet,
  NonceManager,
  ContractFactory,
  formatEther,
} from 'ethers';
import { compile } from './compile.mjs';
const rpc = 'https://api.avax-test.network/ext/bc/C/rpc';
const provider = new JsonRpcProvider(rpc);
if ((await provider.getNetwork()).chainId !== 43113n)
  throw Error('Refusing deployment outside Avalanche Fuji');
const secretPath = '.secrets/fuji-deployer.json';
if (!fs.existsSync(secretPath))
  throw Error(
    'Use the browser wallet deployment, or create a disposable Fuji-only key locally. Never commit signing material.',
  );
const secret = JSON.parse(fs.readFileSync(secretPath, 'utf8'));
const wallet = new Wallet(secret.privateKey, provider);
const signer = new NonceManager(wallet);
const balance = await provider.getBalance(wallet.address);
console.log(
  'Fuji deployer: ' + wallet.address + ' | test AVAX: ' + formatEther(balance),
);
if (balance === 0n)
  throw Error(
    'No test AVAX. Get free Fuji AVAX before deployment. Never fund with mainnet assets.',
  );
compile();
const file = 'public/evidence/fuji-deployment.json';
let manifest = fs.existsSync(file)
  ? JSON.parse(fs.readFileSync(file, 'utf8'))
  : {};
if (
  manifest.deployer &&
  manifest.deployer.toLowerCase() !== wallet.address.toLowerCase()
)
  throw Error('Manifest belongs to a different deployer');
manifest = {
  ...manifest,
  chainId: 43113,
  deployer: wallet.address,
  status: 'partial',
  rpc,
  updatedAt: new Date().toISOString(),
};
delete manifest.reason;
const save = () =>
  fs.writeFileSync(file, JSON.stringify(manifest, null, 2) + '\n');
async function deploy(name, key, args = []) {
  if (manifest[key]) {
    if ((await provider.getCode(manifest[key])) === '0x')
      throw Error('Manifest contract not found; inspect before retrying');
    return manifest[key];
  }
  const a = JSON.parse(fs.readFileSync(`contracts/artifacts/${name}.json`));
  const c = await new ContractFactory(a.abi, a.bytecode, signer).deploy(
    ...args,
  );
  manifest[key + 'Transaction'] = c.deploymentTransaction().hash;
  save();
  const receipt = await c.deploymentTransaction().wait();
  if (receipt.status !== 1) throw Error('Deployment reverted');
  manifest[key] = await c.getAddress();
  save();
  console.log(name + ': ' + manifest[key]);
  return manifest[key];
}
// A sent transaction without a recorded address must be reconciled, never blindly sent twice.
for (const key of ['token', 'guard'])
  if (manifest[key + 'Transaction'] && !manifest[key]) {
    const r = await provider.getTransactionReceipt(
      manifest[key + 'Transaction'],
    );
    if (!r)
      throw Error('Previous deployment pending. Retry after confirmation.');
    if (r.status !== 1 || !r.contractAddress)
      throw Error('Previous deployment failed; inspect transaction first');
    manifest[key] = r.contractAddress;
    save();
  }
await deploy('DemoUSD', 'token');
await deploy('MissionGuard', 'guard', [manifest.token]);
manifest.status = 'deployed';
manifest.updatedAt = new Date().toISOString();
manifest.asset = 'DemoUSD (freely mintable test token, not Circle USDC)';
save();
console.log(
  'Deployment confirmed. Use the website to create your own test mission.',
);
