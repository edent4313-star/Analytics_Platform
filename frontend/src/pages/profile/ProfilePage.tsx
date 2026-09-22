/**
 * User profile page — shows current user details + inline change-password form.
 */
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Divider,
  Grid,
  IconButton,
  InputAdornment,
  TextField,
  Typography,
} from '@mui/material';
import VisibilityIcon from '@mui/icons-material/Visibility';
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff';
import { useAuth } from '@auth/useAuth';
import { authApi } from '@api/auth.api';
import { formatDateTime } from '@utils/formatters';

function Field({ label, value }: { label: string; value?: string | null }) {
  return (
    <Box mb={1.5}>
      <Typography variant="caption" color="text.secondary" display="block">{label}</Typography>
      <Typography variant="body2" fontWeight={500}>{value || '—'}</Typography>
    </Box>
  );
}

const pwSchema = z.object({
  current_password: z.string().min(1, 'Required'),
  new_password: z.string()
    .min(8, 'At least 8 characters')
    .regex(/[A-Z]/, 'Needs an uppercase letter')
    .regex(/[0-9]/, 'Needs a number'),
  confirm: z.string(),
}).refine(d => d.new_password === d.confirm, {
  message: 'Passwords do not match', path: ['confirm'],
});
type PwForm = z.infer<typeof pwSchema>;

export function ProfilePage() {
  const { user } = useAuth();
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [pwSuccess, setPwSuccess] = useState(false);
  const [pwError, setPwError] = useState<string | null>(null);

  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<PwForm>({
    resolver: zodResolver(pwSchema),
  });

  if (!user) return null;

  async function onChangePassword(values: PwForm) {
    setPwError(null);
    setPwSuccess(false);
    try {
      await authApi.changePassword(values.current_password, values.new_password);
      setPwSuccess(true);
      reset();
    } catch (err: unknown) {
      const e = err as { response?: { data?: { detail?: string } } };
      setPwError(e?.response?.data?.detail ?? 'Failed to change password.');
    }
  }

  return (
    <Box maxWidth={800}>
      <Typography variant="h5" fontWeight={600} mb={3}>My Profile</Typography>

      <Grid container spacing={3}>
        {/* Profile details */}
        <Grid item xs={12} md={6}>
          <Card elevation={1}>
            <CardContent sx={{ p: 3 }}>
              {/* Avatar + name */}
              <Box display="flex" alignItems="center" gap={2} mb={3}>
                <Box sx={{
                  width: 56, height: 56, borderRadius: '50%',
                  bgcolor: 'primary.main', color: 'white',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 22, fontWeight: 700, flexShrink: 0,
                }}>
                  {user.full_name.charAt(0).toUpperCase()}
                </Box>
                <Box>
                  <Typography variant="h6" fontWeight={600}>{user.full_name}</Typography>
                  <Typography variant="body2" color="text.secondary">@{user.username}</Typography>
                  <Chip label={user.role ?? 'No Role'} size="small" color="primary" variant="outlined" sx={{ mt: 0.5 }} />
                </Box>
              </Box>

              <Divider sx={{ mb: 2 }} />

              <Typography variant="subtitle2" color="text.secondary" mb={1.5}>ACCOUNT</Typography>
              <Field label="Email" value={user.email} />
              <Field label="Phone" value={user.phone} />
              <Field label="Status" value={user.is_active ? 'Active' : 'Inactive'} />
              <Field label="Last Login" value={user.last_login ? formatDateTime(user.last_login) : 'Never'} />

              <Divider sx={{ my: 2 }} />

              <Typography variant="subtitle2" color="text.secondary" mb={1.5}>ORGANIZATION</Typography>
              <Field label="Access Level" value={user.access_level} />
              <Field label="Region" value={user.region_name ?? (user.region_id ? `#${user.region_id}` : 'All Regions')} />
              <Field label="District" value={user.district_name ?? (user.district_id ? `#${user.district_id}` : 'All Districts')} />
              <Field label="Branch" value={user.branch_name ?? (user.branch_id ? `#${user.branch_id}` : 'All Branches')} />
            </CardContent>
          </Card>
        </Grid>

        {/* Change password */}
        <Grid item xs={12} md={6}>
          <Card elevation={1}>
            <CardContent sx={{ p: 3 }}>
              <Typography variant="h6" fontWeight={600} mb={0.5}>Change Password</Typography>
              <Typography variant="body2" color="text.secondary" mb={2}>
                Choose a strong password with at least 8 characters, one uppercase letter, and one number.
              </Typography>

              {pwSuccess && (
                <Alert severity="success" sx={{ mb: 2 }} onClose={() => setPwSuccess(false)}>
                  Password changed successfully.
                </Alert>
              )}
              {pwError && (
                <Alert severity="error" sx={{ mb: 2 }} onClose={() => setPwError(null)}>
                  {pwError}
                </Alert>
              )}

              <Box component="form" onSubmit={handleSubmit(onChangePassword)} noValidate>
                <TextField
                  {...register('current_password')}
                  label="Current Password"
                  type={showCurrent ? 'text' : 'password'}
                  fullWidth
                  error={!!errors.current_password}
                  helperText={errors.current_password?.message}
                  sx={{ mb: 2 }}
                  InputProps={{
                    endAdornment: (
                      <InputAdornment position="end">
                        <IconButton size="small" onClick={() => setShowCurrent(p => !p)}>
                          {showCurrent ? <VisibilityOffIcon /> : <VisibilityIcon />}
                        </IconButton>
                      </InputAdornment>
                    ),
                  }}
                />
                <TextField
                  {...register('new_password')}
                  label="New Password"
                  type={showNew ? 'text' : 'password'}
                  fullWidth
                  error={!!errors.new_password}
                  helperText={errors.new_password?.message ?? 'Min 8 chars · 1 uppercase · 1 number'}
                  sx={{ mb: 2 }}
                  InputProps={{
                    endAdornment: (
                      <InputAdornment position="end">
                        <IconButton size="small" onClick={() => setShowNew(p => !p)}>
                          {showNew ? <VisibilityOffIcon /> : <VisibilityIcon />}
                        </IconButton>
                      </InputAdornment>
                    ),
                  }}
                />
                <TextField
                  {...register('confirm')}
                  label="Confirm New Password"
                  type="password"
                  fullWidth
                  error={!!errors.confirm}
                  helperText={errors.confirm?.message}
                  sx={{ mb: 3 }}
                />
                <Button
                  type="submit"
                  variant="contained"
                  fullWidth
                  disabled={isSubmitting}
                >
                  {isSubmitting ? <CircularProgress size={22} color="inherit" /> : 'Change Password'}
                </Button>
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
}
