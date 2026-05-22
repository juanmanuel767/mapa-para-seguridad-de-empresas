#!/usr/bin/env python3
import functools
import http.server
import socket
import socketserver
import threading
import time
import webbrowser
from pathlib import Path


APP_DIR = Path(__file__).resolve().parent
HOST = "127.0.0.1"
START_PORT = 8081


def find_port(start=START_PORT):
    for port in range(start, start + 50):
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as probe:
            try:
                probe.bind((HOST, port))
                return port
            except OSError:
                continue
    raise RuntimeError("No hay puertos locales disponibles.")


def main():
    try:
        port = find_port()
    except RuntimeError as error:
        print(f"Error: {error}")
        print("Cierra otras ventanas de Control de Puestos o reinicia el equipo e intenta de nuevo.")
        raise SystemExit(1)

    handler = functools.partial(http.server.SimpleHTTPRequestHandler, directory=str(APP_DIR))

    class ReusableServer(socketserver.TCPServer):
        allow_reuse_address = True

    with ReusableServer((HOST, port), handler) as server:
        url = f"http://{HOST}:{port}"
        print("Control de Puestos iniciado")
        print(f"Abriendo: {url}")
        print("Cierra esta ventana para apagar la app local.")

        threading.Thread(
            target=lambda: (time.sleep(0.8), webbrowser.open(url)),
            daemon=True,
        ).start()
        try:
            server.serve_forever()
        except KeyboardInterrupt:
            print("\nControl de Puestos cerrado.")


if __name__ == "__main__":
    main()
