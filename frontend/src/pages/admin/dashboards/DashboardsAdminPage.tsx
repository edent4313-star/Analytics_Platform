import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Box, Button, Chip, Dialog, DialogActions, DialogContent, DialogTitle,
  FormControl, FormControlLabel, Grid, IconButton, InputLabel, MenuItem,
  Paper, Select, Switch, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, Tooltip, Typography,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import VisibilityIcon from '@mui/icons-material/Visibility';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import SecurityIcon from '@mui/icons-material/Security';
import { dashboardsApi } from '@api/dashboards.api';
import { adminApi } from '@api/adminApi';
import { LoadingState } from '@components/common/LoadingState';

export function DashboardsAdminPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [permDialog, setPermDialog] = useState<{dashboardId:number;dashboardName:string}|null>(null);
  const [newPerm, setNewPerm] = useState({role_id:'',can_view:true,can_export:false});

  const {data,isLoading} = useQuery({
    queryKey:['dashboards-admin'],
    queryFn:()=>dashboardsApi.list({page_size:100}),
  });
  const {data:roles=[]} = useQuery({queryKey:['admin-roles'],queryFn:adminApi.listRoles});
  const {data:dashPerms=[],refetch:refetchPerms} = useQuery({
    queryKey:['dash-perms',permDialog?.dashboardId],
    queryFn:()=>adminApi.listDashboardPermissions(permDialog?.dashboardId),
    enabled:!!permDialog,
  });

  const duplicate = useMutation({
    mutationFn:(id:number)=>dashboardsApi.duplicate(id),
    onSuccess:()=>qc.invalidateQueries({queryKey:['dashboards-admin']}),
  });

  const addPerm = useMutation({
    mutationFn:()=>adminApi.createDashboardPermission({
      dashboard_id:permDialog?.dashboardId,
      role_id:Number(newPerm.role_id),
      can_view:newPerm.can_view,
      can_export:newPerm.can_export,
    }),
    onSuccess:()=>{refetchPerms();setNewPerm({role_id:'',can_view:true,can_export:false});},
  });

  const removePerm = useMutation({
    mutationFn:(id:number)=>adminApi.deleteDashboardPermission(id),
    onSuccess:()=>refetchPerms(),
  });

  if(isLoading) return <LoadingState/>;
  const dashboards = data?.items??[];

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h5" fontWeight={600}>Dashboards ({data?.total??0})</Typography>
        <Button variant="contained" startIcon={<AddIcon/>} onClick={()=>navigate('/admin/designer')}>
          New Dashboard
        </Button>
      </Box>
      <Paper elevation={1}>
        <TableContainer>
          <Table size="small">
            <TableHead><TableRow>
              <TableCell>Name</TableCell><TableCell>Code</TableCell>
              <TableCell>Published</TableCell><TableCell align="center">Actions</TableCell>
            </TableRow></TableHead>
            <TableBody>
              {dashboards.length===0&&<TableRow><TableCell colSpan={4} align="center">No dashboards</TableCell></TableRow>}
              {dashboards.map((d:Record<string,unknown>)=>(
                <TableRow key={d.id as number} hover>
                  <TableCell><Typography variant="body2" fontWeight={500}>{d.name as string}</Typography></TableCell>
                  <TableCell><Chip label={d.code as string} size="small" variant="outlined"/></TableCell>
                  <TableCell>{d.published_version?<Chip label={`v${d.published_version}`} size="small" color="success"/>:<Chip label="Draft" size="small" variant="outlined"/>}</TableCell>
                  <TableCell align="center">
                    <Tooltip title="View"><IconButton size="small" onClick={()=>navigate(`/dashboard/${d.code}`)}><VisibilityIcon fontSize="small"/></IconButton></Tooltip>
                    <Tooltip title="Edit"><IconButton size="small" onClick={()=>navigate(`/admin/designer/${d.id}`)}><EditIcon fontSize="small"/></IconButton></Tooltip>
                    <Tooltip title="Duplicate"><IconButton size="small" onClick={()=>duplicate.mutate(d.id as number)}><ContentCopyIcon fontSize="small"/></IconButton></Tooltip>
                    <Tooltip title="Manage Access"><IconButton size="small" color="primary"
                      onClick={()=>setPermDialog({dashboardId:d.id as number,dashboardName:d.name as string})}>
                      <SecurityIcon fontSize="small"/>
                    </IconButton></Tooltip>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>

      {permDialog&&(
        <Dialog open onClose={()=>setPermDialog(null)} maxWidth="sm" fullWidth>
          <DialogTitle>Dashboard Access — {permDialog.dashboardName}</DialogTitle>
          <DialogContent>
            <Typography variant="subtitle2" mb={1}>Current Access</Typography>
            {(dashPerms as Record<string,unknown>[]).length===0&&
              <Typography variant="body2" color="text.secondary" mb={2}>No roles have access yet.</Typography>}
            {(dashPerms as Array<{id:number;role_id:number;role_name?:string;can_view:boolean;can_export:boolean}>).map((dp) => (
              <Box key={dp.id} display="flex" alignItems="center" gap={1} mb={0.5}>
                <Chip label={dp.role_name ?? `Role ${dp.role_id}`} size="small" color="primary"/>
                {dp.can_view && <Chip label="VIEW" size="small" variant="outlined" color="success"/>}
                {dp.can_export && <Chip label="EXPORT" size="small" variant="outlined" color="info"/>}
                <Box flexGrow={1}/>
                <Button size="small" color="error" onClick={()=>removePerm.mutate(dp.id)}>Remove</Button>
              </Box>
            ))}
            <Box mt={2} p={2} bgcolor="grey.50" borderRadius={1}>
              <Typography variant="subtitle2" mb={1}>Add Access</Typography>
              <Grid container spacing={1} alignItems="center">
                <Grid item xs={5}>
                  <FormControl size="small" fullWidth>
                    <InputLabel>Role</InputLabel>
                    <Select value={newPerm.role_id} label="Role" onChange={e=>setNewPerm(p=>({...p,role_id:String(e.target.value)}))}>
                      {(roles as Record<string,unknown>[]).map(r=><MenuItem key={r.id as number} value={r.id as number}>{r.display_name as string}</MenuItem>)}
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item xs={3}>
                  <FormControlLabel control={<Switch checked={newPerm.can_view} onChange={e=>setNewPerm(p=>({...p,can_view:e.target.checked}))} size="small"/>} label="View"/>
                </Grid>
                <Grid item xs={3}>
                  <FormControlLabel control={<Switch checked={newPerm.can_export} onChange={e=>setNewPerm(p=>({...p,can_export:e.target.checked}))} size="small"/>} label="Export"/>
                </Grid>
                <Grid item xs={1}>
                  <Button size="small" variant="contained" onClick={()=>addPerm.mutate()} disabled={!newPerm.role_id}>Add</Button>
                </Grid>
              </Grid>
            </Box>
          </DialogContent>
          <DialogActions sx={{px:3,pb:2}}>
            <Button onClick={()=>setPermDialog(null)}>Close</Button>
          </DialogActions>
        </Dialog>
      )}
    </Box>
  );
}
