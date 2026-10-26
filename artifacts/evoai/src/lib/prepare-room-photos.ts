type RoomPhoto = {
  name: string;
  type: string;
  dataBase64: string;
};

const MAX_IMAGE_EDGE = 4096;

function decodePhoto(photo: RoomPhoto): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => {
      if (!image.naturalWidth || !image.naturalHeight) {
        reject(new Error(`Could not read the dimensions of ${photo.name}.`));
        return;
      }
      resolve(image);
    };
    image.onerror = () => reject(new Error(`Could not decode ${photo.name}. Choose a JPEG, PNG, or WebP photo.`));
    image.src = `data:${photo.type};base64,${photo.dataBase64}`;
  });
}

/**
 * Reconstruction requires matching dimensions and aspect ratios. Fit every
 * photo to a common canvas without cropping, stretching, or replacing details.
 * This changes only the submitted copies, not the user's original files.
 */
export async function prepareRoomPhotos<T extends RoomPhoto>(photos: T[]): Promise<T[]> {
  if (photos.length < 2) return photos;

  const images = await Promise.all(photos.map(decodePhoto));
  const reference = images[0];
  if (
    Math.max(reference.naturalWidth, reference.naturalHeight) <= MAX_IMAGE_EDGE
    && images.every((image) => (
      image.naturalWidth === reference.naturalWidth && image.naturalHeight === reference.naturalHeight
    ))
  ) {
    return photos;
  }
  const aspectRatio = reference.naturalWidth / reference.naturalHeight;
  const longEdge = Math.min(
    MAX_IMAGE_EDGE,
    Math.max(...images.map((image) => Math.max(image.naturalWidth, image.naturalHeight))),
  );
  const width = Math.max(1, Math.round(aspectRatio >= 1 ? longEdge : longEdge * aspectRatio));
  const height = Math.max(1, Math.round(aspectRatio >= 1 ? longEdge / aspectRatio : longEdge));
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('This browser could not prepare the room photos. Try a current desktop browser.');

  return photos.map((photo, index) => {
    const image = images[index];
    const scale = Math.min(width / image.naturalWidth, height / image.naturalHeight);
    const drawWidth = image.naturalWidth * scale;
    const drawHeight = image.naturalHeight * scale;
    context.fillStyle = '#808080';
    context.fillRect(0, 0, width, height);
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = 'high';
    context.drawImage(image, (width - drawWidth) / 2, (height - drawHeight) / 2, drawWidth, drawHeight);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.95);
    if (!dataUrl.startsWith('data:image/jpeg;base64,')) {
      throw new Error(`This browser could not prepare ${photo.name} as a JPEG.`);
    }
    return {
      ...photo,
      name: `${photo.name.replace(/\.[^.]+$/, '')}-reconstruction.jpg`,
      type: 'image/jpeg',
      dataBase64: dataUrl.slice('data:image/jpeg;base64,'.length),
    };
  });
}
