import LoginForm from './LoginForm';

// Server component — reads searchParams so the client form can show
// human-readable error messages from the /auth/confirm callback.
export default function LoginPage({
  searchParams,
}: {
  searchParams: { error?: string; next?: string };
}) {
  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <LoginForm urlError={searchParams.error} />
    </div>
  );
}
