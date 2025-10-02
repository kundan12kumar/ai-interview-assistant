import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import {
  Layout, Table, Input, Button, Space, Typography, Modal,
  Card, Tag, Descriptions, Timeline, Statistic, Row, Col
} from 'antd';
import {
  SearchOutlined, EyeOutlined, UserOutlined,
  LogoutOutlined, TrophyOutlined
} from '@ant-design/icons';
import { signOut } from 'firebase/auth';
import { collection, query, getDocs, orderBy } from 'firebase/firestore';
import { auth, db } from '../firebase/config';
import { clearUser } from '../redux/userSlice';

const { Header, Content } = Layout;
const { Title, Text, Paragraph } = Typography;

const Dashboard = () => {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const user = useSelector((state) => state.user.user);
  
  const [candidates, setCandidates] = useState([]);
  const [filteredCandidates, setFilteredCandidates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchText, setSearchText] = useState('');
  const [selectedCandidate, setSelectedCandidate] = useState(null);
  const [detailModalVisible, setDetailModalVisible] = useState(false);

  useEffect(() => {
    fetchCandidates();
  }, []);

  const fetchCandidates = async () => {
    setLoading(true);
    try {
      const q = query(
        collection(db, 'interviews'),
        orderBy('finalScore', 'desc')
      );
      
      const querySnapshot = await getDocs(q);
      const candidateData = [];
      
      querySnapshot.forEach((doc) => {
        candidateData.push({
          id: doc.id,
          ...doc.data()
        });
      });
      
      setCandidates(candidateData);
      setFilteredCandidates(candidateData);
    } catch (error) {
      console.error('Error fetching candidates:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    await signOut(auth);
    dispatch(clearUser());
    navigate('/login');
  };

  const handleSearch = (value) => {
    setSearchText(value);
    const filtered = candidates.filter((candidate) =>
      candidate.candidateName.toLowerCase().includes(value.toLowerCase()) ||
      candidate.candidateEmail.toLowerCase().includes(value.toLowerCase())
    );
    setFilteredCandidates(filtered);
  };

  const handleViewDetails = (candidate) => {
    setSelectedCandidate(candidate);
    setDetailModalVisible(true);
  };

  const getScoreColor = (score) => {
    if (score >= 80) return 'green';
    if (score >= 60) return 'blue';
    if (score >= 40) return 'orange';
    return 'red';
  };

  const getDifficultyColor = (difficulty) => {
    const colors = {
      easy: 'green',
      medium: 'orange',
      hard: 'red'
    };
    return colors[difficulty] || 'default';
  };

  const columns = [
    {
      title: 'Rank',
      key: 'rank',
      width: 70,
      render: (_, __, index) => (
        <Tag color={index === 0 ? 'gold' : index === 1 ? 'silver' : index === 2 ? 'bronze' : 'default'}>
          #{index + 1}
        </Tag>
      )
    },
    {
      title: 'Candidate Name',
      dataIndex: 'candidateName',
      key: 'candidateName',
      sorter: (a, b) => a.candidateName.localeCompare(b.candidateName)
    },
    {
      title: 'Email',
      dataIndex: 'candidateEmail',
      key: 'candidateEmail'
    },
    {
      title: 'Phone',
      dataIndex: 'candidatePhone',
      key: 'candidatePhone'
    },
    {
      title: 'Final Score',
      dataIndex: 'finalScore',
      key: 'finalScore',
      sorter: (a, b) => a.finalScore - b.finalScore,
      render: (score) => (
        <Tag color={getScoreColor(score)} style={{ fontSize: '14px', fontWeight: 'bold' }}>
          {score}/100
        </Tag>
      )
    },
    {
      title: 'Summary',
      dataIndex: 'summary',
      key: 'summary',
      ellipsis: true,
      width: 300
    },
    {
      title: 'Date',
      dataIndex: 'completedAt',
      key: 'completedAt',
      render: (date) => date?.toDate().toLocaleDateString(),
      sorter: (a, b) => a.completedAt?.toMillis() - b.completedAt?.toMillis()
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (_, record) => (
        <Button
          type="primary"
          icon={<EyeOutlined />}
          onClick={() => handleViewDetails(record)}
        >
          View Details
        </Button>
      )
    }
  ];

  const getAverageScore = () => {
    if (candidates.length === 0) return 0;
    const sum = candidates.reduce((acc, c) => acc + c.finalScore, 0);
    return Math.round(sum / candidates.length);
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
          AI Interview Assistant - Dashboard
        </Title>
        <Space>
          <Text><UserOutlined /> {user?.email}</Text>
          <Button onClick={() => navigate('/interview')}>
            Take Interview
          </Button>
          <Button icon={<LogoutOutlined />} onClick={handleLogout}>
            Logout
          </Button>
        </Space>
      </Header>

      <Content style={{ padding: '24px' }}>
        <Row gutter={16} style={{ marginBottom: 24 }}>
          <Col span={8}>
            <Card>
              <Statistic
                title="Total Candidates"
                value={candidates.length}
                prefix={<UserOutlined />}
              />
            </Card>
          </Col>
          <Col span={8}>
            <Card>
              <Statistic
                title="Average Score"
                value={getAverageScore()}
                suffix="/100"
                prefix={<TrophyOutlined />}
                valueStyle={{ color: getScoreColor(getAverageScore()) === 'green' ? '#3f8600' : '#cf1322' }}
              />
            </Card>
          </Col>
          <Col span={8}>
            <Card>
              <Statistic
                title="Top Score"
                value={candidates[0]?.finalScore || 0}
                suffix="/100"
                valueStyle={{ color: '#3f8600' }}
              />
            </Card>
          </Col>
        </Row>

        <Card title="Candidate List" style={{ marginBottom: 24 }}>
          <Input
            placeholder="Search by name or email..."
            prefix={<SearchOutlined />}
            value={searchText}
            onChange={(e) => handleSearch(e.target.value)}
            style={{ marginBottom: 16, maxWidth: 400 }}
            size="large"
          />
          
          <Table
            columns={columns}
            dataSource={filteredCandidates}
            rowKey="id"
            loading={loading}
            pagination={{
              pageSize: 10,
              showTotal: (total) => `Total ${total} candidates`
            }}
          />
        </Card>

        <Modal
          title="Candidate Details"
          open={detailModalVisible}
          onCancel={() => setDetailModalVisible(false)}
          footer={null}
          width={800}
        >
          {selectedCandidate && (
            <Space direction="vertical" style={{ width: '100%' }} size="large">
              <Card type="inner" title="Candidate Information">
                <Descriptions column={2} bordered>
                  <Descriptions.Item label="Name">
                    {selectedCandidate.candidateName}
                  </Descriptions.Item>
                  <Descriptions.Item label="Email">
                    {selectedCandidate.candidateEmail}
                  </Descriptions.Item>
                  <Descriptions.Item label="Phone">
                    {selectedCandidate.candidatePhone}
                  </Descriptions.Item>
                  <Descriptions.Item label="Final Score">
                    <Tag color={getScoreColor(selectedCandidate.finalScore)} style={{ fontSize: '16px' }}>
                      {selectedCandidate.finalScore}/100
                    </Tag>
                  </Descriptions.Item>
                  <Descriptions.Item label="Interview Date" span={2}>
                    {selectedCandidate.completedAt?.toDate().toLocaleString()}
                  </Descriptions.Item>
                  <Descriptions.Item label="Summary" span={2}>
                    {selectedCandidate.summary}
                  </Descriptions.Item>
                </Descriptions>
              </Card>

              <Card type="inner" title="Interview Transcript">
                <Timeline>
                  {selectedCandidate.questions?.map((question, index) => (
                    <Timeline.Item
                      key={index}
                      color={getDifficultyColor(question.difficulty)}
                    >
                      <Card size="small" style={{ marginBottom: 8 }}>
                        <Space direction="vertical" style={{ width: '100%' }}>
                          <div>
                            <Tag color={getDifficultyColor(question.difficulty)}>
                              {question.difficulty?.toUpperCase() || 'N/A'}
                            </Tag>
                            <Tag>Score: {selectedCandidate.scores?.[index] ?? 'N/A'}/10</Tag>
                          </div>
                          <Text strong>Q{index + 1}: {question.text || question}</Text>
                          <Paragraph style={{ marginTop: 8, marginBottom: 0 }}>
                            <Text type="secondary">Answer:</Text><br />
                            {selectedCandidate.answers?.[index] || 'No answer provided'}
                          </Paragraph>
                        </Space>
                      </Card>
                    </Timeline.Item>
                  ))}
                </Timeline>
              </Card>
            </Space>
          )}
        </Modal>
      </Content>
    </Layout>
  );
};

export default Dashboard;