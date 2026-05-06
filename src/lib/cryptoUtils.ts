import CryptoJS from 'crypto-js';

const DEFAULT_SECRET = 'gemini-key-rotation-secret-39281';

export const encryptKey = (key: string, secret: string = DEFAULT_SECRET): string => {
  return CryptoJS.AES.encrypt(key, secret).toString();
};

export const decryptKey = (encrypted: string, secret: string = DEFAULT_SECRET): string => {
  const bytes = CryptoJS.AES.decrypt(encrypted, secret);
  return bytes.toString(CryptoJS.enc.Utf8);
};
