import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Alert, Box, Button, Chip, Dialog, DialogActions, DialogContent,
  DialogTitle, Paper, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, TextField, Typography,
} from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CancelIcon from '@mui/icons-material/Cancel';
import { dashboardsApi } from '@api/dashboards.api';
import { LoadingState } from '@components/common/LoadingState';
import { formatDateTime } from '@utils/formatters';

export function ApprovalsPage() {
  const qc = useQueryClient();
  const [rejectDialog, setRejectDialog] = useState<{ id: number; name: string } | null>(null);
  const [reason, setReason] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['dashboards-admin'],
    queryFn: () => dashboardsApi.list({ page_size: 100 }),
  });

  const approveMutation = useMutation({
    mutationFn: (id: number) => dashboardsApi.approve(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['dashboards-admin'] }),
  });
  const rejectMutation = useMutation({
    mutationFn: ({ id, reason }: { id: number; reason: string }) => dashboardsApi.reject(id, reason),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['dashboards-admin'] }); setRejectDialog(null); setReason(''); },
  });
  const publishMutation = useMutation({
    mutationFn: (id: number) => dashboardsApi.publish(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['dashboards-admin'] }),
  });

  if (isLoading) return <LoadingState />;

  // We'd normally have a dedicated submitted/approved list endpoint
  // For now filter from the dashboard list — Phase 12 can add a dedicated endpoint
  const all = data?.items ?? [];

  return (
    <Box>
      <Typography variant="h5" fontWeight={600} mb={1}>Dashboard Approvals</Typography>
      <Typography variant="body2" color="text.secondary" mb={3}>
        Review submitted dashboards. Approve to allow publishing, or reject to return to draft.
      </Typography>
      <Paper elevation={1}>
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Dashboard</TableCell>
                <TableCell>Code</TableCell>
                <TableCell>Published Version</TableCell>
                <TableCell align="center">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {all.length === 0 && <TableRow><TableCell colSpan={4} align="center">No dashboards found</TableCell></TableRow>}
              {all.map((d: { id: number; name: string; code: string; published_version: number | null }) => (
                <TableRow key={d.id} hover>
                  <TableCell><Typography variant="body2" fontWeight={500}>{d.name}</Typography></TableCell>
                  <TableCell><code>{d.code}</code></TableCell>
                  <TableCell>
                    {d.published_version
                      ? <Chip label={`v${d.published_version} Published`} size="small" color="success" />
                      : <Chip label="No published version" size="small" variant="outlined" />}
                  </TableCell>
                  <TableCell align="center">
                    <Button size="small" color="success" startIcon={<CheckCircleIcon />}
                      onClick={() => approveMutation.mutate(d.id)}>Approve</Button>
                    <Button size="small" color="warning" startIcon={<CheckCircleIcon />}
                      onClick={() => publishMutation.mutate(d.id)} sx={{ ml: 1 }}>Publish</Button>
                    <Button size="small" color="error" startIcon={<CancelIcon />}
                      onClick={() => setRejectDialog({ id: d.id, name: d.name })} sx={{ ml: 1 }}>Reject</Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>

      {rejectDialog && (
        <Dialog open onClose={() => setRejectDialog(null)} maxWidth="xs" fullWidth>
          <DialogTitle>Reject Dashboard</DialogTitle>
          <DialogContent>
            <Typography variant="body2" mb={2}>Rejecting <strong>{rejectDialog.name}</strong>. This will return it to draft status.</Typography>
            <TextField label="Rejection Reason" fullWidth multiline rows={3} value={reason} onChange={e => setReason(e.target.value)} />
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setRejectDialog(null)} color="inherit">Cancel</Button>
            <Button color="error" variant="contained" onClick={() => rejectMutation.mutate({ id: rejectDialog.id, reason })}>Reject</Button>
          </DialogActions>
        </Dialog>
      )}
    </Box>
  );
}
