import { ResetForm } from "@/components/auth-forms";

export const metadata = { title: "Reset password" };

export default async function ResetPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token } = await searchParams;
  return <ResetForm token={token ?? ""} />;
}
