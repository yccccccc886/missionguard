import {
  BaseError,
  ContractFunctionRevertedError,
  type Address,
  type Hex,
} from 'viem';
export const paymentTypes = {
  Payment: [
    { name: 'missionId', type: 'uint256' },
    { name: 'grantId', type: 'uint256' },
    { name: 'recipient', type: 'address' },
    { name: 'amount', type: 'uint256' },
    { name: 'requestId', type: 'bytes32' },
    { name: 'deadline', type: 'uint64' },
    { name: 'epoch', type: 'uint64' },
  ],
} as const;
export type Payment = {
  missionId: bigint;
  grantId: bigint;
  recipient: Address;
  amount: bigint;
  requestId: Hex;
  deadline: bigint;
  epoch: bigint;
};
export function paymentData(
  verifyingContract: Address,
  chainId: number,
  message: Payment,
) {
  return {
    domain: { name: 'MissionGuard', version: '1', chainId, verifyingContract },
    types: paymentTypes,
    primaryType: 'Payment' as const,
    message,
  };
}
export function readableError(error: unknown): string {
  if (error instanceof BaseError) {
    const cause = error.walk((e) => e instanceof ContractFunctionRevertedError);
    if (cause instanceof ContractFunctionRevertedError && cause.data?.errorName)
      return cause.data.errorName;
  }
  const e = error as { shortMessage?: string; message?: string };
  const s = e.shortMessage ?? e.message ?? String(error);
  if (/user rejected|user denied|userrejectedrequesterror/i.test(s))
    return '操作未签名 / Request rejected in wallet';
  return s.slice(0, 450);
}
