namespace Olsmaking.Bff.Domain;

public sealed class EventBeer
{
    public Guid Id { get; set; }

    public Guid EventId { get; set; }

    public string Name { get; set; } = string.Empty;

    public string? Brewery { get; set; }

    public string? Style { get; set; }

    public decimal? Abv { get; set; }

    public DateTimeOffset CreatedUtc { get; set; }

    public Event Event { get; set; } = null!;

    public ICollection<BeerReview> BeerReviews { get; set; } = new List<BeerReview>();
}
