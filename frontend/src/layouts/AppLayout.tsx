/**
 * Main application layout: fixed Header + collapsible Sidebar + scrollable content area.
 * All authenticated pages render inside this layout via <Outlet />.
 */
import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { Box, Toolbar } from '@mui/material';
import { Header } from '@components/common/Header';
import { Sidebar } from '@components/common/Sidebar';

const DRAWER_WIDTH = 240;
const DRAWER_COLLAPSED_WIDTH = 64;

export function AppLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(true);

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh' }}>
      <Header
        onMenuToggle={() => setSidebarOpen((prev) => !prev)}
        sidebarOpen={sidebarOpen}
      />
      <Sidebar open={sidebarOpen} />

      {/* Main content */}
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          p: 3,
          width: {
            sm: `calc(100% - ${sidebarOpen ? DRAWER_WIDTH : DRAWER_COLLAPSED_WIDTH}px)`,
          },
          transition: 'margin 0.2s',
          bgcolor: 'grey.50',
          minHeight: '100vh',
        }}
      >
        {/* Offset for fixed AppBar */}
        <Toolbar />
        <Outlet />
      </Box>
    </Box>
  );
}
