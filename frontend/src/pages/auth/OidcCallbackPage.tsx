/**
 * OIDC Callback Page — /auth/callback
 *
 * Handles the redirect from CBE Identity Provider after successful authentication.
 * Tokens are delivered via URL fragment (#access_token=...&refresh_token=...)
 * NOT query params — this prevents tokens appearing in server logs or browser history.
 */
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Box, Alert, CircularProgress, Typography } from '@mui/material';
import { APP_CONFIG } from '@config/app.config';
import { useAuth } from '@auth/useAuth';

export function OidcCallbackPage() {
  const navigate = useNavigate();
  const { refreshUser } = useAuth();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Tokens are in the URL fragment (#), not query string
    const fragment = window.location.hash.substring(1); // remove leading #
    const params = new URLSearchParams(fragment);

    const accessToken = params.get('access_token');
    const refreshToken = params.get('refresh_token');

    if (accessToken && refreshToken) {
      // Store tokens
      localStorage.setItem(APP_CONFIG.tokenKey, accessToken);
      localStorage.setItem(APP_CONFIG.refreshTokenKey, refreshToken);

      // Immediately clear the fragment from URL to prevent token exposure
      window.history.replaceState(null, '', window.location.pathname);

      // Load full identity then redirect to dashboards
      refreshUser()
        .then(() => navigate('/dashboards', { replace: true }))
        .catch(() => {
          setError('Authentication succeeded but failed to load user profile. Please try logging in again.');
        });
    } else {
      // Check for error in query params (IdP may send errors as query params)
      const qParams = new URLSearchParams(window.location.search);
      const oidcError = qParams.get('error');
      const errorDesc = qParams.get('error_description');

      if (oidcError) {
        setError(`CBE AD authentication failed: ${errorDesc || oidcError}`);
      } else {
        setError('Authentication callback received no tokens. Please try logging in again.');
      }
    }
  }, [navigate, refreshUser]);

  if (error) {
    return (
      <Box display="flex" flexDirection="column" alignItems="center" justifyContent="center" minHeight="100vh" gap={2} px={3}>
        <Alert severity="error" sx={{ maxWidth: 480 }}>
          <Typography variant="body2">{error}</Typography>
        </Alert>
        <Typography
          variant="body2"
          color="primary"
          sx={{ cursor: 'pointer', textDecoration: 'underline' }}
          onClick={() => navigate('/login')}
        >
          Return to login
        </Typography>
      </Box>
    );
  }

  return (
    <Box display="flex" flexDirection="column" alignItems="center" justifyContent="center" minHeight="100vh" gap={2}>
      <CircularProgress />
      <Typography color="text.secondary" variant="body2">
        Completing CBE AD authentication…
      </Typography>
    </Box>
  );
}
