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

interface DeptItem { id: number; code: string; name: string; is_active: boolean; }

export function DepartmentsPage() {
  const qc = useQueryClient();
  const [dialog, setDialog] = useState<{ open: boolean; item?: DeptItem }>({ open: false });
  const [form, setForm] = useState({ code: '', name: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { data: departments = [], isLoading } = useQuery({
    queryKey: ['admin-departments'],
    queryFn: adminApi.listDepartments,
  });

  function openCreate() { setForm({ code: '', name: '' }); setError(null); setDialog({ open: true }); }
  function openEdit(item: DeptItem) { setForm({ code: item.code, name: item.name }); setError(null); setDialog({ open: true, item }); }

  async function save() {
    if (!form.name.trim()) { setError('Name is required'); return; }
    setSaving(true); setError(null);
    try {
      if (dialog.item) await adminApi.updateDepartment(dialog.item.id, form);
      else await adminApi.createDepartment(form);
      qc.invalidateQueries({ queryKey: ['admin-departments'] });
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
          <Typography variant="h5" fontWeight={600}>Departments</Typography>
          <Typography variant="body2" color="text.secondary">
            Departments are separate from geographic hierarchy (Region/District/Branch).
          </Typography>
        </Box>
        <Button variant="contained" startIcon={<AddIcon />} onClick={openCreate}>Add Department</Button>
      </Box>

      <Paper elevation={1}>
        <TableContainer>
          <Table size="small">
            <TableHead><TableRow>
              <TableCell>#</TableCell><TableCell>Code</TableCell><TableCell>Name</TableCell>
              <TableCell>Status</TableCell><TableCell align="right">Actions</TableCell>
            </TableRow></TableHead>
            <TableBody>
              {(departments as DeptItem[]).length === 0 && (
                <TableRow><TableCell colSpan={5} align="center">No departments yet</TableCell></TableRow>
              )}
              {(departments as DeptItem[]).map((d, i) => (
                <TableRow key={d.id} hover>
                  <TableCell>{i + 1}</TableCell>
                  <TableCell><Typography variant="caption" fontFamily="monospace">{d.code}</Typography></TableCell>
                  <TableCell><Typography variant="body2" fontWeight={500}>{d.name}</Typography></TableCell>
                  <TableCell><Chip label={d.is_active ? 'Active' : 'Inactive'} size="small" color={d.is_active ? 'success' : 'default'} variant="outlined" /></TableCell>
                  <TableCell align="right">
                    <IconButton size="small" onClick={() => openEdit(d)}><EditIcon fontSize="small" /></IconButton>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>

      <Dialog open={dialog.open} onClose={() => setDialog({ open: false })} maxWidth="xs" fullWidth>
        <DialogTitle>{dialog.item ? 'Edit Department' : 'Add Department'}</DialogTitle>
        <DialogContent>
          {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
          <Stack spacing={2} mt={1}>
            <TextField size="small" label="Code" fullWidth value={form.code}
              onChange={e => setForm(p => ({ ...p, code: e.target.value }))}
              helperText="Short code e.g. RETAIL, CORPORATE" />
            <TextField size="small" label="Department Name *" fullWidth value={form.name}
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
