import { decodeEventLog, type Address, type Hex } from 'viem';
import { guardAbi } from './generated/contracts';
import { orderId, services, type Service } from './procurement';

export function matchPayment(
  receipt: {
    status: string;
    logs: readonly { address: string; topics: readonly Hex[]; data: Hex }[];
  },
  order: {
    taskId: Hex;
    service: Service;
    guard: Address;
    missionId: string;
    recipient: Address;
  },
) {
  if (receipt.status !== 'success') throw Error('Payment has not succeeded.');
  const requestId = orderId(
    order.taskId,
    order.service,
    order.guard,
    order.missionId,
  );
  for (const log of receipt.logs) {
    if (log.address.toLowerCase() !== order.guard.toLowerCase()) continue;
    try {
      const event = decodeEventLog({
        abi: guardAbi,
        data: log.data,
        topics: log.topics as [Hex, ...Hex[]],
      });
      if (
        event.eventName === 'PaymentExecuted' &&
        event.args.requestId === requestId &&
        event.args.missionId === BigInt(order.missionId) &&
        event.args.amount === BigInt(services[order.service].units) &&
        event.args.recipient.toLowerCase() === order.recipient.toLowerCase()
      )
        return requestId;
    } catch {
      /* Other events do not constitute payment proof. */
    }
  }
  throw Error(
    'Receipt does not match this task, service, mission, amount and recipient.',
  );
}
