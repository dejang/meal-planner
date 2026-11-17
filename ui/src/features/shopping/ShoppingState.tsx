interface ShoppingStateProps {
  loading: boolean;
  error: string | null;
  itemCount: number;
  emptyClassName: string;
}

export function ShoppingState({
  loading,
  error,
  itemCount,
  emptyClassName,
}: ShoppingStateProps) {
  return (
    <>
      {loading && itemCount === 0 && (
        <p role="status">Loading shopping list…</p>
      )}
      {error && <p role="alert">{error}</p>}
      {!loading && !error && itemCount === 0 && (
        <div className={emptyClassName}>
          <p>Your shopping list is empty.</p>
          <p>
            Add meals with analyzed ingredients to your weekly plan to get
            started.
          </p>
        </div>
      )}
    </>
  );
}
