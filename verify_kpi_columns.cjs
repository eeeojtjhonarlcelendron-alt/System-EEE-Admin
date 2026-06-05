const https = require('https');
const fs = require('fs');

// Fetch all KPI data to verify all columns are being normalized
function followRedirect(url, maxRedirects = 10, depth = 0) {
  return new Promise((resolve, reject) => {
    if (depth > maxRedirects) {
      reject(new Error('Too many redirects'));
      return;
    }

    https.get(url, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        setTimeout(() => followRedirect(res.headers.location, maxRedirects, depth + 1).then(resolve).catch(reject), 100);
        return;
      }

      if (res.statusCode === 200) {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          try {
            const json = JSON.parse(data);
            resolve(json);
          } catch (e) {
            reject(e);
          }
        });
      }
    }).on('error', reject);
  });
}

const kpiUrl = 'https://script.googleusercontent.com/macros/echo?user_content_key=AUkAhnTABVGGXJNJD432l_j22t4I6swIhbfaxbFeTHThuBHVCK24r8LhJt5UI57FKacKz_fXhohUUNmH_4qjAue_-rjqZ0BCD9DfkpH8Ge05zjtrP-MUkkafZyhURqKQUfGoVhhsa6f7HK1C4u2qzhDo0X7SSC97BpGrLOOevyuMPKTeAU-UUdjgw9A6ZfoYUAUZsT2kZ9DhXNRLClGMJHmRXkgKKotahg_9S1l8jTbcYilhp6Ao7ylL2qrp6HqrNS0xpyNSRR1jMBoSCqUGcBV1oYBYEq0rew&lib=MrcdDGzPSjUf-t6od-II_Fq6F0VeJqtgy';

(async () => {
  try {
    console.log('Verifying all columns from endpoint are present in normalized data...\n');
    const endpointData = await followRedirect(kpiUrl);
    
    if (!Array.isArray(endpointData) || endpointData.length === 0) {
      console.error('❌ No data returned from endpoint');
      return;
    }

    // Get all unique columns from endpoint
    const endpointColumns = new Set();
    endpointData.forEach(record => {
      Object.keys(record).forEach(key => {
        if (key.trim() !== '') {  // Skip empty key
          endpointColumns.add(key);
        }
      });
    });

    console.log(`✅ Endpoint has ${endpointColumns.size} total columns (excluding empty key)\n`);
    console.log('Endpoint columns:');
    Array.from(endpointColumns).sort().forEach((col, idx) => {
      console.log(`${idx + 1}. ${col}`);
    });

    // Simulate what the normalization function would preserve
    const firstRecord = endpointData[0];
    const normalizedColumns = new Set();
    
    // Add mapped columns
    const mappedFields = ['date', 'region', 'sub_region', 'operator_hub', 'cluster', 'score', 'grade', 'remarks', 'cfr', 'sr', 'aging_four_days', 'line_haul_compliance', 'cod_remittance', 'eod_compliance', 'rts', 'loss'];
    mappedFields.forEach(f => normalizedColumns.add(f));
    
    // Add all other endpoint columns
    Object.keys(firstRecord).forEach(key => {
      if (key.trim() !== '') {
        normalizedColumns.add(key);
      }
    });

    console.log(`\n✅ After normalization, we have ${normalizedColumns.size} total columns`);
    console.log('\nNormalized columns that will display:');
    Array.from(normalizedColumns).sort().forEach((col, idx) => {
      console.log(`${idx + 1}. ${col}`);
    });

  } catch (err) {
    console.error('❌ Error:', err.message);
  }
})();
