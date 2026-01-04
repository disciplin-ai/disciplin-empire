export default function LogoutPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-950 text-white">
      <div className="text-center space-y-3">
        <h1 className="text-2xl font-bold">Logged out of Disciplin</h1>
        <p className="text-sm text-gray-400">
          You can safely close this tab or{" "}
          <a href="/auth/login" className="text-indigo-400 underline">
            sign back in
          </a>.
        </p>
      </div>
    </div>
  );
}
