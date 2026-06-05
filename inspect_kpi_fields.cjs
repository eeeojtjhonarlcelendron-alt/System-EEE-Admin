const https = require('https');

function followRedirect(url, maxRedirects = 10, depth = 0) {
  if (depth > maxRedirects) {
    console.log('❌ Too many redirects');
    return;
  }

  https.get(url, (res) => {
    if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
      setTimeout(() => followRedirect(res.headers.location, maxRedirects, depth + 1), 100);
      return;
    }

    if (res.statusCode === 200) {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          
          console.log('=== KPI Endpoint Inspection ===\n');
          console.log('Total Records:', json.length);
          
          if (json.length > 0) {
            const record = json[0];
            console.log('\nFirst Record Fields:');
            Object.entries(record).forEach(([key, value]) => {
              const displayKey = key.trim() === '' ? '[EMPTY KEY]' : key;
              const displayValue = String(value).substring(0, 60);
              console.log(`  "${displayKey}": "${displayValue}"`);
            });
            
            console.log('\n\nField Key Analysis:');
            const allKeys = json.reduce((keys, record) => {
              Object.keys(record).forEach(key => {
                if (!keys.includes(key)) keys.push(key);
              });
              return keys;
            }, []);
            
            console.log('Unique field names found:');
            allKeys.forEach(key => {
              const displayKey = key.trim() === '' ? '[EMPTY KEY]' : key;
              console.log(`  - "${displayKey}"`);
            });
          }
        } catch (e) {
          console.log('Error parsing JSON:', e.message);
        }
      });
    }
  }).on('error', e => console.error('Error:', e.message));
}

const kpiUrl = 'https://script.googleusercontent.com/macros/echo?user_content_key=AUkAhnTABVGGXJNJD432l_j22t4I6swIhbfaxbFeTHThuBHVCK24r8LhJt5UI57FKacKz_fXhohUUNmH_4qjAue_-rjqZ0BCD9DfkpH8Ge05zjtrP-MUkkafZyhURqKQUfGoVhhsa6f7HK1C4u2qzhDo0X7SSC97BpGrLOOevyuMPKTeAU-UUdjgw9A6ZfoYUAUZsT2kZ9DhXNRLClGMJHmRXkgKKotahg_9S1l8jTbcYilhp6Ao7ylL2qrp6HqrNS0xpyNSRR1jMBoSCqUGcBV1oYBYEq0rew&lib=MrcdDGzPSjUf-t6od-II_Fq6F0VeJqtgy';

followRedirect(kpiUrl);
