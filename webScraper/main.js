const { Builder, Browser, By, Key, until } = require("selenium-webdriver");
const { elementTextIs } = require("selenium-webdriver/lib/until");
const { WebElement } = require("selenium-webdriver/lib/webdriver");
const tesseract = require("node-tesseract-ocr");
const axios = require("axios");
const fs = require("fs");
const blobUtil = require("blob-util");

const startQuestionNumer = 1;
const userAgent = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/103.0.0.0 Safari/537.36";
const outputFile = "output.json";
const BUNDESLAND = "Bayern";
const tempImageName = "tempImage.png";
const url = "http://oet.bamf.de/pls/oetut/f?p=534:1:5395315446155";
const urlObject = new URL(url);

let quizObject = [
  {
    question: "Was ist die Hauptstadt von Deutschland?",
    possibleAnswers: [{isCorrect: true, text: "Berlin"},{isCorrect: false, text: "Gera"},{isCorrect: false, text: "Hof"}],
    correctAnswer: "Berlin",
    id: 1
  },
];
quizObject = [];



let delay = async (timeoutInMilliseconds) => {
  return new Promise((resolve, reject) => {
    setTimeout(resolve, timeoutInMilliseconds);
  });
};

async function runScraper() {
  let driver = await new Builder().forBrowser(Browser.CHROME).build();


  function writeToFile(file, content) {
    try {
      fs.writeFileSync(file, content);
      return true;
    } catch (err) {
      console.error(err);
      return false;
    }
  }


  async function navigateToFirstQuestion() {
    //Select "Bayern" in List
    await driver.executeScript((BUNDESLAND) => {
      let federalStateSelect = document.getElementById("P1_BUL_ID");
      let options = federalStateSelect.options;
      for (const option of options) {
        if ((option.innerText = BUNDESLAND)) {
          option.selected = true;
          return true;
        }
      }
    }, BUNDESLAND);

    //Submit
    await driver.executeScript(() => {
      let button = document.querySelector("input[value='Zum Fragenkatalog']");
      button.click();
    });
  }

  async function getProgress() {
    return await driver.executeScript(async () => {
      //Check by number

      let aufgabeText = await document.querySelector(".RegionHeader")
        ?.innerText;
      if (!aufgabeText) {
        console.error("Progress text not found");
        return false;
      }
      let matches = String(aufgabeText).match(
        /Aufgabe (?<current>\d{1,}) von (?<end>\d{1,})/
      );
      if (!matches) {
        console.error("String for progress doesn't match");
        return false;
      }
      let current = parseInt(matches.groups.current);
      let end = parseInt(matches.groups.end);
      return { current, end, matches };
    });
  }

  async function getQuestionData() {
    return await driver.executeScript(() => {
      let questionData = {};
      //select Source from Question-Image
      let questionSrc = document
        .querySelector("#P30_AUFGABENSTELLUNG_BILD img")
        ?.getAttribute("src");

      questionData.questionSrc = questionSrc;
      //status, checkbox, answerText
      // let possibleAnswers = document.querySelector("td[headers*='CHECKBOX' input] span")
      let answersList = [];
      let possibleAnswersTableRows = document.querySelectorAll(
        "table.t3borderless tbody tr"
      );
      for (const tr of possibleAnswersTableRows) {
        let isCorrect =
          tr.querySelector("td[headers='RICHTIGE_ANTWORT'] span").style.color ==
          "green";
        let text = tr.querySelector("td[headers='ANTWORT']").innerText;
        answersList.push({ text, isCorrect });
      }

      questionData.answersList = answersList;

      return questionData;
    });
  }

  async function checkIfQuestion() {
    let progress = await getProgress();
    if (!progress) return false;
    if (progress.current <= progress.end) return true;
    return false;
  }

  async function getTextFromImage(url, config = { lang: "deu" }) {
    console.log({ url });
    return new Promise(async (resolve, reject) => {
      try {
        if (!(await downloadImage(url))) resolve(false);

        const text = await tesseract.recognize(tempImageName, config);
        //deleteFile
        deleteTempImage();
        resolve(text);
      } catch (error) {
        console.log(error.message);
        resolve(false);
      }
    });
  }

  function deleteTempImage() {
    if (fs.existsSync(tempImageName)) fs.unlinkSync(tempImageName);
  }

  async function getCookie(cookieName) {
    console.log(cookieName);
    return new Promise(async (resolve, reject) => {
      let cookie = await driver.executeScript(function (cookieName) {
        function getCookie(name) {
          // Split cookie string and get all individual name=value pairs in an array
          var cookieArr = document.cookie.split(";");

          // Loop through the array elements
          for (var i = 0; i < cookieArr.length; i++) {
            var cookiePair = cookieArr[i].split("=");

            /* Removing whitespace at the beginning of the cookie name
              and compare it with the given string */
            if (name == cookiePair[0].trim()) {
              // Decode the cookie value and return
              return decodeURIComponent(cookiePair[1]);
            }
          }

          // Return null if not found
          return null;
        }
        let cookie = getCookie(cookieName);
        return cookie;
      }, cookieName);
      resolve(cookie);
    });
  }

  async function downloadImage(url) {
    return new Promise(async (resolve, reject) => {
      try {
        deleteTempImage();
        let response = await axios.get(url, {
          responseType: "stream",
          headers: {
            "User-Agent":
              userAgent,
            Accept: `image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8`,
            "Accept-Encoding": "gzip, deflate",
            "Accept-Language":
              "de-DE,de;q=0.9,en;q=0.8,en-US;q=0.7,fr;q=0.6,eu;q=0.5",
            "Cache-Control": "no-cache",
            Connection: "keep-alive",
            Host: "oet.bamf.de",
            Pragma: "no-cache",
            Referer: `http://oet.bamf.de/pls/oetut/f?p=534:30:0::NO:::`,
            Cookie: `AODSESSION=${await getCookie("AODSESSION")}`,
          },
        });

        console.log(`Successfully downloaded image: ${response}`);

        await response.data
          .pipe(fs.createWriteStream(tempImageName))
          .on("finish", () => resolve(true))
          .on("error", (e) => {
            console.error(e);
            resolve(false);
          });
      } catch (error) {
        console.error(`Image downloaded failed: ${error}`);
        resolve(false);
      }
    });
  }

  async function gotoNextQuestion() {
    return await driver.executeScript(() => {
      let nextQuestionBtn = document.querySelector("input[type='Button'][name='GET_NEXT_ID']");
      if (!nextQuestionBtn) return false;
      nextQuestionBtn.click();
      return true;
    });
  }

  async function selectTaskNumber(number) {
    return await driver.executeScript((number) => {
      let questionSelect = document.querySelector("#P30_ROWNUM");
      if (!questionSelect) return false;
      let options = questionSelect.options;

      for(const current of options) {
        let value = current.getAttribute("value");
        let questionNumber = parseInt(current.innerText);
        
        if (questionNumber == number) {
           current.selected = true;
           questionSelect.onchange();
        }
      }
      return true;
    }, number);
  }

  try {
    //open site
    await driver.get(url);
    await navigateToFirstQuestion();
    let quizData = [];
    //check if loading was successfull
    if (await checkIfQuestion()) {
      let tastSelected = await selectTaskNumber(startQuestionNumer);
      console.log({questionSelected: tastSelected});
      if (!tastSelected) {
        console.log("Question could not be selected");
        return false;
      }
    }


    while (await checkIfQuestion()) {
      let questionData = await getQuestionData();
      let progress = await getProgress();
      questionData.id = progress.current;
      questionData.questionImgURLFULL = `http://${urlObject.hostname}/pls/oetut/${questionData.questionSrc}`;
      let question = await getTextFromImage(
        questionData.questionImgURLFULL
      );
      questionData.question = question;
      console.log(questionData);
      quizData.push(questionData);

      if (!await gotoNextQuestion()) {
        //End of questions or error
        break;
      }
    }
    if (writeToFile(outputFile, JSON.stringify(quizData, null, 2))) {
      console.log(`Success: Result was printed into ${outputFile}`);
    } else {
      console.log(`Error while writing to ${outputFile}. Here is the result instead: ${quizData}`)
    }


  } finally {
    // await delay(5000)
    await driver.quit();
  }
}
runScraper();
