import 'fake-indexeddb/auto';
import '@testing-library/jest-dom/vitest';

// Системный пояс теста намеренно отличается от пояса приложения (Asia/Bishkek).
process.env.TZ = 'America/New_York';
