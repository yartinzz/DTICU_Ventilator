import * as React from 'react';
import { DashboardLayout } from '@toolpad/core/DashboardLayout';
import { NextAppProvider } from '@toolpad/core/nextjs';
import { AppRouterCacheProvider } from '@mui/material-nextjs/v15-appRouter';
import theme from '../../theme';
import DashboardIcon from '@mui/icons-material/Dashboard';

const NEW_PAGE_NAVIGATION = [
  {
    kind: 'header',
    title: 'Main items',
  },
  {
    segment: 'Ventsensor',
    title: 'Pressure Sensor Page',
    icon: <DashboardIcon />,
  },
  {
    segment: 'PDsensor',
    title: 'Pleth Page',
    icon: <DashboardIcon />,
  },
  {
    segment: 'MePAPsensor',
    title: 'MePAP Page',
    icon: <DashboardIcon />,
  },
];

const NEW_PAGE_BRANDING = {
  title: 'DTICU App',
};

export default function EllaPageLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" data-toolpad-color-scheme="light" suppressHydrationWarning>
      <body>
        <AppRouterCacheProvider options={{ enableCssLayer: true }}>
          <NextAppProvider navigation={NEW_PAGE_NAVIGATION} branding={NEW_PAGE_BRANDING} theme={theme}>
            <DashboardLayout sx={{ display: 'flex', justifyContent: 'flex-start' }}>
              {children}
            </DashboardLayout>
          </NextAppProvider>
        </AppRouterCacheProvider>
      </body>
    </html>
  );
}
