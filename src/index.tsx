import React from 'react';
import ReactDOM from 'react-dom/client';
import Map from './Map';
import { checkIfWebGLSupported } from './utils';
import UnsupportedBrowser from './UnsupportedBrowser';

const root = ReactDOM.createRoot(
  document.getElementById('root') as HTMLElement
);
const isWebGLSupported = checkIfWebGLSupported();

root.render(
  <React.StrictMode>
    {isWebGLSupported ? <Map /> : <UnsupportedBrowser />}
  </React.StrictMode>
);

