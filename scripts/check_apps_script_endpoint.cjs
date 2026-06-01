const https = require('https');
const url = 'https://script.google.com/macros/s/AKfycbzLPXyqWVoKfSIyCrC2npIwCzHycPC88VAG_v9hJDXLehACxlkiuSlEgo2X0SclBNFhZw/exec';

function fetchJson(requestUrl, redirectCount = 0) {
  if (redirectCount > 5) {
    console.error('TOO_MANY_REDIRECTS');
    return;
  }

  https.get(requestUrl, (res) => {
    if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
      fetchJson(res.headers.location, redirectCount + 1);
      return;
    }

    let data = '';
    res.on('data', (chunk) => data += chunk);
    res.on('end', () => {
      if (data.includes('<!doctype') || data.includes('<html')) {
        console.log('HTML_RESPONSE');
        console.log(data.slice(0, 800));
        return;
      }
      try {
        const json = JSON.parse(data);
        const isArray = Array.isArray(json);
        console.log('TYPE:', typeof json, 'IS_ARRAY:', isArray);
        console.log('ROOT_SIZE:', isArray ? json.length : Object.keys(json).length);
        if (isArray && json.length > 0) {
          const sample = json[0];
          console.log('SAMPLE_KEYS:', Object.keys(sample).sort());
          console.log('SAMPLE_KEYS_INCLUDES_CLUSTER:', Object.keys(sample).some(k => /cluster/i.test(k)));
          console.log('SAMPLE_VALUE_CLUSTER:', Object.entries(sample).filter(([k]) => /cluster/i.test(k)).slice(0, 20));
          console.log('SAMPLE_ROW:', JSON.stringify(sample, null, 2).slice(0, 1200));
          const hasHeadings = json.some(item => Object.keys(item).some(k => /cluster/i.test(k)));
          console.log('ANY_RECORD_INCLUDES_CLUSTER:', hasHeadings);
        } else if (!isArray) {
          const values = Object.values(json);
          console.log('FIRST_VALUE_TYPE:', values.length > 0 ? typeof values[0] : 'NONE');
          if (values.length > 0 && typeof values[0] === 'object' && values[0] !== null) {
            const sample = values[0];
            console.log('FIRST_OBJECT_KEYS:', Object.keys(sample).sort());
            console.log('FIRST_OBJECT_INCLUDES_CLUSTER:', Object.keys(sample).some(k => /cluster/i.test(k)));
            console.log('FIRST_OBJECT_CLUSTER_ENTRIES:', Object.entries(sample).filter(([k]) => /cluster/i.test(k)).slice(0, 20));
          }
          console.log('ROOT_VALUE_FIRST_ITEM:', JSON.stringify(values[0], null, 2).slice(0, 2000));
        }
        const performanceRows = json.performance_records || json.performanceRecords || json.performance || json;
        console.log('PERFORMANCE_ROWS_LENGTH:', Array.isArray(performanceRows) ? performanceRows.length : 'NOT_ARRAY');
      } catch (err) {
        console.error('PARSE_ERR', err.message);
        if (data.length > 0) {
          console.log(data.slice(0, 2000));
        }
      }
    });
  }).on('error', (err) => {
    console.error('REQ_ERR', err.message);
  });
}

fetchJson(url);
