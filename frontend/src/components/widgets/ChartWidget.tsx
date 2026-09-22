import { useQuery } from '@tanstack/react-query';
import { Box, Card, CardContent, CircularProgress, Typography } from '@mui/material';
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  Legend, ResponsiveContainer,
} from 'recharts';
import { dashboardsApi } from '@api/dashboards.api';
import type { ActiveFilters, DashboardWidget } from '@/types/dashboard.types';

const COLORS = ['#1976d2','#9c27b0','#2e7d32','#ed6c02','#d32f2f','#0288d1','#558b2f','#f57c00'];

interface Props { widget: DashboardWidget; filters: ActiveFilters; dashboardCode: string; }

export function ChartWidget({ widget, filters, dashboardCode }: Props) {
  const config = widget.config_json ?? {};
  const { data, isLoading, isError } = useQuery({
    queryKey: ['widget-data', dashboardCode, widget.id, filters],
    queryFn: () => dashboardsApi.getWidgetData(dashboardCode, widget.id, filters),
    enabled: !!widget.dataset_id,
  });

  const rows = data?.data ?? [];
  const dim = config.dimension ?? data?.columns?.[0];
  const metric = config.metric ?? data?.columns?.[1];

  if (isLoading) return <Card sx={{ height: '100%' }}><CardContent><CircularProgress size={24} /></CardContent></Card>;
  if (isError) return <Card sx={{ height: '100%' }}><CardContent><Typography color="error">Error loading chart</Typography></CardContent></Card>;
  if (!rows.length) return <Card sx={{ height: '100%' }}><CardContent><Typography color="text.secondary">No data</Typography></CardContent></Card>;

  const wt = widget.widget_type;

  return (
    <Card elevation={1} sx={{ height: '100%' }}>
      <CardContent sx={{ height: '100%', pb: '8px !important' }}>
        {widget.title && <Typography variant="subtitle2" fontWeight={600} mb={1}>{widget.title}</Typography>}
        <ResponsiveContainer width="100%" height={220}>
          {wt === 'PIE_CHART' || wt === 'DONUT_CHART' ? (
            <PieChart>
              <Pie data={rows} dataKey={metric ?? 'value'} nameKey={dim ?? 'name'}
                innerRadius={wt === 'DONUT_CHART' ? '50%' : 0} outerRadius="70%">
                {rows.map((_: unknown, i: number) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
              </Pie>
              <Tooltip />
              <Legend />
            </PieChart>
          ) : wt === 'LINE_CHART' ? (
            <LineChart data={rows}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey={dim} tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Line type="monotone" dataKey={metric} stroke={COLORS[0]} dot={false} />
            </LineChart>
          ) : wt === 'AREA_CHART' ? (
            <AreaChart data={rows}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey={dim} tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Area type="monotone" dataKey={metric} stroke={COLORS[0]} fill={COLORS[0]} fillOpacity={0.2} />
            </AreaChart>
          ) : wt === 'H_BAR_CHART' ? (
            <BarChart data={rows} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis type="number" tick={{ fontSize: 11 }} />
              <YAxis dataKey={dim} type="category" tick={{ fontSize: 10 }} width={90} />
              <Tooltip />
              <Bar dataKey={metric} fill={COLORS[0]} />
            </BarChart>
          ) : (
            <BarChart data={rows}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey={dim} tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Bar dataKey={metric} fill={COLORS[0]} />
            </BarChart>
          )}
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
