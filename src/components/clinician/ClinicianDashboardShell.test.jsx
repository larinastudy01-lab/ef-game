import { act } from "react";
import { createRoot } from "react-dom/client";
import { fireEvent, screen } from "@testing-library/dom";
import {
  AddPatientModal,
  ClinicianDashboardHeader,
  DashboardLoadError,
  DashboardStats,
} from "./ClinicianDashboardShell";

let root;
let container;

function render(ui) {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  act(() => root.render(ui));
}

afterEach(() => {
  if (root) act(() => root.unmount());
  container?.remove();
  root = null;
  container = null;
});

test("dashboard header delegates actions to its controller", () => {
  const onAddPatient = jest.fn();
  const onRefresh = jest.fn();
  const onLogout = jest.fn();
  render(
    <ClinicianDashboardHeader
      clinicianName="王醫師"
      onAddPatient={onAddPatient}
      onRefresh={onRefresh}
      onLogout={onLogout}
    />
  );

  expect(screen.getByText("您好，王醫師")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: /新增兒童/ }));
  fireEvent.click(screen.getByRole("button", { name: "重新整理" }));
  fireEvent.click(screen.getByRole("button", { name: "登出" }));
  expect(onAddPatient).toHaveBeenCalledTimes(1);
  expect(onRefresh).toHaveBeenCalledTimes(1);
  expect(onLogout).toHaveBeenCalledTimes(1);
});

test("add-patient modal preserves form and submit contracts", () => {
  const onSubmit = jest.fn((event) => event.preventDefault());
  const onClose = jest.fn();
  const handlers = { guardianEmail: jest.fn(), nickname: jest.fn(), fullName: jest.fn(), birthDate: jest.fn(), gender: jest.fn() };
  render(
    <AddPatientModal
      form={{ guardianEmail: "parent@example.com", nickname: "小明", fullName: "", birthDate: "", gender: "" }}
      error="測試錯誤"
      submitting={false}
      onFieldChange={(field) => handlers[field]}
      onClose={onClose}
      onSubmit={onSubmit}
    />
  );

  expect(screen.getByRole("alert")).toHaveTextContent("測試錯誤");
  fireEvent.change(screen.getByDisplayValue("parent@example.com"), { target: { value: "next@example.com" } });
  fireEvent.click(screen.getByRole("button", { name: "建立並連結" }));
  expect(handlers.guardianEmail).toHaveBeenCalledTimes(1);
  expect(onSubmit).toHaveBeenCalledTimes(1);
});

test("overview components render cached-data notice and all metrics", () => {
  render(
    <>
      <DashboardLoadError message="連線失敗" hasCachedPatients onRetry={() => {}} />
      <DashboardStats stats={{ patientCount: 2, totalTests: 3, totalTraining: 4, newRecords: 5, needFollowUp: 1 }} />
    </>
  );

  expect(screen.getByText("目前先保留上一次成功載入的資料。")).toBeInTheDocument();
  expect(screen.getByText("授權病患")).toBeInTheDocument();
  expect(screen.getByText("需要處理")).toBeInTheDocument();
});
