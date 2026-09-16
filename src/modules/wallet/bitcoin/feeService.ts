import type { BitcoinFeeOption, BitcoinFeeRates } from './types';

export function mapFeeOptions(fees: BitcoinFeeRates): BitcoinFeeOption[] {
  return [
    {
      preset: 'slow',
      label: 'Slow',
      satsPerVbyte: Math.max(fees.minimumFee, fees.economyFee),
    },
    {
      preset: 'normal',
      label: 'Normal',
      satsPerVbyte: Math.max(fees.minimumFee, fees.hourFee),
    },
    {
      preset: 'fast',
      label: 'Fast',
      satsPerVbyte: Math.max(fees.minimumFee, fees.fastestFee),
    },
  ];
}
