import { workspace, ConfigurationTarget } from 'vscode';

export async function syncSemanticTokenColors(): Promise<void> {
  const config = workspace.getConfiguration();
  const pearlsConfig = workspace.getConfiguration('pearls');
  
  const macroColor = pearlsConfig.get<string>('semanticTokenColors.macro');
  const functionColor = pearlsConfig.get<string>('semanticTokenColors.function');
  const variableColor = pearlsConfig.get<string>('semanticTokenColors.variable');

  const customizations = config.get<Record<string, unknown>>('editor.semanticTokenColorCustomizations') || {};
  
  const newCustomizations = { ...customizations };
  const langRules = { ...((newCustomizations['[6502]'] as Record<string, unknown>) || {}) };
  const rules = { ...((langRules.rules as Record<string, string>) || {}) };  
  let changed = false;
  
  const updateRule = (key: string, value: string | undefined) => {
    if (value && rules[key] !== value) {
      rules[key] = value;
      changed = true;
    } else if (!value && rules[key] !== undefined) {
      delete rules[key];
      changed = true;
    }
  };

  updateRule('macro', macroColor);
  updateRule('function', functionColor);
  updateRule('variable', variableColor);
  
  if (changed) {
    if (Object.keys(rules).length > 0) {
      langRules.rules = rules;
      newCustomizations['[6502]'] = langRules;
    } else {
      delete langRules.rules;
      if (Object.keys(langRules).length === 0) {
        delete newCustomizations['[6502]'];
      } else {
        newCustomizations['[6502]'] = langRules;
      }
    }
    
    // Clean up empty customizations
    if (Object.keys(newCustomizations).length === 0) {
      await config.update('editor.semanticTokenColorCustomizations', undefined, ConfigurationTarget.Global);
    } else {
      await config.update('editor.semanticTokenColorCustomizations', newCustomizations, ConfigurationTarget.Global);
    }
  }
}
