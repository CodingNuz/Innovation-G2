use axum::{Router, response::Html, routing::get};
use tower_http::services::ServeDir;

const INDEX_HTML: &str = include_str!("../html/index.html");

// Macro automatically turns `async fn main` into a blocking program by
// spinning up a Tokio runtime inside it. Rust forbids a plain `async main`.
#[tokio::main]
async fn main() {
    // Url -> solve func
    let app = Router::new()
        .route("/", get(root))
        .route("/introduction", get(about))
        .nest_service(
            "/static",
             ServeDir::new(concat!(env!("CARGO_MANIFEST_DIR"), "/static")),
        );

    let listener = tokio::net::TcpListener::bind("127.0.0.1:3000")
        .await
        .unwrap();

    println!("Running at http://127.0.0.1:3000");

    // Accept connection until off by the user
    axum::serve(listener, app)
        .await
        .unwrap();
}

async fn root() -> Html<&'static str> {
    Html(INDEX_HTML)
}

async fn about() -> Html<&'static str> {
    Html(include_str!("../html/about.html"))
}