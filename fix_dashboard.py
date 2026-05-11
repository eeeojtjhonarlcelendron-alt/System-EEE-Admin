import re

with open('src/pages/Dashboard.jsx', 'r') as f:
    content = f.read()

# Add KPI processing completed log after filteredKPI.forEach closes
old_kpi = """      data.scorecard += parseFloat(record.scorecard) || 0
    })

    // Convert to array"""

new_kpi = """      data.scorecard += parseFloat(record.scorecard) || 0
    })
    console.log('🔍 Overall Tab Debug - KPI processing completed')

    // Convert to array"""

content = content.replace(old_kpi, new_kpi, 1)

# Add result logs before return result
old_return = """      }))

    return result"""

new_return = """      }))

    console.log('🔍 Overall Tab Debug - Result array created, length:', result.length)
    if (result.length > 0) {
      console.log('🔍 Overall Tab Debug - First result item:', result[0])
      console.log('🔍 Overall Tab Debug - Last result item:', result[result.length - 1])
    }

    return result"""

content = content.replace(old_return, new_return, 1)

with open('src/pages/Dashboard.jsx', 'w') as f:
    f.write(content)

print('Done!')
