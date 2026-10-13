import { planningWeek } from "@/mocks/dashboard";
import { toneSoft, toneDot } from "./tone";

export default function PlanningView() {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="font-heading font-semibold text-sm text-foreground-950">Semaine du 6 au 10 octobre</span>
        </div>
        <span className="inline-flex items-center gap-2 h-8 px-3 rounded-full bg-accent-100 text-accent-700 text-[11px] font-semibold whitespace-nowrap">
          <i className="ri-road-map-line"></i> Trajets optimisés
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
        {planningWeek.map((day) => (
          <div key={day.day} className="rounded-lg border border-background-200 bg-background-50 p-3">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-semibold text-foreground-800">{day.day}</span>
              <span className="text-[10px] text-foreground-400">{day.date} oct.</span>
            </div>
            <div className="flex flex-col gap-2">
              {day.slots.map((slot) => (
                <div key={slot.time} className={`p-2.5 rounded-md border ${toneSoft[slot.tone]}`}>
                  <div className="flex items-center gap-1.5">
                    <span className={`w-1.5 h-1.5 rounded-full ${toneDot[slot.tone]}`}></span>
                    <span className="text-[10px] font-semibold text-foreground-700">{slot.time}</span>
                  </div>
                  <p className="mt-1 text-[11px] font-medium text-foreground-900 leading-snug">{slot.label}</p>
                  <p className="text-[10px] text-foreground-500">
                    <i className="ri-map-pin-line"></i> {slot.ville}
                  </p>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}