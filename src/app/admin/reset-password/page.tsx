import ResetPasswordForm from "./ResetPasswordForm";

export default function ResetPasswordPage({ searchParams }: { searchParams: { code?: string } }) {
  return <ResetPasswordForm code={searchParams.code || null} />;
}
