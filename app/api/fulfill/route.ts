import {
  createPublicClient,
  http,
  isAddress,
  type Address,
  type Hex,
} from 'viem';
import { avalancheFuji } from 'viem/chains';
import manifest from '@/public/evidence/fuji-deployment.json';
import { guardAbi } from '@/lib/generated/contracts';
import { matchPayment } from '@/lib/settlement';
import {
  orderId,
  services,
  networks,
  type Service,
  type ServiceReceipt,
} from '@/lib/procurement';
import { apiError, bucket, loadBrief, smallBody } from '@/lib/task-store';

const client = createPublicClient({
  chain: avalancheFuji,
  transport: http(networks[43113].rpc, { timeout: 15000, retryCount: 1 }),
});
export async function POST(request: Request) {
  try {
    const body = (await smallBody(request)) as {
      taskId: Hex;
      service: Service;
      guard: Address;
      missionId: string;
      transactionHash?: Hex;
    };
    const deployment = manifest as {
      status: string;
      guard?: Address;
      deployer?: Address;
    };
    if (
      deployment.status !== 'deployed' ||
      !deployment.guard ||
      !deployment.deployer
    )
      throw Error(
        '项目 Fuji 金库尚未部署；数据报告仍可免费使用。 / Project Fuji vault not deployed; free research remains available.',
      );
    if (
      !isAddress(body.guard) ||
      body.guard.toLowerCase() !== deployment.guard.toLowerCase()
    )
      throw Error(
        'Only the published project vault can settle service orders.',
      );
    const requestId = orderId(
      body.taskId,
      body.service,
      body.guard,
      body.missionId,
    );
    const brief = await loadBrief(body.taskId);
    const saved = await bucket().get(`receipts/${requestId}.json`);
    if (saved) return Response.json(await saved.json());
    if ((await client.getChainId()) !== 43113)
      throw Error('Settlement chain mismatch');
    const mission = await client.readContract({
      address: body.guard,
      abi: guardAbi,
      functionName: 'missions',
      args: [BigInt(body.missionId)],
    });
    if (mission[7] !== brief.id)
      throw Error(
        'Mission is bound to another task. Create a mission for this report.',
      );
    let hash = body.transactionHash;
    if (!hash) {
      const latest = await client.getBlockNumber();
      const logs = await client.getContractEvents({
        address: body.guard,
        abi: guardAbi,
        eventName: 'PaymentExecuted',
        args: { missionId: BigInt(body.missionId), requestId },
        fromBlock: latest > 2000n ? latest - 2000n : 0n,
        toBlock: latest,
      });
      hash = logs[0]?.transactionHash ?? undefined;
    }
    if (!hash || !/^0x[0-9a-f]{64}$/i.test(hash))
      return Response.json(
        {
          error:
            '尚未找到付款；若已付款，请粘贴交易哈希恢复，不要再次付款。 / No payment found. If already paid, recover using its transaction hash.',
        },
        { status: 409 },
      );
    const receipt = await client.getTransactionReceipt({ hash });
    matchPayment(receipt, { ...body, recipient: deployment.deployer });
    const result: ServiceReceipt = {
      taskId: brief.id,
      service: body.service,
      requestId,
      guard: body.guard,
      missionId: body.missionId,
      transactionHash: hash,
      blockNumber: String(receipt.blockNumber),
      recipient: deployment.deployer,
      amount: services[body.service].units,
      status: 'delivered',
      artifactHash: brief.dataHash,
      explorer: `${networks[43113].explorer}/tx/${hash}`,
    };
    await bucket().put(`receipts/${requestId}.json`, JSON.stringify(result), {
      onlyIf: { etagDoesNotMatch: '*' },
      httpMetadata: { contentType: 'application/json' },
    });
    return Response.json(result);
  } catch (e) {
    return apiError(e);
  }
}
