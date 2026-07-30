import { ToastProvider } from "@/components/Toast";

export default function AdminLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return <ToastProvider>{children}</ToastProvider>;
}
