const { PDFParse } = require('pdf-parse');
const path = require('path');
const { pathToFileURL } = require('url');

try {
  const pdfParseEntry = require.resolve('pdf-parse');
  const workerPath = require.resolve('pdfjs-dist/legacy/build/pdf.worker.mjs', {
    paths: [ path.dirname(pdfParseEntry), pdfParseEntry ]
  });
  const workerUrl = pathToFileURL(workerPath).toString();
  console.log('workerUrl:', workerUrl);
  
  PDFParse.setWorker(workerUrl);
  console.log('Worker set successfully via PDFParse.setWorker!');
  
  // Try parsing
  const parser = new PDFParse({ data: Buffer.from([37, 80, 68, 70, 45, 49, 46, 52, 10]) });
  console.log('Parser instantiated.');
} catch (e) {
  console.error('Error:', e);
}
