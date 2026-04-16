import * as Localization from 'expo-localization';
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import uk from './uk.json';
import en from './en.json';

const deviceLang = Localization.getLocales()[0]?.languageCode;

i18n.use(initReactI18next).init({
  resources: {
    uk: { translation: uk },
    en: { translation: en },
  },
  lng: deviceLang?.startsWith('uk') ? 'uk' : 'en',
  fallbackLng: 'uk',
  interpolation: { escapeValue: false },
  initImmediate: false,
});

export default i18n;
