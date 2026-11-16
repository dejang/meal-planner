use std::{sync::Arc, time::Duration};

use async_trait::async_trait;
use meal_planner_core::{AnalysisResponse, Error, NutritionalAnalyzer, Result};
use reqwest::{Client, Request, StatusCode};
use serde_json::json;

use crate::settings::{Credentials, Settings};

pub struct EdamamClient<R: tauri::Runtime> {
    client: Client,
    settings: Arc<Settings<R>>,
}

impl<R: tauri::Runtime> EdamamClient<R> {
    pub fn new(settings: Arc<Settings<R>>) -> Result<Self> {
        let client = Client::builder()
            .timeout(Duration::from_secs(30))
            .build()
            .map_err(analysis_error)?;
        Ok(Self { client, settings })
    }
}

fn build_request(client: &Client, credentials: &Credentials, lines: &[String]) -> Result<Request> {
    if credentials.app_id.trim().is_empty() || credentials.api_key.trim().is_empty() {
        return Err(Error::Analysis("Edamam credentials are missing".into()));
    }
    client
        .post("https://api.edamam.com/api/nutrition-details")
        .query(&[
            ("app_id", &credentials.app_id),
            ("app_key", &credentials.api_key),
        ])
        .json(&json!({"ingr": lines}))
        .build()
        .map_err(analysis_error)
}

fn parse_response(status: StatusCode, body: &str) -> Result<AnalysisResponse> {
    if status != StatusCode::OK {
        return Err(Error::Analysis(format!("Edamam returned {status}: {body}")));
    }
    serde_json::from_str(body)
        .map_err(|error| Error::Analysis(format!("Invalid Edamam response: {error}")))
}

fn analysis_error(error: reqwest::Error) -> Error {
    Error::Analysis(error.without_url().to_string())
}

#[async_trait]
impl<R: tauri::Runtime> NutritionalAnalyzer for EdamamClient<R> {
    async fn analyze(&self, lines: &[String]) -> Result<AnalysisResponse> {
        let credentials = self.settings.get_credentials()?;
        let request = build_request(&self.client, &credentials, lines)?;
        let response = self.client.execute(request).await.map_err(analysis_error)?;
        let status = response.status();
        let body = response.text().await.map_err(analysis_error)?;
        parse_response(status, &body)
    }
}

#[cfg(test)]
mod tests {
    use super::{build_request, parse_response};
    use crate::settings::Credentials;
    use meal_planner_core::{AnalysisResponse, Error};
    use reqwest::{Client, Method, StatusCode};
    use serde_json::{json, Value};

    #[test]
    fn request_encodes_credentials_and_ingredient_lines() {
        let credentials = Credentials {
            app_id: "app &+?".into(),
            api_key: "secret/#=é".into(),
        };
        let lines = vec!["1 carrot".into(), "½ cup milk".into()];
        let request = build_request(&Client::new(), &credentials, &lines).unwrap();
        assert_eq!(request.method(), Method::POST);
        assert_eq!(request.url().scheme(), "https");
        assert_eq!(request.url().host_str(), Some("api.edamam.com"));
        assert_eq!(request.url().path(), "/api/nutrition-details");
        assert_eq!(
            request.url().query_pairs().collect::<Vec<_>>(),
            vec![
                ("app_id".into(), credentials.app_id.into()),
                ("app_key".into(), credentials.api_key.into()),
            ]
        );
        assert_eq!(request.headers()["content-type"], "application/json");
        assert_eq!(
            serde_json::from_slice::<Value>(request.body().unwrap().as_bytes().unwrap()).unwrap(),
            json!({"ingr": lines})
        );
    }

    #[test]
    fn missing_credentials_prevent_request_building() {
        for (app_id, api_key) in [("", ""), (" ", "key"), ("app", "\n")] {
            let credentials = Credentials {
                app_id: app_id.into(),
                api_key: api_key.into(),
            };
            assert_eq!(
                build_request(&Client::new(), &credentials, &[]).unwrap_err(),
                Error::Analysis("Edamam credentials are missing".into())
            );
        }
    }

    #[test]
    fn response_errors_include_status_text_or_parse_failure() {
        for status in [
            StatusCode::CREATED,
            StatusCode::UNAUTHORIZED,
            StatusCode::UNPROCESSABLE_ENTITY,
            StatusCode::INTERNAL_SERVER_ERROR,
        ] {
            assert_eq!(
                parse_response(status, "provider detail"),
                Err(Error::Analysis(format!(
                    "Edamam returned {status}: provider detail"
                )))
            );
        }
        for body in ["", "not JSON", "{}", "{\"calories\":\"invalid\"}"] {
            assert!(
                matches!(parse_response(StatusCode::OK, body), Err(Error::Analysis(message)) if message.starts_with("Invalid Edamam response:"))
            );
        }
    }

    #[test]
    fn parses_edamam_analysis() {
        let body = include_str!("../../crates/core/tests/fixtures/analysis.json");
        let expected: AnalysisResponse = serde_json::from_str(body).unwrap();
        assert_eq!(parse_response(StatusCode::OK, body).unwrap(), expected);
    }
}
