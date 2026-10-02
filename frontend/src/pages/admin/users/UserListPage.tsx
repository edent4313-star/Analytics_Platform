import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Alert, Box, Button, Chip, FormControl, IconButton, InputAdornment,
  InputLabel, MenuItem, Paper, Select, Stack, Table, TableBody,
  TableCell, TableContainer, TableHead, TableRow, Tooltip, Typography,
  TextField,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import SearchIcon from '@mui/icons-material/Search';
import LockResetIcon from '@mui/icons-material/LockReset';
import LockOpenIcon from '@mui/icons-material/LockOpen';
import { adminApi } from '@api/adminApi';
import authApi from '@api/authApi';
import { LoadingState } from '@components/common/LoadingState';
import { ErrorState } from '@components/common/ErrorState';
import { ConfirmDialog } from '@components/common/ConfirmDialog';
import { ResetPasswordDialog } from './ResetPasswordDialog';
import { formatDateTime } from '@utils/formatters';

export function UserListPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [accessLevel, setAccessLevel] = useState('');
  const [resetTarget, setResetTarget] = useState<{id:number;username:string}|null>(null);
  const [confirmToggle, setConfirmToggle] = useState<{id:number;username:string;active:boolean}|null>(null);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['admin-users', search, accessLevel],
    queryFn: () => adminApi.listUsers({ page_size: 100, search: search||undefined, access_level: accessLevel||undefined }),
  });

  const toggleStatus = useMutation({
    mutationFn: ({ id, active }: {id:number;active:boolean}) => adminApi.setUserStatus(id, active),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin-users'] }); setConfirmToggle(null); },
  });

  const unlockMutation = useMutation({
    mutationFn: (id: number) => authApi.unlockUser(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-users'] }),
  });

  if (isLoading) return <LoadingState />;
  if (isError) return <ErrorState onRetry={refetch} />;
  const users = data?.items ?? [];

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Box>
          <Typography variant="h5" fontWeight={600}>Users</Typography>
          <Typography variant="body2" color="text.secondary">{data?.total ?? 0} users</Typography>
        </Box>
        <Button variant="contained" startIcon={<AddIcon />} onClick={() => navigate('/admin/users/new')}>
          Create User
        </Button>
      </Box>
      <Stack direction="row" spacing={2} mb={2}>
        <TextField placeholder="Search…" value={search} onChange={e => setSearch(e.target.value)}
          size="small" sx={{ minWidth: 260 }}
          InputProps={{ startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small"/></InputAdornment> }} />
        <FormControl size="small" sx={{ minWidth: 160 }}>
          <InputLabel>Access Level</InputLabel>
          <Select value={accessLevel} label="Access Level" onChange={e => setAccessLevel(e.target.value)}>
            <MenuItem value="">All</MenuItem>
            {['HEAD_OFFICE','REGION','DISTRICT','BRANCH'].map(l=><MenuItem key={l} value={l}>{l}</MenuItem>)}
          </Select>
        </FormControl>
      </Stack>
      <Paper elevation={1}>
        <TableContainer>
          <Table size="small">
            <TableHead><TableRow>
              <TableCell>Name</TableCell><TableCell>Employee ID</TableCell>
              <TableCell>Role</TableCell><TableCell>Access Level</TableCell>
              <TableCell>Organization</TableCell><TableCell>Status</TableCell>
              <TableCell>Last Login</TableCell><TableCell align="center">Actions</TableCell>
            </TableRow></TableHead>
            <TableBody>
              {users.length===0&&<TableRow><TableCell colSpan={8} align="center">No users found</TableCell></TableRow>}
              {users.map((u: Record<string,unknown>) => (
                <TableRow key={u.id as number} hover>
                  <TableCell>
                    <Typography variant="body2" fontWeight={500}>{u.full_name as string}</Typography>
                    <Typography variant="caption" color="text.secondary">{u.email as string}</Typography>
                  </TableCell>
                  <TableCell><Typography variant="caption" fontFamily="monospace">{(u.employee_id as string)||'—'}</Typography></TableCell>
                  <TableCell>{u.role as string||'—'}</TableCell>
                  <TableCell><Chip label={u.access_level as string} size="small" variant="outlined"
                    color={u.access_level==='HEAD_OFFICE'?'primary':'default'}/></TableCell>
                  <TableCell><Typography variant="caption">
                    {[u.region_name,u.district_name,u.branch_name].filter(Boolean).join(' › ')||'All'}
                  </Typography></TableCell>
                  <TableCell>
                    {u.locked_until ? <Chip label="Locked" size="small" color="warning"/> :
                     <Chip label={u.is_active?'Active':'Inactive'} size="small"
                       color={u.is_active?'success':'error'} variant="outlined"/>}
                  </TableCell>
                  <TableCell><Typography variant="caption">{u.last_login?formatDateTime(u.last_login as string):'Never'}</Typography></TableCell>
                  <TableCell align="center">
                    <Tooltip title="Edit"><IconButton size="small" onClick={()=>navigate(`/admin/users/${u.id}`)}><EditIcon fontSize="small"/></IconButton></Tooltip>
                    <Tooltip title="Reset Password"><IconButton size="small" onClick={()=>setResetTarget({id:u.id as number,username:u.username as string})}><LockResetIcon fontSize="small"/></IconButton></Tooltip>
                    {!!u.locked_until&&<Tooltip title="Unlock"><IconButton size="small" color="warning" onClick={()=>unlockMutation.mutate(u.id as number)}><LockOpenIcon fontSize="small"/></IconButton></Tooltip>}
                    <Chip label={u.is_active?'Disable':'Enable'} size="small" variant="outlined"
                      color={u.is_active?'error':'success'} sx={{ml:0.5,cursor:'pointer'}}
                      onClick={()=>setConfirmToggle({id:u.id as number,username:u.username as string,active:!u.is_active})}/>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>
      {resetTarget&&<ResetPasswordDialog open userId={resetTarget.id} username={resetTarget.username}
        onClose={()=>setResetTarget(null)} onSuccess={()=>setResetTarget(null)}/>}
      {confirmToggle&&<ConfirmDialog open
        title={confirmToggle.active?'Activate User':'Deactivate User'}
        message={`${confirmToggle.active?'Activate':'Deactivate'} ${confirmToggle.username}?`}
        confirmLabel={confirmToggle.active?'Activate':'Deactivate'}
        confirmColor={confirmToggle.active?'primary':'error'}
        onConfirm={()=>toggleStatus.mutate({id:confirmToggle.id,active:confirmToggle.active})}
        onCancel={()=>setConfirmToggle(null)}/>}
    </Box>
  );
}
