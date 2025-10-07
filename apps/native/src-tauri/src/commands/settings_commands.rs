use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::sync::Mutex;
use tauri::State;

/// Settings store (in production, use tauri-plugin-store)
pub struct SettingsState {
    settings: Mutex<std::collections::HashMap<String, Value>>,
}

impl SettingsState {
    pub fn new() -> Self {
        Self {
            settings: Mutex::new(std::collections::HashMap::new()),
        }
    }
}

#[derive(Debug, Serialize, Deserialize)]
pub struct Setting {
    pub key: String,
    pub value: Value,
}

/// Get a setting value
/// Maps to: settings:get from Electron
#[tauri::command]
pub async fn get_setting(
    key: String,
    state: State<'_, SettingsState>,
) -> Result<Option<Value>, String> {
    let settings = state.settings.lock().map_err(|e| e.to_string())?;
    Ok(settings.get(&key).cloned())
}

/// Set a setting value
/// Maps to: settings:set from Electron
#[tauri::command]
pub async fn set_setting(
    key: String,
    value: Value,
    state: State<'_, SettingsState>,
) -> Result<(), String> {
    let mut settings = state.settings.lock().map_err(|e| e.to_string())?;
    settings.insert(key, value);
    Ok(())
}

/// Get all settings
/// Maps to: settings:getAll from Electron
#[tauri::command]
pub async fn get_all_settings(
    state: State<'_, SettingsState>,
) -> Result<std::collections::HashMap<String, Value>, String> {
    let settings = state.settings.lock().map_err(|e| e.to_string())?;
    Ok(settings.clone())
}

/// Delete a setting
/// Maps to: settings:delete from Electron
#[tauri::command]
pub async fn delete_setting(key: String, state: State<'_, SettingsState>) -> Result<(), String> {
    let mut settings = state.settings.lock().map_err(|e| e.to_string())?;
    settings.remove(&key);
    Ok(())
}

/// Reset all settings
/// Maps to: settings:reset from Electron
#[tauri::command]
pub async fn reset_settings(state: State<'_, SettingsState>) -> Result<(), String> {
    let mut settings = state.settings.lock().map_err(|e| e.to_string())?;
    settings.clear();
    Ok(())
}
