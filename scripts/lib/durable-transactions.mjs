import assert from 'node:assert/strict';
import { Transaction, keccak256, parseEther } from 'ethers';

// Persist the exact signed bytes BEFORE sending. Recovery can only rebroadcast
// those bytes, so a lost RPC response cannot create a second transaction.
export function durableTransactions({
  wallet,
  chainId,
  journal,
  save,
  afterConfirm,
}) {
  const provider = wallet.provider;
  const ceiling = parseEther('0.05');
  return async function transact(label, request) {
    assert.equal((await provider.getNetwork()).chainId, BigInt(chainId));
    const to = String(request.to).toLowerCase();
    const data = request.data ?? '0x';
    assert.equal(
      BigInt(request.value ?? 0),
      0n,
      'Native token transfers are disabled',
    );
    let entry = journal[label];
    if (!entry) {
      const prepared = await wallet.populateTransaction({
        ...request,
        value: 0,
      });
      assert.equal(prepared.chainId, BigInt(chainId));
      assert.ok(
        prepared.gasLimit * (prepared.maxFeePerGas ?? prepared.gasPrice) <=
          ceiling,
        'Per-transaction test gas ceiling exceeded',
      );
      const raw = await wallet.signTransaction(prepared);
      entry = { raw, hash: keccak256(raw) };
      journal[label] = entry;
      await save();
    }
    const signed = Transaction.from(entry.raw);
    assert.equal(signed.hash, entry.hash, 'Journal hash mismatch');
    assert.equal(signed.chainId, BigInt(chainId), 'Journal chain mismatch');
    assert.equal(signed.from.toLowerCase(), wallet.address.toLowerCase());
    assert.equal(signed.to?.toLowerCase(), to, 'Journal target mismatch');
    assert.equal(
      signed.data,
      data,
      'Journal calldata changed; refuse a new transaction',
    );
    assert.equal(signed.value, 0n);
    let receipt = await provider.getTransactionReceipt(entry.hash);
    if (!receipt) {
      const pending = await provider.getTransaction(entry.hash);
      if (!pending) {
        const nonce = await provider.getTransactionCount(
          wallet.address,
          'latest',
        );
        assert.ok(
          nonce <= signed.nonce,
          'Nonce consumed by another transaction; inspect before resuming',
        );
        try {
          await provider.broadcastTransaction(entry.raw);
        } catch {
          receipt = await provider.getTransactionReceipt(entry.hash);
          if (!receipt && !(await provider.getTransaction(entry.hash)))
            throw Error(
              `Broadcast unconfirmed for ${label}. Resume with the same journal; do not delete it.`,
            );
        }
      }
      receipt ??= await provider.waitForTransaction(entry.hash, 1, 45000);
    }
    assert.ok(receipt, `Still pending: ${entry.hash}`);
    assert.equal(
      receipt.status,
      1,
      `${label} reverted; inspect receipt before continuing`,
    );
    entry.confirmed = true;
    await save();
    await afterConfirm?.(label, receipt);
    return receipt;
  };
}
