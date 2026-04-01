import logoRealize from "@/assets/logo-realize.png";

let cachedBase64: string | null = null;

export const getLogoBase64 = async (): Promise<string> => {
  if (cachedBase64) return cachedBase64;
  
  const response = await fetch(logoRealize);
  const blob = await response.blob();
  
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      cachedBase64 = reader.result as string;
      resolve(cachedBase64);
    };
    reader.readAsDataURL(blob);
  });
};

export const getLogoHeaderHtml = (logoBase64: string, subtitle?: string): string => {
  return `
    <div style="text-align:center;margin-bottom:24px;border-bottom:2px solid #d5b884;padding-bottom:12px;">
      <img src="${logoBase64}" alt="Realize" style="height:60px;margin-bottom:8px;" />
      ${subtitle ? `<p style="margin:4px 0 0;font-size:12px;color:#666;">${subtitle}</p>` : ''}
    </div>
  `;
};
