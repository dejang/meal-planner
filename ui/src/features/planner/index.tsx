import "./planner.css";

export default function Planner() {
  return (
    <div className="planner-days">
      {Array.from({ length: 6 }, (_, day) => (
        <section className="planner-day" key={day}>
          <h2>Day {day + 1}</h2>
        </section>
      ))}
    </div>
  );
}
