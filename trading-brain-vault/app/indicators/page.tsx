import type { Metadata } from 'next';
import IndicatorVault from './indicator-vault';

export const metadata: Metadata = {
  title: 'Indicator Vault — Trading Brain',
  description: 'A searchable library of Trading Brain indicators for TradingView and Exness Terminal.',
};

export default function IndicatorsPage() {
  return <IndicatorVault />;
}
