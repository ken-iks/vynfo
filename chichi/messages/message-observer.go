package messages

import (
	"log/slog"

	"sync"
)

// defines a set of subscription channels
// these channels just recieve empty structs as notifications,
// since topics are self describing
type SubscriberSet map[chan struct{}]struct{}

// The MessageObserver is the cooridination hub for the pub-sub mechanism that
// dictates notifying members of spaces when a new message has been sent to the
// space. The observer handles the subscriber fan out to the appropriate channels
type MessageObserver struct {
	mu sync.RWMutex
	// in the observer we map topics (aka space ids) to their set of subscribers
	subscribers map[string]SubscriberSet
}

func NewMessageOberserver() *MessageObserver {
	return &MessageObserver{
		subscribers: make(map[string]SubscriberSet),
	}
}

// The observer's Subscriber registers channels to recieve notifications for
// a specific space_id when it recieves an update
func (o *MessageObserver) Subscribe(user_id string, space_id string) (<-chan struct{}, func()) {
	ch := make(chan struct{}, 1)

	o.mu.Lock()
	if o.subscribers[space_id] == nil {
		slog.Info("new subscription topic", "space_id", space_id)
		o.subscribers[space_id] = make(SubscriberSet)
	}
	slog.Info("new subscription", "user_id", user_id, "space_id", space_id)
	o.subscribers[space_id][ch] = struct{}{}
	o.mu.Unlock()

	// also provide an unsubscribe callback for the caller to be able to defer
	// the unsubscription of this channel from the topic
	unsubscribe := func() {
		o.mu.Lock()
		delete(o.subscribers[space_id], ch)
		if len(o.subscribers[space_id]) == 0 {
			delete(o.subscribers, space_id)
		}
		o.mu.Unlock()
	}

	return ch, unsubscribe
}

// fan out the event to all subscribers to the topic
func (o *MessageObserver) Publish(space_id string) {
	o.mu.RLock()
	defer o.mu.RUnlock()

	for ch := range o.subscribers[space_id] {
		select {
		case ch <- struct{}{}:
			// signal has been delievered to channel
		default:
			// channel buffer is full (already has a pending signal) - skip
		}
	}
}

// when the message listener has to reconnect, all in proccess messages
// will get dropped from the notification queue (notifs are fire and forget).
// in this case we just send an update request to all subscribers so everyone
// can be up to date
func (o *MessageObserver) ResyncAll() {
	o.mu.RLock()
	defer o.mu.RUnlock()
	for _, set := range o.subscribers {
		for ch := range set {
			select {
			case ch <- struct{}{}:
			default:
			}
		}
	}
}
