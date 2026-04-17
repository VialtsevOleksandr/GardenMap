/**
 * Seed script — додає каталог рослин у Firestore.
 *
 * Запуск:
 *   node scripts/seedCatalog.mjs
 *
 * ⚠️  Firebase Console: переконайся що правила Firestore дозволяють запис
 *     або тимчасово встанови rules: allow read, write: if true;
 *     Після запуску поверни нормальні правила!
 */

import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { initializeApp } from 'firebase/app';
import {
  getFirestore, collection, getDocs, query,
  where, writeBatch, doc,
} from 'firebase/firestore';

// ── Читаємо .env ──────────────────────────────────────────────────────────────
const __dir = dirname(fileURLToPath(import.meta.url));
const envPath = resolve(__dir, '../.env');
const env = {};
for (const line of readFileSync(envPath, 'utf8').split('\n')) {
  const [k, ...v] = line.split('=');
  if (k && v.length) env[k.trim()] = v.join('=').trim();
}

const firebaseConfig = {
  apiKey:            env.EXPO_PUBLIC_FIREBASE_API_KEY,
  authDomain:        env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId:         env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket:     env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId:             env.EXPO_PUBLIC_FIREBASE_APP_ID,
};

// ── Каталог рослин ─────────────────────────────────────────────────────────────
const COMMUNITY_UID = 'community';

const catalog = [
  // Томати
  { name: 'Томат', variety: 'Волове серце',   icon: '🍅', harvestDays: 115 },
  { name: 'Томат', variety: 'Білий налив',    icon: '🍅', harvestDays: 100 },
  { name: 'Томат', variety: 'Черрі',          icon: '🍅', harvestDays:  90 },

  // Огірки
  { name: 'Огірок', variety: 'Ніжинський',   icon: '🥒', harvestDays:  50 },
  { name: 'Огірок', variety: 'Джерело',      icon: '🥒', harvestDays:  45 },

  // Морква
  { name: 'Морква', variety: 'Шантане',      icon: '🥕', harvestDays: 100 },
  { name: 'Морква', variety: 'Нантська',     icon: '🥕', harvestDays:  90 },

  // Цибуля
  { name: 'Цибуля', variety: 'Штутгартер',  icon: '🧅', harvestDays:  90 },
  { name: 'Цибуля', variety: 'Бессонівська', icon: '🧅', harvestDays:  80 },

  // Часник
  { name: 'Часник', variety: 'Любаша',       icon: '🧄', harvestDays: 100 },

  // Капуста
  { name: 'Капуста', variety: 'Білосніжка', icon: '🥬', harvestDays: 140 },
  { name: 'Капуста', variety: 'Слава',      icon: '🥬', harvestDays: 120 },

  // Картопля
  { name: 'Картопля', variety: 'Слов\'янка', icon: '🥔', harvestDays: 120 },
  { name: 'Картопля', variety: 'Беллароза',  icon: '🥔', harvestDays:  65 },
  { name: 'Картопля', variety: 'Рів\'єра',   icon: '🥔', harvestDays:  55 },

  // Перець
  { name: 'Перець', variety: 'Білозерка',    icon: '🫑', harvestDays: 110 },
  { name: 'Перець', variety: 'Ратунда',      icon: '🫑', harvestDays: 115 },

  // Баклажан
  { name: 'Баклажан', variety: 'Чорний красень', icon: '🍆', harvestDays: 120 },
  { name: 'Баклажан', variety: 'Алмаз',          icon: '🍆', harvestDays: 110 },

  // Кабачок (🫛 — найближчий за формою зелений овоч)
  { name: 'Кабачок', variety: 'Чаклун',  icon: '🫛', harvestDays: 45 },
  { name: 'Кабачок', variety: 'Цукеша',  icon: '🫛', harvestDays: 40 },

  // Гарбуз
  { name: 'Гарбуз', variety: 'Зимовий гігант', icon: '🎃', harvestDays: 130 },
  { name: 'Гарбуз', variety: 'Мигдалевий',     icon: '🎃', harvestDays: 120 },

  // Буряк
  { name: 'Буряк', variety: 'Бордо',           icon: '🍠', harvestDays: 110 },

  // Горох
  { name: 'Горох', variety: 'Телефон',          icon: '🫛', harvestDays:  70 },
  { name: 'Горох', variety: 'Ранній 301',       icon: '🫛', harvestDays:  55 },

  // Квасоля
  { name: 'Квасоля', variety: 'Галактика',      icon: '🫘', harvestDays:  65 },
  { name: 'Квасоля', variety: 'Пантера',        icon: '🫘', harvestDays:  60 },

  // Кукурудза
  { name: 'Кукурудза', variety: 'Цукрова Перлина', icon: '🌽', harvestDays: 75 },
  { name: 'Кукурудза', variety: 'Добриня',          icon: '🌽', harvestDays: 80 },

  // Редиска (немає емодзі — 🌸 як рожево-круглий овоч)
  { name: 'Редиска', variety: 'Французький сніданок', icon: '🌸', harvestDays: 22 },
  { name: 'Редиска', variety: 'Червоний велетень',    icon: '🌸', harvestDays: 28 },

  // Петрушка
  { name: 'Петрушка', variety: 'Бордовікська', icon: '🌿', harvestDays: 75 },
  { name: 'Петрушка', variety: 'Кучерява',     icon: '🌿', harvestDays: 70 },

  // Кріп
  { name: 'Кріп', variety: 'Грибовський',       icon: '🌱', harvestDays: 40 },
  { name: 'Кріп', variety: 'Аврора',            icon: '🌱', harvestDays: 35 },

  // Салат
  { name: 'Салат', variety: 'Айсберг',          icon: '🥗', harvestDays: 55 },
  { name: 'Салат', variety: 'Лолло Росса',      icon: '🥗', harvestDays: 45 },

  // Полуниця
  { name: 'Полуниця', variety: 'Вікторія',      icon: '🍓', harvestDays: 60 },
];

// ── Основна логіка ─────────────────────────────────────────────────────────────
async function seed() {
  const app = initializeApp(firebaseConfig);
  const db  = getFirestore(app);

  // Видаляємо старі каталогові записи (userId === 'community')
  console.log('🗑  Видаляю старий каталог...');
  const existing = await getDocs(
    query(collection(db, 'plants'), where('userId', '==', COMMUNITY_UID))
  );
  if (existing.size > 0) {
    const delBatch = writeBatch(db);
    existing.docs.forEach(d => delBatch.delete(d.ref));
    await delBatch.commit();
    console.log(`   Видалено ${existing.size} старих записів`);
  }

  // Додаємо новий каталог пачками по 500 (ліміт Firestore writeBatch)
  console.log(`\n🌱 Додаю ${catalog.length} рослин у каталог...`);
  const BATCH_SIZE = 499;
  for (let i = 0; i < catalog.length; i += BATCH_SIZE) {
    const batch = writeBatch(db);
    catalog.slice(i, i + BATCH_SIZE).forEach(plant => {
      const ref = doc(collection(db, 'plants'));
      batch.set(ref, {
        ...plant,
        userId:    COMMUNITY_UID,
        notes:     '',
        photoUri:  null,
        createdAt: new Date(),
      });
    });
    await batch.commit();
  }

  console.log('✅ Готово! Каталог успішно завантажено.');
  process.exit(0);
}

seed().catch(e => { console.error('❌ Помилка:', e.message); process.exit(1); });
