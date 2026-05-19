
export interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
}

export const DriveService = {
  async listFiles(accessToken: string): Promise<DriveFile[]> {
    const response = await fetch(
      'https://www.googleapis.com/drive/v3/files?q=mimeType%3D%27application%2Fvnd.google-apps.spreadsheet%27+or+mimeType%3D%27text%2Fcsv%27&fields=files(id,name,mimeType)',
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`Drive API Error: ${error.error?.message || response.statusText}`);
    }

    const data = await response.json();
    return data.files || [];
  },

  async getFileContent(accessToken: string, fileId: string): Promise<string> {
    const response = await fetch(
      `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`Drive API Error: ${error.error?.message || response.statusText}`);
    }

    return await response.text();
  },

  async getSheetData(accessToken: string, spreadsheetId: string, range: string = 'Sheet1!A:Z') {
    const response = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${range}`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`Sheets API Error: ${error.error?.message || response.statusText}`);
    }

    return await response.json();
  }
};
