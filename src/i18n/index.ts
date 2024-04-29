import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import HttpBackend from 'i18next-http-backend';
import LanguageDetector from 'i18next-browser-languagedetector';

i18n
  .use(HttpBackend) // 使用 HttpBackend 加载翻译资源
  .use(LanguageDetector) // 自动检测语言
  .use(initReactI18next) // 绑定react-i18next
  .init({
    fallbackLng: 'en', // 默认语言
    debug: true,
    ns: ['common', 'header', 'footer'], // 定义你使用的所有命名空间
    defaultNS: 'common', // 设置默认命名空间
    interpolation: {
      escapeValue: false, // 不需要对结果做xss清理
    },
    react: {
      useSuspense: false,
    },
    backend: {
      loadPath: '/locales/{{lng}}/{{ns}}.json' // 加载本地语言文件的路径
    },
  });

export default i18n;
