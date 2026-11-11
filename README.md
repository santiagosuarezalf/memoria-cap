# MemoriaCap

Convierte el PDF de una memoria de cálculo en anexos listos para radicar: detecta solo el área con
contenido de cada página, acomoda las páginas horizontales y las entrega en Word (sobre la
plantilla con encabezado de la empresa) o en PDF.

> **Idea y versión original: Alejandro Jara**, que creó *ImageCap* para dejar de recortar y
> encoger a mano cientos de páginas en Word. MemoriaCap la reconstruye para Windows, Linux y macOS.
> Ver [AUTHORS.md](AUTHORS.md).

Los PDF se procesan en el propio computador; la app no envía nada a internet.

## Instalar

Descargue el instalador de la última versión en **Releases**:

| Sistema | Archivo |
|---|---|
| Windows 10/11 | `MemoriaCap_x.y.z_x64-setup.exe` |
| Linux | `.AppImage` (portable) o `.deb` |
| macOS | pendiente (ver [docs/MACOS.md](docs/MACOS.md)) |

**Windows la primera vez:** el instalador no está firmado digitalmente, así que Windows muestra
*"Windows protegió su PC"*. Haga clic en **Más información** y luego en **Ejecutar de todas
formas**.

## Estado

Versión 0.1, en construcción. Ver el [estudio y la hoja de ruta](docs/ESTUDIO.md).

## Desarrollo

Requiere Node 22+. Para compilar la app de escritorio, además Rust y los
[requisitos de Tauri](https://v2.tauri.app/start/prerequisites/) de su sistema.

```bash
npm install
npm run dev         # interfaz en el navegador, http://localhost:1420
npm test            # pruebas
npm run tauri dev   # app de escritorio (requiere Rust)
npm run tauri build # instaladores del sistema actual
```

Los instaladores de Windows y Linux los compila GitHub Actions al publicar una etiqueta `vX.Y.Z`.

**No suba PDF ni documentos reales de proyectos al repositorio.** Las pruebas usan páginas
sintéticas generadas en código.

## Licencia

[MIT](LICENSE).
