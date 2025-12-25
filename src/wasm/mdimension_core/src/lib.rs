use wasm_bindgen::prelude::*;

// Import the `window.console.log` function from the Web.
#[wasm_bindgen]
extern "C" {
    #[wasm_bindgen(js_namespace = console)]
    fn log(s: &str);
}

// Initialize the panic hook to get nice error messages in the console
#[wasm_bindgen(start)]
pub fn start() {
    console_error_panic_hook::set_once();
    log("WASM Module Initialized (with panic hook)");
}

// Export a function that can be called by JavaScript.
#[wasm_bindgen]
pub fn greet(name: &str) {
    log(&format!("Hello, {}! This is Rust running in WASM.", name));
}

// Simple math function to verify typed bindings
#[wasm_bindgen]
pub fn add_wasm(a: i32, b: i32) -> i32 {
    a + b
}
