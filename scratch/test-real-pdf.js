const { PDFParse } = require('pdf-parse');
const fs = require('fs');
const path = require('path');

async function test() {
  try {
    const pdfPath = 'C:\\Users\\calvi\\Downloads\\Calvin OktavialdySetia - CV.pdf';
    if (!fs.existsSync(pdfPath)) {
      console.error('File does not exist:', pdfPath);
      return;
    }
    console.log('Reading file...');
    const buffer = fs.readFileSync(pdfPath);
    console.log('Instantiating parser...');
    const parser = new PDFParse({ data: buffer });
    console.log('Parsing text...');
    const textResult = await parser.getText();
    console.log('Successfully parsed PDF text!');
    console.log('Text preview:', textResult.text.substring(0, 300));
  } catch (err) {
    console.error('Runtime error:', err);
  }
}

test();
