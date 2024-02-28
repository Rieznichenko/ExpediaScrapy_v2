const express = require('express');
const expediaRoutes = require('./routes/expediaRoutes');

const router = express.Router();

router.use('/expedia', expediaRoutes);
module.exports = router;