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
export const generateAIQuestion = async (difficulty, questionNumber, resumeContext = '', jobRole = 'Full-Stack Developer', companyName = '') => {
  try {
    if (isDevelopment) {
      // Development: Direct API call with resume context
      const randomSeed = `${Date.now()}-${Math.random()}-${questionNumber}-${difficulty}`;
      
      let prompt = `You are an expert technical interviewer for a ${jobRole} position${companyName ? ` at ${companyName}` : ''}.

CRITICAL INSTRUCTIONS:
- This is question ${questionNumber} of 6
- Difficulty level: ${difficulty}
- Generate a COMPLETELY UNIQUE technical question (Random ID: ${randomSeed})
- DO NOT ask basic definition questions
- Make questions HIGHLY TECHNICAL and hands-on

`;

      // Add company context if available
      if (companyName) {
        prompt += `COMPANY CONTEXT: ${companyName}
Research and incorporate ${companyName}'s:
- Technology stack and products
- Engineering challenges
- Industry domain
- Scale and infrastructure needs

`;
      }

      // Add resume context if available
      if (resumeContext && resumeContext.length > 50) {
        const resumeSummary = resumeContext.substring(0, 1200);
        prompt += `CANDIDATE'S RESUME/BACKGROUND:
${resumeSummary}

TASK: Analyze their skills, technologies, and projects.

`;
      }

      prompt += `Generate a ${difficulty} difficulty TECHNICAL question for ${jobRole}:

FOR SOFTWARE/TECHNICAL ROLES - MANDATORY REQUIREMENTS:
${difficulty === 'easy' ? `
EASY questions MUST:
- Ask to write/implement actual code or pseudocode
- Focus on hands-on debugging scenarios
- Test implementation knowledge, not definitions
- Example formats:
  * "Implement a function that..."
  * "Debug this code..."
  * "Write a solution for..."
  * "How would you code..."

FORBIDDEN for EASY:
- "What is...?" questions
- "Explain the difference..." questions  
- Pure theory questions
` : ''}

${difficulty === 'medium' ? `
MEDIUM questions MUST:
- Require system/architecture design at component level
- Test optimization and trade-off analysis
- Involve real-world constraints (scale, performance, cost)
- Example formats:
  * "Design a system for..."
  * "Optimize this scenario..."
  * "Compare approaches for... (with specific scenarios)"
  * "Implement X considering Y constraints..."

FORBIDDEN for MEDIUM:
- Generic "how does X work?" questions
- Questions without specific scenarios
- Pure conceptual questions
` : ''}

${difficulty === 'hard' ? `
HARD questions MUST:
- Require large-scale distributed system design
- Test deep technical decision-making
- Include numbers: QPS, latency, data volume
- Require discussing CAP theorem, consistency, availability
- Example formats:
  * "Design a system handling X requests/second..."
  * "Architect a distributed Y with Z constraints..."
  * "Build a scalable solution for... (with specific metrics)"
  * "Design for 1M+ users/10GB+ data/etc..."

FORBIDDEN for HARD:
- Questions without scale metrics
- Generic architecture questions
- Questions that don't require distributed thinking
` : ''}

FOR DATA/ML ROLES:
- Ask about implementing algorithms from scratch
- Require discussing specific models and math
- Test practical ML pipeline design with metrics
- Include data preprocessing and feature engineering

FOR DEVOPS/CLOUD ROLES:
- Ask about infrastructure as code implementation
- Test CI/CD pipeline design with specific tools
- Require discussing monitoring, costs, security
- Include disaster recovery and scaling

CRITICAL RULES:
1. NEVER ask "What is...?" or "Explain..." questions
2. ALWAYS make it hands-on: "Implement", "Design", "Build", "Debug"
3. ALWAYS include specific scenarios or constraints
4. BE EXTREMELY TECHNICAL - test actual job skills
${companyName ? `5. Reference ${companyName}'s scale/challenges when relevant` : ''}

Provide ONLY the highly technical question, nothing else.`;

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
        companyName: companyName || '',
        randomSeed: `${Date.now()}-${Math.random()}`
      });
      
      return response.question;
    }
  } catch (error) {
    console.error('Error generating question:', error);
    // Enhanced technical fallback questions
    const technicalFallbacks = {
      'Full-Stack Developer': {
        easy: [
          { text: 'Write a JavaScript function to implement deep cloning of an object without using JSON.parse/stringify. Handle circular references.', timeLimit: 20 },
          { text: 'Implement a React custom hook for debouncing user input. Explain when the debounced value updates.', timeLimit: 20 },
          { text: 'Debug this: A React component updates infinitely. useEffect(() => { setState(data) }, [data]). Fix it and explain why.', timeLimit: 20 },
          { text: 'Write code to implement Promise.all() from scratch using Promise constructor. Handle rejections properly.', timeLimit: 20 }
        ],
        medium: [
          { text: 'Design a rate limiting middleware for Express.js handling 1000 req/sec per user. Discuss Redis vs in-memory approaches.', timeLimit: 60 },
          { text: 'Implement an LRU cache in JavaScript with O(1) get/put operations. Explain the data structures used.', timeLimit: 60 },
          { text: 'Design a WebSocket connection manager that handles 10K concurrent connections. Discuss reconnection, heartbeat, and load balancing.', timeLimit: 60 },
          { text: 'Optimize a React app rendering a 10K row table. Discuss virtualization, windowing, and memo strategies with code examples.', timeLimit: 60 }
        ],
        hard: [
          { text: 'Design a URL shortener handling 100M URLs and 10M requests/day. Discuss hashing, database sharding, cache strategy, and collision handling.', timeLimit: 120 },
          { text: 'Architect a real-time collaborative document editor (like Google Docs). Discuss CRDT/OT algorithms, conflict resolution, and WebSocket architecture.', timeLimit: 120 },
          { text: 'Design a distributed session store for 1M active users across 100 servers. Discuss consistency, failover, and session replication strategies.', timeLimit: 120 },
          { text: 'Build a CDN architecture for serving static assets globally with <100ms latency. Discuss edge caching, origin servers, and cache invalidation.', timeLimit: 120 }
        ]
      },
      'Machine Learning Engineer': {
        easy: [
          { text: 'Implement gradient descent for linear regression from scratch in Python. Explain learning rate impact on convergence.', timeLimit: 20 },
          { text: 'Write code to handle imbalanced datasets (1:100 ratio). Compare oversampling, undersampling, and SMOTE approaches.', timeLimit: 20 },
          { text: 'Debug this: Model has 95% train accuracy but 60% val accuracy. Diagnose the problem and suggest 3 solutions with reasoning.', timeLimit: 20 }
        ],
        medium: [
          { text: 'Design an ML pipeline for real-time fraud detection processing 1000 transactions/sec. Discuss feature engineering, model serving, and monitoring.', timeLimit: 60 },
          { text: 'Implement custom loss function for multi-label classification with label imbalance. Explain why cross-entropy alone fails here.', timeLimit: 60 },
          { text: 'Design an A/B test for a new ML model. Discuss sample size, statistical significance (alpha=0.05), and guardrail metrics.', timeLimit: 60 }
        ],
        hard: [
          { text: 'Architect a recommendation system for 100M users with 10M items. Discuss collaborative filtering, matrix factorization, cold start, and real-time updates.', timeLimit: 120 },
          { text: 'Design distributed training for a 10B parameter model across 100 GPUs. Discuss data parallelism, model parallelism, and gradient synchronization.', timeLimit: 120 },
          { text: 'Build an ML monitoring system detecting model drift, data drift, and performance degradation. Discuss metrics, alerting thresholds, and retraining triggers.', timeLimit: 120 }
        ]
      },
      'Data Scientist': {
        easy: [
          { text: 'Write SQL to find users who made purchases in consecutive months. Optimize for a 100M row table.', timeLimit: 20 },
          { text: 'Implement statistical hypothesis testing in Python for A/B test with 10K users per variant. Calculate p-value and confidence interval.', timeLimit: 20 },
          { text: 'Debug this analysis: Revenue increased 20% but profit decreased. What metrics would you investigate? Write SQL queries.', timeLimit: 20 }
        ],
        medium: [
          { text: 'Design an A/B testing framework for 100 experiments/month. Discuss multiple testing correction (Bonferroni vs FDR), sample size calculation, and p-hacking prevention.', timeLimit: 60 },
          { text: 'Analyze this: Conversion rate dropped 15% after a feature launch. Design an investigation plan with specific SQL queries and statistical tests.', timeLimit: 60 },
          { text: 'Build a customer churn prediction model. Discuss feature engineering from behavioral data, handling class imbalance, and model evaluation metrics.', timeLimit: 60 }
        ],
        hard: [
          { text: 'Design a causal inference study for measuring feature impact on 30-day retention. Discuss propensity score matching, difference-in-differences, and confounding variables.', timeLimit: 120 },
          { text: 'Build a real-time dashboard processing 1B events/day. Discuss data architecture (batch vs streaming), aggregation strategies, and query optimization.', timeLimit: 120 },
          { text: 'Design an experimentation platform for marketplace with network effects. Discuss cluster randomization, switchback tests, and interference mitigation.', timeLimit: 120 }
        ]
      },
      'DevOps Engineer': {
        easy: [
          { text: 'Write a Dockerfile for a Node.js app with multi-stage build. Optimize for image size and build time.', timeLimit: 20 },
          { text: 'Debug this: Pod crashes with OOMKilled error in Kubernetes. Diagnose using kubectl commands and fix with resource limits.', timeLimit: 20 },
          { text: 'Implement a health check endpoint for a microservice. What HTTP codes and response times indicate healthy vs unhealthy?', timeLimit: 20 }
        ],
        medium: [
          { text: 'Design a CI/CD pipeline for 50 microservices with 100 deploys/day. Discuss build optimization, testing strategy, and rollback mechanisms.', timeLimit: 60 },
          { text: 'Implement auto-scaling for a web service handling 1K-10K RPS daily variation. Discuss metrics, scaling policies, and cost optimization.', timeLimit: 60 },
          { text: 'Design a monitoring system for 100 microservices. Discuss metrics collection (Prometheus), log aggregation, and alerting rules with specific thresholds.', timeLimit: 60 }
        ],
        hard: [
          { text: 'Architect a multi-region Kubernetes cluster with 99.99% uptime SLA. Discuss disaster recovery, data replication, and failover automation.', timeLimit: 120 },
          { text: 'Design infrastructure for handling 10x traffic spikes (Black Friday). Discuss capacity planning, caching layers, and database scaling strategies.', timeLimit: 120 },
          { text: 'Build a zero-downtime deployment system for a stateful application with database migrations. Discuss blue-green deployment, feature flags, and rollback strategies.', timeLimit: 120 }
        ]
      },
      'default': {
        easy: [
          { text: `Implement a solution for a common ${jobRole} task. Write code or pseudocode and explain your approach.`, timeLimit: 20 },
          { text: `Debug a production issue in ${jobRole}. Describe your diagnostic process with specific tools and commands.`, timeLimit: 20 }
        ],
        medium: [
          { text: `Design a system component for ${jobRole} handling 10K operations/sec. Discuss architecture, scalability, and failure modes.`, timeLimit: 60 },
          { text: `Optimize a slow-performing ${jobRole} process. Identify bottlenecks and propose specific improvements with metrics.`, timeLimit: 60 }
        ],
        hard: [
          { text: `Architect a large-scale ${jobRole} system for 1M+ users. Discuss distributed architecture, data consistency, and monitoring.`, timeLimit: 120 },
          { text: `Design disaster recovery for a critical ${jobRole} service with 99.99% uptime SLA. Discuss backup, replication, and failover strategies.`, timeLimit: 120 }
        ]
      }
    };
    
    const roleQuestions = technicalFallbacks[jobRole] || technicalFallbacks['default'];
    const questions = roleQuestions[difficulty];
    const randomIndex = Math.floor(Math.random() * questions.length);
    return { ...questions[randomIndex], difficulty };
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