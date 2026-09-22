/**
 * Widget dispatcher — renders the correct widget component based on widget_type.
 * Adding a new widget type = add a case here + implement the component.
 */
import type { DashboardWidget, ActiveFilters } from '@/types/dashboard.types';
import { KpiWidget } from './KpiWidget';
import { ChartWidget } from './ChartWidget';
import { TableWidget } from './TableWidget';
import { Box, Typography } from '@mui/material';

interface Props { widget: DashboardWidget; filters: ActiveFilters; dashboardCode: string; }

export function WidgetRenderer({ widget, filters, dashboardCode }: Props) {
  const { widget_type } = widget;

  if (widget_type === 'KPI') return <KpiWidget widget={widget} filters={filters} dashboardCode={dashboardCode} />;
  if (['BAR_CHART','H_BAR_CHART','LINE_CHART','AREA_CHART','PIE_CHART','DONUT_CHART','SCATTER_CHART'].includes(widget_type))
    return <ChartWidget widget={widget} filters={filters} dashboardCode={dashboardCode} />;
  if (widget_type === 'TABLE') return <TableWidget widget={widget} filters={filters} dashboardCode={dashboardCode} />;
  if (widget_type === 'TEXT') return (
    <Box sx={{ p: 2, bgcolor: 'grey.50', borderRadius: 1, height: '100%' }}>
      <Typography variant="body2">{widget.config_json?.content ?? ''}</Typography>
    </Box>
  );
  if (widget_type === 'DIVIDER') return <Box sx={{ borderTop: 1, borderColor: 'divider', mt: 1 }} />;
  return <Box sx={{ p: 2, border: 1, borderColor: 'divider', borderRadius: 1 }}><Typography variant="caption">Unknown widget: {widget_type}</Typography></Box>;
}
