import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Alert, Box, Button, Chip, IconButton, InputAdornment,
  Table, TableBody, TableCell, TableHead, TableRow,
  TextField, Tooltip, Typography, Paper, TableContainer,
  FormControl, InputLabel, Select, MenuItem, Stack,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import SearchIcon from '@mui/icons-material/Search';
import LockResetIcon from '@mui/icons-material/LockReset';
import LockOpenIcon from '@mui/icons-material/LockOpen';
import { usersApi } from '@api/users.api';
import { authApi } from '@api/auth.api';
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
  const [page] = useState(1);
  const [resetTarget, setResetTarget] = useState<{ id: number; username: string } | null>(null);
  const [confirmToggle, setConfirmToggle] = useState<{ id: number; username: string; active: boolean } | null>(null);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['users', page, search, accessLevel],
    queryFn: () => usersApi.list({ page, page_size: 50, search: search || undefined, access_level: accessLevel || undefined }),
  });

  const toggleStatus = useMutation({
    mutationFn: ({ id, active }: { id: number; active: boolean }) => usersApi.setStatus(id, active),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['users'] }); setConfirmToggle(null); },
  });

  const unlockMutation = useMutation({
    mutationFn: (id: number) => authApi.unlockUser(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['users'] }),
  });

  if (isLoading) return <LoadingState />;
  if (isError) return <ErrorState onRetry={refetch} />;

  const users = data?.items ?? [];

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Box>
          <Typography variant="h5" fontWeight={600}>Users</Typography>
          <Typography variant="body2" color="text.secondary">{data?.total ?? 0} total users</Typography>
        </Box>
        <Button variant="contained" startIcon={<AddIcon />} onClick={() => navigate('/admin/users/new')}>
          Create User
        </Button>
      </Box>

      {/* Filters */}
      <Stack direction="row" spacing={2} mb={2}>
        <TextField
          placeholder="Search name, username, email…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          size="small"
          sx={{ minWidth: 280 }}
          InputProps={{ startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment> }}
        />
        <FormControl size="small" sx={{ minWidth: 160 }}>
          <InputLabel>Access Level</InputLabel>
          <Select value={accessLevel} label="Access Level" onChange={e => setAccessLevel(e.target.value)}>
            <MenuItem value="">All</MenuItem>
            {['HEAD_OFFICE', 'REGION', 'DISTRICT', 'BRANCH'].map(l => (
              <MenuItem key={l} value={l}>{l}</MenuItem>
            ))}
          </Select>
        </FormControl>
      </Stack>

      <Paper elevation={1}>
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Full Name</TableCell>
                <TableCell>Username</TableCell>
                <TableCell>Role</TableCell>
                <TableCell>Access Level</TableCell>
                <TableCell>Organization</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Last Login</TableCell>
                <TableCell align="center">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {users.length === 0 && (
                <TableRow><TableCell colSpan={8} align="center">No users found</TableCell></TableRow>
              )}
              {users.map(u => (
                <TableRow key={u.id} hover>
                  <TableCell>
                    <Typography variant="body2" fontWeight={500}>{u.full_name}</Typography>
                    <Typography variant="caption" color="text.secondary">{u.email}</Typography>
                  </TableCell>
                  <TableCell>{u.username}</TableCell>
                  <TableCell>{u.role ?? '—'}</TableCell>
                  <TableCell>
                    <Chip label={u.access_level} size="small" variant="outlined"
                      color={u.access_level === 'HEAD_OFFICE' ? 'primary' : 'default'} />
                  </TableCell>
                  <TableCell>
                    <Typography variant="caption">
                      {[u.region_name, u.district_name, u.branch_name].filter(Boolean).join(' › ') || 'All'}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    {u.locked_until ? (
                      <Chip label="Locked" size="small" color="warning" />
                    ) : (
                      <Chip label={u.is_active ? 'Active' : 'Inactive'} size="small"
                        color={u.is_active ? 'success' : 'error'} variant="outlined" />
                    )}
                  </TableCell>
                  <TableCell>
                    <Typography variant="caption">{u.last_login ? formatDateTime(u.last_login) : 'Never'}</Typography>
                  </TableCell>
                  <TableCell align="center">
                    <Tooltip title="Edit"><IconButton size="small" onClick={() => navigate(`/admin/users/${u.id}`)}><EditIcon fontSize="small" /></IconButton></Tooltip>
                    <Tooltip title="Reset Password"><IconButton size="small" onClick={() => setResetTarget({ id: u.id, username: u.username })}><LockResetIcon fontSize="small" /></IconButton></Tooltip>
                    {u.locked_until && (
                      <Tooltip title="Unlock Account"><IconButton size="small" color="warning" onClick={() => unlockMutation.mutate(u.id)}><LockOpenIcon fontSize="small" /></IconButton></Tooltip>
                    )}
                    <Tooltip title={u.is_active ? 'Deactivate' : 'Activate'}>
                      <Chip
                        label={u.is_active ? 'Disable' : 'Enable'}
                        size="small"
                        variant="outlined"
                        color={u.is_active ? 'error' : 'success'}
                        onClick={() => setConfirmToggle({ id: u.id, username: u.username, active: !u.is_active })}
                        sx={{ ml: 0.5, cursor: 'pointer' }}
                      />
                    </Tooltip>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>

      {/* Reset password dialog */}
      {resetTarget && (
        <ResetPasswordDialog
          open
          userId={resetTarget.id}
          username={resetTarget.username}
          onClose={() => setResetTarget(null)}
          onSuccess={() => { setResetTarget(null); }}
        />
      )}

      {/* Confirm status toggle */}
      {confirmToggle && (
        <ConfirmDialog
          open
          title={confirmToggle.active ? 'Activate User' : 'Deactivate User'}
          message={`Are you sure you want to ${confirmToggle.active ? 'activate' : 'deactivate'} ${confirmToggle.username}?`}
          confirmLabel={confirmToggle.active ? 'Activate' : 'Deactivate'}
          confirmColor={confirmToggle.active ? 'primary' : 'error'}
          onConfirm={() => toggleStatus.mutate({ id: confirmToggle.id, active: confirmToggle.active })}
          onCancel={() => setConfirmToggle(null)}
        />
      )}
    </Box>
  );
}
