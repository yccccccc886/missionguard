import fs from 'node:fs';
import { requestNarrative } from '../lib/narrative';
import { taskId, type Brief } from '../lib/procurement';

// Read only the three settings written by model:configure. No shell evaluation,
// dotenv expansion, secret logging or implicit fallback to another provider.
async function main() {
  if (!fs.existsSync('.dev.vars')) {
    console.error(
      'Model is not configured. Run npm run model:configure first. No API call was made.',
    );
    process.exitCode = 2;
    return;
  }
  const config: Record<string, string> = {};
  for (const line of fs.readFileSync('.dev.vars', 'utf8').split(/\r?\n/)) {
    const match =
      /^(LLM_ENABLED|SILICONFLOW_MODEL|SILICONFLOW_API_KEY)=(.*)$/.exec(
        line.trim(),
      );
    if (match)
      config[match[1]] = match[2].startsWith('"')
        ? JSON.parse(match[2])
        : match[2];
  }
  if (
    config.LLM_ENABLED !== 'true' ||
    !config.SILICONFLOW_MODEL ||
    !config.SILICONFLOW_API_KEY
  )
    throw Error('Model settings are incomplete.');
  const brief = JSON.parse(
    fs.readFileSync('public/evidence/research-example.json', 'utf8'),
  ) as Brief;
  if (taskId(brief.spec) !== brief.id)
    throw Error('Recorded task identity mismatch.');
  const evidencePath = 'output/model-verification.json';
  if (fs.existsSync(evidencePath) && !process.argv.includes('--refresh')) {
    const saved = JSON.parse(fs.readFileSync(evidencePath, 'utf8'));
    if (
      saved.result?.taskId === brief.id &&
      saved.result?.model === config.SILICONFLOW_MODEL &&
      saved.liveCall === true
    ) {
      console.log(
        'Existing live model evidence retained. No new API call. Use --refresh explicitly to repeat.',
      );
      return;
    }
  }
  const result = await requestNarrative(brief, 'zh', {
    key: config.SILICONFLOW_API_KEY,
    model: config.SILICONFLOW_MODEL,
  });
  fs.mkdirSync('output', { recursive: true });
  fs.writeFileSync(
    evidencePath,
    JSON.stringify(
      {
        liveCall: true,
        checkedAt: new Date().toISOString(),
        result,
        reviewStatus: 'pending-human-factual-review',
        scope:
          'Direct provider call using the same adapter as the website; hosted authentication and UI not covered.',
      },
      null,
      2,
    ) + '\n',
  );
  console.log(
    JSON.stringify({
      liveCall: true,
      model: result.model,
      usage: result.usage,
      evidence: evidencePath,
      reviewStatus: 'pending-human-factual-review',
    }),
  );
}
main().catch(() => {
  // A configuration/parser/provider exception must never echo key-bearing text.
  console.error(
    'Model verification did not complete. Check the local configuration and provider availability; no successful evidence was created.',
  );
  process.exitCode = 1;
});
