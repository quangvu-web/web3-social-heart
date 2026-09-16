import { createPublicClient, encodeFunctionData, formatUnits, http, parseEther, parseUnits, type Address } from 'viem';
import { bsc } from 'wagmi/chains';
import { TOKEN_META } from '@/config/tokens';
import {
  SWAP_CHAIN_ID,
  SWAP_QUOTE_TTL_MS,
  SWAP_SLIPPAGE_BPS_DEFAULT,
} from '@/config/swap';
import {
  FUN_TESTNET_NOTE,
  isTokenInImplementation,
  type SendToken,
} from '@/modules/wallet/services/sendAsset';


export type SwapToken = SendToken;

export type SwapStatus =
  | 'idle'
  | 'quoting'
  | 'awaiting_approval_signature'
  | 'approving'
  | 'awaiting_swap_signature'
  | 'submitting'
  | 'pending_confirm'
  | 'success'
  | 'failed';

type ZeroXIssues = {
  allowance?: {
    actual?: string;
    spender?: string;
  };
};

type ZeroXTransaction = {
  to: Address;
  data: `0x${string}`;
  value: string;
  gas?: string;
  gasPrice?: string;
};

type ZeroXResponse = {
  buyAmount: string;
  sellAmount: string;
  price?: string;
  minBuyAmount?: string;
  estimatedGas?: string;
  issues?: ZeroXIssues;
  transaction?: ZeroXTransaction;
};

export type SwapQuoteResult = {
  sellAmount: string;
  buyAmount: string;
  minReceived: string;
  estimatedGas: string | null;
  price: string | null;
  issues: ZeroXIssues | null;
  tx: ZeroXTransaction;
  allowanceTarget: Address | null;
  quotedAt: number;
  raw: unknown;
};

export type SwapTxData = {
  to: Address;
  data: `0x${string}`;
  value: bigint;
  chainId: number;
};

const NATIVE_TOKEN = '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee' as const;

const ERC20_APPROVAL_ABI = [
  {
    name: 'approve',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'spender', type: 'address' },
      { name: 'value', type: 'uint256' },
    ],
    outputs: [{ name: '', type: 'bool' }],
  },
  {
    name: 'allowance',
    type: 'function',
    stateMutability: 'view',
    inputs: [
      { name: 'owner', type: 'address' },
      { name: 'spender', type: 'address' },
    ],
    outputs: [{ name: '', type: 'uint256' }],
  },
] as const;

const PANCAKESWAP_ROUTER_V2 = '0x10ED43C718714eb63d5aA57B78B54704E256024E' as Address;
const WBNB_ADDRESS = '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c' as Address;
const BSC_RPC_URL = (typeof import.meta !== 'undefined' && (import.meta as { env?: Record<string, string> }).env?.VITE_BSC_RPC_URL) || 'https://bsc-dataseed.binance.org';
const bscPublicClient = createPublicClient({ chain: bsc, transport: http(BSC_RPC_URL) });

const PANCAKE_ROUTER_ABI = [
  {
    name: 'getAmountsOut',
    type: 'function',
    stateMutability: 'view',
    inputs: [
      { name: 'amountIn', type: 'uint256' },
      { name: 'path', type: 'address[]' },
    ],
    outputs: [{ name: 'amounts', type: 'uint256[]' }],
  },
  {
    name: 'swapExactETHForTokens',
    type: 'function',
    stateMutability: 'payable',
    inputs: [
      { name: 'amountOutMin', type: 'uint256' },
      { name: 'path', type: 'address[]' },
      { name: 'to', type: 'address' },
      { name: 'deadline', type: 'uint256' },
    ],
    outputs: [{ name: 'amounts', type: 'uint256[]' }],
  },
  {
    name: 'swapExactTokensForETH',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'amountIn', type: 'uint256' },
      { name: 'amountOutMin', type: 'uint256' },
      { name: 'path', type: 'address[]' },
      { name: 'to', type: 'address' },
      { name: 'deadline', type: 'uint256' },
    ],
    outputs: [{ name: 'amounts', type: 'uint256[]' }],
  },
  {
    name: 'swapExactTokensForTokens',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'amountIn', type: 'uint256' },
      { name: 'amountOutMin', type: 'uint256' },
      { name: 'path', type: 'address[]' },
      { name: 'to', type: 'address' },
      { name: 'deadline', type: 'uint256' },
    ],
    outputs: [{ name: 'amounts', type: 'uint256[]' }],
  },
] as const;

export function involvesCamly(sell: SwapToken, buy: SwapToken): boolean {
  return sell === 'CAMLY' || buy === 'CAMLY';
}

function buildPancakePath(sellToken: SwapToken, buyToken: SwapToken): Address[] {
  const sellAddr = sellToken === 'BNB' ? WBNB_ADDRESS : (mapTokenToZeroXAddress(sellToken) as Address);
  const buyAddr = buyToken === 'BNB' ? WBNB_ADDRESS : (mapTokenToZeroXAddress(buyToken) as Address);
  // Always route via WBNB for safety (handles cases with no direct pool)
  if (sellAddr === WBNB_ADDRESS || buyAddr === WBNB_ADDRESS) {
    return [sellAddr, buyAddr];
  }
  return [sellAddr, WBNB_ADDRESS, buyAddr];
}

async function getPancakeQuote(params: FetchSwapParams): Promise<SwapQuoteResult> {
  const { sellAmountBaseUnits } = ensureSwapInput(params);
  const slippageBps = params.slippageBps ?? SWAP_SLIPPAGE_BPS_DEFAULT;
  const path = buildPancakePath(params.sellToken, params.buyToken);
  const sellAmountBigInt = BigInt(sellAmountBaseUnits);

  // Encode getAmountsOut call
  const getAmountsOutData = encodeFunctionData({
    abi: PANCAKE_ROUTER_ABI,
    functionName: 'getAmountsOut',
    args: [sellAmountBigInt, path],
  });
  const { data: amountsData } = await bscPublicClient.call({
    to: PANCAKESWAP_ROUTER_V2,
    data: getAmountsOutData,
  });
  if (!amountsData) throw new Error('PancakeSwap: không thể lấy quote.');

  // Decode result: ABI encoded [offset(32)][length(32)][amount0(32)][amount1(32)]...
  const hex = amountsData.slice(2); // remove 0x
  const wordCount = path.length;
  const amounts: bigint[] = [];
  const startOffset = 2; // skip offset + length words
  for (let i = 0; i < wordCount; i++) {
    const chunk = hex.slice((startOffset + i) * 64, (startOffset + i + 1) * 64);
    amounts.push(BigInt('0x' + chunk));
  }

  const buyAmountRaw = amounts[amounts.length - 1];
  const minBuyAmount = (buyAmountRaw * BigInt(10000 - slippageBps)) / 10000n;
  const deadline = BigInt(Math.floor(Date.now() / 1000) + 1200); // 20 min

  // Check allowance for non-BNB sell tokens
  const needsApprovalCheck = params.sellToken !== 'BNB';
  let currentAllowance = 0n;
  if (needsApprovalCheck) {
    const tokenAddress = mapTokenToZeroXAddress(params.sellToken) as Address;
    try {
      const allowanceCallData = encodeFunctionData({
        abi: ERC20_APPROVAL_ABI,
        functionName: 'allowance',
        args: [params.taker, PANCAKESWAP_ROUTER_V2],
      });
      const { data: allowanceData } = await bscPublicClient.call({
        to: tokenAddress,
        data: allowanceCallData,
      });
      currentAllowance = allowanceData ? BigInt(allowanceData) : 0n;
    } catch {
      currentAllowance = 0n;
    }
  }

  // Build calldata
  let txData: `0x${string}`;
  let txValue = '0';

  if (params.sellToken === 'BNB') {
    txData = encodeFunctionData({
      abi: PANCAKE_ROUTER_ABI,
      functionName: 'swapExactETHForTokens',
      args: [minBuyAmount, path, params.taker, deadline],
    });
    txValue = sellAmountBaseUnits;
  } else if (params.buyToken === 'BNB') {
    txData = encodeFunctionData({
      abi: PANCAKE_ROUTER_ABI,
      functionName: 'swapExactTokensForETH',
      args: [sellAmountBigInt, minBuyAmount, path, params.taker, deadline],
    });
  } else {
    txData = encodeFunctionData({
      abi: PANCAKE_ROUTER_ABI,
      functionName: 'swapExactTokensForTokens',
      args: [sellAmountBigInt, minBuyAmount, path, params.taker, deadline],
    });
  }

  const issues: ZeroXIssues | null = needsApprovalCheck && currentAllowance < sellAmountBigInt
    ? { allowance: { actual: currentAllowance.toString(), spender: PANCAKESWAP_ROUTER_V2 } }
    : null;

  return {
    sellAmount: sellAmountBaseUnits,
    buyAmount: buyAmountRaw.toString(),
    minReceived: minBuyAmount.toString(),
    estimatedGas: '200000',
    price: null,
    issues,
    tx: {
      to: PANCAKESWAP_ROUTER_V2,
      data: txData,
      value: txValue,
    },
    allowanceTarget: needsApprovalCheck ? PANCAKESWAP_ROUTER_V2 : null,
    quotedAt: Date.now(),
    raw: { amounts: amounts.map(String) },
  };
}
// ─── End PancakeSwap ──────────────────────────────────────────────────────────


export function isSwapTokenDisabled(token: SwapToken): boolean {
  return isTokenInImplementation(token);
}

export function mapTokenToZeroXAddress(token: SwapToken): string {
  if (token === 'BNB') return NATIVE_TOKEN;
  if (token === 'USDT') return TOKEN_META.USDT.address;
  if (token === 'BTCB') return TOKEN_META.BTCB.address;
  if (token === 'CAMLY') return TOKEN_META.CAMLY.address;
  return NATIVE_TOKEN;
}

export function getSwapTokenDecimals(token: SwapToken): number {
  if (token === 'BNB') return 18;
  if (token === 'USDT') return TOKEN_META.USDT.decimals;
  if (token === 'BTCB') return TOKEN_META.BTCB.decimals;
  if (token === 'CAMLY') return TOKEN_META.CAMLY.decimals;
  return 18;
}

export function parseSwapAmount(token: SwapToken, amount: string): bigint {
  const normalized = amount.trim();
  if (token === 'BNB') return parseEther(normalized);
  return parseUnits(normalized, getSwapTokenDecimals(token));
}

export function formatSwapAmount(token: SwapToken, amount: string): string {
  const decimals = getSwapTokenDecimals(token);
  return formatUnits(BigInt(amount), decimals);
}

type FetchSwapParams = {
  sellToken: SwapToken;
  buyToken: SwapToken;
  sellAmount: string;
  taker: Address;
  slippageBps?: number;
};

function ensureSwapInput(params: FetchSwapParams): {
  sellAmountBaseUnits: string;
} {
  if (isSwapTokenDisabled(params.sellToken) || isSwapTokenDisabled(params.buyToken)) {
    throw new Error(FUN_TESTNET_NOTE);
  }
  if (params.sellToken === params.buyToken) {
    throw new Error('Token nguon va token dich khong duoc giong nhau.');
  }

  const amount = params.sellAmount.trim();
  if (!amount || Number(amount) <= 0) {
    throw new Error('So luong phai lon hon 0.');
  }

  return {
    sellAmountBaseUnits: parseSwapAmount(params.sellToken, amount).toString(),
  };
}

async function fetchFromZeroX(path: string, query: URLSearchParams): Promise<ZeroXResponse> {
  const { supabase } = await import('@/integrations/supabase/client');
  const { data, error } = await supabase.functions.invoke('swap-quote', {
    body: { path, query: query.toString() },
  });

  if (error) throw new Error(error.message || 'Khong lay duoc bao gia swap.');
  if (!data || typeof data !== 'object') throw new Error('Phan hoi khong hop le tu proxy.');

  const payload = data as Record<string, unknown>;

  // Check upstream HTTP error forwarded via _status field
  const upstreamStatus = payload._status as number | undefined;
  if (upstreamStatus && upstreamStatus >= 400) {
    // Handle validationErrors array from 0x v2
    const validationErrors = payload.validationErrors as Array<{ reason?: string; description?: string }> | undefined;
    const validationMsg = validationErrors?.[0]?.description || validationErrors?.[0]?.reason;
    const reason =
      validationMsg ||
      (payload.reason as string) ||
      (payload.message as string) ||
      `0x API loi ${upstreamStatus}`;
    throw new Error(reason);
  }

  if (payload.reason || (payload.message && !payload.transaction)) {
    throw new Error((payload.reason as string) || (payload.message as string));
  }

  return data as ZeroXResponse;
}

export async function getSwapPrice(params: FetchSwapParams): Promise<SwapQuoteResult> {
  if (involvesCamly(params.sellToken, params.buyToken)) {
    return getPancakeQuote(params);
  }
  const checked = ensureSwapInput(params);
  const query = new URLSearchParams({
    chainId: String(SWAP_CHAIN_ID),
    sellToken: mapTokenToZeroXAddress(params.sellToken),
    buyToken: mapTokenToZeroXAddress(params.buyToken),
    sellAmount: checked.sellAmountBaseUnits,
    taker: params.taker,
    slippageBps: String(params.slippageBps ?? SWAP_SLIPPAGE_BPS_DEFAULT),
  });

  const raw = await fetchFromZeroX('/swap/allowance-holder/price', query);
  return normalizeQuote(raw);
}

export async function getSwapQuote(params: FetchSwapParams): Promise<SwapQuoteResult> {
  if (involvesCamly(params.sellToken, params.buyToken)) {
    return getPancakeQuote(params);
  }
  const checked = ensureSwapInput(params);
  const query = new URLSearchParams({
    chainId: String(SWAP_CHAIN_ID),
    sellToken: mapTokenToZeroXAddress(params.sellToken),
    buyToken: mapTokenToZeroXAddress(params.buyToken),
    sellAmount: checked.sellAmountBaseUnits,
    taker: params.taker,
    slippageBps: String(params.slippageBps ?? SWAP_SLIPPAGE_BPS_DEFAULT),
  });

  const raw = await fetchFromZeroX('/swap/allowance-holder/quote', query);
  return normalizeQuote(raw);
}

function normalizeQuote(raw: ZeroXResponse): SwapQuoteResult {
  if (!raw.transaction?.to || !raw.transaction.data) {
    throw new Error('Quote khong hop le: thieu transaction data.');
  }

  const allowanceTarget = (raw.issues?.allowance?.spender || null) as Address | null;
  const minReceived = raw.minBuyAmount || raw.buyAmount;

  return {
    sellAmount: raw.sellAmount,
    buyAmount: raw.buyAmount,
    minReceived,
    estimatedGas: raw.estimatedGas || raw.transaction?.gas || null,
    price: raw.price || null,
    issues: raw.issues || null,
    tx: {
      to: raw.transaction.to,
      data: raw.transaction.data,
      value: raw.transaction.value || '0',
      gas: raw.transaction.gas,
      gasPrice: raw.transaction.gasPrice,
    },
    allowanceTarget,
    quotedAt: Date.now(),
    raw,
  };
}

export function quoteExpired(quote: SwapQuoteResult): boolean {
  return Date.now() - quote.quotedAt > SWAP_QUOTE_TTL_MS;
}

export function buildSwapTx(quote: SwapQuoteResult): SwapTxData {
  return {
    to: quote.tx.to,
    data: quote.tx.data,
    value: BigInt(quote.tx.value || '0'),
    chainId: SWAP_CHAIN_ID,
  };
}

export function requiresApproval(params: {
  quote: SwapQuoteResult;
  sellToken: SwapToken;
}): boolean {
  if (params.sellToken === 'BNB') return false;
  const allowanceActual = params.quote.issues?.allowance?.actual;
  if (!allowanceActual) return false;
  return BigInt(allowanceActual) < BigInt(params.quote.sellAmount);
}

export async function getAllowance(params: {
  readContract: (args: {
    address: Address;
    abi: typeof ERC20_APPROVAL_ABI;
    functionName: 'allowance';
    args: [Address, Address];
    chainId?: number;
  }) => Promise<bigint>;
  owner: Address;
  token: SwapToken;
  spender: Address;
}): Promise<bigint> {
  if (params.token === 'BNB') return 0n;
  const tokenAddress = mapTokenToZeroXAddress(params.token) as Address;
  return params.readContract({
    address: tokenAddress,
    abi: ERC20_APPROVAL_ABI,
    functionName: 'allowance',
    args: [params.owner, params.spender],
    chainId: SWAP_CHAIN_ID,
  });
}

export async function approveToken(params: {
  writeContract: (args: {
    address: Address;
    abi: typeof ERC20_APPROVAL_ABI;
    functionName: 'approve';
    args: [Address, bigint];
    chainId?: number;
    account?: Address;
  }) => Promise<`0x${string}`>;
  token: SwapToken;
  spender: Address;
  amount: bigint;
  account: Address;
}): Promise<{ hash: `0x${string}` }> {
  if (params.token === 'BNB') throw new Error('BNB khong can approve.');
  const tokenAddress = mapTokenToZeroXAddress(params.token) as Address;
  const hash = await params.writeContract({
    address: tokenAddress,
    abi: ERC20_APPROVAL_ABI,
    functionName: 'approve',
    args: [params.spender, params.amount],
    chainId: SWAP_CHAIN_ID,
    account: params.account,
  });
  return { hash };
}

export async function executeSwap(params: {
  sendTransaction: (args: {
    to: Address;
    data: `0x${string}`;
    value: bigint;
    chainId?: number;
    account?: Address;
  }) => Promise<`0x${string}`>;
  quote: SwapQuoteResult;
  account: Address;
}): Promise<{ hash: `0x${string}` }> {
  const tx = buildSwapTx(params.quote);
  const hash = await params.sendTransaction({
    to: tx.to,
    data: tx.data,
    value: tx.value,
    chainId: tx.chainId,
    account: params.account,
  });
  return { hash };
}

export function mapSwapError(error: unknown): string {
  if (!error) return 'Khong the thuc hien swap.';
  const e = error as { code?: number; shortMessage?: string; message?: string; details?: string };
  if (e.code === 4001) return 'Ban da tu choi ky giao dich.';

  const text = `${e.shortMessage || ''} ${e.message || ''} ${e.details || ''}`.toLowerCase();
  if (text.includes('no route') || text.includes('no quotes')) return 'Khong tim thay duong swap cho cap token nay. Vui long thu lai.';
  if (text.includes('insufficient') && text.includes('liquidity')) return 'Khong du thanh khoan cho cap token nay.';
  if (text.includes('insufficient funds')) return 'So du khong du (hoac thieu BNB lam gas).';
  if (text.includes('expired')) return 'Quote da het han, vui long bao gia lai.';
  if (text.includes('network')) return 'Loi ket noi mang blockchain. Vui long thu lai.';
  if (text.includes('timeout')) return 'Giao dich bi timeout. Vui long thu lai.';

  return e.shortMessage || e.message || e.details || 'Khong the thuc hien swap.';
}

