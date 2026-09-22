import { Box, Button, Typography } from '@mui/material';
import { useNavigate } from 'react-router-dom';

export function NotFoundPage() {
  const navigate = useNavigate();
  return (
    <Box sx={{ textAlign: 'center', py: 8 }}>
      <Typography variant="h1" fontWeight={700} color="text.disabled" sx={{ fontSize: '6rem' }}>
        404
      </Typography>
      <Typography variant="h5" gutterBottom>Dashboard not found</Typography>
      <Typography variant="body2" color="text.secondary" mb={4}>
        The page you are looking for does not exist or has been moved.
      </Typography>
      <Button variant="contained" onClick={() => navigate('/dashboards')}>
        Back to Dashboards
      </Button>
    </Box>
  );
}
