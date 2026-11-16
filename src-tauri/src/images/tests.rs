use super::{protocol_response, LocalImages};
use crate::tests::TestResult;
use meal_planner_core::{Error, ImageStore, ResizedImage};
use tauri::{http, Manager};
use uuid::Uuid;

fn image_store(
    directory: &std::path::Path,
) -> TestResult<(rusqlite::Connection, LocalImages, Uuid)> {
    let connection = crate::db::open(directory)?;
    let id = Uuid::new_v4();
    connection.execute(
        "INSERT INTO recipes VALUES (?1, 0, 'Soup', '', '', 1, NULL)",
        [id.to_string()],
    )?;
    let images = LocalImages::new(crate::db::open(directory)?);
    Ok((connection, images, id))
}

#[test]
fn images_replace_persist_and_remove() -> TestResult {
    let directory = tempfile::tempdir()?;
    let (connection, images, id) = image_store(directory.path())?;
    assert_eq!(images.get(Uuid::new_v4())?, None);
    let mut versions = Vec::new();
    for image in [
        ResizedImage {
            bytes: vec![1, 2],
            width: 2,
            height: 1,
        },
        ResizedImage {
            bytes: vec![3, 4, 5],
            width: 1,
            height: 3,
        },
    ] {
        let version = images.put(id, &image)?;
        assert_eq!(images.get(id)?, Some(image));
        let persisted: String = connection.query_row(
            "SELECT version FROM images WHERE recipe_id = ?1",
            [id.to_string()],
            |row| row.get(0),
        )?;
        assert_eq!(persisted, version.to_string());
        versions.push(version);
    }
    assert_ne!(versions[0], versions[1]);
    let count: u32 = connection.query_row("SELECT count(*) FROM images", [], |row| row.get(0))?;
    assert_eq!(count, 1);
    let reopened = LocalImages::new(crate::db::open(directory.path())?);
    assert_eq!(reopened.get(id)?, images.get(id)?);
    for _ in 0..2 {
        reopened.remove(id)?;
        assert_eq!(images.get(id)?, None);
    }
    assert!(matches!(
        images.put(
            Uuid::new_v4(),
            &ResizedImage {
                bytes: vec![1],
                width: 1,
                height: 1,
            }
        ),
        Err(Error::Storage(_))
    ));
    Ok(())
}

#[test]
fn protocol_serves_platform_urls_and_reports_missing_images_and_storage_errors() -> TestResult {
    let directory = tempfile::tempdir()?;
    let app = crate::tests::mock_app()?;
    crate::setup_state(&app, directory.path())?;
    let (connection, images, id) = image_store(directory.path())?;
    let image = ResizedImage {
        bytes: vec![255, 216, 255],
        width: 1,
        height: 1,
    };
    images.put(id, &image)?;
    for origin in [
        "image://localhost",
        "http://image.localhost",
        "https://image.localhost",
    ] {
        for (path, status) in [
            (format!("{id}?v=ignored"), http::StatusCode::OK),
            (Uuid::new_v4().to_string(), http::StatusCode::NOT_FOUND),
            ("invalid".into(), http::StatusCode::NOT_FOUND),
        ] {
            let request = http::Request::builder()
                .uri(format!("{origin}/{path}"))
                .body(Vec::new())?;
            let response =
                protocol_response(app.state::<meal_planner_core::App>().inner(), &request);
            assert_eq!(response.status(), status);
            if status == http::StatusCode::OK {
                assert_eq!(response.headers()[http::header::CONTENT_TYPE], "image/jpeg");
                assert_eq!(response.body(), &image.bytes);
            }
        }
    }
    connection.execute("DROP TABLE images", [])?;
    let request = http::Request::builder()
        .uri(format!("image://localhost/{id}"))
        .body(Vec::new())?;
    let response = protocol_response(app.state::<meal_planner_core::App>().inner(), &request);
    assert_eq!(response.status(), http::StatusCode::INTERNAL_SERVER_ERROR);
    assert_eq!(
        response.headers()[http::header::CONTENT_TYPE],
        "text/plain; charset=utf-8"
    );
    assert!(String::from_utf8(response.into_body())?.contains("no such table"));
    Ok(())
}
