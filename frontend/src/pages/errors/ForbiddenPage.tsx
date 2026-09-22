import { Box, Button, Typography } from '@mui/material';
import LockIcon from '@mui/icons-material/Lock';
import { useNavigate } from 'react-router-dom';

export function ForbiddenPage() {
  const navigate = useNavigate();
  return (
    <Box sx={{ textAlign: 'center', py: 8 }}>
      <LockIcon sx={{ fontSize: 72, color: 'warning.main', mb: 2 }} />
      <Typography variant="h4" gutterBottom fontWeight={600}>
        Access Denied
      </Typography>
      <Typography variant="body1" color="text.secondary" mb={4}>
        You do not have permission to access this resource.
        <br />
        Contact your administrator if you believe this is an error.
      </Typography>
      <Button variant="outlined" onClick={() => navigate(-1)} sx={{ mr: 2 }}>
        Go Back
      </Button>
      <Button variant="contained" onClick={() => navigate('/dashboards')}>
        Dashboards
      </Button>
    </Box>
  );
}
