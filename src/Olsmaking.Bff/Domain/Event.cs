namespace Olsmaking.Bff.Domain;

public sealed class Event
{
    public Guid Id { get; set; }

    public Guid OwnerUserId { get; set; }

    public string Name { get; set; } = string.Empty;

    public EventStatus Status { get; set; } = EventStatus.Open;

    public EventVisibility Visibility { get; set; } = EventVisibility.Private;

    public bool IsListed { get; set; }

    public string JoinCode { get; set; } = string.Empty;

    public DateTimeOffset CreatedUtc { get; set; }

    public DateTimeOffset UpdatedUtc { get; set; }

    public AppUser OwnerUser { get; set; } = null!;

    public ICollection<EventParticipant> Participants { get; set; } = new List<EventParticipant>();

    public ICollection<EventBeer> Beers { get; set; } = new List<EventBeer>();

    public ICollection<BeerReview> BeerReviews { get; set; } = new List<BeerReview>();

    public ICollection<BeerFavorite> BeerFavorites { get; set; } = new List<BeerFavorite>();
}
