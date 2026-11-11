# Compilar para macOS (pendiente)

GitHub Actions solo compila Windows y Linux. El instalador de macOS se hace a mano desde una Mac.

## Requisitos (una sola vez)

```bash
xcode-select --install                                           # herramientas de Apple
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh   # Rust
rustup target add aarch64-apple-darwin x86_64-apple-darwin       # Apple Silicon e Intel
brew install node                                                # Node 22+ (o desde nodejs.org)
```

## Compilar

```bash
git clone https://github.com/santiagosuarezalf/memoria-cap.git
cd memoria-cap
npm ci
npm run tauri build -- --target universal-apple-darwin   # un solo .dmg para Intel y Apple Silicon
```

El resultado queda en `src-tauri/target/universal-apple-darwin/release/bundle/dmg/`. Súbalo al
Release de la versión correspondiente.

## Primera apertura

La app no está firmada ni notarizada (requiere la cuenta de Apple Developer, USD 99 al año). La
primera vez: clic derecho sobre MemoriaCap → **Abrir** → **Abrir**. En versiones recientes de
macOS puede hacer falta ir a *Configuración del Sistema → Privacidad y seguridad → Abrir de todas
formas*.

## Pendiente decidir

- ¿Firmar y notarizar? Solo vale la pena si la van a usar varias personas con Mac.
- Si se firma, se puede volver a meter macOS en `.github/workflows/release.yml` con los secretos
  del certificado.
