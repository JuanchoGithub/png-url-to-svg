import type { UploadedImage } from '../types';

type Color = { r: number; g: number; b: number; a: number };

/**
 * Calculates the Euclidean distance between two colors in RGB space.
 * @param c1 First color.
 * @param c2 Second color.
 * @returns The distance between the colors.
 */
const colorDistance = (c1: Omit<Color, 'a'>, c2: Omit<Color, 'a'>): number => {
    const dr = c1.r - c2.r;
    const dg = c1.g - c2.g;
    const db = c1.b - c2.b;
    return Math.sqrt(dr * dr + dg * dg + db * db);
};

/**
 * Gets the color of a specific pixel from ImageData.
 * @param imageData The image data to read from.
 * @param x The x-coordinate of the pixel.
 * @param y The y-coordinate of the pixel.
 * @returns The color of the pixel.
 */
const getPixel = (imageData: ImageData, x: number, y: number): Color => {
    const i = (y * imageData.width + x) * 4;
    return {
        r: imageData.data[i],
        g: imageData.data[i + 1],
        b: imageData.data[i + 2],
        a: imageData.data[i + 3],
    };
};

/**
 * Removes the background of an image based on the color of its top-left corner.
 * Pixels with a color similar to the corner color are made transparent.
 * @param image The uploaded image to process.
 * @param tolerance The color similarity tolerance. A lower value means a stricter match.
 * @returns A promise that resolves to the processed image as a PNG.
 */
export const removeImageBackground = (image: UploadedImage, tolerance: number = 20): Promise<UploadedImage> => {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            if (!ctx) {
                return reject(new Error('Could not get canvas context.'));
            }
            canvas.width = img.width;
            canvas.height = img.height;
            ctx.drawImage(img, 0, 0);

            if (img.width === 0 || img.height === 0) {
                return resolve(image); // Return original if image is empty
            }

            const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            const { data } = imageData;

            // Assume the top-left corner is the background color.
            const backgroundColor = getPixel(imageData, 0, 0);

            // If the determined background is already transparent, no need to process.
            if (backgroundColor.a < 128) {
                return resolve(image);
            }

            for (let i = 0; i < data.length; i += 4) {
                const r = data[i];
                const g = data[i + 1];
                const b = data[i + 2];
                
                const distance = colorDistance({ r, g, b }, backgroundColor);
                
                if (distance < tolerance) {
                    // Make this pixel transparent
                    data[i + 3] = 0;
                }
            }

            ctx.putImageData(imageData, 0, 0);
            const newDataUrl = canvas.toDataURL('image/png'); // Always output PNG for transparency
            resolve({ dataUrl: newDataUrl, mimeType: 'image/png' });
        };
        img.onerror = () => reject(new Error('Failed to load image for background removal.'));
        img.src = image.dataUrl;
    });
};
