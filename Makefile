build: clean
	@coffee --compile --output lib/ src/

build-watch:
	@echo "Watching..."
	@coffee --compile --watch --output lib/ src/

clean:
	@rm -rf lib/

test:
	@./node_modules/.bin/mocha test/

.PHONY: test