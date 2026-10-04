/**
 * Dashboard Designer — Enhanced five-panel layout matching WebFOCUS Designer.
 * Left 1: Data sources & datasets | Left 2: Widget library
 * Center: Dashboard canvas with pages
 * Right: Properties & calculations
 * Top: Save, preview, publish workflow
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
  Paper, Select, Stack, TextField, Tooltip, Typography, Tabs, Tab,
  Accordion, AccordionSummary, AccordionDetails, Switch, Slider,
  InputAdornment, List, ListItem, ListItemText, ListItemIcon,
  Dialog, DialogTitle, DialogContent, DialogActions, FormControlLabel,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import SaveIcon from '@mui/icons-material/Save';
import PreviewIcon from '@mui/icons-material/Preview';
import SendIcon from '@mui/icons-material/Send';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import StorageIcon from '@mui/icons-material/Storage';
import TableChartIcon from '@mui/icons-material/TableChart';
import BarChartIcon from '@mui/icons-material/BarChart';
import ShowChartIcon from '@mui/icons-material/ShowChart';
import PieChartIcon from '@mui/icons-material/PieChart';
import DonutLargeIcon from '@mui/icons-material/DonutLarge';
import ScatterPlotIcon from '@mui/icons-material/ScatterPlot';
import NumberIcon from '@mui/icons-material/Numbers';
import FilterListIcon from '@mui/icons-material/FilterList';
import ImageIcon from '@mui/icons-material/Image';
import TextFieldsIcon from '@mui/icons-material/TextFields';
import PublishIcon from '@mui/icons-material/Publish';
import VisibilityIcon from '@mui/icons-material/Visibility';
import { dashboardsApi } from '@api/dashboards.api';
import { datasetsApi } from '@api/datasets.api';
import { dataSourcesApi } from '../api/data-sources.api';
import type { DashboardWidget, WidgetType } from '@/types/dashboard.types';

const WIDGET_TYPES: { type: WidgetType; label: string; icon: any; defaultW: number; defaultH: number; category: string }[] = [
  // Charts
  { type: 'BAR_CHART', label: 'Bar Chart', icon: BarChartIcon, defaultW: 6, defaultH: 4, category: 'Charts' },
  { type: 'LINE_CHART', label: 'Line Chart', icon: ShowChartIcon, defaultW: 6, defaultH: 4, category: 'Charts' },
  { type: 'PIE_CHART', label: 'Pie Chart', icon: PieChartIcon, defaultW: 4, defaultH: 4, category: 'Charts' },
  { type: 'DONUT_CHART', label: 'Donut Chart', icon: DonutLargeIcon, defaultW: 4, defaultH: 4, category: 'Charts' },
  { type: 'AREA_CHART', label: 'Area Chart', icon: ShowChartIcon, defaultW: 6, defaultH: 4, category: 'Charts' },
  { type: 'SCATTER_PLOT', label: 'Scatter Plot', icon: ScatterPlotIcon, defaultW: 6, defaultH: 4, category: 'Charts' },
  // Tables & Data
  { type: 'TABLE', label: 'Table', icon: TableChartIcon, defaultW: 12, defaultH: 5, category: 'Data' },
  { type: 'PIVOT_TABLE', label: 'Pivot Table', icon: TableChartIcon, defaultW: 10, defaultH: 6, category: 'Data' },
  // KPIs
  { type: 'KPI', label: 'KPI Card', icon: NumberIcon, defaultW: 3, defaultH: 2, category: 'KPIs' },
  { type: 'KPI_TREND', label: 'KPI with Trend', icon: NumberIcon, defaultW: 4, defaultH: 3, category: 'KPIs' },
  // Filters
  { type: 'FILTER', label: 'Filter', icon: FilterListIcon, defaultW: 3, defaultH: 2, category: 'Filters' },
  { type: 'DATE_FILTER', label: 'Date Filter', icon: FilterListIcon, defaultW: 4, defaultH: 2, category: 'Filters' },
  // Visual Elements
  { type: 'TEXT', label: 'Text', icon: TextFieldsIcon, defaultW: 6, defaultH: 2, category: 'Visual' },
  { type: 'IMAGE', label: 'Image', icon: ImageIcon, defaultW: 6, defaultH: 4, category: 'Visual' },
  { type: 'DIVIDER', label: 'Divider', icon: TextFieldsIcon, defaultW: 12, defaultH: 1, category: 'Visual' },
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

  // Panel state
  const [leftPanelTab, setLeftPanelTab] = useState(0); // 0: Data, 1: Widgets
  const [rightPanelTab, setRightPanelTab] = useState(0); // 0: Properties, 1: Calculations
  const [dataPanelTab, setDataPanelTab] = useState(0); // 0: Data Sources, 1: Datasets
  const [showPreview, setShowPreview] = useState(false);

  // Data queries
  const { data: datasets = [] } = useQuery({ queryKey: ['datasets'], queryFn: datasetsApi.list });
  const { data: dataSources = [] } = useQuery({ queryKey: ['data-sources'], queryFn: dataSourcesApi.list });

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

  const widgetCategories = Array.from(new Set(WIDGET_TYPES.map(w => w.category)));

  return (
    <Box sx={{ height: 'calc(100vh - 64px)', display: 'flex', flexDirection: 'column', bgcolor: '#f5f5f5' }}>
      {/* Top bar - Dashboard Actions */}
      <Paper elevation={2} sx={{ p: 2, display: 'flex', alignItems: 'center', gap: 2, zIndex: 10 }}>
        <IconButton onClick={() => navigate('/admin/dashboards')}><ArrowBackIcon /></IconButton>
        <Divider orientation="vertical" flexItem sx={{ mx: 1 }} />
        <Typography variant="h6" fontWeight={600} flexGrow={1}>
          {isEdit ? `Designer: ${dashName}` : 'New Dashboard'}
        </Typography>
        {saveMsg && <Chip label={saveMsg} color="success" size="small" />}
        <Button variant="outlined" startIcon={<VisibilityIcon />}
          onClick={() => setShowPreview(true)} disabled={!dId}>Preview</Button>
        <Button variant="outlined" startIcon={<SendIcon />}
          onClick={() => submitMutation.mutate()} disabled={!dId}>Submit for Approval</Button>
        <Button variant="contained" startIcon={<SaveIcon />}
          onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
          {saveMutation.isPending ? <CircularProgress size={18} color="inherit" /> : 'Save Draft'}
        </Button>
      </Paper>

      {/* Five-panel layout */}
      <Box display="flex" flexGrow={1} overflow="hidden">
        {/* LEFT PANEL 1: Data Sources & Datasets */}
        <Paper elevation={1} sx={{ width: 280, display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
          <Tabs value={dataPanelTab} onChange={(_, v) => setDataPanelTab(v)} variant="fullWidth" sx={{ borderBottom: 1, borderColor: 'divider' }}>
            <Tab label="Data Sources" icon={<StorageIcon />} />
            <Tab label="Datasets" icon={<TableChartIcon />} />
          </Tabs>
          <Box sx={{ flexGrow: 1, overflow: 'auto', p: 1 }}>
            {dataPanelTab === 0 && (
              <>
                <Button fullWidth variant="contained" size="small" startIcon={<AddIcon />} sx={{ mb: 2 }}>
                  Add Data Source
                </Button>
                <List dense>
                  {dataSources.map(ds => (
                    <ListItem key={ds.id} button>
                      <ListItemIcon><StorageIcon color="primary" /></ListItemIcon>
                      <ListItemText primary={ds.name} secondary={ds.type} />
                    </ListItem>
                  ))}
                  {dataSources.length === 0 && (
                    <Typography variant="body2" color="text.disabled" sx={{ textAlign: 'center', py: 4 }}>
                      No data sources configured
                    </Typography>
                  )}
                </List>
              </>
            )}
            {dataPanelTab === 1 && (
              <>
                <Button fullWidth variant="contained" size="small" startIcon={<AddIcon />} sx={{ mb: 2 }}>
                  Create Dataset
                </Button>
                <List dense>
                  {datasets.map(ds => (
                    <ListItem key={ds.id} button>
                      <ListItemIcon><TableChartIcon color="primary" /></ListItemIcon>
                      <ListItemText primary={ds.name} secondary={`${ds.row_count || 0} rows`} />
                    </ListItem>
                  ))}
                  {datasets.length === 0 && (
                    <Typography variant="body2" color="text.disabled" sx={{ textAlign: 'center', py: 4 }}>
                      No datasets created
                    </Typography>
                  )}
                </List>
              </>
            )}
          </Box>
        </Paper>

        {/* LEFT PANEL 2: Widget Library */}
        <Paper elevation={1} sx={{ width: 220, display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
          <Typography variant="subtitle2" fontWeight={600} sx={{ p: 1.5, borderBottom: 1, borderColor: 'divider' }}>
            Widget Library
          </Typography>
          <Box sx={{ flexGrow: 1, overflow: 'auto', p: 1 }}>
            {widgetCategories.map(category => (
              <Accordion key={category} defaultExpanded={category === 'Charts'}>
                <AccordionSummary expandIcon={<ExpandMoreIcon />} sx={{ minHeight: 40, '& .MuiAccordionSummary-content': { my: 1 } }}>
                  <Typography variant="caption" fontWeight={600}>{category}</Typography>
                </AccordionSummary>
                <AccordionDetails sx={{ p: 0.5 }}>
                  {WIDGET_TYPES.filter(w => w.category === category).map(wt => (
                    <Button
                      key={wt.type}
                      fullWidth
                      variant="outlined"
                      size="small"
                      startIcon={<wt.icon fontSize="small" />}
                      sx={{ mb: 0.5, justifyContent: 'flex-start', fontSize: 11, textTransform: 'none' }}
                      onClick={() => addWidget(wt.type, wt.defaultW, wt.defaultH)}
                    >
                      {wt.label}
                    </Button>
                  ))}
                </AccordionDetails>
              </Accordion>
            ))}
          </Box>
        </Paper>

        {/* CENTER: Dashboard Canvas */}
        <Paper elevation={1} sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column', m: 1 }}>
          {/* Canvas toolbar */}
          <Box sx={{ p: 1, borderBottom: 1, borderColor: 'divider', display: 'flex', alignItems: 'center', gap: 1, bgcolor: 'white' }}>
            <Typography variant="caption" fontWeight={600} color="text.secondary">CANVAS</Typography>
            <Divider orientation="vertical" flexItem sx={{ mx: 1 }} />
            <Typography variant="caption" color="text.secondary">Live data: {widgets.length} widgets</Typography>
            <Typography variant="caption" color="text.secondary">Output Format: Interactive</Typography>
            <Box flexGrow={1} />
            <Chip label="Page 1" size="small" color="primary" />
          </Box>

          {/* Canvas area */}
          <Box sx={{ flexGrow: 1, overflow: 'auto', p: 2, bgcolor: '#fafafa' }}>
            {widgets.length === 0 && (
              <Box sx={{ textAlign: 'center', pt: 12, color: 'text.disabled' }}>
                <Typography variant="h6" gutterBottom>Drop a Filter or Field here</Typography>
                <Typography variant="body2">Drag widgets from the library to start building your dashboard</Typography>
              </Box>
            )}
            <GridLayout
              className="layout"
              layout={layout}
              cols={12}
              rowHeight={60}
              width={Math.max(800, window.innerWidth - 800)}
              onLayoutChange={setLayout}
              draggableHandle=".drag-handle"
              isResizable={true}
            >
              {widgets.map(w => (
                <div key={w.tempId}>
                  <Card
                    elevation={selected === w.tempId ? 4 : 1}
                    onClick={() => setSelected(w.tempId)}
                    sx={{ height: '100%', cursor: 'pointer', border: selected === w.tempId ? 2 : 0, borderColor: 'primary.main', borderRadius: 1 }}
                  >
                    <CardContent sx={{ p: 1, '&:last-child': { pb: 1 }, height: '100%', display: 'flex', flexDirection: 'column' }}>
                      <Box display="flex" alignItems="center" gap={0.5} mb={1}>
                        <Typography variant="caption" className="drag-handle" sx={{ cursor: 'grab', flexGrow: 1, fontWeight: 600, userSelect: 'none' }}>
                          {w.title || w.widget_type}
                        </Typography>
                        <Chip label={w.widget_type} size="small" variant="outlined" sx={{ fontSize: 9 }} />
                        <IconButton size="small" onClick={e => { e.stopPropagation(); removeWidget(w.tempId); }}>
                          <DeleteIcon sx={{ fontSize: 14 }} />
                        </IconButton>
                      </Box>
                      {/* Placeholder for widget content */}
                      <Box sx={{ flexGrow: 1, bgcolor: '#f0f0f0', borderRadius: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 60 }}>
                        <Typography variant="caption" color="text.secondary">
                          {w.widget_type} Widget
                        </Typography>
                      </Box>
                    </CardContent>
                  </Card>
                </div>
              ))}
            </GridLayout>
          </Box>
        </Paper>

        {/* RIGHT PANEL: Properties & Calculations */}
        <Paper elevation={1} sx={{ width: 300, display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
          <Tabs value={rightPanelTab} onChange={(_, v) => setRightPanelTab(v)} variant="fullWidth" sx={{ borderBottom: 1, borderColor: 'divider' }}>
            <Tab label="Properties" />
            <Tab label="Calculations" />
          </Tabs>
          <Box sx={{ flexGrow: 1, overflow: 'auto', p: 2 }}>
            {rightPanelTab === 0 && (
              <>
                {!selectedWidget && (
                  <Typography variant="body2" color="text.disabled" sx={{ textAlign: 'center', py: 4 }}>
                    Select a widget to configure it
                  </Typography>
                )}
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

                    {/* Chart-specific properties */}
                    {['BAR_CHART','LINE_CHART','PIE_CHART','DONUT_CHART','AREA_CHART'].includes(selectedWidget.widget_type ?? '') && (
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
                            onChange={e => updateWidget(selectedWidget.tempId, { config_json: { ...selectedWidget.config_json, aggregation: e.target.value as any } })}>
                            {['COUNT','COUNT_DISTINCT','SUM','AVG','MIN','MAX'].map(a => <MenuItem key={a} value={a}>{a}</MenuItem>)}
                          </Select>
                        </FormControl>
                      </>
                    )}

                    {/* KPI-specific properties */}
                    {['KPI','KPI_TREND'].includes(selectedWidget.widget_type ?? '') && (
                      <>
                        <TextField size="small" label="Field" fullWidth
                          value={selectedWidget.config_json?.field ?? ''}
                          onChange={e => updateWidget(selectedWidget.tempId, { config_json: { ...selectedWidget.config_json, field: e.target.value } })} />
                        <FormControl size="small" fullWidth>
                          <InputLabel>Aggregation</InputLabel>
                          <Select value={selectedWidget.config_json?.aggregation ?? 'COUNT'} label="Aggregation"
                            onChange={e => updateWidget(selectedWidget.tempId, { config_json: { ...selectedWidget.config_json, aggregation: e.target.value as any } })}>
                            {['COUNT','COUNT_DISTINCT','SUM','AVG','MIN','MAX'].map(a => <MenuItem key={a} value={a}>{a}</MenuItem>)}
                          </Select>
                        </FormControl>
                      </>
                    )}

                    {/* Color theme */}
                    <FormControl size="small" fullWidth>
                      <InputLabel>Color Theme</InputLabel>
                      <Select value={selectedWidget.config_json?.colorTheme ?? 'default'} label="Color Theme"
                        onChange={e => updateWidget(selectedWidget.tempId, { config_json: { ...selectedWidget.config_json, colorTheme: e.target.value } })}>
                        <MenuItem value="default">Default</MenuItem>
                        <MenuItem value="blue">Blue</MenuItem>
                        <MenuItem value="green">Green</MenuItem>
                        <MenuItem value="red">Red</MenuItem>
                        <MenuItem value="rainbow">Rainbow</MenuItem>
                      </Select>
                    </FormControl>

                    {/* Show data labels */}
                    <FormControlLabel
                      control={
                        <Switch
                          checked={selectedWidget.config_json?.showDataLabels ?? false}
                          onChange={e => updateWidget(selectedWidget.tempId, { config_json: { ...selectedWidget.config_json, showDataLabels: e.target.checked } })}
                        />
                      }
                      label="Show Data Labels"
                    />
                  </Stack>
                )}
              </>
            )}
            {rightPanelTab === 1 && (
              <Box>
                <Typography variant="caption" fontWeight={600} color="text.secondary" display="block" mb={2}>
                  Calculated Fields
                </Typography>
                <Button fullWidth variant="outlined" size="small" startIcon={<AddIcon />} sx={{ mb: 2 }}>
                  Add Calculated Field
                </Button>
                <Typography variant="body2" color="text.disabled" sx={{ textAlign: 'center', py: 4 }}>
                  No calculated fields defined
                </Typography>
              </Box>
            )}
          </Box>
        </Paper>
      </Box>

      {/* Preview Dialog */}
      <Dialog open={showPreview} onClose={() => setShowPreview(false)} maxWidth="xl" fullWidth>
        <DialogTitle>Dashboard Preview</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary">
            Preview mode - Save the dashboard first to see live data
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowPreview(false)}>Close</Button>
          <Button variant="contained" onClick={() => {
            setShowPreview(false);
            if (dId) navigate(`/dashboard/${dashCode}`);
          }}>Open in Viewer</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
