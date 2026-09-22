import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Box, Chip, FormControl, InputLabel, MenuItem, Paper,
  Select, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, Typography, TablePagination,
} from '@mui/material';
import { auditApi } from '@api/audit.api';
import { LoadingState } from '@components/common/LoadingState';
import { ErrorState } from '@components/common/ErrorState';
import { formatDateTime } from '@utils/formatters';

const ACTION_COLORS: Record<string, 'success' | 'error' | 'warning' | 'info' | 'default'> = {
  LOGIN: 'success', LOGIN_FAILED: 'error', LOGOUT: 'default',
  USER_CREATE: 'info', USER_UPDATE: 'info', USER_DISABLE: 'warning',
  DASHBOARD_VIEW: 'default', EXPORT: 'info',
  PASSWORD_RESET: 'warning', USER_UNLOCKED: 'warning',
};

export function AuditLogsPage() {
  const [page, setPage] = useState(0);
  const [action, setAction] = useState('');

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['audit-logs', page, action],
    queryFn: () => auditApi.list(page + 1, 50, undefined, action || undefined),
  });

  if (isLoading) return <LoadingState />;
  if (isError) return <ErrorState onRetry={refetch} />;

  const logs = data?.items ?? [];

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Box>
          <Typography variant="h5" fontWeight={600}>Audit Logs</Typography>
          <Typography variant="body2" color="text.secondary">{data?.total ?? 0} total events</Typography>
        </Box>
        <FormControl size="small" sx={{ minWidth: 200 }}>
          <InputLabel>Filter by Action</InputLabel>
          <Select value={action} label="Filter by Action" onChange={e => { setAction(e.target.value); setPage(0); }}>
            <MenuItem value="">All Actions</MenuItem>
            {['LOGIN', 'LOGIN_FAILED', 'LOGOUT', 'USER_CREATE', 'USER_UPDATE', 'USER_DISABLE',
              'PASSWORD_RESET', 'DASHBOARD_VIEW', 'EXPORT'].map(a => (
              <MenuItem key={a} value={a}>{a}</MenuItem>
            ))}
          </Select>
        </FormControl>
      </Box>

      <Paper elevation={1}>
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Timestamp</TableCell>
                <TableCell>Action</TableCell>
                <TableCell>User</TableCell>
                <TableCell>Resource</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>IP Address</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {logs.length === 0 && (
                <TableRow><TableCell colSpan={6} align="center">No logs found</TableCell></TableRow>
              )}
              {logs.map(log => (
                <TableRow key={log.id} hover>
                  <TableCell><Typography variant="caption">{formatDateTime(log.created_at)}</Typography></TableCell>
                  <TableCell>
                    <Chip label={log.action} size="small"
                      color={ACTION_COLORS[log.action] ?? 'default'} variant="outlined" />
                  </TableCell>
                  <TableCell><Typography variant="caption">{log.user_id ?? '—'}</Typography></TableCell>
                  <TableCell>
                    <Typography variant="caption">
                      {[log.resource_type, log.resource_id].filter(Boolean).join(' #') || '—'}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Chip label={log.status} size="small"
                      color={log.status === 'SUCCESS' ? 'success' : log.status === 'FAILURE' ? 'error' : 'warning'}
                      variant="outlined" />
                  </TableCell>
                  <TableCell><Typography variant="caption">{log.ip_address ?? '—'}</Typography></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
        <TablePagination
          component="div"
          count={data?.total ?? 0}
          rowsPerPage={50}
          rowsPerPageOptions={[50]}
          page={page}
          onPageChange={(_, newPage) => setPage(newPage)}
        />
      </Paper>
    </Box>
  );
}
