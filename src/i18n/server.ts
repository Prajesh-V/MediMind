import { cookies } from 'next/headers';
import en from './locales/en.json';
import hi from './locales/hi.json';
import kn from './locales/kn.json';
import ta from './locales/ta.json';
import te from './locales/te.json';
import ml from './locales/ml.json';

const locales: Record<string, Record<string, string>> = { en, hi, kn, ta, te, ml };

export async function getServerTranslation() {
  const cookieStore = await cookies();
  const locale = cookieStore.get('mm_locale')?.value || 'en';
  const dict = locales[locale] || locales.en;

  const t = (key: string) => {
    return dict[key] || locales.en[key] || key;
  };

  return { t, locale };
}
