use std::collections::HashMap;

use uuid::Uuid;

use crate::{app::State, Error, ImageChange, ImageStore, Recipe, RecipeInput, Result, Storage};

pub(crate) struct RecipeStore {
    recipes: HashMap<Uuid, Recipe>,
    order: Vec<Uuid>,
}

impl RecipeStore {
    pub(crate) fn new(recipes: Vec<Recipe>) -> Self {
        Self {
            order: recipes.iter().map(|recipe| recipe.id).collect(),
            recipes: recipes
                .into_iter()
                .map(|recipe| (recipe.id, recipe))
                .collect(),
        }
    }

    pub(crate) fn get(&self, id: Uuid) -> Result<&Recipe> {
        self.recipes.get(&id).ok_or(Error::NotFound(id))
    }

    fn ordered(&self) -> impl Iterator<Item = &Recipe> {
        self.order.iter().filter_map(|id| self.recipes.get(id))
    }

    pub(crate) fn list(&self) -> Vec<Recipe> {
        self.ordered().cloned().collect()
    }

    pub(crate) fn search(&self, query: &str) -> Vec<Recipe> {
        let query = query.to_lowercase();
        self.ordered()
            .filter(|recipe| recipe.title.to_lowercase().contains(&query))
            .cloned()
            .collect()
    }
}

fn build_recipe(
    id: Uuid,
    image_version: Option<Uuid>,
    input: RecipeInput,
) -> Result<(Recipe, ImageChange)> {
    let RecipeInput {
        title,
        ingredients,
        instructions,
        servings,
        analysis,
        image,
    } = input;
    if servings == 0 {
        return Err(Error::InvalidInput("Servings must be at least one".into()));
    }
    Ok((
        Recipe {
            id,
            title,
            ingredients,
            instructions,
            servings,
            analysis,
            image_version,
        },
        image,
    ))
}

fn persist_update(
    recipes: &mut RecipeStore,
    storage: &dyn Storage,
    images: &dyn ImageStore,
    mut recipe: Recipe,
    image: ImageChange,
) -> Result<Recipe> {
    match &image {
        ImageChange::Keep => {}
        ImageChange::Remove => recipe.image_version = None,
        ImageChange::Set(image) => {
            images.put(recipe.id, image)?;
            recipe.image_version = Some(Uuid::new_v4());
        }
    }
    storage.update_recipe(&recipe)?;
    recipes.recipes.insert(recipe.id, recipe.clone());
    if matches!(image, ImageChange::Remove) {
        images.remove(recipe.id)?;
    }
    Ok(recipe)
}

pub(crate) fn create(
    state: &mut State,
    storage: &dyn Storage,
    images: &dyn ImageStore,
    input: RecipeInput,
) -> Result<Recipe> {
    let (recipe, image) = build_recipe(Uuid::new_v4(), None, input)?;
    storage.insert_recipe(&recipe)?;
    state.recipes.order.push(recipe.id);
    state.recipes.recipes.insert(recipe.id, recipe.clone());
    if matches!(image, ImageChange::Set(_)) {
        let id = recipe.id;
        match persist_update(&mut state.recipes, storage, images, recipe, image) {
            Ok(recipe) => return Ok(recipe),
            Err(error) => {
                let _ = delete(state, storage, images, id);
                return Err(error);
            }
        }
    }
    Ok(recipe)
}

pub(crate) fn update(
    state: &mut State,
    storage: &dyn Storage,
    images: &dyn ImageStore,
    id: Uuid,
    input: RecipeInput,
) -> Result<Recipe> {
    let previous = state.recipes.get(id)?;
    let (recipe, image) = build_recipe(id, previous.image_version, input)?;
    persist_update(&mut state.recipes, storage, images, recipe, image)
}

pub(crate) fn delete(
    state: &mut State,
    storage: &dyn Storage,
    images: &dyn ImageStore,
    id: Uuid,
) -> Result<()> {
    state.recipes.get(id)?;
    let mut plan = state.plan.clone();
    plan.drop_recipe(id);
    storage.delete_recipe(id, &plan)?;
    state.recipes.recipes.remove(&id);
    state.recipes.order.retain(|recipe_id| *recipe_id != id);
    state.plan = plan;
    images.remove(id)
}

#[cfg(test)]
mod tests {
    use std::sync::{atomic::Ordering, Arc};

    use crate::{
        fakes::{FakeImageStore, FakeStorage},
        tests::{app, FailingStorage},
        AnalysisResponse, Error, ImageChange, ImageStore, Recipe, RecipeInput, ResizedImage,
        Result, Storage, WeeklyPlan,
    };
    use uuid::Uuid;

    fn input(title: &str, image: ImageChange) -> RecipeInput {
        RecipeInput {
            title: title.into(),
            ingredients: "1 carrot".into(),
            instructions: "Cook".into(),
            servings: 2,
            analysis: Some(AnalysisResponse {
                calories: 100,
                ..Default::default()
            }),
            image,
        }
    }

    #[test]
    fn create_appends_and_update_replaces_fields_without_reordering() {
        let storage = Arc::new(FakeStorage::default());
        let first = Recipe {
            title: "Zucchini".into(),
            ingredients: "2 zucchini".into(),
            instructions: "Roast".into(),
            analysis: Some(AnalysisResponse::default()),
            ..Recipe::default()
        };
        let second = Recipe {
            title: "Apple".into(),
            ..Recipe::default()
        };
        storage.insert_recipe(&first).unwrap();
        storage.insert_recipe(&second).unwrap();
        let app = app(storage.clone(), Arc::new(FakeImageStore::default()));
        let created = app.create_recipe(input("Soup", ImageChange::Keep)).unwrap();
        assert_eq!(created.title, "Soup");
        assert_eq!(created.ingredients, "1 carrot");
        assert_eq!(created.instructions, "Cook");
        assert_eq!(created.servings, 2);
        assert_eq!(created.analysis.as_ref().unwrap().calories, 100);
        assert_eq!(created.image_version, None);
        let updated = app
            .update_recipe(
                first.id,
                RecipeInput {
                    title: "New soup".into(),
                    ingredients: String::new(),
                    instructions: "Serve cold".into(),
                    servings: 3,
                    analysis: None,
                    image: ImageChange::Keep,
                },
            )
            .unwrap();
        assert_eq!(
            updated,
            Recipe {
                id: first.id,
                title: "New soup".into(),
                ingredients: String::new(),
                instructions: "Serve cold".into(),
                servings: 3,
                analysis: None,
                image_version: None,
            }
        );
        let expected = vec![updated.clone(), second, created.clone()];
        assert_eq!(app.get_recipe(first.id).unwrap(), updated);
        assert_eq!(app.get_recipe(created.id).unwrap(), created);
        assert_eq!(app.list_recipes().unwrap(), expected);
        assert_eq!(storage.load_recipes().unwrap(), expected);
        assert_eq!(app.search_recipes("SOUP").unwrap(), vec![updated, created]);
    }

    #[test]
    fn image_changes_refresh_versions_and_keep_or_remove_content() {
        let storage = Arc::new(FakeStorage::default());
        let images = Arc::new(FakeImageStore::default());
        let app = app(storage.clone(), images);
        let image = ResizedImage {
            bytes: vec![1, 2, 3],
            width: 1,
            height: 1,
        };
        for change in [
            ImageChange::Keep,
            ImageChange::Remove,
            ImageChange::Set(image.clone()),
        ] {
            let recipe = app.create_recipe(input("Image", change.clone())).unwrap();
            let expected = if matches!(change, ImageChange::Set(_)) {
                Some(image.clone())
            } else {
                None
            };
            assert_eq!(app.image(recipe.id).unwrap(), expected);
            assert_eq!(recipe.image_version.is_some(), expected.is_some());
            assert_eq!(app.get_recipe(recipe.id).unwrap(), recipe);
            assert_eq!(storage.load_recipes().unwrap().last(), Some(&recipe));
        }
        let mut recipe = app.list_recipes().unwrap().pop().unwrap();
        for change in [
            ImageChange::Keep,
            ImageChange::Set(ResizedImage {
                bytes: vec![4, 5],
                width: 2,
                height: 1,
            }),
            ImageChange::Remove,
        ] {
            let previous = recipe.clone();
            recipe = app
                .update_recipe(recipe.id, input("Updated", change.clone()))
                .unwrap();
            match change {
                ImageChange::Keep => {
                    assert_eq!(recipe.image_version, previous.image_version);
                    assert_eq!(app.image(recipe.id).unwrap(), Some(image.clone()));
                }
                ImageChange::Set(image) => {
                    assert!(recipe.image_version.is_some());
                    assert_ne!(recipe.image_version, previous.image_version);
                    assert_eq!(app.image(recipe.id).unwrap(), Some(image));
                }
                ImageChange::Remove => {
                    assert_eq!(recipe.image_version, None);
                    assert_eq!(app.image(recipe.id).unwrap(), None);
                }
            }
            assert_eq!(app.get_recipe(recipe.id).unwrap(), recipe);
            assert_eq!(storage.load_recipes().unwrap().last(), Some(&recipe));
        }
    }

    #[test]
    fn delete_removes_all_planned_occurrences_and_image() {
        let storage = Arc::new(FakeStorage::default());
        let images = Arc::new(FakeImageStore::default());
        let removed = Recipe::default();
        let retained = Recipe::default();
        storage.insert_recipe(&removed).unwrap();
        storage.insert_recipe(&retained).unwrap();
        let mut plan = WeeklyPlan::default();
        plan.days[0] = vec![removed.id, retained.id, removed.id];
        plan.days[3] = vec![removed.id, retained.id];
        storage.save_plan(&plan).unwrap();
        images
            .put(
                removed.id,
                &ResizedImage {
                    bytes: vec![1],
                    width: 1,
                    height: 1,
                },
            )
            .unwrap();
        let app = app(storage.clone(), images);
        app.delete_recipe(removed.id).unwrap();
        plan.days[0] = vec![retained.id];
        plan.days[3] = vec![retained.id];
        assert_eq!(app.get_plan().unwrap(), plan);
        assert_eq!(storage.load_plan().unwrap(), plan);
        assert_eq!(app.list_recipes().unwrap(), vec![retained.clone()]);
        assert_eq!(storage.load_recipes().unwrap(), vec![retained]);
        assert_eq!(app.get_recipe(removed.id), Err(Error::NotFound(removed.id)));
        assert_eq!(app.image(removed.id).unwrap(), None);
    }

    #[test]
    fn unknown_mutation_ids_and_zero_servings_are_rejected() {
        let storage = Arc::new(FakeStorage::default());
        let app = app(storage.clone(), Arc::new(FakeImageStore::default()));
        let missing = Uuid::new_v4();
        assert_eq!(
            app.update_recipe(missing, input("Missing", ImageChange::Keep)),
            Err(Error::NotFound(missing))
        );
        assert_eq!(app.delete_recipe(missing), Err(Error::NotFound(missing)));
        let recipe = app
            .create_recipe(input("Valid", ImageChange::Keep))
            .unwrap();
        let mut invalid = input("Invalid", ImageChange::Remove);
        invalid.servings = 0;
        for result in [
            app.create_recipe(invalid.clone()),
            app.update_recipe(recipe.id, invalid),
        ] {
            assert!(matches!(result, Err(Error::InvalidInput(_))));
        }
        assert_eq!(app.list_recipes().unwrap(), vec![recipe.clone()]);
        assert_eq!(storage.load_recipes().unwrap(), vec![recipe]);
    }

    #[test]
    fn storage_write_failures_leave_cached_and_persisted_state_unchanged() {
        let storage = Arc::new(FailingStorage::default());
        let images = Arc::new(FakeImageStore::default());
        let recipe = Recipe {
            image_version: Some(Uuid::new_v4()),
            ..Recipe::default()
        };
        storage.insert_recipe(&recipe).unwrap();
        let mut plan = WeeklyPlan::default();
        plan.days[1] = vec![recipe.id];
        storage.save_plan(&plan).unwrap();
        let image = ResizedImage {
            bytes: vec![1],
            width: 1,
            height: 1,
        };
        images.put(recipe.id, &image).unwrap();
        let app = app(storage.clone(), images);
        storage.fail_writes.store(true, Ordering::SeqCst);
        let error = Error::Storage("Write failed".into());
        for result in [
            app.create_recipe(input("New", ImageChange::Keep)),
            app.update_recipe(recipe.id, input("Changed", ImageChange::Remove)),
        ] {
            assert_eq!(result, Err(error.clone()));
        }
        assert_eq!(app.delete_recipe(recipe.id), Err(error));
        assert_eq!(app.list_recipes().unwrap(), vec![recipe.clone()]);
        assert_eq!(storage.load_recipes().unwrap(), vec![recipe.clone()]);
        assert_eq!(app.get_recipe(recipe.id).unwrap(), recipe);
        assert_eq!(app.get_plan().unwrap(), plan);
        assert_eq!(storage.load_plan().unwrap(), plan);
        assert_eq!(app.image(recipe.id).unwrap(), Some(image));
    }

    struct FailingImages;

    impl ImageStore for FailingImages {
        fn put(&self, _id: Uuid, _image: &ResizedImage) -> Result<()> {
            Err(Error::Image("Put failed".into()))
        }

        fn get(&self, _id: Uuid) -> Result<Option<ResizedImage>> {
            Ok(None)
        }

        fn remove(&self, _id: Uuid) -> Result<()> {
            Ok(())
        }
    }

    #[test]
    fn failed_image_creation_rolls_back_the_insert() {
        let storage = Arc::new(FakeStorage::default());
        let retained = Recipe::default();
        storage.insert_recipe(&retained).unwrap();
        let app = app(storage.clone(), Arc::new(FailingImages));
        assert_eq!(
            app.create_recipe(input(
                "Failed",
                ImageChange::Set(ResizedImage {
                    bytes: vec![1],
                    width: 1,
                    height: 1,
                })
            )),
            Err(Error::Image("Put failed".into()))
        );
        assert_eq!(app.list_recipes().unwrap(), vec![retained.clone()]);
        assert_eq!(storage.load_recipes().unwrap(), vec![retained]);
    }
}
