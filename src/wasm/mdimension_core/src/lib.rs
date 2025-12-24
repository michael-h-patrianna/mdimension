use wasm_bindgen::prelude::*;

// Import the `window.alert` function from the Web.
#[wasm_bindgen]
extern "C" {
    #[wasm_bindgen(js_namespace = console)]
    fn log(s: &str);
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
