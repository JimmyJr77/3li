import dayGridPlugin from "@fullcalendar/daygrid";
import interactionPlugin from "@fullcalendar/interaction";
import FullCalendar from "@fullcalendar/react";
import { useQuery } from "@tanstack/react-query";
import { CalendarDays, Loader2 } from "lucide-react";
import { useMemo } from "react";
import { fetchAllTasks, fetchBootstrap } from "@/features/taskflow/api";

export function CalendarPage() {
  const bootstrapQuery = useQuery({
    queryKey: ["bootstrap"],
    queryFn: fetchBootstrap,
  });

  const workspaceId = bootstrapQuery.data?.workspace?.id;

  const tasksQuery = useQuery({
    queryKey: ["tasks", "flat", "calendar", workspaceId],
    queryFn: () => fetchAllTasks(workspaceId ? { workspaceId } : undefined),
    enabled: Boolean(workspaceId),
  });

  const events = useMemo(() => {
    const tasks = tasksQuery.data ?? [];
    return tasks
      .filter((t) => t.dueDate)
      .map((t) => ({
        id: t.id,
        title: t.title,
        date: t.dueDate!.slice(0, 10),
        extendedProps: { task: t },
      }));
  }, [tasksQuery.data]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <CalendarDays className="size-5 text-muted-foreground" aria-hidden />
        <h1 className="text-2xl font-semibold tracking-tight">Calendar</h1>
      </div>
      <p className="max-w-2xl text-sm text-muted-foreground">
        Tasks with a due date appear on the calendar. Set due dates from the task panel on the board.
      </p>

      {(bootstrapQuery.isLoading || tasksQuery.isLoading) && (
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="size-4 animate-spin" />
          Loading…
        </div>
      )}
      {tasksQuery.isError && (
        <p className="text-sm text-destructive">Could not load tasks.</p>
      )}

      <div className="rounded-xl border bg-card p-4">
        <FullCalendar
          plugins={[dayGridPlugin, interactionPlugin]}
          initialView="dayGridMonth"
          headerToolbar={{
            left: "prev,next today",
            center: "title",
            right: "dayGridMonth,dayGridWeek",
          }}
          height="auto"
          events={events}
          eventDisplay="block"
        />
      </div>
    </div>
  );
}
