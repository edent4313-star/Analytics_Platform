/**
 * Change Password — authenticated users change their own password.
 * Accessible at /change-password (public route, but token needed to submit).
 */
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  IconButton,
  InputAdornment,
  Paper,
  TextField,
  Typography,
} from '@mui/material';
import VisibilityIcon from '@mui/icons-material/Visibility';
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import { authApi } from '@api/auth.api';
import { APP_CONFIG } from '@config/app.config';

const schema = z.object({
  username: z.string().min(1, 'Username is required'),
  current_password: z.string().min(1, 'Current password is required'),
  new_password: z
    .string()
    .min(8, 'At least 8 characters')
    .regex(/[A-Z]/, 'Must contain an uppercase letter')
    .regex(/[0-9]/, 'Must contain a number'),
  confirm_password: z.string(),
}).refine(d => d.new_password === d.confirm_password, {
  message: 'Passwords do not match',
  path: ['confirm_password'],
});

type FormValues = z.infer<typeof schema>;

export function ChangePasswordPage() {
  const navigate = useNavigate();
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<FormValues>({
    resolver: zodResolver(schema),
  });

  async function onSubmit(values: FormValues) {
    setServerError(null);
    try {
      // Must log in first to get a token, then change password
      const tokenResp = await authApi.login({
        username: values.username,
        password: values.current_password,
      });
      // Store tokens temporarily so the changePassword call has auth
      localStorage.setItem(APP_CONFIG.tokenKey, tokenResp.access_token);
      localStorage.setItem(APP_CONFIG.refreshTokenKey, tokenResp.refresh_token);
      await authApi.changePassword(values.current_password, values.new_password);
      setSuccess(true);
    } catch (err: unknown) {
      const e = err as { response?: { data?: { detail?: string } } };
      setServerError(e?.response?.data?.detail ?? 'Failed to change password. Please try again.');
    }
  }

  if (success) {
    return (
      <Box sx={{ width: '100%', maxWidth: 420, px: 2 }}>
        <Paper elevation={3} sx={{ p: 4, borderRadius: 2, textAlign: 'center' }}>
          <CheckCircleIcon color="success" sx={{ fontSize: 64, mb: 2 }} />
          <Typography variant="h6" fontWeight={600} mb={1}>Password Changed</Typography>
          <Typography variant="body2" color="text.secondary" mb={3}>
            Your password has been updated successfully.
          </Typography>
          <Button variant="contained" fullWidth onClick={() => navigate('/login')}>
            Sign In with New Password
          </Button>
        </Paper>
      </Box>
    );
  }

  return (
    <Box sx={{ width: '100%', maxWidth: 420, px: 2 }}>
      <Paper elevation={3} sx={{ p: 4, borderRadius: 2 }}>
        <Typography variant="h5" fontWeight={600} mb={0.5}>Change Password</Typography>
        <Typography variant="body2" color="text.secondary" mb={3}>
          Enter your username and current password, then choose a new one.
        </Typography>

        {serverError && <Alert severity="error" sx={{ mb: 2 }}>{serverError}</Alert>}

        <Box component="form" onSubmit={handleSubmit(onSubmit)} noValidate>
          <TextField
            {...register('username')}
            label="Username"
            fullWidth
            autoFocus
            autoComplete="username"
            error={!!errors.username}
            helperText={errors.username?.message}
            sx={{ mb: 2 }}
          />
          <TextField
            {...register('current_password')}
            label="Current Password"
            type={showCurrent ? 'text' : 'password'}
            fullWidth
            autoComplete="current-password"
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
            autoComplete="new-password"
            error={!!errors.new_password}
            helperText={errors.new_password?.message ?? 'Min 8 chars, 1 uppercase, 1 number'}
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
            {...register('confirm_password')}
            label="Confirm New Password"
            type="password"
            fullWidth
            autoComplete="new-password"
            error={!!errors.confirm_password}
            helperText={errors.confirm_password?.message}
            sx={{ mb: 3 }}
          />
          <Button
            type="submit"
            variant="contained"
            fullWidth
            size="large"
            disabled={isSubmitting}
            sx={{ mb: 2 }}
          >
            {isSubmitting ? <CircularProgress size={24} color="inherit" /> : 'Change Password'}
          </Button>
          <Button fullWidth variant="text" onClick={() => navigate('/login')}>
            Back to Sign In
          </Button>
        </Box>
      </Paper>
    </Box>
  );
}
