import type { ReactNode } from 'react';

type Point = { label: string; value: number };

type ChartCardProps = { eyebrow: string; title: string; children: ReactNode; className?: string };

export function ChartCard({ eyebrow, title, children, className = '' }: ChartCardProps) {
  return <section className={`chart-card ${className}`}><div className="chart-heading"><div><span className="eyebrow">{eyebrow}</span><h3>{title}</h3></div></div>{children}</section>;
}

export function LineChart({ data, color = '#277b88' }: { data: Point[]; color?: string }) {
  const max = Math.max(...data.map((point) => point.value), 1);
  const width = 640;
  const height = 220;
  const points = data.map((point, index) => `${(index / Math.max(data.length - 1, 1)) * width},${height - (point.value / max) * 170 - 20}`).join(' ');
  return <div className="line-chart"><svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`Trend chart with ${data.length} periods`}><title>{data.map((point) => `${point.label}: ${point.value}`).join(', ')}</title><line x1="0" y1="200" x2="640" y2="200" stroke="#d8e3df" /><polyline points={points} fill="none" stroke={color} strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />{data.map((point, index) => { const x = (index / Math.max(data.length - 1, 1)) * width; const y = height - (point.value / max) * 170 - 20; return <g key={point.label}><circle cx={x} cy={y} r="6" fill="#fffdf9" stroke={color} strokeWidth="3"><title>{`${point.label}: ${point.value}`}</title></circle><text x={x} y="218" textAnchor="middle">{point.label}</text></g>; })}</svg><div className="chart-summary"><span>Latest <strong>{data[data.length - 1]?.value ?? 0}</strong></span><span>Peak <strong>{Math.max(...data.map((point) => point.value), 0)}</strong></span></div></div>;
}

export function DonutChart({ data }: { data: Array<{ label: string; value: number; color: string }> }) {
  const total = data.reduce((sum, item) => sum + item.value, 0);
  let offset = 0;
  return <div className="donut-layout"><div className="donut-chart"><svg viewBox="0 0 100 100" role="img" aria-label="Application status distribution"><title>{data.map((item) => `${item.label}: ${item.value}`).join(', ')}</title><circle cx="50" cy="50" r="35" fill="none" stroke="#edf1ef" strokeWidth="14" />{data.map((item) => { const length = item.value / total * 220; const currentOffset = offset; offset += length; return <circle key={item.label} cx="50" cy="50" r="35" fill="none" stroke={item.color} strokeWidth="14" strokeDasharray={`${length} ${220 - length}`} strokeDashoffset={-currentOffset} transform="rotate(-90 50 50)"><title>{`${item.label}: ${item.value} (${Math.round(item.value / total * 100)}%)`}</title></circle>; })}</svg><strong>{total}</strong><small>applications</small></div><div className="chart-legend">{data.map((item) => <div key={item.label}><i style={{ background: item.color }} /><span>{item.label}</span><strong>{item.value}</strong></div>)}</div></div>;
}

export function HorizontalBars({ data, valueKey = 'selected', suffix = '' }: { data: Array<Record<string, string | number>>; valueKey?: string; suffix?: string }) {
  const max = Math.max(...data.map((item) => Number(item[valueKey]) || 0), 1);
  return <div className="horizontal-bars">{data.map((item) => { const value = Number(item[valueKey]) || 0; return <div className="bar-row" key={String(item.label)} title={`${item.label}: ${value}${suffix}`}><div><strong>{item.label}</strong><span>{value}{suffix}</span></div><i style={{ width: `${value / max * 100}%` }} /></div>; })}</div>;
}

export function FunnelChart({ data }: { data: Array<{ label: string; value: number; conversion: number }> }) {
  const max = Math.max(...data.map((item) => item.value), 1);
  return <div className="funnel-chart">{data.map((item) => <div className="funnel-stage" key={item.label}><div style={{ width: `${Math.max(34, item.value / max * 100)}%` }}><strong>{item.value}</strong><span>{item.label}</span></div><small>{item.conversion}% from previous</small></div>)}</div>;
}

export function GroupedBars({ data }: { data: Array<{ label: string; applications: number; shortlisted: number; selected: number }> }) {
  const max = Math.max(...data.flatMap((item) => [item.applications, item.shortlisted, item.selected]), 1);
  return <div className="grouped-bars">{data.map((item) => <div className="grouped-row" key={item.label}><strong>{item.label}</strong><div className="bar-stack"><i className="applications-bar" style={{ width: `${item.applications / max * 100}%` }} title={`Applications: ${item.applications}`} /><i className="shortlisted-bar" style={{ width: `${item.shortlisted / max * 100}%` }} title={`Shortlisted: ${item.shortlisted}`} /><i className="selected-bar" style={{ width: `${item.selected / max * 100}%` }} title={`Selected: ${item.selected}`} /></div><small>{item.applications} / {item.shortlisted} / {item.selected}</small></div>)}</div>;
}
