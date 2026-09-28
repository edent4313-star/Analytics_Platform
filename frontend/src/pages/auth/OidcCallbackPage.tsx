/**
 * OIDC Callback — handles the redirect from CBE IdP after successful authentication.
 * The backend redirects here with ?access_token=...&refresh_token=...
 * This page stores the tokens and redirects to the dashboard.
 */
import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Box, CircularProgress, Typography } from '@mui/material';
import { APP_CONFIG } from '@config/app.config';
import { useAuth } from '@auth/useAuth';

export function OidcCallbackPage() {
  const navigate = useNavigate();
  const { refreshUser } = useAuth();

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const accessToken = params.get('access_token');
    const refreshToken = params.get('refresh_token');

    if (accessToken && refreshToken) {
      localStorage.setItem(APP_CONFIG.tokenKey, accessToken);
      localStorage.setItem(APP_CONFIG.refreshTokenKey, refreshToken);
      // Clean tokens from URL immediately
      window.history.replaceState({}, '', '/auth/callback');
      refreshUser().then(() => navigate('/dashboards', { replace: true }));
    } else {
      navigate('/login?error=oidc_failed', { replace: true });
    }
  }, [navigate, refreshUser]);

  return (
    <Box display="flex" flexDirection="column" alignItems="center" justifyContent="center" minHeight="100vh" gap={2}>
      <CircularProgress />
      <Typography color="text.secondary">Completing CBE AD authentication…</Typography>
    </Box>
  );
}
