const fileInput = document.querySelector("#fileInput");
const startConvertBtn = document.querySelector("#convert");
const outputElement = document.querySelector("#result");

const toggleShowCorrectCheckbox = document.querySelector("#toogleShowCorrect");
toggleShowCorrectCheckbox.addEventListener(
  "click",
  () => toggleShowCorrect(toggleShowCorrectCheckbox.checked)
);

startConvertBtn.addEventListener("click", handleFileInput);

function toggleShowCorrect(showCorrect) {
  if (showCorrect) {
    outputElement.classList.add("showCorrect");
  } else {
    outputElement.classList.remove("showCorrect");
  }
}

async function readFileFromInput(fileObject) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      resolve(reader.result);
    };
    // reader.onerror(e => reject(e));
    reader.readAsText(fileObject);
  });
}

async function handleFileInput() {
  let file = fileInput.files[0];
  let JSON_Object = JSON.parse(await readFileFromInput(file));

  console.log(JSON_Object);


  outputElement.innerHTML = ``;
  for (const current of JSON_Object) {
    let questionItem = document.createElement("section");
    questionItem.innerHTML = 
    `
      <b><h4 class="questionID">${current.id}</span><span>. </span><a class="question" href="${current.questionImgURLFULL}">${current.question}</a></h4></b>
 

    <ol class="answersList">
      
    </ol>
    `

    let answersList = questionItem.querySelector(".answersList");

    for (const currentQuestion of current.answersList) {
        let li = document.createElement("li");

        li.innerText = currentQuestion.text;
        if (currentQuestion.isCorrect) li.classList.add("correct");
        answersList.appendChild(li);
    }
    outputElement.appendChild(questionItem);

  }
}
