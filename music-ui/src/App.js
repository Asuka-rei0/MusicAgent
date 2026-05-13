import React, { useState } from 'react';
import { Layout, Menu, Button, Switch, Slider, Card, List } from 'antd';
import {
  MenuUnfoldOutlined,
  MenuFoldOutlined,
  HomeOutlined,
  RobotOutlined,
  BarChartOutlined,
  SettingOutlined,
  HeartOutlined,
  SoundOutlined,
} from '@ant-design/icons';
import ReactECharts from 'echarts-for-react';
import PixsoAiRecommend from './components/PixsoAiRecommend';
import PixsoExplore from './components/PixsoExplore';
import PixsoFig3 from './components/PixsoFig3';
import PixsoFig4 from './components/PixsoFig4';
import 'antd/dist/reset.css';

const { Sider, Content, Footer } = Layout;

const App = () => {
  const [collapsed, setCollapsed] = useState(false);
  const [activeTab, setActiveTab] = useState('library');

  const menuItems = [
    { key: 'library', icon: <HomeOutlined />, label: 'Music Library' },
    { key: 'ai', icon: <RobotOutlined />, label: 'AI Recommend' },
    { key: 'explore', icon: <BarChartOutlined />, label: 'Explore' },
    { key: 'fig3', icon: <SoundOutlined />, label: 'Library View' },
    { key: 'fig4', icon: <SettingOutlined />, label: 'Settings View' },
    { key: 'settings', icon: <SettingOutlined />, label: 'Settings' },
  ];

  const weeklyChartOption = {
    xAxis: { type: 'category', data: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] },
    yAxis: { type: 'value' },
    series: [{
      type: 'line', smooth: true, data: [10, 20, 15, 30, 25, 35, 40],
      areaStyle: { color: '#38bdf8' },
    }],
  };

  const pieChartOption = {
    series: [{
      type: 'pie', radius: ['40%', '70%'],
      data: [
        { value: 15, name: 'Spotify' },
        { value: 12, name: 'NetEase' },
        { value: 15, name: 'Local' },
      ],
    }],
  };

  return (
    <Layout className="h-screen bg-[#111827]">
      <Sider
        trigger={null}
        collapsible
        collapsed={collapsed}
        className="bg-gray-900/70 backdrop-blur-lg"
      >
        <div className="h-8 m-4 text-white text-center">🎵 Music AI</div>
        <Menu
          theme="dark"
          mode="inline"
          selectedKeys={[activeTab]}
          items={menuItems}
          onClick={({ key }) => setActiveTab(key)}
        />
      </Sider>

      <Layout>
        <Content className="m-4 p-6 bg-gray-800/40 backdrop-blur-xl rounded-lg overflow-auto">
          {activeTab === 'library' && (
            <div className="space-y-6">
              <h2 className="text-white text-xl font-bold">Music Library</h2>
              <div className="grid grid-cols-2 gap-6">
                <Card className="bg-gray-800/50 border-none text-white">
                  <h3>Weekly Report</h3>
                  <ReactECharts option={weeklyChartOption} />
                </Card>
                <Card className="bg-gray-800/50 border-none text-white">
                  <h3>Listening Time: 42h</h3>
                  <ReactECharts option={pieChartOption} />
                </Card>
              </div>
              <Card className="bg-gray-800/50 border-none text-white">
                <List
                  dataSource={[
                    { title: 'Midnight Jazz', artist: 'Unknown Artist' },
                    { title: 'Autumn Leaves', artist: 'Miles Davis' },
                  ]}
                  renderItem={(item) => (
                    <List.Item className="text-gray-200">
                      {item.title} - {item.artist}
                    </List.Item>
                  )}
                />
              </Card>
            </div>
          )}

          {activeTab === 'ai' && <PixsoAiRecommend />}

          {activeTab === 'explore' && <PixsoExplore />}

          {activeTab === 'fig3' && <PixsoFig3 />}

          {activeTab === 'fig4' && <PixsoFig4 />}

          {activeTab === 'settings' && (
            <div className="space-y-6 text-white">
              <h2 className="text-xl font-bold">Settings</h2>
              <Card className="bg-gray-800/50 border-none">
                <div className="flex justify-between items-center mb-3">
                  <span>深色模式</span>
                  <Switch defaultChecked />
                </div>
                <div className="flex justify-between items-center">
                  <span>桌面歌词</span>
                  <Switch defaultChecked />
                </div>
              </Card>
            </div>
          )}
        </Content>

        <Footer className="bg-gray-900/80 backdrop-blur-lg h-16 flex items-center px-6 text-white justify-between">
          <div>正在播放：Midnight Jazz</div>
          <div className="flex items-center gap-4 w-1/3">
            <Button type="text" icon={<HeartOutlined />} className="text-white" />
            <Slider defaultValue={60} className="w-full" />
            <SoundOutlined />
          </div>
        </Footer>
      </Layout>
    </Layout>
  );
};

export default App;