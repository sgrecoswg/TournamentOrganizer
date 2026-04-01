namespace TournamentOrganizer.Tests;

/// <summary>
/// Verifies that debug code (hardcoded deck ID, raw HttpClient) has been removed
/// from DecklistController. OWASP A05:2021 — Security Misconfiguration.
/// </summary>
public class DecklistDebugRemovalTests
{
    [Fact]
    public void DecklistController_DoesNotContainHardcodedDeckId()
    {
        var controllerPath = Path.Combine(
            Directory.GetCurrentDirectory(),
            "..", "..", "..", "..", "TournamentOrganizer.Api",
            "Controllers", "DecklistController.cs");

        var source = File.ReadAllText(controllerPath);

        Assert.DoesNotContain("JHjwO92ZUEyNdPzE7D5d7A", source);
    }

    [Fact]
    public void DecklistController_DoesNotInstantiateRawHttpClient()
    {
        var controllerPath = Path.Combine(
            Directory.GetCurrentDirectory(),
            "..", "..", "..", "..", "TournamentOrganizer.Api",
            "Controllers", "DecklistController.cs");

        var source = File.ReadAllText(controllerPath);

        Assert.DoesNotContain("new HttpClient()", source);
    }
}
