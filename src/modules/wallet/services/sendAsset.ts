import { parseEther, parseUnits, type Address } from 'viem';
import { isAddress } from 'viem';
import { TOKEN_META } from '@/config/tokens';
import { ERC20_ABI } from '@/lib/erc20';

export type SendToken = 'BNB' | 'USDT' | 'BTCB' | 'CAMLY' | 'FUN';

export type SendStatus =
  | 'idle'
  | 'validating'
  | 'awaiting_signature'
  | 'submitting'
  | 'pending_confirm'
  | 'success'
  | 'failed';

export const SUPPORTED_SEND_CHAIN_IDS = [56, 97] as const;
export const SEND_TRANSFER_NOTE = 'Gui token thong thuong dung transfer truc tiep, khong can approve.';
export const FUN_TESTNET_NOTE = 'FUN dang o testnet, tinh nang gui dang trien khai.';

export type SendNativeFn = (params: { to: Address; value: bigint; chainId?: number }) => Promise<`0x${string}`>;
export type WriteContractFn = (params: {
  address: Address;
  abi: typeof ERC20_ABI;
  functionName: 'transfer';
  args: [Address, bigint];
  chainId?: number;
  account?: Address;
}) => Promise<`0x${string}`>;

export type ValidateSendInputArgs = {
  recipient: string;
  amount: string;
  token: SendToken;
  chainId?: number;
};

export function isNativeToken(token: SendToken): boolean {
  return token === 'BNB';
}

export function isTokenInImplementation(token: SendToken): boolean {
  return token === 'FUN';
}

export function getTokenMeta(token: SendToken) {
  if (token === 'USDT') return TOKEN_META.USDT;
  if (token === 'BTCB') return TOKEN_META.BTCB;
  if (token === 'CAMLY') return TOKEN_META.CAMLY;
  return null;
}

function parseAmountValue(token: SendToken, amount: string): bigint {
  const normalized = amount.trim();
  if (token === 'BNB') return parseEther(normalized);
  const meta = getTokenMeta(token);
  if (!meta) throw new Error('Unsupported token');
  return parseUnits(normalized, meta.decimals);
}

export function validateSendInput(args: ValidateSendInputArgs): { ok: true } | { ok: false; error: string } {
  const { recipient, amount, chainId } = args;
  const normalizedRecipient = recipient.trim();
  const normalizedAmount = amount.trim();

  if (isTokenInImplementation(args.token)) {
    return { ok: false, error: FUN_TESTNET_NOTE };
  }

  if (!isAddress(normalizedRecipient)) {
    return { ok: false, error: 'Dia chi vi khong hop le.' };
  }

  if (!normalizedAmount || Number(normalizedAmount) <= 0) {
    return { ok: false, error: 'So luong phai lon hon 0.' };
  }

  if (chainId && !SUPPORTED_SEND_CHAIN_IDS.includes(chainId as (typeof SUPPORTED_SEND_CHAIN_IDS)[number])) {
    return { ok: false, error: 'Vui long chuyen sang BNB Smart Chain de tiep tuc.' };
  }

  try {
    parseAmountValue(args.token, normalizedAmount);
  } catch {
    const meta = getTokenMeta(args.token);
    if (meta) {
      return { ok: false, error: `So luong khong hop le cho ${args.token}. Toi da ${meta.decimals} chu so thap phan.` };
    }
    return { ok: false, error: 'So luong khong hop le.' };
  }

  return { ok: true };
}

export type SendAssetArgs = {
  token: SendToken;
  recipient: Address;
  amount: string;
  chainId?: number;
  account?: Address;
  sendNative: SendNativeFn;
  writeContract: WriteContractFn;
};

export async function sendAsset(args: SendAssetArgs): Promise<{ hash: `0x${string}` }> {
  const value = parseAmountValue(args.token, args.amount);

  if (isNativeToken(args.token)) {
    const hash = await args.sendNative({
      to: args.recipient,
      value,
      chainId: args.chainId,
    });
    return { hash };
  }

  const meta = getTokenMeta(args.token);
  if (!meta) throw new Error('Unsupported token');

  const hash = await args.writeContract({
    address: meta.address,
    abi: ERC20_ABI,
    functionName: 'transfer',
    args: [args.recipient, value],
    chainId: args.chainId,
    account: args.account,
  });

  return { hash };
}

export function mapSendError(error: unknown): string {
  if (!error) return 'Khong the gui giao dich.';
  const e = error as { code?: number; shortMessage?: string; message?: string; details?: string };

  if (e.code === 4001) return 'Ban da tu choi ky giao dich.';

  const text = `${e.shortMessage || ''} ${e.message || ''} ${e.details || ''}`.toLowerCase();
  if (text.includes('insufficient funds')) return 'So du khong du (hoac thieu BNB lam gas).';
  if (text.includes('network')) return 'Loi ket noi mang blockchain. Vui long thu lai.';
  if (text.includes('timeout')) return 'Giao dich bi timeout. Vui long thu lai.';

  return e.shortMessage || e.message || e.details || 'Khong the gui giao dich.';
}
