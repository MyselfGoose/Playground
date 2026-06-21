import { AdminGate } from "../../components/admin/AdminGate.jsx";

export default function AdminLayout({ children }) {
  return <AdminGate>{children}</AdminGate>;
}
