/**
 * Workflow Routes - OCR to Collection Bridge
 *
 * SINGLE RESPONSIBILITY: Bridge between OCR processing and Collection management
 * Provides clean separation between OCR and Collection systems
 */

import express from 'express';
import {approveOcrForCollection, rejectIcrResult} from '../controllers/OcrApprovalController.js';

const router = express.Router();

// ICR to Collection approval workflow
router.post('/approve-icr', approveOcrForCollection);
router.post('/reject-icr', rejectIcrResult);

export default router;
