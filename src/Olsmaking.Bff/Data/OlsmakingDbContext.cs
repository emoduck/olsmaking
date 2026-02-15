using Microsoft.EntityFrameworkCore;
using Olsmaking.Bff.Domain;

namespace Olsmaking.Bff.Data;

public sealed class OlsmakingDbContext(DbContextOptions<OlsmakingDbContext> options) : DbContext(options)
{
    public DbSet<AppUser> AppUsers => Set<AppUser>();

    public DbSet<Event> Events => Set<Event>();

    public DbSet<EventParticipant> EventParticipants => Set<EventParticipant>();

    public DbSet<EventBeer> EventBeers => Set<EventBeer>();

    public DbSet<BeerReview> BeerReviews => Set<BeerReview>();

    public DbSet<BeerFavorite> BeerFavorites => Set<BeerFavorite>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<AppUser>(entity =>
        {
            entity.ToTable("AppUsers");
            entity.HasKey(x => x.Id);
            entity.Property(x => x.Id).ValueGeneratedNever();
            entity.Property(x => x.Auth0Subject).HasMaxLength(200).IsRequired();
            entity.Property(x => x.Email).HasMaxLength(320);
            entity.Property(x => x.Nickname).HasMaxLength(100);
            entity.Property(x => x.CreatedUtc).IsRequired();
            entity.Property(x => x.LastSeenUtc).IsRequired();
            entity.HasIndex(x => x.Auth0Subject).IsUnique();
        });

        modelBuilder.Entity<Event>(entity =>
        {
            entity.ToTable("Events");
            entity.HasKey(x => x.Id);
            entity.Property(x => x.Id).ValueGeneratedNever();
            entity.Property(x => x.OwnerUserId).IsRequired();
            entity.Property(x => x.Name).HasMaxLength(200).IsRequired();
            entity.Property(x => x.Status).HasConversion<int>().IsRequired();
            entity.Property(x => x.Visibility).HasConversion<int>().IsRequired();
            entity.Property(x => x.IsListed).IsRequired();
            entity.Property(x => x.JoinCode).HasMaxLength(32).IsRequired();
            entity.Property(x => x.CreatedUtc).IsRequired();
            entity.Property(x => x.UpdatedUtc).IsRequired();

            entity.HasOne(x => x.OwnerUser)
                .WithMany(x => x.OwnedEvents)
                .HasForeignKey(x => x.OwnerUserId)
                .OnDelete(DeleteBehavior.Restrict);

            entity.HasIndex(x => x.JoinCode).IsUnique();
        });

        modelBuilder.Entity<EventParticipant>(entity =>
        {
            entity.ToTable("EventParticipants");
            entity.HasKey(x => x.Id);
            entity.Property(x => x.Id).ValueGeneratedNever();
            entity.Property(x => x.EventId).IsRequired();
            entity.Property(x => x.UserId).IsRequired();
            entity.Property(x => x.Role).HasConversion<int>().IsRequired();
            entity.Property(x => x.Status).HasConversion<int>().IsRequired();
            entity.Property(x => x.JoinedUtc).IsRequired();

            entity.HasOne(x => x.Event)
                .WithMany(x => x.Participants)
                .HasForeignKey(x => x.EventId)
                .OnDelete(DeleteBehavior.Cascade);

            entity.HasOne(x => x.User)
                .WithMany(x => x.EventParticipants)
                .HasForeignKey(x => x.UserId)
                .OnDelete(DeleteBehavior.Restrict);

            entity.HasIndex(x => new { x.EventId, x.UserId }).IsUnique();
        });

        modelBuilder.Entity<EventBeer>(entity =>
        {
            entity.ToTable("EventBeers");
            entity.HasKey(x => x.Id);
            entity.Property(x => x.Id).ValueGeneratedNever();
            entity.Property(x => x.EventId).IsRequired();
            entity.Property(x => x.Name).HasMaxLength(200).IsRequired();
            entity.Property(x => x.Brewery).HasMaxLength(200);
            entity.Property(x => x.Style).HasMaxLength(100);
            entity.Property(x => x.Abv).HasPrecision(4, 2);
            entity.Property(x => x.CreatedUtc).IsRequired();

            entity.HasOne(x => x.Event)
                .WithMany(x => x.Beers)
                .HasForeignKey(x => x.EventId)
                .OnDelete(DeleteBehavior.Cascade);

            entity.HasIndex(x => x.EventId);
        });

        modelBuilder.Entity<BeerReview>(entity =>
        {
            entity.ToTable("BeerReviews", table =>
            {
                table.HasCheckConstraint("CK_BeerReviews_ColorScore", "[ColorScore] >= 1 AND [ColorScore] <= 6");
                table.HasCheckConstraint("CK_BeerReviews_SmellScore", "[SmellScore] >= 1 AND [SmellScore] <= 6");
                table.HasCheckConstraint("CK_BeerReviews_TasteScore", "[TasteScore] >= 1 AND [TasteScore] <= 6");
                table.HasCheckConstraint("CK_BeerReviews_TotalScore", "[TotalScore] >= 1 AND [TotalScore] <= 6");
            });
            entity.HasKey(x => x.Id);
            entity.Property(x => x.Id).ValueGeneratedNever();
            entity.Property(x => x.EventId).IsRequired();
            entity.Property(x => x.BeerId).IsRequired();
            entity.Property(x => x.UserId).IsRequired();
            entity.Property(x => x.ColorScore).IsRequired();
            entity.Property(x => x.SmellScore).IsRequired();
            entity.Property(x => x.TasteScore).IsRequired();
            entity.Property(x => x.TotalScore).IsRequired();
            entity.Property(x => x.Notes).HasMaxLength(2000);
            entity.Property(x => x.AromaNotes).HasMaxLength(1000);
            entity.Property(x => x.AppearanceNotes).HasMaxLength(1000);
            entity.Property(x => x.FlavorNotes).HasMaxLength(1000);
            entity.Property(x => x.CreatedUtc).IsRequired();
            entity.Property(x => x.UpdatedUtc).IsRequired();
            entity.Property(x => x.RowVersion).IsRowVersion().IsConcurrencyToken();

            entity.HasOne(x => x.Event)
                .WithMany(x => x.BeerReviews)
                .HasForeignKey(x => x.EventId)
                .OnDelete(DeleteBehavior.Restrict);

            entity.HasOne(x => x.Beer)
                .WithMany(x => x.BeerReviews)
                .HasForeignKey(x => x.BeerId)
                .OnDelete(DeleteBehavior.Cascade);

            entity.HasOne(x => x.User)
                .WithMany(x => x.BeerReviews)
                .HasForeignKey(x => x.UserId)
                .OnDelete(DeleteBehavior.Restrict);

            entity.HasIndex(x => new { x.EventId, x.BeerId, x.UserId }).IsUnique();
        });

        modelBuilder.Entity<BeerFavorite>(entity =>
        {
            entity.ToTable("BeerFavorites");
            entity.HasKey(x => x.Id);
            entity.Property(x => x.Id).ValueGeneratedNever();
            entity.Property(x => x.EventId).IsRequired();
            entity.Property(x => x.BeerId).IsRequired();
            entity.Property(x => x.UserId).IsRequired();
            entity.Property(x => x.CreatedUtc).IsRequired();

            entity.HasOne(x => x.Event)
                .WithMany(x => x.BeerFavorites)
                .HasForeignKey(x => x.EventId)
                .OnDelete(DeleteBehavior.Restrict);

            entity.HasOne(x => x.Beer)
                .WithMany(x => x.BeerFavorites)
                .HasForeignKey(x => x.BeerId)
                .OnDelete(DeleteBehavior.Cascade);

            entity.HasOne(x => x.User)
                .WithMany(x => x.BeerFavorites)
                .HasForeignKey(x => x.UserId)
                .OnDelete(DeleteBehavior.Restrict);

            entity.HasIndex(x => new { x.UserId, x.BeerId }).IsUnique();
            entity.HasIndex(x => new { x.EventId, x.UserId });
        });
    }
}
