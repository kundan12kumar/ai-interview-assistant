import React from 'react';
import ReactDOM from 'react-dom/client';
import { Provider } from 'react-redux';
import { PersistGate } from 'redux-persist/integration/react';
import { ConfigProvider } from 'antd';
import { store, persistor } from './redux/store';
import App from './App';
import './styles/index.css';
import 'antd/dist/reset.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <Provider store={store}>
      <PersistGate loading={null} persistor={persistor}>
        <ConfigProvider
          theme={{
            token: {
              colorPrimary: '#667eea',
              borderRadius: 8
            }
          }}
        >
          <App />
        </ConfigProvider>
      </PersistGate>
    </Provider>
  </React.StrictMode>
);