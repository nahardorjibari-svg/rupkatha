/**
 * Image processing and color extraction utilities for Login Hero Image Manager
 */

/**
 * Resizes image to max width 1200px, converts to WebP (or PNG if transparency is detected).
 * Returns { file, originalSize, optimizedSize, width, height, hasAlpha }
 */
export async function optimizeImage(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const maxWidth = 1200;
        let width = img.width;
        let height = img.height;

        if (width > maxWidth) {
          height = Math.round((height * maxWidth) / width);
          width = maxWidth;
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Failed to get canvas context'));
          return;
        }

        ctx.drawImage(img, 0, 0, width, height);

        // Check for alpha / transparency
        const imgData = ctx.getImageData(0, 0, width, height);
        let hasAlpha = false;
        for (let i = 3; i < imgData.data.length; i += 4) {
          if (imgData.data[i] < 255) {
            hasAlpha = true;
            break;
          }
        }

        const mimeType = hasAlpha ? 'image/png' : 'image/webp';
        const quality = hasAlpha ? undefined : 0.82;

        canvas.toBlob(
          (blob) => {
            if (!blob) {
              reject(new Error('Canvas blob generation failed'));
              return;
            }
            const optimizedFile = new File([blob], file.name.replace(/\.[^/.]+$/, hasAlpha ? '.png' : '.webp'), {
              type: mimeType,
              lastModified: Date.now(),
            });
            resolve({
              file: optimizedFile,
              originalSize: file.size,
              optimizedSize: blob.size,
              width,
              height,
              hasAlpha,
              objectUrl: URL.createObjectURL(blob),
            });
          },
          mimeType,
          quality
        );
      };
      img.onerror = reject;
      img.src = e.target.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/**
 * Extracts a rich color palette (primary, secondary, soft, deep) from an image URL or File.
 */
export async function extractPalette(imageSrc) {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const size = 64;
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        resolve({
          primary: '#0F8B8D',
          secondary: '#2563EB',
          soft: '#E0F2FE',
          deep: '#0B2E33',
          hasAlpha: false,
        });
        return;
      }

      ctx.drawImage(img, 0, 0, size, size);
      const imgData = ctx.getImageData(0, 0, size, size).data;

      const colorCounts = {};
      let hasAlpha = false;

      for (let i = 0; i < imgData.length; i += 4) {
        const r = imgData[i];
        const g = imgData[i + 1];
        const b = imgData[i + 2];
        const a = imgData[i + 3];

        if (a < 128) {
          hasAlpha = true;
          continue;
        }

        // Ignore near-white and near-black
        if ((r > 240 && g > 240 && b > 240) || (r < 20 && g < 20 && b < 20)) {
          continue;
        }

        // Quantize to nearest 32
        const qr = Math.round(r / 32) * 32;
        const qg = Math.round(g / 32) * 32;
        const qb = Math.round(b / 32) * 32;
        const hex = `#${((1 << 24) + (qr << 16) + (qg << 8) + qb).toString(16).slice(1)}`;

        colorCounts[hex] = (colorCounts[hex] || 0) + 1;
      }

      const sortedColors = Object.keys(colorCounts).sort((a, b) => colorCounts[b] - colorCounts[a]);

      const primary = sortedColors[0] || '#0F8B8D';
      const secondary = sortedColors[1] || '#2563EB';
      const soft = sortedColors[2] || '#E0F2FE';
      const deep = sortedColors[sortedColors.length - 1] || '#0B2E33';

      resolve({
        primary,
        secondary,
        soft,
        deep,
        hasAlpha,
      });
    };
    img.onerror = () => {
      resolve({
        primary: '#0F8B8D',
        secondary: '#2563EB',
        soft: '#E0F2FE',
        deep: '#0B2E33',
        hasAlpha: false,
      });
    };
    img.src = imageSrc;
  });
}
