import React from 'react';
import { Card, Input, Typography, Avatar, Button, Progress, Space } from 'antd';
import {
  SearchOutlined,
  HomeOutlined,
  CompassOutlined,
  CrownOutlined,
  SettingOutlined,
  StepBackwardOutlined,
  StepForwardOutlined,
  PlayCircleFilled,
  PauseCircleFilled,
  RetweetOutlined,
  HeartOutlined,
  SoundOutlined,
} from '@ant-design/icons';
import './PixsoExplore.css';

const { Title, Text } = Typography;

const PixsoExplore = () => {
  return (
    <div className="pixso-explore">
      <aside className="pixso-explore-sider">
        <Space direction="vertical" size="middle" className="pixso-explore-nav">
          <Button type="primary" shape="circle" icon={<HomeOutlined />} />
          <Button shape="circle" icon={<CompassOutlined />} />
          <Button shape="circle" icon={<CrownOutlined />} />
          <Button shape="circle" icon={<SettingOutlined />} />
        </Space>
        <Avatar size={48} className="pixso-explore-avatar">
          U
        </Avatar>
      </aside>

      <main className="pixso-explore-main">
        <div className="pixso-explore-header">
          <div>
            <Text className="pixso-label">Explore</Text>
            <Title level={2} className="pixso-title">
              今日心情电台
            </Title>
            <Text className="pixso-subtitle">
              根据您的情绪，精选策划的音乐旅程
            </Text>
          </div>
          <Input
            className="pixso-search"
            size="large"
            placeholder="Search music, moods..."
            prefix={<SearchOutlined />}
          />
        </div>

        <Card className="pixso-hero-card" bordered={false}>
          <div className="pixso-hero-top">
            <Text className="pixso-tag">AI 发现</Text>
            <Space split={<span className="pixso-hero-badge">·</span>}>
              <Text strong className="pixso-hero-title">
                今日心情电台
              </Text>
            </Space>
          </div>
          <Text className="pixso-hero-description">
            根据您的情绪，精选策划的音乐旅程
          </Text>
        </Card>

        <section className="pixso-chart-section">
          <div className="pixso-chart-header">
            <Title level={4} className="pixso-chart-title">
              Top Charts
            </Title>
            <Button type="link" className="pixso-chart-viewall">
              View all
            </Button>
          </div>

          <div className="pixso-chart-grid">
            {[
              { label: 'Spotify', title: 'Global Top 50', count: '50 songs' },
              { label: 'NetEase Cloud', title: '云音乐热歌榜', count: '100 songs' },
              { label: 'Apple Music', title: 'Today’s Hits', count: '30 songs' },
            ].map((item) => (
              <Card key={item.label} className="pixso-chart-card" bordered={false}>
                <Text className="pixso-chart-card-label">{item.label}</Text>
                <Title level={5} className="pixso-chart-card-title">
                  {item.title}
                </Title>
                <Text type="secondary">{item.count}</Text>
              </Card>
            ))}
          </div>
        </section>

        <Card className="pixso-player-card" bordered={false}>
          <div className="pixso-player-row">
            <div className="pixso-player-meta">
              <Avatar size={54} shape="square" className="pixso-player-avatar">
                MJ
              </Avatar>
              <div>
                <Text strong className="pixso-player-name">
                  Midnight Jazz
                </Text>
                <Text type="secondary">The Velvet Trio</Text>
              </div>
            </div>

            <div className="pixso-player-controls">
              <Space size="middle">
                <Button type="text" icon={<RetweetOutlined />} />
                <Button type="text" icon={<StepBackwardOutlined />} />
                <Button type="primary" shape="circle" icon={<PlayCircleFilled />} className="pixso-play-cta" />
                <Button type="text" icon={<StepForwardOutlined />} />
                <Button type="text" icon={<HeartOutlined />} />
              </Space>
              <div className="pixso-player-volume">
                <SoundOutlined />
                <Progress percent={62} showInfo={false} strokeColor="#8b5cf6" />
              </div>
            </div>
          </div>
        </Card>
      </main>
    </div>
  );
};

export default PixsoExplore;
