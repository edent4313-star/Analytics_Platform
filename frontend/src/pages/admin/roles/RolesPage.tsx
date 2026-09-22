import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Alert, Box, Button, Checkbox, Chip, CircularProgress,
  Dialog, DialogActions, DialogContent, DialogTitle,
  Divider, FormControlLabel, Grid, List, ListItem,
  ListItemButton, ListItemText, Paper, TextField, Typography,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import SecurityIcon from '@mui/icons-material/Security';
import { rolesApi, permissionsApi, type Role, type Permission } from '@api/roles.api';
import { LoadingState } from '@components/common/LoadingState';

export function RolesPage() {
  const qc = useQueryClient();
  const [selected, setSelected] = useState<Role | null>(null);
  const [roleDialog, setRoleDialog] = useState<{ mode: 'create' | 'edit'; role?: Role } | null>(null);
  const [permDialog, setPermDialog] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [roleForm, setRoleForm] = useState({ name: '', display_name: '', description: '' });
  const [selectedPerms, setSelectedPerms] = useState<number[]>([]);

  const { data: roles = [], isLoading } = useQuery({ queryKey: ['roles'], queryFn: rolesApi.list });
  const { data: allPerms = [] } = useQuery({ queryKey: ['permissions'], queryFn: permissionsApi.list });
  const { data: rolePerms = [] } = useQuery({
    queryKey: ['role-perms', selected?.id],
    queryFn: () => rolesApi.getPermissions(selected!.id),
    enabled: !!selected,
  });

  // Group permissions by category
  const permsByCategory = allPerms.reduce((acc, p) => {
    if (!acc[p.category]) acc[p.category] = [];
    acc[p.category].push(p);
    return acc;
  }, {} as Record<string, Permission[]>);

  async function saveRole(form: typeof roleForm) {
    setSaving(true); setError(null);
    try {
      if (roleDialog?.mode === 'create') await rolesApi.create(form);
      else if (roleDialog?.role) await rolesApi.update(roleDialog.role.id, form);
      qc.invalidateQueries({ queryKey: ['roles'] });
      setRoleDialog(null);
    } catch (e: unknown) {
      const err = e as { response?: { data?: { detail?: string } } };
      setError(err?.response?.data?.detail ?? 'Failed to save role');
    } finally { setSaving(false); }
  }

  async function savePermissions() {
    if (!selected) return;
    setSaving(true); setError(null);
    try {
      await rolesApi.setPermissions(selected.id, selectedPerms);
      qc.invalidateQueries({ queryKey: ['role-perms', selected.id] });
      setPermDialog(false);
    } catch (e: unknown) {
      const err = e as { response?: { data?: { detail?: string } } };
      setError(err?.response?.data?.detail ?? 'Failed to save permissions');
    } finally { setSaving(false); }
  }

  function openPermDialog() {
    setSelectedPerms(rolePerms.map(p => p.id));
    setPermDialog(true);
  }

  if (isLoading) return <LoadingState />;

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h5" fontWeight={600}>Roles</Typography>
        <Button variant="contained" startIcon={<AddIcon />} onClick={() => { setRoleForm({ name: '', display_name: '', description: '' }); setRoleDialog({ mode: 'create' }); }}>
          Create Role
        </Button>
      </Box>

      <Grid container spacing={2}>
        {/* Role list */}
        <Grid item xs={12} md={4}>
          <Paper elevation={1}>
            <List disablePadding>
              {roles.map((role, i) => (
                <Box key={role.id}>
                  {i > 0 && <Divider />}
                  <ListItem disablePadding secondaryAction={
                    !role.is_system && (
                      <Button size="small" startIcon={<EditIcon />} onClick={() => { setRoleForm({ name: role.name, display_name: role.display_name, description: role.description ?? '' }); setRoleDialog({ mode: 'edit', role }); }}>Edit</Button>
                    )
                  }>
                    <ListItemButton selected={selected?.id === role.id} onClick={() => setSelected(role)}>
                      <ListItemText
                        primary={<Box display="flex" alignItems="center" gap={1}>{role.display_name}{role.is_system && <Chip label="System" size="small" />}</Box>}
                        secondary={role.name}
                      />
                    </ListItemButton>
                  </ListItem>
                </Box>
              ))}
            </List>
          </Paper>
        </Grid>

        {/* Permissions for selected role */}
        <Grid item xs={12} md={8}>
          {selected ? (
            <Paper elevation={1} sx={{ p: 2 }}>
              <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
                <Box>
                  <Typography variant="h6" fontWeight={600}>{selected.display_name}</Typography>
                  <Typography variant="body2" color="text.secondary">Assigned permissions</Typography>
                </Box>
                {!selected.is_system && (
                  <Button variant="outlined" startIcon={<SecurityIcon />} onClick={openPermDialog}>
                    Manage Permissions
                  </Button>
                )}
              </Box>
              <Grid container spacing={1}>
                {rolePerms.map(p => (
                  <Grid item key={p.id}>
                    <Chip label={p.code} size="small" variant="outlined" color="primary" />
                  </Grid>
                ))}
                {rolePerms.length === 0 && <Grid item><Typography variant="body2" color="text.secondary">No permissions assigned</Typography></Grid>}
              </Grid>
            </Paper>
          ) : (
            <Paper elevation={1} sx={{ p: 4, textAlign: 'center' }}>
              <SecurityIcon sx={{ fontSize: 48, color: 'text.disabled', mb: 1 }} />
              <Typography color="text.secondary">Select a role to view its permissions</Typography>
            </Paper>
          )}
        </Grid>
      </Grid>

      {/* Role create/edit dialog */}
      {roleDialog && (
        <Dialog open onClose={() => setRoleDialog(null)} maxWidth="xs" fullWidth>
          <DialogTitle>{roleDialog.mode === 'create' ? 'Create Role' : 'Edit Role'}</DialogTitle>
          <DialogContent>
            {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
            <TextField label="Role Name (code)" fullWidth value={roleForm.name} onChange={e => setRoleForm(p => ({ ...p, name: e.target.value }))} sx={{ mb: 2, mt: 1 }} helperText="Uppercase, no spaces e.g. BRANCH_MANAGER" />
            <TextField label="Display Name" fullWidth value={roleForm.display_name} onChange={e => setRoleForm(p => ({ ...p, display_name: e.target.value }))} sx={{ mb: 2 }} />
            <TextField label="Description" fullWidth multiline rows={2} value={roleForm.description} onChange={e => setRoleForm(p => ({ ...p, description: e.target.value }))} />
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 2 }}>
            <Button onClick={() => setRoleDialog(null)} color="inherit">Cancel</Button>
            <Button onClick={() => saveRole(roleForm)} variant="contained" disabled={saving}>
              {saving ? <CircularProgress size={20} color="inherit" /> : 'Save'}
            </Button>
          </DialogActions>
        </Dialog>
      )}

      {/* Permission assignment dialog */}
      {permDialog && selected && (
        <Dialog open onClose={() => setPermDialog(false)} maxWidth="sm" fullWidth>
          <DialogTitle>Permissions for {selected.display_name}</DialogTitle>
          <DialogContent dividers>
            {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
            {Object.entries(permsByCategory).map(([cat, perms]) => (
              <Box key={cat} mb={2}>
                <Typography variant="subtitle2" color="text.secondary" mb={1}>{cat}</Typography>
                <Grid container>
                  {perms.map(p => (
                    <Grid item xs={6} key={p.id}>
                      <FormControlLabel
                        control={<Checkbox size="small" checked={selectedPerms.includes(p.id)} onChange={e => setSelectedPerms(prev => e.target.checked ? [...prev, p.id] : prev.filter(x => x !== p.id))} />}
                        label={<Typography variant="body2">{p.name}</Typography>}
                      />
                    </Grid>
                  ))}
                </Grid>
              </Box>
            ))}
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 2 }}>
            <Button onClick={() => setPermDialog(false)} color="inherit">Cancel</Button>
            <Button onClick={savePermissions} variant="contained" disabled={saving}>
              {saving ? <CircularProgress size={20} color="inherit" /> : 'Save Permissions'}
            </Button>
          </DialogActions>
        </Dialog>
      )}
    </Box>
  );
}
