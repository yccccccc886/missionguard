// Local configuration only. Never prints or uploads the API key.
import fs from 'node:fs';
import readline from 'node:readline/promises';
if (!process.stdin.isTTY)
  throw Error('Run this command in an interactive terminal.');
if (fs.existsSync('.dev.vars'))
  throw Error(
    '.dev.vars already exists. Edit it locally; this helper will not overwrite existing secrets.',
  );
const prompt = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});
const model = (
  await prompt.question(
    'SiliconFlow model ID (copy a model marked FREE in your console): ',
  )
).trim();
if (!/^[A-Za-z0-9._/-]{2,120}$/.test(model)) {
  prompt.close();
  throw Error('Invalid model ID');
}
const confirmed = await prompt.question(
  'Have you checked this model is FREE on your account? Type FREE to continue: ',
);
prompt.close();
if (confirmed !== 'FREE')
  throw Error('Configuration cancelled. No model calls enabled.');
process.stdout.write('API key (hidden): ');
const key = await new Promise((resolve, reject) => {
  let value = '';
  process.stdin.setRawMode(true);
  process.stdin.resume();
  process.stdin.setEncoding('utf8');
  const cleanup = () => {
    process.stdin.setRawMode(false);
    process.stdin.off('data', onData);
    process.stdin.pause();
    process.stdout.write('\n');
  };
  const onData = (chunk) => {
    for (const char of chunk) {
      if (char === '\u0003') {
        cleanup();
        reject(Error('Cancelled'));
        return;
      }
      if (char === '\r' || char === '\n') {
        cleanup();
        resolve(value);
        return;
      }
      if (char === '\u007f' || char === '\b') value = value.slice(0, -1);
      else if (char.charCodeAt(0) >= 32) value += char;
    }
  };
  process.stdin.on('data', onData);
});
if (!/^[A-Za-z0-9_-]{20,300}$/.test(key))
  throw Error('Unexpected key format. Nothing saved.');
fs.writeFileSync(
  '.dev.vars',
  `LLM_ENABLED="true"\nSILICONFLOW_MODEL=${JSON.stringify(model)}\nSILICONFLOW_API_KEY=${JSON.stringify(key)}\n`,
  { flag: 'wx', mode: 0o600 },
);
console.log(
  'Saved locally. Restart the preview. Hosted configuration must be set separately as a Site secret.',
);
