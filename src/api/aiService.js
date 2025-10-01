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
        phone: phoneMatch ? phoneMatch[0].trim() : '',
        fullText: text // Return full resume text for context
      };
    }
    
    // For PDF files - placeholder
    return {
      name: '',
      email: '',
      phone: '',
      fullText: ''
    };
  } catch (error) {
    console.error('Error parsing resume:', error);
    return { name: '', email: '', phone: '', fullText: '' };
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
export const generateAIQuestion = async (difficulty, questionNumber, resumeContext = '', jobRole = 'Full-Stack Developer') => {
  try {
    if (isDevelopment) {
      // Development: Direct API call with resume context
      const randomSeed = `${Date.now()}-${Math.random()}-${questionNumber}-${difficulty}`;
      
      let prompt = `You are an expert technical interviewer for a ${jobRole} position.

IMPORTANT INSTRUCTIONS:
- This is question ${questionNumber} of 6
- Difficulty level: ${difficulty}
- Generate a COMPLETELY UNIQUE question (Random ID: ${randomSeed})
- DO NOT repeat common interview questions
- Make questions specific to the job role: ${jobRole}

`;

      // Add resume context if available
      if (resumeContext && resumeContext.length > 50) {
        const resumeSummary = resumeContext.substring(0, 1200);
        prompt += `CANDIDATE'S RESUME/BACKGROUND:
${resumeSummary}

TASK: Analyze the candidate's:
1. Skills and technologies mentioned
2. Projects and experience
3. Education and background
4. Relate the question to their specific experience

`;
      }

      prompt += `Generate a ${difficulty} difficulty question for ${jobRole} role that:

FOR TECHNICAL ROLES (Software, ML, Data Science, etc.):
- Tests practical problem-solving for ${jobRole}
- Relates to technologies/projects in their resume (if provided)
- Asks about real-world scenarios they might face
- Avoids generic "what is X?" questions

FOR NON-TECHNICAL ROLES (Product, Marketing, Business, etc.):
- Tests strategic thinking and domain knowledge
- Relates to their previous experience
- Asks about situational scenarios
- Tests analytical and communication skills

REQUIREMENTS:
- Be specific to ${jobRole} field
- Make it conversational and scenario-based
- Test understanding, not memorization
- Generate something DIFFERENT from typical interview questions

Provide ONLY the question text, nothing else.`;

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
        role: jobRole,
        resumeContext: resumeContext ? resumeContext.substring(0, 1200) : '',
        randomSeed: `${Date.now()}-${Math.random()}`
      });
      
      return response.question;
    }
  } catch (error) {
    console.error('Error generating question:', error);
    // Enhanced fallback questions for different roles
    const fallbackQuestions = {
      easy: [
        { text: `What are the key responsibilities in a ${jobRole} role? How would you prioritize them?`, timeLimit: 20, difficulty: 'easy' },
        { text: `Describe your understanding of the ${jobRole} field and current industry trends.`, timeLimit: 20, difficulty: 'easy' },
        { text: `What tools and technologies are essential for a ${jobRole}? Why?`, timeLimit: 20, difficulty: 'easy' },
        { text: `How do you stay updated with developments in ${jobRole}?`, timeLimit: 20, difficulty: 'easy' }
      ],
      medium: [
        { text: `Describe a challenging project related to ${jobRole}. How did you approach it?`, timeLimit: 60, difficulty: 'medium' },
        { text: `How would you handle conflicting priorities in a ${jobRole} position?`, timeLimit: 60, difficulty: 'medium' },
        { text: `Explain your problem-solving process when facing a ${jobRole} challenge.`, timeLimit: 60, difficulty: 'medium' },
        { text: `What metrics would you use to measure success in a ${jobRole} role?`, timeLimit: 60, difficulty: 'medium' }
      ],
      hard: [
        { text: `Design a comprehensive strategy for ${jobRole} in a startup environment. Consider scalability, resources, and constraints.`, timeLimit: 120, difficulty: 'hard' },
        { text: `You're leading a ${jobRole} initiative that's failing. Walk me through your recovery strategy.`, timeLimit: 120, difficulty: 'hard' },
        { text: `How would you build and scale a ${jobRole} function from scratch in a growing company?`, timeLimit: 120, difficulty: 'hard' },
        { text: `Critique current industry practices in ${jobRole}. What would you change and why?`, timeLimit: 120, difficulty: 'hard' }
      ]
    };
    
    const questions = fallbackQuestions[difficulty];
    const randomIndex = Math.floor(Math.random() * questions.length);
    return questions[randomIndex];
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