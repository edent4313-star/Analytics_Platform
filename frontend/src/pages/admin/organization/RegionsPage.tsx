import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Alert, Box, Button, Chip, CircularProgress, Dialog, DialogActions,
  DialogContent, DialogTitle, IconButton, Paper, Stack, Table,
  TableBody, TableCell, TableContainer, TableHead, TableRow,
  TextField, Typography,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import { organizationApi } from '@api/organization.api';
import type { Region } from '@/types/organization.types';
import { LoadingState } from '@components/common/LoadingState';

export function RegionsPage() {
  const qc = useQueryClient();
  const [dialog, setDialog] = useState<{ open: boolean; item?: Region }>({ open: false });
  const [form, setForm] = useState({ code: '', name: '', status: 'ACTIVE' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { data: regions = [], isLoading } = useQuery({
    queryKey: ['regions-all'],
    queryFn: organizationApi.getAllRegions,
  });

  function openCreate() { setForm({ code: '', name: '', status: 'ACTIVE' }); setError(null); setDialog({ open: true }); }
  function openEdit(item: Region) { setForm({ code: item.code, name: item.name, status: item.status }); setError(null); setDialog({ open: true, item }); }

  async function save() {
    if (!form.name.trim() || !form.code.trim()) { setError('Code and Name are required'); return; }
    setSaving(true); setError(null);
    try {
      if (dialog.item) await organizationApi.updateRegion(dialog.item.id, form);
      else await organizationApi.createRegion(form);
      qc.invalidateQueries({ queryKey: ['regions-all'] });
      setDialog({ open: false });
    } catch (e: unknown) {
      const err = e as { response?: { data?: { detail?: string } } };
      setError(err?.response?.data?.detail ?? 'Save failed');
    } finally { setSaving(false); }
  }

  if (isLoading) return <LoadingState />;

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Box>
          <Typography variant="h5" fontWeight={600}>Regions</Typography>
          <Typography variant="body2" color="text.secondary">
            HEAD OFFICE → <strong>REGION</strong> → District → Branch
          </Typography>
        </Box>
        <Button variant="contained" startIcon={<AddIcon />} onClick={openCreate}>Add Region</Button>
      </Box>
      <Paper elevation={1}>
        <TableContainer>
          <Table size="small">
            <TableHead><TableRow>
              <TableCell>#</TableCell><TableCell>Code</TableCell><TableCell>Name</TableCell>
              <TableCell>Status</TableCell><TableCell align="right">Actions</TableCell>
            </TableRow></TableHead>
            <TableBody>
              {(regions as Region[]).length === 0 && (
                <TableRow><TableCell colSpan={5} align="center">No regions yet</TableCell></TableRow>
              )}
              {(regions as Region[]).map((r, i) => (
                <TableRow key={r.id} hover>
                  <TableCell>{i + 1}</TableCell>
                  <TableCell><Typography variant="caption" fontFamily="monospace">{r.code}</Typography></TableCell>
                  <TableCell><Typography variant="body2" fontWeight={500}>{r.name}</Typography></TableCell>
                  <TableCell><Chip label={r.status} size="small" color={r.status === 'ACTIVE' ? 'success' : 'default'} variant="outlined" /></TableCell>
                  <TableCell align="right">
                    <IconButton size="small" onClick={() => openEdit(r)}><EditIcon fontSize="small" /></IconButton>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>

      <Dialog open={dialog.open} onClose={() => setDialog({ open: false })} maxWidth="xs" fullWidth>
        <DialogTitle>{dialog.item ? 'Edit Region' : 'Add Region'}</DialogTitle>
        <DialogContent>
          {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
          <Stack spacing={2} mt={1}>
            <TextField size="small" label="Code *" fullWidth value={form.code}
              onChange={e => setForm(p => ({ ...p, code: e.target.value }))} helperText="e.g. R01" />
            <TextField size="small" label="Region Name *" fullWidth value={form.name}
              onChange={e => setForm(p => ({ ...p, name: e.target.value }))} />
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setDialog({ open: false })} color="inherit">Cancel</Button>
          <Button onClick={save} variant="contained" disabled={saving}>
            {saving ? <CircularProgress size={18} color="inherit" /> : 'Save'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
