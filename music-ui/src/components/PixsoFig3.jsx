import React from 'react';
import { Layout, Menu, Input, Card, Typography, Avatar, Button, Progress, Space } from 'antd';
import { SearchOutlined, HomeOutlined, CompassOutlined, BookOutlined, SettingOutlined } from '@ant-design/icons';
import './PixsoFig3.css';

const { Sider, Content } = Layout;
const { Title, Text } = Typography;
const { Search } = Input;

const PixsoFig3 = () => {
  const menuItems = [
    { key: 'home', icon: <HomeOutlined />, label: 'Home' },
    { key: 'explore', icon: <CompassOutlined />, label: 'Explore' },
    { key: 'library', icon: <BookOutlined />, label: 'Library' },
    { key: 'settings', icon: <SettingOutlined />, label: 'Settings' },
  ];

  return (
    <Layout className="pixso-fig3">
      <Sider className="sidebar" width={280}>
        <div className="sidebar-header">
          <div className="logo">
            <Text strong style={{ color: '#7c3aed', fontSize: '24px' }}>U</Text>
          </div>
        </div>
        <Menu
          mode="inline"
          selectedKeys={['library']}
          items={menuItems}
          className="sidebar-menu"
        />
      </Sider>

      <Layout>
        <Content className="main-content">
          <div className="content-header">
            <Title level={2} className="page-title">Music Library</Title>
          </div>

          <div className="search-section">
            <Search
              placeholder="Search in library..."
              enterButton={<SearchOutlined />}
              size="large"
              className="search-input"
            />
          </div>

          <div className="content-grid">
            <Card className="weekly-report-card">
              <div className="card-header">
                <Title level={4}>Weekly Report</Title>
                <Text type="secondary">This Week</Text>
              </div>
              <div className="report-content">
                <div className="stat-item">
                  <Text>Listening Time</Text>
                  <Text strong>24h 32m</Text>
                </div>
                <div className="stat-item">
                  <Text>Top Genre</Text>
                  <Text strong>Electronic</Text>
                </div>
                <div className="stat-item">
                  <Text>New Discoveries</Text>
                  <Text strong>12 songs</Text>
                </div>
              </div>
            </Card>

            <Card className="recent-plays-card">
              <Title level={4}>Recently Played</Title>
              <Space direction="vertical" size="middle" style={{ width: '100%' }}>
                {[1, 2, 3, 4, 5].map((item) => (
                  <div key={item} className="track-item">
                    <Avatar size={48} shape="square" style={{ backgroundColor: '#7c3aed' }}>
                      {item}
                    </Avatar>
                    <div className="track-info">
                      <Text strong>Track Title {item}</Text>
                      <Text type="secondary">Artist Name</Text>
                    </div>
                    <Text type="secondary">3:24</Text>
                  </div>
                ))}
              </Space>
            </Card>

            <Card className="playlists-card">
              <Title level={4}>Your Playlists</Title>
              <Space direction="vertical" size="middle" style={{ width: '100%' }}>
                {[
                  { name: 'Favorites', count: 42 },
                  { name: 'Workout Mix', count: 28 },
                  { name: 'Chill Vibes', count: 35 },
                  { name: 'Study Session', count: 19 }
                ].map((playlist, index) => (
                  <div key={index} className="playlist-item">
                    <Avatar size={48} shape="square" style={{ backgroundColor: '#4f46e5' }}>
                      {playlist.name.charAt(0)}
                    </Avatar>
                    <div className="playlist-info">
                      <Text strong>{playlist.name}</Text>
                      <Text type="secondary">{playlist.count} songs</Text>
                    </div>
                  </div>
                ))}
              </Space>
            </Card>
          </div>
        </Content>
      </Layout>
    </Layout>
  );
};

export default PixsoFig3;