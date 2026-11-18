import { createRoot } from 'react-dom/client';
import App from './App';
import './index.css';

const root = document.getElementById('root');
if (!root) throw new Error('App root is missing.');

// No StrictMode double-invoke: draft creation and queue triggers are one-shot
// side effects that must not be replayed on mount in development.
createRoot(root).render(<App />);
