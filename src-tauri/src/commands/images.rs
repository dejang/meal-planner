use meal_planner_core::{App, ResizedImage, Result};
use tauri::State;
use uuid::Uuid;

#[tauri::command]
#[specta::specta]
pub async fn load_image_file(path: String) -> Result<ResizedImage> {
    crate::images::load_file(&path).await
}

#[tauri::command]
#[specta::specta]
pub async fn load_image_url(
    client: State<'_, reqwest::Client>,
    url: String,
) -> Result<ResizedImage> {
    crate::images::load_url(&client, &url).await
}

#[tauri::command]
#[specta::specta]
pub fn image(app: State<'_, App>, recipe_id: Uuid) -> Result<Option<ResizedImage>> {
    app.image(recipe_id)
}

#[cfg(test)]
mod tests {
    use super::{load_image_file, load_image_url};
    use crate::test_support::TestResult;
    use meal_planner_core::{image::resize_image, Error};

    fn image_fixture() -> &'static [u8] {
        include_bytes!("../importer/fixtures/wide.png")
    }

    #[test]
    fn file_loader_resizes_a_fixture_and_reports_invalid_files() -> TestResult {
        let directory = tempfile::tempdir()?;
        let fixture = image_fixture();
        let path = directory.path().join("image.png");
        std::fs::write(&path, fixture)?;
        let path_string = path
            .to_str()
            .ok_or("Image fixture path is not UTF-8")?
            .to_owned();
        let image = tauri::async_runtime::block_on(load_image_file(path_string.clone()))?;
        assert_eq!(image, resize_image(fixture)?);
        std::fs::write(&path, b"not an image")?;
        assert!(matches!(
            tauri::async_runtime::block_on(load_image_file(path_string)),
            Err(Error::Image(_))
        ));
        Ok(())
    }

    #[test]
    fn url_loader_resizes_downloads_and_reports_http_transport_and_decode_errors() -> TestResult {
        use tauri::Manager;

        let app = crate::test_support::mock_app()?;
        let directory = tempfile::tempdir()?;
        crate::setup_state(&app, directory.path())?;
        let client = app.state::<reqwest::Client>();
        let fixture = image_fixture();
        let expected_user_agent = format!("user-agent: MealPlanner/{}", env!("CARGO_PKG_VERSION"));
        let (address, server) = crate::test_support::serve_http(
            |_| {
                vec![
                    (200, fixture.to_vec()),
                    (404, fixture.to_vec()),
                    (200, b"not an image".to_vec()),
                ]
            },
            move |request| {
                assert!(request
                    .windows(expected_user_agent.len())
                    .any(|header| header.eq_ignore_ascii_case(expected_user_agent.as_bytes())));
            },
        )?;
        let url = format!("http://{address}/image");
        let image = tauri::async_runtime::block_on(load_image_url(client.clone(), url.clone()))?;
        assert_eq!(image, resize_image(fixture)?);
        for expected in ["404", "could not be determined"] {
            let error = tauri::async_runtime::block_on(load_image_url(client.clone(), url.clone()))
                .unwrap_err();
            assert!(matches!(error, Error::Image(_)));
            assert!(error.to_string().contains(expected), "{error}");
        }
        server
            .join()
            .unwrap_or_else(|panic| std::panic::resume_unwind(panic))?;
        let connection_error = std::net::TcpStream::connect(address).unwrap_err();
        let error =
            tauri::async_runtime::block_on(load_image_url(client.clone(), url)).unwrap_err();
        assert!(matches!(error, Error::Image(_)));
        assert!(
            error.to_string().contains(&connection_error.to_string()),
            "{error}"
        );
        Ok(())
    }
}
