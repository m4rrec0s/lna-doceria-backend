import { google } from "googleapis";
import { Readable } from "stream";

const credentials = {
  type: process.env.GOOGLE_TYPE,
  project_id: process.env.GOOGLE_PROJECT_ID,
  private_key_id: process.env.GOOGLE_PRIVATE_KEY_ID,
  private_key: process.env.GOOGLE_PRIVATE_KEY,
  client_email: process.env.GOOGLE_CLIENT_EMAIL,
  client_id: process.env.GOOGLE_CLIENT_ID,
  auth_uri: process.env.GOOGLE_AUTH_URI,
  token_uri: process.env.TOKEN_URI,
  auth_provider_x509_cert_url: process.env.GOOGLE_AUTH_PROVIDER_X509_CERT_URL,
  client_x509_cert_url: process.env.GOOGLE_CLIENT_X509_CERT_URL,
  universe_domain: process.env.GOOGLE_UNIVERSE_DOMAIN,
};

const auth = new google.auth.GoogleAuth({
  credentials,
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
