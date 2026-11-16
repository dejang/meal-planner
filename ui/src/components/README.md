# Shared presentation

All controls are props-driven and independent of application stores.

- `Button`: native button props, default/primary/quiet variants via ButtonVariant.
- `TextInput`, `TextArea`: native props, shared input treatment. Callers supply labels.
- `Icon`: bundled Lucide glyphs via IconName; decorative by default. Put accessible
  labels on icon-only controls, not on their decorative glyphs.
- `PaperDialog`: mounted means open, native modal focus, explicit close controls.
  Escape and backdrop clicks do not close dialogs, matching legacy windows.
  A native close event synchronizes the owner's open state through onClose.
  DialogSize supports default, editor (980×860 maximum) and shopping (1080×900).
  Children mount only after showModal(), so their layout effects measure an open dialog.
  Headerless dialogs initially focus the dialog element rather than a child control.
  They retain an accessible title; their feature supplies its close control.
  PaperWindowHeader is available separately for custom window content. Its optional
  closeLabel supplies both the close button's accessible name and native hover tooltip,
  defaulting to "Close".
- `NutritionLabel`: analysis plus optional servings and servingsLabel. The default
  is one serving labelled Amount per day for the backend's dayTotals response. Nutrient
  quantities preserve legacy's ceil(abs(quantity)) then integer division; calories
  truncate after division. Nutrients discloses vitamins/minerals from totalDaily.
- `RecipePhoto`: optional nullable recipeId/imageVersion, optional ResizedImage,
  alt and optional style/className. A draft image takes precedence as a JPEG data URL;
  otherwise it uses the API's versioned image:// helper. Photos cover the frame and
  use legacy's plate/chef placeholder when missing or failed. Changed sources retry.

Use the provided onClose through explicit controls to close frames. Editor and
shopping own their headers/footers; import and settings use shell-provided headers.
NutritionLabel.test.tsx includes a sample analysis and day-totals rendering path.
