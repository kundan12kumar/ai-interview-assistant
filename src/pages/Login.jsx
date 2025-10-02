import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import { Form, Input, Button, Card, message, Alert } from 'antd';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from '../firebase/config';
import { setUser } from '../redux/userSlice';

const Login = () => {
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const navigate = useNavigate();
  const dispatch = useDispatch();

  const onFinish = async (values) => {
    setLoading(true);
    setErrorMessage(''); // Clear previous errors
    
    try {
      const userCredential = await signInWithEmailAndPassword(
        auth,
        values.email,
        values.password
      );
      
      dispatch(setUser({
        uid: userCredential.user.uid,
        email: userCredential.user.email
      }));
      
      message.success('Login successful!');
      navigate('/interview');
    } catch (error) {
      // Handle Firebase-specific errors
      let errorMsg = 'Login failed. Please try again.';
      
      if (error.code === 'auth/invalid-credential' || error.code === 'auth/wrong-password') {
        errorMsg = 'Invalid email or password. Please check your credentials.';
      } else if (error.code === 'auth/user-not-found') {
        errorMsg = 'No account found with this email. Please sign up first.';
      } else if (error.code === 'auth/invalid-email') {
        errorMsg = 'Invalid email address format.';
      } else if (error.code === 'auth/user-disabled') {
        errorMsg = 'This account has been disabled. Please contact support.';
      } else if (error.code === 'auth/too-many-requests') {
        errorMsg = 'Too many failed attempts. Please try again later.';
      } else if (error.code === 'auth/network-request-failed') {
        errorMsg = 'Network error. Please check your internet connection.';
      }
      
      setErrorMessage(errorMsg);
      message.error(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      padding: '16px'
    }}>
      <Card
        title="Login to AI Interview Assistant"
        style={{ 
          width: '100%',
          maxWidth: '400px',
          boxShadow: '0 4px 12px rgba(0,0,0,0.15)' 
        }}
      >
        {errorMessage && (
          <Alert
            message={errorMessage}
            type="error"
            closable
            onClose={() => setErrorMessage('')}
            style={{ marginBottom: 16 }}
          />
        )}
        
        <Form
          name="login"
          onFinish={onFinish}
          layout="vertical"
          autoComplete="off"
        >
          <Form.Item
            label="Email"
            name="email"
            rules={[
              { required: true, message: 'Please input your email!' },
              { type: 'email', message: 'Please enter a valid email!' }
            ]}
          >
            <Input size="large" placeholder="Enter your email" />
          </Form.Item>

          <Form.Item
            label="Password"
            name="password"
            rules={[
              { required: true, message: 'Please input your password!' },
              { min: 6, message: 'Password must be at least 6 characters!' }
            ]}
          >
            <Input.Password size="large" placeholder="Enter your password" />
          </Form.Item>

          <Form.Item>
            <Button
              type="primary"
              htmlType="submit"
              loading={loading}
              block
              size="large"
            >
              Login
            </Button>
          </Form.Item>

          <div style={{ textAlign: 'center' }}>
            Don't have an account? <Link to="/signup">Sign up</Link>
          </div>
        </Form>
      </Card>
    </div>
  );
};

export default Login;