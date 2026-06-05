const https = require('https');
const fs = require('fs');

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
    console.log('Fetching KPI data from Apps Script endpoint...\n');
    const data = await followRedirect(kpiUrl);
    
    if (!Array.isArray(data)) {
      console.error('❌ Data is not an array');
      return;
    }

    console.log(`✅ Successfully fetched ${data.length} records\n`);

    // Analyze all unique columns
    const allColumns = new Set();
    const columnTypes = {};
    const columnSamples = {};

    data.forEach((record, idx) => {
      Object.entries(record).forEach(([key, value]) => {
        allColumns.add(key);
        
        // Determine column type
        if (!columnTypes[key]) {
          columnTypes[key] = new Set();
        }
        const valueType = value === null ? 'null' : typeof value;
        columnTypes[key].add(valueType);

        // Store sample values
        if (!columnSamples[key]) {
          columnSamples[key] = [];
        }
        if (columnSamples[key].length < 3) {
          columnSamples[key].push(value);
        }
      });
    });

    // Display column analysis
    console.log('='.repeat(100));
    console.log('COLUMN ANALYSIS');
    console.log('='.repeat(100));
    console.log(`Total unique columns: ${allColumns.size}\n`);

    const sortedColumns = Array.from(allColumns).sort();
    
    console.log('Column Name | Data Type(s) | Sample Values');
    console.log('-'.repeat(100));

    sortedColumns.forEach((col) => {
      const displayCol = col.trim() === '' ? '[EMPTY KEY]' : col;
      const types = Array.from(columnTypes[col]).join(', ');
      const samples = columnSamples[col]
        .map(v => {
          if (v === null) return 'null';
          const str = String(v);
          return str.length > 30 ? str.substring(0, 30) + '...' : str;
        })
        .join(' | ');
      
      console.log(`${displayCol.padEnd(35)} | ${types.padEnd(20)} | ${samples}`);
    });

    // Display sample records
    console.log('\n' + '='.repeat(100));
    console.log('SAMPLE RECORDS (first 3)');
    console.log('='.repeat(100) + '\n');

    data.slice(0, 3).forEach((record, idx) => {
      console.log(`Record ${idx + 1}:`);
      Object.entries(record).forEach(([key, value]) => {
        const displayKey = key.trim() === '' ? '[EMPTY KEY]' : key;
        console.log(`  ${displayKey}: ${JSON.stringify(value)}`);
      });
      console.log();
    });

    // Save full data to file for reference
    const outputFile = 'kpi_all_data.json';
    fs.writeFileSync(outputFile, JSON.stringify(data, null, 2));
    console.log(`✅ Full data saved to ${outputFile}`);

    // Create a CSV export
    const csvFile = 'kpi_all_data.csv';
    const csvContent = [
      sortedColumns.map(c => {
        const displayCol = c.trim() === '' ? 'EMPTY_KEY' : c;
        return `"${displayCol.replace(/"/g, '""')}"`;
      }).join(','),
      ...data.map(record =>
        sortedColumns.map(col => {
          const value = record[col];
          if (value === null || value === undefined) return '';
          const str = String(value);
          return `"${str.replace(/"/g, '""')}"`;
        }).join(',')
      )
    ].join('\n');

    fs.writeFileSync(csvFile, csvContent);
    console.log(`✅ CSV export saved to ${csvFile}`);

  } catch (err) {
    console.error('❌ Error:', err.message);
  }
})();
