import express from 'express';
import cors from 'cors';
import { createProxyMiddleware } from 'http-proxy-middleware';

const app = express();
const PORT = process.env.BFF_PORT || 3004;

const TEAM_A_URL = process.env.TEAM_A_URL || 'http://localhost:3001';
const TEAM_B_URL = process.env.TEAM_B_URL || 'http://localhost:3002';
const TEAM_C_URL = process.env.TEAM_C_URL || 'http://localhost:3003';

app.use(cors());

app.get('/healthz', (req, res) => {
  res.json({ status: 'UP', service: 'team-d-bff' });
});

// Proxy rules
app.use('/api/v1/eligibility', createProxyMiddleware({ target: TEAM_A_URL, changeOrigin: true }));
app.use('/api/v1/queues', createProxyMiddleware({ target: TEAM_A_URL, changeOrigin: true }));
app.use('/api/v1/rankings', createProxyMiddleware({ target: TEAM_B_URL, changeOrigin: true }));
app.use('/api/v1/profiles', createProxyMiddleware({ target: TEAM_B_URL, changeOrigin: true }));
app.use('/api/v1/analytics', createProxyMiddleware({ target: TEAM_B_URL, changeOrigin: true }));

// Team C Data Endpoints
app.use('/api/v1/students', createProxyMiddleware({ target: TEAM_C_URL, changeOrigin: true }));
app.use('/api/v1/drives', createProxyMiddleware({ target: TEAM_C_URL, changeOrigin: true }));
app.use('/api/v1/applications', createProxyMiddleware({ target: TEAM_C_URL, changeOrigin: true }));
app.use('/api/v1/offers', createProxyMiddleware({ target: TEAM_C_URL, changeOrigin: true }));
app.use('/internal/v1/outbox/stream', createProxyMiddleware({ target: TEAM_C_URL, changeOrigin: true }));

app.listen(PORT, () => {
  console.log(`Team D BFF Server running on port ${PORT}`);
});
