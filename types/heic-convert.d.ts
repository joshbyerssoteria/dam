declare module "heic-convert" {
  interface ConvertOptions {
    buffer: Buffer;
    format: "JPEG" | "PNG";
    /** 0–1, JPEG only. */
    quality?: number;
  }
  function convert(options: ConvertOptions): Promise<ArrayBuffer>;
  export default convert;
}
