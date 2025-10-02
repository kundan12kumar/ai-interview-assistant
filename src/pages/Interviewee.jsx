import { useState, useEffect, useRef } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import {
  Layout, Card, Upload, Button, Input, message, Progress,
  Typography, Space, Tag, Modal, Form, Select
} from 'antd';
import {
  UploadOutlined, SendOutlined, ClockCircleOutlined,
  UserOutlined, LogoutOutlined
} from '@ant-design/icons';
import { signOut } from 'firebase/auth';
import { collection, addDoc } from 'firebase/firestore';
import { auth, db } from '../firebase/config';
import {
  setCandidateInfo, setResumeUploaded, setJobRole, startInterview,
  setTimeRemaining, submitAnswer, nextQuestion,
  completeInterview, resetInterview, setHasUnfinishedSession
} from '../redux/interviewSlice';
import { clearUser } from '../redux/userSlice';
import {
  parseResume, generateAIQuestion, evaluateAIAnswer,
  summarizeAIInterview
} from '../api/aiService';
import WelcomeBackModal from '../components/WelcomeBackModal';

const { Header, Content } = Layout;
const { Title, Text, Paragraph } = Typography;
const { TextArea } = Input;
const { Option } = Select;

const Interviewee = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const user = useSelector((state) => state.user.user);
  const interview = useSelector((state) => state.interview);
  
  const [currentAnswer, setCurrentAnswer] = useState('');
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [infoModalVisible, setInfoModalVisible] = useState(false);
  const [form] = Form.useForm();
  
  const timerRef = useRef(null);
  const messagesEndRef = useRef(null);

  // Check for unfinished session on mount
  useEffect(() => {
    if (interview.isInterviewActive && !interview.interviewCompleted) {
      dispatch(setHasUnfinishedSession(true));
    }
  }, []);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Timer logic
  useEffect(() => {
    if (interview.isInterviewActive && interview.timeRemaining > 0) {
      timerRef.current = setInterval(() => {
        dispatch(setTimeRemaining(interview.timeRemaining - 1));
      }, 1000);

      return () => clearInterval(timerRef.current);
    } else if (interview.timeRemaining === 0 && interview.isInterviewActive) {
      handleAutoSubmit();
    }
  }, [interview.timeRemaining, interview.isInterviewActive]);

  const handleLogout = async () => {
    await signOut(auth);
    dispatch(clearUser());
    dispatch(resetInterview());
    navigate('/login');
  };

  const handleResumeUpload = async (file) => {
    setLoading(true);
    try {
      const extractedInfo = await parseResume(file);
      
      if (!extractedInfo.name || !extractedInfo.email || !extractedInfo.phone) {
        setInfoModalVisible(true);
        form.setFieldsValue(extractedInfo);
      } else {
        dispatch(setCandidateInfo(extractedInfo));
        dispatch(setResumeUploaded(true));
        addMessage('bot', `Thank you! I've extracted your information. Ready to begin the interview?`);
      }
      
      message.success('Resume uploaded successfully!');
    } catch (error) {
      message.error('Failed to parse resume');
    } finally {
      setLoading(false);
    }
    return false;
  };

  const handleInfoSubmit = (values) => {
    dispatch(setCandidateInfo(values));
    dispatch(setResumeUploaded(true));
    setInfoModalVisible(false);
    addMessage('bot', `Thank you, ${values.name}! ${values.companyName ? `Good luck with your ${values.companyName} interview!` : 'Ready to begin the interview?'}`);
  };

  const startInterviewSession = async () => {
    if (!interview.candidateName || !interview.candidateEmail || !interview.candidatePhone) {
      message.warning('Please upload your resume and provide all required information first!');
      return;
    }

    if (!interview.jobRole) {
      message.warning('Please select the job role you are interviewing for!');
      return;
    }

    setLoading(true);
    try {
      const questions = [];
      const resumeContext = interview.resumeText || '';
      const jobRole = interview.jobRole;
      const companyName = interview.companyName || '';
      
      // Generate 2 Easy, 2 Medium, 2 Hard questions with resume context, job role, and company
      addMessage('bot', `Analyzing your resume for ${jobRole} position${companyName ? ` at ${companyName}` : ''} and generating technical questions...`);
      
      for (let i = 0; i < 2; i++) {
        const question = await generateAIQuestion('easy', i + 1, resumeContext, jobRole, companyName);
        questions.push(question);
      }
      for (let i = 0; i < 2; i++) {
        const question = await generateAIQuestion('medium', i + 3, resumeContext, jobRole, companyName);
        questions.push(question);
      }
      for (let i = 0; i < 2; i++) {
        const question = await generateAIQuestion('hard', i + 5, resumeContext, jobRole, companyName);
        questions.push(question);
      }

      const sessionId = `session_${Date.now()}`;
      dispatch(startInterview({
        sessionId,
        questions,
        initialTime: questions[0].timeLimit
      }));

      addMessage('bot', `Let's begin your ${jobRole} interview${companyName ? ` for ${companyName}` : ''}! Question 1 of 6 (${questions[0].difficulty.toUpperCase()}):`);
      addMessage('bot', questions[0].text);
    } catch (error) {
      message.error('Failed to start interview');
    } finally {
      setLoading(false);
    }
  };

  const addMessage = (sender, text) => {
    setMessages((prev) => [...prev, { sender, text, timestamp: new Date() }]);
  };

  const handleAutoSubmit = async () => {
    if (!interview.isInterviewActive) return;
    
    const answer = currentAnswer || 'No answer provided (time expired)';
    await processAnswer(answer);
    setCurrentAnswer('');
  };

  const handleSubmitAnswer = async () => {
    if (!currentAnswer.trim()) {
      message.warning('Please provide an answer before submitting!');
      return;
    }

    await processAnswer(currentAnswer);
    setCurrentAnswer('');
  };

  const processAnswer = async (answer) => {
    setLoading(true);
    
    try {
      addMessage('user', answer);
      
      const currentQ = interview.questions[interview.currentQuestionIndex];
      const score = await evaluateAIAnswer(currentQ.text, answer);
      
      dispatch(submitAnswer({ answer, score }));
      
      if (interview.currentQuestionIndex < interview.questions.length - 1) {
        dispatch(nextQuestion());
        
        const nextQ = interview.questions[interview.currentQuestionIndex + 1];
        addMessage('bot', `Question ${interview.currentQuestionIndex + 2} of 6 (${nextQ.difficulty.toUpperCase()}):`);
        addMessage('bot', nextQ.text);
      } else {
        await finishInterview();
      }
    } catch (error) {
      message.error('Failed to process answer');
    } finally {
      setLoading(false);
    }
  };

  const finishInterview = async () => {
    setLoading(true);
    
    try {
      const transcript = {
        qa: interview.questions.map((q, i) => ({
          question: q.text,
          answer: interview.answers[i]
        })),
        scores: interview.scores
      };

      const result = await summarizeAIInterview(transcript);
      
      dispatch(completeInterview(result));
      
      // Save to Firestore
      await addDoc(collection(db, 'interviews'), {
        userId: user.uid,
        candidateName: interview.candidateName,
        candidateEmail: interview.candidateEmail,
        candidatePhone: interview.candidatePhone,
        companyName: interview.companyName || '',
        jobRole: interview.jobRole,
        questions: interview.questions,
        answers: interview.answers,
        scores: interview.scores,
        finalScore: result.finalScore,
        summary: result.summary,
        completedAt: new Date()
      });

      addMessage('bot', `Interview completed! Your final score is ${result.finalScore}/100.`);
      addMessage('bot', result.summary);
      
      message.success('Interview completed and saved successfully!');
    } catch (error) {
      message.error('Failed to complete interview');
    } finally {
      setLoading(false);
    }
  };

  const handleResumeSession = () => {
    const currentQ = interview.questions[interview.currentQuestionIndex];
    addMessage('bot', `Welcome back! Resuming Question ${interview.currentQuestionIndex + 1} of 6:`);
    addMessage('bot', currentQ.text);
  };

  const getProgressPercent = () => {
    if (!interview.isInterviewActive) return 0;
    return ((interview.currentQuestionIndex + 1) / interview.questions.length) * 100;
  };

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Header style={{
        background: '#fff',
        padding: '0 24px',
        boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      }}>
        <Title level={3} style={{ margin: 0 }}>
          AI Interview Assistant - Interviewee
        </Title>
        <Space>
          <Text><UserOutlined /> {user?.email}</Text>
          <Button icon={<LogoutOutlined />} onClick={handleLogout}>
            Logout
          </Button>
          <Button onClick={() => navigate('/dashboard')}>
            View Dashboard
          </Button>
        </Space>
      </Header>

      <Content style={{ padding: '24px', maxWidth: '900px', margin: '0 auto', width: '100%' }}>
        <WelcomeBackModal
          visible={interview.hasUnfinishedSession}
          onResume={handleResumeSession}
        />

        <Modal
          title="Complete Your Information"
          open={infoModalVisible}
          onCancel={() => setInfoModalVisible(false)}
          footer={null}
        >
          <Form form={form} onFinish={handleInfoSubmit} layout="vertical">
            <Form.Item
              label="Full Name"
              name="name"
              rules={[
                { required: true, message: 'Please enter your name!' },
                { min: 2, message: 'Name must be at least 2 characters!' }
              ]}
            >
              <Input placeholder="Enter your full name" />
            </Form.Item>
            <Form.Item
              label="Email"
              name="email"
              rules={[
                { required: true, message: 'Please enter your email!' },
                { type: 'email', message: 'Please enter a valid email!' },
                { 
                  pattern: /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/,
                  message: 'Email format is invalid!'
                }
              ]}
            >
              <Input placeholder="Enter your email" />
            </Form.Item>
            <Form.Item
              label="Phone Number"
              name="phone"
              rules={[
                { required: true, message: 'Please enter your phone number!' },
                {
                  pattern: /^[+]?[(]?[0-9]{1,4}[)]?[-\s.]?[(]?[0-9]{1,4}[)]?[-\s.]?[0-9]{1,9}$/,
                  message: 'Please enter a valid phone number!'
                },
                { min: 10, message: 'Phone number must be at least 10 digits!' }
              ]}
            >
              <Input placeholder="Enter your phone number (e.g., +1234567890)" />
            </Form.Item>
            <Form.Item
              label="Company Name (Optional)"
              name="companyName"
              help="The company you're interviewing for - helps generate relevant questions"
            >
              <Input placeholder="e.g., Google, Amazon, Microsoft" />
            </Form.Item>
            <Form.Item>
              <Button type="primary" htmlType="submit" block>
                Submit
              </Button>
            </Form.Item>
          </Form>
        </Modal>

        {interview.isInterviewActive && (
          <Card style={{ marginBottom: 16 }}>
            <Space direction="vertical" style={{ width: '100%' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <Text strong>Progress: Question {interview.currentQuestionIndex + 1} of 6</Text>
                <Tag color={interview.timeRemaining > 10 ? 'green' : 'red'}>
                  <ClockCircleOutlined /> {interview.timeRemaining}s
                </Tag>
              </div>
              <Progress percent={getProgressPercent()} status="active" />
            </Space>
          </Card>
        )}

        <Card
          title="Interview Chat"
          style={{ marginBottom: 16, minHeight: '500px' }}
          bodyStyle={{ height: '450px', overflowY: 'auto' }}
        >
          <Space direction="vertical" style={{ width: '100%' }} size="large">
            {!interview.resumeUploaded && (
              <Card type="inner" title="Step 1: Upload Your Resume">
                <Upload
                  beforeUpload={handleResumeUpload}
                  accept=".pdf,.docx"
                  maxCount={1}
                  showUploadList={false}
                >
                  <Button icon={<UploadOutlined />} loading={loading} size="large">
                    Upload Resume (PDF/DOCX)
                  </Button>
                </Upload>
              </Card>
            )}

            {interview.resumeUploaded && !interview.isInterviewActive && !interview.interviewCompleted && (
              <Card type="inner" title="Step 2: Select Job Role & Start Interview">
                <Paragraph>
                  <Text strong>Candidate:</Text> {interview.candidateName}<br />
                  <Text strong>Email:</Text> {interview.candidateEmail}<br />
                  <Text strong>Phone:</Text> {interview.candidatePhone}<br />
                  {interview.companyName && (
                    <><Text strong>Company:</Text> {interview.companyName}<br /></>
                  )}
                </Paragraph>
                
                <Form.Item label="Select Job Role" style={{ marginBottom: 16 }}>
                  <Select
                    size="large"
                    placeholder="Choose the position you're interviewing for"
                    value={interview.jobRole}
                    onChange={(value) => dispatch(setJobRole(value))}
                    style={{ width: '100%' }}
                  >
                    <Option value="Full-Stack Developer">Full-Stack Developer</Option>
                    <Option value="Frontend Developer">Frontend Developer (React/Vue/Angular)</Option>
                    <Option value="Backend Developer">Backend Developer (Node.js/Python/Java)</Option>
                    <Option value="Machine Learning Engineer">Machine Learning Engineer</Option>
                    <Option value="Data Scientist">Data Scientist</Option>
                    <Option value="DevOps Engineer">DevOps Engineer</Option>
                    <Option value="Mobile Developer">Mobile Developer (iOS/Android)</Option>
                    <Option value="Product Manager">Product Manager</Option>
                    <Option value="UI/UX Designer">UI/UX Designer</Option>
                    <Option value="Data Analyst">Data Analyst</Option>
                    <Option value="Cloud Engineer">Cloud Engineer (AWS/Azure/GCP)</Option>
                    <Option value="Cybersecurity Engineer">Cybersecurity Engineer</Option>
                    <Option value="QA Engineer">QA/Test Engineer</Option>
                    <Option value="Business Analyst">Business Analyst</Option>
                    <Option value="Software Engineer">Software Engineer (General)</Option>
                  </Select>
                </Form.Item>
                
                <Button
                  type="primary"
                  size="large"
                  onClick={startInterviewSession}
                  loading={loading}
                  block
                  disabled={!interview.jobRole}
                >
                  Start {interview.jobRole || 'Interview'} (6 Questions)
                </Button>
              </Card>
            )}

            {messages.map((msg, idx) => (
              <div
                key={idx}
                style={{
                  display: 'flex',
                  justifyContent: msg.sender === 'user' ? 'flex-end' : 'flex-start'
                }}
              >
                <Card
                  size="small"
                  style={{
                    maxWidth: '70%',
                    background: msg.sender === 'user' ? '#1890ff' : '#f0f0f0',
                    color: msg.sender === 'user' ? '#fff' : '#000'
                  }}
                >
                  {msg.text}
                </Card>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </Space>
        </Card>

        {interview.isInterviewActive && !interview.interviewCompleted && (
          <Card>
            <Space.Compact style={{ width: '100%' }}>
              <TextArea
                value={currentAnswer}
                onChange={(e) => setCurrentAnswer(e.target.value)}
                placeholder="Type your answer here..."
                autoSize={{ minRows: 3, maxRows: 6 }}
                disabled={loading}
              />
              <Button
                type="primary"
                icon={<SendOutlined />}
                onClick={handleSubmitAnswer}
                loading={loading}
                size="large"
              >
                Submit
              </Button>
            </Space.Compact>
          </Card>
        )}

        {interview.interviewCompleted && (
          <Card style={{ textAlign: 'center', background: '#f6ffed', borderColor: '#b7eb8f' }}>
            <Title level={2}>Interview Completed! 🎉</Title>
            <Title level={3}>Final Score: {interview.finalScore}/100</Title>
            <Paragraph>{interview.summary}</Paragraph>
            <Button type="primary" onClick={() => dispatch(resetInterview())}>
              Start New Interview
            </Button>
          </Card>
        )}
      </Content>
    </Layout>
  );
};

export default Interviewee;