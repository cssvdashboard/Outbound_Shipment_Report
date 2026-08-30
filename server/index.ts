import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { datasetRouter } from './routes/dataset.js';
import { datasetStore } from './services/datasetStore.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || (process.env.NODE_ENV === 'production' ? 3000 : 3001);

// Middleware
app.use(cors());
app.use(express.json({ limit: '100mb' }));
app.use(express.urlencoded({ extended: true, limit: '100mb' }));

// Request Logging
app.use((req: Request, _res: Response, next: NextFunction) => {
  if (req.path.startsWith('/api')) {
    console.log(`[${new Date().toLocaleTimeString()}] ${req.method} ${req.path}`);
  }
  next();
});

// API Routes
app.use('/api', datasetRouter);

// Serve Static Frontend Assets from /dist if built
const DIST_PATH = path.resolve(__dirname, '../dist');
if (fs.existsSync(DIST_PATH)) {
  app.use(express.static(DIST_PATH));

  // SPA Fallback: send index.html for all non-API client routes
  app.use((req: Request, res: Response, next: NextFunction) => {
    if (req.path.startsWith('/api')) {
      return next();
    }
    res.sendFile(path.join(DIST_PATH, 'index.html'));
  });
} else {
  // If dist doesn't exist yet, show API landing page
  app.get('/', (_req: Request, res: Response) => {
    res.json({
      name: 'Logistics Dashboard API Server',
      status: 'online',
      endpoints: {
        health: '/api/health',
        dataset: '/api/dataset',
        stats: '/api/stats',
        upload: 'POST /api/upload',
        reset: 'DELETE /api/dataset'
      },
      note: 'Run `npm run build` to compile and serve the frontend dashboard alongside this API.'
    });
  });
}

// Error handling middleware
app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
  console.error('[Server Error]:', err);
  res.status(err.status || 500).json({
    success: false,
    error: err.message || 'Internal Server Error'
  });
});

// Start Server
async function startServer() {
  try {
    console.log('----------------------------------------------------');
    console.log('🚀 Starting Logistics Dashboard Server...');
    await datasetStore.initialize();
    
    app.listen(PORT, () => {
      console.log(`✅ Server is running on: http://localhost:${PORT}`);
      console.log(`📡 API Health Endpoint: http://localhost:${PORT}/api/health`);
      console.log(`📦 Dataset API:         http://localhost:${PORT}/api/dataset`);
      console.log('----------------------------------------------------');
    });
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

startServer();
