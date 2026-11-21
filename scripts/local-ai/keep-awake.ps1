param([Parameter(Mandatory=$true)][int]$ApiPid)
Add-Type -TypeDefinition @'
using System.Runtime.InteropServices;
public static class LocalAiPower {
    [DllImport("kernel32.dll")]
    public static extern uint SetThreadExecutionState(uint flags);
}
'@
try {
    # Keep the system awake while this project's API is running; the display
    # may still switch off. No persistent Windows power setting is changed.
    [LocalAiPower]::SetThreadExecutionState([uint32]2147483649) | Out-Null
    while (Get-Process -Id $ApiPid -ErrorAction SilentlyContinue) { Start-Sleep -Seconds 15 }
} finally {
    [LocalAiPower]::SetThreadExecutionState([uint32]2147483648) | Out-Null
}
