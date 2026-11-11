// Sin ventana de consola en Windows al abrir la app.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    memoria_cap_lib::run()
}
