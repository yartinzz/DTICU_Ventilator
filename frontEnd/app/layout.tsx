"use client"

import * as React from 'react';
import { NextAppProvider } from '@toolpad/core/nextjs';
import { AppRouterCacheProvider } from '@mui/material-nextjs/v15-appRouter';
import DashboardIcon from '@mui/icons-material/Dashboard';
import LinearProgress from '@mui/material/LinearProgress'
import type { Navigation } from '@toolpad/core/AppProvider';
import { usePathname } from 'next/navigation';

import theme from '../theme';
import { MonitorHeartTwoTone, BloodtypeTwoTone, EngineeringTwoTone, HealingTwoTone, TroubleshootTwoTone, BarChartTwoTone, TopicTwoTone } from '@mui/icons-material';

const NAVIGATION: Navigation = [
  {
    kind: 'header',
    title: 'Main items',
  },
  {
    segment: '',
    title: '患者档案信息管理',
    icon: <TopicTwoTone />,
  },
  {
    segment: 'ventilator',
    title: '机械通气DT模块',
    icon: <DashboardIcon />,
    children: [
      {
        segment: 'peep',
        title: 'PEEP选择与管理',
        icon: <BarChartTwoTone />,
      },
      {
        segment: 'asynchrony',
        title: '人机不同步监测（ASYN）',
        icon: <EngineeringTwoTone />,
      },
      {
        segment: 'autobreath',
        title: '自主呼吸评估',
        icon: <TroubleshootTwoTone />,
      },
    ]
  },
  {
    segment: 'glycemia',
    title: '血糖管理DT模块（STAR）',
    icon: <BloodtypeTwoTone />,
  },
  {
    segment: 'ECG',
    title: '血液动力学DT模块',
    icon: <MonitorHeartTwoTone />,
  },
  {
    segment: 'deepseek',
    title: 'AI辅助模块',
    icon: <HealingTwoTone />,
  },
];

const BRANDING = {
  title: 'DTICU APP',
};



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

