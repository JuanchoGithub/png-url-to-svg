// FIX: Removed incorrect self-import of `TracedData` that conflicted with its local declaration.
// A programmatic image-to-SVG vectorizer that supports multiple colors and geometric primitive detection.

type Point = { x: number; y: number };
type Path = Point[];
type Color = { r: number; g: number; b: number; a: number };

export type TracedShape = {
  color: Color;
  contours: Path[];
  area: number;
};

export type TracedData = {
  width: number;
  height: number;
  shapes: TracedShape[];
};

export type GenerateSvgOptions = {
  simplification: number;
  strokeEnabled: boolean;
  strokeColor: string;
  strokeWidth: number;
};


/**
 * Loads an image from a data URL and returns its pixel data.
 */
const getImageData = (dataUrl: string): Promise<ImageData> => {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => {
      const canvas = document.createElement('canvas');
      const context = canvas.getContext('2d');
      if (!context) {
        return reject(new Error('Could not get canvas context.'));
      }
      canvas.width = image.width;
      canvas.height = image.height;
      context.drawImage(image, 0, 0);
      resolve(context.getImageData(0, 0, image.width, image.height));
    };
    image.onerror = (err) => reject(new Error(`Failed to load image: ${err}`));
    image.src = dataUrl;
  });
};

/**
 * Groups similar colors together using quantization to create a simplified color palette.
 */
const quantizeAndGetColors = (imageData: ImageData): (Color & {count: number})[] => {
    const colorMap = new Map<string, { r: number; g: number; b: number; a: number; count: number }>();
    const { data } = imageData;
    const ALPHA_THRESHOLD = 10;
    const OPAQUE_THRESHOLD = 240;
    // Quantization level. A higher value means fewer colors and more grouping.
    const Q = 16; 
  
    for (let i = 0; i < data.length; i += 4) {
      if (data[i + 3] > ALPHA_THRESHOLD) {
        // Use floor instead of round to prevent values from exceeding 255.
        const r = Math.floor(data[i] / Q) * Q;
        const g = Math.floor(data[i + 1] / Q) * Q;
        const b = Math.floor(data[i + 2] / Q) * Q;
        const a = Math.floor(data[i + 3] / (Q*2)) * (Q*2);

        // Group nearly-opaque colors together to handle anti-aliasing at edges.
        const effectiveA = a >= OPAQUE_THRESHOLD ? 255 : a;
        const key = `${r},${g},${b},${effectiveA}`;

        let entry = colorMap.get(key);
        if (!entry) {
          // Use the original alpha for the representative color of the group
          entry = { r, g, b, a, count: 0 };
          colorMap.set(key, entry);
        }
        entry.count++;
      }
    }
  
    const MIN_PIXEL_COUNT = 4; // Filter out tiny color specks
    return Array.from(colorMap.values()).filter(c => c.count >= MIN_PIXEL_COUNT);
};


/**
 * Creates a new ImageData object serving as a mask for a single target color.
 * Pixels matching the target color group are made opaque black, others are transparent.
 */
const createColorMask = (imageData: ImageData, targetColor: Color): ImageData => {
    const { width, height, data } = imageData;
    const maskData = new Uint8ClampedArray(data.length);
    const Q = 16;
    const ALPHA_THRESHOLD = 10;
    const OPAQUE_THRESHOLD = 240;

    for (let i = 0; i < data.length; i += 4) {
        if (data[i + 3] > ALPHA_THRESHOLD) {
            const r = Math.floor(data[i] / Q) * Q;
            const g = Math.floor(data[i + 1] / Q) * Q;
            const b = Math.floor(data[i + 2] / Q) * Q;
            const a = Math.floor(data[i + 3] / (Q * 2)) * (Q * 2);

            const currentMatches = (r === targetColor.r && g === targetColor.g && b === targetColor.b);

            if (currentMatches) {
                const isTargetOpaque = targetColor.a >= OPAQUE_THRESHOLD;
                const isCurrentOpaque = a >= OPAQUE_THRESHOLD;
                // If the target color is opaque, treat all nearly-opaque pixels of the same color as a match.
                if (isTargetOpaque && isCurrentOpaque) {
                    maskData[i + 3] = 255;
                } 
                // For semi-transparent colors, require a more exact alpha match.
                else if (a === targetColor.a) {
                    maskData[i + 3] = 255;
                }
            }
        }
    }
    return new ImageData(maskData, width, height);
};

/**
 * Applies a fast, separable box blur to the alpha channel of an ImageData object.
 * This is used to simplify shapes by smoothing their edges before tracing.
 * @param imageData The image data to blur.
 * @param radius The blur radius (integer).
 * @returns The blurred ImageData.
 */
const applyFastBlur = (imageData: ImageData, radius: number): ImageData => {
    if (radius < 1) return imageData;
    radius = Math.floor(radius);
    
    const w = imageData.width;
    const h = imageData.height;
    const data = imageData.data;
    const temp = new Uint8ClampedArray(data.length);
    temp.set(data);
    
    // Horizontal pass
    for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
            let a = 0;
            let count = 0;
            for (let i = -radius; i <= radius; i++) {
                const xi = x + i;
                if (xi >= 0 && xi < w) {
                    a += temp[(y * w + xi) * 4 + 3];
                    count++;
                }
            }
            data[(y * w + x) * 4 + 3] = a / count;
        }
    }

    temp.set(data);

    // Vertical pass
    for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
            let a = 0;
            let count = 0;
            for (let i = -radius; i <= radius; i++) {
                const yi = y + i;
                if (yi >= 0 && yi < h) {
                    a += temp[(yi * w + x) * 4 + 3];
                    count++;
                }
            }
            data[(y * w + x) * 4 + 3] = a / count;
        }
    }
    
    return imageData;
};

/**
 * Converts a grayscale (alpha channel) image to a binary mask based on a threshold.
 * @param imageData The image data to process.
 * @param threshold The alpha value threshold (0-255).
 * @returns The binary mask ImageData.
 */
const applyThreshold = (imageData: ImageData, threshold: number): ImageData => {
    const { width, height, data } = imageData;
    for (let i = 0; i < data.length; i += 4) {
        data[i + 3] = data[i + 3] >= threshold ? 255 : 0;
    }
    return imageData;
};


/**
 * Simplifies a path using the Ramer-Douglas-Peucker algorithm.
 */
const simplifyPath = (points: Path, epsilon: number): Path => {
  if (points.length < 3) {
    return points;
  }

  const getSquareSegmentDistance = (p: Point, p1: Point, p2: Point) => {
    let { x, y } = p1;
    let dx = p2.x - x;
    let dy = p2.y - y;

    if (dx !== 0 || dy !== 0) {
      const t = ((p.x - x) * dx + (p.y - y) * dy) / (dx * dx + dy * dy);
      if (t > 1) {
        x = p2.x;
        y = p2.y;
      } else if (t > 0) {
        x += dx * t;
        y += dy * t;
      }
    }
    dx = p.x - x;
    dy = p.y - y;
    return dx * dx + dy * dy;
  };

  let maxDist = 0;
  let index = 0;
  const last = points.length - 1;

  for (let i = 1; i < last; i++) {
    const dist = getSquareSegmentDistance(points[i], points[0], points[last]);
    if (dist > maxDist) {
      index = i;
      maxDist = dist;
    }
  }

  if (maxDist > epsilon * epsilon) {
    const left = simplifyPath(points.slice(0, index + 1), epsilon);
    const right = simplifyPath(points.slice(index), epsilon);
    return left.slice(0, left.length - 1).concat(right);
  } else {
    return [points[0], points[last]];
  }
};

/**
 * Traces all contours in the image data, including both outer shapes and inner holes,
 * without merging separate visual elements.
 */
const traceContours = (imageData: ImageData): Path[] => {
  const { width, height, data } = imageData;
  const visited = new Uint8Array(width * height);
  const paths: Path[] = [];
  const ALPHA_THRESHOLD = 128;

  const isOpaque = (x: number, y: number): boolean => {
    if (x < 0 || x >= width || y < 0 || y >= height) return false;
    return data[(y * width + x) * 4 + 3] > ALPHA_THRESHOLD;
  };
  
  const directions = [
    { x: 0, y: -1 }, { x: 1, y: -1 }, { x: 1, y: 0 }, { x: 1, y: 1 },
    { x: 0, y: 1 }, { x: -1, y: 1 }, { x: -1, y: 0 }, { x: -1, y: -1 }
  ];

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const index = y * width + x;
      if (visited[index] || !isOpaque(x, y)) {
        continue;
      }
      
      const isBoundary = (x === 0 || y === 0 || x === width - 1 || y === height - 1) || 
                         !isOpaque(x + 1, y) || !isOpaque(x - 1, y) ||
                         !isOpaque(x, y + 1) || !isOpaque(x, y - 1);
                         
      if (!isBoundary) {
        continue;
      }

      const startPoint = { x, y };
      const path: Path = [];
      let currentPoint = startPoint;
      let dir = 0; 

      do {
        path.push(currentPoint);
        
        const startSearchDir = (dir + 6) % 8;
        let foundNext = false;
        for (let i = 0; i < 8; i++) {
            const nextDir = (startSearchDir + i) % 8;
            const nextPoint = { 
                x: currentPoint.x + directions[nextDir].x, 
                y: currentPoint.y + directions[nextDir].y 
            };
            
            if (isOpaque(nextPoint.x, nextPoint.y)) {
                dir = nextDir;
                currentPoint = nextPoint;
                foundNext = true;
                break;
            }
        }
         if (!foundNext) break; 
      } while (currentPoint.x !== startPoint.x || currentPoint.y !== startPoint.y);

      if (path.length > 2) {
          paths.push(path);
          for (const p of path) {
              visited[p.y * width + p.x] = 1;
          }
      }
    }
  }
  return paths;
};

/**
 * Converts a list of paths into an SVG path data string.
 */
const pathsToSvgData = (paths: Path[]): string => {
  return paths.map(path => {
    if (path.length < 2) return '';
    // Start with M command for the first point
    const start = `M${path[0].x.toFixed(1)} ${path[0].y.toFixed(1)}`;
    // Chain subsequent points with a single L command for efficiency
    const lines = 'L' + path.slice(1).map(p => `${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ');
    // Join parts and add Z to close the path.
    return `${start}${lines}Z`;
  }).join(''); // Join multiple subpaths (for the same color) without spaces
};


const toHex = (c: number) => c.toString(16).padStart(2, '0');

/**
 * Traces an image from a data URL and returns structured path data.
 * This is the computationally expensive part.
 */
export const traceImage = async (dataUrl: string, options: { tracingTolerance?: number } = {}): Promise<TracedData> => {
    const { tracingTolerance = 0 } = options;
    const imageData = await getImageData(dataUrl);
    const colors = quantizeAndGetColors(imageData);
    
    if (colors.length === 0) {
      throw new Error("No significant colors found in the image. Try an image with a different background.");
    }
    
    const allShapes: TracedShape[] = [];

    for (const color of colors) {
      let mask = createColorMask(imageData, color);
      
      if (tracingTolerance > 0) {
        const radius = Math.round(tracingTolerance);
        const blurredMask = applyFastBlur(mask, radius);
        mask = applyThreshold(blurredMask, 128);
      }
      
      const contours = traceContours(mask);
      
      if (contours.some(c => c.length > 1)) {
          allShapes.push({ color, contours, area: color.count });
      }
    }
  
    if (allShapes.length === 0) {
        throw new Error("Could not trace any vector paths from the image.");
    }
    
    // Sort shapes by area in descending order to ensure correct z-index layering in SVG
    allShapes.sort((a, b) => b.area - a.area);

    return {
        width: imageData.width,
        height: imageData.height,
        shapes: allShapes,
    };
};

/**
 * Generates an SVG string from traced data and a simplification level.
 * This is the fast part that can be re-run with different simplification values.
 */
export const generateSvg = (tracedData: TracedData, options: GenerateSvgOptions): string => {
    const { width, height, shapes } = tracedData;
    const { simplification, strokeEnabled, strokeColor, strokeWidth } = options;

    const pathElements = (shapes || []).map(shape => {
        const { color, contours } = shape;
        const simplifiedContours = contours.map(path => simplifyPath(path, simplification));
        const svgPathData = pathsToSvgData(simplifiedContours);
        
        if (!svgPathData.trim()) return '';

        const hexColor = `#${toHex(color.r)}${toHex(color.g)}${toHex(color.b)}`;
        const opacity = (color.a / 255).toFixed(2);

        const strokeAttrs = strokeEnabled
            ? ` stroke="${strokeColor}" stroke-width="${strokeWidth.toFixed(1)}" vector-effect="non-scaling-stroke"`
            : '';

        return `<path fill="${hexColor}" fill-opacity="${opacity}"${strokeAttrs} fill-rule="evenodd" d="${svgPathData}"/>`;
    }).join('');

    if (!pathElements) {
        return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}"></svg>`;
    }
  
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}">${pathElements}</svg>`;
};
