// ---------- LOAD QUESTIONS ----------

let questions = [];
let quizQuestions = [];
const usedIndexes = new Set();
let skippedQuestions = new Set();
let maxQuestions = 50;

async function loadJSON() {
  try {
    const [questionsRes, settingsRes] = await Promise.all([
      fetch("./data/questions.json"),
      fetch("./other/settings.json"),
    ]);

    if (!questionsRes.ok) {
      throw new Error(`Questions fetch failed: ${questionsRes.status}`);
    }
    if (!settingsRes.ok) {
      throw new Error(`Settings fetch failed: ${settingsRes.status}`);
    }

    const [questionsData, settingsData] = await Promise.all([
      questionsRes.json(),
      settingsRes.json(),
    ]);

    questions = questionsData.questions;
    maxQuestions = settingsData.settings.max_questions;

    initializeQuiz();
  } catch (error) {
    console.error("Error loading JSON files:", error);
  }
}

// ---------- PREPARE QUIZ ----------

function getQuestions(questionAmount) {
  while (
    quizQuestions.length < questionAmount &&
    usedIndexes.size < questions.length
  ) {
    const randIndex = Math.floor(Math.random() * questions.length);
    if (!usedIndexes.has(randIndex)) {
      usedIndexes.add(randIndex);
      quizQuestions.push(questions[randIndex]);
    }
  }
}

// ---------- DOM ELEMENTS ----------

let currentQuestionIndex = 0;
let skippedCount = 0;
let answers = [];

const elements = {
  qNum: null,
  qText: null,
  opts: null,
  prevBtn: null,
  nextBtn: null,
  skipBtn: null,
  results: null,
  score: null,
  feedback: null,
};

// ---------- INIT QUIZ ----------

function initializeQuiz() {
  elements.qNum = document.getElementById("question-number");
  elements.qText = document.getElementById("question-text");
  elements.opts = document.getElementById("options");
  elements.prevBtn = document.getElementById("prev-btn");
  elements.nextBtn = document.getElementById("next-btn");
  elements.skipBtn = document.getElementById("skip-btn");
  elements.results = document.getElementById("results");
  elements.score = document.getElementById("score");
  elements.feedback = document.getElementById("feedback");

  const missingElements = Object.entries(elements)
    .filter(([key, element]) => !element)
    .map(([key]) => key);

  if (missingElements.length > 0) {
    console.error("Missing required HTML elements:", missingElements);
    return;
  }

  getQuestions(Math.min(maxQuestions, questions.length));
  answers = Array(quizQuestions.length).fill(null);

  setupEventListeners();

  renderQuestion();
}

// ---------- EVENT LISTENERS ----------

function setupEventListeners() {
  elements.prevBtn.addEventListener("click", () => {
    if (currentQuestionIndex > 0) {
      currentQuestionIndex--;
      elements.feedback.textContent = "";
      renderQuestion();
    }
  });

  elements.nextBtn.addEventListener("click", () => {
    if (currentQuestionIndex < quizQuestions.length - 1) {
      currentQuestionIndex++;
      elements.feedback.textContent = "";
      renderQuestion();
    } else {
      showResults();
    }
  });

  elements.skipBtn.addEventListener("click", () => {
    skippedQuestions.add(currentQuestionIndex);
    skippedCount = skippedQuestions.size;
    if (currentQuestionIndex < quizQuestions.length - 1) {
      currentQuestionIndex++;
      elements.feedback.textContent = "";
      renderQuestion();
      updateCounters();
    }
  });
}

// ---------- RENDERING ----------

function renderQuestion() {
  const q = quizQuestions[currentQuestionIndex];

  elements.qNum.textContent = `Question ${currentQuestionIndex + 1} of ${quizQuestions.length}`;
  elements.qText.textContent = q.text;

  elements.opts.innerHTML = "";

  q.options.forEach((opt, i) => {
    const label = document.createElement("label");
    label.className = "option";

    const input = document.createElement("input");
    input.type = "radio";
    input.name = "option";
    input.value = i;
    if (answers[currentQuestionIndex] === i) input.checked = true;

    input.addEventListener("change", () => {
      answers[currentQuestionIndex] = i;

      if (skippedQuestions.has(currentQuestionIndex)) {
        skippedQuestions.delete(currentQuestionIndex);
        skippedCount = skippedQuestions.size;
      }

      updateCounters();
      updateNextButtonState();
    });

    label.appendChild(input);
    label.appendChild(document.createTextNode(opt));
    elements.opts.appendChild(label);
  });

  elements.prevBtn.disabled = currentQuestionIndex === 0;
  elements.skipBtn.disabled = currentQuestionIndex === quizQuestions.length - 1;
  elements.nextBtn.textContent =
    currentQuestionIndex === quizQuestions.length - 1 ? "Submit" : "Next";

  updateNextButtonState();
}

function updateNextButtonState() {
  elements.nextBtn.disabled = answers[currentQuestionIndex] === null;
}


// ---------- RESULTS ----------

function updateCounters() {
  let correctCount = 0;
  let incorrectCount = 0;

  answers.forEach((ans, i) => {
    if (ans !== null) {
      if (ans === quizQuestions[i].correct) correctCount++;
      else incorrectCount++;
    }
  });

  document.getElementById("correct-count").textContent = correctCount;
  document.getElementById("incorrect-count").textContent = incorrectCount;
  document.getElementById("skipped-count").textContent = skippedCount;
}

function showResults() {
  [elements.prevBtn, elements.nextBtn, elements.skipBtn].forEach(
    (btn) => (btn.disabled = true)
  );

  elements.opts.querySelectorAll("input[type='radio']").forEach(
    (input) => (input.disabled = true)
  );
  elements.opts.querySelectorAll("label.option").forEach((label) => {
    label.classList.add("disabled");
    const input = label.querySelector("input");
    if (input) input.disabled = true;
  });

  elements.results.classList.remove("hidden");

  const total = quizQuestions.length;
  const correctCount = quizQuestions.reduce(
    (count, q, i) => count + (answers[i] === q.correct ? 1 : 0),
    0
  );
  const percentage = Math.round((correctCount / total) * 100);

  elements.score.innerHTML = `
    <div style="font-size: 1.2em; margin-bottom: 10px;">
      You got <strong>${correctCount}</strong> out of <strong>${total}</strong> correct (${percentage}%).
    </div>
  `;

  elements.feedback.innerHTML = quizQuestions
    .map((q, i) => {
      const isCorrect = answers[i] === q.correct;
      const isSkipped = answers[i] === null && skippedQuestions.has(i);
      const userAnswer = answers[i] !== null ? q.options[answers[i]] : "No answer";
      const correctAnswer = q.options[q.correct];

      let colors = {
        border: "gray",
        bg: "#fff",
        answer: "black",
      };

      if (isCorrect) {
        colors = { border: "green", bg: "#f0f8f0", answer: "green" };
      } else if (isSkipped) {
        colors = { border: "goldenrod", bg: "#fffbe0", answer: "orange" };
      } else {
        colors = { border: "red", bg: "#fff0f0", answer: "red" };
      }

      return `
        <div style="margin-bottom: 15px; padding: 10px; border-left: 4px solid ${colors.border}; background: ${colors.bg};">
          <div style="color: ${colors.border}; font-weight: bold; margin-bottom: 5px;">
            Q${i + 1}: ${q.text}
          </div>
          <div style="font-size: 0.9em;">
            <div style="color: ${colors.answer};">Your answer: ${userAnswer}</div>
            ${
              !isCorrect && !isSkipped
                ? `<div style="color: green;">Correct answer: ${correctAnswer}</div>`
                : ""
            }
            ${
              q.note
                ? `<div style="color: #666; font-style: italic; margin-top: 5px;">Note: ${q.note}</div>`
                : ""
            }
          </div>
        </div>
      `;
    })
    .join("");
}

// ---------- INIT ----------

loadJSON();