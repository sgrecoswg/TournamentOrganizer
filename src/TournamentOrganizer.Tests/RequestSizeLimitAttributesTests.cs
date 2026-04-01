using System.Reflection;
using Microsoft.AspNetCore.Mvc;
using TournamentOrganizer.Api.Controllers;

namespace TournamentOrganizer.Tests;

/// <summary>
/// TDD tests for request size limit attributes on all IFormFile upload endpoints.
/// Prevents DoS via oversized file uploads by enforcing per-endpoint limits.
///
/// Image uploads (logo, background, avatar): 5 MB max
/// BulkUpload (CSV/text): 512 KB max
/// </summary>
public class RequestSizeLimitAttributesTests
{
    private static MethodInfo? GetMethod(Type controller, string methodName) =>
        controller.GetMethod(methodName);

    private static T? GetAttribute<T>(MethodInfo? method) where T : Attribute =>
        method?.GetCustomAttribute<T>();

    // ─── StoresController Tests ──────────────────────────────────────────

    [Fact]
    public void StoresController_UploadLogo_HasRequestSizeLimit()
    {
        var method = GetMethod(typeof(StoresController), nameof(StoresController.UploadLogo));
        var attr = GetAttribute<RequestSizeLimitAttribute>(method);

        Assert.NotNull(method);
        Assert.NotNull(attr);
    }

    [Fact]
    public void StoresController_UploadLogo_HasRequestFormLimits()
    {
        var method = GetMethod(typeof(StoresController), nameof(StoresController.UploadLogo));
        var attr = GetAttribute<RequestFormLimitsAttribute>(method);

        Assert.NotNull(method);
        Assert.NotNull(attr);
    }

    [Fact]
    public void StoresController_UploadBackground_HasRequestSizeLimit()
    {
        var method = GetMethod(typeof(StoresController), nameof(StoresController.UploadBackground));
        var attr = GetAttribute<RequestSizeLimitAttribute>(method);

        Assert.NotNull(method);
        Assert.NotNull(attr);
    }

    [Fact]
    public void StoresController_UploadBackground_HasRequestFormLimits()
    {
        var method = GetMethod(typeof(StoresController), nameof(StoresController.UploadBackground));
        var attr = GetAttribute<RequestFormLimitsAttribute>(method);

        Assert.NotNull(method);
        Assert.NotNull(attr);
    }

    // ─── EventsController Tests ──────────────────────────────────────────

    [Fact]
    public void EventsController_UploadBackground_HasRequestSizeLimit()
    {
        var method = GetMethod(typeof(EventsController), nameof(EventsController.UploadBackground));
        var attr = GetAttribute<RequestSizeLimitAttribute>(method);

        Assert.NotNull(method);
        Assert.NotNull(attr);
    }

    [Fact]
    public void EventsController_UploadBackground_HasRequestFormLimits()
    {
        var method = GetMethod(typeof(EventsController), nameof(EventsController.UploadBackground));
        var attr = GetAttribute<RequestFormLimitsAttribute>(method);

        Assert.NotNull(method);
        Assert.NotNull(attr);
    }

    // ─── PlayersController Tests ─────────────────────────────────────────

    [Fact]
    public void PlayersController_UploadAvatar_HasRequestSizeLimit()
    {
        var method = GetMethod(typeof(PlayersController), nameof(PlayersController.UploadAvatar));
        var attr = GetAttribute<RequestSizeLimitAttribute>(method);

        Assert.NotNull(method);
        Assert.NotNull(attr);
    }

    [Fact]
    public void PlayersController_UploadAvatar_HasRequestFormLimits()
    {
        var method = GetMethod(typeof(PlayersController), nameof(PlayersController.UploadAvatar));
        var attr = GetAttribute<RequestFormLimitsAttribute>(method);

        Assert.NotNull(method);
        Assert.NotNull(attr);
    }

    // ─── TradeController Tests ───────────────────────────────────────────

    [Fact]
    public void TradeController_BulkUpload_HasRequestSizeLimit()
    {
        var method = GetMethod(typeof(TradeController), nameof(TradeController.BulkUpload));
        var attr = GetAttribute<RequestSizeLimitAttribute>(method);

        Assert.NotNull(method);
        Assert.NotNull(attr);
    }

    [Fact]
    public void TradeController_BulkUpload_HasRequestFormLimits()
    {
        var method = GetMethod(typeof(TradeController), nameof(TradeController.BulkUpload));
        var attr = GetAttribute<RequestFormLimitsAttribute>(method);

        Assert.NotNull(method);
        Assert.NotNull(attr);
    }

    // ─── WishlistController Tests ────────────────────────────────────────

    [Fact]
    public void WishlistController_BulkUpload_HasRequestSizeLimit()
    {
        var method = GetMethod(typeof(WishlistController), nameof(WishlistController.BulkUpload));
        var attr = GetAttribute<RequestSizeLimitAttribute>(method);

        Assert.NotNull(method);
        Assert.NotNull(attr);
    }

    [Fact]
    public void WishlistController_BulkUpload_HasRequestFormLimits()
    {
        var method = GetMethod(typeof(WishlistController), nameof(WishlistController.BulkUpload));
        var attr = GetAttribute<RequestFormLimitsAttribute>(method);

        Assert.NotNull(method);
        Assert.NotNull(attr);
    }
}
