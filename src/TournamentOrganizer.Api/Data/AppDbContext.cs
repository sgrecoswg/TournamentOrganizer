using Microsoft.EntityFrameworkCore;
using TournamentOrganizer.Api.Models;

namespace TournamentOrganizer.Api.Data;

public class AppDbContext : DbContext
{
    public AppDbContext(DbContextOptions<AppDbContext> options) : base(options) { }

    public DbSet<Player> Players => Set<Player>();
    public DbSet<Event> Events => Set<Event>();
    public DbSet<EventRegistration> EventRegistrations => Set<EventRegistration>();
    public DbSet<Round> Rounds => Set<Round>();
    public DbSet<Pod> Pods => Set<Pod>();
    public DbSet<Game> Games => Set<Game>();
    public DbSet<GameResult> GameResults => Set<GameResult>();
    public DbSet<PodPlayer> PodPlayers => Set<PodPlayer>();
    public DbSet<WishlistEntry> WishlistEntries => Set<WishlistEntry>();
    public DbSet<TradeEntry> TradeEntries => Set<TradeEntry>();
    public DbSet<License> Licenses => Set<License>();
    public DbSet<Store> Stores => Set<Store>();
    public DbSet<StoreSettings> StoreSettings => Set<StoreSettings>();
    public DbSet<StoreEvent> StoreEvents => Set<StoreEvent>();
    public DbSet<AppUser> AppUsers => Set<AppUser>();
    public DbSet<Theme> Themes => Set<Theme>();
    public DbSet<EventTemplate> EventTemplates => Set<EventTemplate>();
    public DbSet<PlayerBadge> PlayerBadges => Set<PlayerBadge>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<Player>(entity =>
        {
            entity.HasIndex(p => p.Email).IsUnique();
            entity.Property(p => p.Name).HasMaxLength(100).IsRequired();
            entity.Property(p => p.Email).HasMaxLength(200).IsRequired();
            entity.Property(p => p.Mu).HasDefaultValue(25.0);
            entity.Property(p => p.Sigma).HasDefaultValue(25.0 / 3.0);
            entity.Property(p => p.PlacementGamesLeft).HasDefaultValue(5);
            entity.Property(p => p.IsActive).HasDefaultValue(true);
            entity.Ignore(p => p.ConservativeScore);
            entity.Ignore(p => p.IsRanked);
        });

        modelBuilder.Entity<Event>(entity =>
        {
            entity.Property(e => e.Name).HasMaxLength(200).IsRequired();
            entity.Property(e => e.Status)
                .HasConversion<string>()
                .HasMaxLength(20);
            entity.Property(e => e.PointSystem)
                .HasConversion<string>()
                .HasMaxLength(20)
                .HasDefaultValueSql("'ScoreBased'");
            entity.Property(e => e.DefaultRoundTimeMinutes).HasDefaultValue(55);
        });

        modelBuilder.Entity<EventRegistration>(entity =>
        {
            entity.HasIndex(er => new { er.EventId, er.PlayerId }).IsUnique();
            entity.HasOne(er => er.Event)
                .WithMany(e => e.Registrations)
                .HasForeignKey(er => er.EventId);
            entity.HasOne(er => er.Player)
                .WithMany(p => p.EventRegistrations)
                .HasForeignKey(er => er.PlayerId);
            entity.Property(er => er.DecklistUrl).HasMaxLength(500);
        });

        modelBuilder.Entity<Round>(entity =>
        {
            entity.HasOne(r => r.Event)
                .WithMany(e => e.Rounds)
                .HasForeignKey(r => r.EventId);
            entity.HasIndex(r => new { r.EventId, r.RoundNumber }).IsUnique();
        });

        modelBuilder.Entity<Pod>(entity =>
        {
            entity.HasOne(p => p.Round)
                .WithMany(r => r.Pods)
                .HasForeignKey(p => p.RoundId);
        });

        modelBuilder.Entity<PodPlayer>(entity =>
        {
            entity.HasIndex(pp => new { pp.PodId, pp.PlayerId }).IsUnique();
            entity.HasOne(pp => pp.Pod)
                .WithMany(p => p.PodPlayers)
                .HasForeignKey(pp => pp.PodId);
            entity.HasOne(pp => pp.Player)
                .WithMany()
                .HasForeignKey(pp => pp.PlayerId);
        });

        modelBuilder.Entity<Game>(entity =>
        {
            entity.HasOne(g => g.Pod)
                .WithOne(p => p.Game)
                .HasForeignKey<Game>(g => g.PodId);
            entity.Property(g => g.Status)
                .HasConversion<string>()
                .HasMaxLength(20);
        });

        modelBuilder.Entity<GameResult>(entity =>
        {
            entity.HasIndex(gr => new { gr.GameId, gr.PlayerId }).IsUnique();
            entity.HasOne(gr => gr.Game)
                .WithMany(g => g.Results)
                .HasForeignKey(gr => gr.GameId);
            entity.HasOne(gr => gr.Player)
                .WithMany(p => p.GameResults)
                .HasForeignKey(gr => gr.PlayerId);
            entity.Property(gr => gr.CommanderPlayed).HasMaxLength(200);
            entity.Property(gr => gr.DeckColors).HasMaxLength(10);
        });

        modelBuilder.Entity<WishlistEntry>(entity =>
        {
            entity.HasOne(w => w.Player)
                .WithMany()
                .HasForeignKey(w => w.PlayerId);
            entity.Property(w => w.CardName).HasMaxLength(200).IsRequired();
            entity.Property(w => w.Quantity).HasDefaultValue(1);
        });

        modelBuilder.Entity<TradeEntry>(entity =>
        {
            entity.HasOne(t => t.Player)
                .WithMany()
                .HasForeignKey(t => t.PlayerId);
            entity.Property(t => t.CardName).HasMaxLength(200).IsRequired();
            entity.Property(t => t.Quantity).HasDefaultValue(1);
        });

        modelBuilder.Entity<Store>(entity =>
        {
            entity.Property(s => s.StoreName).HasMaxLength(200).IsRequired();
            entity.Property(s => s.Slug).HasMaxLength(120);
            entity.Property(s => s.Location).HasMaxLength(300);
            entity.HasIndex(s => s.Slug).IsUnique().HasFilter("[Slug] IS NOT NULL");
            entity.HasOne(s => s.License)
                .WithMany()
                .HasForeignKey(s => s.LicenseId)
                .IsRequired(false)
                .OnDelete(DeleteBehavior.SetNull);
            entity.HasOne(s => s.Settings)
                .WithOne(ss => ss.Store)
                .HasForeignKey<StoreSettings>(ss => ss.StoreId);
        });

        modelBuilder.Entity<License>(entity =>
        {
            entity.Property(l => l.AppKey).HasMaxLength(200).IsRequired();
            entity.HasOne(l => l.Store)
                .WithMany()
                .HasForeignKey(l => l.StoreId)
                .OnDelete(DeleteBehavior.Restrict);
        });

        modelBuilder.Entity<StoreSettings>(entity =>
        {
            entity.Property(ss => ss.AllowableTradeDifferential)
                .HasPrecision(5, 2)
                .HasDefaultValue(10m);
            entity.HasOne(ss => ss.Theme)
                .WithMany()
                .HasForeignKey(ss => ss.ThemeId)
                .IsRequired(false)
                .OnDelete(DeleteBehavior.SetNull);
        });

        var seedDate = new DateTime(2026, 1, 1, 0, 0, 0, DateTimeKind.Utc);
        modelBuilder.Entity<Theme>().HasData(
            new Theme { Id = 1, Name = "Default", CssClass = "theme-default", IsActive = true, CreatedOn = seedDate, CreatedBy = "seed", UpdatedOn = seedDate, UpdatedBy = "seed" },
            new Theme { Id = 2, Name = "Dark",    CssClass = "theme-dark",    IsActive = true, CreatedOn = seedDate, CreatedBy = "seed", UpdatedOn = seedDate, UpdatedBy = "seed" },
            new Theme { Id = 3, Name = "Forest",  CssClass = "theme-forest",  IsActive = true, CreatedOn = seedDate, CreatedBy = "seed", UpdatedOn = seedDate, UpdatedBy = "seed" },
            new Theme { Id = 4, Name = "Ocean",   CssClass = "theme-ocean",   IsActive = true, CreatedOn = seedDate, CreatedBy = "seed", UpdatedOn = seedDate, UpdatedBy = "seed" }
        );

        modelBuilder.Entity<PlayerBadge>(entity =>
        {
            entity.HasOne(pb => pb.Player)
                .WithMany(p => p.Badges)
                .HasForeignKey(pb => pb.PlayerId)
                .OnDelete(DeleteBehavior.Cascade);
            entity.HasIndex(pb => new { pb.PlayerId, pb.BadgeKey }).IsUnique();
            entity.Property(pb => pb.BadgeKey).HasMaxLength(50).IsRequired();
        });

        modelBuilder.Entity<EventTemplate>(entity =>
        {
            entity.Property(t => t.Name).HasMaxLength(200).IsRequired();
            entity.Property(t => t.Description).HasMaxLength(500);
            entity.Property(t => t.Format).HasMaxLength(100).IsRequired();
            entity.Property(t => t.MaxPlayers).HasDefaultValue(16);
            entity.Property(t => t.NumberOfRounds).HasDefaultValue(4);
            entity.HasOne(t => t.Store)
                .WithMany(s => s.EventTemplates)
                .HasForeignKey(t => t.StoreId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<PlayerBadge>(entity =>
        {
            entity.HasOne(b => b.Player)
                .WithMany(p => p.Badges)
                .HasForeignKey(b => b.PlayerId)
                .OnDelete(DeleteBehavior.Cascade);
            entity.Property(b => b.BadgeKey).HasMaxLength(50).IsRequired();
        });

        modelBuilder.Entity<StoreEvent>(entity =>
        {
            entity.HasIndex(se => se.EventId).IsUnique();
            entity.HasIndex(se => new { se.StoreId, se.EventId }).IsUnique();
            entity.HasOne(se => se.Store)
                .WithMany(s => s.StoreEvents)
                .HasForeignKey(se => se.StoreId)
                .OnDelete(DeleteBehavior.Cascade);
            entity.HasOne(se => se.Event)
                .WithOne(e => e.StoreEvent)
                .HasForeignKey<StoreEvent>(se => se.EventId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<AppUser>(entity =>
        {
            entity.HasIndex(u => u.Email).IsUnique();
            entity.Property(u => u.Email).HasMaxLength(200).IsRequired();
            entity.Property(u => u.Name).HasMaxLength(200).IsRequired();
            entity.Property(u => u.GoogleId).HasMaxLength(200);
            entity.Property(u => u.Role).HasConversion<int>();
            entity.Property(u => u.IsActive).HasDefaultValue(true);
            entity.HasOne(u => u.Player)
                .WithMany()
                .HasForeignKey(u => u.PlayerId)
                .IsRequired(false)
                .OnDelete(DeleteBehavior.SetNull);
            entity.HasOne(u => u.Store)
                .WithMany()
                .HasForeignKey(u => u.StoreId)
                .IsRequired(false)
                .OnDelete(DeleteBehavior.SetNull);
        });
    }
}
