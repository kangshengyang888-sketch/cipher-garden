$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$ports = @(4567, 4568, 4569, 4570, 4571)

$mime = @{
  '.html' = 'text/html; charset=utf-8'
  '.css'  = 'text/css; charset=utf-8'
  '.js'   = 'application/javascript; charset=utf-8'
  '.json' = 'application/json; charset=utf-8'
  '.png'  = 'image/png'
  '.jpg'  = 'image/jpeg'
  '.svg'  = 'image/svg+xml'
  '.ico'  = 'image/x-icon'
}

function Start-LocalServer([int]$port) {
  $listener = New-Object System.Net.HttpListener
  $listener.Prefixes.Add("http://127.0.0.1:$port/")
  $listener.Prefixes.Add("http://localhost:$port/")
  $listener.Start()
  return $listener
}

$listener = $null
$port = $null

foreach ($tryPort in $ports) {
  try {
    $listener = Start-LocalServer $tryPort
    $port = $tryPort
    break
  } catch {
    Write-Host "Port $tryPort unavailable, trying next..." -ForegroundColor Yellow
  }
}

if (-not $listener) {
  Write-Host ""
  Write-Host "ERROR: Could not start server on ports $($ports -join ', ')." -ForegroundColor Red
  exit 1
}

$url = "http://127.0.0.1:$port"
Set-Content -Path (Join-Path $root '.server-port') -Value $port -Encoding ascii

Write-Host ""
Write-Host "Cipher Garden server started." -ForegroundColor Green
Write-Host "Open: $url"
Write-Host "Press Ctrl+C to stop."
Write-Host ""

try {
  Start-Process $url
} catch {
  Write-Host "Please open the URL manually." -ForegroundColor Yellow
}

try {
  while ($listener.IsListening) {
    $context = $listener.GetContext()
    $request = $context.Request
    $response = $context.Response

    $path = [Uri]::UnescapeDataString($request.Url.LocalPath)
    if ($path -eq '/') { $path = '/index.html' }

    $relative = $path.TrimStart('/').Replace('/', [IO.Path]::DirectorySeparatorChar)
    $filePath = Join-Path $root $relative

    if (Test-Path $filePath -PathType Leaf) {
      $ext = [IO.Path]::GetExtension($filePath).ToLower()
      $contentType = $mime[$ext]
      if (-not $contentType) { $contentType = 'application/octet-stream' }

      $bytes = [IO.File]::ReadAllBytes($filePath)
      $response.ContentType = $contentType
      $response.ContentLength64 = $bytes.Length
      $response.OutputStream.Write($bytes, 0, $bytes.Length)
    } else {
      $response.StatusCode = 404
      $body = [Text.Encoding]::UTF8.GetBytes('404 Not Found')
      $response.OutputStream.Write($body, 0, $body.Length)
    }

    $response.Close()
  }
} finally {
  if ($listener) {
    $listener.Stop()
    $listener.Close()
  }
}
