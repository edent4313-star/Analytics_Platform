/**
 * Create / Edit User form.
 *
 * Flow:
 *  1. Admin enters AD email → system looks up Full Name from AD (mock or real)
 *  2. Full Name auto-populates
 *  3. Admin selects Viewer Level → org fields shown conditionally
 *  4. Admin selects Dashboard Access (searchable multi-select)
 *  5. Admin selects Department (optional) and Position (optional)
 *  6. Submit → POST/PUT /admin/users
 *
 * Organization rules:
 *  HEAD_OFFICE → no region/district/branch required
 *  REGION      → region required (covers all its districts/branches)
 *  DISTRICT    → region + district required (covers all branches)
 *  BRANCH      → region + district + branch required
 */
import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Alert, Autocomplete, Box, Button, Chip, CircularProgress, Divider,
  FormControl, FormHelperText, Grid, InputAdornment, InputLabel,
  MenuItem, Paper, Select, TextField, Tooltip, Typography,
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import SearchIcon from '@mui/icons-material/Search';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import { adminApi } from '@api/adminApi';
import { organizationApi } from '@api/organization.api';
import { dashboardsApi } from '@api/dashboards.api';
import { LoadingState } from '@components/common/LoadingState';

// ── Types ─────────────────────────────────────────────────────────────────────

const ACCESS_LEVELS = ['HEAD_OFFICE', 'REGION', 'DISTRICT', 'BRANCH'] as const;
type AccessLevel = typeof ACCESS_LEVELS[number];

interface OrgItem { id: number; name: string; code?: string; }
interface DashboardItem { id: number; name: string; code: string; }

const schema = z.object({
  email: z.string().email('Enter a valid AD email'),
  username: z.string().min(3, 'Min 3 characters'),
  full_name: z.string().min(2, 'Full name required'),
  employee_id: z.string().optional(),
  phone: z.string().optional(),
  password: z.string().optional(),
  access_level: z.enum(ACCESS_LEVELS),
  role_id: z.number({ invalid_type_error: 'Select a role' }),
  region_id: z.number().nullable().optional(),
  district_id: z.number().nullable().optional(),
  branch_id: z.number().nullable().optional(),
  department_id: z.number().nullable().optional(),
  position_id: z.number().nullable().optional(),
  is_active: z.boolean(),
}).superRefine((d, ctx) => {
  if (d.access_level !== 'HEAD_OFFICE' && !d.region_id)
    ctx.addIssue({ code: 'custom', path: ['region_id'], message: 'Region is required' });
  if (['DISTRICT', 'BRANCH'].includes(d.access_level) && !d.district_id)
    ctx.addIssue({ code: 'custom', path: ['district_id'], message: 'District is required' });
  if (d.access_level === 'BRANCH' && !d.branch_id)
    ctx.addIssue({ code: 'custom', path: ['branch_id'], message: 'Branch is required' });
});

type FormValues = z.infer<typeof schema>;

// ── Component ─────────────────────────────────────────────────────────────────

export function UserFormPage() {
  const { id } = useParams<{ id?: string }>();
  const isEdit = !!id;
  const navigate = useNavigate();
  const qc = useQueryClient();

  // AD lookup state
  const [emailInput, setEmailInput] = useState('');
  const [adLookupStatus, setAdLookupStatus] = useState<'idle' | 'loading' | 'found' | 'not_found'>('idle');
  const [adLookupTimer, setAdLookupTimer] = useState<ReturnType<typeof setTimeout> | null>(null);

  // Dashboard access state
  const [selectedDashboards, setSelectedDashboards] = useState<DashboardItem[]>([]);
  const [dashboardSearch, setDashboardSearch] = useState('');

  const [serverError, setServerError] = useState<string | null>(null);

  // ── Data loading ─────────────────────────────────────────────────────────
  const { data: existing, isLoading: loadingUser } = useQuery({
    queryKey: ['admin-user', id],
    queryFn: () => adminApi.getUser(Number(id)),
    enabled: isEdit,
  });

  const { data: roles = [] } = useQuery({ queryKey: ['admin-roles'], queryFn: adminApi.listRoles });
  const { data: allRegions = [] } = useQuery({ queryKey: ['regions-all'], queryFn: organizationApi.getAllRegions });
  const { data: departments = [] } = useQuery({ queryKey: ['admin-departments'], queryFn: adminApi.listDepartments });
  const { data: positions = [] } = useQuery({ queryKey: ['admin-positions'], queryFn: adminApi.listPositions });
  const { data: dashboardsData } = useQuery({
    queryKey: ['dashboards-all'],
    queryFn: () => dashboardsApi.list({ page_size: 100 }),
  });
  const allDashboards: DashboardItem[] = (dashboardsData?.items ?? []) as DashboardItem[];
  const filteredDashboards = allDashboards.filter(d =>
    d.name.toLowerCase().includes(dashboardSearch.toLowerCase()) ||
    d.code.toLowerCase().includes(dashboardSearch.toLowerCase())
  );

  // ── Form ────────────────────────────────────────────────────────────────
  const {
    register, control, handleSubmit, watch, setValue, reset,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      access_level: 'HEAD_OFFICE', is_active: true,
      region_id: null, district_id: null, branch_id: null,
      department_id: null, position_id: null,
    },
  });

  const accessLevel = watch('access_level') as AccessLevel;
  const regionId = watch('region_id');
  const districtId = watch('district_id');

  const { data: districts = [] } = useQuery({
    queryKey: ['districts-admin', regionId],
    queryFn: () => organizationApi.getAllDistricts(regionId!),
    enabled: !!regionId,
  });
  const { data: branches = [] } = useQuery({
    queryKey: ['branches-admin', districtId],
    queryFn: () => organizationApi.getAllBranches(districtId!),
    enabled: !!districtId,
  });

  // Clear child selections when parent changes
  useEffect(() => { setValue('district_id', null); setValue('branch_id', null); }, [regionId, setValue]);
  useEffect(() => { setValue('branch_id', null); }, [districtId, setValue]);
  useEffect(() => {
    if (accessLevel === 'HEAD_OFFICE') {
      setValue('region_id', null); setValue('district_id', null); setValue('branch_id', null);
    }
    if (accessLevel === 'REGION') {
      setValue('district_id', null); setValue('branch_id', null);
    }
    if (accessLevel === 'DISTRICT') {
      setValue('branch_id', null);
    }
  }, [accessLevel, setValue]);

  // Pre-populate form when editing
  useEffect(() => {
    if (!existing) return;
    const e = existing as Record<string, unknown>;
    setEmailInput(e.email as string ?? '');
    reset({
      email: e.email as string ?? '',
      username: e.username as string ?? '',
      full_name: e.full_name as string ?? '',
      employee_id: (e.employee_id as string) ?? '',
      phone: (e.phone as string) ?? '',
      access_level: (e.access_level as AccessLevel) ?? 'HEAD_OFFICE',
      role_id: undefined,
      region_id: e.region_id as number | null,
      district_id: e.district_id as number | null,
      branch_id: e.branch_id as number | null,
      department_id: null,
      position_id: null,
      is_active: (e.is_active as boolean) ?? true,
    });
    const roleName = e.role as string;
    if (roleName && (roles as Array<{ id: number; name: string }>).length > 0) {
      const role = (roles as Array<{ id: number; name: string }>).find(r => r.name === roleName);
      if (role) setValue('role_id', role.id);
    }
    setAdLookupStatus('found');
  }, [existing, roles, reset, setValue]);

  // ── AD email lookup ───────────────────────────────────────────────────────

  const triggerAdLookup = useCallback((email: string) => {
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return;
    if (adLookupTimer) clearTimeout(adLookupTimer);
    const timer = setTimeout(async () => {
      setAdLookupStatus('loading');
      try {
        const result = await adminApi.lookupADUser(email);
        if (result.found) {
          setValue('full_name', result.full_name ?? '');
          setValue('employee_id', result.employee_id ?? '');
          // Set username from email prefix if not editing
          if (!isEdit) {
            setValue('username', email.split('@')[0].replace(/[^a-zA-Z0-9._-]/g, ''));
          }
          setAdLookupStatus('found');
        } else {
          // Not in AD — still allow manual entry, just pre-fill username
          if (!isEdit) {
            setValue('username', email.split('@')[0].replace(/[^a-zA-Z0-9._-]/g, ''));
          }
          setAdLookupStatus('not_found');
        }
      } catch {
        setAdLookupStatus('not_found');
      }
    }, 600); // debounce 600ms
    setAdLookupTimer(timer);
  }, [adLookupTimer, isEdit, setValue]);

  // ── Submit ─────────────────────────────────────────────────────────────────

  const mutation = useMutation({
    mutationFn: async (values: FormValues) => {
      const payload: Record<string, unknown> = { ...values };

      // Attach selected dashboard IDs for the backend to process
      if (selectedDashboards.length > 0) {
        payload.dashboard_ids = selectedDashboards.map(d => d.id);
      }

      if (isEdit) {
        const { password: _pw, username: _un, ...updateData } = payload;
        return adminApi.updateUser(Number(id), updateData);
      }
      return adminApi.createUser(payload);
    },
    onSuccess: async (data) => {
      // If dashboards selected, assign them via dashboard-permissions
      const userId = (data as Record<string, unknown>).id as number;
      if (selectedDashboards.length > 0 && userId) {
        // Get the user's role_id to assign dashboard permissions
        const roleId = watch('role_id');
        for (const dash of selectedDashboards) {
          try {
            await adminApi.createDashboardPermission({
              dashboard_id: dash.id,
              role_id: roleId,
              can_view: true,
              can_export: false,
            });
          } catch { /* ignore duplicate */ }
        }
      }
      qc.invalidateQueries({ queryKey: ['admin-users'] });
      navigate('/admin/users');
    },
  });

  async function onSubmit(values: FormValues) {
    setServerError(null);
    try { await mutation.mutateAsync(values); }
    catch (e: unknown) {
      const err = e as { response?: { data?: { detail?: string } } };
      setServerError(err?.response?.data?.detail ?? 'An error occurred. Please try again.');
    }
  }

  // ── Helpers ────────────────────────────────────────────────────────────────

  const showRegion = accessLevel !== 'HEAD_OFFICE';
  const showDistrict = ['DISTRICT', 'BRANCH'].includes(accessLevel);
  const showBranch = accessLevel === 'BRANCH';

  const adStatusIcon = adLookupStatus === 'loading'
    ? <CircularProgress size={16} />
    : adLookupStatus === 'found'
    ? <CheckCircleIcon fontSize="small" color="success" />
    : null;

  if (isEdit && loadingUser) return <LoadingState />;

  return (
    <Box maxWidth={760}>
      <Box display="flex" alignItems="center" gap={2} mb={3}>
        <Button startIcon={<ArrowBackIcon />} onClick={() => navigate('/admin/users')} variant="text">Back</Button>
        <Typography variant="h5" fontWeight={600}>{isEdit ? 'Edit User' : 'Create User'}</Typography>
      </Box>

      <Paper elevation={1} sx={{ p: 3 }}>
        {serverError && <Alert severity="error" sx={{ mb: 2 }}>{serverError}</Alert>}

        <Box component="form" onSubmit={handleSubmit(onSubmit)} noValidate>

          {/* ── Section 1: AD Email → auto-fill ─── */}
          <Typography variant="subtitle2" color="text.secondary" mb={2}>AD IDENTITY</Typography>
          <Grid container spacing={2}>
            <Grid item xs={12} sm={8}>
              <TextField
                {...register('email')}
                label="AD Email Address *"
                type="email"
                fullWidth
                placeholder="user@cbe.com.et"
                value={emailInput}
                onChange={e => {
                  setEmailInput(e.target.value);
                  setValue('email', e.target.value);
                  triggerAdLookup(e.target.value);
                }}
                error={!!errors.email}
                helperText={
                  errors.email?.message ??
                  (adLookupStatus === 'found' ? 'User found in AD — Full Name auto-populated' :
                   adLookupStatus === 'not_found' ? 'User not in AD — enter Full Name manually' : '')
                }
                InputProps={{ endAdornment: <InputAdornment position="end">{adStatusIcon}</InputAdornment> }}
              />
            </Grid>
            <Grid item xs={12} sm={4}>
              <TextField
                {...register('employee_id')}
                label="Employee ID"
                fullWidth
                helperText="Auto-filled from AD"
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                {...register('full_name')}
                label="Full Name *"
                fullWidth
                error={!!errors.full_name}
                helperText={errors.full_name?.message ?? 'Auto-filled from AD when email is found'}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField {...register('phone')} label="Phone (optional)" fullWidth />
            </Grid>
            {!isEdit && (
              <Grid item xs={12} sm={6}>
                <TextField
                  {...register('username')}
                  label="Username *"
                  fullWidth
                  error={!!errors.username}
                  helperText={errors.username?.message ?? 'Auto-filled from email prefix'}
                />
              </Grid>
            )}
            {!isEdit && (
              <Grid item xs={12} sm={6}>
                <TextField
                  {...register('password')}
                  label="Temporary Password"
                  type="password"
                  fullWidth
                  helperText="Min 8 chars. Leave blank to generate automatically."
                />
              </Grid>
            )}
          </Grid>

          <Divider sx={{ my: 3 }} />

          {/* ── Section 2: Role + Dashboard Access ─── */}
          <Typography variant="subtitle2" color="text.secondary" mb={2}>ROLE & DASHBOARD ACCESS</Typography>
          <Grid container spacing={2}>
            <Grid item xs={12} sm={6}>
              <Controller name="role_id" control={control} render={({ field }) => (
                <FormControl fullWidth error={!!errors.role_id}>
                  <InputLabel>Role *</InputLabel>
                  <Select {...field} label="Role *" value={field.value ?? ''}
                    onChange={e => field.onChange(Number(e.target.value))}>
                    {(roles as Array<{ id: number; display_name: string }>).map(r => (
                      <MenuItem key={r.id} value={r.id}>{r.display_name}</MenuItem>
                    ))}
                  </Select>
                  {errors.role_id && <FormHelperText>{errors.role_id.message}</FormHelperText>}
                </FormControl>
              )} />
            </Grid>

            {/* Dashboard Access — searchable multi-select */}
            <Grid item xs={12} sm={6}>
              <Autocomplete
                multiple
                options={filteredDashboards}
                value={selectedDashboards}
                onChange={(_, val) => setSelectedDashboards(val)}
                getOptionLabel={o => o.name}
                isOptionEqualToValue={(a, b) => a.id === b.id}
                inputValue={dashboardSearch}
                onInputChange={(_, val) => setDashboardSearch(val)}
                renderTags={(value, getTagProps) =>
                  value.map((option, index) => (
                    <Chip {...getTagProps({ index })} key={option.id} label={option.name} size="small" />
                  ))
                }
                renderInput={params => (
                  <TextField
                    {...params}
                    label="Dashboard Access"
                    placeholder="Search dashboards…"
                    helperText={`${allDashboards.length} available — select to grant access`}
                    InputProps={{ ...params.InputProps, startAdornment: <><SearchIcon fontSize="small" color="action" sx={{ ml: 0.5, mr: 0.5 }} />{params.InputProps.startAdornment}</> }}
                  />
                )}
                noOptionsText="No dashboards found"
              />
            </Grid>
          </Grid>

          <Divider sx={{ my: 3 }} />

          {/* ── Section 3: Organization Hierarchy ─── */}
          <Typography variant="subtitle2" color="text.secondary" mb={0.5}>ORGANIZATIONAL SCOPE</Typography>
          <Typography variant="caption" color="text.disabled" display="block" mb={2}>
            HEAD OFFICE: full access to all data · REGION: all data within selected region · DISTRICT: all data within selected district · BRANCH: data for selected branch only
          </Typography>
          <Grid container spacing={2}>
            <Grid item xs={12} sm={6}>
              <Controller name="access_level" control={control} render={({ field }) => (
                <FormControl fullWidth error={!!errors.access_level}>
                  <InputLabel>Viewer Level *</InputLabel>
                  <Select {...field} label="Viewer Level *">
                    {ACCESS_LEVELS.map(l => <MenuItem key={l} value={l}>{l.replace('_', ' ')}</MenuItem>)}
                  </Select>
                </FormControl>
              )} />
            </Grid>

            {showRegion && (
              <Grid item xs={12} sm={6}>
                <Controller name="region_id" control={control} render={({ field }) => (
                  <FormControl fullWidth error={!!errors.region_id}>
                    <InputLabel>Region *</InputLabel>
                    <Select {...field} label="Region *" value={field.value ?? ''}
                      onChange={e => field.onChange(e.target.value ? Number(e.target.value) : null)}>
                      <MenuItem value="">— Select Region —</MenuItem>
                      {(allRegions as OrgItem[]).map(r => (
                        <MenuItem key={r.id} value={r.id}>{r.name}</MenuItem>
                      ))}
                    </Select>
                    {errors.region_id && <FormHelperText>{errors.region_id.message}</FormHelperText>}
                    {!showDistrict && regionId && (
                      <FormHelperText sx={{ color: 'success.main' }}>
                        Covers all districts and their branches within this region
                      </FormHelperText>
                    )}
                  </FormControl>
                )} />
              </Grid>
            )}

            {showDistrict && (
              <Grid item xs={12} sm={6}>
                <Controller name="district_id" control={control} render={({ field }) => (
                  <FormControl fullWidth error={!!errors.district_id} disabled={!regionId}>
                    <InputLabel>District *</InputLabel>
                    <Select {...field} label="District *" value={field.value ?? ''}
                      onChange={e => field.onChange(e.target.value ? Number(e.target.value) : null)}>
                      <MenuItem value="">— Select District —</MenuItem>
                      {(districts as OrgItem[]).map(d => (
                        <MenuItem key={d.id} value={d.id}>{d.name}</MenuItem>
                      ))}
                    </Select>
                    {errors.district_id && <FormHelperText>{errors.district_id.message}</FormHelperText>}
                    {!showBranch && districtId && (
                      <FormHelperText sx={{ color: 'success.main' }}>
                        Covers all branches within this district
                      </FormHelperText>
                    )}
                  </FormControl>
                )} />
              </Grid>
            )}

            {showBranch && (
              <Grid item xs={12} sm={6}>
                <Controller name="branch_id" control={control} render={({ field }) => (
                  <FormControl fullWidth error={!!errors.branch_id} disabled={!districtId}>
                    <InputLabel>Branch *</InputLabel>
                    <Select {...field} label="Branch *" value={field.value ?? ''}
                      onChange={e => field.onChange(e.target.value ? Number(e.target.value) : null)}>
                      <MenuItem value="">— Select Branch —</MenuItem>
                      {(branches as OrgItem[]).map(b => (
                        <MenuItem key={b.id} value={b.id}>{b.name}</MenuItem>
                      ))}
                    </Select>
                    {errors.branch_id && <FormHelperText>{errors.branch_id.message}</FormHelperText>}
                  </FormControl>
                )} />
              </Grid>
            )}
          </Grid>

          <Divider sx={{ my: 3 }} />

          {/* ── Section 4: Department + Position (separate from geo hierarchy) ─── */}
          <Typography variant="subtitle2" color="text.secondary" mb={2}>DEPARTMENT & POSITION</Typography>
          <Grid container spacing={2}>
            <Grid item xs={12} sm={6}>
              <Controller name="department_id" control={control} render={({ field }) => (
                <FormControl fullWidth>
                  <InputLabel>Department</InputLabel>
                  <Select {...field} label="Department" value={field.value ?? ''}
                    onChange={e => field.onChange(e.target.value ? Number(e.target.value) : null)}>
                    <MenuItem value="">— None (optional) —</MenuItem>
                    {(departments as Array<{ id: number; name: string }>).map(d => (
                      <MenuItem key={d.id} value={d.id}>{d.name}</MenuItem>
                    ))}
                  </Select>
                </FormControl>
              )} />
            </Grid>
            <Grid item xs={12} sm={6}>
              <Controller name="position_id" control={control} render={({ field }) => (
                <FormControl fullWidth>
                  <InputLabel>Position (optional)</InputLabel>
                  <Select {...field} label="Position (optional)" value={field.value ?? ''}
                    onChange={e => field.onChange(e.target.value ? Number(e.target.value) : null)}>
                    <MenuItem value="">— None (optional) —</MenuItem>
                    {(positions as Array<{ id: number; name: string }>).map(p => (
                      <MenuItem key={p.id} value={p.id}>{p.name}</MenuItem>
                    ))}
                  </Select>
                </FormControl>
              )} />
            </Grid>
            <Grid item xs={12} sm={6}>
              <Controller name="is_active" control={control} render={({ field }) => (
                <FormControl fullWidth>
                  <InputLabel>Status</InputLabel>
                  <Select {...field} label="Status" value={field.value ? 'true' : 'false'}
                    onChange={e => field.onChange(e.target.value === 'true')}>
                    <MenuItem value="true">Active</MenuItem>
                    <MenuItem value="false">Inactive</MenuItem>
                  </Select>
                </FormControl>
              )} />
            </Grid>
          </Grid>

          <Box mt={3} display="flex" gap={2}>
            <Button type="submit" variant="contained" disabled={isSubmitting}>
              {isSubmitting ? <CircularProgress size={22} color="inherit" /> : isEdit ? 'Save Changes' : 'Create User'}
            </Button>
            <Button variant="outlined" onClick={() => navigate('/admin/users')}>Cancel</Button>
          </Box>
        </Box>
      </Paper>
    </Box>
  );
}
