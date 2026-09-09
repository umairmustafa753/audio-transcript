/**
 * Shared between the persistence layer and the pre-paint theme script, which
 * reads the saved settings before any module has loaded. Kept dependency-free
 * so the inline script can import it from a server component.
 */
export const SETTINGS_STORAGE_KEY = "audio-transcription:settings:v1";
