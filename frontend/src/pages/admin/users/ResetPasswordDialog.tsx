/**
 * Admin dialog to reset another user's password.
 * Used inside UserListPage / UserFormPage (Phase 4).
 */
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Alert,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  TextField,
  Typography,
} from '@mui/material';
import { authApi } from '@api/auth.api';

const schema = z.object({
  new_password: z.string().min(8, 'At least 8 characters'),
  confirm: z.string(),
}).refine(d => d.new_password === d.confirm, {
  message: 'Passwords do not match',
  path: ['confirm'],
});

type FormValues = z.infer<typeof schema>;

interface ResetPasswordDialogProps {
  open: boolean;
  userId: number;
  username: string;
  onClose: () => void;
  onSuccess: () => void;
}

export function ResetPasswordDialog({ open, userId, username, onClose, onSuccess }: ResetPasswordDialogProps) {
  const [error, setError] = useState<string | null>(null);

  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<FormValues>({
    resolver: zodResolver(schema),
  });

  async function onSubmit(values: FormValues) {
    setError(null);
    try {
      await authApi.resetPassword(userId, values.new_password);
      reset();
      onSuccess();
    } catch (err: unknown) {
      const e = err as { response?: { data?: { detail?: string } } };
      setError(e?.response?.data?.detail ?? 'Reset failed. Please try again.');
    }
  }

  function handleClose() {
    reset();
    setError(null);
    onClose();
  }

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="xs" fullWidth>
      <DialogTitle>Reset Password</DialogTitle>
      <Box component="form" onSubmit={handleSubmit(onSubmit)}>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" mb={2}>
            Set a new password for <strong>{username}</strong>.
            The user will need to use this password on their next login.
          </Typography>
          {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
          <TextField
            {...register('new_password')}
            label="New Password"
            type="password"
            fullWidth
            autoFocus
            error={!!errors.new_password}
            helperText={errors.new_password?.message ?? 'Minimum 8 characters'}
            sx={{ mb: 2 }}
          />
          <TextField
            {...register('confirm')}
            label="Confirm Password"
            type="password"
            fullWidth
            error={!!errors.confirm}
            helperText={errors.confirm?.message}
          />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={handleClose} color="inherit">Cancel</Button>
          <Button type="submit" variant="contained" color="warning" disabled={isSubmitting}>
            {isSubmitting ? <CircularProgress size={20} color="inherit" /> : 'Reset Password'}
          </Button>
        </DialogActions>
      </Box>
    </Dialog>
  );
}

// Needed for the Box import
import { Box } from '@mui/material';
