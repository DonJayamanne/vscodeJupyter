import { LanguageProviders } from '../common/languageProvider';
import { JavascriptLanguageProvider } from './javascriptLanguageProvider';
import { PythonLanguageProvider } from './pythonLanguageProvider';

export function registerDefaults() {
    LanguageProviders.registerLanguageProvider('javascript', new JavascriptLanguageProvider())
    LanguageProviders.registerLanguageProvider('python', new PythonLanguageProvider())
}