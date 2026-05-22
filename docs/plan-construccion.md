# Plan de Construccion

## Vision

Crear una plataforma web multiplataforma para controlar puestos en mapas
independientes. Cada mapa contiene sus propios puestos, documentos, eventos,
informes y estadisticas.

## Modulos

1. Mapas
   - Crear mapas.
   - Abrir mapas existentes.
   - Cargar puestos dentro del mapa elegido.

2. Puestos
   - Datos generales.
   - Coordenadas.
   - Zona, comuna y tipo.
   - Nivel de vulnerabilidad.

3. Importador Excel
   - Lectura de hojas.
   - Deteccion de columnas.
   - Conversion de coordenadas.
   - Vista previa y carga.

4. Documentos
   - Contratos.
   - Otrosi.
   - Supervision.
   - Informes de reaccion.
   - Novedades.
   - Investigacion.
   - Estudios de seguridad.
   - Estado de instalaciones.

5. Eventos
   - Registro acumulable.
   - Evidencias.
   - Contador por puesto.
   - Color automatico en mapa.

6. Copiloto IA
   - Analizar Excel.
   - Crear puestos.
   - Buscar informacion.
   - Generar reportes.
   - Detectar inconsistencias.

## MVP actual

El primer corte es una app web local sin backend. Sirve para validar la
experiencia antes de construir la version con base de datos.

## Arquitectura futura

```text
apps/web        Frontend React/Next
apps/api        Backend Node/Nest
database        Migraciones PostgreSQL/PostGIS
storage         Archivos PDF e imagenes
```
