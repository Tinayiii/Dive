/*
 * Adapted from Untitled UI's open-source Activity Gauges examples.
 * The rendering, tooltip and legend building blocks remain code-owned in this app.
 */
import { Cell, Legend, PolarAngleAxis, RadialBar, RadialBarChart, ResponsiveContainer, Tooltip } from 'recharts';
import { ChartLegendContent, ChartTooltipContent } from './charts-base.tsx';
import { cx } from '../../../../utils/cx';

const configurations = {
  xs: { height: 136, innerRadius: 32, outerRadius: 50, titleSize: 18, labelY: -13, valueY: 9 },
  sm: { height: 158, innerRadius: 40, outerRadius: 64, titleSize: 23, labelY: -17, valueY: 11 },
  md: { height: 190, innerRadius: 50, outerRadius: 79, titleSize: 28, labelY: -20, valueY: 14 },
  lg: { height: 224, innerRadius: 60, outerRadius: 95, titleSize: 34, labelY: -24, valueY: 18 },
};

const defaultSeries = [
  { name: '已确认', value: 72, color: '#d8b4fe' },
  { name: '待处理', value: 48, color: '#bae6fd' },
  { name: '已完成', value: 86, color: '#f9c6da' },
];

function ActivityGauge({ size = 'sm', title = '72%', subtitle = '本周 Date 节奏', data = defaultSeries, className }) {
  const config = configurations[size] || configurations.sm;
  const series = data.map((item) => ({ ...item, value: Math.max(0, Math.min(100, Number(item.value) || 0)) }));

  return (
    <div className={cx('dive-gauge', `dive-gauge-${size}`, className)} role="img" aria-label={`${subtitle}，${title}`}>
      <ResponsiveContainer width="100%" height={config.height}>
        <RadialBarChart
          data={series}
          cx="50%"
          cy="50%"
          startAngle={90}
          endAngle={-270}
          innerRadius={config.innerRadius}
          outerRadius={config.outerRadius}
          barSize={size === 'xs' ? 8 : size === 'lg' ? 14 : 11}
        >
          <PolarAngleAxis type="number" domain={[0, 100]} tick={false} />
          <RadialBar background={{ fill: 'rgba(255,255,255,.11)' }} cornerRadius={8} dataKey="value">
            {series.map((item) => <Cell key={item.name} fill={item.color} />)}
          </RadialBar>
          <text x="50%" y={config.height / 2 + config.labelY} textAnchor="middle" className="dive-gauge-label">{subtitle}</text>
          <text x="50%" y={config.height / 2 + config.valueY} textAnchor="middle" className="dive-gauge-value" style={{ fontSize: config.titleSize }}>{title}</text>
          <Tooltip content={<ChartTooltipContent isRadialChart />} cursor={false} />
          <Legend verticalAlign="bottom" iconType="circle" content={<ChartLegendContent />} />
        </RadialBarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function ActivityGaugeXs(props) { return <ActivityGauge size="xs" {...props} />; }
export function ActivityGaugeSm(props) { return <ActivityGauge size="sm" {...props} />; }
export function ActivityGaugeMd(props) { return <ActivityGauge size="md" {...props} />; }
export function ActivityGaugeLg(props) { return <ActivityGauge size="lg" {...props} />; }
