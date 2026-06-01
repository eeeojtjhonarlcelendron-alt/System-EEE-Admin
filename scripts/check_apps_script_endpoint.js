const https = require('https');
const url = 'https://script.google.com/macros/s/AKfycbzLPXyqWVoKfSIyCrC2npIwCzHycPC88VAG_v9hJDXLehACxlkiuSlEgo2X0SclBNFhZw/exec';

https.get(url, (res) => {
  let data = '';
  res.on('data', (chunk) => data += chunk);
  res.on('end', () => {
    if (data.includes('<!doctype') || data.includes('<html')) {
      console.log('HTML_RESPONSE');
      return;
    }
    try {
      const json = JSON.parse(data);
      console.log('TYPE:', typeof json);
      console.log('ROOT KEYS:', Object.keys(json));
      const performanceRows = json.performance_records || json.performanceRecords || json.performance || [];
      console.log('PERFORMANCE_ROWS_LENGTH:', Array.isArray(performanceRows) ? performanceRows.length : 'NOT_ARRAY');
      if (Array.isArray(performanceRows) && performanceRows.length > 0) {
        const sample = performanceRows[0];
        console.log('SAMPLE_KEYS:', Object.keys(sample).sort());
        console.log('SAMPLE_KEYS_INCLUDES_CLUSTER:', Object.keys(sample).some(k => /cluster/i.test(k)));
      }
    } catch (err) {
      console.error('PARSE_ERR', err.message);
      if (data.length > 0) {
        const snippet = data.slice(0, 4000);
        console.log(snippet);
      }
    }
  });
}).on('error', (err) => {
  console.error('REQ_ERR', err.message);
});
