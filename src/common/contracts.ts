
export interface JupyterSettings {
    appendResults: boolean;
    languages: JupyterLanguageSetting[];
}

export interface JupyterLanguageSetting {
    languageId: string;
    defaultKernel?: string;
    startupCode?: string[];
}