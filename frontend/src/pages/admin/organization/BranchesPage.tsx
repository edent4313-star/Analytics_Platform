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
import type { Branch, District, Region } from '@/types/organization.types';
import { LoadingState } from '@components/common/LoadingState';

export function BranchesPage() {
  const qc = useQueryClient();
  const [filterRegion, setFilterRegion] = useState<number | ''>('');
  const [filterDistrict, setFilterDistrict] = useState<number | ''>('');
  const [dialog, setDialog] = useState<{ open: boolean; item?: Branch }>({ open: false });
  const [form, setForm] = useState({ code: '', name: '', region_id: '', district_id: '', status: 'ACTIVE' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { data: regions = [] } = useQuery({ queryKey: ['regions-all'], queryFn: organizationApi.getAllRegions });
  const { data: allDistricts = [] } = useQuery({ queryKey: ['districts-admin', undefined], queryFn: () => organizationApi.getAllDistricts() });
  const { data: branches = [], isLoading } = useQuery({
    queryKey: ['branches-admin', filterDistrict || undefined, filterRegion || undefined],
    queryFn: () => organizationApi.getAllBranches(filterDistrict || undefined, filterRegion || undefined),
  });

  const dialogDistricts = (allDistricts as District[]).filter(d =>
    !form.region_id || d.region_id === Number(form.region_id)
  );
  const filterDistricts = (allDistricts as District[]).filter(d =>
    !filterRegion || d.region_id === filterRegion
  );

  function openCreate() {
    setForm({ code: '', name: '', region_id: filterRegion ? String(filterRegion) : '', district_id: filterDistrict ? String(filterDistrict) : '', status: 'ACTIVE' });
    setError(null); setDialog({ open: true });
  }
  function openEdit(item: Branch) {
    setForm({ code: item.code, name: item.name, region_id: String(item.region_id), district_id: String(item.district_id), status: item.status });
    setError(null); setDialog({ open: true, item });
  }

  async function save() {
    if (!form.name.trim() || !form.code.trim() || !form.region_id || !form.district_id) {
      setError('Code, Name, Region, and District are all required'); return;
    }
    setSaving(true); setError(null);
    try {
      const data = { code: form.code, name: form.name, region_id: Number(form.region_id), district_id: Number(form.district_id), status: form.status };
      if (dialog.item) await organizationApi.updateBranch(dialog.item.id, data);
      else await organizationApi.createBranch(data);
      qc.invalidateQueries({ queryKey: ['branches-admin', filterDistrict || undefined, filterRegion || undefined] });
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
          <Typography variant="h5" fontWeight={600}>Branches</Typography>
          <Typography variant="body2" color="text.secondary">Head Office → Region → District → <strong>BRANCH</strong></Typography>
        </Box>
        <Button variant="contained" startIcon={<AddIcon />} onClick={openCreate}>Add Branch</Button>
      </Box>

      {/* Filters */}
      <Stack direction="row" spacing={2} mb={2}>
        <FormControl size="small" sx={{ minWidth: 200 }}>
          <InputLabel>Filter by Region</InputLabel>
          <Select value={filterRegion} label="Filter by Region"
            onChange={e => { setFilterRegion(e.target.value as number | ''); setFilterDistrict(''); }}>
            <MenuItem value="">All</MenuItem>
            {(regions as Region[]).map(r => <MenuItem key={r.id} value={r.id}>{r.name}</MenuItem>)}
          </Select>
        </FormControl>
        <FormControl size="small" sx={{ minWidth: 200 }} disabled={!filterRegion}>
          <InputLabel>Filter by District</InputLabel>
          <Select value={filterDistrict} label="Filter by District"
            onChange={e => setFilterDistrict(e.target.value as number | '')}>
            <MenuItem value="">All</MenuItem>
            {filterDistricts.map((d: District) => <MenuItem key={d.id} value={d.id}>{d.name}</MenuItem>)}
          </Select>
        </FormControl>
      </Stack>

      <Paper elevation={1}>
        <TableContainer>
          <Table size="small">
            <TableHead><TableRow>
              <TableCell>#</TableCell><TableCell>Code</TableCell><TableCell>Name</TableCell>
              <TableCell>District</TableCell><TableCell>Region</TableCell>
              <TableCell>Status</TableCell><TableCell align="right">Actions</TableCell>
            </TableRow></TableHead>
            <TableBody>
              {(branches as Branch[]).length === 0 && (
                <TableRow><TableCell colSpan={7} align="center">No branches found</TableCell></TableRow>
              )}
              {(branches as Branch[]).map((b, i) => {
                const district = (allDistricts as District[]).find(d => d.id === b.district_id);
                const region = (regions as Region[]).find(r => r.id === b.region_id);
                return (
                  <TableRow key={b.id} hover>
                    <TableCell>{i + 1}</TableCell>
                    <TableCell><Typography variant="caption" fontFamily="monospace">{b.code}</Typography></TableCell>
                    <TableCell><Typography variant="body2" fontWeight={500}>{b.name}</Typography></TableCell>
                    <TableCell><Typography variant="caption">{district?.name ?? `#${b.district_id}`}</Typography></TableCell>
                    <TableCell><Typography variant="caption">{region?.name ?? `#${b.region_id}`}</Typography></TableCell>
                    <TableCell><Chip label={b.status} size="small" color={b.status === 'ACTIVE' ? 'success' : 'default'} variant="outlined" /></TableCell>
                    <TableCell align="right">
                      <IconButton size="small" onClick={() => openEdit(b)}><EditIcon fontSize="small" /></IconButton>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>

      <Dialog open={dialog.open} onClose={() => setDialog({ open: false })} maxWidth="xs" fullWidth>
        <DialogTitle>{dialog.item ? 'Edit Branch' : 'Add Branch'}</DialogTitle>
        <DialogContent>
          {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
          <Stack spacing={2} mt={1}>
            <FormControl size="small" fullWidth>
              <InputLabel>Region *</InputLabel>
              <Select value={form.region_id} label="Region *"
                onChange={e => setForm(p => ({ ...p, region_id: String(e.target.value), district_id: '' }))}>
                {(regions as Region[]).map(r => <MenuItem key={r.id} value={r.id}>{r.name}</MenuItem>)}
              </Select>
            </FormControl>
            <FormControl size="small" fullWidth disabled={!form.region_id}>
              <InputLabel>District *</InputLabel>
              <Select value={form.district_id} label="District *"
                onChange={e => setForm(p => ({ ...p, district_id: String(e.target.value) }))}>
                {dialogDistricts.map((d: District) => <MenuItem key={d.id} value={d.id}>{d.name}</MenuItem>)}
              </Select>
            </FormControl>
            <TextField size="small" label="Code *" fullWidth value={form.code}
              onChange={e => setForm(p => ({ ...p, code: e.target.value }))} helperText="e.g. B001" />
            <TextField size="small" label="Branch Name *" fullWidth value={form.name}
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
