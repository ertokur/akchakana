import { LANGUAGE_NAMES, LANGUAGES, systemLanguage, useT, type LanguageSetting } from '../../i18n';
import { useData } from '../../stores/dataStore';
import { Field, Select } from '../../ui/controls';

/** Выбор языка интерфейса: как в системе, English или Русский. Применяется сразу. */
export function LanguageField() {
  const t = useT();
  const language = useData((s) => s.settings.language);
  const updateSettings = useData((s) => s.updateSettings);
  return (
    <Field label={t('settings.language')}>
      {(id) => (
        <Select
          id={id}
          value={language}
          onChange={(e) => void updateSettings({ language: e.target.value as LanguageSetting })}
        >
          <option value="system">
            {t('settings.languageSystem', { name: LANGUAGE_NAMES[systemLanguage()] })}
          </option>
          {LANGUAGES.map((l) => (
            <option key={l} value={l} lang={l}>
              {LANGUAGE_NAMES[l]}
            </option>
          ))}
        </Select>
      )}
    </Field>
  );
}
