"use client"

import * as React from 'react';
import { NextAppProvider } from '@toolpad/core/nextjs';
import { AppRouterCacheProvider } from '@mui/material-nextjs/v15-appRouter';
import DashboardIcon from '@mui/icons-material/Dashboard';
import LinearProgress from '@mui/material/LinearProgress'
import type { Navigation } from '@toolpad/core/AppProvider';
import { usePathname } from 'next/navigation';
import { createTheme } from '@mui/material/styles';

import { MonitorHeartTwoTone, BloodtypeTwoTone, EngineeringTwoTone, HealingTwoTone } from '@mui/icons-material';

const NAVIGATION: Navigation = [
  {
    kind: 'header',
    title: 'Main items',
  },
  {
    segment: '',
    title: 'PEEP Selector',
    icon: <DashboardIcon />,
  },
  {
    segment: 'ECG',
    title: 'ECG monitor',
    icon: <DashboardIcon />,
  },
];

const BRANDING = {
  title: 'DTICU APP',
};

const theme = createTheme({
  cssVariables: {
    colorSchemeSelector: 'data-toolpad-color-scheme',
  },
  colorSchemes: { light: true, dark: true },
});

export default function RootLayout(props: { children: React.ReactNode }) {
  
  const pathname = usePathname(); 


  if (pathname.startsWith('/ellapage')) {
    return <>{props.children}</>;
  }

  return (
    <html lang="en" data-toolpad-color-scheme="light" suppressHydrationWarning>
      <body>
        
          <AppRouterCacheProvider options={{ enableCssLayer: true }}>
          <React.Suspense fallback={<LinearProgress />}>
            <NextAppProvider
              navigation={NAVIGATION}
              branding={BRANDING}
              theme={theme}
            >
            {props.children}
            </NextAppProvider>
            </React.Suspense>
          </AppRouterCacheProvider>
        
      </body>
    </html>
  );
}

