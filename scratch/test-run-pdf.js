const { PDFParse } = require('pdf-parse');

async function test() {
  try {
    const parser = new PDFParse({ data: Buffer.from([37, 80, 68, 70, 45, 49, 46, 52, 10]) }); // Minimum PDF header '%PDF-1.4\n'
    console.log('Parser instantiated successfully.');
    const textResult = await parser.getText();
    console.log('getText ran successfully:', textResult);
  } catch (err) {
    console.error('Runtime error:', err);
  }
}

test();
