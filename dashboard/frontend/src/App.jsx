
import { useEffect, useState, useCallback } from "react";
import {
  ShieldCheck, LayoutDashboard, GitBranch, Container,
  Activity, Settings, Bell, Search, Play, RefreshCw,
  CheckCircle2, AlertCircle, Clock, Server, ArrowUpRight,
  CircleDot, Terminal, Menu, X
} from "lucide-react";

const API = "http://localhost:5000";

const navigation = [
  { name: "Dashboard", icon: LayoutDashboard },
  { name: "CI/CD Pipeline", icon: GitBranch },
  { name: "Containers", icon: Container },
  { name: "Monitoring", icon: Activity },
  { name: "Deployment Logs", icon: Terminal },
  { name: "Settings", icon: Settings }
];

function App() {
  const [status, setStatus] = useState(null);
  const [jenkins, setJenkins] = useState(null);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [error, setError] = useState("");
  const [activePage, setActivePage] = useState("Dashboard");
  const [building, setBuilding] = useState(false);
  const [buildMessage, setBuildMessage] = useState("");
  const [mobileMenu, setMobileMenu] = useState(false);

  const fetchDashboard = useCallback(async () => {
    try {
      const [statusResponse, jenkinsResponse] = await Promise.all([
        fetch(`${API}/api/status`),
        fetch(`${API}/api/jenkins`)
      ]);

      if (!statusResponse.ok || !jenkinsResponse.ok) {
        throw new Error("Unable to retrieve backend information");
      }

      const statusData = await statusResponse.json();
      const jenkinsData = await jenkinsResponse.json();

      setStatus(statusData);
      setJenkins(jenkinsData);
      setLastUpdated(new Date());
      setError("");
    } catch (err) {
      setError("Backend disconnected. Check that the backend server is running.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDashboard();
    const interval = setInterval(fetchDashboard, 10000);
    return () => clearInterval(interval);
  }, [fetchDashboard]);

  const triggerBuild = async () => {
    if (building) return;

    const confirmed = window.confirm(
      "Are you sure you want to trigger the ReleaseShield Jenkins pipeline?"
    );

    if (!confirmed) return;

    setBuilding(true);
    setBuildMessage("Sending build request to Jenkins...");

    try {
      const response = await fetch(`${API}/api/jenkins/build`, {
        method: "POST"
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          typeof data.details === "string"
            ? data.details
            : data.error || "Build request failed"
        );
      }

      setBuildMessage(
        "Build request accepted! Check Jenkins for pipeline progress."
      );

      setTimeout(fetchDashboard, 3000);
    } catch (err) {
      setBuildMessage(`Build failed: ${err.message}`);
    } finally {
      setBuilding(false);
    }
  };

  const job = jenkins?.jobs?.find(
    item => item.name === "ReleaseShield-Pipeline"
  );

  const build = job?.lastBuild;
  const containers = status?.containers || [];

  const getContainer = name =>
    containers.find(container => container.Names === name);

  const blue = getContainer("releaseshield-blue");
  const green = getContainer("releaseshield-green");
  const nginx = getContainer("releaseshield-nginx");
  const jenkinsContainer = getContainer("releaseshield-jenkins");

  const runningContainers = containers.filter(
    container => container.State === "running"
  ).length;

  const activeEnvironment = status?.activeEnvironment || "UNKNOWN";

  const formatDate = timestamp =>
    timestamp ? new Date(timestamp).toLocaleString() : "N/A";

  const formatDuration = duration =>
    duration ? `${(duration / 1000).toFixed(2)} sec` : "N/A";

  const serviceColor = value => {
    if (["CONNECTED", "UP", "running", "SUCCESS"].includes(value)) {
      return "text-emerald-400";
    }
    return "text-red-400";
  };

  const stats = [
    {
      title: "Latest Build",
      value: build ? `#${build.number}` : "N/A",
      change: job?.name || "Jenkins unavailable",
      icon: GitBranch,
      color: "text-blue-400"
    },
    {
      title: "Last Build Result",
      value: build?.result || "N/A",
      change: build ? formatDuration(build.duration) : "No build data",
      icon: CheckCircle2,
      color: build?.result === "SUCCESS" ? "text-emerald-400" : "text-yellow-400"
    },
    {
      title: "Running Containers",
      value: `${runningContainers}/4`,
      change: "ReleaseShield infrastructure",
      icon: Container,
      color: "text-purple-400"
    },
    {
      title: "Application Health",
      value: status?.application || "UNKNOWN",
      change: "Spring Boot actuator",
      icon: Activity,
      color: status?.application === "UP" ? "text-cyan-400" : "text-red-400"
    }
  ];

  const services = [
    ["Jenkins CI/CD", status?.jenkins],
    ["Docker Engine", status?.docker],
    ["Blue Application", blue?.State || "NOT FOUND"],
    ["Green Application", green?.State || "NOT FOUND"],
    ["Nginx Reverse Proxy", nginx?.State || "NOT FOUND"]
  ];

  const changePage = page => {
    setActivePage(page);
    setMobileMenu(false);
  };

  const StatusLabel = ({ value }) => (
    <span className={`text-xs font-medium ${serviceColor(value)}`}>
      <CircleDot size={10} className="inline mr-1" />
      {value || "UNKNOWN"}
    </span>
  );

  const renderDashboard = () => (
    <div className="space-y-7">
      <div className="flex flex-wrap justify-between items-center gap-4">
        <div>
          <h3 className="text-2xl font-bold text-white">Welcome to ReleaseShield</h3>
          <p className="text-sm text-slate-400 mt-1">
            Your deployment infrastructure at a glance.
          </p>
          <p className="text-xs text-slate-500 mt-2">
            {lastUpdated
              ? `Last updated: ${lastUpdated.toLocaleTimeString()}`
              : "Connecting to backend..."}
          </p>
        </div>

        <div className="flex gap-3">
          <button
            onClick={fetchDashboard}
            className="flex items-center gap-2 border border-slate-700 hover:bg-slate-800 px-4 py-3 rounded-lg text-sm"
          >
            <RefreshCw size={16} /> Refresh
          </button>

          <button
            onClick={triggerBuild}
            disabled={building || status?.jenkins !== "CONNECTED"}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 px-5 py-3 rounded-lg text-sm font-semibold"
          >
            <Play size={16} />
            {building ? "Starting Build..." : "Build Now"}
          </button>
        </div>
      </div>

      {buildMessage && (
        <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4 text-sm text-blue-300">
          {buildMessage}
        </div>
      )}

      <section className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {stats.map(stat => {
          const Icon = stat.icon;
          return (
            <div key={stat.title} className="bg-[#111b2d] border border-slate-800 rounded-xl p-5">
              <div className="flex justify-between items-center">
                <p className="text-sm text-slate-400">{stat.title}</p>
                <Icon className={stat.color} size={21} />
              </div>
              <h3 className="text-3xl font-bold text-white mt-4">{stat.value}</h3>
              <p className="text-xs text-slate-500 mt-2">{stat.change}</p>
            </div>
          );
        })}
      </section>

      <section className="grid grid-cols-1 xl:grid-cols-3 gap-5">
        <div className="xl:col-span-2 bg-[#111b2d] border border-slate-800 rounded-xl p-6">
          <div className="flex justify-between items-center mb-6">
            <div>
              <h3 className="font-semibold text-white">CI/CD Pipeline</h3>
              <p className="text-xs text-slate-500 mt-1">
                Jenkins automated deployment workflow
              </p>
            </div>
            <span className="text-xs bg-emerald-500/10 text-emerald-400 px-3 py-1 rounded-full">
              {job ? "Pipeline Connected" : "Unavailable"}
            </span>
          </div>

          <div className="space-y-4">
            {[
              "Checkout SCM", "Build & Test", "Verify JAR",
              "Docker Build", "Docker Verification", "Blue-Green Deploy"
            ].map(stage => (
              <div key={stage} className="flex items-center gap-3">
                <CheckCircle2 size={19} className="text-emerald-400" />
                <span className="text-sm text-slate-300">{stage}</span>
                <span className="ml-auto text-xs text-slate-500">Configured</span>
              </div>
            ))}
          </div>

          <div className="border-t border-slate-800 mt-6 pt-5">
            <p className="text-xs text-slate-500">Latest Jenkins build</p>
            <div className="flex flex-wrap justify-between gap-3 mt-2">
              <span>Build #{build?.number ?? "N/A"}</span>
              <StatusLabel value={build?.result} />
              <span className="text-sm text-slate-400">
                {formatDuration(build?.duration)}
              </span>
            </div>
          </div>
        </div>

        <div className="bg-[#111b2d] border border-slate-800 rounded-xl p-6">
          <h3 className="font-semibold text-white">Environment Status</h3>
          <p className="text-xs text-slate-500 mt-1 mb-6">
            Active Nginx traffic routing
          </p>

          {["BLUE", "GREEN"].map(environment => {
            const isActive = activeEnvironment === environment;
            const container = environment === "BLUE" ? blue : green;

            return (
              <div
                key={environment}
                className={`border rounded-lg p-4 mb-4 ${
                  isActive
                    ? "border-emerald-500/30 bg-emerald-500/10"
                    : "border-slate-700 bg-slate-800/30"
                }`}
              >
                <div className="flex justify-between">
                  <span className={environment === "BLUE" ? "text-blue-400 font-semibold" : "text-emerald-400 font-semibold"}>
                    {environment} Environment
                  </span>
                  <span className="text-xs text-slate-300">
                    {isActive ? "Active" : container?.State === "running" ? "Running" : "Stopped"}
                  </span>
                </div>
                <p className="text-xs text-slate-400 mt-2">
                  {isActive ? "Currently serving traffic" : "Not receiving traffic"}
                </p>
              </div>
            );
          })}
        </div>
      </section>

      <section className="grid grid-cols-1 xl:grid-cols-2 gap-5">
        <div className="bg-[#111b2d] border border-slate-800 rounded-xl p-6">
          <div className="flex justify-between items-center mb-5">
            <h3 className="font-semibold text-white">Infrastructure Services</h3>
            <RefreshCw size={17} className="text-slate-500" />
          </div>

          {services.map(([name, value]) => (
            <div key={name} className="flex justify-between items-center py-3 border-b border-slate-800 last:border-0">
              <div className="flex items-center gap-3">
                <Server size={17} className="text-slate-500" />
                <span className="text-sm">{name}</span>
              </div>
              <StatusLabel value={value} />
            </div>
          ))}
        </div>

        <div className="bg-[#111b2d] border border-slate-800 rounded-xl p-6">
          <h3 className="font-semibold text-white mb-5">Quick Access</h3>
          {[
            ["Jenkins Dashboard", "http://localhost:8081"],
            ["Application Health", "http://localhost:8083/actuator/health"],
            ["ReleaseShield Repository", "https://github.com/eshheet77/ReleaseShield"]
          ].map(([name, url]) => (
            <a key={name} href={url} target="_blank" rel="noreferrer"
              className="flex justify-between items-center py-4 border-b border-slate-800 last:border-0 text-sm hover:text-blue-400">
              {name}<ArrowUpRight size={17} />
            </a>
          ))}
        </div>
      </section>
    </div>
  );

  const renderContainers = () => (
    <div className="bg-[#111b2d] border border-slate-800 rounded-xl p-6">
      <h3 className="font-semibold text-white mb-5">Docker Containers</h3>
      {containers.length === 0 && (
        <p className="text-slate-400 text-sm">No container data available.</p>
      )}
      {containers.map(container => (
        <div key={container.ID} className="border-b border-slate-800 py-4 last:border-0">
          <div className="flex flex-wrap justify-between gap-2">
            <span className="font-medium text-white">{container.Names}</span>
            <StatusLabel value={container.State} />
          </div>
          <div className="text-xs text-slate-500 mt-2">
            Image: {container.Image} · Status: {container.Status}
          </div>
          <div className="text-xs text-slate-500 mt-1">
            Ports: {container.Ports || "No published ports"}
          </div>
        </div>
      ))}
    </div>
  );

  const renderPipeline = () => (
    <div className="bg-[#111b2d] border border-slate-800 rounded-xl p-6">
      <h3 className="font-semibold text-white">Jenkins Pipeline</h3>
      <p className="text-sm text-slate-400 mt-2 mb-6">
        {job?.name || "ReleaseShield-Pipeline"}
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {[
          "Checkout SCM", "Build & Test", "Verify JAR",
          "Docker Build", "Docker Verification", "Blue-Green Deploy"
        ].map((stage, index) => (
          <div key={stage} className="bg-slate-800/50 border border-slate-700 rounded-lg p-4">
            <div className="flex items-center gap-3">
              <CheckCircle2 className="text-emerald-400" />
              <span>{stage}</span>
            </div>
            <p className="text-xs text-slate-500 mt-2">Stage {index + 1} · Configured in pipeline</p>
          </div>
        ))}
      </div>
      <div className="mt-6 border-t border-slate-800 pt-5">
        <p className="text-sm text-slate-400">Latest build: #{build?.number ?? "N/A"}</p>
        <p className="text-sm mt-2">Result: <StatusLabel value={build?.result} /></p>
        <p className="text-sm text-slate-400 mt-2">Duration: {formatDuration(build?.duration)}</p>
      </div>
      <a href="http://localhost:8081/job/ReleaseShield-Pipeline/" target="_blank" rel="noreferrer"
        className="inline-flex items-center gap-2 mt-6 text-blue-400 text-sm hover:text-blue-300">
        Open Jenkins Pipeline <ArrowUpRight size={16} />
      </a>
    </div>
  );

  const renderMonitoring = () => (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
      {[
        ["Docker Engine", status?.docker],
        ["Jenkins", status?.jenkins],
        ["Spring Boot Application", status?.application],
        ["Nginx", status?.nginx]
      ].map(([name, value]) => (
        <div key={name} className="bg-[#111b2d] border border-slate-800 rounded-xl p-6">
          <div className="flex justify-between items-center">
            <h3 className="font-semibold">{name}</h3>
            <StatusLabel value={value} />
          </div>
          <p className="text-xs text-slate-500 mt-4">Live status from backend checks</p>
        </div>
      ))}
      <div className="bg-[#111b2d] border border-slate-800 rounded-xl p-6 md:col-span-2">
        <h3 className="font-semibold">Deployment Environment</h3>
        <p className="text-sm text-slate-400 mt-3">
          Active traffic environment: <span className="text-emerald-400 font-semibold">{activeEnvironment}</span>
        </p>
        <p className="text-xs text-slate-500 mt-2">
          Determined by reading the live Nginx upstream configuration.
        </p>
      </div>
    </div>
  );

  const renderLogs = () => (
    <div className="bg-[#111b2d] border border-slate-800 rounded-xl p-6">
      <h3 className="font-semibold text-white mb-5">Latest Jenkins Build Information</h3>
      {build ? (
        <>
          <div className="flex flex-wrap justify-between gap-3 border-b border-slate-800 pb-4">
            <span>Build #{build.number}</span>
            <StatusLabel value={build.result} />
          </div>
          <div className="py-4 space-y-3 text-sm text-slate-400">
            <p>Pipeline: {job?.name}</p>
            <p>Build timestamp: {formatDate(build.timestamp)}</p>
            <p>Build duration: {formatDuration(build.duration)}</p>
            <p>Build result: {build.result}</p>
          </div>
          <a href="http://localhost:8081/job/ReleaseShield-Pipeline/lastBuild/console"
            target="_blank" rel="noreferrer"
            className="inline-flex items-center gap-2 text-blue-400 text-sm hover:text-blue-300">
            View actual Jenkins console output <ArrowUpRight size={16} />
          </a>
        </>
      ) : (
        <p className="text-slate-400 text-sm">No build information available.</p>
      )}
    </div>
  );

  const renderSettings = () => (
    <div className="bg-[#111b2d] border border-slate-800 rounded-xl p-6">
      <h3 className="font-semibold text-white mb-5">System Configuration</h3>
      {[
        ["Frontend", "http://localhost:5173"],
        ["Backend API", API],
        ["Jenkins", "http://localhost:8081"],
        ["Application", "http://localhost:8083"],
        ["Pipeline", "ReleaseShield-Pipeline"],
        ["Refresh Interval", "10 seconds"],
        ["Active Environment", activeEnvironment]
      ].map(([name, value]) => (
        <div key={name} className="flex flex-wrap justify-between gap-2 py-4 border-b border-slate-800 last:border-0">
          <span className="text-sm text-slate-400">{name}</span>
          <span className="text-sm text-slate-200">{value}</span>
        </div>
      ))}
      <p className="text-xs text-slate-500 mt-5">
        Credentials are maintained by the backend and are not exposed in this dashboard.
      </p>
    </div>
  );

  const pageContent = {
    Dashboard: renderDashboard,
    "CI/CD Pipeline": renderPipeline,
    Containers: renderContainers,
    Monitoring: renderMonitoring,
    "Deployment Logs": renderLogs,
    Settings: renderSettings
  };

  return (
    <div className="min-h-screen bg-[#080d18] text-slate-200 flex">
      <aside className="w-64 border-r border-slate-800 bg-[#0c1322] p-5 hidden md:block shrink-0">
        <div className="flex items-center gap-3 mb-10">
          <div className="bg-blue-600 p-2 rounded-xl">
            <ShieldCheck size={25} />
          </div>
          <div>
            <h1 className="font-bold text-xl text-white">ReleaseShield</h1>
            <p className="text-xs text-slate-500">Deployment Control Center</p>
          </div>
        </div>

        <p className="text-xs text-slate-500 uppercase mb-3">Main Menu</p>
        <nav className="space-y-2">
          {navigation.map(({ name, icon: Icon }) => (
            <button
              key={name}
              onClick={() => changePage(name)}
              className={`w-full flex items-center gap-3 p-3 rounded-lg text-left transition ${
                activePage === name
                  ? "bg-blue-600/15 text-blue-400"
                  : "text-slate-400 hover:bg-slate-800 hover:text-white"
              }`}
            >
              <Icon size={19} /> {name}
            </button>
          ))}
        </nav>

        <div className="mt-16 bg-slate-800/60 rounded-xl p-4">
          <div className="flex items-center gap-2 text-emerald-400 text-sm">
            <CircleDot size={12} /> Live Environment
          </div>
          <p className="text-xs text-slate-500 mt-2">ReleaseShield v1.0</p>
        </div>
      </aside>

      {mobileMenu && (
        <div className="fixed inset-0 z-50 bg-[#0c1322] p-5 md:hidden">
          <div className="flex justify-between items-center mb-8">
            <h2 className="text-xl font-bold">ReleaseShield</h2>
            <button onClick={() => setMobileMenu(false)}><X /></button>
          </div>
          <nav className="space-y-2">
            {navigation.map(({ name, icon: Icon }) => (
              <button key={name} onClick={() => changePage(name)}
                className={`w-full flex items-center gap-3 p-3 rounded-lg text-left ${
                  activePage === name ? "bg-blue-600/15 text-blue-400" : "text-slate-400"
                }`}>
                <Icon size={19} /> {name}
              </button>
            ))}
          </nav>
        </div>
      )}

      <main className="flex-1 min-w-0">
        <header className="h-20 border-b border-slate-800 flex items-center justify-between px-5 md:px-8">
          <div className="flex items-center gap-3">
            <button className="md:hidden" onClick={() => setMobileMenu(true)}>
              <Menu />
            </button>
            <div>
              <h2 className="text-xl font-semibold text-white">{activePage}</h2>
              <p className="text-xs text-slate-500 mt-1">Live CI/CD infrastructure monitoring</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <button onClick={fetchDashboard} title="Refresh data">
              <RefreshCw size={19} className="text-slate-400 hover:text-white" />
            </button>
            <Bell size={19} className="text-slate-400" />
            <div className="w-9 h-9 rounded-full bg-blue-600 flex items-center justify-center font-bold">R</div>
          </div>
        </header>

        <div className="p-5 md:p-8">
          {error && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 text-red-400 text-sm mb-6">
              <AlertCircle size={18} className="inline mr-2" /> {error}
            </div>
          )}

          {loading && !status ? (
            <p className="text-blue-400">Loading live infrastructure data...</p>
          ) : (
            pageContent[activePage]()
          )}

          <footer className="text-center text-xs text-slate-600 py-8">
            ReleaseShield © 2026 · Automated CI/CD & Blue-Green Deployment Platform
            {lastUpdated && (
              <p className="mt-2">Last updated: {lastUpdated.toLocaleTimeString()}</p>
            )}
          </footer>
        </div>
      </main>
    </div>
  );
}

export default App;
