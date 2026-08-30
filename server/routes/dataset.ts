import { Router, Request, Response } from 'express';
import multer from 'multer';
import { datasetStore } from '../services/datasetStore.js';
import { parseExcelBuffer } from '../utils/excelParser.js';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 100 * 1024 * 1024 } // 100 MB limit
});

export const datasetRouter = Router();

// Health check endpoint
datasetRouter.get('/health', (_req: Request, res: Response) => {
  const dataset = datasetStore.getDataset();
  res.json({
    status: 'online',
    timestamp: new Date().toISOString(),
    uptimeSeconds: Math.floor(process.uptime()),
    dataset: {
      filename: dataset.meta.filename,
      rowCount: dataset.meta.rowCount,
      isCustom: dataset.meta.isCustom,
      uploadedAt: dataset.meta.uploadedAt
    }
  });
});

// Get current active dataset
datasetRouter.get('/dataset', (_req: Request, res: Response) => {
  try {
    const dataset = datasetStore.getDataset();
    res.json({
      success: true,
      meta: dataset.meta,
      shipments: dataset.shipments
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err?.message || 'Failed to retrieve dataset' });
  }
});

// Update dataset via JSON
datasetRouter.post('/dataset', async (req: Request, res: Response) => {
  try {
    const { shipments, filename } = req.body;
    if (!Array.isArray(shipments) || shipments.length === 0) {
      return res.status(400).json({ success: false, error: 'Invalid or empty shipments array.' });
    }

    const name = filename || `Dataset_${new Date().toISOString().slice(0, 10)}.xlsx`;
    const meta = await datasetStore.setDataset(shipments, name, true);

    res.json({
      success: true,
      message: `Successfully stored ${shipments.length} records.`,
      meta
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err?.message || 'Failed to save dataset' });
  }
});

// Upload Excel/CSV file and parse on server
datasetRouter.post('/upload', upload.single('file'), async (req: Request, res: Response) => {
  try {
    if (!req.file || !req.file.buffer) {
      return res.status(400).json({ success: false, error: 'No file uploaded.' });
    }

    const { shipments, error } = parseExcelBuffer(req.file.buffer);
    if (error || !shipments || shipments.length === 0) {
      return res.status(400).json({
        success: false,
        error: error || 'Failed to parse shipment records from uploaded file.'
      });
    }

    const filename = req.file.originalname || `Upload_${new Date().toISOString().slice(0, 10)}.xlsx`;
    const meta = await datasetStore.setDataset(shipments, filename, true);

    res.json({
      success: true,
      message: `Successfully parsed and saved ${shipments.length} records.`,
      meta,
      shipments
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err?.message || 'Failed to upload and parse file' });
  }
});

// Reset dataset to default
datasetRouter.delete('/dataset', async (_req: Request, res: Response) => {
  try {
    const dataset = await datasetStore.resetToDefault();
    res.json({
      success: true,
      message: 'Dataset reset to default July records.',
      meta: dataset.meta,
      shipments: dataset.shipments
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err?.message || 'Failed to reset dataset' });
  }
});

// Get quick aggregated stats
datasetRouter.get('/stats', (_req: Request, res: Response) => {
  try {
    const stats = datasetStore.getStats();
    res.json({ success: true, stats });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err?.message || 'Failed to calculate stats' });
  }
});
