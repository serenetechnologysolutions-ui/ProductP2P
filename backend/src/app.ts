import express from 'express';
import cors from 'cors';
import { config } from './config/env';
import { errorHandler, notFoundHandler } from './common/middleware';
import authRoutes from './modules/auth/auth.routes';
import vendorRoutes from './modules/vendor/vendor.routes';
import asnRoutes from './modules/asn/asn.routes';
import validationRoutes from './modules/validation/validation.routes';
import erpRoutes from './modules/erp/erp.routes';

const app = express();

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Health check
app.get('/api/health', (req, res) => {
  res.json({ success: true, message: 'Vendor Portal API is running', timestamp: new Date().toISOString() });
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/vendors', vendorRoutes);
app.use('/api/asns', asnRoutes);
app.use('/api/validation', validationRoutes);
app.