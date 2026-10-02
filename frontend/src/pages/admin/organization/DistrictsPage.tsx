import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Alert, Box, Button, Chip, CircularProgress, Dialog, DialogActions,
  DialogContent, DialogTitle, FormControl, IconButton, InputLabel,
  MenuItem, Paper, Select, Stack, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, TextField, Typography,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import { organizationApi } from '@api/organization.api';
import type { District, Region } from '@/types/organization.types';
import { LoadingState } from '@components/common/LoadingState';

export function DistrictsPage() {
  const qc = useQueryClient();
  const [filterRegion, setFilterRegion] = useState<number | ''>('');
  const [dialog, setDialog] = useState<{ open: boolean; item?: District }>({ open: false });
  const [form, setForm] = useState({ code: '', name: '', region_id: '', status: 'ACTIVE' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { data: regions = [] } = useQuery({ queryKey: ['regions-all'], queryFn: organizationApi.getAllRegions });
  const { data: districts = [], isLoading } = useQuery({
    queryKey: ['districts-admin', filterRegion || undefined],
    queryFn: () => organizationApi.getAllDistricts(filterRegion || undefined),
  });

  function openCreate() { setForm({ code: '', name: '', region_id: filterRegion ? String(filterRegion) : '', status: 'ACTIVE' }); setError(null); setDialog({ open: true }); }
  function openEdit(item: District) { setForm({ code: item.code, name: item.name, region_id: String(item.region_id), status: item.status }); setError(null); setDialog({ open: true, item }); }

  async function save() {
    if (!form.name.trim() || !form.code.trim() || !form.region_id) { setError('Code, Name, and Region are required'); return; }
    setSaving(true); setError(null);
    try {
      const data = { code: form.code, name: form.name, region_id: Number(form.region_id), status: form.status };
      if (dialog.item) await organizationApi.updateDistrict(dialog.item.id, data);
      else await organizationApi.createDistrict(data);
      qc.invalidateQueries({ queryKey: ['districts-admin', filterRegion || undefined] });
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
          <Typography variant="h5" fontWeight={600}>Districts</Typography>
          <Typography variant="body2" color="text.secondary">Head Office → Region → <strong>DISTRICT</strong> → Branch</Typography>
        </Box>
        <Button variant="contained" startIcon={<AddIcon />} onClick={openCreate}>Add District</Button>
      </Box>

      {/* Filter by region */}
      <FormControl size="small" sx={{ minWidth: 240, mb: 2 }}>
        <InputLabel>Filter by Region</InputLabel>
        <Select value={filterRegion} label="Filter by Region" onChange={e => setFilterRegion(e.target.value as number | '')}>
          <MenuItem value="">All Regions</MenuItem>
          {(regions as Region[]).map(r => <MenuItem key={r.id} value={r.id}>{r.name}</MenuItem>)}
        </Select>
      </FormControl>

      <Paper elevation={1}>
        <TableContainer>
          <Table size="small">
            <TableHead><TableRow>
              <TableCell>#</TableCell><TableCell>Code</TableCell><TableCell>Name</TableCell>
              <TableCell>Region</TableCell><TableCell>Status</TableCell><TableCell align="right">Actions</TableCell>
            </TableRow></TableHead>
            <TableBody>
              {(districts as District[]).length === 0 && (
                <TableRow><TableCell colSpan={6} align="center">No districts found</TableCell></TableRow>
              )}
              {(districts as District[]).map((d, i) => {
                const region = (regions as Region[]).find(r => r.id === d.region_id);
                return (
                  <TableRow key={d.id} hover>
                    <TableCell>{i + 1}</TableCell>
                    <TableCell><Typography variant="caption" fontFamily="monospace">{d.code}</Typography></TableCell>
                    <TableCell><Typography variant="body2" fontWeight={500}>{d.name}</Typography></TableCell>
                    <TableCell><Typography variant="caption">{region?.name ?? `#${d.region_id}`}</Typography></TableCell>
                    <TableCell><Chip label={d.status} size="small" color={d.status === 'ACTIVE' ? 'success' : 'default'} variant="outlined" /></TableCell>
                    <TableCell align="right">
                      <IconButton size="small" onClick={() => openEdit(d)}><EditIcon fontSize="small" /></IconButton>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>

      <Dialog open={dialog.open} onClose={() => setDialog({ open: false })} maxWidth="xs" fullWidth>
        <DialogTitle>{dialog.item ? 'Edit District' : 'Add District'}</DialogTitle>
        <DialogContent>
          {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
          <Stack spacing={2} mt={1}>
            <FormControl size="small" fullWidth>
              <InputLabel>Region *</InputLabel>
              <Select value={form.region_id} label="Region *" onChange={e => setForm(p => ({ ...p, region_id: String(e.target.value) }))}>
                {(regions as Region[]).map(r => <MenuItem key={r.id} value={r.id}>{r.name}</MenuItem>)}
              </Select>
            </FormControl>
            <TextField size="small" label="Code *" fullWidth value={form.code} onChange={e => setForm(p => ({ ...p, code: e.target.value }))} helperText="e.g. D01" />
            <TextField size="small" label="District Name *" fullWidth value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} />
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
