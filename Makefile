.PHONY: format

format:
	$(MAKE) -C backend format
	$(MAKE) -C web format
	$(MAKE) -C agent format
