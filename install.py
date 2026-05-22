#!/usr/bin/env python3
import os
import platform
import subprocess
import stat
import sys
from pathlib import Path


APP_NAME = "Control de Puestos"
APP_DIR = Path(__file__).resolve().parent
PYTHON = sys.executable


def write_text(path, content):
    path.write_text(content, encoding="utf-8")


def make_executable(path):
    current = path.stat().st_mode
    path.chmod(current | stat.S_IXUSR | stat.S_IXGRP | stat.S_IXOTH)


def install_windows():
    launcher = APP_DIR / "Abrir Control de Puestos.bat"
    icon = APP_DIR / "icons" / "icon.ico"
    write_text(
        launcher,
        f'@echo off\r\ntitle {APP_NAME}\r\ncd /d "{APP_DIR}"\r\n"{PYTHON}" "{APP_DIR / "run_app.py"}"\r\n',
    )

    desktop = Path(os.environ.get("USERPROFILE", str(Path.home()))) / "Desktop"
    if desktop.exists():
        shortcut = desktop / "Control de Puestos.lnk"
        create_windows_shortcut(shortcut, launcher, icon)
        return shortcut
    return launcher


def ps_escape(value):
    return str(value).replace("'", "''")


def create_windows_shortcut(shortcut, target, icon):
    script = APP_DIR / "_crear_acceso_control_puestos.ps1"
    write_text(
        script,
        "\n".join(
            [
                "$shell = New-Object -ComObject WScript.Shell",
                f"$shortcut = $shell.CreateShortcut('{ps_escape(shortcut)}')",
                f"$shortcut.TargetPath = '{ps_escape(target)}'",
                f"$shortcut.WorkingDirectory = '{ps_escape(APP_DIR)}'",
                f"$shortcut.IconLocation = '{ps_escape(icon)}'",
                "$shortcut.WindowStyle = 1",
                "$shortcut.Save()",
                "",
            ]
        ),
    )
    try:
        subprocess.run(
            ["powershell", "-NoProfile", "-ExecutionPolicy", "Bypass", "-File", str(script)],
            check=True,
        )
    finally:
        try:
            script.unlink()
        except OSError:
            pass


def install_linux():
    launcher = APP_DIR / "abrir-control-puestos.sh"
    write_text(
        launcher,
        f'#!/usr/bin/env bash\ncd "{APP_DIR}"\n"{PYTHON}" "{APP_DIR / "run_app.py"}"\n',
    )
    make_executable(launcher)

    apps_dir = Path.home() / ".local" / "share" / "applications"
    apps_dir.mkdir(parents=True, exist_ok=True)
    desktop_file = apps_dir / "control-puestos.desktop"
    icon = APP_DIR / "icons" / "icon-192.png"
    write_text(
        desktop_file,
        "\n".join(
            [
                "[Desktop Entry]",
                "Type=Application",
                f"Name={APP_NAME}",
                f'Exec="{PYTHON}" "{APP_DIR / "run_app.py"}"',
                f"Icon={icon}",
                "Terminal=true",
                "Categories=Office;Utility;",
                "",
            ]
        ),
    )
    make_executable(desktop_file)
    return desktop_file


def install_macos():
    launcher = Path.home() / "Desktop" / "Control de Puestos.command"
    write_text(
        launcher,
        f'#!/bin/zsh\ncd "{APP_DIR}"\n"{PYTHON}" "{APP_DIR / "run_app.py"}"\n',
    )
    make_executable(launcher)
    return launcher


def main():
    system = platform.system().lower()
    if "windows" in system:
        created = install_windows()
    elif "darwin" in system:
        created = install_macos()
    else:
        created = install_linux()

    print(f"{APP_NAME} instalado correctamente.")
    print(f"Acceso creado: {created}")
    print("")
    print("Para abrir ahora mismo:")
    print(f'"{PYTHON}" "{APP_DIR / "run_app.py"}"')


if __name__ == "__main__":
    main()
