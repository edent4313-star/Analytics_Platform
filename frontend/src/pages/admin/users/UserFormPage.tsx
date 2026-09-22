/**
 * Create / Edit user form with dependent org dropdowns.
 * Dependent dropdown chain: Region → District → Branch
 * Each level is disabled and cleared when the parent changes.
 * Org validation enforced on backend too — frontend is UX only.
 */
import { useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Alert, Box, Button, CircularProgress, Divider,
  FormControl, FormHelperText, Grid, InputLabel,
  MenuItem, Paper, Select, TextField, Typography,
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import { usersApi } from '@api/users.api';
import { rolesApi } from '@api/roles.api';
import { organizationApi } from '@api/organization.api';
import { LoadingState } from '@components/common/LoadingState';

const ACCESS_LEVELS = ['HEAD_OFFICE', 'REGION', 'DISTRICT', 'BRANCH'] as const;

const schema = z.object({
  username: z.string().min(3, 'Min 3 characters').max(100),
  full_name: z.string().min(2, 'Required'),
  email: z.string().email('Invalid email'),
  phone: z.string().optional(),
  password: z.string().optional(),
  access_level: z.enum(ACCESS_LEVELS),
  role_id: z.number({ invalid_type_error: 'Select a role' }),
  region_id: z.number().nullable().optional(),
  district_id: z.number().nullable().optional(),
  branch_id: z.number().nullable().optional(),
  is_active: z.boolean(),
}).superRefine((d, ctx) => {
  if (d.access_level !== 'HEAD_OFFICE' && !d.region_id)
    ctx.addIssue({ code: 'custom', path: ['region_id'], message: 'Region required' });
  if (['DISTRICT', 'BRANCH'].includes(d.access_level) && !d.district_id)
    ctx.addIssue({ code: 'custom', path: ['district_id'], message: 'District required' });
  if (d.access_level === 'BRANCH' && !d.branch_id)
    ctx.addIssue({ code: 'custom', path: ['branch_id'], message: 'Branch required' });
});

type FormValues = z.infer<typeof schema>;

export function UserFormPage() {
  const { id } = useParams<{ id?: string }>();
  const isEdit = !!id;
  const navigate = useNavigate();
  const qc = useQueryClient();

  const { data: existing, isLoading: loadingUser } = useQuery({
    queryKey: ['user', id],
    queryFn: () => usersApi.get(Number(id)),
    enabled: isEdit,
  });

  const { data: roles = [] } = useQuery({ queryKey: ['roles'], queryFn: rolesApi.list });
  const { data: allRegions = [] } = useQuery({ queryKey: ['regions-all'], queryFn: organizationApi.getAllRegions });

  const {
    register, control, handleSubmit, watch, setValue, reset,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      access_level: 'BRANCH', is_active: true,
      region_id: null, district_id: null, branch_id: null,
    },
  });

  // Populate form when editing
  useEffect(() => {
    if (existing) {
      reset({
        username: existing.username,
        full_name: existing.full_name,
        email: existing.email,
        phone: existing.phone ?? '',
        access_level: existing.access_level as typeof ACCESS_LEVELS[number],
        role_id: undefined, // loaded separately
        region_id: existing.region_id,
        district_id: existing.district_id,
        branch_id: existing.branch_id,
        is_active: existing.is_active,
      });
      // Set role from name
      if (existing.role && roles.length > 0) {
        const role = roles.find(r => r.name === existing.role);
        if (role) setValue('role_id', role.id);
      }
    }
  }, [existing, roles, reset, setValue]);

  const accessLevel = watch('access_level');
  const regionId = watch('region_id');
  const districtId = watch('district_id');

  // Load districts when region changes
  const { data: districts = [] } = useQuery({
    queryKey: ['districts-admin', regionId],
    queryFn: () => organizationApi.getAllDistricts(regionId!),
    enabled: !!regionId,
  });

  // Load branches when district changes
  const { data: branches = [] } = useQuery({
    queryKey: ['branches-admin', districtId],
    queryFn: () => organizationApi.getAllBranches(districtId!),
    enabled: !!districtId,
  });

  // Clear dependent fields when parent changes
  useEffect(() => { setValue('district_id', null); setValue('branch_id', null); }, [regionId, setValue]);
  useEffect(() => { setValue('branch_id', null); }, [districtId, setValue]);
  // Clear org fields when access level changes to HEAD_OFFICE
  useEffect(() => {
    if (accessLevel === 'HEAD_OFFICE') {
      setValue('region_id', null); setValue('district_id', null); setValue('branch_id', null);
    }
  }, [accessLevel, setValue]);

  const mutation = useMutation({
    mutationFn: (values: FormValues) => {
      if (isEdit) {
        const { password: _pw, username: _un, ...updateData } = values;
        return usersApi.update(Number(id), updateData);
      }
      return usersApi.create({ ...values, password: values.password! });
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['users'] }); navigate('/admin/users'); },
  });

  const [serverError, setServerError] = useState<string | null>(null);
  async function onSubmit(values: FormValues) {
    setServerError(null);
    try { await mutation.mutateAsync(values); }
    catch (e: unknown) {
      const err = e as { response?: { data?: { detail?: string } } };
      setServerError(err?.response?.data?.detail ?? 'An error occurred');
    }
  }

  if (isEdit && loadingUser) return <LoadingState />;

  return (
    <Box maxWidth={700}>
      <Box display="flex" alignItems="center" gap={2} mb={3}>
        <Button startIcon={<ArrowBackIcon />} onClick={() => navigate('/admin/users')} variant="text">Back</Button>
        <Typography variant="h5" fontWeight={600}>{isEdit ? 'Edit User' : 'Create User'}</Typography>
      </Box>

      <Paper elevation={1} sx={{ p: 3 }}>
        {serverError && <Alert severity="error" sx={{ mb: 2 }}>{serverError}</Alert>}

        <Box component="form" onSubmit={handleSubmit(onSubmit)} noValidate>
          <Typography variant="subtitle2" color="text.secondary" mb={2}>ACCOUNT DETAILS</Typography>
          <Grid container spacing={2}>
            <Grid item xs={12} sm={6}>
              <TextField {...register('full_name')} label="Full Name" fullWidth error={!!errors.full_name} helperText={errors.full_name?.message} disabled={isSubmitting} />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField {...register('username')} label="Username" fullWidth error={!!errors.username} helperText={errors.username?.message} disabled={isEdit || isSubmitting} />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField {...register('email')} label="Email" type="email" fullWidth error={!!errors.email} helperText={errors.email?.message} disabled={isSubmitting} />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField {...register('phone')} label="Phone (optional)" fullWidth disabled={isSubmitting} />
            </Grid>
            {!isEdit && (
              <Grid item xs={12} sm={6}>
                <TextField {...register('password')} label="Password" type="password" fullWidth error={!!errors.password} helperText={errors.password?.message ?? 'Min 8 characters'} disabled={isSubmitting} />
              </Grid>
            )}
            <Grid item xs={12} sm={isEdit ? 12 : 6}>
              <Controller name="role_id" control={control} render={({ field }) => (
                <FormControl fullWidth error={!!errors.role_id}>
                  <InputLabel>Role</InputLabel>
                  <Select {...field} label="Role" value={field.value ?? ''} onChange={e => field.onChange(Number(e.target.value))}>
                    {roles.map(r => <MenuItem key={r.id} value={r.id}>{r.display_name}</MenuItem>)}
                  </Select>
                  {errors.role_id && <FormHelperText>{errors.role_id.message}</FormHelperText>}
                </FormControl>
              )} />
            </Grid>
          </Grid>

          <Divider sx={{ my: 3 }} />
          <Typography variant="subtitle2" color="text.secondary" mb={2}>ORGANIZATIONAL ACCESS</Typography>
          <Grid container spacing={2}>
            <Grid item xs={12} sm={6}>
              <Controller name="access_level" control={control} render={({ field }) => (
                <FormControl fullWidth error={!!errors.access_level}>
                  <InputLabel>Access Level</InputLabel>
                  <Select {...field} label="Access Level">
                    {ACCESS_LEVELS.map(l => <MenuItem key={l} value={l}>{l}</MenuItem>)}
                  </Select>
                </FormControl>
              )} />
            </Grid>
            <Grid item xs={12} sm={6}>
              <Controller name="region_id" control={control} render={({ field }) => (
                <FormControl fullWidth error={!!errors.region_id} disabled={accessLevel === 'HEAD_OFFICE'}>
                  <InputLabel>Region</InputLabel>
                  <Select {...field} label="Region" value={field.value ?? ''} onChange={e => field.onChange(e.target.value ? Number(e.target.value) : null)}>
                    <MenuItem value="">— Select Region —</MenuItem>
                    {allRegions.map(r => <MenuItem key={r.id} value={r.id}>{r.name}</MenuItem>)}
                  </Select>
                  {errors.region_id && <FormHelperText>{errors.region_id.message}</FormHelperText>}
                </FormControl>
              )} />
            </Grid>
            <Grid item xs={12} sm={6}>
              <Controller name="district_id" control={control} render={({ field }) => (
                <FormControl fullWidth error={!!errors.district_id} disabled={!regionId || ['HEAD_OFFICE', 'REGION'].includes(accessLevel)}>
                  <InputLabel>District</InputLabel>
                  <Select {...field} label="District" value={field.value ?? ''} onChange={e => field.onChange(e.target.value ? Number(e.target.value) : null)}>
                    <MenuItem value="">— Select District —</MenuItem>
                    {districts.map(d => <MenuItem key={d.id} value={d.id}>{d.name}</MenuItem>)}
                  </Select>
                  {errors.district_id && <FormHelperText>{errors.district_id.message}</FormHelperText>}
                </FormControl>
              )} />
            </Grid>
            <Grid item xs={12} sm={6}>
              <Controller name="branch_id" control={control} render={({ field }) => (
                <FormControl fullWidth error={!!errors.branch_id} disabled={!districtId || accessLevel !== 'BRANCH'}>
                  <InputLabel>Branch</InputLabel>
                  <Select {...field} label="Branch" value={field.value ?? ''} onChange={e => field.onChange(e.target.value ? Number(e.target.value) : null)}>
                    <MenuItem value="">— Select Branch —</MenuItem>
                    {branches.map(b => <MenuItem key={b.id} value={b.id}>{b.name}</MenuItem>)}
                  </Select>
                  {errors.branch_id && <FormHelperText>{errors.branch_id.message}</FormHelperText>}
                </FormControl>
              )} />
            </Grid>
            <Grid item xs={12} sm={6}>
              <Controller name="is_active" control={control} render={({ field }) => (
                <FormControl fullWidth>
                  <InputLabel>Status</InputLabel>
                  <Select {...field} label="Status" value={field.value ? 'true' : 'false'} onChange={e => field.onChange(e.target.value === 'true')}>
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

// useState needed in same file
import { useState } from 'react';
