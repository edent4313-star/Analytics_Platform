/**
 * Mock CBE AD Login Page — Development Environment.
 * Simulates the CBE employee login experience.
 * NOT connected to real CBE Active Directory.
 */
import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Alert, Box, Button, Chip, CircularProgress,
  Collapse, Divider, IconButton, InputAdornment,
  Paper, Table, TableBody, TableCell, TableHead,
  TableRow, TextField, Tooltip, Typography,
} from '@mui/material';
import VisibilityIcon from '@mui/icons-material/Visibility';
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff';
import LockIcon from '@mui/icons-material/Lock';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import { useAuth } from '@auth/useAuth';

const schema = z.object({
  employee_id: z.string().min(1, 'Employee ID is required'),
  password: z.string().min(1, 'Password is required'),
});
type FormValues = z.infer<typeof schema>;

const DEMO_USERS = [
  { id: 'CBE001', name: 'Abebe Girma',   role: 'Admin',              scope: 'Head Office' },
  { id: 'CBE002', name: 'Hiwot Tadesse', role: 'Head Office User',   scope: 'Head Office' },
  { id: 'CBE003', name: 'Bekele Alemu',  role: 'Regional Manager',   scope: 'Addis Ababa Region' },
  { id: 'CBE004', name: 'Tigist Haile',  role: 'District Manager',   scope: 'Bole District' },
  { id: 'CBE005', name: 'Dawit Kebede',  role: 'Branch Manager',     scope: 'Bole Main Branch' },
  { id: 'CBE006', name: 'Sara Mulugeta', role: 'Analyst',            scope: 'Head Office' },
  { id: 'CBE007', name: 'Yonas Tesfaye', role: 'Viewer',             scope: 'Bole Main Branch' },
];

export function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [showPassword, setShowPassword] = useState(false);
  const [showDemo, setShowDemo] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLocked, setIsLocked] = useState(false);

  const from = (location.state as { from?: { pathname: string } })?.from?.pathname || '/dashboards';

  const { register, handleSubmit, setValue, formState: { errors, isSubmitting } } = useForm<FormValues>({
    resolver: zodResolver(schema),
  });

  async function onSubmit(values: FormValues) {
    setError(null); setIsLocked(false);
    try {
      await login(values.employee_id, values.password);
      navigate(from, { replace: true });
    } catch (err: unknown) {
      const e = err as { response?: { data?: { detail?: string } } };
      const msg = e?.response?.data?.detail ?? 'Authentication failed. Please try again.';
      if (msg.toLowerCase().includes('lock')) setIsLocked(true);
      setError(msg);
    }
  }

  function fillDemo(id: string) {
    setValue('employee_id', id);
    setValue('password', 'Demo@1234');
  }

  return (
    <Box sx={{ width: '100%', maxWidth: 480, px: 2 }}>
      <Paper elevation={3} sx={{ borderRadius: 2, overflow: 'hidden' }}>

        {/* CBE Header band */}
        <Box sx={{ bgcolor: '#1a3a5c', color: 'white', px: 3, py: 2.5, textAlign: 'center' }}>
          <Typography variant="h6" fontWeight={700} letterSpacing={0.5}>
            Commercial Bank of Ethiopia
          </Typography>
          <Typography variant="body2" sx={{ opacity: 0.85, mt: 0.25 }}>
            Enterprise Analytics Platform
          </Typography>
        </Box>

        {/* Dev environment banner */}
        <Alert
          severity="warning"
          icon={<InfoOutlinedIcon />}
          sx={{ borderRadius: 0, py: 0.5 }}
        >
          <Typography variant="caption" fontWeight={600}>
            DEVELOPMENT ENVIRONMENT — Simulated Login — Not the real CBE AD
          </Typography>
        </Alert>

        <Box sx={{ p: 3 }}>
          <Typography variant="body2" color="text.secondary" mb={2.5} textAlign="center">
            Sign in with your CBE Employee ID
          </Typography>

          {error && (
            <Alert severity={isLocked ? 'warning' : 'error'} icon={isLocked ? <LockIcon fontSize="inherit" /> : undefined} sx={{ mb: 2 }}>
              {error}
            </Alert>
          )}

          <Box component="form" onSubmit={handleSubmit(onSubmit)} noValidate>
            <TextField
              {...register('employee_id')}
              label="Employee ID"
              placeholder="e.g. CBE003"
              fullWidth
              autoFocus
              autoComplete="username"
              error={!!errors.employee_id}
              helperText={errors.employee_id?.message}
              disabled={isSubmitting}
              sx={{ mb: 2 }}
            />
            <TextField
              {...register('password')}
              label="Password"
              type={showPassword ? 'text' : 'password'}
              fullWidth
              autoComplete="current-password"
              error={!!errors.password}
              helperText={errors.password?.message}
              disabled={isSubmitting}
              sx={{ mb: 3 }}
              InputProps={{
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton size="small" onClick={() => setShowPassword(p => !p)} aria-label="toggle password">
                      {showPassword ? <VisibilityOffIcon /> : <VisibilityIcon />}
                    </IconButton>
                  </InputAdornment>
                ),
              }}
            />
            <Button type="submit" variant="contained" fullWidth size="large"
              disabled={isSubmitting} sx={{ bgcolor: '#1a3a5c', '&:hover': { bgcolor: '#0f2540' } }}>
              {isSubmitting ? <CircularProgress size={24} color="inherit" /> : 'Sign In'}
            </Button>
          </Box>

          <Divider sx={{ my: 2 }}>
            <Chip label="Demo Users" size="small" onClick={() => setShowDemo(p => !p)}
              sx={{ cursor: 'pointer', fontSize: 11 }} />
          </Divider>

          <Collapse in={showDemo}>
            <Alert severity="info" sx={{ mb: 1.5 }}>
              <Typography variant="caption">
                All demo passwords: <strong>Demo@1234</strong> — Click a row to fill the form
              </Typography>
            </Alert>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell sx={{ py: 0.5, fontSize: 11, fontWeight: 700 }}>ID</TableCell>
                  <TableCell sx={{ py: 0.5, fontSize: 11, fontWeight: 700 }}>Name</TableCell>
                  <TableCell sx={{ py: 0.5, fontSize: 11, fontWeight: 700 }}>Role</TableCell>
                  <TableCell sx={{ py: 0.5, fontSize: 11, fontWeight: 700 }}>Scope</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {DEMO_USERS.map(u => (
                  <TableRow key={u.id} hover sx={{ cursor: 'pointer' }} onClick={() => fillDemo(u.id)}>
                    <TableCell sx={{ py: 0.5 }}><Typography variant="caption" fontFamily="monospace" fontWeight={600}>{u.id}</Typography></TableCell>
                    <TableCell sx={{ py: 0.5 }}><Typography variant="caption">{u.name}</Typography></TableCell>
                    <TableCell sx={{ py: 0.5 }}><Typography variant="caption">{u.role}</Typography></TableCell>
                    <TableCell sx={{ py: 0.5 }}><Typography variant="caption" color="text.secondary">{u.scope}</Typography></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Collapse>

          <Typography variant="caption" color="text.disabled" display="block" textAlign="center" mt={2}>
            This system is for authorized CBE personnel only.
            <br />All access is monitored and logged.
          </Typography>
        </Box>
      </Paper>
    </Box>
  );
}
