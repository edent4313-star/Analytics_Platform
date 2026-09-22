import { useQuery } from '@tanstack/react-query';
import { Box, Card, CardContent, Chip, CircularProgress, Typography } from '@mui/material';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import TrendingDownIcon from '@mui/icons-material/TrendingDown';
import { dashboardsApi } from '@api/dashboards.api';
import { formatNumber, formatCurrency, formatPercent } from '@utils/formatters';
import type { ActiveFilters, DashboardWidget } from '@/types/dashboard.types';

interface Props { widget: DashboardWidget; filters: ActiveFilters; dashboardCode: string; }

export function KpiWidget({ widget, filters, dashboardCode }: Props) {
  const config = widget.config_json ?? {};
  const { data, isLoading, isError } = useQuery({
    queryKey: ['widget-data', dashboardCode, widget.id, filters],
    queryFn: () => dashboardsApi.getWidgetData(dashboardCode, widget.id, filters),
    enabled: !!widget.dataset_id,
  });

  const raw = data?.data?.[0];
  const field = config.field ?? Object.keys(raw ?? {})[0];
  const value = raw ? Number(raw[field] ?? 0) : null;

  function fmt(v: number | null) {
    if (v === null) return '—';
    if (config.number_format === 'currency') return formatCurrency(v, 'ETB', config.decimal_precision ?? 2);
    if (config.number_format === 'percent') return formatPercent(v, config.decimal_precision ?? 1);
    return formatNumber(v, { decimals: config.decimal_precision ?? 0, unit: config.unit });
  }

  return (
    <Card elevation={1} sx={{ height: '100%' }}>
      <CardContent>
        <Typography variant="caption" color="text.secondary" fontWeight={600} textTransform="uppercase">
          {widget.title}
        </Typography>
        {isLoading && <CircularProgress size={20} sx={{ mt: 1 }} />}
        {isError && <Typography color="error" variant="body2">Error loading data</Typography>}
        {!isLoading && !isError && (
          <>
            <Typography variant="h4" fontWeight={700} mt={0.5}>{fmt(value)}</Typography>
            {config.unit && <Typography variant="caption" color="text.secondary">{config.unit}</Typography>}
          </>
        )}
        {!widget.dataset_id && (
          <Typography variant="body2" color="text.disabled">No dataset configured</Typography>
        )}
      </CardContent>
    </Card>
  );
}
