/**
 * Dashboard home — lists all dashboards the current user is authorized to access.
 * This list comes from the backend; the frontend cannot widen it.
 */
import { useQuery } from '@tanstack/react-query';
import {
  Box,
  Card,
  CardActionArea,
  CardContent,
  Grid,
  Typography,
} from '@mui/material';
import DashboardIcon from '@mui/icons-material/Dashboard';
import { useNavigate } from 'react-router-dom';
import { dashboardsApi } from '@api/dashboards.api';
import { LoadingState } from '@components/common/LoadingState';
import { ErrorState } from '@components/common/ErrorState';
import { EmptyState } from '@components/common/EmptyState';
import { useAuth } from '@auth/useAuth';

export function DashboardHome() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['dashboards'],
    queryFn: () => dashboardsApi.list(),
  });

  if (isLoading) return <LoadingState message="Loading your dashboards..." />;
  if (isError) return <ErrorState onRetry={refetch} />;

  const dashboards = data?.items ?? [];

  return (
    <Box>
      <Box mb={3}>
        <Typography variant="h5" fontWeight={600}>
          My Dashboards
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Welcome back, {user?.full_name}. Here are the dashboards you have access to.
        </Typography>
      </Box>

      {dashboards.length === 0 ? (
        <EmptyState
          title="No dashboards available"
          message="You have not been granted access to any dashboards yet. Contact your administrator."
        />
      ) : (
        <Grid container spacing={2}>
          {dashboards.map((dashboard: { id: number; code: string; name: string; description?: string }) => (
            <Grid item xs={12} sm={6} md={4} lg={3} key={dashboard.id}>
              <Card
                elevation={1}
                sx={{
                  height: '100%',
                  '&:hover': { elevation: 4, transform: 'translateY(-2px)', transition: 'transform 0.15s' },
                }}
              >
                <CardActionArea
                  onClick={() => navigate(`/dashboard/${dashboard.code}`)}
                  sx={{ height: '100%', p: 0 }}
                >
                  <CardContent>
                    <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.5, mb: 1.5 }}>
                      <Box
                        sx={{
                          width: 40,
                          height: 40,
                          borderRadius: 1.5,
                          bgcolor: 'primary.main',
                          opacity: 0.12,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          flexShrink: 0,
                        }}
                      >
                        <DashboardIcon color="primary" fontSize="small" />
                      </Box>
                      <Box sx={{ flexGrow: 1, minWidth: 0 }}>
                        <Typography variant="subtitle2" fontWeight={600} noWrap>
                          {dashboard.name}
                        </Typography>
                        <Typography variant="caption" color="text.secondary" sx={{ fontFamily: 'monospace' }}>
                          /{dashboard.code}
                        </Typography>
                      </Box>
                    </Box>
                    {dashboard.description && (
                      <Typography variant="body2" color="text.secondary" sx={{
                        display: '-webkit-box',
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: 'vertical',
                        overflow: 'hidden',
                      }}>
                        {dashboard.description}
                      </Typography>
                    )}
                  </CardContent>
                </CardActionArea>
              </Card>
            </Grid>
          ))}
        </Grid>
      )}
    </Box>
  );
}
