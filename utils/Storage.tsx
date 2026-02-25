/**
 * Storage.ts
 */
import RNFS from 'react-native-fs';
import { PluginManager } from 'sn-plugin-lib';
import { log } from './ConsoleLog';

const CONFIG_FILE = 'settings.json';

// Helper to get the correct path string by awaiting the Promise
export const getDirPath = async () => {
  try {
    // Since documentation says it's a Promise<string>, we MUST await it
    const path = await PluginManager.getPluginDirPath();

    if (!path) {
      log("../Storage", "Plugin directory path is null or undefined");
      return null;
    }

    // Ensure we return a string even if the bridge returns a complex object
    const finalPath = typeof (path as any) === 'object' ? (path as any).path || (path as any).toString() : path;
    return finalPath;
  } catch (e) {
    log("../Storage", "Error getting plugin directory path" + e);
    return null;
  }
};

export const saveSettings = async (settings: object) => {
  try {
    log("../Storage", "Saving settings" + JSON.stringify(settings));
    const dirPath = await getDirPath();
    if (!dirPath) return;

    const filePath = `${dirPath}/${CONFIG_FILE}`;

    // Ensure the directory exists
    const dirExists = await RNFS.exists(dirPath);
    if (!dirExists) {
      await RNFS.mkdir(dirPath);
    }

    await RNFS.writeFile(filePath, JSON.stringify(settings), 'utf8');
    log("../Storage", "Settings saved");
  } catch (error) {
    log("../Storage", "Save failed" + error);
  }
};

export const loadSettings = async () => {
  try {
    const dirPath = await getDirPath();
    if (!dirPath) return null;

    const filePath = `${dirPath}/${CONFIG_FILE}`;

    const fileExists = await RNFS.exists(filePath);
    if (fileExists) {
      const content = await RNFS.readFile(filePath, 'utf8');
      return JSON.parse(content);
    }
  } catch (error) {
    console.error('[../Storage]: Load failed', error);
  }
  return null;
};


export const saveStringToLocalFile = async (object: string, filename: string) => {
  try {
    const dirPath = await getDirPath();
    if (!dirPath) return;

    const filePath = `${dirPath}/${filename}`;

    // Ensure the directory exists
    const dirExists = await RNFS.exists(dirPath);
    if (!dirExists) {
      await RNFS.mkdir(dirPath);
    }

    await saveStringTo(object, filePath)

  } catch (error) {
    console.error('[../Storage]: Save failed', error);
  }
};

export const saveStringTo = async (object: string, filename: string) => {
  try {
    await RNFS.writeFile(filename, object, 'utf8');
    console.log('[../Storage]: Saved');
  } catch (error) {
    console.error('[../Storage]: Save failed', error);
  }
};