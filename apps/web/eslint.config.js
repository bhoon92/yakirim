import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      globals: globals.browser,
    },
    rules: {
      // 한글(IME) 조합 중 Enter 는 keydown 이 두 번 온다 — 그대로 저장으로 받으면 요청이 두 번 나간다 (9985055).
      // 새 입력칸이 이 함정을 다시 밟지 않게, Enter 비교는 lib/keyboard.ts 의 isSubmitEnter 로만 한다.
      'no-restricted-syntax': [
        'error',
        {
          selector: "BinaryExpression[left.property.name='key'][right.value='Enter'], BinaryExpression[right.property.name='key'][left.value='Enter']",
          message: "Enter 는 isSubmitEnter(event) 로 확인하세요 (@/lib/keyboard) — 한글 조합 중 Enter 를 걸러야 요청이 두 번 나가지 않습니다.",
        },
      ],
    },
  },
  {
    // keyboard.ts 는 isSubmitEnter 자체, 이모지 목록은 조합 중 Enter 를 직접 걸러서(isComposing) 고른다
    files: ['src/lib/keyboard.ts', 'src/lib/autocomplete/use-trigger-autocomplete.tsx'],
    rules: { 'no-restricted-syntax': 'off' },
  },
])
