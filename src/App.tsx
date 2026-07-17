import { Routes, Route } from "react-router-dom";
import RoleSelectionScreen from "./screens/RoleSelectionScreen";
import CustomerScreen from "./screens/CustomerScreen";
import StaffScreen from "./screens/StaffScreen";
import AdminScreen from "./screens/AdminScreen";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<RoleSelectionScreen />} />
      <Route path="/customer" element={<CustomerScreen />} />
      <Route path="/staff" element={<StaffScreen />} />
      <Route path="/admin" element={<AdminScreen />} />
    </Routes>
  );
}
