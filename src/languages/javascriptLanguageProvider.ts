import { LanguageProvider } from '../common/languageProvider'
import { TextDocument, Position, Range } from 'vscode';

export class JavascriptLanguageProvider implements LanguageProvider {
    get cellIdentifier(): RegExp {
        return /^(\/\/ %%|\/\/%%|\/\/ \<codecell\>|\/\/ In\[\d*?\]|\/\/ In\[ \])(.*)/i;
    }

    getSelectedCode(selectedCode: string, currentCell?: Range): Promise<string> {
        return Promise.resolve(selectedCode);
    }
    getFirstLineOfExecutableCode(document: TextDocument, range: Range): Promise<Position> {
        return Promise.resolve(range.start);
    }
}