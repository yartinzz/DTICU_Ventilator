import * as React from 'react';
import { DashboardLayout } from '@toolpad/core/DashboardLayout';
import { NextAppProvider } from '@toolpad/core/nextjs';
import { AppRouterCacheProvider } from '@mui/material-nextjs/v15-appRouter';
import theme from '../../theme'; // 确保引入了正确的主题

const NEW_PAGE_NAVIGATION = [
  {
    kind: 'header',
    title: 'Main items',
  },
  {
    segment: 'ellapage',
    title: 'Ella Page',
  },
];

const NEW_PAGE_BRANDING = {
  title: 'Ella App',
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
