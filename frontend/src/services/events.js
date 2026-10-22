// Complete, bounded queries: shrink ranges on RPC errors, never return partial success.
export async function queryEventRanges(contract, filter, fromBlock, toBlock, signal, chunkSize = 2000) {
  const logs = [];
  let from = fromBlock;
  let size = chunkSize;
  while (from <= toBlock) {
    signal?.throwIfAborted();
    const to = Math.min(from + size - 1, toBlock);
    try {
      const batch = await contract.queryFilter(filter, from, to);
      signal?.throwIfAborted();
      logs.push(...batch);
      from = to + 1;
    } catch (error) {
      signal?.throwIfAborted();
      if (size === 1) throw error;
      size = Math.max(1, Math.floor(size / 2));
    }
  }
  return [...new Map(logs.map(log => [`${log.transactionHash}:${log.index ?? log.logIndex ?? 0}`, log])).values()]
    .sort((a, b) => a.blockNumber - b.blockNumber || (a.transactionIndex ?? 0) - (b.transactionIndex ?? 0) || (a.index ?? a.logIndex ?? 0) - (b.index ?? b.logIndex ?? 0));
}
