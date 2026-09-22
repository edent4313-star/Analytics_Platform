import { useQuery } from '@tanstack/react-query';
import { Box, Chip, Grid, Paper, Typography } from '@mui/material';
import { permissionsApi } from '@api/roles.api';
import { LoadingState } from '@components/common/LoadingState';

export function PermissionsPage() {
  const { data: perms = [], isLoading } = useQuery({ queryKey: ['permissions'], queryFn: permissionsApi.list });
  if (isLoading) return <LoadingState />;

  const byCategory = perms.reduce((acc, p) => {
    if (!acc[p.category]) acc[p.category] = [];
    acc[p.category].push(p);
    return acc;
  }, {} as Record<string, typeof perms>);

  return (
    <Box>
      <Typography variant="h5" fontWeight={600} mb={1}>Permissions</Typography>
      <Typography variant="body2" color="text.secondary" mb={3}>
        All available permissions in the system. Assign them to roles in the Roles page.
      </Typography>
      <Grid container spacing={2}>
        {Object.entries(byCategory).map(([cat, list]) => (
          <Grid item xs={12} sm={6} md={4} key={cat}>
            <Paper elevation={1} sx={{ p: 2 }}>
              <Typography variant="subtitle2" fontWeight={600} mb={1.5}>{cat}</Typography>
              <Box display="flex" flexWrap="wrap" gap={0.5}>
                {list.map(p => (
                  <Chip key={p.id} label={p.code} size="small" variant="outlined"
                    title={p.description ?? p.name} />
                ))}
              </Box>
            </Paper>
          </Grid>
        ))}
      </Grid>
    </Box>
  );
}
