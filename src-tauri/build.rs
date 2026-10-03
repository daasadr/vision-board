fn main() {
    let target_windows_msvc = std::env::var("CARGO_CFG_TARGET_OS").as_deref() == Ok("windows")
        && std::env::var("CARGO_CFG_TARGET_ENV").as_deref() == Ok("msvc");
    if !target_windows_msvc {
        tauri_build::build();
        return;
    }

    // Tauri embeds its app manifest only into the app binary, so `cargo test` binaries lack
    // Common Controls v6 and fail with STATUS_ENTRYPOINT_NOT_FOUND. Embed our own manifest
    // into every binary instead.
    let windows = tauri_build::WindowsAttributes::new_without_app_manifest();
    tauri_build::try_build(tauri_build::Attributes::new().windows_attributes(windows))
        .expect("failed to run tauri-build");

    let manifest = std::env::current_dir()
        .expect("build script has a working directory")
        .join("windows-app-manifest.xml");
    println!("cargo:rerun-if-changed={}", manifest.display());
    println!("cargo:rustc-link-arg=/MANIFEST:EMBED");
    println!("cargo:rustc-link-arg=/MANIFESTINPUT:{}", manifest.display());
    println!("cargo:rustc-link-arg=/WX");
}
