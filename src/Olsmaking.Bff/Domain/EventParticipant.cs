namespace Olsmaking.Bff.Domain;

public sealed class EventParticipant
{
    public Guid Id { get; set; }

    public Guid EventId { get; set; }

    public Guid UserId { get; set; }

    public EventParticipantRole Role { get; set; } = EventParticipantRole.Member;

    public EventParticipantStatus Status { get; set; } = EventParticipantStatus.Active;

    public DateTimeOffset JoinedUtc { get; set; }

    public DateTimeOffset? RemovedUtc { get; set; }

    public Event Event { get; set; } = null!;

    public AppUser User { get; set; } = null!;
}
