import 'jspdf'

declare module 'jspdf' {
  interface jsPDFAPI {
    addFileToVFS(filename: string, filecontent: string): void
    addFont(
      postScriptName: string,
      fontName: string,
      fontStyle: string
    ): void
  }
}
