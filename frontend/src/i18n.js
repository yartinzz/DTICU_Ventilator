import i18n from 'i18next';
import { initReactI18next } from '@/node_modules/react-i18next';
import Backend from 'i18next-http-backend';

i18n
  .use(Backend) // 使用 i18next-http-backend 插件
  .use(initReactI18next)
  .init({
    fallbackLng: 'zh', // 默认语言
    supportedLngs: ['zh', 'en'],
    backend: {
      loadPath: '/locales/{{lng}}/common.json', // 访问路径
    },
    interpolation: {
      escapeValue: false, // React 已经处理过 XSS，所以不用转义
    },
  });

export default i18n;
