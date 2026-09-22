import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Box, Button, Card, CardContent, CircularProgress, IconButton,
  InputAdornment, Paper, Table, TableBody, TableCell,
  TableContainer, TableHead, TablePagination, TableRow,
  TableSortLabel, TextField, Tooltip, Typography,
} from '@mui/material';
import DownloadIcon from '@mui/icons-material/Download';
import SearchIcon from '@mui/icons-material/Search';
import { dashboardsApi } from '@api/dashboards.api';
import type { ActiveFilters, DashboardWidget, TableColumn } from '@/types/dashboard.types';

interface Props { widget: DashboardWidget; filters: ActiveFilters; dashboardCode: string; }

export function TableWidget({ widget, filters, dashboardCode }: Props) {
  const config = widget.config_json ?? {};
  const [page, setPage] = useState(0);
  const [pageSize] = useState(config.page_size ?? 25);
  const [search, setSearch] = useState('');
  const [sortField, setSortField] = useState('');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  const { data, isLoading, isError } = useQuery({
    queryKey: ['widget-data', dashboardCode, widget.id, filters, page, search, sortField, sortDir],
    queryFn: () => dashboardsApi.getWidgetData(dashboardCode, widget.id,
      { ...filters, search, sort_by: sortField, sort_order: sortDir.toUpperCase() }, page + 1, pageSize),
    enabled: !!widget.dataset_id,
  });

  const rows = data?.data ?? [];
  const columns: TableColumn[] = config.columns ?? (data?.columns ?? []).map((c: string) => ({ field: c, display_name: c }));
  const total = data?.total ?? 0;

  function handleSort(field: string) {
    if (sortField === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortField(field); setSortDir('asc'); }
    setPage(0);
  }

  async function handleExport() {
    const resp = await dashboardsApi.exportWidget(dashboardCode, widget.id, 'csv', filters);
    const url = URL.createObjectURL(resp.data);
    const a = document.createElement('a'); a.href = url;
    a.download = `${dashboardCode}_${widget.id}.csv`; a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <Card elevation={1} sx={{ height: '100%' }}>
      <CardContent sx={{ pb: '8px !important' }}>
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={1}>
          {widget.title && <Typography variant="subtitle2" fontWeight={600}>{widget.title}</Typography>}
          <Box display="flex" gap={1}>
            {config.enable_search && (
              <TextField size="small" placeholder="Search…" value={search}
                onChange={e => { setSearch(e.target.value); setPage(0); }}
                InputProps={{ startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment> }}
                sx={{ width: 180 }} />
            )}
            {config.enable_export && (
              <Tooltip title="Export CSV">
                <IconButton size="small" onClick={handleExport}><DownloadIcon fontSize="small" /></IconButton>
              </Tooltip>
            )}
          </Box>
        </Box>
        {isLoading && <CircularProgress size={20} />}
        {isError && <Typography color="error" variant="body2">Error loading data</Typography>}
        {!isLoading && !isError && (
          <TableContainer component={Paper} variant="outlined" sx={{ maxHeight: 340 }}>
            <Table size="small" stickyHeader>
              <TableHead>
                <TableRow>
                  {columns.map(col => (
                    <TableCell key={col.field}>
                      {config.enable_sort ? (
                        <TableSortLabel active={sortField === col.field} direction={sortField === col.field ? sortDir : 'asc'}
                          onClick={() => handleSort(col.field)}>
                          {col.display_name}
                        </TableSortLabel>
                      ) : col.display_name}
                    </TableCell>
                  ))}
                </TableRow>
              </TableHead>
              <TableBody>
                {rows.length === 0 && <TableRow><TableCell colSpan={columns.length} align="center">No data</TableCell></TableRow>}
                {rows.map((row: Record<string, unknown>, i: number) => (
                  <TableRow key={i} hover>
                    {columns.map(col => (
                      <TableCell key={col.field}>
                        <Typography variant="caption">{String(row[col.field] ?? '—')}</Typography>
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
        <TablePagination component="div" count={total} rowsPerPage={pageSize}
          rowsPerPageOptions={[pageSize]} page={page}
          onPageChange={(_, p) => setPage(p)} />
      </CardContent>
    </Card>
  );
}
