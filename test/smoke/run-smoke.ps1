# coc.nvim smoke test for merls language server.
#
# Launches Vim in headless mode with a minimal coc.nvim configuration,
# opens an .asm fixture file, waits for the language server to start and
# publish diagnostics, then exits with 0 on success / 1 on failure.
#
# Usage:  pwsh test/smoke/run-smoke.ps1

$ErrorActionPreference = "Stop"

$projectRoot = (Resolve-Path "$PSScriptRoot/../..").Path
$smokeDir    = "$projectRoot/test/smoke"
$fixture     = "$projectRoot/test/fixtures/valid/smoke-test.asm"
$cliPath     = "$projectRoot/dist/src/cli.js"

# Ensure the project is built
if (-not (Test-Path $cliPath)) {
    Write-Host "Building project..."
    Push-Location $projectRoot
    npm run build
    Pop-Location
}

# Create an isolated temporary directory for coc.nvim config/data
$tmpBase   = "$projectRoot/test/smoke/tmp"
$configDir = "$tmpBase/config"
$dataDir   = "$tmpBase/data"

if (Test-Path $tmpBase) { Remove-Item -Recurse -Force $tmpBase }
New-Item -ItemType Directory -Force -Path $configDir | Out-Null
New-Item -ItemType Directory -Force -Path $dataDir   | Out-Null

# Write the coc-settings.json into the temporary config directory
$cocSettings = @{
    languageserver = @{
        merls = @{
            command      = "node"
            args         = @($cliPath.Replace("\", "/"), "--stdio")
            rootPatterns = @(".git", "package.json")
            filetypes    = @("asm")
        }
    }
} | ConvertTo-Json -Depth 5

Set-Content -Path "$configDir/coc-settings.json" -Value $cocSettings

# Write a tiny Vim script that will:
#   1. Open the fixture file
#   2. Wait for coc.nvim to attach the language server
#   3. Check CocAction('diagnosticList') for expected diagnostics
#   4. Write results to a file and quit
$checkScript = @"
" Wait for coc.nvim to be ready, then run checks.
function! s:RunChecks(timer)
    " Check if coc.nvim is running
    try
        let l:services = CocAction('services')
    catch
        " coc.nvim not ready yet, retry
        call timer_start(1000, function('s:RunChecks'))
        return
    endtry

    let l:result_file = '$($tmpBase.Replace("\", "/"))/result.txt'
    let l:lines = []

    " Check that the merls service is running
    let l:found = 0
    for l:svc in l:services
        if l:svc.id =~# 'merls'
            let l:found = 1
            let l:state = l:svc.state
            call add(l:lines, 'SERVICE: merls ' . l:state)
        endif
    endfor

    if !l:found
        call add(l:lines, 'SERVICE: merls NOT FOUND')
        call writefile(l:lines, l:result_file)
        qall!
        return
    endif

    " Wait a moment for diagnostics to arrive, then collect them
    call timer_start(2000, {-> s:CollectDiagnostics(l:lines, l:result_file)})
endfunction

function! s:CollectDiagnostics(lines, result_file)
    try
        let l:diags = CocAction('diagnosticList')
        call add(a:lines, 'DIAGNOSTICS_COUNT: ' . len(l:diags))
        for l:d in l:diags
            call add(a:lines, 'DIAG: ' . l:d.severity . ' | ' . l:d.message)
        endfor
    catch
        call add(a:lines, 'DIAGNOSTICS_ERROR: ' . v:exception)
    endtry

    call writefile(a:lines, a:result_file)
    qall!
endfunction

" Start the check timer after a 3 second delay to let coc.nvim initialize
call timer_start(3000, function('s:RunChecks'))
"@

Set-Content -Path "$smokeDir/check.vim" -Value $checkScript

# Run Vim in headless mode
Write-Host "Starting Vim headless smoke test..."
$env:MERLS_SMOKE_CONFIG = $configDir
$env:MERLS_SMOKE_DATA   = $dataDir

$vimArgs = @(
    "-u", "$smokeDir/vimrc",
    "-N",              # nocompatible
    "--not-a-term",    # headless
    "-S", "$smokeDir/check.vim",
    $fixture
)

$vimProcess = Start-Process -FilePath "vim" -ArgumentList $vimArgs `
    -PassThru -NoNewWindow -Wait -ErrorAction Stop

# Read results
$resultFile = "$tmpBase/result.txt"
if (-not (Test-Path $resultFile)) {
    Write-Host "FAIL: Vim exited without writing results."
    exit 1
}

$results = Get-Content $resultFile
Write-Host ""
Write-Host "=== Smoke test results ==="
$results | ForEach-Object { Write-Host "  $_" }
Write-Host ""

# Validate
$passed = $true

# Check service was found and running
$serviceLine = $results | Where-Object { $_ -match "^SERVICE:" }
if ($serviceLine -match "running") {
    Write-Host "PASS: merls language server is running in coc.nvim"
} else {
    Write-Host "FAIL: merls language server not running. Got: $serviceLine"
    $passed = $false
}

# Check diagnostics were received
$diagCountLine = $results | Where-Object { $_ -match "^DIAGNOSTICS_COUNT:" }
if ($diagCountLine) {
    $count = [int]($diagCountLine -replace "DIAGNOSTICS_COUNT:\s*", "")
    if ($count -gt 0) {
        Write-Host "PASS: received $count diagnostic(s) from merls"
    } else {
        Write-Host "FAIL: expected at least 1 diagnostic, got 0"
        $passed = $false
    }
} else {
    Write-Host "FAIL: no diagnostic count in results"
    $passed = $false
}

# Cleanup
Remove-Item -Recurse -Force $tmpBase -ErrorAction SilentlyContinue
Remove-Item -Force "$smokeDir/check.vim" -ErrorAction SilentlyContinue

if ($passed) {
    Write-Host ""
    Write-Host "Smoke test PASSED."
    exit 0
} else {
    Write-Host ""
    Write-Host "Smoke test FAILED."
    exit 1
}
