# Bring one sheet into the game: sheet.png + sheet.json, for a general also a portrait cut from the first idle
# frame, and the manifest of what has art ({ generals: [...], beasts: [...] }).
#   ./tamquoc/tools/pull.ps1 -Id <sprite id on the MCP server> [-Gid <general id>]   (after export_sprite png)
#   ./tamquoc/tools/pull.ps1 -Gid zhangfei -From sprites\zhangfei\png                 (a folder already on disk)
#   ./tamquoc/tools/pull.ps1 -Id qinglong -Kind beasts                                 (a tactic's spirit beast)
param([string]$Id, [string]$Gid = $Id, [string]$From, [ValidateSet("generals", "beasts")][string]$Kind = "generals")
$ErrorActionPreference = "Stop"
$root = Split-Path $PSScriptRoot -Parent
$dst = Join-Path $root "assets\$Kind\$Gid"
if (-not $From) {
  # the endpoint and its token live in the harness's MCP config, not in this repo
  $cfg = Get-Content "$HOME\.dsh\cordis.patch.yml" -Raw
  $base = [regex]::Match($cfg, 'url:\s*(\S+)/mcp').Groups[1].Value
  $auth = [regex]::Match($cfg, 'Authorization:\s*(Bearer \S+)').Groups[1].Value
  $tmp = Join-Path $env:TEMP "tq_$Id"
  if (Test-Path $tmp) { Remove-Item -Recurse -Force $tmp }
  New-Item -ItemType Directory $tmp | Out-Null
  curl.exe -fsS --max-time 90 --retry 2 -H "Authorization: $auth" -o "$tmp\s.zip" "$base/download/$Id.zip"
  if ($LASTEXITCODE) { throw "download of $Id failed" }
  Expand-Archive "$tmp\s.zip" $tmp
  $From = "$tmp\png"
}
New-Item -ItemType Directory -Force $dst | Out-Null
Copy-Item (Join-Path $From "sheet.png"), (Join-Path $From "sheet.json") $dst -Force

$j = Get-Content "$dst\sheet.json" -Raw | ConvertFrom-Json
if ($Kind -eq "generals") {
Add-Type -AssemblyName System.Drawing
$tag = $j.meta.frameTags | Where-Object name -eq "idle" | Select-Object -First 1
$f = $j.frames[$(if ($tag) { $tag.from } else { 0 })].frame
$sheet = [System.Drawing.Bitmap]::FromFile("$dst\sheet.png")
# the portrait is the figure alone: the frame trimmed to its opaque pixels
$x0 = $f.w; $x1 = -1; $y0 = $f.h; $y1 = -1
for ($y = 0; $y -lt $f.h; $y++) { for ($x = 0; $x -lt $f.w; $x++) { if ($sheet.GetPixel($f.x + $x, $f.y + $y).A -gt 127) { if ($x -lt $x0) { $x0 = $x }; if ($x -gt $x1) { $x1 = $x }; if ($y -lt $y0) { $y0 = $y }; if ($y -gt $y1) { $y1 = $y } } } }
if ($x1 -lt 0) { $x0 = 0; $y0 = 0; $x1 = $f.w - 1; $y1 = $f.h - 1 }
$cut = $sheet.Clone((New-Object System.Drawing.Rectangle ($f.x + $x0), ($f.y + $y0), ($x1 - $x0 + 1), ($y1 - $y0 + 1)), $sheet.PixelFormat)
$cut.Save("$dst\portrait.png", [System.Drawing.Imaging.ImageFormat]::Png)
$cut.Dispose(); $sheet.Dispose()
}

$have = { param($k) @(Get-ChildItem "$root\assets\$k" -Directory -ErrorAction SilentlyContinue | Where-Object { Test-Path "$($_.FullName)\sheet.json" } | ForEach-Object Name) }
$manifest = [ordered]@{ generals = @(& $have "generals"); beasts = @(& $have "beasts") }
[IO.File]::WriteAllText("$root\assets\manifest.json", (ConvertTo-Json $manifest -Compress))
"$Kind/$Gid : $($j.meta.frameTags.name -join ',')  ($($manifest.generals.Count) generals, $($manifest.beasts.Count) beasts have art)"
