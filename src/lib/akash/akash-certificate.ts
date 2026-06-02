import rs from "jsrsasign";

function dateToStr(date: Date): string {
  const year = date.getUTCFullYear().toString().slice(2).padStart(2, "0");
  const month = (date.getUTCMonth() + 1).toString().padStart(2, "0");
  const day = date.getUTCDate().toString().padStart(2, "0");
  const hours = date.getUTCHours().toString().padStart(2, "0");
  const minutes = date.getUTCMinutes().toString().padStart(2, "0");
  const secs = date.getUTCSeconds().toString().padStart(2, "0");
  return `${year}${month}${day}${hours}${minutes}${secs}Z`;
}

export type AkashCertificatePem = {
  cert: string;
  publicKey: string;
  privateKey: string;
};

export async function generateAkashCertificatePem(address: string): Promise<AkashCertificatePem> {
  const notBefore = new Date();
  const notAfter = new Date();
  notAfter.setFullYear(notBefore.getFullYear() + 1);
  const notBeforeStr = dateToStr(notBefore);
  const notAfterStr = dateToStr(notAfter);

  const { prvKeyObj, pubKeyObj } = rs.KEYUTIL.generateKeypair("EC", "secp256r1");
  const cert = new rs.KJUR.asn1.x509.Certificate({
    version: 3,
    serial: { int: Math.floor(Date.now() * 1e3) },
    issuer: { str: `/CN=${address}` },
    notbefore: notBeforeStr,
    notafter: notAfterStr,
    subject: { str: `/CN=${address}` },
    sbjpubkey: pubKeyObj,
    ext: [
      { extname: "keyUsage", critical: true, names: ["keyEncipherment", "dataEncipherment"] },
      { extname: "extKeyUsage", array: [{ name: "clientAuth" }] },
      { extname: "basicConstraints", cA: true, critical: true },
    ],
    sigalg: "SHA256withECDSA",
    cakey: prvKeyObj,
  });

  return {
    cert: cert.getPEM(),
    publicKey: (rs.KEYUTIL.getPEM as (k: unknown, f: string) => string)(pubKeyObj, "PKCS8PUB").replaceAll(
      "PUBLIC KEY",
      "EC PUBLIC KEY",
    ),
    privateKey: (rs.KEYUTIL.getPEM as (k: unknown, f: string) => string)(prvKeyObj, "PKCS8PRV"),
  };
}
