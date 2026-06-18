const TO_RADIANS = Math.PI / 180;

/**
 * @param {string} url
 */
function createImage(url) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.addEventListener("load", () => resolve(image));
    image.addEventListener("error", (error) => reject(error));
    image.setAttribute("crossOrigin", "anonymous");
    image.src = url;
  });
}

/**
 * @param {number} degree
 * @param {{ width: number, height: number }} imageSize
 */
function rotateSize(degree, imageSize) {
  const rotRad = degree * TO_RADIANS;
  return {
    width: Math.abs(Math.cos(rotRad) * imageSize.width) + Math.abs(Math.sin(rotRad) * imageSize.height),
    height: Math.abs(Math.sin(rotRad) * imageSize.width) + Math.abs(Math.cos(rotRad) * imageSize.height),
  };
}

/**
 * @param {string} imageSrc
 * @param {{ x: number, y: number, width: number, height: number }} pixelCrop
 * @param {number} rotation
 * @param {{ width: number, height: number }} outputSize
 */
export async function getCroppedImageBlob(
  imageSrc,
  pixelCrop,
  rotation = 0,
  outputSize = { width: 256, height: 256 },
) {
  const image = await createImage(imageSrc);
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas not supported");

  const rotRad = rotation * TO_RADIANS;
  const { width: bBoxWidth, height: bBoxHeight } = rotateSize(rotation, {
    width: image.width,
    height: image.height,
  });

  canvas.width = bBoxWidth;
  canvas.height = bBoxHeight;

  ctx.translate(bBoxWidth / 2, bBoxHeight / 2);
  ctx.rotate(rotRad);
  ctx.translate(-image.width / 2, -image.height / 2);
  ctx.drawImage(image, 0, 0);

  const croppedCanvas = document.createElement("canvas");
  const croppedCtx = croppedCanvas.getContext("2d");
  if (!croppedCtx) throw new Error("Canvas not supported");

  croppedCanvas.width = outputSize.width;
  croppedCanvas.height = outputSize.height;

  croppedCtx.drawImage(
    canvas,
    pixelCrop.x,
    pixelCrop.y,
    pixelCrop.width,
    pixelCrop.height,
    0,
    0,
    outputSize.width,
    outputSize.height,
  );

  const blob = await new Promise((resolve, reject) => {
    croppedCanvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("Failed to export image"))),
      "image/webp",
      0.9,
    );
  });

  return blob;
}

/**
 * @param {Blob} blob
 */
export async function blobToBase64Payload(blob) {
  const buffer = await blob.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.length; i += 1) {
    binary += String.fromCharCode(bytes[i]);
  }
  return {
    mime: "image/webp",
    data: btoa(binary),
  };
}
