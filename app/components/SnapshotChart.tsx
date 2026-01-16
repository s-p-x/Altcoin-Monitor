'use client';

import React from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ReferenceLine,
  ResponsiveContainer,
} from 'recharts';

interface ChartDataPoint {
  timestamp: number;
  volume: number;
  time: string;
  isTarget: boolean;
}

interface SnapshotChartProps {
  data: ChartDataPoint[];
  targetTimestamp: number;
  loading?: boolean;
}

const SnapshotChart: React.FC<SnapshotChartProps> = ({
  data,
  targetTimestamp,
  loading = false,
}) => {
  if (loading) {
    return (
      <div className="w-full h-96 flex items-center justify-center bg-[var(--panel)] rounded-lg border border-[var(--border)]">
        <div className="text-[var(--text-muted)]">Loading chart data...</div>
      </div>
    );
  }

  if (!data || data.length === 0) {
    return (
      <div className="w-full h-96 flex items-center justify-center bg-[var(--panel)] rounded-lg border border-[var(--border)]">
        <div className="text-[var(--text-muted)]">No data available</div>
      </div>
    );
  }

  const formatVolume = (value: number) => {
    if (value >= 1e9) {
      return `$${(value / 1e9).toFixed(2)}B`;
    }
    if (value >= 1e6) {
      return `$${(value / 1e6).toFixed(2)}M`;
    }
    if (value >= 1e3) {
      return `$${(value / 1e3).toFixed(2)}K`;
    }
    return `$${value.toFixed(0)}`;
  };

  const CustomTooltip = (props: any) => {
    const { active, payload } = props;
    if (active && payload && payload[0]) {
      const data = payload[0].payload;
      return (
        <div className="bg-[var(--panel)] border border-[var(--accent)] rounded px-3 py-2 text-xs">
          <p className="text-[var(--text)]">{data.time}</p>
          <p className="text-[var(--accent)]">
            Volume: {formatVolume(data.volume)}
          </p>
          {data.isTarget && (
            <p className="text-[var(--semantic-green)] font-semibold">
              (Target)
            </p>
          )}
        </div>
      );
    }
    return null;
  };

  return (
    <div className="w-full bg-[var(--panel)] rounded-lg border border-[var(--border)] p-4">
      <h3 className="text-lg font-semibold text-[var(--text)] mb-4">
        Volume Chart
      </h3>
      <ResponsiveContainer width="100%" height={400}>
        <BarChart
          data={data}
          margin={{ top: 20, right: 30, left: 0, bottom: 60 }}
        >
          <CartesianGrid
            strokeDasharray="3 3"
            stroke="var(--border)"
            vertical={false}
          />
          <XAxis
            dataKey="time"
            stroke="var(--text-muted)"
            tick={{ fontSize: 12 }}
            angle={-45}
            textAnchor="end"
            height={100}
          />
          <YAxis
            stroke="var(--text-muted)"
            tick={{ fontSize: 12 }}
            tickFormatter={formatVolume}
          />
          <Tooltip content={<CustomTooltip />} />
          <Legend wrapperStyle={{ paddingTop: '20px' }} />
          <Bar
            dataKey="volume"
            fill="var(--accent)"
            name="Volume (USD)"
            radius={[4, 4, 0, 0]}
            isAnimationActive={true}
          />
          <ReferenceLine
            x={data.find((d) => d.isTarget)?.time}
            stroke="var(--semantic-green)"
            strokeDasharray="5 5"
            label={{
              value: 'Target',
              position: 'top',
              fill: 'var(--semantic-green)',
              fontSize: 12,
            }}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};

export default SnapshotChart;
