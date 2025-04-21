"use client";

import * as React from 'react';
import { NextAppProvider } from '@toolpad/core/nextjs';
import { AppRouterCacheProvider } from '@mui/material-nextjs/v15-appRouter';
import DashboardIcon from '@mui/icons-material/Dashboard';
import LinearProgress from '@mui/material/LinearProgress';
import { usePathname } from 'next/navigation';
import { useTranslation } from 'react-i18next'; // 导入 i18n hook
import theme from '../theme';
import { MonitorHeartTwoTone, BloodtypeTwoTone, EngineeringTwoTone, HealingTwoTone, TroubleshootTwoTone, BarChartTwoTone, TopicTwoTone } from '@mui/icons-material';
import i18n from '../src/i18n'; // 引入 i18n 配置
import { Select, MenuItem, FormControl, InputLabel } from '@mui/material'; // 导入 MUI 组件

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
  const { t } = useTranslation(); // 使用翻译

  const handleLanguageChange = (language: string) => {
    i18n.changeLanguage(language); // 切换语言
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
                title: t(item.title), // 翻译导航项
                children: item.children ? item.children.map(child => ({
                  ...child,
                  title: t(child.title), // 翻译子项
                })) : undefined,
              }))}
              branding={{ title: t(BRANDING.title) }} // 翻译品牌名
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
                      height: 40, // 设置控件的高度
                      fontSize: '0.875rem', // 调整字体大小
                      padding: '6px 10px', // 调整内边距以减少控件占用的空间
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
