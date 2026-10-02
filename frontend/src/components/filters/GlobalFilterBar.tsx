import { useQuery } from '@tanstack/react-query';
import {
  Box, Button, FormControl, InputLabel, MenuItem,
  Select, Stack, TextField, Typography,
} from '@mui/material';
import FilterListIcon from '@mui/icons-material/FilterList';
import { organizationApi } from '@api/organization.api';
import type { DashboardFilter, ActiveFilters } from '@/types/dashboard.types';

// Minimal user scope — works with both CurrentUser and AuthenticatedIdentity
interface UserScope {
  access_level: string;
  region_id: number | null;
  district_id: number | null;
  branch_id: number | null;
}

interface Props {
  filterDefs: DashboardFilter[];
  filters: ActiveFilters;
  onFiltersChange: (f: ActiveFilters) => void;
  user: UserScope;
}

export function GlobalFilterBar({ filterDefs, filters, onFiltersChange, user }: Props) {
  const global = filterDefs.filter(f => f.is_global);
  if (global.length === 0) return null;

  const regionId = filters.region_id as number | undefined;
  const districtId = filters.district_id as number | undefined;

  const { data: regions = [] } = useQuery({
    queryKey: ['regions'],
    queryFn: organizationApi.getRegions,
  });
  const { data: districts = [] } = useQuery({
    queryKey: ['districts', regionId],
    queryFn: () => organizationApi.getDistricts(regionId!),
    enabled: !!regionId,
  });
  const { data: branches = [] } = useQuery({
    queryKey: ['branches', districtId],
    queryFn: () => organizationApi.getBranches(districtId!),
    enabled: !!districtId,
  });

  function set(key: string, val: unknown) {
    const next = { ...filters, [key]: val || null };
    if (key === 'region_id') { next.district_id = null; next.branch_id = null; }
    if (key === 'district_id') { next.branch_id = null; }
    onFiltersChange(next);
  }

  const hasRegionFilter = global.some(f => f.filter_type === 'REGION');
  const hasDistrictFilter = global.some(f => f.filter_type === 'DISTRICT');
  const hasBranchFilter = global.some(f => f.filter_type === 'BRANCH');
  const hasDateFilter = global.some(f => f.filter_type === 'DATE_RANGE');

  const regionLocked = user.access_level !== 'HEAD_OFFICE';
  const districtLocked = ['DISTRICT', 'BRANCH'].includes(user.access_level);
  const branchLocked = user.access_level === 'BRANCH';

  return (
    <Box sx={{ bgcolor: 'grey.50', border: 1, borderColor: 'divider', borderRadius: 1, p: 2, mb: 2 }}>
      <Box display="flex" alignItems="center" gap={1} mb={1.5}>
        <FilterListIcon fontSize="small" color="action" />
        <Typography variant="subtitle2" fontWeight={600}>Filters</Typography>
        <Box flexGrow={1} />
        <Button size="small" onClick={() => onFiltersChange({})}>Clear All</Button>
      </Box>
      <Stack direction="row" flexWrap="wrap" gap={2}>
        {hasRegionFilter && (
          <FormControl size="small" sx={{ minWidth: 160 }} disabled={regionLocked}>
            <InputLabel>Region</InputLabel>
            <Select value={filters.region_id ?? ''} label="Region" onChange={e => set('region_id', e.target.value)}>
              <MenuItem value="">All</MenuItem>
              {regions.map(r => <MenuItem key={r.id} value={r.id}>{r.name}</MenuItem>)}
            </Select>
          </FormControl>
        )}
        {hasDistrictFilter && (
          <FormControl size="small" sx={{ minWidth: 160 }} disabled={districtLocked || !regionId}>
            <InputLabel>District</InputLabel>
            <Select value={filters.district_id ?? ''} label="District" onChange={e => set('district_id', e.target.value)}>
              <MenuItem value="">All</MenuItem>
              {districts.map(d => <MenuItem key={d.id} value={d.id}>{d.name}</MenuItem>)}
            </Select>
          </FormControl>
        )}
        {hasBranchFilter && (
          <FormControl size="small" sx={{ minWidth: 160 }} disabled={branchLocked || !districtId}>
            <InputLabel>Branch</InputLabel>
            <Select value={filters.branch_id ?? ''} label="Branch" onChange={e => set('branch_id', e.target.value)}>
              <MenuItem value="">All</MenuItem>
              {branches.map(b => <MenuItem key={b.id} value={b.id}>{b.name}</MenuItem>)}
            </Select>
          </FormControl>
        )}
        {hasDateFilter && (
          <>
            <TextField size="small" type="date" label="From" InputLabelProps={{ shrink: true }}
              value={filters.date_from ?? ''} onChange={e => set('date_from', e.target.value)} />
            <TextField size="small" type="date" label="To" InputLabelProps={{ shrink: true }}
              value={filters.date_to ?? ''} onChange={e => set('date_to', e.target.value)} />
          </>
        )}
        {global.filter(f => f.filter_type === 'CATEGORY' || f.filter_type === 'STATUS').map(f => (
          <TextField key={f.id} size="small" label={f.display_name}
            value={(filters[f.field_name ?? ''] as string) ?? ''}
            onChange={e => set(f.field_name ?? '', e.target.value)}
            sx={{ minWidth: 140 }} />
        ))}
      </Stack>
    </Box>
  );
}
