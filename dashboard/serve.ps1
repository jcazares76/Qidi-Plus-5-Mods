# Serves the QIDI Box slot editor page on http://localhost:8765/ (this PC only).
# The printer's Moonraker already allows web pages from localhost, so no printer
# settings need changing. Close this window to stop it.
param([int]$Port = 8765, [switch]$NoBrowser)

$page = Join-Path $PSScriptRoot 'index.html'
$prefix = "http://localhost:$Port/"
$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add($prefix)
try { $listener.Start() } catch {
    Write-Host "Could not start on port $Port (already running?). Opening the page anyway."
    if (-not $NoBrowser) { Start-Process $prefix }
    exit 1
}
Write-Host "QIDI Box slot editor running at $prefix"
Write-Host "Leave this window open while you use it. Close it to stop."
if (-not $NoBrowser) { Start-Process $prefix }

try {
    while ($listener.IsListening) {
        $ctx = $listener.GetContext()
        $res = $ctx.Response
        try {
            $path = $ctx.Request.Url.AbsolutePath
            if ($path -eq '/' -or $path -eq '/index.html') {
                $bytes = [System.IO.File]::ReadAllBytes($page)
                $res.ContentType = 'text/html; charset=utf-8'
                $res.Headers.Add('Cache-Control', 'no-store')
                $res.ContentLength64 = $bytes.Length
                $res.OutputStream.Write($bytes, 0, $bytes.Length)
            } else {
                $res.StatusCode = 404
            }
        } catch {
            Write-Host "Request error: $_"
        } finally {
            $res.Close()
        }
    }
} finally {
    $listener.Stop()
}
