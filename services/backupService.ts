import { Filesystem, Directory, Encoding } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import { BackupData } from '../types';

const BACKUP_FOLDER = 'GridFinance';
const BACKUP_FILENAME = 'backup.json';

// Ensure the folder exists
const ensureFolder = async () => {
  try {
    await Filesystem.mkdir({
      path: BACKUP_FOLDER,
      directory: Directory.Documents,
      recursive: true
    });
  } catch (e) {
    // Folder likely exists or permission error
    console.log('Folder creation check:', e);
  }
};

export const saveToDevice = async (data: BackupData): Promise<string> => {
  await ensureFolder();
  const fileContent = JSON.stringify(data, null, 2);
  const path = `${BACKUP_FOLDER}/${BACKUP_FILENAME}`;

  try {
    await Filesystem.writeFile({
      path: path,
      data: fileContent,
      directory: Directory.Documents,
      encoding: Encoding.UTF8
    });
    return `Saved to Documents/${path}`;
  } catch (e) {
    console.error('Save failed', e);
    throw new Error('Could not write to device storage.');
  }
};

export const loadFromDevice = async (): Promise<BackupData> => {
  const path = `${BACKUP_FOLDER}/${BACKUP_FILENAME}`;
  try {
    const contents = await Filesystem.readFile({
      path: path,
      directory: Directory.Documents,
      encoding: Encoding.UTF8
    });
    return JSON.parse(contents.data as string);
  } catch (e) {
    throw new Error('No backup file found in Documents/GridFinance.');
  }
};

export const shareBackup = async (data: BackupData) => {
  const fileName = `GridFinance_Export_${new Date().toISOString().split('T')[0]}.json`;
  
  // Write a temp file to cache to share it
  try {
    await Filesystem.writeFile({
      path: fileName,
      data: JSON.stringify(data, null, 2),
      directory: Directory.Cache, // Share from cache is safer/easier
      encoding: Encoding.UTF8
    });

    const uriResult = await Filesystem.getUri({
        directory: Directory.Cache,
        path: fileName
    });

    await Share.share({
      title: 'GridFinance Backup',
      text: 'Here is my financial data backup.',
      url: uriResult.uri,
      dialogTitle: 'Save Backup To...'
    });
  } catch (e) {
    console.error('Share failed', e);
    throw new Error('Sharing not supported on this device or permission denied.');
  }
};