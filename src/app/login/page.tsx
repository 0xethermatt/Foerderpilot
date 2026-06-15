import LoginForm from './LoginForm';

export default function LoginPage({
  searchParams,
}: {
  searchParams: { error?: string; next?: string };
}) {
  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <LoginForm urlError={searchParams.error} next={searchParams.next} />
    </div>
  );
}
