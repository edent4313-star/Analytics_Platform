import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  Box,
  Drawer,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Collapse,
  Divider,
  Typography,
  Tooltip,
} from '@mui/material';
import DashboardIcon from '@mui/icons-material/Dashboard';
import PeopleIcon from '@mui/icons-material/People';
import SecurityIcon from '@mui/icons-material/Security';
import AccountTreeIcon from '@mui/icons-material/AccountTree';
import StorageIcon from '@mui/icons-material/Storage';
import TableChartIcon from '@mui/icons-material/TableChart';
import DesignServicesIcon from '@mui/icons-material/DesignServices';
import AdminPanelSettingsIcon from '@mui/icons-material/AdminPanelSettings';
import HistoryIcon from '@mui/icons-material/History';
import ExpandLess from '@mui/icons-material/ExpandLess';
import ExpandMore from '@mui/icons-material/ExpandMore';
import BarChartIcon from '@mui/icons-material/BarChart';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import { useAuth } from '@auth/useAuth';

const DRAWER_WIDTH = 240;
const DRAWER_COLLAPSED_WIDTH = 64;

interface NavItem {
  label: string;
  path?: string;
  icon: React.ReactNode;
  permission?: string;
  role?: string | string[];
  children?: NavItem[];
}

const mainNavItems: NavItem[] = [
  {
    label: 'Dashboards',
    path: '/dashboards',
    icon: <DashboardIcon />,
  },
];

const adminNavItems: NavItem[] = [
  {
    label: 'Administration',
    icon: <AdminPanelSettingsIcon />,
    children: [
      // ── Visible now ─────────────────────────────────────────────────────
      { label: 'Users',       path: '/admin/users',       icon: <PeopleIcon />,      permission: 'user.view' },
      { label: 'Departments', path: '/admin/departments', icon: <StorageIcon /> },
      { label: 'Regions',     path: '/admin/regions',     icon: <AccountTreeIcon /> },
      { label: 'Districts',   path: '/admin/districts',   icon: <AccountTreeIcon /> },
      { label: 'Branches',    path: '/admin/branches',    icon: <AccountTreeIcon /> },
      { label: 'Positions',   path: '/admin/positions',   icon: <PeopleIcon /> },
      // ── Hidden for now (not deleted) ────────────────────────────────────
      // { label: 'Roles',             path: '/admin/roles',       icon: <SecurityIcon />,          permission: 'role.view' },
      // { label: 'Permissions',       path: '/admin/permissions', icon: <SecurityIcon />,          permission: 'permission.view' },
      // { label: 'Organization Tree', path: '/admin/organization',icon: <AccountTreeIcon /> },
      // { label: 'Data Sources',      path: '/admin/data-sources',icon: <StorageIcon />,           permission: 'datasource.view' },
      // { label: 'Datasets',          path: '/admin/datasets',    icon: <TableChartIcon />,        permission: 'dataset.view' },
      // { label: 'Dashboard Designer',path: '/admin/designer',    icon: <DesignServicesIcon />,    permission: 'dashboard.create' },
      // { label: 'All Dashboards',    path: '/admin/dashboards',  icon: <BarChartIcon />,          permission: 'dashboard.view' },
      // { label: 'Approvals',         path: '/admin/approvals',   icon: <CheckCircleOutlineIcon />,permission: 'dashboard.publish' },
      // { label: 'Audit Logs',        path: '/admin/audit',       icon: <HistoryIcon />,           permission: 'audit.view' },
    ],
  },
];

interface SidebarProps {
  open: boolean;
}

export function Sidebar({ open }: SidebarProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const { hasPermission, hasRole } = useAuth();
  const [adminOpen, setAdminOpen] = useState(
    location.pathname.startsWith('/admin'),
  );

  const drawerWidth = open ? DRAWER_WIDTH : DRAWER_COLLAPSED_WIDTH;

  function isAuthorized(item: NavItem): boolean {
    if (item.permission && !hasPermission(item.permission)) return false;
    if (item.role && !hasRole(item.role)) return false;
    return true;
  }

  function renderNavItem(item: NavItem, depth = 0) {
    if (!isAuthorized(item)) return null;

    if (item.children) {
      const visibleChildren = item.children.filter(isAuthorized);
      if (visibleChildren.length === 0) return null;

      return (
        <Box key={item.label}>
          <ListItem disablePadding>
            <Tooltip title={!open ? item.label : ''} placement="right">
              <ListItemButton
                onClick={() => setAdminOpen((prev) => !prev)}
                sx={{ pl: 2 + depth * 1.5 }}
              >
                <ListItemIcon sx={{ minWidth: 40 }}>{item.icon}</ListItemIcon>
                {open && <ListItemText primary={item.label} />}
                {open && (adminOpen ? <ExpandLess /> : <ExpandMore />)}
              </ListItemButton>
            </Tooltip>
          </ListItem>
          <Collapse in={adminOpen && open} timeout="auto" unmountOnExit>
            <List disablePadding>
              {visibleChildren.map((child) => renderNavItem(child, depth + 1))}
            </List>
          </Collapse>
        </Box>
      );
    }

    const isActive = item.path ? location.pathname.startsWith(item.path) : false;

    return (
      <ListItem key={item.label} disablePadding>
        <Tooltip title={!open ? item.label : ''} placement="right">
          <ListItemButton
            selected={isActive}
            onClick={() => item.path && navigate(item.path)}
            sx={{ pl: 2 + depth * 1.5 }}
          >
            <ListItemIcon sx={{ minWidth: 40 }}>{item.icon}</ListItemIcon>
            {open && <ListItemText primary={item.label} />}
          </ListItemButton>
        </Tooltip>
      </ListItem>
    );
  }

  return (
    <Drawer
      variant="permanent"
      sx={{
        width: drawerWidth,
        flexShrink: 0,
        transition: 'width 0.2s',
        '& .MuiDrawer-paper': {
          width: drawerWidth,
          boxSizing: 'border-box',
          transition: 'width 0.2s',
          overflowX: 'hidden',
        },
      }}
    >
      {/* Logo / App name */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          px: 2,
          py: 1.5,
          minHeight: 64,
          borderBottom: 1,
          borderColor: 'divider',
        }}
      >
        <BarChartIcon color="primary" sx={{ mr: open ? 1.5 : 0 }} />
        {open && (
          <Typography variant="subtitle2" fontWeight={700} noWrap>
            CBE Enterprise Dashboard
          </Typography>
        )}
      </Box>

      <List sx={{ pt: 1 }}>{mainNavItems.map((item) => renderNavItem(item))}</List>
      <Divider />
      <List>{adminNavItems.map((item) => renderNavItem(item))}</List>
    </Drawer>
  );
}
