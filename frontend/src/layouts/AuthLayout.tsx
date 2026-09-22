/**
 * Minimal layout for unauthenticated pages (login, etc.).
 */
import { Outlet } from 'react-router-dom';
import { Box } from '@mui/material';

export function AuthLayout() {
  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        bgcolor: 'grey.100',
      }}
    >
      <Outlet />
    </Box>
  );
}
