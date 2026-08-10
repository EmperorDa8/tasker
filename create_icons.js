const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

// Function to generate a simple RGBA PNG buffer
function createPng(width, height, colorRgb) {
  // PNG signature
  const signature = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);

  // IHDR chunk
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // Bit depth
  ihdr[9] = 6; // Color type: RGBA
  ihdr[10] = 0; // Compression method
  ihdr[11] = 0; // Filter method
  ihdr[12] = 0; // Interlace method

  const ihdrChunk = createChunk('IHDR', ihdr);

  // Raw pixel data with filter type 0 for each scanline
  const rowSize = 1 + width * 4;
  const rawData = Buffer.alloc(height * rowSize);

  for (let y = 0; y < height; y++) {
    const rowOffset = y * rowSize;
    rawData[rowOffset] = 0; // Filter type None

    for (let x = 0; x < width; x++) {
      const pxOffset = rowOffset + 1 + x * 4;
      
      // Draw rounded rectangle icon with activity pulse line
      const margin = Math.floor(width * 0.1);
      const isPulse = (y > height * 0.4 && y < height * 0.6) && (
        (x > width * 0.25 && x < width * 0.35) ||
        (x > width * 0.45 && x < width * 0.55) ||
        (x > width * 0.65 && x < width * 0.75)
      );

      if (x >= margin && x < width - margin && y >= margin && y < height - margin) {
        if (isPulse) {
          // White pulse accent
          rawData[pxOffset] = 255;
          rawData[pxOffset + 1] = 255;
          rawData[pxOffset + 2] = 255;
          rawData[pxOffset + 3] = 255;
        } else {
          // Indigo Brand fill #4F46E5
          rawData[pxOffset] = colorRgb[0];
          rawData[pxOffset + 1] = colorRgb[1];
          rawData[pxOffset + 2] = colorRgb[2];
          rawData[pxOffset + 3] = 255;
        }
      } else {
        // Transparent background
        rawData[pxOffset] = 0;
        rawData[pxOffset + 1] = 0;
        rawData[pxOffset + 2] = 0;
        rawData[pxOffset + 3] = 0;
      }
    }
  }

  const compressedData = zlib.deflateSync(rawData);
  const idatChunk = createChunk('IDAT', compressedData);
  const iendChunk = createChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([signature, ihdrChunk, idatChunk, iendChunk]);
}

function createChunk(type, data) {
  const length = data.length;
  const chunk = Buffer.alloc(8 + length + 4);
  chunk.writeUInt32BE(length, 0);
  chunk.write(type, 4, 4, 'ascii');
  data.copy(chunk, 8);

  const crc = crc32(chunk.slice(4, 8 + length));
  chunk.writeInt32BE(crc, 8 + length);
  return chunk;
}

// CRC32 implementation
function crc32(buf) {
  let crc = 0xFFFFFFFF;
  for (let i = 0; i < buf.length; i++) {
    crc ^= buf[i];
    for (let j = 0; j < 8; j++) {
      crc = (crc >>> 1) ^ (crc & 1 ? 0xEDB88320 : 0);
    }
  }
  return (crc ^ 0xFFFFFFFF) | 0;
}

// Output directory
const assetsDir = path.join(__dirname, 'assets');
if (!fs.existsSync(assetsDir)) {
  fs.mkdirSync(assetsDir, { recursive: true });
}

// Write icons (Indigo #4F46E5 => [79, 70, 229])
fs.writeFileSync(path.join(assetsDir, 'icon16.png'), createPng(16, 16, [79, 70, 229]));
fs.writeFileSync(path.join(assetsDir, 'icon48.png'), createPng(48, 48, [79, 70, 229]));
fs.writeFileSync(path.join(assetsDir, 'icon128.png'), createPng(128, 128, [79, 70, 229]));

console.log('Icons generated successfully in assets/ directory!');
