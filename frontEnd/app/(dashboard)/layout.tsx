'use client';

import dynamic from 'next/dynamic';
import * as React from 'react';
import Typography from '@mui/material/Typography';

// 动态加载 DashboardLayout，禁用 SSR
const DashboardLayout = dynamic(
  () => import('@toolpad/core/DashboardLayout').then((mod) => mod.DashboardLayout),
  { ssr: false }
);

export default function Layout(props: { children: React.ReactNode }) {
  return (
    <DashboardLayout sx={{ display: 'flex', justifyContent: 'flex-start' }}>
      <Typography variant="h6" gutterBottom>
        {props.children}
      </Typography>
    </DashboardLayout>
  );
}
