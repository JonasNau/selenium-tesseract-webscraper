const tesseract = require("node-tesseract-ocr")

const config = {
  lang: "eng", // default
}

async function main() {
  try {
    const text = await tesseract.recognize("img.png", config)
    console.log("Result:", text)
  } catch (error) {
    console.log(error.message)
  }
}

main()