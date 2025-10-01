// Serverless function for Vercel/Netlify
// This keeps your API key secure on the server side

export default async function handler(req, res) {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { action, difficulty, questionNumber, role, question, answer, transcript } = req.body;
  const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

  if (!GEMINI_API_KEY) {
    return res.status(500).json({ error: 'API key not configured' });
  }

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [{
            parts: [{
              text: generatePrompt(action, { difficulty, questionNumber, role, question, answer, transcript })
            }]
          }]
        })
      }
    );

    const data = await response.json();
    const text = data.candidates[0].content.parts[0].text;

    // Parse response based on action
    if (action === 'generateQuestion') {
      const timeLimit = difficulty === 'easy' ? 20 : difficulty === 'medium' ? 60 : 120;
      return res.status(200).json({
        question: {
          text: text.trim(),
          difficulty,
          timeLimit
        }
      });
    }

    if (action === 'evaluateAnswer') {
      // Extract score from response (assuming format "Score: X/10")
      const scoreMatch = text.match(/(\d+)\/10/);
      const score = scoreMatch ? parseInt(scoreMatch[1]) : 5;
      return res.status(200).json({ score });
    }

    if (action === 'summarizeInterview') {
      // Extract final score and summary
      const scoreMatch = text.match(/Final Score:\s*(\d+)/i);
      const finalScore = scoreMatch ? parseInt(scoreMatch[1]) : 50;
      const summary = text.replace(/Final Score:.*?\n/i, '').trim();
      return res.status(200).json({ finalScore, summary });
    }

    return res.status(400).json({ error: 'Invalid action' });

  } catch (error) {
    console.error('Gemini API Error:', error);
    return res.status(500).json({ error: 'Failed to process request' });
  }
}

function generatePrompt(action, params) {
  if (action === 'generateQuestion') {
    return `You are an expert technical interviewer for a ${params.role} position. 
Generate a ${params.difficulty} difficulty technical interview question (question ${params.questionNumber}/6).
The question should test knowledge of React, Node.js, JavaScript, and full-stack development.
Provide only the question text, no additional commentary.`;
  }

  if (action === 'evaluateAnswer') {
    return `Evaluate this interview answer on a scale of 0-10.
Question: ${params.question}
Answer: ${params.answer}

Provide a score in the format "Score: X/10" followed by brief feedback.`;
  }

  if (action === 'summarizeInterview') {
    return `Summarize this interview performance:
Questions and Answers: ${JSON.stringify(params.transcript.qa)}
Individual Scores: ${params.transcript.scores.join(', ')}

Provide:
1. A final score out of 100 (format: "Final Score: XX")
2. A concise 2-3 sentence summary of the candidate's performance, strengths, and areas for improvement.`;
  }

  return '';
}