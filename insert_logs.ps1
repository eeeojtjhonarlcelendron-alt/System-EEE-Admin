$file = 'src/pages/Dashboard.jsx'
$lines = Get-Content $file
$newLines = @()

for ($i = 0; $i -lt $lines.Count; $i++) {
    $newLines += $lines[$i]
    
    # After line 1240 (0-indexed: 1239) - after KPI forEach
    if ($i -eq 1240) {
        $newLines += "    console.log('🔍 Overall Tab Debug - KPI processing completed')"
    }
    
    # Before line 1256 (0-indexed: 1255) - before return result
    if ($i -eq 1255) {
        $newLines += "    console.log('🔍 Overall Tab Debug - Result array created, length:', result.length)"
        $newLines += "    if (result.length > 0) {"
        $newLines += "      console.log('🔍 Overall Tab Debug - First result item:', result[0])"
        $newLines += "      console.log('🔍 Overall Tab Debug - Last result item:', result[result.length - 1])"
        $newLines += "    }"
    }
}

$newLines | Set-Content $file
Write-Host 'Done!'
