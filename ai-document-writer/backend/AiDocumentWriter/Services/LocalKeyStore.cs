using Microsoft.AspNetCore.DataProtection;
using System.Text;

namespace AiDocumentWriter.Services;

/// <summary>
/// Stores the local single-user key outside the distribution directory.
/// The protected payload and key ring are both local-user data; they do not
/// defend against malware or administrators with access to that account.
/// </summary>
public sealed class LocalKeyStore
{
    public static string DataDirectory { get; } = ResolveDataDirectory();

    private static string ResolveDataDirectory()
    {
        var configuredPath = Environment.GetEnvironmentVariable("AIWRITER_LOCAL_DATA_DIRECTORY");
        if (string.IsNullOrWhiteSpace(configuredPath))
            return Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "AiDocumentWriter");
        if (!Path.IsPathFullyQualified(configuredPath))
            throw new InvalidOperationException("AIWRITER_LOCAL_DATA_DIRECTORY 必须是绝对路径");
        return Path.GetFullPath(configuredPath);
    }

    private readonly IDataProtector _protector;
    private readonly string _path = Path.Combine(DataDirectory, "apikey.protected");

    public LocalKeyStore(IDataProtectionProvider provider)
    {
        Directory.CreateDirectory(DataDirectory);
        _protector = provider.CreateProtector("AiDocumentWriter.ApiKey.v1");
    }

    public bool HasSavedKey => File.Exists(_path);

    public string? Read()
    {
        if (!File.Exists(_path)) return null;
        return _protector.Unprotect(File.ReadAllText(_path, Encoding.UTF8));
    }

    public void Save(string key)
    {
        if (string.IsNullOrWhiteSpace(key)) throw new ArgumentException("API Key 不能为空");
        Directory.CreateDirectory(DataDirectory);
        var tmp = _path + ".tmp";
        File.WriteAllText(tmp, _protector.Protect(key.Trim()), new UTF8Encoding(false));
        if (!OperatingSystem.IsWindows())
        {
            File.SetUnixFileMode(tmp, UnixFileMode.UserRead | UnixFileMode.UserWrite);
        }
        File.Move(tmp, _path, overwrite: true);
    }

    public void Delete()
    {
        if (File.Exists(_path)) File.Delete(_path);
    }
}
