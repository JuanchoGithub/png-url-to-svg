// A programmatic image-to-SVG vectorizer that supports multiple colors.

type Point = { x: number; y: number };
type Path = Point[];
type Color = { r: number; g: number; b: number; a: number };

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
 * Main function to convert an image data URL to a multi-color SVG string.
 */
export const convertImageToSvgProgrammatically = async (dataUrl: string): Promise<string> => {
  const imageData = await getImageData(dataUrl);
  const colors = getUniqueColors(imageData);
  
  if (colors.length === 0) {
    throw new Error("No shapes found in the image. Try an image with a transparent background.");
  }
  
  const pathElements = colors.map(color => {
    const mask = createColorMask(imageData, color);
    const contours = traceContours(mask);

    if (contours.length === 0) {
        return '';
    }

    const simplifiedContours = contours.map(path => simplifyPath(path, 1.5));
    const svgPathData = pathsToSvgData(simplifiedContours);
    
    const hexColor = `#${toHex(color.r)}${toHex(color.g)}${toHex(color.b)}`;
    const opacity = (color.a / 255).toFixed(2);

    return `<path fill="${hexColor}" fill-opacity="${opacity}" fill-rule="evenodd" d="${svgPathData}"/>`;
  }).join('');

  if (!pathElements) {
      throw new Error("Could not generate any vector paths from the image.");
  }
  
  const { width, height } = imageData;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}">${pathElements}</svg>`;
};
