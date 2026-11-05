/**
 * Descarrega um ficheiro do Feed para o computador/telemóvel com o nome certo (um link com
 * `download` para outro domínio — o armazenamento — abria só noutro separador).
 */
export const downloadFile = async (url: string, name: string): Promise<boolean> => {
  try {
    const response = await fetch(url);
    if (!response.ok) return false;
    const blob = await response.blob();
    const href = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = href;
    link.download = name;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(href), 10_000);
    return true;
  } catch {
    return false;
  }
};
