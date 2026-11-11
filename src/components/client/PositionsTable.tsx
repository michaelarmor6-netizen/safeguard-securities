import React from 'react';
import { TrendingUp, TrendingDown } from 'lucide-react';

export interface Position {
  id: string;
  instrument: string;
  type: 'futures' | 'options' | 'equity' | 'other';
  quantity: number;
  avgPrice: number;
  currentPrice?: number;
  unrealizedPnl?: number;
  status: 'open' | 'closed';
}

interface PositionsTableProps {
  positions: Position[];
  loading?: boolean;
  onViewFull?: () => void;
}

const PositionsTable: React.FC<PositionsTableProps> = ({
  positions,
  loading = false,
  onViewFull,
}) => {
  const formatCurrency = (value?: number) => {
    if (value === undefined || value === null) return '—';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
    }).format(value);
  };

  const openPositions = positions.filter((p) => p.status === 'open');

  if (loading) {
    return (
      <div className="bg-white border border-gray-200 rounded-xl p-8 text-center text-gray-500">
        Loading positions...
      </div>
    );
  }

  if (openPositions.length === 0) {
    return (
      <div className="bg-white border border-gray-200 rounded-xl p-10 text-center">
        <div className="text-gray-400 mb-2">No open positions</div>
        <p className="text-sm text-gray-500 max-w-md mx-auto">
          You currently have no open futures or options positions. Contact your advisor to discuss gold futures and limited-risk options strategies.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-900">Open Positions</h2>
        {onViewFull && (
          <button
            onClick={onViewFull}
            className="text-sm font-medium text-gray-600 hover:text-gray-900"
          >
            View full portfolio →
          </button>
        )}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 text-left text-gray-500">
              <th className="px-6 py-3 font-medium">Instrument</th>
              <th className="px-4 py-3 font-medium">Type</th>
              <th className="px-4 py-3 font-medium text-right">Qty</th>
              <th className="px-4 py-3 font-medium text-right">Avg Price</th>
              <th className="px-4 py-3 font-medium text-right">Current</th>
              <th className="px-4 py-3 font-medium text-right">P&L</th>
              <th className="px-6 py-3 font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {openPositions.map((pos) => {
              const pnl = pos.unrealizedPnl ?? 0;
              const isPositive = pnl >= 0;

              return (
                <tr key={pos.id} className="border-b border-gray-50 last:border-0 hover:bg-gray-50/50">
                  <td className="px-6 py-4 font-medium text-gray-900">{pos.instrument}</td>
                  <td className="px-4 py-4 capitalize text-gray-600">{pos.type}</td>
                  <td className="px-4 py-4 text-right text-gray-900">{pos.quantity}</td>
                  <td className="px-4 py-4 text-right text-gray-900">{formatCurrency(pos.avgPrice)}</td>
                  <td className="px-4 py-4 text-right text-gray-900">{formatCurrency(pos.currentPrice)}</td>
                  <td className="px-4 py-4 text-right">
                    <span className={`inline-flex items-center gap-1 font-medium ${isPositive ? 'text-emerald-600' : 'text-red-600'}`}>
                      {isPositive ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
                      {formatCurrency(pnl)}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700">
                      Open
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default PositionsTable;
