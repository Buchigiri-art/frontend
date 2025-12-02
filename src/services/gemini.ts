import { GoogleGenerativeAI } from '@google/generative-ai';
import { Question } from '@/types';

// Add your Gemini API key to .env as VITE_GEMINI_API_KEY
const API_KEY = import.meta.env.VITE_GEMINI_API_KEY;

if (!API_KEY) {
  console.warn('VITE_GEMINI_API_KEY is not set. Please add it to your .env file.');
}

const genAI = API_KEY ? new GoogleGenerativeAI(API_KEY) : null;

export interface GenerateQuestionsParams {
  text: string;
  numQuestions: number;
  type: 'mcq' | 'short-answer' | 'mixed';
  customPrompt?: string;
  difficulty?: 'easy' | 'medium' | 'hard' | 'mixed';
}

export async function generateQuestions(
  params: GenerateQuestionsParams
): Promise<Question[]> {
  if (!genAI) {
    throw new Error(
      'Gemini API key is not configured. Please add VITE_GEMINI_API_KEY to your .env file.'
    );
  }

  const { text, numQuestions, type, customPrompt, difficulty } = params;

  let difficultyInstruction = '';
  if (difficulty && difficulty !== 'mixed') {
    difficultyInstruction = `- Difficulty level: ${difficulty.toUpperCase()} – ensure questions are appropriately challenging for this level`;
  } else if (difficulty === 'mixed') {
    difficultyInstruction = '- Mix difficulty levels across questions (easy, medium, and hard)';
  }

  // 🔒 VERY STRICT CONTENT-ONLY + TEXTBOOK-LIKE OPTIONS + EXACT MULTI-LINE CODE/TABLES
  const basePrompt = `You are an expert educator creating high-quality quiz questions.

ABSOLUTE RULES (MUST follow):
- USE ONLY the information present in the CONTENT below.
- DO NOT use outside knowledge, general world knowledge, or anything not explicitly in CONTENT.
- Every question, every correct answer, and every wrong option MUST be directly grounded in the CONTENT.
- If some topic is not mentioned in CONTENT, you MUST NOT create a question or option about it.

CONTENT (the ONLY source of truth):
"""
${text}
"""

CODE / TABLE / FORMULA HANDLING (VERY IMPORTANT):
- If the CONTENT contains code blocks, configuration snippets, command lines, tables, or formulas, you MUST preserve them exactly when you use them in a question.
- For code:
  - Copy the exact code (same variable names, spacing, structure) from CONTENT.
  - Preserve ALL original line breaks and indentation. Do NOT compress multi-line code into a single line.
  - Wrap code in Markdown fences, for example:

    "question": "Consider the following code snippet:\\n\\n\`\`\`python
def foo(x):
    return x + 1
\`\`\`\\nWhat does this function return when x = 2?"

  - It is allowed to put real newlines inside the JSON string. You do NOT need to escape every newline as \\n; standard JSON strings may contain real newlines.
  - DO NOT paraphrase code like "the following function" or "the given code snippet" if you can show the actual code.
  - DO NOT invent new code or modify existing code that is not exactly in CONTENT.
- For tables:
  - If the CONTENT shows tables (e.g., rows starting with '|' or tabular structures), copy the table text exactly into the question using Markdown table syntax.
  - Do NOT summarize a table in prose when you can embed the table directly.
- For formulas / math:
  - Preserve notation exactly as in CONTENT (e.g., f(x) = ..., Σ, subscripts, superscripts, etc.).
  - If LaTeX-style math is used, keep the same LaTeX syntax.

STYLE REQUIREMENTS:
- The questions and options should feel like they came directly from this CONTENT (textbook/notes style).
- Reuse the same vocabulary, terminology, key phrases, symbols, variable names, and technical language from CONTENT.
- When possible, build options by:
  - quoting short phrases from CONTENT, or
  - making very close paraphrases of sentences from CONTENT.
- DO NOT invent new examples, numbers, functions, case studies, variable names, or stories that are not in CONTENT.
- Wrong options (distractors) must also be plausible based on CONTENT:
  - Use terms, concepts, or phrases that appear in CONTENT.
  - You may mix or slightly twist concepts that are already in CONTENT.
  - Do NOT use generic distractors from outside (e.g., some random library, framework, or topic never mentioned).

TASK:
Based ONLY on the CONTENT above, generate exactly ${numQuestions} quiz questions.

QUESTION REQUIREMENTS:
- Generate exactly ${numQuestions} questions.
- Question type: ${
    type === 'mcq'
      ? 'Multiple Choice Questions (MCQ) with 4 options'
      : type === 'short-answer'
      ? 'Short Answer Questions'
      : 'A mix of MCQ and Short Answer (but still ONLY from CONTENT)'
  }
${difficultyInstruction}
- Each question should test understanding of CONTENT, not general knowledge.
- Do NOT introduce new topics beyond what is in CONTENT.
- Where relevant, embed the exact multi-line code/table/formula snippet from CONTENT in the question text, instead of describing it abstractly.

MCQ-SPECIFIC RULES (if MCQ is used):
- Provide exactly 4 options (A, B, C, D).
- Only one option is correct.
- All options (correct and wrong) must look like they could have been read directly from the CONTENT:
  - Use the same definitions, formulas, notation, code fragments, or terms as in CONTENT.
  - If CONTENT uses a specific wording, prefer to reuse that wording.
- Do not create options like "All of the above", "None of the above" unless such phrasing is explicitly used in CONTENT.

ANSWER & EXPLANATION REQUIREMENTS:
- The correct answer must be justified by specific text from CONTENT.
- In the explanation, briefly explain the answer using ONLY information from CONTENT.
- Do NOT "teach from scratch"; instead, refer back to how the concept is described in CONTENT (same ideas, same words).
- If the question uses a code snippet or table, the explanation should reference that exact snippet (without inventing new code).

${
  customPrompt
    ? `ADDITIONAL INSTRUCTIONS (still must respect CONTENT-only rule):\n${customPrompt}\n`
    : ''
}

VALIDATION RULE (very strict):
- For every question you create, a human should be able to point to one or more specific sentences or parts in CONTENT that justify:
  - the question itself,
  - the correct answer,
  - every option (why it is correct or incorrect),
  - the explanation,
  - and any code/table/formula you show.
- If this is not possible for a question, you MUST NOT include that question.

OUTPUT FORMAT (strict JSON):
- Return ONLY a valid JSON array with this exact structure and no extra text.
- DO NOT wrap the JSON in backticks or code fences.
- It is allowed to have real newlines inside string values (for multi-line code blocks).

Example of the required structure (this is only an example; use real questions from CONTENT):

[
  {
    "id": "q1",
    "type": "${type === 'mcq' ? 'mcq' : type === 'short-answer' ? 'short-answer' : 'mcq'}",
    "question": "Question text here. It may include code or tables from CONTENT, for example:\\n\\n\`\`\`python
def foo(x):
    return x + 1
\`\`\`",
    ${
      type === 'mcq' || type === 'mixed'
        ? '"options": ["Option A", "Option B", "Option C", "Option D"],'
        : ''
    }
    "answer": "${
      type === 'mcq' || type === 'mixed'
        ? 'A'
        : 'Expected answer or key points based ONLY on CONTENT'
    }",
    "explanation": "Brief explanation of the correct answer, using ONLY information from CONTENT."
  }
]

Generate the JSON array now. Remember: valid JSON only, no extra commentary, no code fences around the JSON.`;

  const modelsToTry = ['gemini-2.5-flash'];
  const maxRetries = 3;

  for (const modelName of modelsToTry) {
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        const model = genAI.getGenerativeModel({
          model: modelName,
          systemInstruction:
            'You are an educator that MUST create questions ONLY from the provided CONTENT. ' +
            'You are forbidden from using any outside knowledge not present in CONTENT. ' +
            'All options must reuse vocabulary and phrases from CONTENT and must be clearly grounded in it. ' +
            'When CONTENT contains code/tables/formulas, you must copy them exactly, multi-line and properly indented, into questions instead of paraphrasing.',
        });

        const result = await model.generateContent(basePrompt);
        const response = await result.response;
        let responseText = response.text().trim();

        // Strip ```json or ``` fences if present (just in case model disobeys)
        if (responseText.startsWith('```json')) {
          responseText = responseText.replace(/```json\n?/, '').replace(/\n?```$/, '');
        } else if (responseText.startsWith('```')) {
          responseText = responseText.replace(/```\n?/, '').replace(/\n?```$/, '');
        }

        const questions: Question[] = JSON.parse(responseText);

        return questions.map((q, index) => ({
          ...q,
          id: q.id || `q${index + 1}`,
          isBookmarked: false,
          isSelected: true,
        }));
      } catch (error: any) {
        const message = error?.message || '';
        const isOverload = message.includes('503') || message.includes('overloaded');
        const isRetryable = isOverload || message.includes('temporarily unavailable');

        if (!isRetryable || attempt === maxRetries - 1) {
          console.warn(`Model ${modelName} failed after ${attempt + 1} attempts:`, error);
          break;
        }

        // Exponential-ish backoff
        await new Promise((res) => setTimeout(res, 1000 * (attempt + 1)));
      }
    }
  }

  console.warn('All Gemini models failed. Falling back to demo questions.');
  return generateDemoQuestions(numQuestions, type);
}

// Fallback demo questions for testing without API key
export function generateDemoQuestions(numQuestions: number, type: string): Question[] {
  const demoQuestions: Question[] = [
    {
      id: 'demo1',
      type: 'mcq',
      question: 'What is the primary purpose of React hooks?',
      options: [
        'To style components',
        'To manage state and lifecycle in functional components',
        'To create class components',
        'To handle routing',
      ],
      answer: 'B',
      explanation:
        'React hooks allow functional components to use state and lifecycle features without writing class components.',
      isBookmarked: false,
      isSelected: true,
    },
    {
      id: 'demo2',
      type: 'mcq',
      question: 'Which data structure uses LIFO principle?',
      options: ['Queue', 'Stack', 'Array', 'Tree'],
      answer: 'B',
      explanation:
        'Stack follows Last-In-First-Out (LIFO) principle where the last element added is the first to be removed.',
      isBookmarked: false,
      isSelected: true,
    },
    {
      id: 'demo3',
      type: 'short-answer',
      question: 'Explain the concept of closure in JavaScript.',
      answer:
        "A closure is a function that has access to variables in its outer (enclosing) lexical scope, even after the outer function has returned.",
      explanation:
        "Closures are created when a function is defined inside another function, giving the inner function access to the outer function's variables.",
      isBookmarked: false,
      isSelected: true,
    },
  ];

  return demoQuestions.slice(0, numQuestions);
}
