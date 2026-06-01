import * as ds from './src/lib/dataService.js';

async function run() {
  const { data, error } = await ds.initializeDataService();
  console.log('error', error);
  if (data && data.performance_records) {
    const sample = data.performance_records.slice(0, 20);
    console.log('sample dates:', sample.map(r => r.date));
    const latest = [...new Set(data.performance_records.map(r => String(r.date || '').split('T')[0]).filter(Boolean))].sort().pop();
    console.log('latest', latest, 'count', data.performance_records.filter(r => String(r.date || '').split('T')[0] === latest).length);
  }
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
