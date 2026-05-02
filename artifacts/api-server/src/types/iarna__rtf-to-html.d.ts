declare module "@iarna/rtf-to-html" {
  function asStream(
    opts: Record<string, unknown> | null,
    cb: (err: Error | null, html: string) => void
  ): NodeJS.WritableStream;
  function asStream(cb: (err: Error | null, html: string) => void): NodeJS.WritableStream;

  function fromStream(
    stream: NodeJS.ReadableStream,
    opts: Record<string, unknown> | null,
    cb: (err: Error | null, html: string) => void
  ): void;
  function fromStream(
    stream: NodeJS.ReadableStream,
    cb: (err: Error | null, html: string) => void
  ): void;

  function fromString(
    rtf: string,
    opts: Record<string, unknown> | null,
    cb: (err: Error | null, html: string) => void
  ): void;
  function fromString(rtf: string, cb: (err: Error | null, html: string) => void): void;

  export { asStream, fromStream, fromString };
  export default asStream;
}
