CREATE TABLE recipes (
    id TEXT PRIMARY KEY NOT NULL,
    position INTEGER NOT NULL,
    title TEXT NOT NULL,
    ingredients TEXT NOT NULL,
    instructions TEXT NOT NULL,
    servings INTEGER NOT NULL,
    analysis TEXT NULL
);

CREATE TABLE plan (
    day INTEGER NOT NULL CHECK (day BETWEEN 0 AND 5),
    position INTEGER NOT NULL,
    recipe_id TEXT NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
    PRIMARY KEY (day, position)
);

CREATE TABLE images (
    id TEXT PRIMARY KEY NOT NULL,
    recipe_id TEXT NOT NULL UNIQUE REFERENCES recipes(id) ON DELETE CASCADE,
    width INTEGER NOT NULL,
    height INTEGER NOT NULL,
    data BLOB NOT NULL,
    version TEXT NOT NULL
);
