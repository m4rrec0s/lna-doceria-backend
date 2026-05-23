import { google } from "googleapis";
import { Readable } from "stream";

const normalizePrivateKey = (key?: string) => {
  if (!key) return key;
  if (key.includes("\n")) {
    return key.replace(/\\n/g, "\n");
  }
  const header = "-----BEGIN PRIVATE KEY-----";
  const footer = "-----END PRIVATE KEY-----";
  if (key.includes(header) && key.includes(footer)) {
    const body = key
      .replace(header, "")
      .replace(footer, "")
      .trim()
      .replace(/\\n/g, "\n")
      .replace(/\s+/g, "\n");
    return `${header}\n${body}\n${footer}\n`;
  }
  return key;
};

const credentials = {
  type: process.env.GOOGLE_TYPE || "service_account",
  project_id: process.env.GOOGLE_PROJECT_ID,
  private_key_id: process.env.GOOGLE_PRIVATE_KEY_ID,
  private_key: normalizePrivateKey(process.env.GOOGLE_PRIVATE_KEY),
  client_email: process.env.GOOGLE_CLIENT_EMAIL,
  client_id: process.env.GOOGLE_CLIENT_ID,
  auth_uri: process.env.GOOGLE_AUTH_URI,
  token_uri: process.env.GOOGLE_TOKEN_URI || process.env.TOKEN_URI,
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
  file: Express.Multer.File,
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
