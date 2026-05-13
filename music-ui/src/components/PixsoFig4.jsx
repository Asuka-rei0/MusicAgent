import React, { useState } from 'react';
import { Layout, Menu, Card, Typography, Switch, Radio, Space, Divider } from 'antd';
import { HomeOutlined, CompassOutlined, BookOutlined, SettingOutlined, SunOutlined, MoonOutlined, DesktopOutlined } from '@ant-design/icons';
import './PixsoFig4.css';

const { Sider, Content } = Layout;
const { Title, Text } = Typography;
const { Group: RadioGroup } = Radio;

const PixsoFig4 = () => {
  const [theme, setTheme] = useState('dark');
  const [lyricsEnabled, setLyricsEnabled] = useState(true);

  const menuItems = [
    { key: 'home', icon: <HomeOutlined />, label: 'Home' },
    { key: 'explore', icon: <CompassOutlined />, label: 'Explore' },
    { key: 'library', icon: <BookOutlined />, label: 'Library' },
    { key: 'settings', icon: <SettingOutlined />, label: 'Settings' },
  ];

  const themeOptions = [
    { value: 'light', label: '亮色', icon: <SunOutlined /> },
    { value: 'dark', label: '暗色', icon: <MoonOutlined /> },
    { value: 'system', label: '跟随系统', icon: <DesktopOutlined /> },
  ];

  return (
    <Layout className="pixso-fig4">
      <Sider className="sidebar" width={280}>
        <div className="sidebar-header">
          <div className="logo">
            <Text strong style={{ color: '#7c3aed', fontSize: '24px' }}>U</Text>
          </div>
        </div>
        <Menu
          mode="inline"
          selectedKeys={['settings']}
          items={menuItems}
          className="sidebar-menu"
        />
      </Sider>

      <Layout>
        <Content className="main-content">
          <div className="content-header">
            <Title level={2} className="page-title">Settings</Title>
          </div>

          <div className="settings-content">
            <Card className="settings-card">
              <div className="setting-section">
                <div className="section-header">
                  <Title level={4}>应用主题与外观</Title>
                  <Text type="secondary">选择您喜欢的界面主题</Text>
                </div>

                <div className="theme-options">
                  <RadioGroup
                    value={theme}
                    onChange={(e) => setTheme(e.target.value)}
                    className="theme-radio-group"
                  >
                    <Space direction="vertical" size="large" style={{ width: '100%' }}>
                      {themeOptions.map((option) => (
                        <div key={option.value} className="theme-option">
                          <Radio value={option.value} className="theme-radio">
                            <Space>
                              {option.icon}
                              <Text strong>{option.label}</Text>
                            </Space>
                          </Radio>
                        </div>
                      ))}
                    </Space>
                  </RadioGroup>
                </div>
              </div>

              <Divider />

              <div className="setting-section">
                <div className="section-header">
                  <Title level={4}>歌词显示</Title>
                  <Text type="secondary">在播放音乐时显示歌词</Text>
                </div>

                <div className="lyrics-toggle">
                  <Switch
                    checked={lyricsEnabled}
                    onChange={setLyricsEnabled}
                    className="lyrics-switch"
                  />
                  <Text style={{ marginLeft: 12 }}>
                    {lyricsEnabled ? '已启用' : '已禁用'}
                  </Text>
                </div>
              </div>
            </Card>
          </div>
        </Content>
      </Layout>
    </Layout>
  );
};

export default PixsoFig4;