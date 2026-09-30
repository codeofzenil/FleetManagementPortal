require('dotenv').config();
const express = require('express');
const cors = require('cors');
const app = express();

app.use(cors());
app.use(express.json());

app.use('/api/auth', require('./routes/auth.routes'));
app.use('/api/vehicles', require('./routes/vehicle.routes'));
app.use('/api/drivers', require('./routes/driver.routes'));
app.use('/api/parcels', require('./routes/parcel.routes'));
app.use('/api/assignments', require('./routes/assignment.routes'));
app.use('/api/dashboard', require('./routes/dashboard.routes'));
app.use('/api/locations', require('./routes/location.routes'));

app.get('/api/health', (req, res) => res.json({ status: 'ok' }));

app.use((req, res) => res.status(404).json({ error: 'Route not found' }));
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`STMPAS backend running on port ${PORT}`));
