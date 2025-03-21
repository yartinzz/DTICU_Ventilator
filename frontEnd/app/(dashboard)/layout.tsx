import * as React from 'react';
import { DashboardLayout } from '@toolpad/core/DashboardLayout';
import { PageContainer } from '@toolpad/core/PageContainer';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';

export default function Layout(props: { children: React.ReactNode }) {
  return (
    <DashboardLayout sx={{display: 'flex',justifyContent: 'flex-start',}}>
      <Typography variant="h6" gutterBottom>
          {props.children}
      </Typography>
    </DashboardLayout>
  );
}
