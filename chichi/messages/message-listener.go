package messages

import (
	"context"
	"log/slog"
	"time"

	"github.com/lib/pq"
)

// the MessageListener holds a single love lived goroutine holding
// a dedicated postgres connection in order to LISTEN for notification
type MessageListener struct {
	l *pq.Listener
}

func NewMessageListener(dsn string) (*MessageListener, error) {
	m := &MessageListener{}
	m.l = pq.NewListener(
		dsn,
		10*time.Second,
		time.Minute,
		func(event pq.ListenerEventType, err error) {
			if err != nil {
				slog.Error("pg listerner event", "event", event, "error", err)
			}
			// TBD - handle reconnect
		},
	)
	if err := m.l.Listen("space_change"); err != nil {
		return nil, err
	}
	return m, nil
}

func (m *MessageListener) Close() error { return m.l.Close() }

func (m *MessageListener) DispatchNotifications(ctx context.Context, observer *MessageObserver) {
	for {
		select {
		case <-ctx.Done():
			return
		case notif := <-m.l.Notify:
			if notif == nil {
				observer.ResyncAll()
				continue
			}
			if notif.Channel != "space_change" {
				continue
			}
			observer.Publish(notif.Extra)
		}
	}
}
