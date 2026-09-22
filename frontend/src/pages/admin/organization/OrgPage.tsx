/**
 * Organization hierarchy management — Regions, Districts, Branches in a tree view.
 */
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Accordion, AccordionDetails, AccordionSummary,
  Alert, Box, Button, Chip, CircularProgress,
  Dialog, DialogActions, DialogContent, DialogTitle,
  Grid, IconButton, Paper, TextField, Tooltip, Typography,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import { organizationApi } from '@api/organization.api';
import { LoadingState } from '@components/common/LoadingState';

function OrgDialog({ open, title, fields, initial, onSave, onClose, saving, error }: {
  open: boolean; title: string; fields: { key: string; label: string; required?: boolean }[];
  initial: Record<string, string>; onSave: (d: Record<string, string>) => void;
  onClose: () => void; saving: boolean; error: string | null;
}) {
  const [form, setForm] = useState<Record<string, string>>(initial);
  useEffect(() => setForm(initial), [initial]);
  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle>{title}</DialogTitle>
      <DialogContent>
        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
        {fields.map(f => (
          <TextField key={f.key} label={f.label} fullWidth value={form[f.key] ?? ''} required={f.required}
            onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))} sx={{ mb: 2 }} />
        ))}
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} color="inherit">Cancel</Button>
        <Button onClick={() => onSave(form)} variant="contained" disabled={saving}>
          {saving ? <CircularProgress size={20} color="inherit" /> : 'Save'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

import { useEffect } from 'react';

export function OrgPage() {
  const qc = useQueryClient();
  const [dialog, setDialog] = useState<{
    type: 'region' | 'district' | 'branch'; mode: 'create' | 'edit';
    id?: number; initial: Record<string, string>;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const { data: regions = [], isLoading } = useQuery({ queryKey: ['regions-all'], queryFn: organizationApi.getAllRegions });
  const { data: allDistricts = [] } = useQuery({ queryKey: ['districts-admin', undefined], queryFn: () => organizationApi.getAllDistricts() });
  const { data: allBranches = [] } = useQuery({ queryKey: ['branches-admin', undefined], queryFn: () => organizationApi.getAllBranches() });

  async function handleSave(data: Record<string, string>) {
    setSaving(true); setError(null);
    try {
      if (!dialog) return;
      if (dialog.type === 'region') {
        if (dialog.mode === 'create') await organizationApi.createRegion({ code: data.code, name: data.name });
        else await organizationApi.updateRegion(dialog.id!, { code: data.code, name: data.name, status: data.status ?? 'ACTIVE' });
        qc.invalidateQueries({ queryKey: ['regions-all'] });
      } else if (dialog.type === 'district') {
        if (dialog.mode === 'create') await organizationApi.createDistrict({ code: data.code, name: data.name, region_id: Number(data.region_id) });
        else await organizationApi.updateDistrict(dialog.id!, { code: data.code, name: data.name, region_id: Number(data.region_id), status: data.status ?? 'ACTIVE' });
        qc.invalidateQueries({ queryKey: ['districts-admin', undefined] });
      } else {
        if (dialog.mode === 'create') await organizationApi.createBranch({ code: data.code, name: data.name, region_id: Number(data.region_id), district_id: Number(data.district_id) });
        else await organizationApi.updateBranch(dialog.id!, { code: data.code, name: data.name, region_id: Number(data.region_id), district_id: Number(data.district_id), status: data.status ?? 'ACTIVE' });
        qc.invalidateQueries({ queryKey: ['branches-admin', undefined] });
      }
      setDialog(null);
    } catch (e: unknown) {
      const err = e as { response?: { data?: { detail?: string } } };
      setError(err?.response?.data?.detail ?? 'Save failed');
    } finally { setSaving(false); }
  }

  if (isLoading) return <LoadingState />;

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h5" fontWeight={600}>Organization Hierarchy</Typography>
        <Button variant="contained" startIcon={<AddIcon />}
          onClick={() => setDialog({ type: 'region', mode: 'create', initial: {} })}>
          Add Region
        </Button>
      </Box>

      {regions.map(region => {
        const rDistricts = allDistricts.filter(d => d.region_id === region.id);
        return (
          <Accordion key={region.id} elevation={1} sx={{ mb: 1 }}>
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Box display="flex" alignItems="center" gap={2} flexGrow={1}>
                <Typography fontWeight={600}>{region.name}</Typography>
                <Chip label={region.code} size="small" variant="outlined" />
                <Chip label={region.status} size="small" color={region.status === 'ACTIVE' ? 'success' : 'default'} />
                <Box flexGrow={1} />
                <Tooltip title="Edit Region">
                  <IconButton size="small" onClick={e => { e.stopPropagation(); setDialog({ type: 'region', mode: 'edit', id: region.id, initial: { code: region.code, name: region.name, status: region.status } }); }}>
                    <EditIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
                <Tooltip title="Add District">
                  <IconButton size="small" color="primary" onClick={e => { e.stopPropagation(); setDialog({ type: 'district', mode: 'create', initial: { region_id: String(region.id) } }); }}>
                    <AddIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
              </Box>
            </AccordionSummary>
            <AccordionDetails>
              {rDistricts.length === 0 && <Typography variant="body2" color="text.secondary">No districts yet</Typography>}
              {rDistricts.map(dist => {
                const dBranches = allBranches.filter(b => b.district_id === dist.id);
                return (
                  <Paper key={dist.id} variant="outlined" sx={{ p: 2, mb: 1 }}>
                    <Box display="flex" alignItems="center" gap={1} mb={dBranches.length ? 1 : 0}>
                      <Typography variant="subtitle2">{dist.name}</Typography>
                      <Chip label={dist.code} size="small" variant="outlined" />
                      <Box flexGrow={1} />
                      <Tooltip title="Edit District">
                        <IconButton size="small" onClick={() => setDialog({ type: 'district', mode: 'edit', id: dist.id, initial: { code: dist.code, name: dist.name, region_id: String(dist.region_id), status: dist.status } })}>
                          <EditIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Add Branch">
                        <IconButton size="small" color="primary" onClick={() => setDialog({ type: 'branch', mode: 'create', initial: { region_id: String(region.id), district_id: String(dist.id) } })}>
                          <AddIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </Box>
                    <Grid container spacing={1}>
                      {dBranches.map(b => (
                        <Grid item key={b.id}>
                          <Chip
                            label={`${b.name} (${b.code})`}
                            size="small"
                            onDelete={() => setDialog({ type: 'branch', mode: 'edit', id: b.id, initial: { code: b.code, name: b.name, region_id: String(b.region_id), district_id: String(b.district_id), status: b.status } })}
                            deleteIcon={<EditIcon />}
                            variant="outlined"
                          />
                        </Grid>
                      ))}
                    </Grid>
                  </Paper>
                );
              })}
            </AccordionDetails>
          </Accordion>
        );
      })}

      {dialog && (
        <OrgDialog
          open
          title={`${dialog.mode === 'create' ? 'Add' : 'Edit'} ${dialog.type.charAt(0).toUpperCase() + dialog.type.slice(1)}`}
          fields={[
            { key: 'code', label: 'Code', required: true },
            { key: 'name', label: 'Name', required: true },
            ...(dialog.mode === 'edit' ? [{ key: 'status', label: 'Status' }] : []),
          ]}
          initial={dialog.initial}
          onSave={handleSave}
          onClose={() => { setDialog(null); setError(null); }}
          saving={saving}
          error={error}
        />
      )}
    </Box>
  );
}
