import type { Metadata } from "next";
import "@fontsource-variable/inter";
import "./styles.css";
export const metadata: Metadata = { title: "Nahr CRM · Школа арабского", description: "Рабочее пространство школы арабского языка" };
export default function Layout({ children }: { children: React.ReactNode }) {
  return <html lang="ru"><body>{children}</body></html>;
}
