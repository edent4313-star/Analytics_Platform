/**
 * Login page — wired to POST /api/v1/auth/login.
 * Handles: wrong credentials, account locked, account inactive, network errors.
 * After success, redirects to the originally-requested page or /dashboards.
 */
import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
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
  Link,
} from '@mui/material';
import VisibilityIcon from '@mui/icons-material/Visibility';
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff';
import BarChartIcon from '@mui/icons-material/BarChart';
import LockIcon from '@mui/icons-material/Lock';
import { useAuth } from '@auth/useAuth';

const schema = z.object({
  username: z.string().min(1, 'Username is required'),
  password: z.string().min(1, 'Password is required'),
});
type FormValues = z.infer<typeof schema>;

export function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLocked, setIsLocked] = useState(false);

  const from = (location.state as { from?: { pathname: string } })?.from?.pathname || '/dashboards';

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<FormValues>({
    resolver: zodResolver(schema),
  });

  async function onSubmit(values: FormValues) {
    setError(null);
    setIsLocked(false);
    try {
      await login(values);
      navigate(from, { replace: true });
    } catch (err: unknown) {
      const e = err as { response?: { status?: number; data?: { detail?: string } } };
      const detail = e?.response?.data?.detail ?? 'Login failed. Please try again.';
      // Detect lockout message
      if (detail.toLowerCase().includes('locked')) setIsLocked(true);
      setError(detail);
    }
  }

  return (
    <Box sx={{ width: '100%', maxWidth: 420, px: 2 }}>
      <Paper elevation={3} sx={{ p: 4, borderRadius: 2 }}>
        {/* Logo */}
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', mb: 3, gap: 1.5 }}>
          <BarChartIcon color="primary" sx={{ fontSize: 40 }} />
          <Box>
            <Typography variant="h6" fontWeight={700} lineHeight={1.2}>
              Analytics Platform
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Enterprise Dashboard System
            </Typography>
          </Box>
        </Box>

        <Typography variant="h5" fontWeight={600} mb={0.5}>Sign in</Typography>
        <Typography variant="body2" color="text.secondary" mb={3}>
          Use your organizational credentials
        </Typography>

        {error && (
          <Alert
            severity={isLocked ? 'warning' : 'error'}
            icon={isLocked ? <LockIcon fontSize="inherit" /> : undefined}
            sx={{ mb: 2 }}
          >
            {error}
          </Alert>
        )}

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
            disabled={isSubmitting}
          />
          <TextField
            {...register('password')}
            label="Password"
            type={showPassword ? 'text' : 'password'}
            fullWidth
            autoComplete="current-password"
            error={!!errors.password}
            helperText={errors.password?.message}
            sx={{ mb: 3 }}
            disabled={isSubmitting}
            InputProps={{
              endAdornment: (
                <InputAdornment position="end">
                  <IconButton
                    onClick={() => setShowPassword(p => !p)}
                    edge="end"
                    size="small"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <VisibilityOffIcon /> : <VisibilityIcon />}
                  </IconButton>
                </InputAdornment>
              ),
            }}
          />
          <Button
            type="submit"
            variant="contained"
            fullWidth
            size="large"
            disabled={isSubmitting}
            sx={{ mb: 2 }}
          >
            {isSubmitting ? <CircularProgress size={24} color="inherit" /> : 'Sign In'}
          </Button>
        </Box>

        <Box textAlign="center">
          <Link
            component="button"
            variant="body2"
            onClick={() => navigate('/change-password')}
            underline="hover"
          >
            Change my password
          </Link>
        </Box>

        <Typography variant="caption" color="text.disabled" display="block" textAlign="center" mt={3}>
          This system is for authorized personnel only.
          <br />
          All access is monitored and logged.
        </Typography>
      </Paper>
    </Box>
  );
}
