import { Box, Button, Typography } from '@mui/material';
import { useNavigate } from 'react-router-dom';

export function UnauthorizedPage() {
  const navigate = useNavigate();
  return (
    <Box sx={{ textAlign: 'center', py: 8 }}>
      <Typography variant="h4" gutterBottom fontWeight={600}>
        Session Expired
      </Typography>
      <Typography variant="body1" color="text.secondary" mb={4}>
        Your session has expired. Please log in again.
      </Typography>
      <Button variant="contained" onClick={() => navigate('/login')}>
        Sign In
      </Button>
    </Box>
  );
}
