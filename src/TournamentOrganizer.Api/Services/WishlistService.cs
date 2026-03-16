using System.Text.RegularExpressions;
using Microsoft.AspNetCore.Http;
using TournamentOrganizer.Api.DTOs;
using TournamentOrganizer.Api.Models;
using TournamentOrganizer.Api.Repositories.Interfaces;
using TournamentOrganizer.Api.Services.Interfaces;

namespace TournamentOrganizer.Api.Services;

public class WishlistService : IWishlistService
{
    private readonly IWishlistRepository _repo;
    private readonly ITradeRepository _tradeRepo;
    private readonly ICardPriceService _priceService;

    public WishlistService(IWishlistRepository repo, ITradeRepository tradeRepo, ICardPriceService priceService)
    {
        _repo = repo;
        _tradeRepo = tradeRepo;
        _priceService = priceService;
    }

    public async Task<List<WishlistEntryDto>> GetByPlayerAsync(int playerId)
    {
        var entries = await _repo.GetByPlayerAsync(playerId);
        var dtos = new List<WishlistEntryDto>(entries.Count);
        foreach (var e in entries)
        {
            var price = await _priceService.GetPriceAsync(e.CardName);
            dtos.Add(ToDto(e, price));
        }
        return dtos;
    }

    public async Task<WishlistEntryDto> AddAsync(int playerId, CreateCardEntryDto dto)
    {
        var entry = new WishlistEntry
        {
            PlayerId = playerId,
            CardName = dto.CardName.Trim(),
            Quantity = dto.Quantity
        };
        await _repo.AddAsync(entry);
        var price = await _priceService.GetPriceAsync(entry.CardName);
        return ToDto(entry, price);
    }

    public Task<bool> DeleteAsync(int id) => _repo.DeleteAsync(id);

    public Task DeleteAllByPlayerAsync(int playerId) => _repo.DeleteAllByPlayerAsync(playerId);

    public async Task<BulkUploadResultDto> BulkAddAsync(int playerId, IFormFile file)
    {
        using var reader = new System.IO.StreamReader(file.OpenReadStream());
        var content = await reader.ReadToEndAsync();
        var lines = content.Split('\n');
        var errors = new List<string>();
        int added = 0;

        for (int i = 0; i < lines.Length; i++)
        {
            var line = lines[i].Trim();
            if (string.IsNullOrEmpty(line)) continue;

            var match = Regex.Match(line, @"^(\d+)\s+(.+)$");
            if (!match.Success || !int.TryParse(match.Groups[1].Value, out int qty) || qty < 1)
            {
                errors.Add($"Line {i + 1}: invalid format — expected '<qty> <card name>'");
                continue;
            }

            await _repo.AddAsync(new WishlistEntry
            {
                PlayerId = playerId,
                CardName = match.Groups[2].Value.Trim(),
                Quantity = qty
            });
            added++;
        }

        return new BulkUploadResultDto(added, errors);
    }

    public async Task<List<WishlistCardSupplyDto>> GetWishlistSupplyAsync(int playerId)
    {
        var wishlist = await _repo.GetByPlayerAsync(playerId);
        if (wishlist.Count == 0) return [];

        var cardNames = wishlist.Select(w => w.CardName).ToList();
        var tradeEntries = await _tradeRepo.GetByCardNamesAsync(cardNames, playerId);

        return wishlist.Select(w =>
        {
            var sellers = tradeEntries
                .Where(t => t.CardName.Equals(w.CardName, StringComparison.OrdinalIgnoreCase))
                .Select(t => t.Player.Name)
                .Distinct()
                .ToList();
            return new WishlistCardSupplyDto(w.CardName, sellers);
        }).ToList();
    }

    private static WishlistEntryDto ToDto(WishlistEntry e, decimal? price)
        => new(e.Id, e.PlayerId, e.CardName, e.Quantity, price);
}
