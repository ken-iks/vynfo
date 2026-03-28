.PHONY: dev format

dev:
	cd chichi && go run . & cd eden && pnpm dev & wait

format:
	$(MAKE) -C chichi format
	$(MAKE) -C eden format
