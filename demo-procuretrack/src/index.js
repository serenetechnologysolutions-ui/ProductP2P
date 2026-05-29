import React from 'react';
import ReactDOM from 'react-dom/client';
import { ConfigProvider, message } from 'antd';
import App from './App';
import './global.css';

message.config({ duration: 4, top: 60 });

const theme = {
  token: { colorPrimary: '#1890ff', borderRadius: 6, fontSize: 14, controlHeight: 38 },
  components: {
    Input: { controlHeight: 38, borderRadius: 6 },
    Select: { controlHeight: 38, borderRadius: 6 },
    Button: { controlHeight: 36, borderRadius: 6 },
    Card: { borderRadius: 8 },
    Table: { headerBg: '#fafafa', rowHoverBg: '#f0f7ff' },
  },
};

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<ConfigProvider theme={theme}><App /></ConfigProvider>);
