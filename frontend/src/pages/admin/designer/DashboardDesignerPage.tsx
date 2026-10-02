/**
 * Dashboard Designer — three-panel layout.
 * Left: component library | Center: canvas | Right: widget properties
 * Full drag-and-drop via react-grid-layout.
 */
import { useState, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import GridLayout, { type Layout } from 'react-grid-layout';
import 'react-grid-layout/css/styles.css';
import 'react-resizable/css/styles.css';
import {
  Alert, Box, Button, Card, CardContent, Chip, CircularProgress,
  Divider, FormControl, Grid, IconButton, InputLabel, MenuItem,
  Paper, Select, Stack, TextField, Tooltip, Typography,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import SaveIcon from '@mui/icons-material/Save';
import PreviewIcon from '@mui/icons-material/Preview';
import SendIcon from '@mui/icons-material/Send';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import { dashboardsApi } from '@api/dashboards.api';
import { datasetsApi } from '@api/datasets.api';
import type { DashboardWidget, WidgetType } from '@/types/dashboard.types';

const WIDGET_TYPES: { type: WidgetType; label: string; defaultW: number; defaultH: number }[] = [
  { type: 'KPI', label: 'KPI Card', defaultW: 3, defaultH: 2 },
  { type: 'BAR_CHART', label: 'Bar Chart', defaultW: 6, defaultH: 4 },
  { type: 'LINE_CHART', label: 'Line Chart', defaultW: 6, defaultH: 4 },
  { type: 'PIE_CHART', label: 'Pie Chart', defaultW: 4, defaultH: 4 },
  { type: 'DONUT_CHART', label: 'Donut Chart', defaultW: 4, defaultH: 4 },
  { type: 'AREA_CHART', label: 'Area Chart', defaultW: 6, defaultH: 4 },
  { type: 'TABLE', label: 'Table', defaultW: 12, defaultH: 5 },
  { type: 'FILTER', label: 'Filter', defaultW: 3, defaultH: 2 },
  { type: 'TEXT', label: 'Text', defaultW: 6, defaultH: 2 },
  { type: 'DIVIDER', label: 'Divider', defaultW: 12, defaultH: 1 },
];

interface DesignerWidget extends Partial<DashboardWidget> {
  tempId: string;
}

export function DashboardDesignerPage() {
  const { id: dashboardId } = useParams<{ id?: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const isEdit = !!dashboardId;

  // Dashboard form
  const [dashCode, setDashCode] = useState('');
  const [dashName, setDashName] = useState('');
  const [dashDesc, setDashDesc] = useState('');

  // Designer state
  const [widgets, setWidgets] = useState<DesignerWidget[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [layout, setLayout] = useState<Layout[]>([]);
  const [saveMsg, setSaveMsg] = useState<string | null>(null);
  const [versionId, setVersionId] = useState<number | null>(null);
  const [dId, setDId] = useState<number | null>(dashboardId ? Number(dashboardId) : null);

  const { data: datasets = [] } = useQuery({ queryKey: ['datasets'], queryFn: datasetsApi.list });

  // Load existing dashboard
  const { isLoading } = useQuery({
    queryKey: ['dashboard-version', dashboardId],
    queryFn: async () => {
      const d = await dashboardsApi.get(Number(dashboardId));
      setDashCode(d.code); setDashName(d.name); setDashDesc(d.description ?? '');
      const versions = await dashboardsApi.listVersions(Number(dashboardId));
      if (versions.length > 0) {
        const latest = versions[0];
        setVersionId(latest.id);
        const vd = await dashboardsApi.getVersion(Number(dashboardId), latest.id);
        const ws: DesignerWidget[] = (vd.widgets ?? []).map((w: DashboardWidget) => ({
          ...w, tempId: String(w.id),
        }));
        setWidgets(ws);
        setLayout((vd.layout_config ?? []).map((l: Layout) => ({ ...l })));
      }
      return d;
    },
    enabled: isEdit,
  });

  function addWidget(type: WidgetType, defaultW: number, defaultH: number) {
    const tempId = `new_${Date.now()}`;
    const newW: DesignerWidget = { tempId, widget_type: type, title: type, width: defaultW, height: defaultH, sort_order: widgets.length };
    setWidgets(prev => [...prev, newW]);
    const y = layout.length > 0 ? Math.max(...layout.map(l => l.y + l.h)) : 0;
    setLayout(prev => [...prev, { i: tempId, x: 0, y, w: defaultW, h: defaultH }]);
    setSelected(tempId);
  }

  function removeWidget(tempId: string) {
    setWidgets(prev => prev.filter(w => w.tempId !== tempId));
    setLayout(prev => prev.filter(l => l.i !== tempId));
    if (selected === tempId) setSelected(null);
  }

  function updateWidget(tempId: string, changes: Partial<DesignerWidget>) {
    setWidgets(prev => prev.map(w => w.tempId === tempId ? { ...w, ...changes } : w));
  }

  const selectedWidget = widgets.find(w => w.tempId === selected);

  const saveMutation = useMutation({
    mutationFn: async () => {
      let currentDId = dId;
      if (!currentDId) {
        // Create dashboard first
        const d = await dashboardsApi.create({ code: dashCode, name: dashName, description: dashDesc });
        currentDId = d.id; setDId(d.id);
        // Get the auto-created version
        const versions = await dashboardsApi.listVersions(d.id);
        setVersionId(versions[0]?.id ?? null);
      }
      const vId = versionId;
      if (!vId || !currentDId) return;
      const widgetPayload = widgets.map(w => {
        const l = layout.find(ll => ll.i === w.tempId);
        return {
          id: typeof w.id === 'number' ? w.id : undefined,
          widget_type: w.widget_type!, title: w.title ?? null,
          position_x: l?.x ?? 0, position_y: l?.y ?? 0,
          width: l?.w ?? w.width ?? 4, height: l?.h ?? w.height ?? 3,
          config_json: w.config_json ?? null, dataset_id: w.dataset_id ?? null,
          sort_order: w.sort_order ?? 0,
        };
      });
      await dashboardsApi.saveVersion(currentDId, vId, {
        layout_config: layout, widgets: widgetPayload, filters: [],
      });
      qc.invalidateQueries({ queryKey: ['dashboards'] });
      setSaveMsg('Saved successfully');
      setTimeout(() => setSaveMsg(null), 3000);
    },
  });

  const submitMutation = useMutation({
    mutationFn: () => dashboardsApi.submit(dId!),
    onSuccess: () => navigate('/admin/approvals'),
  });

  if (isEdit && isLoading) return <Box display="flex" justifyContent="center" pt={4}><CircularProgress /></Box>;

  return (
    <Box sx={{ height: 'calc(100vh - 120px)', display: 'flex', flexDirection: 'column' }}>
      {/* Top bar */}
      <Box display="flex" alignItems="center" gap={2} mb={2}>
        <IconButton onClick={() => navigate('/admin/dashboards')}><ArrowBackIcon /></IconButton>
        <Typography variant="h6" fontWeight={600} flexGrow={1}>
          {isEdit ? `Designer: ${dashName}` : 'New Dashboard'}
        </Typography>
        {saveMsg && <Chip label={saveMsg} color="success" size="small" />}
        <Button variant="outlined" startIcon={<PreviewIcon />}
          onClick={() => dId && navigate(`/dashboard/${dashCode}`)} disabled={!dId}>Preview</Button>
        <Button variant="outlined" startIcon={<SendIcon />}
          onClick={() => submitMutation.mutate()} disabled={!dId}>Submit</Button>
        <Button variant="contained" startIcon={<SaveIcon />}
          onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
          {saveMutation.isPending ? <CircularProgress size={18} color="inherit" /> : 'Save Draft'}
        </Button>
      </Box>

      {/* Three-panel layout */}
      <Box display="flex" gap={2} flexGrow={1} overflow="hidden">
        {/* LEFT: Component library */}
        <Paper elevation={1} sx={{ width: 180, overflow: 'auto', p: 1, flexShrink: 0 }}>
          <Typography variant="caption" fontWeight={600} color="text.secondary" display="block" mb={1}>
            COMPONENTS
          </Typography>
          {WIDGET_TYPES.map(wt => (
            <Button key={wt.type} fullWidth variant="outlined" size="small"
              startIcon={<AddIcon />} sx={{ mb: 0.5, justifyContent: 'flex-start', fontSize: 11 }}
              onClick={() => addWidget(wt.type, wt.defaultW, wt.defaultH)}>
              {wt.label}
            </Button>
          ))}
          <Divider sx={{ my: 1 }} />
          {!isEdit && (
            <Box>
              <Typography variant="caption" fontWeight={600} color="text.secondary" display="block" mb={1}>DASHBOARD INFO</Typography>
              <TextField size="small" label="Code" fullWidth value={dashCode} onChange={e => setDashCode(e.target.value)} sx={{ mb: 1 }} />
              <TextField size="small" label="Name" fullWidth value={dashName} onChange={e => setDashName(e.target.value)} sx={{ mb: 1 }} />
              <TextField size="small" label="Description" fullWidth multiline rows={2} value={dashDesc} onChange={e => setDashDesc(e.target.value)} />
            </Box>
          )}
        </Paper>

        {/* CENTER: Canvas */}
        <Paper elevation={1} sx={{ flexGrow: 1, overflow: 'auto', p: 1, bgcolor: 'grey.50' }}>
          <Typography variant="caption" fontWeight={600} color="text.secondary" display="block" mb={1}>
            CANVAS — drag to rearrange, resize handles on bottom-right
          </Typography>
          {widgets.length === 0 && (
            <Box sx={{ textAlign: 'center', pt: 8, color: 'text.disabled' }}>
              <Typography>Add components from the left panel</Typography>
            </Box>
          )}
          <GridLayout
            className="layout"
            layout={layout}
            cols={12}
            rowHeight={60}
            width={Math.max(600, window.innerWidth - 600)}
            onLayoutChange={setLayout}
            draggableHandle=".drag-handle"
          >
            {widgets.map(w => (
              <div key={w.tempId}>
                <Card
                  elevation={selected === w.tempId ? 4 : 1}
                  onClick={() => setSelected(w.tempId)}
                  sx={{ height: '100%', cursor: 'pointer', border: selected === w.tempId ? 2 : 0, borderColor: 'primary.main' }}
                >
                  <CardContent sx={{ p: 1, '&:last-child': { pb: 1 } }}>
                    <Box display="flex" alignItems="center" gap={0.5}>
                      <Typography variant="caption" className="drag-handle" sx={{ cursor: 'grab', flexGrow: 1, fontWeight: 600, userSelect: 'none' }}>
                        {w.title || w.widget_type}
                      </Typography>
                      <Chip label={w.widget_type} size="small" variant="outlined" sx={{ fontSize: 9 }} />
                      <IconButton size="small" onClick={e => { e.stopPropagation(); removeWidget(w.tempId); }}>
                        <DeleteIcon sx={{ fontSize: 14 }} />
                      </IconButton>
                    </Box>
                  </CardContent>
                </Card>
              </div>
            ))}
          </GridLayout>
        </Paper>

        {/* RIGHT: Properties */}
        <Paper elevation={1} sx={{ width: 240, overflow: 'auto', p: 2, flexShrink: 0 }}>
          <Typography variant="caption" fontWeight={600} color="text.secondary" display="block" mb={1}>
            PROPERTIES
          </Typography>
          {!selectedWidget && <Typography variant="body2" color="text.disabled">Select a widget to configure it</Typography>}
          {selectedWidget && (
            <Stack spacing={2}>
              <TextField size="small" label="Title" fullWidth value={selectedWidget.title ?? ''}
                onChange={e => updateWidget(selectedWidget.tempId, { title: e.target.value })} />
              <FormControl size="small" fullWidth>
                <InputLabel>Dataset</InputLabel>
                <Select value={selectedWidget.dataset_id ?? ''} label="Dataset"
                  onChange={e => updateWidget(selectedWidget.tempId, { dataset_id: Number(e.target.value) || undefined })}>
                  <MenuItem value="">— None —</MenuItem>
                  {datasets.map(d => <MenuItem key={d.id} value={d.id}>{d.name}</MenuItem>)}
                </Select>
              </FormControl>
              {['KPI'].includes(selectedWidget.widget_type ?? '') && (
                <>
                  <TextField size="small" label="Field" fullWidth
                    value={selectedWidget.config_json?.field ?? ''}
                    onChange={e => updateWidget(selectedWidget.tempId, { config_json: { ...selectedWidget.config_json, field: e.target.value } })} />
                  <FormControl size="small" fullWidth>
                    <InputLabel>Aggregation</InputLabel>
                    <Select value={selectedWidget.config_json?.aggregation ?? 'COUNT'} label="Aggregation"
                      onChange={e => updateWidget(selectedWidget.tempId, { config_json: { ...selectedWidget.config_json, aggregation: e.target.value as 'COUNT'|'COUNT_DISTINCT'|'SUM'|'AVG'|'MIN'|'MAX' } })}>
                      {['COUNT','COUNT_DISTINCT','SUM','AVG','MIN','MAX'].map(a => <MenuItem key={a} value={a}>{a}</MenuItem>)}
                    </Select>
                  </FormControl>
                </>
              )}
              {['BAR_CHART','LINE_CHART','PIE_CHART','DONUT_CHART','AREA_CHART','H_BAR_CHART'].includes(selectedWidget.widget_type ?? '') && (
                <>
                  <TextField size="small" label="Dimension (X axis)" fullWidth
                    value={selectedWidget.config_json?.dimension ?? ''}
                    onChange={e => updateWidget(selectedWidget.tempId, { config_json: { ...selectedWidget.config_json, dimension: e.target.value } })} />
                  <TextField size="small" label="Metric (Y axis)" fullWidth
                    value={selectedWidget.config_json?.metric ?? ''}
                    onChange={e => updateWidget(selectedWidget.tempId, { config_json: { ...selectedWidget.config_json, metric: e.target.value } })} />
                  <FormControl size="small" fullWidth>
                    <InputLabel>Aggregation</InputLabel>
                    <Select value={selectedWidget.config_json?.aggregation ?? 'COUNT'} label="Aggregation"
                      onChange={e => updateWidget(selectedWidget.tempId, { config_json: { ...selectedWidget.config_json, aggregation: e.target.value as 'COUNT'|'COUNT_DISTINCT'|'SUM'|'AVG'|'MIN'|'MAX' } })}>
                      {['COUNT','COUNT_DISTINCT','SUM','AVG','MIN','MAX'].map(a => <MenuItem key={a} value={a}>{a}</MenuItem>)}
                    </Select>
                  </FormControl>
                </>
              )}
            </Stack>
          )}
        </Paper>
      </Box>
    </Box>
  );
}
