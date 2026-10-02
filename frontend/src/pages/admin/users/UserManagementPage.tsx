/**
 * User Management Page — matches the design in the screenshot.
 * Features:
 *  - Stats cards (Total Users, Active Users, Suspended Users)
 *  - Add New User inline form (single) OR bulk import via Excel
 *  - Departments, Regions, Positions reference tables below
 */
import { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Alert, Box, Button, Card, CardContent, Chip, CircularProgress,
  Dialog, DialogActions, DialogContent, DialogTitle, Divider,
  FormControl, Grid, IconButton, InputLabel, MenuItem, Paper,
  Select, Snackbar, Stack, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, Tabs, Tab, TextField,
  Typography, LinearProgress,
} from '@mui/material';
import PeopleIcon from '@mui/icons-material/People';
import PersonAddIcon from '@mui/icons-material/PersonAdd';
import PersonOffIcon from '@mui/icons-material/PersonOff';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import UploadFileIcon from '@mui/icons-material/UploadFile';
import DownloadIcon from '@mui/icons-material/Download';
import { adminApi } from '@api/adminApi';
import apiClient from '@api/client';
import { LoadingState } from '@components/common/LoadingState';
import { organizationApi } from '@api/organization.api';

// ── Types ────────────────────────────────────────────────────────────────────

interface OrgItem { id: number; code: string; name: string; }
interface PositionItem { id: number; code: string; name: string; level: number; }
interface DeptItem { id: number; code: string; name: string; }

// ── Stat Card ─────────────────────────────────────────────────────────────────

function StatCard({ label, value, subtitle, icon, color }: {
  label: string; value: number; subtitle?: string;
  icon: React.ReactNode; color: string;
}) {
  return (
    <Card elevation={1} sx={{ borderRadius: 2 }}>
      <CardContent>
        <Box display="flex" alignItems="center" justifyContent="space-between">
          <Box>
            <Typography variant="body2" color="text.secondary">{label}</Typography>
            <Typography variant="h4" fontWeight={700}>{value}</Typography>
            {subtitle && (
              <Typography variant="caption" color={color}>{subtitle}</Typography>
            )}
          </Box>
          <Box sx={{ bgcolor: `${color}22`, borderRadius: 2, p: 1.5, color }}>
            {icon}
          </Box>
        </Box>
      </CardContent>
    </Card>
  );
}

// ── Ref table (departments, regions, positions) ───────────────────────────────

function RefTable({ title, items, onAdd, onEdit, onDelete, columns }: {
  title: string;
  items: Array<Record<string, unknown>>;
  onAdd: () => void;
  onEdit: (item: Record<string, unknown>) => void;
  onDelete: (id: number) => void;
  columns: Array<{ key: string; label: string }>;
}) {
  return (
    <Paper elevation={1} sx={{ p: 2, borderRadius: 2 }}>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={1.5}>
        <Typography variant="subtitle2" fontWeight={600}>{title}</Typography>
        <Button size="small" variant="contained" startIcon={<AddIcon />} onClick={onAdd}>
          Add {title.split(' ')[1]}
        </Button>
      </Box>
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell sx={{ width: 40 }}>#</TableCell>
            {columns.map(c => <TableCell key={c.key}>{c.label}</TableCell>)}
            <TableCell align="right">Actions</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {items.map((item, idx) => (
            <TableRow key={item.id as number} hover>
              <TableCell>{idx + 1}</TableCell>
              {columns.map(c => (
                <TableCell key={c.key}>
                  <Typography variant="body2">{String(item[c.key] ?? '')}</Typography>
                </TableCell>
              ))}
              <TableCell align="right">
                <IconButton size="small" onClick={() => onEdit(item)}><EditIcon fontSize="small" color="action" /></IconButton>
                <IconButton size="small" onClick={() => onDelete(item.id as number)}><DeleteIcon fontSize="small" color="error" /></IconButton>
              </TableCell>
            </TableRow>
          ))}
          {items.length === 0 && (
            <TableRow><TableCell colSpan={columns.length + 2} align="center">
              <Typography variant="caption" color="text.disabled">No items yet</Typography>
            </TableCell></TableRow>
          )}
        </TableBody>
      </Table>
    </Paper>
  );
}

// ── Bulk Import Panel ─────────────────────────────────────────────────────────

function BulkImportPanel({ onSuccess }: { onSuccess: () => void }) {
  const [file, setFile] = useState<File | null>(null);
  const [result, setResult] = useState<Record<string, unknown> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [dryRun, setDryRun] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  async function downloadTemplate() {
    const resp = await apiClient.get('/import/template', { responseType: 'blob' });
    const url = URL.createObjectURL(resp.data as Blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'cbe_user_import_template.xlsx'; a.click();
    URL.revokeObjectURL(url);
  }

  async function handleImport() {
    if (!file) return;
    setLoading(true); setError(null); setResult(null);
    const form = new FormData();
    form.append('file', file);
    try {
      const resp = await apiClient.post(`/import/users?dry_run=${dryRun}`, form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setResult(resp.data);
      if (!dryRun) onSuccess();
    } catch (e: unknown) {
      const err = e as { response?: { data?: { detail?: string } } };
      setError(err?.response?.data?.detail ?? 'Import failed');
    } finally { setLoading(false); }
  }

  const summary = result?.summary as Record<string, unknown> | undefined;
  const rows = result?.results as Array<Record<string, unknown>> | undefined;

  return (
    <Box>
      <Typography variant="body2" color="text.secondary" mb={2}>
        Import multiple users at once using the Excel template. Download the template,
        fill it in, then upload it here.
      </Typography>

      <Stack direction="row" spacing={2} alignItems="center" mb={2}>
        <Button variant="outlined" startIcon={<DownloadIcon />} onClick={downloadTemplate}>
          Download Template
        </Button>
        <Button
          variant="outlined"
          startIcon={<UploadFileIcon />}
          onClick={() => fileRef.current?.click()}
        >
          {file ? file.name : 'Select Excel File'}
        </Button>
        <input
          ref={fileRef} type="file" accept=".xlsx,.xls" hidden
          onChange={e => { setFile(e.target.files?.[0] ?? null); setResult(null); }}
        />
        <FormControl size="small" sx={{ minWidth: 140 }}>
          <InputLabel>Mode</InputLabel>
          <Select value={dryRun ? 'dry' : 'import'} label="Mode"
            onChange={e => setDryRun(e.target.value === 'dry')}>
            <MenuItem value="import">Import</MenuItem>
            <MenuItem value="dry">Dry Run (validate only)</MenuItem>
          </Select>
        </FormControl>
        <Button
          variant="contained"
          disabled={!file || loading}
          onClick={handleImport}
          startIcon={loading ? <CircularProgress size={16} color="inherit" /> : <UploadFileIcon />}
        >
          {dryRun ? 'Validate' : 'Import Users'}
        </Button>
      </Stack>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      {summary && (
        <Box>
          <Alert
            severity={summary.errors as number > 0 ? 'warning' : 'success'}
            sx={{ mb: 2 }}
          >
            {dryRun ? 'Validation result: ' : 'Import complete: '}
            <strong>{summary.created as number}</strong> {dryRun ? 'would be created' : 'created'} ·
            <strong> {summary.skipped as number}</strong> skipped ·
            <strong> {summary.errors as number}</strong> errors
            {' '}(of {summary.total_rows as number} rows)
          </Alert>

          {rows && rows.length > 0 && (
            <TableContainer component={Paper} variant="outlined" sx={{ maxHeight: 300 }}>
              <Table size="small" stickyHeader>
                <TableHead>
                  <TableRow>
                    <TableCell>Row</TableCell>
                    <TableCell>Username</TableCell>
                    <TableCell>Email</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell>Note</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {rows.map(r => (
                    <TableRow key={r.row as number}>
                      <TableCell>{r.row as number}</TableCell>
                      <TableCell>{r.username as string || '—'}</TableCell>
                      <TableCell>{r.email as string || '—'}</TableCell>
                      <TableCell>
                        <Chip
                          label={r.status as string}
                          size="small"
                          color={
                            r.status === 'created' ? 'success' :
                            r.status === 'error' ? 'error' :
                            r.status === 'dry_run' ? 'info' : 'default'
                          }
                          variant="outlined"
                        />
                      </TableCell>
                      <TableCell>
                        <Typography variant="caption" color="text.secondary">
                          {(r.reason as string) || (r.note as string) || ''}
                        </Typography>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </Box>
      )}
    </Box>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export function UserManagementPage() {
  const qc = useQueryClient();
  const [tab, setTab] = useState(0); // 0 = single, 1 = bulk
  const [snack, setSnack] = useState('');

  // Quick add form state
  const [quickForm, setQuickForm] = useState({
    email: '', full_name: '', access_level: '', department: '',
    region_id: '', position: '',
  });
  const [quickError, setQuickError] = useState('');
  const [quickLoading, setQuickLoading] = useState(false);

  // Reference table dialogs
  const [deptDialog, setDeptDialog] = useState<{ open: boolean; item?: Record<string, unknown> }>({ open: false });
  const [regionDialog, setRegionDialog] = useState<{ open: boolean; item?: Record<string, unknown> }>({ open: false });
  const [posDialog, setPosDialog] = useState<{ open: boolean; item?: Record<string, unknown> }>({ open: false });
  const [refForm, setRefForm] = useState({ code: '', name: '', level: '0' });

  const { data: usersData, isLoading: usersLoading } = useQuery({
    queryKey: ['admin-users'],
    queryFn: () => adminApi.listUsers({ page_size: 200 }),
  });

  const { data: departments = [] } = useQuery({ queryKey: ['admin-departments'], queryFn: adminApi.listDepartments });
  const { data: regions = [] } = useQuery({ queryKey: ['regions-all'], queryFn: organizationApi.getAllRegions });
  const { data: positions = [] } = useQuery({ queryKey: ['admin-positions'], queryFn: adminApi.listPositions });
  const { data: roles = [] } = useQuery({ queryKey: ['admin-roles'], queryFn: adminApi.listRoles });

  const users = (usersData as { items: Array<Record<string, unknown>> })?.items ?? [];
  const totalUsers = (usersData as { total: number })?.total ?? 0;
  const activeUsers = users.filter(u => u.is_active).length;
  const suspendedUsers = users.filter(u => !u.is_active).length;
  const activePercent = totalUsers > 0 ? Math.round((activeUsers / totalUsers) * 100) : 0;
  const suspendedPercent = totalUsers > 0 ? Math.round((suspendedUsers / totalUsers) * 100) : 0;

  async function handleQuickAdd() {
    if (!quickForm.email || !quickForm.full_name) {
      setQuickError('Email and Full Name are required');
      return;
    }
    setQuickLoading(true); setQuickError('');
    try {
      const viewerRole = (roles as Array<{ id: number; name: string }>).find(r => r.name === 'VIEWER');
      await adminApi.createUser({
        username: quickForm.email.split('@')[0].replace(/[^a-zA-Z0-9.]/g, '').toLowerCase(),
        full_name: quickForm.full_name,
        email: quickForm.email,
        access_level: quickForm.access_level || 'HEAD_OFFICE',
        region_id: quickForm.region_id ? Number(quickForm.region_id) : null,
        role_id: viewerRole?.id ?? 7,
        password: 'Temp@1234',
        is_active: true,
      });
      qc.invalidateQueries({ queryKey: ['admin-users'] });
      setQuickForm({ email: '', full_name: '', access_level: '', department: '', region_id: '', position: '' });
      setSnack('User added successfully');
    } catch (e: unknown) {
      const err = e as { response?: { data?: { detail?: string } } };
      setQuickError(err?.response?.data?.detail ?? 'Failed to add user');
    } finally { setQuickLoading(false); }
  }

  async function handleRefSave(type: 'dept' | 'region' | 'pos', isEdit: boolean, id?: number) {
    try {
      if (type === 'dept') {
        if (isEdit && id) await adminApi.updateDepartment(id, refForm);
        else await adminApi.createDepartment(refForm);
        qc.invalidateQueries({ queryKey: ['admin-departments'] });
        setDeptDialog({ open: false });
      } else if (type === 'region') {
        if (isEdit && id) await organizationApi.updateRegion(id, { ...refForm, status: 'ACTIVE' });
        else await organizationApi.createRegion(refForm);
        qc.invalidateQueries({ queryKey: ['regions-all'] });
        setRegionDialog({ open: false });
      } else {
        if (isEdit && id) await adminApi.updatePosition(id, { ...refForm, level: Number(refForm.level) });
        else await adminApi.createPosition({ ...refForm, level: Number(refForm.level) });
        qc.invalidateQueries({ queryKey: ['admin-positions'] });
        setPosDialog({ open: false });
      }
      setSnack('Saved successfully');
    } catch (e: unknown) {
      const err = e as { response?: { data?: { detail?: string } } };
      setSnack('Error: ' + (err?.response?.data?.detail ?? 'Save failed'));
    }
  }

  if (usersLoading) return <LoadingState />;

  return (
    <Box>
      <Typography variant="h5" fontWeight={600} mb={0.5}>User Management</Typography>
      <Typography variant="body2" color="text.secondary" mb={3}>
        Manage system users, assign dashboards and set permissions.
      </Typography>

      {/* Stats row */}
      <Grid container spacing={2} mb={3}>
        <Grid item xs={12} sm={4}>
          <StatCard label="Total Users" value={totalUsers} icon={<PeopleIcon />} color="#1a3a5c" />
        </Grid>
        <Grid item xs={12} sm={4}>
          <StatCard label="Active Users" value={activeUsers} subtitle={`${activePercent}%`}
            icon={<PersonAddIcon />} color="#2e7d32" />
        </Grid>
        <Grid item xs={12} sm={4}>
          <StatCard label="Suspended Users" value={suspendedUsers} subtitle={`${suspendedPercent}%`}
            icon={<PersonOffIcon />} color="#d32f2f" />
        </Grid>
      </Grid>

      {/* Add User section */}
      <Paper elevation={1} sx={{ p: 3, mb: 3, borderRadius: 2 }}>
        <Typography variant="h6" fontWeight={600} mb={0.5}>Add New User</Typography>
        <Typography variant="body2" color="text.secondary" mb={2}>
          Enter user details and assign access permissions.
        </Typography>

        <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 2 }}>
          <Tab label="Single User" />
          <Tab label="Bulk Import (Excel)" icon={<UploadFileIcon fontSize="small" />} iconPosition="end" />
        </Tabs>

        {tab === 0 && (
          <Box>
            {quickError && <Alert severity="error" sx={{ mb: 2 }}>{quickError}</Alert>}
            <Grid container spacing={2}>
              <Grid item xs={12} sm={4}>
                <TextField
                  label="Email Address *"
                  type="email"
                  fullWidth
                  size="small"
                  value={quickForm.email}
                  onChange={e => setQuickForm(p => ({ ...p, email: e.target.value }))}
                  placeholder="Enter email address"
                />
              </Grid>
              <Grid item xs={12} sm={4}>
                <TextField
                  label="Full Name *"
                  fullWidth
                  size="small"
                  value={quickForm.full_name}
                  onChange={e => setQuickForm(p => ({ ...p, full_name: e.target.value }))}
                  placeholder="Full name (will be auto-filled from email)"
                />
              </Grid>
              <Grid item xs={12} sm={4}>
                <FormControl size="small" fullWidth>
                  <InputLabel>Dashboard Access</InputLabel>
                  <Select value="" label="Dashboard Access">
                    <MenuItem value="">Select dashboard(s)</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} sm={4}>
                <FormControl size="small" fullWidth>
                  <InputLabel>Department</InputLabel>
                  <Select
                    value={quickForm.department}
                    label="Department"
                    onChange={e => setQuickForm(p => ({ ...p, department: String(e.target.value) }))}
                  >
                    <MenuItem value="">Select department</MenuItem>
                    {(departments as DeptItem[]).map(d => (
                      <MenuItem key={d.id} value={d.code}>{d.name}</MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} sm={4}>
                <FormControl size="small" fullWidth>
                  <InputLabel>Region</InputLabel>
                  <Select
                    value={quickForm.region_id}
                    label="Region"
                    onChange={e => setQuickForm(p => ({ ...p, region_id: String(e.target.value) }))}
                  >
                    <MenuItem value="">Select region</MenuItem>
                    {(regions as OrgItem[]).map(r => (
                      <MenuItem key={r.id} value={r.id}>{r.name}</MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} sm={4}>
                <FormControl size="small" fullWidth>
                  <InputLabel>Position</InputLabel>
                  <Select
                    value={quickForm.position}
                    label="Position"
                    onChange={e => setQuickForm(p => ({ ...p, position: String(e.target.value) }))}
                  >
                    <MenuItem value="">Select position</MenuItem>
                    {(positions as PositionItem[]).map(p => (
                      <MenuItem key={p.id} value={p.code}>{p.name}</MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
            </Grid>
            <Alert severity="info" sx={{ mt: 2, mb: 2 }}>
              If you do not select a dashboard, department, region or position, the user will have access to all available data and dashboards.
            </Alert>
            <Box display="flex" justifyContent="flex-end" gap={2}>
              <Button variant="outlined" onClick={() => setQuickForm({ email: '', full_name: '', access_level: '', department: '', region_id: '', position: '' })}>
                Cancel
              </Button>
              <Button variant="contained" startIcon={<AddIcon />} disabled={quickLoading}
                onClick={handleQuickAdd} sx={{ bgcolor: '#1a3a5c', '&:hover': { bgcolor: '#0f2540' } }}>
                {quickLoading ? <CircularProgress size={18} color="inherit" /> : '+ Add User'}
              </Button>
            </Box>
          </Box>
        )}

        {tab === 1 && (
          <BulkImportPanel onSuccess={() => {
            qc.invalidateQueries({ queryKey: ['admin-users'] });
            setSnack('Users imported successfully');
          }} />
        )}
      </Paper>

      {/* Reference Tables */}
      <Grid container spacing={2}>
        <Grid item xs={12} md={4}>
          <RefTable
            title="Departments"
            items={departments as Array<Record<string, unknown>>}
            columns={[{ key: 'name', label: 'Department Name' }]}
            onAdd={() => { setRefForm({ code: '', name: '', level: '0' }); setDeptDialog({ open: true }); }}
            onEdit={(item) => { setRefForm({ code: item.code as string, name: item.name as string, level: '0' }); setDeptDialog({ open: true, item }); }}
            onDelete={(id) => adminApi.updateDepartment(id, { code: '', name: 'deleted' }).then(() => qc.invalidateQueries({ queryKey: ['admin-departments'] }))}
          />
        </Grid>
        <Grid item xs={12} md={4}>
          <RefTable
            title="Regions"
            items={(regions as unknown) as Array<Record<string, unknown>>}
            columns={[{ key: 'name', label: 'Region Name' }]}
            onAdd={() => { setRegionDialog({ open: true }); }}
            onEdit={(item) => { setRefForm({ code: (item as {code:string}).code, name: (item as {name:string}).name, level: '0' }); setRegionDialog({ open: true, item: item as Record<string,unknown> }); }}
            onDelete={() => setSnack('Regions cannot be deleted — deactivate them in Organization settings')}
          />
        </Grid>
        <Grid item xs={12} md={4}>
          <RefTable
            title="Positions"
            items={positions as Array<Record<string, unknown>>}
            columns={[{ key: 'name', label: 'Position Name' }]}
            onAdd={() => { setRefForm({ code: '', name: '', level: '0' }); setPosDialog({ open: true }); }}
            onEdit={(item) => { setRefForm({ code: item.code as string, name: item.name as string, level: String(item.level ?? 0) }); setPosDialog({ open: true, item }); }}
            onDelete={(id) => adminApi.updatePosition(id, { code: '', name: 'deleted', level: 0 }).then(() => qc.invalidateQueries({ queryKey: ['admin-positions'] }))}
          />
        </Grid>
      </Grid>

      {/* Department Dialog */}
      <Dialog open={deptDialog.open} onClose={() => setDeptDialog({ open: false })} maxWidth="xs" fullWidth>
        <DialogTitle>{deptDialog.item ? 'Edit Department' : 'Add Department'}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} mt={1}>
            <TextField size="small" label="Code" fullWidth value={refForm.code} onChange={e => setRefForm(p => ({ ...p, code: e.target.value }))} />
            <TextField size="small" label="Department Name" fullWidth value={refForm.name} onChange={e => setRefForm(p => ({ ...p, name: e.target.value }))} />
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setDeptDialog({ open: false })} color="inherit">Cancel</Button>
          <Button variant="contained" onClick={() => handleRefSave('dept', !!deptDialog.item, deptDialog.item?.id as number)}>Save</Button>
        </DialogActions>
      </Dialog>

      {/* Region Dialog */}
      <Dialog open={regionDialog.open} onClose={() => setRegionDialog({ open: false })} maxWidth="xs" fullWidth>
        <DialogTitle>{regionDialog.item ? 'Edit Region' : 'Add Region'}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} mt={1}>
            <TextField size="small" label="Code" fullWidth value={refForm.code} onChange={e => setRefForm(p => ({ ...p, code: e.target.value }))} />
            <TextField size="small" label="Region Name" fullWidth value={refForm.name} onChange={e => setRefForm(p => ({ ...p, name: e.target.value }))} />
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setRegionDialog({ open: false })} color="inherit">Cancel</Button>
          <Button variant="contained" onClick={() => handleRefSave('region', !!regionDialog.item, regionDialog.item?.id as number)}>Save</Button>
        </DialogActions>
      </Dialog>

      {/* Position Dialog */}
      <Dialog open={posDialog.open} onClose={() => setPosDialog({ open: false })} maxWidth="xs" fullWidth>
        <DialogTitle>{posDialog.item ? 'Edit Position' : 'Add Position'}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} mt={1}>
            <TextField size="small" label="Code" fullWidth value={refForm.code} onChange={e => setRefForm(p => ({ ...p, code: e.target.value }))} />
            <TextField size="small" label="Position Name" fullWidth value={refForm.name} onChange={e => setRefForm(p => ({ ...p, name: e.target.value }))} />
            <TextField size="small" label="Level (seniority)" type="number" fullWidth value={refForm.level} onChange={e => setRefForm(p => ({ ...p, level: e.target.value }))} />
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setPosDialog({ open: false })} color="inherit">Cancel</Button>
          <Button variant="contained" onClick={() => handleRefSave('pos', !!posDialog.item, posDialog.item?.id as number)}>Save</Button>
        </DialogActions>
      </Dialog>

      <Snackbar open={!!snack} autoHideDuration={4000} onClose={() => setSnack('')}
        message={snack} anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }} />
    </Box>
  );
}
