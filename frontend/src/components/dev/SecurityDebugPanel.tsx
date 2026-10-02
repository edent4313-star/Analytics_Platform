/**
 * Security Debug Panel — DEVELOPMENT ONLY.
 * Shows current user identity, permissions, and data scope.
 * Hidden automatically when VITE_APP_ENV=production.
 * Useful for verifying that the correct role/scope/permissions are loaded.
 */
import { useState } from 'react';
import {
  Box, Chip, Collapse, Divider, IconButton,
  Paper, Tooltip, Typography,
} from '@mui/material';
import BugReportIcon from '@mui/icons-material/BugReport';
import CloseIcon from '@mui/icons-material/Close';
import { useAuth } from '@auth/useAuth';

/// <reference types="vite/client" />
const IS_DEV = import.meta.env.VITE_APP_ENV !== 'production';

export function SecurityDebugPanel() {
  const { user, permissions, dataScope } = useAuth();
  const [open, setOpen] = useState(false);

  // Never render in production
  if (!IS_DEV || !user) return null;

  return (
    <Box sx={{ position: 'fixed', bottom: 16, right: 16, zIndex: 9999 }}>
      {!open && (
        <Tooltip title="Auth Debug Panel (dev only)">
          <IconButton
            onClick={() => setOpen(true)}
            sx={{ bgcolor: '#1a3a5c', color: 'white', '&:hover': { bgcolor: '#0f2540' }, boxShadow: 3 }}
          >
            <BugReportIcon />
          </IconButton>
        </Tooltip>
      )}

      <Collapse in={open} unmountOnExit>
        <Paper elevation={6} sx={{ width: 300, border: '2px solid #1a3a5c', borderRadius: 2, overflow: 'hidden' }}>
          {/* Header */}
          <Box sx={{ bgcolor: '#1a3a5c', color: 'white', px: 2, py: 1, display: 'flex', alignItems: 'center' }}>
            <BugReportIcon fontSize="small" sx={{ mr: 1 }} />
            <Typography variant="caption" fontWeight={700} flexGrow={1}>
              🔒 AUTH DEBUG (dev only)
            </Typography>
            <IconButton size="small" onClick={() => setOpen(false)} sx={{ color: 'white', p: 0.25 }}>
              <CloseIcon fontSize="small" />
            </IconButton>
          </Box>

          <Box sx={{ p: 1.5, fontSize: 12 }}>
            {/* Identity */}
            <Row label="Employee ID" value={user.employee_id} mono />
            <Row label="Name" value={user.full_name} />
            <Row label="Role" value={user.role} chip />
            <Row label="Position" value={user.position ?? '—'} />
            <Row label="Department" value={user.department ?? '—'} />
            <Row label="Provider" value={user.provider} chip color={user.provider === 'mock' ? 'warning' : 'success'} />

            <Divider sx={{ my: 1 }} />

            {/* Scope */}
            <Typography variant="caption" fontWeight={700} color="text.secondary" display="block" mb={0.5}>
              ORGANIZATIONAL SCOPE
            </Typography>
            <Row label="Access Level" value={dataScope?.access_level ?? user.access_level} chip />
            <Row label="Region" value={dataScope?.region_name ? `${dataScope.region_name} (${dataScope.region_id})` : '—'} />
            <Row label="District" value={dataScope?.district_name ? `${dataScope.district_name} (${dataScope.district_id})` : '—'} />
            <Row label="Branch" value={dataScope?.branch_name ? `${dataScope.branch_name} (${dataScope.branch_id})` : '—'} />
            <Row label="Dept Scope" value={(dataScope?.department_scope ?? ['ALL']).join(', ')} />

            <Divider sx={{ my: 1 }} />

            {/* Permissions */}
            <Typography variant="caption" fontWeight={700} color="text.secondary" display="block" mb={0.5}>
              PERMISSIONS ({permissions.length})
            </Typography>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.4 }}>
              {permissions.length === 0 && (
                <Typography variant="caption" color="text.disabled">None</Typography>
              )}
              {permissions.map(p => (
                <Chip key={p} label={p} size="small"
                  sx={{ fontSize: 9, height: 18, bgcolor: '#e3f2fd' }} />
              ))}
            </Box>
          </Box>
        </Paper>
      </Collapse>
    </Box>
  );
}

function Row({ label, value, mono, chip, color }: {
  label: string; value: string;
  mono?: boolean; chip?: boolean;
  color?: 'default' | 'primary' | 'success' | 'warning' | 'error';
}) {
  return (
    <Box display="flex" alignItems="center" justifyContent="space-between" mb={0.4}>
      <Typography variant="caption" color="text.secondary" sx={{ minWidth: 90 }}>{label}</Typography>
      {chip ? (
        <Chip label={value} size="small" color={color ?? 'default'}
          sx={{ fontSize: 9, height: 18 }} />
      ) : (
        <Typography variant="caption" fontWeight={500}
          fontFamily={mono ? 'monospace' : undefined}
          sx={{ maxWidth: 170, textAlign: 'right', wordBreak: 'break-all' }}>
          {value}
        </Typography>
      )}
    </Box>
  );
}
