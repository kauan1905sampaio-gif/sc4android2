import AsyncStorage from '@react-native-async-storage/async-storage';

const RECENT_KEY = 'sc_editor_recent_files';
const MAX_RECENT = 10;

export async function getRecentFiles(): Promise<string[]> {
  try {
    const raw = await AsyncStorage.getItem(RECENT_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export async function addRecentFile(uri: string): Promise<string[]> {
  const current = await getRecentFiles();
  const updated = [uri, ...current.filter(u => u !== uri)].slice(0, MAX_RECENT);
  await AsyncStorage.setItem(RECENT_KEY, JSON.stringify(updated));
  return updated;
}

export async function removeRecentFile(uri: string): Promise<string[]> {
  const current = await getRecentFiles();
  const updated = current.filter(u => u !== uri);
  await AsyncStorage.setItem(RECENT_KEY, JSON.stringify(updated));
  return updated;
}

export async function clearRecentFiles(): Promise<void> {
  await AsyncStorage.removeItem(RECENT_KEY);
}
