using System.Diagnostics;

namespace MusicAgentWinForms;

public sealed class NeteaseApiProcessManager : IDisposable
{
    private static readonly TimeSpan HealthCheckTimeout = TimeSpan.FromSeconds(2);
    private static readonly TimeSpan StartupWaitTimeout = TimeSpan.FromSeconds(120);
    private static readonly TimeSpan RetryDelay = TimeSpan.FromSeconds(15);
    private readonly SemaphoreSlim gate = new(1, 1);
    private Process? managedProcess;
    private string? managedBaseUrl;
    private DateTimeOffset lastAttemptAt = DateTimeOffset.MinValue;
    private string status = "idle";
    private string message = "尚未检测网易云 API 服务。";
    private string lastProcessOutput = string.Empty;
    private bool disposed;

    public void EnsureStartedInBackground(string apiBaseUrl)
    {
        _ = Task.Run(() => EnsureStartedAsync(apiBaseUrl));
    }

    public async Task<bool> EnsureStartedAsync(string apiBaseUrl, CancellationToken cancellationToken = default)
    {
        if (disposed) return false;

        if (!TryCreateLocalHttpUri(apiBaseUrl, out var apiUri))
        {
            status = "disabled";
            message = "当前 API 地址不是本机 HTTP 地址，已跳过自动启动。";
            return false;
        }

        if (await IsHealthyAsync(apiUri, cancellationToken))
        {
            status = "running";
            message = "NeteaseCloudMusicApi 已在运行。";
            return true;
        }

        await gate.WaitAsync(cancellationToken);
        try
        {
            if (await IsHealthyAsync(apiUri, cancellationToken))
            {
                status = "running";
                message = "NeteaseCloudMusicApi 已在运行。";
                return true;
            }

            if (IsManagedProcessRunning && string.Equals(managedBaseUrl, NormalizeBaseUrl(apiUri), StringComparison.OrdinalIgnoreCase))
            {
                status = "starting";
                message = "NeteaseCloudMusicApi 正在启动。";
                return await WaitUntilHealthyAsync(apiUri, StartupWaitTimeout, cancellationToken);
            }

            if (lastAttemptAt + RetryDelay > DateTimeOffset.UtcNow)
            {
                return false;
            }

            StopManagedProcess();
            lastAttemptAt = DateTimeOffset.UtcNow;
            lastProcessOutput = string.Empty;

            if (!TryStartProcess(apiUri, out var startError))
            {
                status = "error";
                message = startError;
                return false;
            }

            managedBaseUrl = NormalizeBaseUrl(apiUri);
            status = "starting";
            message = $"正在自动启动 NeteaseCloudMusicApi（端口 {apiUri.Port}）。";
            return await WaitUntilHealthyAsync(apiUri, StartupWaitTimeout, cancellationToken);
        }
        finally
        {
            gate.Release();
        }
    }

    public NeteaseApiRuntimeStatus GetStatus()
    {
        return new NeteaseApiRuntimeStatus
        {
            Status = status,
            Message = message,
            ManagedProcessRunning = IsManagedProcessRunning
        };
    }

    public void Dispose()
    {
        if (disposed) return;
        disposed = true;
        StopManagedProcess();
    }

    private bool IsManagedProcessRunning => managedProcess is { HasExited: false };

    private static bool TryCreateLocalHttpUri(string apiBaseUrl, out Uri apiUri)
    {
        apiUri = null!;
        if (!Uri.TryCreate(apiBaseUrl, UriKind.Absolute, out var parsed))
        {
            return false;
        }

        if (parsed.Scheme != Uri.UriSchemeHttp || !parsed.IsLoopback)
        {
            return false;
        }

        apiUri = parsed;
        return true;
    }

    private static string NormalizeBaseUrl(Uri apiUri)
    {
        return $"{apiUri.Scheme}://{apiUri.Host}:{apiUri.Port}";
    }

    private async Task<bool> IsHealthyAsync(Uri apiUri, CancellationToken cancellationToken)
    {
        try
        {
            using var timeout = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken);
            timeout.CancelAfter(HealthCheckTimeout);
            using var http = new HttpClient { Timeout = HealthCheckTimeout };
            var healthUri = new Uri(apiUri, $"/login/status?timestamp={DateTimeOffset.UtcNow.ToUnixTimeMilliseconds()}");
            using var response = await http.GetAsync(healthUri, timeout.Token);
            return response.IsSuccessStatusCode;
        }
        catch
        {
            return false;
        }
    }

    private async Task<bool> WaitUntilHealthyAsync(Uri apiUri, TimeSpan timeout, CancellationToken cancellationToken)
    {
        var deadline = DateTimeOffset.UtcNow + timeout;
        while (DateTimeOffset.UtcNow < deadline)
        {
            if (await IsHealthyAsync(apiUri, cancellationToken))
            {
                status = "running";
                message = "NeteaseCloudMusicApi 已自动启动。";
                return true;
            }

            if (managedProcess is { HasExited: true })
            {
                status = "error";
                message = $"NeteaseCloudMusicApi 启动进程已退出，退出码 {managedProcess.ExitCode}。{GetProcessOutputSuffix()}";
                return false;
            }

            await Task.Delay(800, cancellationToken);
        }

        status = "starting";
        message = "NeteaseCloudMusicApi 仍在启动中，首次运行可能需要下载 npm 包；请稍后重试。";
        return false;
    }

    private bool TryStartProcess(Uri apiUri, out string error)
    {
        var candidates = GetNpxCandidates().Distinct(StringComparer.OrdinalIgnoreCase).ToList();
        if (candidates.Count == 0)
        {
            error = "未找到可用的 npx，无法自动启动 NeteaseCloudMusicApi。请安装 Node.js，或手动启动 API 后在设置中保存地址。";
            return false;
        }

        foreach (var npxCommand in candidates)
        {
            try
            {
                var process = new Process
                {
                    StartInfo = BuildStartInfo(npxCommand, apiUri.Port),
                    EnableRaisingEvents = true
                };
                process.OutputDataReceived += (_, args) => RememberProcessOutput(args.Data);
                process.ErrorDataReceived += (_, args) => RememberProcessOutput(args.Data);
                process.Exited += (_, _) =>
                {
                    if (status == "starting" || status == "running")
                    {
                        status = "stopped";
                        message = $"自动启动的 NeteaseCloudMusicApi 已退出。{GetProcessOutputSuffix()}";
                    }
                };

                if (process.Start())
                {
                    managedProcess = process;
                    process.BeginOutputReadLine();
                    process.BeginErrorReadLine();
                    error = string.Empty;
                    return true;
                }
            }
            catch (Exception ex)
            {
                RememberProcessOutput($"{npxCommand}: {ex.Message}");
                Debug.WriteLine($"启动 {npxCommand} 失败: {ex.Message}");
            }
        }

        error = $"npx 已找到但无法启动 NeteaseCloudMusicApi。{GetProcessOutputSuffix()}";
        return false;
    }

    private static ProcessStartInfo BuildStartInfo(string npxCommand, int port)
    {
        var startInfo = OperatingSystem.IsWindows()
            ? new ProcessStartInfo
            {
                FileName = Environment.GetEnvironmentVariable("COMSPEC") ?? "cmd.exe",
                Arguments = $"/d /s /c \"\"{npxCommand}\" --yes NeteaseCloudMusicApi@latest --port {port}\""
            }
            : new ProcessStartInfo
            {
                FileName = npxCommand,
                Arguments = $"--yes NeteaseCloudMusicApi@latest --port {port}"
            };

        startInfo.WorkingDirectory = Application.StartupPath;
        startInfo.UseShellExecute = false;
        startInfo.CreateNoWindow = true;
        startInfo.WindowStyle = ProcessWindowStyle.Hidden;
        startInfo.RedirectStandardOutput = true;
        startInfo.RedirectStandardError = true;
        startInfo.Environment["PORT"] = port.ToString();
        startInfo.Environment["NO_UPDATE_NOTIFIER"] = "1";
        startInfo.Environment["NPM_CONFIG_UPDATE_NOTIFIER"] = "false";
        startInfo.Environment["NPM_CONFIG_AUDIT"] = "false";
        startInfo.Environment["NPM_CONFIG_FUND"] = "false";
        return startInfo;
    }

    private static IEnumerable<string> GetNpxCandidates()
    {
        var names = OperatingSystem.IsWindows()
            ? new[] { "npx.cmd", "npx.exe", "npx" }
            : new[] { "npx" };

        foreach (var name in names)
        {
            foreach (var candidate in ResolveExecutableFromPath(name))
            {
                yield return candidate;
            }
        }

        if (OperatingSystem.IsWindows())
        {
            foreach (var candidate in GetWindowsNodeCandidates())
            {
                yield return candidate;
            }
        }
    }

    private static IEnumerable<string> ResolveExecutableFromPath(string executableName)
    {
        foreach (var target in new[]
                 {
                     EnvironmentVariableTarget.Process,
                     EnvironmentVariableTarget.User,
                     EnvironmentVariableTarget.Machine
                 })
        {
            var pathValue = Environment.GetEnvironmentVariable("Path", target);
            if (string.IsNullOrWhiteSpace(pathValue)) continue;

            foreach (var directory in pathValue.Split(Path.PathSeparator, StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries))
            {
                var candidate = Path.Combine(directory, executableName);
                if (File.Exists(candidate))
                {
                    yield return candidate;
                }
            }
        }
    }

    private static IEnumerable<string> GetWindowsNodeCandidates()
    {
        var directories = new List<string?>
        {
            Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ProgramFiles), "nodejs"),
            Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ProgramFilesX86), "nodejs"),
            Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData), "npm")
        };

        foreach (var drive in DriveInfo.GetDrives().Where(d => d.IsReady && d.DriveType == DriveType.Fixed))
        {
            directories.Add(Path.Combine(drive.RootDirectory.FullName, "nodejs"));
        }

        foreach (var directory in directories.Where(d => !string.IsNullOrWhiteSpace(d)).Distinct(StringComparer.OrdinalIgnoreCase))
        {
            var candidate = Path.Combine(directory!, "npx.cmd");
            if (File.Exists(candidate))
            {
                yield return candidate;
            }
        }
    }

    private void RememberProcessOutput(string? line)
    {
        if (string.IsNullOrWhiteSpace(line)) return;
        lastProcessOutput = line.Trim();
    }

    private string GetProcessOutputSuffix()
    {
        return string.IsNullOrWhiteSpace(lastProcessOutput) ? string.Empty : $" 最近输出：{lastProcessOutput}";
    }

    private void StopManagedProcess()
    {
        try
        {
            if (managedProcess == null) return;
            if (!managedProcess.HasExited)
            {
                managedProcess.Kill(entireProcessTree: true);
                managedProcess.WaitForExit(3000);
            }
        }
        catch (Exception ex)
        {
            Debug.WriteLine($"停止 NeteaseCloudMusicApi 失败: {ex.Message}");
        }
        finally
        {
            managedProcess?.Dispose();
            managedProcess = null;
            managedBaseUrl = null;
        }
    }
}

public sealed class NeteaseApiRuntimeStatus
{
    public string Status { get; set; } = "idle";
    public string Message { get; set; } = string.Empty;
    public bool ManagedProcessRunning { get; set; }
}
