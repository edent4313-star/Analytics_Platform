import { Box, Card, CardActionArea, CardContent, Grid, Typography } from '@mui/material';
import PeopleIcon from '@mui/icons-material/People';
import SecurityIcon from '@mui/icons-material/Security';
import AccountTreeIcon from '@mui/icons-material/AccountTree';
import StorageIcon from '@mui/icons-material/Storage';
import DesignServicesIcon from '@mui/icons-material/DesignServices';
import HistoryIcon from '@mui/icons-material/History';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@auth/useAuth';

const adminSections = [
  { label: 'Users', description: 'Create and manage user accounts', icon: <PeopleIcon />, path: '/admin/users', permission: 'user.view' },
  { label: 'Roles & Permissions', description: 'Manage roles and permission assignments', icon: <SecurityIcon />, path: '/admin/roles', permission: 'role.view' },
  { label: 'Organization', description: 'Manage regions, districts, and branches', icon: <AccountTreeIcon />, path: '/admin/organization' },
  { label: 'Data Sources', description: 'Configure analytical data sources', icon: <StorageIcon />, path: '/admin/data-sources', permission: 'datasource.view' },
  { label: 'Dashboard Designer', description: 'Create and configure dashboards', icon: <DesignServicesIcon />, path: '/admin/designer', permission: 'dashboard.create' },
  { label: 'Audit Logs', description: 'View system activity and access logs', icon: <HistoryIcon />, path: '/admin/audit', permission: 'audit.view' },
];

export function AdminHome() {
  const navigate = useNavigate();
  const { hasPermission } = useAuth();

  const visible = adminSections.filter(
    (s) => !s.permission || hasPermission(s.permission),
  );

  return (
    <Box>
      <Typography variant="h5" fontWeight={600} mb={0.5}>Administration</Typography>
      <Typography variant="body2" color="text.secondary" mb={3}>
        Manage platform configuration, users, and data sources.
      </Typography>
      <Grid container spacing={2}>
        {visible.map((section) => (
          <Grid item xs={12} sm={6} md={4} key={section.path}>
            <Card elevation={1}>
              <CardActionArea onClick={() => navigate(section.path)}>
                <CardContent sx={{ display: 'flex', gap: 2, alignItems: 'flex-start' }}>
                  <Box sx={{ color: 'primary.main', mt: 0.5 }}>{section.icon}</Box>
                  <Box>
                    <Typography variant="subtitle2" fontWeight={600}>{section.label}</Typography>
                    <Typography variant="body2" color="text.secondary">{section.description}</Typography>
                  </Box>
                </CardContent>
              </CardActionArea>
            </Card>
          </Grid>
        ))}
      </Grid>
    </Box>
  );
}
