import { createSlice } from '@reduxjs/toolkit';

const initialState = {
  // Candidate info
  candidateName: '',
  candidateEmail: '',
  candidatePhone: '',
  companyName: '', // Company they're interviewing for
  resumeUploaded: false,
  resumeText: '', // Store full resume text for context
  jobRole: 'Full-Stack Developer', // Job role for interview
  
  // Interview state
  isInterviewActive: false,
  currentQuestionIndex: 0,
  questions: [],
  answers: [],
  scores: [],
  
  // Timer
  timeRemaining: 0,
  
  // Results
  finalScore: null,
  summary: '',
  interviewCompleted: false,
  
  // Session
  sessionId: null,
  hasUnfinishedSession: false
};

const interviewSlice = createSlice({
  name: 'interview',
  initialState,
  reducers: {
    setCandidateInfo: (state, action) => {
      const { name, email, phone, fullText } = action.payload;
      state.candidateName = name || state.candidateName;
      state.candidateEmail = email || state.candidateEmail;
      state.candidatePhone = phone || state.candidatePhone;
      if (fullText) state.resumeText = fullText;
    },
    setResumeUploaded: (state, action) => {
      state.resumeUploaded = action.payload;
    },
    setJobRole: (state, action) => {
      state.jobRole = action.payload;
    },
    startInterview: (state, action) => {
      state.isInterviewActive = true;
      state.sessionId = action.payload.sessionId;
      state.questions = action.payload.questions;
      state.currentQuestionIndex = 0;
      state.answers = [];
      state.scores = [];
      state.timeRemaining = action.payload.initialTime;
    },
    setTimeRemaining: (state, action) => {
      state.timeRemaining = action.payload;
    },
    submitAnswer: (state, action) => {
      state.answers[state.currentQuestionIndex] = action.payload.answer;
      state.scores[state.currentQuestionIndex] = action.payload.score;
    },
    nextQuestion: (state) => {
      if (state.currentQuestionIndex < state.questions.length - 1) {
        state.currentQuestionIndex += 1;
        // Set timer for next question based on difficulty
        const nextQuestion = state.questions[state.currentQuestionIndex];
        state.timeRemaining = nextQuestion.timeLimit;
      }
    },
    completeInterview: (state, action) => {
      state.isInterviewActive = false;
      state.interviewCompleted = true;
      state.finalScore = action.payload.finalScore;
      state.summary = action.payload.summary;
    },
    resetInterview: (state) => {
      return { ...initialState };
    },
    setHasUnfinishedSession: (state, action) => {
      state.hasUnfinishedSession = action.payload;
    },
    resumeSession: (state, action) => {
      return { ...state, ...action.payload, hasUnfinishedSession: false };
    }
  }
});

export const {
  setCandidateInfo,
  setResumeUploaded,
  setJobRole,
  startInterview,
  setTimeRemaining,
  submitAnswer,
  nextQuestion,
  completeInterview,
  resetInterview,
  setHasUnfinishedSession,
  resumeSession
} = interviewSlice.actions;

export default interviewSlice.reducer;