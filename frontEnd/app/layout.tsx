"use client";

import * as React from 'react';
import { NextAppProvider } from '@toolpad/core/nextjs';
import { AppRouterCacheProvider } from '@mui/material-nextjs/v15-appRouter';
import DashboardIcon from '@mui/icons-material/Dashboard';
import LinearProgress from '@mui/material/LinearProgress';
import { usePathname } from 'next/navigation';
import { useTranslation } from 'react-i18next'; 
import theme from '../theme';
import { MonitorHeartTwoTone, BloodtypeTwoTone, EngineeringTwoTone, HealingTwoTone, TroubleshootTwoTone, BarChartTwoTone, TopicTwoTone } from '@mui/icons-material';
import i18n from '../src/i18n';
import { Select, MenuItem, FormControl, InputLabel } from '@mui/material'; 

const NAVIGATION = [
  {
    kind: 'header',
    title: 'Main',
  },
  {
    segment: '',
    title: 'Patient Records',
    icon: <TopicTwoTone />,
  },
  {
    segment: 'ventilator',
    title: 'Ventilation Module',
    icon: <DashboardIcon />,
    children: [
      {
        segment: 'peep',
        title: 'PEEP Management',
        icon: <BarChartTwoTone />,
      },
      {
        segment: 'asynchrony',
        title: 'Asynchrony Monitor',
        icon: <EngineeringTwoTone />,
      },
      {
        segment: 'ventmode',
        title: 'Breath Mode Assessment',
        icon: <TroubleshootTwoTone />,
      },
    ]
  },
  {
    segment: 'glycemia',
    title: 'Glycemia Module',
    icon: <BloodtypeTwoTone />,
  },
  // {
  //   segment: 'ECG',
  //   title: 'Hemodynamics Module',
  //   icon: <MonitorHeartTwoTone />,
  // },
  {
    segment: 'deepseek',
    title: 'AI Assistant',
    icon: <HealingTwoTone />,
  },
];

const BRANDING = {
  title: 'DTICU APP',
};

export default function RootLayout(props: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { t } = useTranslation(); 

  const handleLanguageChange = (language: string) => {
    i18n.changeLanguage(language); 
  };

  if (pathname.startsWith('/sensorpage')) {
    return <>{props.children}</>;
  }

  return (
    <html lang={i18n.language} data-toolpad-color-scheme="light" suppressHydrationWarning>
      <body>
        <AppRouterCacheProvider options={{ enableCssLayer: true }}>
          <React.Suspense fallback={<LinearProgress />}>
            <NextAppProvider
              navigation={NAVIGATION.map(item => ({
                ...item,
                title: t(item.title), 
                children: item.children ? item.children.map(child => ({
                  ...child,
                  title: t(child.title), 
                })) : undefined,
              }))}
              branding={{ title: t(BRANDING.title) }} 
              theme={theme}
            >
              <div style={{ position: 'absolute', top: 16, right: 60, zIndex: 9999}}>
                <FormControl sx={{ width: 120, height:  '100%'  }}>
                  <InputLabel id="language-select-label">{t('Language')}</InputLabel>
                  <Select
                    labelId="language-select-label"
                    value={i18n.language}
                    onChange={(e) => handleLanguageChange(e.target.value)}
                    label={t('Language')}
                    sx={{
                      height: 40, 
                      fontSize: '0.875rem',
                      padding: '6px 10px', 
                    }}
                  >
                    <MenuItem value="en">{t('EN')}</MenuItem>
                    <MenuItem value="zh">{t('中文')}</MenuItem>
                  </Select>
                </FormControl>
              </div>
              {props.children}
            </NextAppProvider>
          </React.Suspense>
        </AppRouterCacheProvider>
      </body>
    </html>
  );
}