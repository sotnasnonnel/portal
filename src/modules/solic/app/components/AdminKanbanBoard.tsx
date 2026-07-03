import { Link } from "react-router-dom";
import { DragDropContext, Droppable, Draggable, DropResult } from "@hello-pangea/dnd";
import styles from "./AdminKanbanBoard.module.css";
import { supabase } from "@/lib/supabase";
import { StatusBadge } from "@/app/components/StatusBadge";
import { formatDateBR } from "@/lib/date";


export type SurveyStatus =
  | "DRAFT"
  | "SUBMITTED"
  | "URGENT_REVIEW"
  | "SCHEDULING"
  | "SCHEDULED"
  | "IN_PROGRESS"
  | "COMPLETED"
  | "CANCELLED";

export type KanbanCol = "OPEN" | "IN_PROGRESS" | "DONE" | "CANCELLED";

export type SurveyLite = {
  id: number;
  status: SurveyStatus;
  urgent?: boolean | null;
  created_by: string;
  requester: string | null;
  needed_date: string | null;
  admin_deadline: string | null;
  completed_at: string | null;
  assets?: { code?: string | null; title?: string | null } | null;
};

const COLS: { key: KanbanCol; title: string }[] = [
  { key: "OPEN", title: "Abertas" },
  { key: "IN_PROGRESS", title: "Em andamento" },
  { key: "DONE", title: "Concluídas" },
  { key: "CANCELLED", title: "Canceladas" },
];

// ✅ exibição por coluna (inclui DRAFT em Abertas)
const STATUS_IN_COL: Record<KanbanCol, SurveyStatus[]> = {
  OPEN: ["DRAFT", "SUBMITTED", "URGENT_REVIEW"],
  IN_PROGRESS: ["SCHEDULING", "SCHEDULED", "IN_PROGRESS"],
  DONE: ["COMPLETED"],
  CANCELLED: ["CANCELLED"],
};

// ✅ ao soltar (Admin), qual status gravar
function statusToPersistOnDrop(target: KanbanCol, current: SurveyStatus): SurveyStatus {
  if (target === "OPEN") {
    // mantém urgente se já era, senão vira SUBMITTED
    return current === "URGENT_REVIEW" ? "URGENT_REVIEW" : "SUBMITTED";
  }
  if (target === "IN_PROGRESS") return "IN_PROGRESS";
  if (target === "DONE") return "COMPLETED";
  return "CANCELLED";
}

function colColor(col: KanbanCol) {
  if (col === "OPEN") return "#26405d";        // azul
  if (col === "IN_PROGRESS") return "#c35e1e"; // amarelo/laranja
  if (col === "DONE") return "#00a49a";        // verde
  return "#b85236";                             // vermelho
}


export function AdminKanbanBoard({
  surveys,
  setSurveys,
  userId,
  isAdmin,
}: {
  surveys: SurveyLite[];
  setSurveys: React.Dispatch<React.SetStateAction<SurveyLite[]>>;
  userId: string | null;
  isAdmin: boolean;
}) {
  const listByCol = (col: KanbanCol) =>
    surveys.filter((s) => STATUS_IN_COL[col].includes(s.status));


  const onDragEnd = async (result: DropResult) => {
    if (!isAdmin) return;

    const { destination, source, draggableId } = result;
    if (!destination) return;

    const fromCol = source.droppableId as KanbanCol;
    const toCol = destination.droppableId as KanbanCol;
    if (fromCol === toCol && destination.index === source.index) return;

    const surveyId = Number(draggableId);
    const current = surveys.find((s) => s.id === surveyId);
    if (!current) return;

    const nextStatus = statusToPersistOnDrop(toCol, current.status);

    // optimistic UI
    setSurveys((prev) => prev.map((s) => (s.id === surveyId ? { ...s, status: nextStatus } : s)));

    const { data: updatedRows, error } = await supabase
      .from("solic_surveys")
      .update({ status: nextStatus })
      .eq("id", surveyId)
      .select("id,status"); // retorna array

    const updated = updatedRows?.[0];

    if (error || !updated) {
      // rollback
      setSurveys((prev) => prev.map((s) => (s.id === surveyId ? { ...s, status: current.status } : s)));

      alert(
        "Não foi possível salvar a mudança de status.\n" +
          (error?.message || "Nenhuma linha foi atualizada (sem permissão/RLS).")
      );
      return;
    }
  };


  return (
    <DragDropContext onDragEnd={onDragEnd}>
      <div className={styles.kanban}>
        {COLS.map((col) => {
          const list = listByCol(col.key);
          const c = colColor(col.key);

          return (
            <div key={col.key} className={styles.col}>
              <div className={styles.colHeader}>
                <div className={styles.colTitle}>{col.title}</div>
                <div className={styles.colCount} style={{ border: `1px solid ${c}`, color: c }}>
                  {list.length}
                </div>
              </div>

              <Droppable droppableId={col.key} isDropDisabled={!isAdmin}>
                {(provided) => (
                  <div className={styles.drop} ref={provided.innerRef} {...provided.droppableProps}>
                    {list.map((s, idx) => (
                      <Draggable key={s.id} draggableId={String(s.id)} index={idx} isDragDisabled={!isAdmin}>
                        {(prov, snapshot) => {
                          const mine = userId && s.created_by === userId;
                          return (
                            <Link
                              to={`/solic/survey?id=${s.id}`}
                              ref={prov.innerRef}
                              {...prov.draggableProps}
                              {...prov.dragHandleProps}
                              className={[
                                styles.cardItem,
                                snapshot.isDragging ? styles.dragging : "",
                                mine ? styles.mine : "",
                              ].join(" ")}
                            >
                              <div className={styles.bar} style={{ background: c }} />
                              <div className={styles.cardBody}>
                                <div className={styles.top}>
                                  <div className={styles.code} title={s.assets?.code ?? ""}>
                                    {s.assets?.code ?? "—"}
                                  </div>

                                  <div className={styles.badgeWrap}>
                                    <StatusBadge status={s.status} urgent={s.urgent} showUrgentText={false} />
                                  </div>
                                </div>


                                <div className={styles.name}>{s.requester ?? "—"}</div>

                                <div className={styles.meta}>
                                  <div><b>Necessidade:</b> {formatDateBR(s.needed_date)}</div>
                                  <div><b>Entrega:</b> {formatDateBR(s.admin_deadline)}</div>
                                  <div><b>ID:</b> #{s.id}</div>
                                </div>
                              </div>
                            </Link>
                          );
                        }}
                      </Draggable>
                    ))}

                    {provided.placeholder}
                    {list.length === 0 ? <div className={styles.empty}>Sem solicitações</div> : null}
                  </div>
                )}
              </Droppable>
            </div>
          );
        })}
      </div>
    </DragDropContext>
  );
}
