<#
Manage playtester access codes for the Squishtech playtest portal.

  .\testers.cmd add "Jane Doe"                         a code for every playtest
  .\testers.cmd add "Jane Doe" offrecord,nighthunt     a code for just these
  .\testers.cmd list                                   who has a code, and for what
  .\testers.cmd revoke "Jane Doe"                      that person's code stops working at once
  .\testers.cmd log                                    who downloaded which build (last 90 days)

The code is shown once, when it's made. Only its hash is stored, so a lost code can't be looked up: revoke it and
add a new one. Needs Node.js and a `npx wrangler login` done once in this folder.
#>
param(
  [Parameter(Mandatory = $true, Position = 0)][ValidateSet('add', 'list', 'revoke', 'log')][string]$Command,
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
  if ($start -lt 0) { return @() }
  return @($text.Substring($start) | ConvertFrom-Json)
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
    Get-Keys 'code:' | ForEach-Object {
      [pscustomobject]@{ Tester = $_.metadata.name; Games = (@($_.metadata.games) -join ', ') -replace '^\*$', 'all'; Created = $_.metadata.created }
    } | Sort-Object Tester | Format-Table -AutoSize
  }
  'revoke' {
    if (-not $Name) { throw 'Whose code? .\testers.cmd revoke "Jane Doe"' }
    $keys = @(Get-Keys 'code:' | Where-Object { $_.metadata.name -eq $Name } | ForEach-Object { $_.name })
    if (-not $keys.Count) { throw "No code found for '$Name'. See .\testers.cmd list" }
    $file = Write-Json $keys
    try { Invoke-Wrangler @('kv', 'bulk', 'delete', $file, '--binding', 'CODES', '--remote', '--force') | Out-Null } finally { Remove-Item $file }
    Write-Host "Revoked $($keys.Count) code(s) for $Name."
  }
  'log' {
    Get-Keys 'log:' | ForEach-Object {
      [pscustomobject]@{ When = ($_.name -split ':', 2)[1].Substring(0, 16).Replace('T', ' '); Tester = $_.metadata.tester; Game = $_.metadata.game; Build = $_.metadata.build }
    } | Sort-Object When -Descending | Format-Table -AutoSize
  }
}
