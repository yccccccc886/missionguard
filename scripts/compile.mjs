import fs from 'node:fs';
import path from 'node:path';
import solc from 'solc';
export function compile() {
  const sources = {};
  for (const file of [
    'MissionGuard.sol',
    'DemoUSD.sol',
    ...fs
      .readdirSync('contracts/test')
      .filter((x) => x.endsWith('.sol'))
      .map((x) => 'test/' + x),
  ])
    sources[file] = { content: fs.readFileSync('contracts/' + file, 'utf8') };
  const input = {
    language: 'Solidity',
    sources,
    settings: {
      optimizer: { enabled: true, runs: 200 },
      evmVersion: 'cancun',
      outputSelection: {
        '*': {
          '*': ['abi', 'evm.bytecode.object', 'evm.deployedBytecode.object'],
        },
      },
    },
  };
  const output = JSON.parse(
    solc.compile(JSON.stringify(input), {
      import: (name) => {
        try {
          return {
            contents: fs.readFileSync(path.join('node_modules', name), 'utf8'),
          };
        } catch {
          return { error: 'Import unavailable: ' + name };
        }
      },
    }),
  );
  for (const error of output.errors ?? []) {
    if (error.severity === 'error') throw new Error(error.formattedMessage);
  }
  fs.mkdirSync('contracts/artifacts', { recursive: true });
  for (const [file, contracts] of Object.entries(output.contracts))
    for (const [name, c] of Object.entries(contracts))
      if (sources[file])
        fs.writeFileSync(
          'contracts/artifacts/' + name + '.json',
          JSON.stringify(
            {
              contractName: name,
              compiler: solc.version(),
              abi: c.abi,
              bytecode: '0x' + c.evm.bytecode.object,
              deployedBytecode: '0x' + c.evm.deployedBytecode.object,
            },
            null,
            2,
          ),
        );
  const guard = output.contracts['MissionGuard.sol'].MissionGuard;
  const token = output.contracts['DemoUSD.sol'].DemoUSD;
  fs.mkdirSync('lib/generated', { recursive: true });
  fs.writeFileSync(
    'lib/generated/contracts.ts',
    '// Generated from Solidity sources by scripts/compile.mjs.\nexport const guardAbi = ' +
      JSON.stringify(guard.abi) +
      ' as const;\nexport const demoTokenAbi = ' +
      JSON.stringify(token.abi) +
      ' as const;\nexport const guardBytecode = "0x' +
      guard.evm.bytecode.object +
      '" as const;\nexport const demoTokenBytecode = "0x' +
      token.evm.bytecode.object +
      '" as const;\n',
  );
  return output;
}
if (process.argv[1]?.endsWith('compile.mjs')) {
  compile();
  console.log('Compiled MissionGuard and DemoUSD with ' + solc.version());
}
