import { Range, Position, TextDocument } from 'vscode';

/**
 * Language providers 
 * 
 * @export
 * @interface LanguageProvider
 */
export interface LanguageProvider {
    /**
     * Returns a Regular Expression used to determine whether a line is a Cell delimiter or not
     * 
     * @type {RegExp}
     * @memberOf LanguageProvider
     */
    cellIdentifier: RegExp;

    /**
     * Returns the selected code
     * If not implemented, then the currently active line or selected code is taken.
     * Can be implemented to ensure valid blocks of code are selected.
     * E.g if user selects only the If statement, code can be impelemented to ensure all code within the if statement (block) is returned
     * @param {string} selectedCode The selected code as identified by this extension.
     * @param {Range} [currentCell] Range of the currently active cell
     * @returns {Promise<string>} The code selected. If nothing is to be done, return the parameter value.
     * 
     * @memberOf LanguageProvider
     */
    getSelectedCode(selectedCode: string, currentCell?: Range): Promise<string>;

    /**
     * Gets the first line (position) of executable code within a range 
     * 
     * @param {TextDocument} document
     * @param {number} startLine
     * @param {number} endLine
     * @returns {Promise<Position>}
     * 
     * @memberOf LanguageProvider
     */
    getFirstLineOfExecutableCode(document: TextDocument, range: Range): Promise<Position>;
}

export class LanguageProviders {
    static providers: Map<string, LanguageProvider> = new Map<string, LanguageProvider>();
} 