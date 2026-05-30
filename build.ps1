# ==============================================================
#  ExamClient Build & Installer Script  (Qt6 MinGW / MSVC)
#  Ishlatish: .\build.ps1
# ==============================================================
param(
    [string]$QtPath = "",
    [switch]$SkipBuild,
    [switch]$SkipInstaller
)

Set-StrictMode -Off
$ErrorActionPreference = "Stop"

function Write-Step  { param($msg) Write-Host "`n==> $msg" -ForegroundColor Cyan }
function Write-OK    { param($msg) Write-Host "  [OK] $msg" -ForegroundColor Green }
function Write-Fail  { param($msg) Write-Host "  [!!] $msg" -ForegroundColor Red }
function Write-Warn  { param($msg) Write-Host "  [??] $msg" -ForegroundColor Yellow }

$ScriptDir    = Split-Path -Parent $MyInvocation.MyCommand.Path
$ClientDir    = Join-Path $ScriptDir "client"
$BuildDir     = Join-Path $ClientDir "build"
$DistDir      = Join-Path $ClientDir "dist"
$InstallerDir = Join-Path $ScriptDir "installer"

# ── 1. Qt6 yo'lini topish ────────────────────────────────────
Write-Step "Qt6 tekshirilmoqda..."

if (-not $QtPath) {
    $candidates = @(
        # MinGW (Qt Creator default)
        "C:\Qt\6.11.1\mingw_64",
        "C:\Qt\6.10.0\mingw_64",
        "C:\Qt\6.9.1\mingw_64",
        "C:\Qt\6.9.0\mingw_64",
        "C:\Qt\6.8.1\mingw_64",
        "C:\Qt\6.7.0\mingw_64",
        "C:\Qt\6.6.0\mingw_64",
        # MSVC
        "C:\Qt\6.11.1\msvc2022_64",
        "C:\Qt\6.9.0\msvc2022_64",
        "C:\Qt\6.8.1\msvc2022_64",
        "C:\Qt\6.7.0\msvc2022_64",
        "C:\Qt\6.5.3\msvc2022_64"
    )
    foreach ($c in $candidates) {
        if (Test-Path "$c\bin\qmake.exe") { $QtPath = $c; break }
    }
}

if (-not $QtPath -or -not (Test-Path "$QtPath\bin\qmake.exe")) {
    Write-Fail "Qt6 topilmadi! -QtPath parametrini bering."
    exit 1
}

Write-OK "Qt6: $QtPath"
$isMinGW = $QtPath -like "*mingw*"

# ── 2. Toolchain yo'llarini sozlash ──────────────────────────
Write-Step "Toolchain sozlanmoqda..."

# CMake
$cmakeExe = "C:\Qt\Tools\CMake_64\bin\cmake.exe"
if (-not (Test-Path $cmakeExe)) {
    $cmakeCmd = Get-Command cmake -ErrorAction SilentlyContinue
    if ($cmakeCmd) { $cmakeExe = $cmakeCmd.Source }
}
if (-not $cmakeExe -or -not (Test-Path $cmakeExe)) {
    Write-Fail "CMake topilmadi!"
    exit 1
}
Write-OK "CMake: $cmakeExe"

# Ninja
$ninjaExe = "C:\Qt\Tools\Ninja\ninja.exe"
if (-not (Test-Path $ninjaExe)) {
    $ninjaCmd = Get-Command ninja -ErrorAction SilentlyContinue
    if ($ninjaCmd) { $ninjaExe = $ninjaCmd.Source }
}
if ($ninjaExe -and (Test-Path $ninjaExe)) {
    Write-OK "Ninja: $ninjaExe"
    $env:PATH = "$(Split-Path $ninjaExe);$env:PATH"
}

# MinGW
if ($isMinGW) {
    # Find MinGW in Qt\Tools
    $mingwBase = $null
    $mingwCandidates = @("C:\Qt\Tools\mingw1310_64","C:\Qt\Tools\mingw_64","C:\Qt\Tools\mingw900_64")
    foreach ($m in $mingwCandidates) {
        if (Test-Path "$m\bin\g++.exe") { $mingwBase = $m; break }
    }
    if (-not $mingwBase) {
        Write-Fail "MinGW topilmadi!"
        exit 1
    }
    Write-OK "MinGW: $mingwBase"
    $env:PATH = "$mingwBase\bin;$env:PATH"
    $cxxCompiler = "$mingwBase\bin\g++.exe"
    $cCompiler   = "$mingwBase\bin\gcc.exe"
    $generator   = "Ninja"
} else {
    # MSVC
    $vsWhere = "${env:ProgramFiles(x86)}\Microsoft Visual Studio\Installer\vswhere.exe"
    if (Test-Path $vsWhere) {
        $vsPath = & $vsWhere -latest -property installationPath 2>$null
        if ($vsPath) {
            $vcvars = "$vsPath\VC\Auxiliary\Build\vcvars64.bat"
            if (Test-Path $vcvars) {
                cmd /c "`"$vcvars`" && set" | ForEach-Object {
                    if ($_ -match "^([^=]+)=(.*)$") {
                        [System.Environment]::SetEnvironmentVariable($Matches[1], $Matches[2])
                    }
                }
                Write-OK "MSVC environment sozlandi"
            }
        }
    }
    $generator = "Ninja"
}

$env:PATH = "$(Split-Path $cmakeExe);$env:PATH"

# ── 3. Build ─────────────────────────────────────────────────
if (-not $SkipBuild) {
    Write-Step "CMake configure..."
    if (Test-Path $BuildDir) { Remove-Item $BuildDir -Recurse -Force }
    New-Item -ItemType Directory -Path $BuildDir | Out-Null

    $configArgs = @(
        "-B", $BuildDir,
        "-S", $ClientDir,
        "-G", $generator,
        "-DCMAKE_PREFIX_PATH=$QtPath",
        "-DCMAKE_BUILD_TYPE=Release"
    )
    if ($isMinGW) {
        $configArgs += "-DCMAKE_CXX_COMPILER=$cxxCompiler"
        $configArgs += "-DCMAKE_C_COMPILER=$cCompiler"
    }

    & $cmakeExe @configArgs
    if ($LASTEXITCODE -ne 0) { Write-Fail "CMake configure xato!"; exit 1 }
    Write-OK "Configure muvaffaqiyatli"

    Write-Step "Build (Release)..."
    & $cmakeExe --build $BuildDir --config Release --parallel
    if ($LASTEXITCODE -ne 0) { Write-Fail "Build xato!"; exit 1 }
    Write-OK "Build muvaffaqiyatli"
} else {
    Write-Warn "Build o'tkazib yuborildi (-SkipBuild)"
}

# ── 4. dist/ papkasiga to'plash ──────────────────────────────
Write-Step "Dist papkasi tayyorlanmoqda..."
if (Test-Path $DistDir) { Remove-Item $DistDir -Recurse -Force }
New-Item -ItemType Directory -Path $DistDir | Out-Null

# exe ni topish
$exePath = @(
    (Join-Path $BuildDir "ExamClient.exe"),
    (Join-Path $BuildDir "Release\ExamClient.exe")
) | Where-Object { Test-Path $_ } | Select-Object -First 1

if (-not $exePath) { Write-Fail "ExamClient.exe topilmadi!"; exit 1 }

Copy-Item $exePath $DistDir
Copy-Item (Join-Path $ClientDir "config.ini") $DistDir -ErrorAction SilentlyContinue
Write-OK "EXE ko'chirildi: $exePath"

Write-Step "windeployqt ishga tushirilmoqda..."
$winDeployQt = "$QtPath\bin\windeployqt.exe"
& $winDeployQt --release --no-translations (Join-Path $DistDir "ExamClient.exe")
if ($LASTEXITCODE -ne 0) { Write-Fail "windeployqt xato!"; exit 1 }
Write-OK "Qt DLL'lar to'plandi"

# ── 5. Installer ─────────────────────────────────────────────
if (-not $SkipInstaller) {
    Write-Step "Inno Setup installer yaratilmoqda..."
    $iscc = @(
        "C:\Program Files (x86)\Inno Setup 6\ISCC.exe",
        "C:\Program Files\Inno Setup 6\ISCC.exe"
    ) | Where-Object { Test-Path $_ } | Select-Object -First 1

    if (-not $iscc) {
        Write-Warn "Inno Setup topilmadi. https://jrsoftware.org/isdl.php dan yuklab o'rnating."
        Write-Host "  O'rnatgandan keyin: .\build.ps1 -SkipBuild" -ForegroundColor Yellow
        exit 0
    }

    $issFile = Join-Path $InstallerDir "ExamClient.iss"
    Push-Location $ScriptDir
    & $iscc $issFile
    Pop-Location
    if ($LASTEXITCODE -ne 0) { Write-Fail "Installer xato!"; exit 1 }

    $outputExe = Join-Path $InstallerDir "Output\ExamClientInstaller.exe"
    if (Test-Path $outputExe) {
        $size = [math]::Round((Get-Item $outputExe).Length / 1MB, 1)
        Write-OK "Installer tayyor: $outputExe  (${size} MB)"
    }
} else {
    Write-Warn "Installer o'tkazib yuborildi (-SkipInstaller)"
}

Write-Host "`n=== Barcha bosqichlar muvaffaqiyatli yakunlandi ===" -ForegroundColor Green
