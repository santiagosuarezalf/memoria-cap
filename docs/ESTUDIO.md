# Estudio: de ImageCap a MemoriaCap

## Qué hace ImageCap (v0.5)

Es un posproceso para los anexos de las memorias de cálculo:

1. Se carga el PDF que exporta el software de cálculo (suele ser pesado y de cientos de páginas).
2. Cada página se convierte en imagen, normalmente a 250 dpi para que los números se lean bien
   al imprimir.
3. Se recortan los márgenes con cuatro casillas numéricas, revisando página por página que no
   se corte información.
4. Opcionalmente se tapa una zona con un rectángulo de color ("máscara").
5. Se guardan las imágenes sueltas o se exportan a un Word a altura fija (unos 220 mm, para que
   quepan entre los márgenes del formato de la empresa). Luego se copian y pegan en el documento
   con el encabezado.

Antes de ImageCap esto se hacía a mano en Word, pegando y encogiendo cada imagen.

## Lo que pidieron los usuarios

- **Recorte automático:** que la app encuentre sola dónde empieza y termina el contenido, en vez
  de revisar página por página.
- **Páginas horizontales y verticales en el mismo PDF:** que se acomoden solas a la hoja.
- **Que no se cierre** al salir sin haber escogido un archivo.
- **Que las casillas numéricas se vean bien en todos los equipos.**

## Problemas encontrados en el código original

| Problema | Efecto |
|---|---|
| Las páginas se ordenan por nombre de archivo: `img0, img1, img10, img11… img2` | Con más de 10 páginas, el Word sale **desordenado** |
| El recorte usa el tamaño de la página seleccionada para todas | Si el PDF mezcla tamaños, las demás páginas se recortan mal |
| Las rutas dependen de la carpeta desde donde se abre la app, y se mezclan `dir/imagenes` y `dir/Imagenes` | Hay que copiar carpetas junto al .exe; en Linux y macOS no funcionaría |
| Se convierte a JPG, se recorta y se vuelve a guardar en JPG | Se pierde calidad dos veces, justo en los números |
| La máscara dice "mm" pero mide píxeles | Al cambiar la resolución, la máscara queda en otro lugar |
| `try/except` vacíos y una imagen de vista previa obligatoria | El cierre al salir sin archivo |
| Se lee el PDF entero con otra librería solo para contar páginas | Lentitud |
| Ejecutable de 112 MB más instalador de 95 MB, sin firma | Pesado y fácil de bloquear por el antivirus |

Por eso se reconstruye desde cero y no se parte del código original.

## Decisiones

**App de escritorio con Tauri 2.** La interfaz es web (TypeScript y React) y Tauri la empaqueta
con el motor de navegador que ya trae el sistema (WebView2 en Windows). Los instaladores pesan
unos 10 MB frente a los 112 MB de antes, y salen para Windows, Linux y macOS desde el mismo código.

Alternativas descartadas:

- **Python con PySide6:** era lo natural para continuar, pero empaquetar y mantener un ejecutable
  por sistema con PyInstaller es justo lo que hoy da problemas.
- **Electron:** funciona igual, pero cada instalador pesa más de 100 MB porque trae su propio
  Chromium.
- **Solo web:** descartada por decisión del proyecto; se prefiere un instalador que se entrega
  directamente.

**Todo local.** Los PDF nunca salen del computador.

**Licencias permisivas.** El proyecto es MIT. Se evita PyMuPDF/MuPDF, que usaba el original,
porque es AGPL y obligaría a todo el proyecto a serlo.

## Mejoras planeadas

1. **Recorte automático.** Probado con un reporte real de ETABS: el programa repite encabezado
   (título y fecha) y pie (versión y "Page N of M") en cada hoja, así que no basta con buscar la
   tinta. Cada página se divide en bandas de contenido y se descartan las que se repiten en la
   misma posición en la mayoría de las hojas. Se rasteriza cada página a baja resolución, se busca el rectángulo con
   tinta y se le deja un margen de respiro. Hay dos modos: *mismo recorte para todas* (la unión de
   los rectángulos) o *por página*. Las líneas de recorte se pueden arrastrar con el mouse sobre
   la vista previa.
2. **Orientación automática.** Las páginas horizontales salen en una sección horizontal del Word,
   o se rotan, según el usuario prefiera.
3. **Word directo sobre la plantilla.** El usuario elige su `.docx` o `.dotx` con encabezado y la
   app inserta las páginas ahí, escaladas a los márgenes reales de la plantilla. Se acaba el copiar
   y pegar.
4. **PDF sin rasterizar.** Cada página recortada se monta tal cual, como vector, sobre la hoja
   membretada. Los números quedan nítidos a cualquier zoom y el archivo pesa mucho menos.
5. **PNG por defecto** a 250–300 dpi en vez de JPG: mejor para planos y texto.
6. **Perfiles en milímetros**, independientes de la resolución (por ejemplo "ETABS carta"). Se
   guardan como `.json` y se pueden importar los `.vic` de ImageCap.
7. **Varias máscaras**, en mm, para tapar encabezados del software o marcas de agua, en todas las
   páginas o en un rango.

## Stack

| Capa | Herramienta | Licencia |
|---|---|---|
| Escritorio | Tauri 2 (Rust), plugins `dialog` y `fs` | MIT / Apache-2.0 |
| Lenguaje y build | TypeScript, Vite, npm | MIT / Apache-2.0 |
| Interfaz | React + Tailwind CSS | MIT |
| Ver y rasterizar PDF | pdf.js (`pdfjs-dist`) | Apache-2.0 |
| PDF de salida vectorial | pdf-lib | MIT |
| Word sobre plantilla | JSZip + edición del XML del `.docx` | MIT |
| Recorte automático | Canvas + Web Worker, sin OpenCV | n/a |
| Pruebas | Vitest, con páginas sintéticas | MIT |
| Lint y formato | Biome | MIT |
| CI e instaladores | GitHub Actions + `tauri-action` (Windows y Linux; macOS a mano) | MIT |

## Hoja de ruta

- [x] **0.1:** base del proyecto, apertura del PDF, vista previa y detección automática del área
      con contenido.
- [x] **0.2:** recorte ajustable con el mouse y el teclado, en dos modos (igual para todas, por
      tamaño de hoja, o por página); se quitan solos el encabezado y el pie que repite el programa
      de cálculo; exportar imágenes PNG/JPG numeradas en el orden correcto.
- [x] **0.3:** exportar a Word sobre la plantilla (conserva encabezado, pie y márgenes; borra las
      figuras viejas), con altura máxima ajustable, y páginas horizontales giradas o en
      sección horizontal. Probado abriendo el resultado en Word.
- [x] **0.4:** exportar a PDF vectorial sobre hoja membretada: las páginas se copian sin pasar a
      imagen (43 páginas de ETABS: 0,5 MB frente a 18,5 MB del Word), con márgenes en mm y
      páginas con /Rotate interno.
- [x] **0.4.1:** numerar las hojas del PDF desde la app, con texto libre ({n}, {total}), número
      inicial, posición y tamaño (el membrete es fijo y repetiría su número).
- [x] **0.5:** máscaras (se arrastran sobre la vista previa; todas las páginas o un rango; en el
      PDF vectorial tapan a la vista pero el texto de debajo sigue en el archivo, y la app lo avisa),
      perfiles .json, la última configuración se recuerda, e importación de los `.vic` de ImageCap.
- [ ] Instalador de macOS (ver [MACOS.md](MACOS.md)).
