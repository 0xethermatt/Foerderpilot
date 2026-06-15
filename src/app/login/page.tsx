import LoginForm from './LoginForm';

export default function LoginPage({
  searchParams,
}: {
  searchParams: {
    error?: string;
    error_code?: string;
    error_description?: string;
    next?: string;
  };
}) {
  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <LoginForm
        urlError={searchParams.error_code ?? searchParams.error}
        urlErrorDescription={searchParams.error_description}
        next={searchParams.next}
      />
    </div>
  );
}
