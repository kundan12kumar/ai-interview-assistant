import { Modal, Button } from 'antd';
import { useDispatch } from 'react-redux';
import { resetInterview, setHasUnfinishedSession } from '../redux/interviewSlice';

const WelcomeBackModal = ({ visible, onResume }) => {
  const dispatch = useDispatch();

  const handleResume = () => {
    dispatch(setHasUnfinishedSession(false));
    onResume();
  };

  const handleStartNew = () => {
    dispatch(resetInterview());
    dispatch(setHasUnfinishedSession(false));
  };

  return (
    <Modal
      title="Welcome Back!"
      open={visible}
      closable={false}
      footer={[
        <Button key="new" onClick={handleStartNew}>
          Start New Interview
        </Button>,
        <Button key="resume" type="primary" onClick={handleResume}>
          Resume Previous Session
        </Button>
      ]}
    >
      <p>We detected an unfinished interview session. Would you like to continue where you left off?</p>
    </Modal>
  );
};

export default WelcomeBackModal;