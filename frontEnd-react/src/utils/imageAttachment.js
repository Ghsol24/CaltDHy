// Receipt photos are shrunk in the browser before upload: the server accepts at most 600 KB per image.
const MAX_BYTES = 590 * 1024;
const dataUrlBytes = (dataUrl) => Math.floor((dataUrl.length - dataUrl.indexOf(',') - 1) * 0.75);

function loadImage(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => { URL.revokeObjectURL(url); resolve(image); };
    image.onerror = () => { URL.revokeObjectURL(url); reject(new Error('image')); };
    image.src = url;
  });
}

/** Returns a JPEG data URL under the upload limit, or throws when the file is not a usable image. */
export async function prepareReceiptImage(file) {
  if (!file || !/^image\//.test(file.type)) throw new Error('image');
  const image = await loadImage(file);
  for (const [edge, quality] of [[1600, 0.82], [1280, 0.72], [1024, 0.62], [800, 0.5]]) {
    const scale = Math.min(1, edge / Math.max(image.naturalWidth, image.naturalHeight));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
    const context = canvas.getContext('2d');
    context.fillStyle = '#fff';
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL('image/jpeg', quality);
    if (dataUrl.startsWith('data:image/jpeg') && dataUrlBytes(dataUrl) <= MAX_BYTES) return dataUrl;
  }
  throw new Error('image');
}
