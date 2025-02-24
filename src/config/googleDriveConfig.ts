import { google } from "googleapis";
import { Readable } from "stream";

const auth = new google.auth.GoogleAuth({
  keyFile: "./credentials.json",
  scopes: ["https://www.googleapis.com/auth/drive"],
});
const drive = google.drive({ version: "v3", auth });

export const uploadToDrive = async (
  file: Express.Multer.File
): Promise<string> => {
  const fileMetadata = {
    name: `${Date.now().toString()}-${file.originalname}`,
    parents: ["1hea-xmkKiGSEypls6YAq-y32HAV_eGob"],
  };
  const media = {
    mimeType: file.mimetype,
    body: Readable.from(file.buffer),
  };
  const response = await drive.files.create({
    requestBody: fileMetadata,
    media,
  });
  return `https://drive.google.com/uc?id=${response.data.id}`;
};

export const deleteFromDrive = async (fileId: string) => {
  await drive.files.delete({ fileId });
};
