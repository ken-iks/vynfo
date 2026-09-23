package video

import (
	"context"
	"iter"
	"sync"
)

// UploadWorker parallelizes segment uploads, but observed local uploads are mostly
// limited by network bandwidth to GCS; raising WorkerCount past that saturation point
// does not materially improve total upload time.
type UploadWorker struct {
	WorkerCount int
	Manifest    *ManifestBuilder
}

type UploadResult struct {
	ObjectKey string
	Err       error
}

func (worker UploadWorker) Upload(
	ctx context.Context,
	segments iter.Seq2[VideoSegment, error],
) <-chan UploadResult {
	results := make(chan UploadResult)
	go func() {
		defer close(results)

		ctx, cancel := context.WithCancel(ctx)
		defer cancel()

		workerCount := worker.WorkerCount
		if workerCount <= 0 {
			workerCount = 1
		}

		jobs := make(chan VideoSegment)
		var wg sync.WaitGroup
		for i := 0; i < workerCount; i++ {
			wg.Add(1)
			go worker.run(ctx, cancel, jobs, results, &wg)
		}

	loop:
		for seg, err := range segments {
			if err != nil {
				results <- UploadResult{Err: err}
				cancel()
				break
			}
			select {
			case <-ctx.Done():
				break loop
			case jobs <- seg:
			}
		}

		close(jobs)
		wg.Wait()
	}()
	return results
}

func (worker UploadWorker) run(
	ctx context.Context,
	cancel context.CancelFunc,
	jobs <-chan VideoSegment,
	results chan<- UploadResult,
	wg *sync.WaitGroup,
) {
	defer wg.Done()
	for seg := range jobs {
		result, err := worker.Manifest.UploadSegment(seg, ctx)
		results <- UploadResult{
			ObjectKey: result.ObjectKey,
			Err:       err,
		}
		if err != nil {
			cancel()
			return
		}
	}
}
