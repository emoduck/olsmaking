namespace Olsmaking.Bff.Domain;

public sealed class BeerFavorite
{
    public Guid Id { get; set; }

    public Guid EventId { get; set; }

    public Guid BeerId { get; set; }

    public Guid UserId { get; set; }

    public DateTimeOffset CreatedUtc { get; set; }

    public Event Event { get; set; } = null!;

    public EventBeer Beer { get; set; } = null!;

    public AppUser User { get; set; } = null!;
}
