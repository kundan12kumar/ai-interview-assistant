import axios from 'axios';
import * as mammoth from 'mammoth';

// Use serverless function in production, direct API in development
const isDevelopment = import.meta.env.DEV;
const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY;
const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent';

// Parse resume from PDF or DOCX
export const parseResume = async (file) => {
  try {
    // For DOCX files
    if (file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
      const arrayBuffer = await file.arrayBuffer();
      const result = await mammoth.extractRawText({ arrayBuffer });
      const text = result.value;
      
      // Simple extraction logic (can be enhanced)
      const emailMatch = text.match(/[\w.-]+@[\w.-]+\.\w+/);
      const phoneMatch = text.match(/[\d\s()+-]{10,}/);
      const lines = text.split('\n').filter(line => line.trim());
      
      return {
        name: lines[0] || '',
        email: emailMatch ? emailMatch[0] : '',
        phone: phoneMatch ? phoneMatch[0].trim() : ''
      };
    }
    
    // For PDF files - placeholder
    return {
      name: '',
      email: '',
      phone: ''
    };
  } catch (error) {
    console.error('Error parsing resume:', error);
    return { name: '', email: '', phone: '' };
  }
};

// Call Gemini API directly (development only)
const callGeminiAPIDirect = async (prompt) => {
  const response = await axios.post(
    `${GEMINI_API_URL}?key=${GEMINI_API_KEY}`,
    {
      contents: [{
        parts: [{
          text: prompt
        }]
      }]
    },
    {
      headers: {
        'Content-Type': 'application/json'
      }
    }
  );

  return response.data.candidates[0].content.parts[0].text;
};

// Call serverless function (production)
const callGeminiAPIServerless = async (action, params) => {
  const response = await axios.post('/api/gemini', {
    action,
    ...params
  });
  return response.data;
};

// Generate AI questions using Gemini API
export const generateAIQuestion = async (difficulty, questionNumber) => {
  try {
    if (isDevelopment) {
      // Development: Direct API call
      const prompt = `You are an expert technical interviewer for a Full-Stack Developer (React/Node.js) position. 
Generate a ${difficulty} difficulty technical interview question (question ${questionNumber}/6).
The question should test knowledge of React, Node.js, JavaScript, and full-stack development.
Provide only the question text, no additional commentary.`;

      const questionText = await callGeminiAPIDirect(prompt);
      
      const timeLimit = difficulty === 'easy' ? 20 : difficulty === 'medium' ? 60 : 120;
      
      return {
        text: questionText.trim(),
        difficulty,
        timeLimit
      };
    } else {
      // Production: Serverless function
      const response = await callGeminiAPIServerless('generateQuestion', {
        difficulty,
        questionNumber,
        role: 'Full-Stack Developer (React/Node.js)'
      });
      
      return response.question;
    }
  } catch (error) {
    console.error('Error generating question:', error);
    // Fallback questions
    const fallbackQuestions = {
      easy: [
        { text: 'What is the difference between let, const, and var in JavaScript?', timeLimit: 20, difficulty: 'easy' },
        { text: 'Explain the concept of props in React.', timeLimit: 20, difficulty: 'easy' }
      ],
      medium: [
        { text: 'How does the event loop work in Node.js?', timeLimit: 60, difficulty: 'medium' },
        { text: 'Explain React hooks and when to use useState vs useEffect.', timeLimit: 60, difficulty: 'medium' }
      ],
      hard: [
        { text: 'Design a scalable REST API architecture for a social media platform. Discuss authentication, rate limiting, and database design.', timeLimit: 120, difficulty: 'hard' },
        { text: 'Explain how you would optimize a React application that has performance issues. Discuss code splitting, memoization, and bundle optimization.', timeLimit: 120, difficulty: 'hard' }
      ]
    };
    
    const questions = fallbackQuestions[difficulty];
    const index = (questionNumber % questions.length);
    return questions[index];
  }
};

// Evaluate answer using AI
export const evaluateAIAnswer = async (question, answer) => {
  try {
    if (isDevelopment) {
      // Development: Direct API call
      const prompt = `Evaluate this interview answer on a scale of 0-10.
Question: ${question}
Answer: ${answer}

Provide a score in the format "Score: X/10" followed by brief feedback.`;

      const evaluation = await callGeminiAPIDirect(prompt);
      
      // Extract score from response
      const scoreMatch = evaluation.match(/(\d+)\/10/);
      const score = scoreMatch ? parseInt(scoreMatch[1]) : 5;
      
      return score;
    } else {
      // Production: Serverless function
      const response = await callGeminiAPIServerless('evaluateAnswer', {
        question,
        answer
      });
      
      return response.score;
    }
  } catch (error) {
    console.error('Error evaluating answer:', error);
    // Fallback scoring based on answer length
    if (!answer || answer.trim().length < 10) return 2;
    if (answer.trim().length < 50) return 5;
    return 7;
  }
};

// Summarize interview performance
export const summarizeAIInterview = async (transcript) => {
  try {
    if (isDevelopment) {
      // Development: Direct API call
      const prompt = `Summarize this interview performance:
Questions and Answers: ${JSON.stringify(transcript.qa)}
Individual Scores: ${transcript.scores.join(', ')}

Provide:
1. A final score out of 100 (format: "Final Score: XX")
2. A concise 2-3 sentence summary of the candidate's performance, strengths, and areas for improvement.`;

      const summary = await callGeminiAPIDirect(prompt);
      
      // Extract final score and summary
      const scoreMatch = summary.match(/Final Score:\s*(\d+)/i);
      const finalScore = scoreMatch ? parseInt(scoreMatch[1]) : 50;
      const summaryText = summary.replace(/Final Score:.*?\n/i, '').trim();
      
      return { finalScore, summary: summaryText };
    } else {
      // Production: Serverless function
      const response = await callGeminiAPIServerless('summarizeInterview', {
        transcript
      });
      
      return {
        finalScore: response.finalScore,
        summary: response.summary
      };
    }
  } catch (error) {
    console.error('Error summarizing interview:', error);
    
    // Fallback summary
    const avgScore = transcript.scores.reduce((a, b) => a + b, 0) / transcript.scores.length;
    const finalScore = Math.round(avgScore * 10);
    
    let summaryText = '';
    if (finalScore >= 80) {
      summaryText = 'Excellent performance! Strong technical knowledge across all difficulty levels.';
    } else if (finalScore >= 60) {
      summaryText = 'Good performance with solid understanding of core concepts. Some areas for improvement in advanced topics.';
    } else if (finalScore >= 40) {
      summaryText = 'Average performance. Needs improvement in technical depth and problem-solving skills.';
    } else {
      summaryText = 'Below expectations. Significant gaps in fundamental knowledge. Recommend further study and practice.';
    }
    
    return { finalScore, summary: summaryText };
  }
};