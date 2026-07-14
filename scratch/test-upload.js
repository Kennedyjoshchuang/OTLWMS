const fs = require('fs');

async function uploadPdf() {
  const pdfPath = 'C:\\Users\\calvi\\Downloads\\Calvin OktavialdySetia - CV.pdf';
  if (!fs.existsSync(pdfPath)) {
    console.error('File does not exist:', pdfPath);
    return;
  }
  
  const buffer = fs.readFileSync(pdfPath);
  const blob = new Blob([buffer], { type: 'application/pdf' });
  const formData = new FormData();
  formData.append('file', blob, 'Calvin OktavialdySetia - CV.pdf');

  try {
    console.log('Sending POST request to http://localhost:3000/api/delivery-tickets/parse-pdf ...');
    const res = await fetch('http://localhost:3000/api/delivery-tickets/parse-pdf', {
      method: 'POST',
      body: formData
    });
    
    console.log('Status:', res.status, res.statusText);
    const bodyText = await res.text();
    console.log('Response body:', bodyText);
  } catch (error) {
    console.error('Fetch error:', error);
  }
}

uploadPdf();
