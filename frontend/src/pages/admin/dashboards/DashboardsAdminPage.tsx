import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Box, Button, Chip, IconButton, Paper, Table, TableBody,
  TableCell, TableContainer, TableHead, TableRow, Tooltip, Typography,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import VisibilityIcon from '@mui/icons-material/Visibility';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import { dashboardsApi } from '@api/dashboards.api';
import { LoadingState } from '@components/common/LoadingState';

const STATUS_COLORS: Record<string, 'default' | 'info' | 'warning' | 'success' | 'error'> = {
  DRAFT: 'default', SUBMITTED: 'info', APPROVED: 'warning', PUBLISHED: 'success', ARCHIVED: 'error',
};

export function DashboardsAdminPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['dashboards-admin'],
    queryFn: () => dashboardsApi.list({ page_size: 100 }),
  });

  const duplicate = useMutation({
    mutationFn: (id: number) => dashboardsApi.duplicate(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['dashboards-admin'] }),
  });

  if (isLoading) return <LoadingState />;
  const dashboards = data?.items ?? [];

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h5" fontWeight={600}>Dashboards ({data?.total ?? 0})</Typography>
        <Button variant="contained" startIcon={<AddIcon />} onClick={() => navigate('/admin/designer')}>
          New Dashboard
        </Button>
      </Box>
      <Paper elevation={1}>
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Name</TableCell>
                <TableCell>Code</TableCell>
                <TableCell>Published Version</TableCell>
                <TableCell align="center">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {dashboards.length === 0 && <TableRow><TableCell colSpan={4} align="center">No dashboards</TableCell></TableRow>}
              {dashboards.map((d: { id: number; name: string; code: string; published_version: number | null }) => (
                <TableRow key={d.id} hover>
                  <TableCell><Typography variant="body2" fontWeight={500}>{d.name}</Typography></TableCell>
                  <TableCell><Chip label={d.code} size="small" variant="outlined" /></TableCell>
                  <TableCell>
                    {d.published_version
                      ? <Chip label={`v${d.published_version}`} size="small" color="success" />
                      : <Chip label="No published version" size="small" variant="outlined" />}
                  </TableCell>
                  <TableCell align="center">
                    <Tooltip title="View"><IconButton size="small" onClick={() => navigate(`/dashboard/${d.code}`)}><VisibilityIcon fontSize="small" /></IconButton></Tooltip>
                    <Tooltip title="Edit in Designer"><IconButton size="small" onClick={() => navigate(`/admin/designer/${d.id}`)}><EditIcon fontSize="small" /></IconButton></Tooltip>
                    <Tooltip title="Duplicate"><IconButton size="small" onClick={() => duplicate.mutate(d.id)}><ContentCopyIcon fontSize="small" /></IconButton></Tooltip>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>
    </Box>
  );
}
