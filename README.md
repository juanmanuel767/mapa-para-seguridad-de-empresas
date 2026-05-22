# Control de Puestos

Plataforma local para control de puestos, sedes e instalaciones sobre mapas interactivos. Permite cargar ubicaciones desde Excel, registrar eventos de vulnerabilidad, adjuntar documentos, guardar evidencias y compartir la ubicacion de un punto por WhatsApp.

El proyecto esta pensado para seguridad empresarial, instituciones, alcaldias, supervisores operativos y equipos que necesitan visualizar riesgos sobre un mapa.

## Funciones Principales

- Crear multiples mapas independientes.
- Cargar puestos desde archivos Excel `.xlsx`.
- Convertir coordenadas tipo `1°51'24.0"N 76°02'32.2"W`.
- Visualizar puestos en Leaflet/OpenStreetMap.
- Registrar eventos acumulables por puesto.
- Calcular nivel de vulnerabilidad:
  - Normal
  - Bajo
  - Medio
  - Alto
  - Critico
- Adjuntar PDFs, imagenes y documentos por pestañas.
- Agregar foto de identificacion por puesto.
- Ver lista completa de puestos por mapa.
- Compartir ubicacion por WhatsApp.
- Crear cuentas locales cifradas.
- Exportar e importar respaldos cifrados.
- Instalar como app local/PWA.

## Modulos Por Puesto

Cada punto del mapa funciona como una ficha operativa con:

- Resumen general.
- Eventos.
- Contratos.
- Otrosi.
- Supervision.
- Informes.
- Novedades.
- Investigacion.
- Estudios de seguridad.
- Estado de instalaciones.
- Documentos acumulables.
- Imagen del punto.

## Seguridad

Esta version usa cifrado local en el navegador mediante `WebCrypto AES-GCM`.

Los datos quedan protegidos con una clave de acceso. Si la clave se pierde, la informacion cifrada no se puede recuperar.

Recomendaciones:

- Usa una clave larga y segura.
- Exporta respaldos cifrados desde el panel de Seguridad.
- Guarda los respaldos fuera del equipo principal.
- No subas archivos reales sensibles al repositorio.

> Nota: para uso corporativo o multiusuario real, la siguiente etapa debe incluir backend, base de datos, usuarios, roles, permisos, HTTPS y auditoria.

## Requisitos

- Python 3.
- Navegador moderno: Chrome, Edge, Firefox o similar.
- Conexion a internet para mapas de OpenStreetMap y busqueda de ubicaciones.

## Ejecutar Localmente

Clona el repositorio:

```bash
git clone https://github.com/juanmanuel767/mapa-para-seguridad-de-empresas.git
cd mapa-para-seguridad-de-empresas
```

Ejecuta la app:

```bash
python run_app.py
```

En Linux/macOS puedes usar:

```bash
python3 run_app.py
```

El script busca un puerto disponible, levanta un servidor local y abre el navegador automaticamente.

## Instalacion Facil

### Windows

Desde PowerShell o CMD:

```powershell
py -3 install.py
```

Si `python` esta configurado:

```powershell
python install.py
```

Tambien puedes hacer doble clic en:

```text
instalar_windows.bat
```

El instalador crea un acceso directo en el escritorio con icono propio.

### Linux

```bash
python3 install.py
```

Crea un acceso `.desktop` en:

```text
~/.local/share/applications
```

### macOS

```bash
python3 install.py
```

Crea un archivo `.command` en el escritorio.

## Instalar Como App Del Navegador

Al abrir la plataforma en Chrome o Edge, el navegador puede mostrar la opcion:

```text
Instalar Control de Puestos
```

Tambien puede aparecer un boton `↓` dentro del mapa. Esto instala la plataforma como PWA.

## Respaldos

Para no perder informacion:

1. Entra con tu clave.
2. Abre Seguridad.
3. Selecciona Exportar respaldo.
4. Guarda el archivo `.json` cifrado en una ubicacion segura.

Para restaurar:

1. Abre la pantalla inicial.
2. Selecciona Importar respaldo.
3. Carga el `.json`.
4. Desbloquea con la clave original.

## Estructura Del Proyecto

```text
.
├── app.js
├── index.html
├── styles.css
├── manifest.webmanifest
├── sw.js
├── run_app.py
├── install.py
├── instalar_windows.bat
├── icons/
└── docs/
```

## Hoja De Ruta

- Backend con Node.js.
- PostgreSQL + PostGIS.
- Almacenamiento privado de archivos.
- Usuarios reales con roles y permisos.
- Auditoria de acciones.
- Copiloto IA para consultas, importacion y reportes.
- Reportes PDF/Excel.
- Despliegue empresarial.

## Autor

Desarrollado por **Juan Manuel Peralta**  
Ingeniero de Sistemas  
[peraltachaconjuanmanuel5@gmail.com](mailto:peraltachaconjuanmanuel5@gmail.com)
