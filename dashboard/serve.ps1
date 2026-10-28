# Serves the QIDI Plus 5 dashboard on http://localhost:8765/ (this PC only).
# The page is the Angular app built into the "app" folder (source: ../angular).
# The printer's Moonraker already allows web pages from localhost, so no printer
# settings need changing. Close this window to stop it.
param([int]$Port = 8765, [switch]$NoBrowser)

$root = (Resolve-Path (Join-Path $PSScriptRoot 'app')).Path
$prefix = "http://localhost:$Port/"
$types = @{
    '.html' = 'text/html; charset=utf-8'; '.js' = 'text/javascript; charset=utf-8'; '.mjs' = 'text/javascript; charset=utf-8'
    '.css' = 'text/css; charset=utf-8'; '.json' = 'application/json'; '.ico' = 'image/x-icon'; '.png' = 'image/png'
    '.svg' = 'image/svg+xml'; '.woff2' = 'font/woff2'; '.txt' = 'text/plain; charset=utf-8'; '.map' = 'application/json'
}

$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add($prefix)
try { $listener.Start() } catch {
    Write-Host "Could not start on port $Port (already running?). Opening the page anyway."
    if (-not $NoBrowser) { Start-Process $prefix }
    exit 1
}
Write-Host "QIDI Plus 5 dashboard running at $prefix"
Write-Host "Leave this window open while you use it. Close it to stop."
if (-not $NoBrowser) { Start-Process $prefix }

function Send-File($res, $file) {
    $bytes = [System.IO.File]::ReadAllBytes($file)
    $ext = [System.IO.Path]::GetExtension($file).ToLower()
    $res.ContentType = if ($types.ContainsKey($ext)) { $types[$ext] } else { 'application/octet-stream' }
    # index.html always fresh; Angular's hashed bundles can be cached.
    $res.Headers.Add('Cache-Control', $(if ($ext -eq '.html') { 'no-store' } else { 'max-age=3600' }))
    $res.ContentLength64 = $bytes.Length
    $res.OutputStream.Write($bytes, 0, $bytes.Length)
}

function Send-Json($res, $obj) {
    $bytes = [System.Text.Encoding]::UTF8.GetBytes((ConvertTo-Json -InputObject @($obj) -Compress))
    $res.ContentType = 'application/json'
    $res.Headers.Add('Cache-Control', 'no-store')
    $res.ContentLength64 = $bytes.Length
    $res.OutputStream.Write($bytes, 0, $bytes.Length)
}

# This PC's IPv4 networks as "a.b.c" (the /24 the PC is in), real adapters first. Never leaves this PC.
function Get-LocalNetworks {
    $nets = @()
    try {
        $addrs = Get-NetIPAddress -AddressFamily IPv4 -ErrorAction Stop |
            Where-Object { $_.IPAddress -notmatch '^(127\.|169\.254\.)' }
        $up = @(Get-NetAdapter -ErrorAction SilentlyContinue | Where-Object { $_.Status -eq 'Up' })
        foreach ($a in $addrs) {
            $adapter = $up | Where-Object { $_.ifIndex -eq $a.InterfaceIndex } | Select-Object -First 1
            if (-not $adapter) { continue }
            $virtual = $adapter.InterfaceDescription -match 'Hyper-V|Virtual|VMware|VirtualBox|WSL|TAP|Loopback|Bluetooth'
            $p = $a.IPAddress.Split('.')
            $nets += [pscustomobject]@{ prefix = "$($p[0]).$($p[1]).$($p[2])"; virtual = [bool]$virtual }
        }
    } catch { }
    $nets | Sort-Object virtual, prefix -Unique | ForEach-Object { $_.prefix } | Select-Object -Unique
}

try {
    while ($listener.IsListening) {
        $ctx = $listener.GetContext()
        $res = $ctx.Response
        try {
            $path = [Uri]::UnescapeDataString($ctx.Request.Url.AbsolutePath)
            # Old address of the Angular version: send it to the main page (keeps ?printer=...).
            if ($path -eq '/ng' -or $path.StartsWith('/ng/')) { $res.Redirect('/' + $ctx.Request.Url.Query); continue }
            # "Find my printer": tell the page which local networks this PC is on, so it only scans those.
            if ($path -eq '/local-networks') { Send-Json $res (Get-LocalNetworks); continue }
            if ($path.EndsWith('/')) { $path += 'index.html' }
            $file = [System.IO.Path]::GetFullPath((Join-Path $root $path.TrimStart('/')))
            # Only serve files inside the app folder.
            if (-not $file.StartsWith($root + [System.IO.Path]::DirectorySeparatorChar)) { $res.StatusCode = 403; continue }
            if (Test-Path -LiteralPath $file -PathType Leaf) { Send-File $res $file }
            elseif (-not [System.IO.Path]::HasExtension($path)) { Send-File $res (Join-Path $root 'index.html') }
            else { $res.StatusCode = 404 }
        } catch {
            Write-Host "Request error: $_"
        } finally {
            $res.Close()
        }
    }
} finally {
    $listener.Stop()
}
