namespace Olsmaking.Bff.Domain;

public sealed class BeerReview
{
    public Guid Id { get; set; }

    public Guid EventId { get; set; }

    public Guid BeerId { get; set; }

    public Guid UserId { get; set; }

    public int ColorScore { get; set; }

    public int SmellScore { get; set; }

    public int TasteScore { get; set; }

    public int TotalScore { get; set; }

    public string? Notes { get; set; }

    public string? AromaNotes { get; set; }

    public string? AppearanceNotes { get; set; }

    public string? FlavorNotes { get; set; }

    public DateTimeOffset CreatedUtc { get; set; }

    public DateTimeOffset UpdatedUtc { get; set; }

    public byte[] RowVersion { get; set; } = [];

    public Event Event { get; set; } = null!;

    public EventBeer Beer { get; set; } = null!;

    public AppUser User { get; set; } = null!;
}
