const { runSeed } = require('./seedRunner');
const pool = require('../config/db');

runSeed()
  .then((result) => {
    console.log(result.message);
    console.log('Seed summary:', result.counts);
    return pool.end();
  })
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Seed failed:', err);
    process.exit(1);
  });
