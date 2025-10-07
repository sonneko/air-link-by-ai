
import pako from "pako";

// URL-safe compression and decompression helpers
export const compress = (data: string): string => {
    const compressed = pako.deflate(data);
    return btoa(String.fromCharCode.apply(null, Array.from(compressed)))
      .replace(/\+/g, '-') // Convert '+' to '-'
      .replace(/\//g, '_') // Convert '/' to '_'
      .replace(/=+$/, ''); // Remove padding
};
  
export const decompress = (base64Data: string): string => {
    try {
      let urlSafeData = base64Data
        .replace(/-/g, '+') // Convert '-' back to '+'
        .replace(/_/g, '/'); // Convert '_' back to '/'
  
      // Add padding back
      while (urlSafeData.length % 4) {
        urlSafeData += '=';
      }
      const compressed = atob(urlSafeData);
      const charData = compressed.split('').map(x => x.charCodeAt(0));
      const binData = new Uint8Array(charData);
      return pako.inflate(binData, { to: 'string' });
    } catch (e) {
      // If decompression fails, it might be uncompressed data
      return base64Data;
    }
};

export const isValidJson = (str: string) => {
    try {
      JSON.parse(str);
    } catch (e) {
      return false;
    }
    return true;
};
