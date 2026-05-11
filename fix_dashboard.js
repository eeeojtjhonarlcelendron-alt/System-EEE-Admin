const fs = require('fs');

let content = fs.readFileSync('src/pages/Dashboard.jsx', 'utf8');

// Add KPI processing completed log
const oldKpi = `      data.scorecard += parseFloat(record.scorecard) || 0
    })

    // Convert to array`;

const newKpi = `      data.scorecard += parseFloat(record.scorecard) || 0
    })
    console.log('🔍 Overall Tab Debug - KPI processing completed')

    // Convert to array`;

content = content.replace(oldKpi, newKpi);

// Add result logs
const oldReturn = `      }))

    return result`;

const newReturn = `      }))

    console.log('🔍 Overall Tab Debug - Result array created, length:', result.length)
    if (result.length > 0) {
      console.log('🔍 Overall Tab Debug - First result item:', result[0])
      console.log('🔍 Overall Tab Debug - Last result item:', result[result.length - 1])
    }

    return result`;

content = content.replace(oldReturn, newReturn);

fs.writeFileSync('src/pages/Dashboard.jsx', content);
console.log('Done!');
