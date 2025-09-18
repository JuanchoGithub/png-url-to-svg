import type { UploadedImage } from '../types';

// A CORS proxy is used to bypass browser cross-origin restrictions when fetching website content.
const CORS_PROXY = 'https://corsproxy.io/?';

/**
 * Fetches the HTML of a given URL and extracts all image source URLs.
 * @param url The website URL to scrape for images.
 * @returns A promise that resolves to an array of absolute image URLs.
 */
export const fetchImagesFromUrl = async (url: string): Promise<string[]> => {
  try {
    const response = await fetch(`${CORS_PROXY}${encodeURIComponent(url)}`);
    if (!response.ok) {
      throw new Error(`Failed to fetch URL: ${response.statusText}`);
    }
    const html = await response.text();
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    const images = Array.from(doc.querySelectorAll('img'));
    
    const imageUrls = images
      .map(img => img.src)
      .filter(src => !!src && !src.startsWith('data:')) // Filter out empty or data URIs for simplicity
      .map(src => new URL(src, url).href); // Resolve relative URLs to absolute paths

    // Return a unique set of image URLs
    return [...new Set(imageUrls)];
  } catch (error) {
    console.error("Error fetching images from URL:", error);
    throw new Error("Could not fetch or parse the provided URL. Make sure it's a valid, public website.");
  }
};

/**
 * Converts an image from a URL to a base64 Data URL.
 * @param url The URL of the image to convert.
 * @returns A promise that resolves to an UploadedImage object.
 */
export const imageUrlToDataUrl = async (url: string): Promise<UploadedImage> => {
    try {
        const response = await fetch(`${CORS_PROXY}${encodeURIComponent(url)}`);
        if (!response.ok) {
          throw new Error(`Failed to fetch image: ${response.statusText}`);
        }
        const blob = await response.blob();
        const mimeType = blob.type;

        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => {
                resolve({ dataUrl: reader.result as string, mimeType });
            };
            reader.onerror = reject;
            reader.readAsDataURL(blob);
        });

    } catch(error) {
        console.error("Error converting image URL to data URL:", error);
        throw new Error("Could not load the selected image.");
    }
}