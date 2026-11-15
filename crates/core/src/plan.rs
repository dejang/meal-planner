use uuid::Uuid;

use crate::{app::State, MealPosition, Result, Storage, WeeklyPlan};

pub(crate) fn add(
    _state: &mut State,
    _storage: &dyn Storage,
    _position: MealPosition,
    _recipe_id: Uuid,
) -> Result<WeeklyPlan> {
    todo!()
}

pub(crate) fn move_meal(
    _state: &mut State,
    _storage: &dyn Storage,
    _from: MealPosition,
    _to: MealPosition,
) -> Result<WeeklyPlan> {
    todo!()
}

pub(crate) fn remove(
    _state: &mut State,
    _storage: &dyn Storage,
    _position: MealPosition,
) -> Result<WeeklyPlan> {
    todo!()
}

pub(crate) fn clear_day(
    _state: &mut State,
    _storage: &dyn Storage,
    _day: u32,
) -> Result<WeeklyPlan> {
    todo!()
}

pub(crate) fn copy_previous_day(
    _state: &mut State,
    _storage: &dyn Storage,
    _day: u32,
) -> Result<WeeklyPlan> {
    todo!()
}
