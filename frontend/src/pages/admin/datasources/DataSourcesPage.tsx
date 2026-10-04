import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Alert, Box, Button, Chip, CircularProgress, Dialog, DialogActions,
  DialogContent, DialogTitle, FormControl, InputLabel, MenuItem,
  Paper, Select, Stack, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, TextField, Tooltip, Typography, IconButton,
  Tabs, Tab,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import WifiIcon from '@mui/icons-material/Wifi';
import EditIcon from '@mui/icons-material/Edit';
import UploadFileIcon from '@mui/icons-material/UploadFile';
import apiClient from '@api/client';
import { LoadingState } from '@components/common/LoadingState';
import { dataSourcesApi } from '../api/data-sources.api';

function useDataSources() {
  return useQuery({ queryKey: ['datasources'], queryFn: () => apiClient.get('/data-sources').then(r => r.data) });
}

const EMPTY_FORM = { name: '', source_type: 'POSTGRESQL', description: '', host: 'localhost', port: '5432', database_name: '', service_name: '', schema_name: 'public', api_url: '', username: '', password: '' };

export function DataSourcesPage() {
  const qc = useQueryClient();
  const [dialog, setDialog] = useState<{ mode: 'create' | 'edit'; id?: number } | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [testResult, setTestResult] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [uploadDialog, setUploadDialog] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadMessage, setUploadMessage] = useState<string | null>(null);

  const { data: sources = [], isLoading } = useDataSources();

  function openCreate() { setForm(EMPTY_FORM); setTestResult(null); setDialog({ mode: 'create' }); }
  function openEdit(s: Record<string, unknown>) {
    setForm({ ...EMPTY_FORM, ...(s as typeof EMPTY_FORM), password: '' });
    setTestResult(null); setDialog({ mode: 'edit', id: s.id as number });
  }

  async function save() {
    setSaving(true);
    try {
      if (dialog?.mode === 'create') await apiClient.post('/data-sources', { ...form, port: Number(form.port) });
      else await apiClient.put(`/data-sources/${dialog?.id}`, { ...form, port: Number(form.port) });
      qc.invalidateQueries({ queryKey: ['datasources'] });
      setDialog(null);
    } catch (e: unknown) {
      const err = e as { response?: { data?: { detail?: string } } };
      setTestResult('Error: ' + (err?.response?.data?.detail ?? 'Save failed'));
    } finally { setSaving(false); }
  }

  async function testConn() {
    if (!dialog?.id) { setTestResult('Save first before testing'); return; }
    setTesting(true);
    try {
      const r = await apiClient.post(`/data-sources/${dialog.id}/test`);
      setTestResult(r.data.success ? '✓ Connection successful' : '✗ Connection failed');
    } catch { setTestResult('✗ Test failed'); }
    finally { setTesting(false); }
  }

  async function uploadExcel() {
    if (!selectedFile) {
      setUploadMessage('Please select a file first');
      return;
    }
    setUploading(true);
    setUploadMessage(null);
    try {
      const response = await dataSourcesApi.uploadExcel(selectedFile, selectedFile.name.replace('.xlsx', '').replace('.xls', ''));

      setUploadMessage(`✓ Excel file uploaded successfully! Sheet names: ${response.sheet_names.join(', ')}`);
      qc.invalidateQueries({ queryKey: ['datasources'] });
      setTimeout(() => {
        setUploadDialog(false);
        setSelectedFile(null);
        setUploadMessage(null);
      }, 2000);
    } catch (e: unknown) {
      const err = e as { response?: { data?: { detail?: string } } };
      setUploadMessage('✗ Upload failed: ' + (err?.response?.data?.detail ?? 'Unknown error'));
    } finally {
      setUploading(false);
    }
  }

  if (isLoading) return <LoadingState />;

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h5" fontWeight={600}>Data Sources</Typography>
        <Stack direction="row" spacing={2}>
          <Button variant="outlined" startIcon={<UploadFileIcon />} onClick={() => setUploadDialog(true)}>Upload Excel</Button>
          <Button variant="contained" startIcon={<AddIcon />} onClick={openCreate}>Add Data Source</Button>
        </Stack>
      </Box>
      <Paper elevation={1}>
        <TableContainer>
          <Table size="small">
            <TableHead><TableRow>
              <TableCell>Name</TableCell><TableCell>Type</TableCell>
              <TableCell>Host</TableCell><TableCell>Schema</TableCell>
              <TableCell>Status</TableCell><TableCell align="center">Actions</TableCell>
            </TableRow></TableHead>
            <TableBody>
              {sources.length === 0 && <TableRow><TableCell colSpan={6} align="center">No data sources</TableCell></TableRow>}
              {sources.map((s: Record<string, unknown>) => (
                <TableRow key={s.id as number} hover>
                  <TableCell><Typography variant="body2" fontWeight={500}>{s.name as string}</Typography></TableCell>
                  <TableCell><Chip label={s.source_type as string} size="small" /></TableCell>
                  <TableCell><Typography variant="caption">{(s.host as string) || '—'}{s.port ? `:${s.port}` : ''}</Typography></TableCell>
                  <TableCell><Typography variant="caption">{(s.schema_name as string) || (s.database_name as string) || '—'}</Typography></TableCell>
                  <TableCell><Chip label={s.is_active ? 'Active' : 'Inactive'} size="small" color={s.is_active ? 'success' : 'default'} variant="outlined" /></TableCell>
                  <TableCell align="center">
                    <Tooltip title="Edit"><IconButton size="small" onClick={() => openEdit(s)}><EditIcon fontSize="small" /></IconButton></Tooltip>
                    <Tooltip title="Test Connection"><IconButton size="small" onClick={async () => { const r = await apiClient.post(`/data-sources/${s.id}/test`); alert(r.data.message); }}><WifiIcon fontSize="small" /></IconButton></Tooltip>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>

      {dialog && (
        <Dialog open onClose={() => setDialog(null)} maxWidth="sm" fullWidth>
          <DialogTitle>{dialog.mode === 'create' ? 'Add Data Source' : 'Edit Data Source'}</DialogTitle>
          <DialogContent>
            {testResult && <Alert severity={testResult.startsWith('✓') ? 'success' : 'warning'} sx={{ mb: 2 }}>{testResult}</Alert>}
            <Stack spacing={2} mt={1}>
              <TextField size="small" label="Name" value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} fullWidth />
              <FormControl size="small" fullWidth>
                <InputLabel>Type</InputLabel>
                <Select value={form.source_type} label="Type" onChange={e => setForm(p => ({ ...p, source_type: e.target.value }))}>
                  {['POSTGRESQL', 'ORACLE', 'INTERNAL_API', 'EXCEL'].map(t => <MenuItem key={t} value={t}>{t}</MenuItem>)}
                </Select>
              </FormControl>
              {form.source_type !== 'INTERNAL_API' ? (
                <>
                  <Stack direction="row" spacing={1}>
                    <TextField size="small" label="Host" value={form.host} onChange={e => setForm(p => ({ ...p, host: e.target.value }))} fullWidth />
                    <TextField size="small" label="Port" value={form.port} onChange={e => setForm(p => ({ ...p, port: e.target.value }))} sx={{ width: 90 }} />
                  </Stack>
                  <TextField size="small" label={form.source_type === 'ORACLE' ? 'Service Name' : 'Database Name'} value={form.source_type === 'ORACLE' ? form.service_name : form.database_name} onChange={e => setForm(p => form.source_type === 'ORACLE' ? { ...p, service_name: e.target.value } : { ...p, database_name: e.target.value })} fullWidth />
                  <TextField size="small" label="Schema" value={form.schema_name} onChange={e => setForm(p => ({ ...p, schema_name: e.target.value }))} fullWidth />
                </>
              ) : (
                <TextField size="small" label="API URL" value={form.api_url} onChange={e => setForm(p => ({ ...p, api_url: e.target.value }))} fullWidth />
              )}
              <Stack direction="row" spacing={1}>
                <TextField size="small" label="Username" value={form.username} onChange={e => setForm(p => ({ ...p, username: e.target.value }))} fullWidth />
                <TextField size="small" label="Password" type="password" value={form.password} onChange={e => setForm(p => ({ ...p, password: e.target.value }))} fullWidth />
              </Stack>
              <TextField size="small" label="Description" value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} fullWidth multiline rows={2} />
            </Stack>
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 2 }}>
            {dialog.mode === 'edit' && <Button onClick={testConn} disabled={testing} startIcon={<WifiIcon />}>{testing ? 'Testing…' : 'Test'}</Button>}
            <Box flexGrow={1} />
            <Button onClick={() => setDialog(null)} color="inherit">Cancel</Button>
            <Button onClick={save} variant="contained" disabled={saving}>{saving ? <CircularProgress size={18} color="inherit" /> : 'Save'}</Button>
          </DialogActions>
        </Dialog>
      )}

      {/* Excel Upload Dialog */}
      <Dialog open={uploadDialog} onClose={() => setUploadDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Upload Excel File</DialogTitle>
        <DialogContent>
          {uploadMessage && <Alert severity={uploadMessage.startsWith('✓') ? 'success' : 'warning'} sx={{ mb: 2 }}>{uploadMessage}</Alert>}
          <Stack spacing={2} mt={1}>
            <Typography variant="body2" color="text.secondary">
              Upload an Excel file (.xlsx, .xls) to create a new data source. The file will be processed and available for dataset creation.
            </Typography>
            <Button
              variant="outlined"
              component="label"
              startIcon={<UploadFileIcon />}
              fullWidth
            >
              Browse Excel File
              <input
                type="file"
                accept=".xlsx,.xls"
                hidden
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) setSelectedFile(file);
                }}
              />
            </Button>
            {selectedFile && (
              <Alert severity="info">
                Selected: {selectedFile.name} ({(selectedFile.size / 1024).toFixed(2)} KB)
              </Alert>
            )}
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setUploadDialog(false)} color="inherit">Cancel</Button>
          <Button
            onClick={uploadExcel}
            variant="contained"
            disabled={!selectedFile || uploading}
            startIcon={uploading ? <CircularProgress size={18} color="inherit" /> : <UploadFileIcon />}
          >
            {uploading ? 'Uploading...' : 'Upload'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
