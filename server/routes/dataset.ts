import { Router, Request, Response } from 'express';
import multer from 'multer';
import * as XLSX from 'xlsx';
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

// Get current active dataset (with auto-sync if Excel files were modified externally)
datasetRouter.get('/dataset', async (_req: Request, res: Response) => {
  try {
    if (datasetStore.hasExternalExcelModifications()) {
      console.log('[DatasetRoute] 🔔 Master Excel files modified externally. Auto-syncing...');
      await datasetStore.reloadFromMasterExcelFiles();
    }
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

// Force manual sync from master Excel files
datasetRouter.post('/dataset/sync-excel', async (_req: Request, res: Response) => {
  try {
    console.log('[DatasetRoute] Manual Excel sync requested by client.');
    const meta = await datasetStore.reloadFromMasterExcelFiles();
    const dataset = datasetStore.getDataset();
    res.json({
      success: true,
      message: `Successfully reloaded ${dataset.shipments.length} records from root Excel files.`,
      meta,
      shipments: dataset.shipments
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err?.message || 'Failed to sync from Excel files' });
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

// Update single shipment delay reason and remarks
const handleUpdateShipment = async (req: Request, res: Response) => {
  try {
    const { awb } = req.params;
    const { transitDelay, clearanceDelay, destinationDelay, weekendDelay, remarks, finalResolution } = req.body;

    if (!awb) {
      return res.status(400).json({ success: false, error: 'AWB tracking number is required.' });
    }

    const updates: Record<string, any> = {};
    if (transitDelay !== undefined) updates.transitDelay = String(transitDelay).trim();
    if (clearanceDelay !== undefined) updates.clearanceDelay = String(clearanceDelay).trim();
    if (destinationDelay !== undefined) updates.destinationDelay = String(destinationDelay).trim();
    if (weekendDelay !== undefined) updates.weekendDelay = String(weekendDelay).trim();
    if (remarks !== undefined) updates.remarks = String(remarks).trim();
    if (finalResolution !== undefined) updates.finalResolution = String(finalResolution).trim();

    const updatedShipment = await datasetStore.updateShipment(awb, updates);
    if (!updatedShipment) {
      return res.status(404).json({ success: false, error: `Shipment with AWB ${awb} was not found in active dataset.` });
    }

    res.json({
      success: true,
      message: `Delay details updated successfully for AWB ${awb}.`,
      shipment: updatedShipment
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err?.message || 'Failed to update shipment delay' });
  }
};

datasetRouter.patch('/shipments/:awb', handleUpdateShipment);
datasetRouter.post('/shipments/:awb', handleUpdateShipment);

// Export current active dataset as Excel file
datasetRouter.get('/export-excel', (_req: Request, res: Response) => {
  try {
    const dataset = datasetStore.getDataset();
    const worksheet = XLSX.utils.json_to_sheet(dataset.shipments);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Data');
    const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
    
    const filename = `Updated_Shipments_${new Date().toISOString().slice(0, 10)}.xlsx`;
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.send(buffer);
  } catch (err: any) {
    res.status(500).json({ success: false, error: err?.message || 'Failed to export Excel file' });
  }
});
