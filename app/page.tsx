export default function DashboardPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <p className="text-gray-400">Overview of your portfolio</p>
      </div>

      <div className="rounded-lg border border-gray-800 p-8 text-center">
        <h2 className="mb-2 text-xl font-semibold">Welcome to Nexus</h2>
        <p className="text-gray-400">Connect your wallet to track your portfolio</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <div className="rounded-lg border border-gray-800 p-4">
          <p className="text-sm text-gray-400">Portfolio Value</p>
          <p className="text-2xl font-bold">--</p>
        </div>
        <div className="rounded-lg border border-gray-800 p-4">
          <p className="text-sm text-gray-400">Wallets</p>
          <p className="text-2xl font-bold">--</p>
        </div>
        <div className="rounded-lg border border-gray-800 p-4">
          <p className="text-sm text-gray-400">Active Alerts</p>
          <p className="text-2xl font-bold">--</p>
        </div>
      </div>
    </div>
  );
}
