import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Box, Chip, FormControl, InputLabel, MenuItem, Paper, Select,
  Stack, Table, TableBody, TableCell, TableContainer, TableHead,
  TableRow, TablePagination, TextField, Typography,
} from '@mui/material';
import { adminApi } from '@api/adminApi';
import { LoadingState } from '@components/common/LoadingState';
import { ErrorState } from '@components/common/ErrorState';
import { formatDateTime } from '@utils/formatters';

const STATUS_COLORS: Record<string,'success'|'error'|'warning'|'default'> = {
  SUCCESS:'success', FAILURE:'error', DENIED:'warning',
};
const ACTION_COLORS: Record<string,'success'|'error'|'warning'|'info'|'default'> = {
  LOGIN:'success', LOGIN_FAILED:'error', LOGOUT:'default',
  USER_CREATE:'info', USER_UPDATE:'info', USER_DISABLE:'warning',
  DASHBOARD_VIEW:'default', EXPORT:'info', PASSWORD_RESET:'warning',
  UNAUTHORIZED_ACCESS_ATTEMPT:'error', USER_SCOPE_CHANGED:'warning',
};

const ACTIONS = [
  'LOGIN','LOGIN_FAILED','LOGOUT','USER_CREATE','USER_UPDATE','USER_DISABLE',
  'USER_ACTIVATE','PASSWORD_RESET','USER_SCOPE_CHANGED','DASHBOARD_VIEW',
  'DASHBOARD_CREATED','DASHBOARD_PUBLISHED','EXPORT','PERMISSION_CREATED',
  'PERMISSION_DELETED','UNAUTHORIZED_ACCESS_ATTEMPT','DATASOURCE_CREATED',
];

export function AuditLogsPage() {
  const [page, setPage] = useState(0);
  const [action, setAction] = useState('');
  const [securityOnly, setSecurityOnly] = useState(false);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['audit-logs', page, action, securityOnly],
    queryFn: () => securityOnly
      ? adminApi.getSecurityEvents({ page: page+1, page_size: 50 })
      : adminApi.listAudit({ page: page+1, page_size: 50, action: action||undefined }),
  });

  if (isLoading) return <LoadingState />;
  if (isError) return <ErrorState onRetry={refetch} />;
  const logs = data?.items ?? [];

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Box>
          <Typography variant="h5" fontWeight={600}>Audit Logs</Typography>
          <Typography variant="body2" color="text.secondary">{data?.total??0} events</Typography>
        </Box>
      </Box>
      <Stack direction="row" spacing={2} mb={2}>
        <FormControl size="small" sx={{minWidth:200}}>
          <InputLabel>Action</InputLabel>
          <Select value={action} label="Action" onChange={e=>{setAction(e.target.value);setPage(0);}}>
            <MenuItem value="">All Actions</MenuItem>
            {ACTIONS.map(a=><MenuItem key={a} value={a}>{a}</MenuItem>)}
          </Select>
        </FormControl>
        <Chip
          label={securityOnly?'Security Events Only':'All Events'}
          color={securityOnly?'error':'default'}
          variant={securityOnly?'filled':'outlined'}
          onClick={()=>{setSecurityOnly(p=>!p);setPage(0);}}
          sx={{alignSelf:'center',cursor:'pointer'}}
        />
      </Stack>
      <Paper elevation={1}>
        <TableContainer>
          <Table size="small">
            <TableHead><TableRow>
              <TableCell>Timestamp</TableCell><TableCell>Action</TableCell>
              <TableCell>User</TableCell><TableCell>Resource</TableCell>
              <TableCell>Status</TableCell><TableCell>IP Address</TableCell>
            </TableRow></TableHead>
            <TableBody>
              {logs.length===0&&<TableRow><TableCell colSpan={6} align="center">No logs found</TableCell></TableRow>}
              {logs.map((l:Record<string,unknown>)=>(
                <TableRow key={l.id as number} hover>
                  <TableCell><Typography variant="caption">{formatDateTime(l.created_at as string)}</Typography></TableCell>
                  <TableCell>
                    <Chip label={l.action as string} size="small"
                      color={ACTION_COLORS[l.action as string]??'default'} variant="outlined"/>
                  </TableCell>
                  <TableCell>
                    <Typography variant="caption" display="block">{l.full_name as string||'—'}</Typography>
                    <Typography variant="caption" color="text.secondary">{l.username as string||''}</Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="caption">
                      {[l.resource_type,l.resource_id].filter(Boolean).join(' #')||'—'}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Chip label={l.status as string} size="small"
                      color={STATUS_COLORS[l.status as string]??'default'} variant="outlined"/>
                  </TableCell>
                  <TableCell><Typography variant="caption">{l.ip_address as string||'—'}</Typography></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
        <TablePagination component="div" count={data?.total??0} rowsPerPage={50}
          rowsPerPageOptions={[50]} page={page}
          onPageChange={(_,p)=>setPage(p)}/>
      </Paper>
    </Box>
  );
}
