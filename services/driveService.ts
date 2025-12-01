// Simple wrapper for Google Drive API interactions
// Note: Requires @types/gapi and @types/google.accounts or define globally
declare var gapi: any;
declare var google: any;

const SCOPES = 'https://www.googleapis.com/auth/drive.file';
const DISCOVERY_DOCS = ['https://www.googleapis.com/discovery/v1/apis/drive/v3/rest'];
const BACKUP_FILENAME = 'grid-finance-backup.json';

export interface DriveState {
  isAuthenticated: boolean;
  isAutoBackup: boolean;
  lastBackupTime: number | null;
  clientId: string;
}

let tokenClient: any;
let gapiInited = false;
let gisInited = false;

export const initGapi = async () => {
  return new Promise<void>((resolve, reject) => {
    if (typeof gapi === 'undefined') {
      reject('Google API script not loaded');
      return;
    }
    gapi.load('client', async () => {
      try {
        await gapi.client.init({
          discoveryDocs: DISCOVERY_DOCS,
        });
        gapiInited = true;
        resolve();
      } catch (err) {
        reject(err);
      }
    });
  });
};

export const initGis = (clientId: string, onTokenCallback: (resp: any) => void) => {
    if (typeof google === 'undefined') return;
    
    tokenClient = google.accounts.oauth2.initTokenClient({
      client_id: clientId,
      scope: SCOPES,
      callback: (resp: any) => {
        if (resp.error !== undefined) {
          throw (resp);
        }
        onTokenCallback(resp);
      },
    });
    gisInited = true;
};

export const requestAccessToken = () => {
  if (!tokenClient) return;
  tokenClient.requestAccessToken({ prompt: '' });
};

// Find existing backup file
const findBackupFile = async () => {
  if (!gapiInited) return null;
  const response = await gapi.client.drive.files.list({
    q: `name = '${BACKUP_FILENAME}' and trashed = false`,
    fields: 'files(id, name, modifiedTime)',
    spaces: 'drive',
  });
  const files = response.result.files;
  if (files && files.length > 0) {
    return files[0];
  }
  return null;
};

// Upload JSON data to Drive
export const uploadToDrive = async (data: any): Promise<Date> => {
  const fileContent = JSON.stringify(data, null, 2);
  const file = new Blob([fileContent], { type: 'application/json' });
  const metadata = {
    name: BACKUP_FILENAME,
    mimeType: 'application/json',
  };

  const existingFile = await findBackupFile();

  const accessToken = gapi.client.getToken().access_token;
  const form = new FormData();
  form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
  form.append('file', file);

  let url = 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart';
  let method = 'POST';

  if (existingFile) {
    url = `https://www.googleapis.com/upload/drive/v3/files/${existingFile.id}?uploadType=multipart`;
    method = 'PATCH';
  }

  const response = await fetch(url, {
    method: method,
    headers: new Headers({ 'Authorization': 'Bearer ' + accessToken }),
    body: form,
  });

  if (!response.ok) {
      throw new Error("Upload failed");
  }
  
  return new Date();
};

// Download JSON data from Drive
export const downloadFromDrive = async (): Promise<any> => {
  const existingFile = await findBackupFile();
  if (!existingFile) {
    throw new Error("No backup file found in Google Drive.");
  }

  const response = await gapi.client.drive.files.get({
    fileId: existingFile.id,
    alt: 'media',
  });

  return response.result;
};
