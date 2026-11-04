// Imagens anexadas nas abas Cabeçalho/Rodapé. Ficam só em memória (não são
// salvas), já que são específicas de cada contrato que está sendo formatado
// no momento — diferente dos coringas/CSS, que são reaproveitados sempre.

export interface ImageAsset {
  id: string;
  name: string;
  dataUrl: string;
}

let counter = 0;
export function newImageId(): string {
  counter += 1;
  return `img${Date.now().toString(36)}${counter}`;
}

export function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error ?? new Error('Falha ao ler arquivo'));
    reader.readAsDataURL(file);
  });
}

// Token que o usuário pode digitar no texto (ex: "{IMAGEM_1}") pra escolher
// onde a imagem entra. Numeração segue a ordem em que as imagens foram
// adicionadas.
export function imageToken(position: number): string {
  return `{IMAGEM_${position}}`;
}

export function imageTag(asset: ImageAsset): string {
  const safeName = asset.name.replace(/"/g, '');
  return `<img src="${asset.dataUrl}" alt="${safeName}" style="max-width: 100%;" />`;
}

// Troca cada token "{IMAGEM_n}" presente no html pela tag <img> correspondente.
// Imagens que não tiverem token referenciado no texto entram automaticamente
// no início (cabeçalho) ou no final (rodapé) do resultado.
export function applyImages(html: string, images: ImageAsset[], placement: 'before' | 'after'): string {
  let result = html;
  const used = new Set<string>();

  images.forEach((asset, index) => {
    const token = imageToken(index + 1);
    if (result.includes(token)) {
      result = result.split(token).join(imageTag(asset));
      used.add(asset.id);
    }
  });

  const unused = images.filter((asset) => !used.has(asset.id));
  if (unused.length > 0) {
    const block = unused.map((asset) => `<p>${imageTag(asset)}</p>`).join('\n');
    result = placement === 'before' ? `${block}\n\n${result}`.trim() : `${result}\n\n${block}`.trim();
  }

  return result;
}
