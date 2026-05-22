@echo off
pushd "%~dp0"
set "CPAPP=%CD%"
set "PS1=%TEMP%\cp_%RANDOM%.ps1"
powershell -NoProfile -Command "$f=[IO.File]::ReadAllLines('%~nx0');$s=0;for($i=0;$i-lt$f.Length;$i++){if($f[$i]-eq'#!PSSTART'){$s=$i+1;break}};[IO.File]::WriteAllLines('%PS1%',$f[$s..9999])"
powershell -NoProfile -ExecutionPolicy Bypass -File "%PS1%"
del "%PS1%" 2>nul
popd
goto :EOF
#!PSSTART
$Host.UI.RawUI.WindowTitle = "Control de Puestos - Instalador"
$appDir = $env:CPAPP

Write-Host ""
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "   Control de Puestos - Instalador" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host ""

function Get-Python {
    foreach ($cmd in @("py", "python", "python3")) {
        try {
            $null = & $cmd --version 2>&1
            if ($LASTEXITCODE -eq 0) { return $cmd }
        } catch {}
    }
    $rutas = @(
        "$env:LOCALAPPDATA\Programs\Python\Python313\python.exe",
        "$env:LOCALAPPDATA\Programs\Python\Python312\python.exe",
        "$env:LOCALAPPDATA\Programs\Python\Python311\python.exe",
        "$env:LOCALAPPDATA\Programs\Python\Python310\python.exe",
        "$env:ProgramFiles\Python313\python.exe",
        "$env:ProgramFiles\Python312\python.exe"
    )
    foreach ($ruta in $rutas) {
        if (Test-Path $ruta) { return $ruta }
    }
    return $null
}

$python = Get-Python

if (-not $python) {
    Write-Host "  Python no esta instalado. Instalando automaticamente..." -ForegroundColor Yellow
    Write-Host "  (No cierres esta ventana, puede tardar 1-2 minutos)" -ForegroundColor Gray
    Write-Host ""

    $instalado = $false

    $hasWinget = Get-Command winget -ErrorAction SilentlyContinue
    if ($hasWinget) {
        Write-Host "  Usando Windows Package Manager..." -ForegroundColor Gray
        winget install --id Python.Python.3.12 --silent --accept-package-agreements --accept-source-agreements 2>&1 | Out-Null
        if ($LASTEXITCODE -eq 0) { $instalado = $true }
    }

    if (-not $instalado) {
        $arch = if ([Environment]::Is64BitOperatingSystem) { "amd64" } else { "win32" }
        $url = "https://www.python.org/ftp/python/3.12.7/python-3.12.7-$arch.exe"
        $installer = "$env:TEMP\python-installer.exe"

        Write-Host "  Descargando Python 3.12 desde python.org..." -ForegroundColor Gray
        try {
            [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
            (New-Object Net.WebClient).DownloadFile($url, $installer)
        } catch {
            Write-Host ""
            Write-Host "  ERROR: No se pudo descargar Python." -ForegroundColor Red
            Write-Host "  Verifica tu conexion a internet e intenta de nuevo." -ForegroundColor Red
            Write-Host ""
            Write-Host "  O instalalo manualmente desde:" -ForegroundColor Yellow
            Write-Host "  https://www.python.org/downloads/" -ForegroundColor Yellow
            Write-Host "  (Marca 'Add Python to PATH' al instalar)" -ForegroundColor Yellow
            Read-Host "`n  Presiona Enter para salir"
            exit 1
        }

        Write-Host "  Instalando Python..." -ForegroundColor Gray
        $proc = Start-Process -FilePath $installer `
            -ArgumentList "/quiet InstallAllUsers=0 PrependPath=1 Include_test=0" `
            -Wait -PassThru
        Remove-Item $installer -Force -ErrorAction SilentlyContinue

        if ($proc.ExitCode -ne 0) {
            Write-Host "  ERROR al instalar Python (codigo $($proc.ExitCode))." -ForegroundColor Red
            Read-Host "`n  Presiona Enter para salir"
            exit 1
        }
    }

    $env:Path = [Environment]::GetEnvironmentVariable("Path","Machine") + ";" +
                [Environment]::GetEnvironmentVariable("Path","User")

    $python = Get-Python

    if (-not $python) {
        Write-Host ""
        Write-Host "  Python se instalo pero necesita reiniciar el PC." -ForegroundColor Yellow
        Write-Host ""
        Write-Host "  Pasos:" -ForegroundColor White
        Write-Host "  1. Cierra esta ventana" -ForegroundColor White
        Write-Host "  2. Reinicia el PC" -ForegroundColor White
        Write-Host "  3. Vuelve a hacer doble clic en INSTALAR.bat" -ForegroundColor White
        Read-Host "`n  Presiona Enter para salir"
        exit 1
    }

    Write-Host "  Python instalado correctamente." -ForegroundColor Green
    Write-Host ""
}

Write-Host "  Python encontrado. Configurando la aplicacion..." -ForegroundColor Green
Write-Host ""

Set-Location $appDir

try {
    & $python "install.py"
    if ($LASTEXITCODE -ne 0) { throw "Error en install.py" }
} catch {
    Write-Host ""
    Write-Host "  ERROR al configurar: $_" -ForegroundColor Red
    Read-Host "`n  Presiona Enter para salir"
    exit 1
}

Write-Host ""
Write-Host "==========================================" -ForegroundColor Green
Write-Host "   Instalacion completada." -ForegroundColor Green
Write-Host ""
Write-Host "   Busca en tu Escritorio el icono:" -ForegroundColor White
Write-Host "   'Control de Puestos'" -ForegroundColor White
Write-Host "==========================================" -ForegroundColor Green
Write-Host ""

$r = Read-Host "  Abrir la aplicacion ahora? (S/N)"
if ($r -match "^[Ss]") {
    Write-Host "  Abriendo..." -ForegroundColor Cyan
    & $python "run_app.py"
} else {
    Read-Host "`n  Presiona Enter para cerrar"
}
