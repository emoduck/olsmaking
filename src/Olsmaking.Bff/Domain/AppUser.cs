namespace Olsmaking.Bff.Domain;

public sealed class AppUser
{
    public Guid Id { get; set; }

    public string Auth0Subject { get; set; } = string.Empty;

    public string? Email { get; set; }

    public string? Nickname { get; set; }

    public DateTimeOffset CreatedUtc { get; set; }

    public DateTimeOffset LastSeenUtc { get; set; }

    public ICollection<Event> OwnedEvents { get; set; } = new List<Event>();

    public ICollection<EventParticipant> EventParticipants { get; set; } = new List<EventParticipant>();

    public ICollection<BeerReview> BeerReviews { get; set; } = new List<BeerReview>();
}
