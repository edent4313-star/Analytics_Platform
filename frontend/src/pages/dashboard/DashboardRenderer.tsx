/**
 * Generic Dashboard Renderer — works for ANY dashboard.
 * No per-project React pages needed.
 */
import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  Alert, Box, Breadcrumbs, CircularProgress,
  Grid, IconButton, Link, Tooltip, Typography,
} from '@mui/material';
import RefreshIcon from '@mui/icons-material/Refresh';
import { dashboardsApi } from '@api/dashboards.api';
import { WidgetRenderer } from '@components/widgets/WidgetRenderer';
import { GlobalFilterBar } from '@components/filters/GlobalFilterBar';
import { useAuth } from '@auth/useAuth';
import type { ActiveFilters, DashboardWidget } from '@/types/dashboard.types';
import { formatDateTime } from '@utils/formatters';

export function DashboardRenderer() {
  const { code } = useParams<{ code: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [filters, setFilters] = useState<ActiveFilters>({});
  const [refreshKey, setRefreshKey] = useState(0);

  const { data: config, isLoading, isError, error, dataUpdatedAt, refetch } = useQuery({
    queryKey: ['dashboard-config', code, refreshKey],
    queryFn: () => dashboardsApi.getConfig(code!),
    enabled: !!code,
  });

  if (isLoading) return (
    <Box display="flex" justifyContent="center" pt={8}><CircularProgress /></Box>
  );

  if (isError) {
    const e = error as { response?: { status?: number } };
    if (e?.response?.status === 403) return <Alert severity="error">You do not have permission to access this dashboard.</Alert>;
    if (e?.response?.status === 404) return <Alert severity="warning">Dashboard "{code}" not found.</Alert>;
    return <Alert severity="error">Failed to load dashboard. Please try again.</Alert>;
  }

  const widgets: DashboardWidget[] = config?.widgets ?? [];
  const filterDefs = config?.filters ?? [];

  // Build effective filters — pre-populate from user scope for scoped users
  function getEffectiveFilters(): ActiveFilters {
    const eff = { ...filters };
    if (user?.access_level === 'REGION' && user.region_id && !eff.region_id) eff.region_id = user.region_id;
    if (user?.access_level === 'DISTRICT' && user.district_id && !eff.district_id) eff.district_id = user.district_id;
    if (user?.access_level === 'BRANCH' && user.branch_id && !eff.branch_id) eff.branch_id = user.branch_id;
    return eff;
  }

  const effectiveFilters = getEffectiveFilters();

  // Minimal scope for GlobalFilterBar
  const userScope = {
    access_level: user?.access_level ?? 'HEAD_OFFICE',
    region_id: user?.region_id ?? null,
    district_id: user?.district_id ?? null,
    branch_id: user?.branch_id ?? null,
  };

  return (
    <Box>
      {/* Header */}
      <Box display="flex" alignItems="flex-start" justifyContent="space-between" mb={2}>
        <Box>
          <Breadcrumbs sx={{ mb: 0.5 }}>
            <Link component="button" variant="caption" onClick={() => navigate('/dashboards')}
              underline="hover" color="inherit">
              Dashboards
            </Link>
            <Typography variant="caption" color="text.primary">{config?.name}</Typography>
          </Breadcrumbs>
          <Typography variant="h5" fontWeight={700}>{config?.name}</Typography>
          {config?.description && (
            <Typography variant="body2" color="text.secondary">{config.description}</Typography>
          )}
        </Box>
        <Box display="flex" alignItems="center" gap={1}>
          {dataUpdatedAt > 0 && (
            <Typography variant="caption" color="text.secondary">
              Updated {formatDateTime(new Date(dataUpdatedAt).toISOString())}
            </Typography>
          )}
          <Tooltip title="Refresh">
            <IconButton size="small" onClick={() => { setRefreshKey(k => k + 1); refetch(); }}>
              <RefreshIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Box>
      </Box>

      {/* Filters */}
      {filterDefs.length > 0 && (
        <GlobalFilterBar
          filterDefs={filterDefs}
          filters={filters}
          onFiltersChange={setFilters}
          user={userScope}
        />
      )}

      {widgets.length === 0 && (
        <Alert severity="info">This dashboard has no published widgets yet.</Alert>
      )}

      {/* Widget grid */}
      <Grid container spacing={2}>
        {widgets
          .sort((a: DashboardWidget, b: DashboardWidget) => a.sort_order - b.sort_order)
          .map((widget: DashboardWidget) => (
            <Grid
              item
              key={widget.id}
              xs={12}
              sm={Math.min(12, Math.max(3, widget.width))}
              md={Math.min(12, widget.width)}
            >
              <WidgetRenderer
                widget={widget}
                filters={effectiveFilters}
                dashboardCode={code!}
              />
            </Grid>
          ))}
      </Grid>
    </Box>
  );
}
