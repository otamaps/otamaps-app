import { sha256 } from "js-sha256";

export const generateCode = (email: string): string => {
  const hash = sha256(email);
  const intHash = parseInt(hash.slice(0, 12), 16);
  const code = (intHash % 1_000_000).toString().padStart(6, "0");
  return code;
};
