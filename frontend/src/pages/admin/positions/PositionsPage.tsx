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
import { adminApi } from '@api/adminApi';
import { LoadingState } from '@components/common/LoadingState';

interface PosItem { id: number; code: string; name: string; level: number; is_active: boolean; }

export function PositionsPage() {
  const qc = useQueryClient();
  const [dialog, setDialog] = useState<{ open: boolean; item?: PosItem }>({ open: false });
  const [form, setForm] = useState({ code: '', name: '', level: '0' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { data: positions = [], isLoading } = useQuery({
    queryKey: ['admin-positions'],
    queryFn: adminApi.listPositions,
  });

  function openCreate() { setForm({ code: '', name: '', level: '0' }); setError(null); setDialog({ open: true }); }
  function openEdit(item: PosItem) { setForm({ code: item.code, name: item.name, level: String(item.level) }); setError(null); setDialog({ open: true, item }); }

  async function save() {
    if (!form.name.trim()) { setError('Name is required'); return; }
    setSaving(true); setError(null);
    try {
      const data = { ...form, level: Number(form.level) };
      if (dialog.item) await adminApi.updatePosition(dialog.item.id, data);
      else await adminApi.createPosition(data);
      qc.invalidateQueries({ queryKey: ['admin-positions'] });
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
          <Typography variant="h5" fontWeight={600}>Positions</Typography>
          <Typography variant="body2" color="text.secondary">
            Position is optional on users. It does not affect geographic data scope.
          </Typography>
        </Box>
        <Button variant="contained" startIcon={<AddIcon />} onClick={openCreate}>Add Position</Button>
      </Box>

      <Paper elevation={1}>
        <TableContainer>
          <Table size="small">
            <TableHead><TableRow>
              <TableCell>#</TableCell><TableCell>Code</TableCell><TableCell>Name</TableCell>
              <TableCell>Level</TableCell><TableCell align="right">Actions</TableCell>
            </TableRow></TableHead>
            <TableBody>
              {(positions as PosItem[]).length === 0 && (
                <TableRow><TableCell colSpan={5} align="center">No positions yet</TableCell></TableRow>
              )}
              {(positions as PosItem[]).map((p, i) => (
                <TableRow key={p.id} hover>
                  <TableCell>{i + 1}</TableCell>
                  <TableCell><Typography variant="caption" fontFamily="monospace">{p.code}</Typography></TableCell>
                  <TableCell><Typography variant="body2" fontWeight={500}>{p.name}</Typography></TableCell>
                  <TableCell><Chip label={p.level} size="small" variant="outlined" /></TableCell>
                  <TableCell align="right">
                    <IconButton size="small" onClick={() => openEdit(p)}><EditIcon fontSize="small" /></IconButton>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>

      <Dialog open={dialog.open} onClose={() => setDialog({ open: false })} maxWidth="xs" fullWidth>
        <DialogTitle>{dialog.item ? 'Edit Position' : 'Add Position'}</DialogTitle>
        <DialogContent>
          {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
          <Stack spacing={2} mt={1}>
            <TextField size="small" label="Code" fullWidth value={form.code}
              onChange={e => setForm(p => ({ ...p, code: e.target.value }))}
              helperText="e.g. BRANCH_MGR, ANALYST" />
            <TextField size="small" label="Position Name *" fullWidth value={form.name}
              onChange={e => setForm(p => ({ ...p, name: e.target.value }))} />
            <TextField size="small" label="Level (seniority)" type="number" fullWidth value={form.level}
              onChange={e => setForm(p => ({ ...p, level: e.target.value }))}
              helperText="Higher number = more senior (e.g. Director = 9, Officer = 2)" />
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
