BOWER=~/lib/bower
LESSC=~/lib/lessc

all: node_modules/unzip components/polymer css/index.css

dist:
	cd dist && make
.PHONY: dist

node_modules/unzip:
	npm install

components/polymer:
	$(BOWER) install

%.css: %.less
	$(LESSC) $< > $@
