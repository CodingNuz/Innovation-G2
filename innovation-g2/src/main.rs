use axum::{Router, extract::State, http::StatusCode, response::Html, routing::get};
use minijinja::{Environment, context};
use tower_http::services::ServeDir;
use std::sync::Arc;

// Macro automatically turns `async fn main` into a blocking program by spinning up a Tokio runtime inside it. Rust forbids a plain `async main`.
#[tokio::main]
async fn main() {
    // Url -> solve func
    // Parse template once at startup, share the compiled env across every request instead of rebuild it perhit
    let env = build_env();
    let app = Router::new()
        .route("/", get(root))
        .route("/introduction", get(about))
        .route("/tryit", get(tryit))
        .nest_service(
            "/static",
            ServeDir::new(concat!(env!("CARGO_MANIFEST_DIR"), "/static")),
        )
        .with_state(Arc::new(env));

    let listener = tokio::net::TcpListener::bind("127.0.0.1:3000")
        .await
        .unwrap();

    println!("Running at http://127.0.0.1:3000");

    // Accept connection until off by the user
    axum::serve(listener, app)
        .await
        .unwrap();
}

fn build_env() -> Environment<'static> {
    let mut env = Environment::new();
    // Template only fails to syntax error, bad template become build-time bug not runtime
    env.add_template("head.html", include_str!("../html/head.html"))
        .expect("head.html must parse");
    env.add_template("index.html", include_str!("../html/index.html"))
        .expect("index.html must parse");
    env.add_template("about.html", include_str!("../html/about.html"))
        .expect("about.html must parse");
    env.add_template("tryit.html", include_str!("../html/tryit.html"))
        .expect("tryit.html must parse");
    env
}

type AppState = Arc<Environment<'static>>;
type Page = Result<Html<String>, (StatusCode, String)>;

// Each handler pulls the shared env out of state and passes it to render
async fn root(State(env): State<AppState>) -> Page {
    Ok(Html(render(&env, "index.html", "Innovation G2")?))
}

async fn about(State(env): State<AppState>) -> Page {
    Ok(Html(render(&env, "about.html", "About")?))
}

async fn tryit(State(env): State<AppState>) -> Page {
    Ok(Html(render(&env, "tryit.html", "Try It")?))
}

// Templates were registered once in build_env; this looks one up and renders it
fn render(env: &Environment, name: &str, title: &str) -> Result<String, (StatusCode, String)> {
    env.get_template(name)
        .map_err(template_err)?
        .render(context! { title => title })
        .map_err(template_err)
}

fn template_err(e: minijinja::Error) -> (StatusCode, String) {
    (StatusCode::INTERNAL_SERVER_ERROR, e.to_string())
}