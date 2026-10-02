import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Alert, Box, Button, Chip, CircularProgress, Dialog, DialogActions,
  DialogContent, DialogTitle, FormControl, IconButton, InputLabel,
  MenuItem, Paper, Select, Stack, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, TextField, Tooltip, Typography,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import VisibilityIcon from '@mui/icons-material/Visibility';
import apiClient from '@api/client';
import { LoadingState } from '@components/common/LoadingState';

interface DatasetRow { id: number; name: string; object_name: string; schema_name: string | null; status: string; }
interface SourceRow { id: number; name: string; }

export function DatasetsPage() {
  const qc = useQueryClient();
  const [dialog, setDialog] = useState(false);
  const [form, setForm] = useState({
    name: '', description: '', source_id: '', schema_name: '', object_name: '',
    region_column: '', district_column: '', branch_column: '', status: 'DRAFT',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { data: datasets = [], isLoading } = useQuery({
    queryKey: ['datasets'],
    queryFn: () => apiClient.get('/datasets').then(r => r.data as DatasetRow[]),
  });
  const { data: sources = [] } = useQuery({
    queryKey: ['datasources'],
    queryFn: () => apiClient.get('/data-sources').then(r => r.data as SourceRow[]),
  });

  async function save() {
    setSaving(true); setError(null);
    try {
      await apiClient.post('/datasets', { ...form, source_id: Number(form.source_id) });
      qc.invalidateQueries({ queryKey: ['datasets'] });
      setDialog(false);
      setForm({ name:'',description:'',source_id:'',schema_name:'',object_name:'',region_column:'',district_column:'',branch_column:'',status:'DRAFT' });
    } catch (e: unknown) {
      const err = e as { response?: { data?: { detail?: string } } };
      setError(err?.response?.data?.detail ?? 'Save failed');
    } finally { setSaving(false); }
  }

  async function viewFields(id: number) {
    try {
      const r = await apiClient.get(`/datasets/${id}/fields`);
      const fields = r.data as Array<{ field_name: string; data_type: string }>;
      alert(fields.map(f => `${f.field_name} (${f.data_type})`).join('\n') || 'No fields defined');
    } catch {
      alert('Could not load fields');
    }
  }

  if (isLoading) return <LoadingState />;

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h5" fontWeight={600}>Datasets</Typography>
        <Button variant="contained" startIcon={<AddIcon />}
          onClick={() => { setForm({name:'',description:'',source_id:'',schema_name:'',object_name:'',region_column:'',district_column:'',branch_column:'',status:'DRAFT'}); setDialog(true); }}>
          Register Dataset
        </Button>
      </Box>
      <Paper elevation={1}>
        <TableContainer>
          <Table size="small">
            <TableHead><TableRow>
              <TableCell>Name</TableCell><TableCell>Table / View</TableCell>
              <TableCell>Schema</TableCell><TableCell>Status</TableCell>
              <TableCell align="center">Actions</TableCell>
            </TableRow></TableHead>
            <TableBody>
              {datasets.length === 0 && <TableRow><TableCell colSpan={5} align="center">No datasets registered</TableCell></TableRow>}
              {datasets.map(d => (
                <TableRow key={d.id} hover>
                  <TableCell><Typography variant="body2" fontWeight={500}>{d.name}</Typography></TableCell>
                  <TableCell><Typography variant="caption" fontFamily="monospace">{d.object_name}</Typography></TableCell>
                  <TableCell><Typography variant="caption">{d.schema_name || 'public'}</Typography></TableCell>
                  <TableCell><Chip label={d.status} size="small"
                    color={d.status === 'ACTIVE' ? 'success' : 'default'} variant="outlined" /></TableCell>
                  <TableCell align="center">
                    <Tooltip title="View Fields">
                      <IconButton size="small" onClick={() => viewFields(d.id)}>
                        <VisibilityIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>

      <Dialog open={dialog} onClose={() => setDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Register Dataset</DialogTitle>
        <DialogContent>
          {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
          <Stack spacing={2} mt={1}>
            <TextField size="small" label="Name" fullWidth value={form.name}
              onChange={e => setForm(p => ({ ...p, name: e.target.value }))} />
            <FormControl size="small" fullWidth>
              <InputLabel>Data Source</InputLabel>
              <Select value={form.source_id} label="Data Source"
                onChange={e => setForm(p => ({ ...p, source_id: String(e.target.value) }))}>
                {sources.map(s => <MenuItem key={s.id} value={s.id}>{s.name}</MenuItem>)}
              </Select>
            </FormControl>
            <Stack direction="row" spacing={1}>
              <TextField size="small" label="Schema" value={form.schema_name}
                onChange={e => setForm(p => ({ ...p, schema_name: e.target.value }))} fullWidth />
              <TextField size="small" label="Table / View" value={form.object_name}
                onChange={e => setForm(p => ({ ...p, object_name: e.target.value }))} fullWidth />
            </Stack>
            <Stack direction="row" spacing={1}>
              <TextField size="small" label="Region Column" value={form.region_column}
                onChange={e => setForm(p => ({ ...p, region_column: e.target.value }))} fullWidth />
              <TextField size="small" label="District Column" value={form.district_column}
                onChange={e => setForm(p => ({ ...p, district_column: e.target.value }))} fullWidth />
              <TextField size="small" label="Branch Column" value={form.branch_column}
                onChange={e => setForm(p => ({ ...p, branch_column: e.target.value }))} fullWidth />
            </Stack>
            <TextField size="small" label="Description" multiline rows={2} fullWidth value={form.description}
              onChange={e => setForm(p => ({ ...p, description: e.target.value }))} />
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setDialog(false)} color="inherit">Cancel</Button>
          <Button onClick={save} variant="contained" disabled={saving}>
            {saving ? <CircularProgress size={18} color="inherit" /> : 'Register'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
