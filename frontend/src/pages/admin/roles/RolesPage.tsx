import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Alert, Box, Button, Checkbox, Chip, CircularProgress, Dialog, DialogActions,
  DialogContent, DialogTitle, Divider, FormControlLabel, Grid, IconButton,
  List, ListItem, ListItemButton, ListItemText, Paper, Stack,
  TextField, Typography,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import SecurityIcon from '@mui/icons-material/Security';
import { adminApi } from '@api/adminApi';
import { LoadingState } from '@components/common/LoadingState';
import { ConfirmDialog } from '@components/common/ConfirmDialog';

export function RolesPage() {
  const qc = useQueryClient();
  const [selected, setSelected] = useState<Record<string,unknown>|null>(null);
  const [roleDialog, setRoleDialog] = useState<{mode:'create'|'edit';role?:Record<string,unknown>}|null>(null);
  const [permDialog, setPermDialog] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<{id:number;name:string}|null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string|null>(null);
  const [form, setForm] = useState({name:'',display_name:'',description:''});
  const [selectedPerms, setSelectedPerms] = useState<number[]>([]);

  const {data:roles=[],isLoading} = useQuery({queryKey:['admin-roles'],queryFn:adminApi.listRoles});
  const {data:allPerms=[]} = useQuery({queryKey:['admin-permissions'],queryFn:adminApi.listPermissions});
  const {data:rolePerms=[]} = useQuery({
    queryKey:['role-perms',selected?.id],
    queryFn:()=>adminApi.setRolePermissions ? null : null, // loaded on demand
    enabled:false,
  });

  const permsByCategory = (allPerms as Record<string,unknown>[]).reduce((acc,p)=>{
    const cat = p.category as string;
    if(!acc[cat]) acc[cat]=[];
    (acc[cat] as typeof p[]).push(p);
    return acc;
  },{} as Record<string,Record<string,unknown>[]>);

  async function saveRole() {
    setSaving(true); setError(null);
    try {
      if(roleDialog?.mode==='create') await adminApi.createRole(form);
      else if(roleDialog?.role) await adminApi.updateRole(roleDialog.role.id as number, form);
      qc.invalidateQueries({queryKey:['admin-roles']});
      setRoleDialog(null);
    } catch(e:unknown){
      const err=e as {response?:{data?:{detail?:string}}};
      setError(err?.response?.data?.detail??'Save failed');
    } finally{setSaving(false);}
  }

  async function savePermissions() {
    if(!selected) return;
    setSaving(true);
    try {
      await adminApi.setRolePermissions(selected.id as number, selectedPerms);
      qc.invalidateQueries({queryKey:['admin-roles']});
      setPermDialog(false);
    } catch(e:unknown){
      const err=e as {response?:{data?:{detail?:string}}};
      setError(err?.response?.data?.detail??'Failed');
    } finally{setSaving(false);}
  }

  const deleteMutation = useMutation({
    mutationFn:(id:number)=>adminApi.deleteRole(id),
    onSuccess:()=>{qc.invalidateQueries({queryKey:['admin-roles']});setConfirmDelete(null);},
  });

  if(isLoading) return <LoadingState/>;

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h5" fontWeight={600}>Roles</Typography>
        <Button variant="contained" startIcon={<AddIcon/>}
          onClick={()=>{setForm({name:'',display_name:'',description:''});setRoleDialog({mode:'create'});}}>
          Create Role
        </Button>
      </Box>
      <Grid container spacing={2}>
        <Grid item xs={12} md={4}>
          <Paper elevation={1}>
            <List disablePadding>
              {(roles as Record<string,unknown>[]).map((role,i)=>(
                <Box key={role.id as number}>
                  {i>0&&<Divider/>}
                  <ListItem disablePadding secondaryAction={
                    <Stack direction="row">
                      {!role.is_system&&<>
                        <IconButton size="small" onClick={()=>{setForm({name:role.name as string,display_name:role.display_name as string,description:(role.description as string)||''});setRoleDialog({mode:'edit',role});}}>
                          <EditIcon fontSize="small"/>
                        </IconButton>
                        <IconButton size="small" color="error" onClick={()=>setConfirmDelete({id:role.id as number,name:role.name as string})}>
                          <DeleteIcon fontSize="small"/>
                        </IconButton>
                      </>}
                    </Stack>
                  }>
                    <ListItemButton selected={selected?.id===role.id} onClick={()=>setSelected(role)}>
                      <ListItemText
                        primary={<Box display="flex" alignItems="center" gap={1}>
                          {role.display_name as string}
                          {role.is_system&&<Chip label="System" size="small"/>}
                        </Box>}
                        secondary={role.name as string}
                      />
                    </ListItemButton>
                  </ListItem>
                </Box>
              ))}
            </List>
          </Paper>
        </Grid>
        <Grid item xs={12} md={8}>
          {selected?(
            <Paper elevation={1} sx={{p:2}}>
              <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
                <Box>
                  <Typography variant="h6" fontWeight={600}>{selected.display_name as string}</Typography>
                  <Typography variant="body2" color="text.secondary">{selected.description as string||'No description'}</Typography>
                </Box>
                {!selected.is_system&&(
                  <Button variant="outlined" startIcon={<SecurityIcon/>}
                    onClick={()=>{setSelectedPerms([]);setPermDialog(true);}}>
                    Manage Permissions
                  </Button>
                )}
              </Box>
              <Typography variant="caption" color="text.secondary">
                Use "Manage Permissions" to assign permissions to this role.
              </Typography>
            </Paper>
          ):(
            <Paper elevation={1} sx={{p:4,textAlign:'center'}}>
              <SecurityIcon sx={{fontSize:48,color:'text.disabled',mb:1}}/>
              <Typography color="text.secondary">Select a role to manage permissions</Typography>
            </Paper>
          )}
        </Grid>
      </Grid>

      {roleDialog&&(
        <Dialog open onClose={()=>setRoleDialog(null)} maxWidth="xs" fullWidth>
          <DialogTitle>{roleDialog.mode==='create'?'Create Role':'Edit Role'}</DialogTitle>
          <DialogContent>
            {error&&<Alert severity="error" sx={{mb:2}}>{error}</Alert>}
            <Stack spacing={2} mt={1}>
              <TextField size="small" label="Role Name (code)" fullWidth value={form.name}
                onChange={e=>setForm(p=>({...p,name:e.target.value}))}
                helperText="Uppercase, e.g. BRANCH_MANAGER"/>
              <TextField size="small" label="Display Name" fullWidth value={form.display_name}
                onChange={e=>setForm(p=>({...p,display_name:e.target.value}))}/>
              <TextField size="small" label="Description" fullWidth multiline rows={2} value={form.description}
                onChange={e=>setForm(p=>({...p,description:e.target.value}))}/>
            </Stack>
          </DialogContent>
          <DialogActions sx={{px:3,pb:2}}>
            <Button onClick={()=>setRoleDialog(null)} color="inherit">Cancel</Button>
            <Button onClick={saveRole} variant="contained" disabled={saving}>
              {saving?<CircularProgress size={18} color="inherit"/>:'Save'}
            </Button>
          </DialogActions>
        </Dialog>
      )}

      {permDialog&&selected&&(
        <Dialog open onClose={()=>setPermDialog(false)} maxWidth="sm" fullWidth>
          <DialogTitle>Permissions for {selected.display_name as string}</DialogTitle>
          <DialogContent dividers>
            {Object.entries(permsByCategory).map(([cat,perms])=>(
              <Box key={cat} mb={2}>
                <Typography variant="subtitle2" color="text.secondary" mb={1}>{cat}</Typography>
                <Grid container>
                  {perms.map(p=>(
                    <Grid item xs={6} key={p.id as number}>
                      <FormControlLabel
                        control={<Checkbox size="small" checked={selectedPerms.includes(p.id as number)}
                          onChange={e=>setSelectedPerms(prev=>e.target.checked?[...prev,p.id as number]:prev.filter(x=>x!==p.id))}/>}
                        label={<Typography variant="body2">{p.name as string}</Typography>}
                      />
                    </Grid>
                  ))}
                </Grid>
              </Box>
            ))}
          </DialogContent>
          <DialogActions sx={{px:3,pb:2}}>
            <Button onClick={()=>setPermDialog(false)} color="inherit">Cancel</Button>
            <Button onClick={savePermissions} variant="contained" disabled={saving}>
              {saving?<CircularProgress size={18} color="inherit"/>:'Save Permissions'}
            </Button>
          </DialogActions>
        </Dialog>
      )}

      {confirmDelete&&<ConfirmDialog open
        title="Delete Role" message={`Delete role "${confirmDelete.name}"? This cannot be undone.`}
        confirmLabel="Delete" confirmColor="error"
        onConfirm={()=>deleteMutation.mutate(confirmDelete.id)}
        onCancel={()=>setConfirmDelete(null)}/>}
    </Box>
  );
}
