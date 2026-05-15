import { Buffer } from 'buffer';
import process from 'process';
import EventEmitter from 'events';
import { Readable } from 'stream-browserify';

// @ts-ignore
window.global = window;
// @ts-ignore
window.Buffer = Buffer;
// @ts-ignore
window.process = process;
// @ts-ignore
window.process.env = window.process.env || {};
// @ts-ignore
if (typeof __GEMINI_API_KEY__ !== 'undefined') {
  // @ts-ignore
  window.process.env.GEMINI_API_KEY = __GEMINI_API_KEY__;
}

// @ts-ignore
window.EventEmitter = EventEmitter;
// @ts-ignore
window.Readable = Readable;

import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
