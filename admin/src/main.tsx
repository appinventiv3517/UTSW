import { createRoot } from 'react-dom/client';
import './styles/tokens.css';
import './styles/admin.css';
import { loadDb } from './services/services';
import { App, startSession } from './app/App';

loadDb();
startSession();
createRoot(document.getElementById('app')!).render(<App />);
