import { STATUS_LABEL } from "../services/reimbursements.js";
import "./StatusBadge.css";

export default function StatusBadge({ status }) {
  const label = STATUS_LABEL[status] ?? status ?? "—";
  return <span className={`status-badge status-${status}`}>{label}</span>;
}
