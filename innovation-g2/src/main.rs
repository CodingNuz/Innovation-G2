use axum::{Router, response::Html, routing::get};
use tower_http::services::ServeDir;

// Macro automatically turns `async fn main` into a blocking program by
// spinning up a Tokio runtime inside it. Rust forbids a plain `async main`.
#[tokio::main]
async fn main() {
    // Url -> solve func
    let app = Router::new()
        .route("/", get(root))
        .route("/introduction", get(about))
        .nest_service("/static", ServeDir::new("static"));

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
    Html(
        r#"<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>About | Innovation G2</title>
    <link rel="stylesheet" href="/static/css/style.css">
</head>
<body>
    <h1>About</h1>
    <p><a href="/">Back to Main</a></p>
</body>
</html>"#,
    )
}

// A raw string (`r#"..."#`) lets write `"` and `\` without escaping them,
// which matters once real HTML, CSS or JSON is embedded in Rust source.
const INDEX_HTML: &str = r#"<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Innovation G2</title>
    <link rel="stylesheet" href="/static/css/style.css">
</head>
<body>
    <header>
        <h1>Innovation G2</h1>
        <nav>
            <a href="/">Main</a>
            <a href="/introduction">About</a>
        </nav>
    </header>

    <main>
        <h2>Innovation G2</h2>
        <p>Server by Axum + Tokio.</p>
    </main>
</body>
</html>"#;
