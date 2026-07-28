const { createWorker } = require("tesseract.js");

async function testTesseract() {
  console.log("Testing Tesseract worker initialization...");
  try {
    const worker = await createWorker('eng');
    console.log("Tesseract worker created successfully.");
    await worker.terminate();
  } catch (err) {
    console.error("Tesseract error:", err);
  }
}

testTesseract();
