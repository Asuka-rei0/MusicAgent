import React from 'react';
import { Card, Input, Typography, Avatar, Space, Button, Progress } from 'antd';
import {
  SearchOutlined,
  MusicOutlined,
  RobotOutlined,
  HomeOutlined,
  BarChartOutlined,
  SettingOutlined,
  StepBackwardOutlined,
  StepForwardOutlined,
  PlayCircleFilled,
  PauseCircleFilled,
  RetweetOutlined,
  HeartOutlined,
  SoundOutlined,
} from '@ant-design/icons';
import './PixsoAiRecommend.css';

const { Title, Text, Paragraph } = Typography;

const PixsoAiRecommend = () => {
  return (
    <div className="pixso-ai-recommend">
      <aside className="pixso-sidebar">
        <Space direction="vertical" size="middle" className="pixso-sidebar-icons">
          <Button type="primary" shape="circle" icon={<MusicOutlined />} />
          <Button shape="circle" icon={<RobotOutlined />} />
          <Button shape="circle" icon={<BarChartOutlined />} />
          <Button shape="circle" icon={<SettingOutlined />} />
        </Space>
        <Avatar size={48} className="pixso-sidebar-avatar">
          U
        </Avatar>
      </aside>

      <main className="pixso-main">
        <section className="pixso-topbar">
          <div>
            <Text className="pixso-badge">AI Recommend</Text>
            <Title level={2} className="pixso-heading">
              Find the perfect mood for your next track.
            </Title>
          </div>
          <Input
            className="pixso-search"
            size="large"
            placeholder="Search music, moods..."
            prefix={<SearchOutlined className="pixso-search-icon" />}
          />
        </section>

        <section className="pixso-grid">
          <Card className="pixso-card pixso-chat-card" bordered={false}>
            <div className="pixso-card-header">
              <Space size="middle" align="center">
                <Avatar size="small" icon={<RobotOutlined />} />
                <div>
                  <Text strong className="pixso-card-title">
                    AI Assistant
                  </Text>
                </div>
              </Space>
            </div>
            <Paragraph className="pixso-chat-text">
              为您推荐这首爵士乐，轻柔的旋律能够舒缓疲惫的神经。钢琴与萨克斯的交织，如同夜晚的微风…
            </Paragraph>
            <div className="pixso-user-bubble">
              <Text>Feeling tired, need something soothing...</Text>
              <Avatar size={24} className="pixso-user-avatar">
                U
              </Avatar>
            </div>
          </Card>

          <div className="pixso-right-column">
            <Card className="pixso-card pixso-lyrics-card" bordered={false}>
              <div className="pixso-card-header">
                <Text strong className="pixso-card-title">
                  Live Lyrics
                </Text>
              </div>
              <Paragraph className="pixso-lyrics-line">When the moon meets the midnight air...</Paragraph>
              <Paragraph className="pixso-lyrics-highlight">The gentle keys are playing...</Paragraph>
              <Paragraph className="pixso-lyrics-line">A melody that soothes the soul...</Paragraph>
            </Card>

            <Card className="pixso-card pixso-track-card" bordered={false}>
              <div className="pixso-track-info">
                <div>
                  <Text strong className="pixso-track-title">
                    Midnight Jazz
                  </Text>
                  <Text type="secondary" className="pixso-track-subtitle">
                    The Velvet Trio · 2024
                  </Text>
                </div>
                <div className="pixso-track-tags">
                  <Text className="pixso-tag">Jazz</Text>
                  <Text className="pixso-tag">Calm</Text>
                </div>
              </div>

              <div className="pixso-player-actions">
                <Button type="text" icon={<StepBackwardOutlined />} className="pixso-action-button" />
                <Button type="primary" shape="circle" icon={<PlayCircleFilled />} className="pixso-play-button" />
                <Button type="text" icon={<StepForwardOutlined />} className="pixso-action-button" />
              </div>

              <div className="pixso-progress-row">
                <Text type="secondary">1:52</Text>
                <Progress percent={42} showInfo={false} strokeColor="#a855f7" />
                <Text type="secondary">4:28</Text>
              </div>
            </Card>
          </div>
        </section>

        <section className="pixso-footer-card">
          <Card className="pixso-card pixso-bottom-card" bordered={false}>
            <div className="pixso-footer-left">
              <div className="pixso-now-playing">
                <Avatar size={40} shape="square" className="pixso-now-playing-avatar">
                  MJ
                </Avatar>
                <div>
                  <Text strong className="pixso-track-title">
                    Midnight Jazz
                  </Text>
                  <Text type="secondary">The Velvet Trio</Text>
                </div>
              </div>
            </div>
            <div className="pixso-footer-controls">
              <Space size="small">
                <Button type="text" icon={<RetweetOutlined />} />
                <Button type="text" icon={<StepBackwardOutlined />} />
                <Button type="text" icon={<PauseCircleFilled />} />
                <Button type="text" icon={<StepForwardOutlined />} />
                <Button type="text" icon={<HeartOutlined />} />
              </Space>
              <div className="pixso-volume-row">
                <SoundOutlined />
                <Progress percent={62} showInfo={false} strokeColor="#8b5cf6" />
              </div>
            </div>
          </Card>
        </section>
      </main>
    </div>
  );
};

export default PixsoAiRecommend;
