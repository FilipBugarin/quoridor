import QRCode from "qrcode";

export async function generateShareQrSvg(url) {
  return QRCode.toString(url, {
    type: "svg",
    errorCorrectionLevel: "M",
    margin: 1,
    color: {
      dark: "#0f172a",
      light: "#ffffff"
    }
  });
}
