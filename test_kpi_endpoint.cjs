const https = require('https');

const kpiUrl = 'https://script.googleusercontent.com/macros/echo?user_content_key=AUkAhnTABVGGXJNJD432l_j22t4I6swIhbfaxbFeTHThuBHVCK24r8LhJt5UI57FKacKz_fXhohUUNmH_4qjAue_-rjqZ0BCD9DfkpH8Ge05zjtrP-MUkkafZyhURqKQUfGoVhhsa6f7HK1C4u2qzhDo0X7SSC97BpGrLOOevyuMPKTeAU-UUdjgw9A6ZfoYUAUZsT2kZ9DhXNRLClGMJHmRXkgKKotahg_9S1l8jTbcYilhp6Ao7ylL2qrp6HqrNS0xpyNSRR1jMBoSCqUGcBV1oYBYEq0rew&lib=MrcdDGzPSjUf-t6od-II_Fq6F0VeJqtgy';

console.log('Testing KPI Endpoint...\n');

https.get(kpiUrl, (res) => {
  let data = '';
  
  res.on('data', chunk => {
    data += chunk;
  });
  
  res.on('end', () => {
    console.log('Response Status:', res.statusCode);
    console.log('Response Length:', data.length);
    
    try {
      const json = JSON.parse(data);
      console.log('\n✓ Valid JSON');
      console.log('Is Array:', Array.isArray(json));
      
      if (Array.isArray(json)) {
        console.log('Record Count:', json.length);
        if (json.length > 0) {
          console.log('\nFirst Record Keys:');
          Object.keys(json[0]).forEach(key => {
            console.log(`  - ${key}: ${typeof json[0][key]} = ${String(json[0][key]).substring(0, 50)}`);
          });
        }
      } else {
        console.log('Root Keys:', Object.keys(json).slice(0, 5).join(', '));
      }
    } catch (e) {
      console.log('❌ JSON Parse Error:', e.message);
      console.log('First 500 chars:', data.substring(0, 500));
    }
  });
}).on('error', (e) => {
  console.error('❌ Request Error:', e.message);
});
