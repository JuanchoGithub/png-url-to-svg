// A programmatic image-to-SVG vectorizer that supports multiple colors and geometric primitive detection.

type Point = { x: number; y: number };
type Path = Point[];
type Color = { r: number; g: number; b: number; a: number };

export type TracedShape = {
  color: Color;
  contours: Path[];
};

export type TracedRect = {
  color: Color;
  x: number;
  y: number;
  width: number;
  height: number;
};

export type TracedData = {
  width: number;
  height: number;
  shapes: TracedShape[];
  rects: TracedRect[];
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
 * Extracts unique, non-transparent colors from image data.
 */
const getUniqueColors = (imageData: ImageData): Color[] => {
    const { data } = imageData;
    const colorSet = new Set<string>();
    const ALPHA_THRESHOLD = 30;

    for (let i = 0; i < data.length; i += 4) {
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        const a = data[i + 3];

        if (a > ALPHA_THRESHOLD) {
            colorSet.add(`${r},${g},${b},${a}`);
        }
    }
    
    return Array.from(colorSet).map(c => {
        const [r, g, b, a] = c.split(',').map(Number);
        return { r, g, b, a };
    });
};

/**
 * Creates a new ImageData object serving as a mask for a single target color.
 * Pixels matching the target color are made opaque black, others are transparent.
 */
const createColorMask = (imageData: ImageData, targetColor: Color): ImageData => {
    const { width, height, data } = imageData;
    const maskData = new Uint8ClampedArray(data.length);
    const COLOR_TOLERANCE = 5; // Allow for slight variations in color, e.g., from anti-aliasing

    for (let i = 0; i < data.length; i += 4) {
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        const a = data[i + 3];

        const isMatch = 
            Math.abs(r - targetColor.r) <= COLOR_TOLERANCE &&
            Math.abs(g - targetColor.g) <= COLOR_TOLERANCE &&
            Math.abs(b - targetColor.b) <= COLOR_TOLERANCE &&
            Math.abs(a - targetColor.a) <= COLOR_TOLERANCE;

        if (isMatch) {
            maskData[i + 3] = 255; // Opaque
        } else {
            maskData[i + 3] = 0;   // Transparent
        }
    }
    return new ImageData(maskData, width, height);
};

/**
 * Detects solid-colored rectangles in a color mask, adding them to a list and
 * returning a new mask with those areas "erased" (alpha set to 0).
 */
const detectAndRemoveRectangles = (mask: ImageData, color: Color): { rects: TracedRect[], remainingMask: ImageData } => {
  const { width, height } = mask;
  const maskData = new Uint8ClampedArray(mask.data); // Clone data to modify
  const remainingMask = new ImageData(maskData, width, height);
  const rects: TracedRect[] = [];
  const ALPHA_THRESHOLD = 250; 
  const MIN_RECT_AREA = 16; 

  const isOpaque = (x: number, y: number, data: Uint8ClampedArray) => {
    if (x < 0 || x >= width || y < 0 || y >= height) return false;
    return data[(y * width + x) * 4 + 3] > ALPHA_THRESHOLD;
  };

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (isOpaque(x, y, remainingMask.data)) {
        let w = 1;
        while (isOpaque(x + w, y, remainingMask.data)) {
          w++;
        }

        let h = 1;
        let canExpandDown = true;
        while (canExpandDown) {
          for (let i = 0; i < w; i++) {
            if (!isOpaque(x + i, y + h, remainingMask.data)) {
              canExpandDown = false;
              break;
            }
          }
          if (canExpandDown) {
            h++;
          }
        }
        
        if (w * h >= MIN_RECT_AREA) {
          rects.push({ color, x, y, width: w, height: h });
          
          for (let j = 0; j < h; j++) {
            for (let i = 0; i < w; i++) {
              const index = (y + j) * width + (x + i);
              remainingMask.data[index * 4 + 3] = 0;
            }
          }
        }
      }
    }
  }
  return { rects, remainingMask };
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
 * Traces the contours of opaque pixels in the image data.
 */
const traceContours = (imageData: ImageData): Path[] => {
  const { width, height, data } = imageData;
  const visited = new Uint8Array(width * height);
  const paths: Path[] = [];
  const ALPHA_THRESHOLD = 30;

  const isOpaque = (x: number, y: number) => {
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
      if (isOpaque(x, y) && !visited[index]) {
        const startPoint = { x, y };
        const path: Path = [startPoint];
        let currentPoint = startPoint;
        let dir = 0;

        do {
          let foundNext = false;
          for (let i = 0; i < 8; i++) {
              const nextDir = (dir + i + 5) % 8;
              const nextPoint = { 
                  x: currentPoint.x + directions[nextDir].x, 
                  y: currentPoint.y + directions[nextDir].y 
              };
              
              if (isOpaque(nextPoint.x, nextPoint.y)) {
                  currentPoint = nextPoint;
                  dir = nextDir;
                  if(!path.find(p => p.x === currentPoint.x && p.y === currentPoint.y)) {
                     path.push(currentPoint);
                  }
                  foundNext = true;
                  break;
              }
          }
           if (!foundNext) break;
        } while (currentPoint.x !== startPoint.x || currentPoint.y !== startPoint.y);

        paths.push(path);

        for (const p of path) {
            const pIndex = p.y * width + p.x;
            if (pIndex >= 0 && pIndex < visited.length) {
                visited[pIndex] = 1;
            }
        }
      }
    }
  }
  return paths;
};

/**
 * Downsamples a mask and then traces it to produce simpler contours.
 * This helps merge thin lines and reduce noise.
 */
const downsampleAndTrace = (mask: ImageData): Path[] => {
    const scale = 2; // Downsample by a factor of 2. Higher values mean more simplification.
    const newWidth = Math.floor(mask.width / scale);
    const newHeight = Math.floor(mask.height / scale);

    // If the image is already very small, don't downsample further
    if (newWidth < 10 || newHeight < 10) {
        return traceContours(mask);
    }

    const canvas = document.createElement('canvas');
    canvas.width = newWidth;
    canvas.height = newHeight;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return traceContours(mask); // Fallback

    // Create a temporary canvas to put the original mask data
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = mask.width;
    tempCanvas.height = mask.height;
    const tempCtx = tempCanvas.getContext('2d');
    if (!tempCtx) return traceContours(mask); // Fallback
    tempCtx.putImageData(mask, 0, 0);

    // Draw the original-sized mask onto the smaller canvas.
    // This process effectively averages/samples the pixels, merging thin details.
    ctx.drawImage(tempCanvas, 0, 0, newWidth, newHeight);
    const downsampledImageData = ctx.getImageData(0, 0, newWidth, newHeight);

    // Trace the contours on the smaller, simplified image data
    const tracedPaths = traceContours(downsampledImageData);

    // Scale the coordinates of the traced paths back up to the original image dimensions
    return tracedPaths.map(path =>
        path.map(point => ({
            x: (point.x + 0.5) * scale, // Add 0.5 to center the point in the scaled-up pixel
            y: (point.y + 0.5) * scale,
        }))
    );
};

/**
 * Converts a list of paths into an SVG path data string.
 */
const pathsToSvgData = (paths: Path[]): string => {
  return paths.map(path => {
    if (path.length < 2) return '';
    const start = `M${path[0].x},${path[0].y}`;
    const lines = path.slice(1).map(p => `L${p.x},${p.y}`).join('');
    return `${start}${lines}Z`;
  }).join(' ');
};

const toHex = (c: number) => c.toString(16).padStart(2, '0');

/**
 * Traces an image from a data URL and returns structured path data.
 * This is the computationally expensive part.
 */
export const traceImage = async (dataUrl: string): Promise<TracedData> => {
    const imageData = await getImageData(dataUrl);
    const colors = getUniqueColors(imageData);
    
    if (colors.length === 0) {
      throw new Error("No shapes found in the image. Try an image with a transparent background.");
    }
    
    const allRects: TracedRect[] = [];
    const allShapes: TracedShape[] = [];

    for (const color of colors) {
      const mask = createColorMask(imageData, color);
      
      const { rects, remainingMask } = detectAndRemoveRectangles(mask, color);
      allRects.push(...rects);

      const contours = downsampleAndTrace(remainingMask);
      if (contours.some(c => c.length > 1)) {
          allShapes.push({ color, contours });
      }
    }
  
    if (allShapes.length === 0 && allRects.length === 0) {
        throw new Error("Could not trace any vector paths from the image.");
    }
    
    return {
        width: imageData.width,
        height: imageData.height,
        shapes: allShapes,
        rects: allRects,
    };
};

/**
 * Generates an SVG string from traced data and a simplification level.
 * This is the fast part that can be re-run with different simplification values.
 */
export const generateSvg = (tracedData: TracedData, simplification: number): string => {
    const { width, height, shapes, rects } = tracedData;

    const rectElements = (rects || []).map(rect => {
        const { color, x, y, width, height } = rect;
        const hexColor = `#${toHex(color.r)}${toHex(color.g)}${toHex(color.b)}`;
        const opacity = (color.a / 255).toFixed(2);
        return `<rect x="${x}" y="${y}" width="${width}" height="${height}" fill="${hexColor}" fill-opacity="${opacity}"/>`;
    }).join('');


    const pathElements = (shapes || []).map(shape => {
        const { color, contours } = shape;
        const simplifiedContours = contours.map(path => simplifyPath(path, simplification));
        const svgPathData = pathsToSvgData(simplifiedContours);
        
        if (!svgPathData) return '';

        const hexColor = `#${toHex(color.r)}${toHex(color.g)}${toHex(color.b)}`;
        const opacity = (color.a / 255).toFixed(2);

        return `<path fill="${hexColor}" fill-opacity="${opacity}" fill-rule="evenodd" d="${svgPathData}"/>`;
    }).join('');

    const allElements = rectElements + pathElements;

    if (!allElements) {
        return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}"></svg>`;
    }
  
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}">${allElements}</svg>`;
};