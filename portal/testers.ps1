<#
Manage playtester access codes for the Squishtech playtest portal.

  .\testers.cmd add "Jane Doe"                         a code for every playtest
  .\testers.cmd add "Jane Doe" offrecord,nighthunt     a code for just these
  .\testers.cmd list                                   who has a code, for what, and how many downloads
  .\testers.cmd revoke "Jane Doe"                      that person's code stops working at once
  .\testers.cmd reset "Jane Doe"                       clear their download counts after hitting the limit
  .\testers.cmd log                                    who downloaded which build (last 90 days)

The code is shown once, when it's made. Only its hash is stored, so a lost code can't be looked up: revoke it and
add a new one. Each code may download each game MAX_DOWNLOADS_PER_GAME times (wrangler.toml) before it's refused.
Needs Node.js and a `npx wrangler login` done once in this folder.
#>
param(
  [Parameter(Mandatory = $true, Position = 0)][ValidateSet('add', 'list', 'revoke', 'reset', 'log')][string]$Command,
  [Parameter(Position = 1)][string]$Name,
  [Parameter(Position = 2)][string[]]$Games = @('*')
)
$ErrorActionPreference = 'Stop'
Set-Location $PSScriptRoot

$known = @('offrecord', 'stonethrone', 'boredtodepth', 'nighthunt', 'crowdcontrol')

function Invoke-Wrangler([string[]]$WranglerArgs) {
  $out = & npx.cmd --yes wrangler@4 @WranglerArgs
  if ($LASTEXITCODE -ne 0) { throw "wrangler $($WranglerArgs -join ' ') failed" }
  return ($out -join "`n")
}

function Get-Keys([string]$Prefix) {
  $text = Invoke-Wrangler @('kv', 'key', 'list', '--binding', 'CODES', '--remote', '--prefix', $Prefix)
  $start = $text.IndexOf('[')
  if ($start -lt 0) { return }
  # Windows PowerShell 5.1's ConvertFrom-Json hands back a JSON array as ONE object; emit its items one by one,
  # or every filter below would see all keys at once (and revoke would match everyone).
  foreach ($item in (ConvertFrom-Json $text.Substring($start))) { $item }
}

function Write-Json([object]$Value) {
  $path = Join-Path ([IO.Path]::GetTempPath()) ("sqt-portal-" + [guid]::NewGuid() + ".json")
  [IO.File]::WriteAllText($path, (ConvertTo-Json -InputObject $Value -Depth 6), (New-Object Text.UTF8Encoding $false))
  return $path
}

function New-AccessCode {
  $alphabet = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ'   # 32 symbols: no 0/O or 1/I to misread
  $bytes = New-Object byte[] 15
  [Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($bytes)
  $c = -join ($bytes | ForEach-Object { $alphabet[$_ % 32] })
  return "$($c.Substring(0,5))-$($c.Substring(5,5))-$($c.Substring(10,5))"
}

function Get-Hash([string]$Code) {
  $norm = ($Code.ToUpperInvariant() -replace '[^A-Z0-9]', '')
  $sha = [Security.Cryptography.SHA256]::Create()
  return -join ($sha.ComputeHash([Text.Encoding]::UTF8.GetBytes($norm)) | ForEach-Object { $_.ToString('x2') })
}

switch ($Command) {
  'add' {
    if (-not $Name) { throw 'Give the tester a name: .\testers.cmd add "Jane Doe"' }
    $list = @($Games | ForEach-Object { $_ -split ',' } | ForEach-Object { $_.Trim().ToLowerInvariant() } | Where-Object { $_ })
    if ($list -contains 'all' -or $list -contains '*') { $list = @('*') }
    foreach ($g in $list) { if ($g -ne '*' -and $known -notcontains $g) { throw "Unknown game '$g'. Known: $($known -join ', ')" } }
    if (Get-Keys 'code:' | Where-Object { $_.metadata.name -eq $Name }) {
      Write-Warning "$Name already has a code. Adding a second one; revoke removes both."
    }
    $code = New-AccessCode
    $rec = [ordered]@{ name = $Name; games = $list; created = (Get-Date).ToString('yyyy-MM-dd') }
    $file = Write-Json @([ordered]@{ key = "code:$(Get-Hash $code)"; value = ($rec | ConvertTo-Json -Compress -Depth 4); metadata = $rec })
    try { Invoke-Wrangler @('kv', 'bulk', 'put', $file, '--binding', 'CODES', '--remote') | Out-Null } finally { Remove-Item $file }
    $for = if ($list -contains '*') { 'every playtest' } else { $list -join ', ' }
    Write-Host ""
    Write-Host "  Access code for $Name ($for):" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "      $code" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "  Send it to them privately. It isn't stored anywhere you can read it back." -ForegroundColor DarkGray
  }
  'list' {
    $limit = 0
    $m = Select-String -Path (Join-Path $PSScriptRoot 'wrangler.toml') -Pattern '^\s*MAX_DOWNLOADS_PER_GAME\s*=\s*"?(\d+)' | Select-Object -First 1
    if ($m) { $limit = [int]$m.Matches[0].Groups[1].Value }
    $counts = @{}
    foreach ($k in Get-Keys 'count:') { $counts[$k.name.Substring(6)] = $k.metadata }
    Get-Keys 'code:' | ForEach-Object {
      $c = $counts[$_.name.Substring(5)]
      $parts = @(); $atLimit = $false
      if ($c) {
        foreach ($p in $c.PSObject.Properties) {
          if ($p.Name -eq 'name') { continue }
          $parts += "$($p.Name) $($p.Value)"
          if ($limit -gt 0 -and [int]$p.Value -ge $limit) { $atLimit = $true }
        }
      }
      [pscustomobject]@{
        Tester    = $_.metadata.name
        Games     = (@($_.metadata.games) -join ', ') -replace '^\*$', 'all'
        Downloads = if ($parts.Count) { ($parts -join ', ') + $(if ($atLimit) { '  << AT LIMIT' } else { '' }) } else { '-' }
        Created   = $_.metadata.created
      }
    } | Sort-Object Tester | Format-Table -AutoSize
    if ($limit -gt 0) { Write-Host "Limit: $limit downloads of each game per code." -ForegroundColor DarkGray }
  }
  'revoke' {
    if (-not $Name) { throw 'Whose code? .\testers.cmd revoke "Jane Doe"' }
    $keys = @(Get-Keys 'code:' | Where-Object { $_.metadata.name -eq $Name } | ForEach-Object { $_.name })
    if (-not $keys.Count) { throw "No code found for '$Name'. See .\testers.cmd list" }
    $all = @($keys) + @($keys | ForEach-Object { 'count:' + $_.Substring(5) })
    $file = Write-Json $all
    try { Invoke-Wrangler @('kv', 'bulk', 'delete', $file, '--binding', 'CODES', '--remote', '--force') | Out-Null } finally { Remove-Item $file }
    Write-Host "Revoked $($keys.Count) code(s) for $Name."
  }
  'reset' {
    if (-not $Name) { throw 'Whose downloads? .\testers.cmd reset "Jane Doe"' }
    $keys = @(Get-Keys 'code:' | Where-Object { $_.metadata.name -eq $Name } | ForEach-Object { 'count:' + $_.name.Substring(5) })
    if (-not $keys.Count) { throw "No code found for '$Name'. See .\testers.cmd list" }
    $file = Write-Json $keys
    try { Invoke-Wrangler @('kv', 'bulk', 'delete', $file, '--binding', 'CODES', '--remote', '--force') | Out-Null } finally { Remove-Item $file }
    Write-Host "Download counts cleared for $Name. Their code can download every game again, up to the limit."
  }
  'log' {
    Get-Keys 'log:' | ForEach-Object {
      [pscustomobject]@{ When = ($_.name -split ':', 2)[1].Substring(0, 16).Replace('T', ' '); Tester = $_.metadata.tester; Game = $_.metadata.game; Build = $_.metadata.build }
    } | Sort-Object When -Descending | Format-Table -AutoSize
  }
}
